/* ===== Lucia's Dictionary · App Logic ===== */

let DICT = {};
let curSentence = "";
let speakTimer = null;
let bestVoice = null;
const SPEAKER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
const STAR_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
const STAR_OUTLINE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
const CHINESE_RE = /[\u3400-\u9fff]/;
const ONLINE_DICT_CACHE = "lucia-online-dict-v1";
const TRANSLATE_CACHE = "lucia-translate-v1";
const CACHE_TTL = 1000 * 60 * 60 * 24 * 30;
const CACHE_MAX_ITEMS = 240;
const NETWORK_CONCURRENCY = 3;
const STOP_WORDS = new Set(["a","an","the","and","or","but","to","of","in","on","at","for","with","by","from","is","am","are","was","were","be","been","being","do","does","did","it","this","that","these","those","i","you","he","she","we","they","my","your","his","her","our","their"]);
let LOCAL_PHONETICS = {};
let PHRASEBOOK = [];
let analyzeRunId = 0;
const POS_CN = {
  noun: "名词",
  verb: "动词",
  adjective: "形容词",
  adverb: "副词",
  pronoun: "代词",
  preposition: "介词",
  conjunction: "连词",
  interjection: "感叹词"
};
let activeNetworkRequests = 0;
const networkQueue = [];

/* ====== Settings ====== */
const DEFAULTS = { speed: "normal", repeat: 3 };
const getSet = k => { try { const v = localStorage.getItem("lucia-" + k); return v !== null ? JSON.parse(v) : DEFAULTS[k]; } catch(e){ return DEFAULTS[k]; } };
const setSet = (k,v) => { try { localStorage.setItem("lucia-" + k, JSON.stringify(v)); } catch(e){} };

function readCache(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "{}");
    const now = Date.now();
    let changed = false;
    for (const [cacheKey, value] of Object.entries(raw)) {
      const cachedAt = value && typeof value === "object" ? value.cachedAt : 0;
      if (cachedAt && now - cachedAt > CACHE_TTL) {
        delete raw[cacheKey];
        changed = true;
      }
    }
    if (changed) writeCache(key, raw);
    return raw;
  } catch(e) {
    return {};
  }
}

function writeCache(key, value) {
  try {
    const entries = Object.entries(value)
      .sort((a, b) => {
        const at = a[1] && typeof a[1] === "object" ? a[1].cachedAt || 0 : 0;
        const bt = b[1] && typeof b[1] === "object" ? b[1].cachedAt || 0 : 0;
        return bt - at;
      })
      .slice(0, CACHE_MAX_ITEMS);
    localStorage.setItem(key, JSON.stringify(Object.fromEntries(entries)));
  } catch(e) {}
}

function getMeaningValue(entry) {
  if (!entry) return null;
  if (typeof entry === "string") return entry;
  return entry.cn || entry.meaning || null;
}

function getPhoneticValue(entry) {
  if (!entry || typeof entry === "string") return "";
  return entry.phonetic || entry.us || entry.uk || "";
}

function getCachedOnlineWord(word) {
  const cache = readCache(ONLINE_DICT_CACHE);
  return cache[word.toLowerCase()] || null;
}

function setCachedOnlineWord(word, value) {
  const cache = readCache(ONLINE_DICT_CACHE);
  cache[word.toLowerCase()] = { ...value, cachedAt: Date.now() };
  writeCache(ONLINE_DICT_CACHE, cache);
}

function setCardMeaning(card, meaning) {
  if (!meaning) return;
  card.dataset.meaning = meaning;
  updateStarredMeaning(card.dataset.word, meaning);
  const star = card.querySelector(".btn-star");
  if (star) {
    star.disabled = false;
    star.setAttribute("aria-label", "收藏");
  }
}

function getCardMeaning(card) {
  return card.dataset.meaning || "";
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[，。！？、,.!?;；:："'“”‘’()（）]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function setAnalyzeBusy(isBusy) {
  const btn = document.getElementById("go-btn");
  const input = document.getElementById("sentence-input");
  if (btn) btn.disabled = isBusy;
  if (input) input.disabled = isBusy;
}

async function loadJsonAsset(path, fallback) {
  try {
    const res = await fetch(path);
    if (!res.ok) return fallback;
    return await res.json();
  } catch(e) {
    return fallback;
  }
}

function enqueueNetwork(task) {
  return new Promise((resolve, reject) => {
    networkQueue.push({ task, resolve, reject });
    runNetworkQueue();
  });
}

function runNetworkQueue() {
  while (activeNetworkRequests < NETWORK_CONCURRENCY && networkQueue.length) {
    const item = networkQueue.shift();
    activeNetworkRequests++;
    Promise.resolve()
      .then(item.task)
      .then(item.resolve, item.reject)
      .finally(() => {
        activeNetworkRequests--;
        runNetworkQueue();
      });
  }
}

/* ====== Wordbook ====== */
const getWB = () => { try { return JSON.parse(localStorage.getItem("lucia-wordbook") || "[]"); } catch(e){ return []; } };
const saveWB = wb => { try { localStorage.setItem("lucia-wordbook", JSON.stringify(wb)); } catch(e){} };
const isStarred = w => getWB().some(x => x.w === w);
function updateStarredMeaning(w, m) {
  if (!w || !m) return;
  const wb = getWB();
  const item = wb.find(x => x.w === w && !x.m);
  if (item) {
    item.m = m;
    saveWB(wb);
  }
}
function toggleStar(w, m) {
  const wb = getWB();
  const i = wb.findIndex(x => x.w === w);
  if (i >= 0) wb.splice(i,1); else wb.push({ w, m, t: Date.now() });
  saveWB(wb);
  return i < 0;
}

/* ====== Dictionary lookup with morphology ====== */
function lookup(word) {
  const w = word.toLowerCase();
  if (DICT[w]) return getMeaningValue(DICT[w]);
  if (w.length > 2 && w.endsWith('ly') && DICT[w.slice(0,-2)]) return getMeaningValue(DICT[w.slice(0,-2)]) + '地';
  if (w.length > 3 && w.endsWith('ies') && DICT[w.slice(0,-3) + 'y']) return getMeaningValue(DICT[w.slice(0,-3) + 'y']);
  if (w.length > 2 && w.endsWith('es') && DICT[w.slice(0,-2)]) return getMeaningValue(DICT[w.slice(0,-2)]);
  if (w.length > 1 && w.endsWith('s') && DICT[w.slice(0,-1)]) return getMeaningValue(DICT[w.slice(0,-1)]);
  if (w.length > 2 && w.endsWith('ed') && DICT[w.slice(0,-2)]) return getMeaningValue(DICT[w.slice(0,-2)]) + '(过去式)';
  if (w.length > 2 && w.endsWith('ed') && DICT[w.slice(0,-1)]) return getMeaningValue(DICT[w.slice(0,-1)]) + '(过去式)';
  if (w.length > 2 && w.endsWith('er') && DICT[w.slice(0,-2)]) return '更' + getMeaningValue(DICT[w.slice(0,-2)]);
  if (w.length > 3 && w.endsWith('est') && DICT[w.slice(0,-3)]) return '最' + getMeaningValue(DICT[w.slice(0,-3)]);
  if (w.length > 3 && w.endsWith('ing') && DICT[w.slice(0,-3)]) return '正在' + getMeaningValue(DICT[w.slice(0,-3)]);
  if (w.length > 3 && w.endsWith('ing') && DICT[w.slice(0,-3) + 'e']) return '正在' + getMeaningValue(DICT[w.slice(0,-3) + 'e']);
  return null;
}

function lookupLocalPhonetic(word) {
  const w = word.toLowerCase();
  if (DICT[w]) return getPhoneticValue(DICT[w]);
  if (LOCAL_PHONETICS[w]) return LOCAL_PHONETICS[w];
  return "";
}

/* ====== TTS ====== */
function getRate() { return getSet("speed") === "slow" ? 0.6 : 1.0; }

function pickVoice() {
  if (bestVoice) return bestVoice;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;
  const blacklist = "Zarvox,Bad,Whisper,Boing,Bells,Trinoids,Cellos,Pipe,Organ,Deranged,Hysterical,Superstar,Wobble,Bubbles,Good News,Jester,Junior,Ralph,Kathy,Fred,Princess,Albert,Bruce,Bahh,Eddy,Flo,Grandma,Grandpa,Reed,Rocko,Sandy,Shelley,Snoop".split(",");
  const isBad = n => blacklist.some(b => n.indexOf(b) >= 0);
  // Priority: high-quality natural voices first (Apple premium / Google neural / Microsoft)
  const prefs = [
    "Samantha (Premium)","Samantha (Enhanced)","Ava (Premium)","Ava (Enhanced)",
    "Allison (Premium)","Allison (Enhanced)","Susan (Premium)","Susan (Enhanced)",
    "Microsoft Aria Online","Microsoft Jenny Online","Microsoft Guy Online",
    "Google US English","Google UK English Female",
    "Samantha","Ava","Allison","Susan","Karen","Moira","Tessa","Fiona","Daniel","Alex"
  ];
  for (const p of prefs) {
    const v = voices.find(v => v.name === p || v.name.indexOf(p) >= 0);
    if (v && v.lang.startsWith("en")) { bestVoice = v; return v; }
  }
  // prefer localService=false (online neural voices are usually higher quality)
  bestVoice = voices.find(v => v.lang === "en-US" && !v.localService && !isBad(v.name))
            || voices.find(v => v.lang === "en-US" && !isBad(v.name))
            || voices.find(v => v.lang.startsWith("en") && !isBad(v.name));
  return bestVoice;
}

function speakSentence(text) {
  speechSynthesis.cancel();
  document.querySelectorAll(".word-card.sentence-active").forEach(c => c.classList.remove("sentence-active"));

  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = getRate();
  u.pitch = 1.0;
  const v = pickVoice();
  if (v) u.voice = v;

  const cards = Array.from(document.querySelectorAll("#word-list .word-card"));
  const cardByWord = {};
  cards.forEach(c => {
    const w = c.querySelector(".word-en");
    if (w) {
      const key = w.textContent.trim().toLowerCase();
      if (!cardByWord[key]) cardByWord[key] = c;
    }
  });
  const tokens = (text.match(/[a-zA-Z']+/g) || []).map(t => t.toLowerCase());
  let lastCard = null;

  u.onboundary = ev => {
    if (ev.name && ev.name !== "word") return;
    const before = text.slice(0, ev.charIndex);
    const beforeTokens = before.match(/[a-zA-Z']+/g) || [];
    const idx = beforeTokens.length;
    const word = tokens[idx];
    if (!word) return;
    const card = cardByWord[word];
    if (lastCard && lastCard !== card) lastCard.classList.remove("sentence-active");
    if (card) {
      card.classList.add("sentence-active");
      lastCard = card;
      const r = card.getBoundingClientRect();
      if (r.top < 80 || r.bottom > window.innerHeight - 80) {
        const y = r.top + window.scrollY - window.innerHeight / 2 + r.height / 2;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    }
  };
  u.onend = u.onerror = () => {
    document.querySelectorAll(".word-card.sentence-active").forEach(c => c.classList.remove("sentence-active"));
  };
  speechSynthesis.speak(u);
}

function speak(text, onEnd) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = getRate();
  u.pitch = 1.0;
  const v = pickVoice();
  if (v) u.voice = v;
  if (onEnd) u.onend = onEnd;
  speechSynthesis.speak(u);
}

function speakWordN(word, el) {
  if (speakTimer) { clearTimeout(speakTimer); speakTimer = null; }
  speechSynthesis.cancel();
  document.querySelectorAll(".word-card.speaking").forEach(c => c.classList.remove("speaking"));
  if (el) el.classList.add("speaking");
  const n = getSet("repeat");
  let count = 0;
  const go = () => {
    if (count >= n) { if (el) el.classList.remove("speaking"); return; }
    count++;
    speak(word, () => { speakTimer = setTimeout(go, 380); });
  };
  go();
}

async function translateText(text, from, to) {
  const value = String(text || "").trim();
  if (!value) return "";

  const key = `${from}:${to}:${value}`;
  const cache = readCache(TRANSLATE_CACHE);
  if (cache[key]?.text) return cache[key].text;

  if ("Translator" in window && typeof window.Translator?.create === "function") {
    try {
      const translator = await window.Translator.create({ sourceLanguage: from, targetLanguage: to });
      const translated = String(await translator.translate(value)).trim();
      if (translated) {
        cache[key] = { text: translated, cachedAt: Date.now(), source: "browser" };
        writeCache(TRANSLATE_CACHE, cache);
        return translated;
      }
    } catch(e) {}
  }

  const url = "https://translate.googleapis.com/translate_a/single?client=gtx"
    + "&dt=t"
    + "&sl=" + encodeURIComponent(from)
    + "&tl=" + encodeURIComponent(to)
    + "&q=" + encodeURIComponent(value);
  const res = await enqueueNetwork(() => fetch(url));
  if (!res.ok) throw new Error("Translate request failed");
  const data = await res.json();
  const translated = Array.isArray(data?.[0])
    ? data[0].map(part => part?.[0] || "").join("").trim()
    : "";
  if (!translated) throw new Error("Translate response was empty");

  cache[key] = { text: translated, cachedAt: Date.now(), source: "online-fallback" };
  writeCache(TRANSLATE_CACHE, cache);
  return translated;
}

function pickPhonetic(entry) {
  const candidates = [];
  if (entry?.phonetic) candidates.push(entry.phonetic);
  for (const item of entry?.phonetics || []) {
    if (item?.text) candidates.push(item.text);
  }
  return candidates.find(Boolean) || "";
}

async function lookupOnlineData(word) {
  const w = String(word).toLowerCase().trim();
  if (!w) return null;

  const cached = getCachedOnlineWord(w);
  if (cached) return cached;

  const res = await enqueueNetwork(() => fetch("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(w)));
  const data = await res.json();
  if (!res.ok || !Array.isArray(data) || data.title) return null;

  const entry = data[0];
  const phonetic = pickPhonetic(entry);
  const definitions = [];
  for (const meaning of entry.meanings || []) {
    if (definitions.length >= 2) break;
    const definition = meaning.definitions?.[0]?.definition;
    if (definition) {
      definitions.push({
        pos: POS_CN[meaning.partOfSpeech] || meaning.partOfSpeech || "释义",
        en: definition
      });
    }
  }

  const translated = [];
  for (const item of definitions) {
    try {
      translated.push({ pos: item.pos, cn: await translateText(item.en, "en", "zh-CN") });
    } catch(e) {
      translated.push({ pos: item.pos, cn: "中文释义暂时不可用" });
    }
  }

  const result = {
    phonetic,
    definitions: translated,
    meaning: translated.map(item => `${item.pos}：${item.cn}`).join("；")
  };
  setCachedOnlineWord(w, result);
  return result;
}

function renderDefinitions(definitions) {
  if (!definitions?.length) {
    return '<span style="color:var(--whisper);font-size:.85rem">未找到中文释义</span>';
  }
  return definitions.map(item =>
    `<div style="margin-top:3px"><span class="pos-tag">${escapeHtml(item.pos)}</span>${escapeHtml(item.cn)}</div>`
  ).join("");
}

function findTemplateTranslation(text) {
  const normalized = normalizeText(text);
  if (!normalized) return "";
  const allowLooseMatch = normalized.length >= 4;

  for (const item of PHRASEBOOK) {
    const cn = normalizeText(item.cn);
    if (cn && (normalized === cn || (allowLooseMatch && (cn.includes(normalized) || normalized.includes(cn))))) {
      return item.en;
    }
  }

  if (typeof TEMPLATES === "undefined") return "";
  for (const group of TEMPLATES) {
    for (const [en, cn] of group.items) {
      const plainCn = normalizeText(cn);
      if (normalized === plainCn || (allowLooseMatch && (plainCn.includes(normalized) || normalized.includes(plainCn)))) {
        return en;
      }
    }
  }
  return "";
}

function reverseLookupChineseWords(text) {
  const hits = [];
  const seen = new Set();
  const source = String(text).replace(/\s+/g, "");
  for (const [word, entry] of Object.entries(DICT)) {
    if (STOP_WORDS.has(word)) continue;
    const meaning = getMeaningValue(entry);
    if (!meaning || meaning.length < 2) continue;
    const candidates = meaning.split(/[;；,，、/]/).map(item => item.trim()).filter(Boolean);
    if (candidates.some(item => source.includes(item)) && !seen.has(word)) {
      seen.add(word);
      hits.push(word);
      if (hits.length >= 12) break;
    }
  }
  return hits.join(" ");
}

async function resolveChineseInput(raw) {
  const localTemplate = findTemplateTranslation(raw);
  if (localTemplate) return { sentence: localTemplate, source: "template" };

  const localWords = reverseLookupChineseWords(raw);
  try {
    const sentence = await translateText(raw, "zh-CN", "en");
    return { sentence, source: "online" };
  } catch(e) {
    if (localWords) return { sentence: localWords, source: "local-words" };
    throw e;
  }
}

function setSentenceSpeakLabel(label) {
  const btn = document.getElementById("speak-sentence-btn");
  if (!btn) return;
  const textNode = Array.from(btn.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
  if (textNode) textNode.textContent = " " + label;
}

function isCurrentAnalyzeRun(runId) {
  return runId == null || runId === analyzeRunId;
}

async function hydrateOnlineWord(word, cnEl, phoneticEl, card, options = {}) {
  const w = String(word).toLowerCase().trim();
  if (!w) return;
  const runId = options.runId;

  const cached = getCachedOnlineWord(w);
  if (cached) {
    if (!isCurrentAnalyzeRun(runId)) return;
    if (cached.phonetic && phoneticEl) phoneticEl.textContent = cached.phonetic;
    if (options.fillMeaning) {
      cnEl.innerHTML = renderDefinitions(cached.definitions);
      setCardMeaning(card, cached.meaning);
    }
    return;
  }

  if (options.fillMeaning) {
    cnEl.innerHTML = '<span style="color:var(--whisper);font-size:.85rem">正在查询中文释义…</span>';
  }
  if (phoneticEl && !phoneticEl.textContent.trim()) {
    phoneticEl.textContent = "音标查询中…";
  }

  try {
    const data = await lookupOnlineData(w);
    if (!isCurrentAnalyzeRun(runId)) return;
    if (!data) {
      if (options.fillMeaning) {
        cnEl.innerHTML = '<span style="color:var(--whisper);font-size:.85rem">未找到中文释义</span>';
      }
      if (phoneticEl && phoneticEl.textContent === "音标查询中…") phoneticEl.textContent = "暂无音标";
      return;
    }
    if (data.phonetic && phoneticEl) phoneticEl.textContent = data.phonetic;
    if (options.fillMeaning) {
      cnEl.innerHTML = renderDefinitions(data.definitions);
      setCardMeaning(card, data.meaning);
    }
  } catch(e) {
    if (!isCurrentAnalyzeRun(runId)) return;
    if (options.fillMeaning) {
      cnEl.innerHTML = '<span style="color:var(--whisper);font-size:.85rem">网络错误，暂时无法查询</span>';
    }
    if (phoneticEl && phoneticEl.textContent === "音标查询中…") phoneticEl.textContent = "暂无音标";
  }
}

/* ====== Word Card builder ====== */
function buildWordCard(word, idx, meaning, container, options = {}) {
  const key = word.toLowerCase();
  const skipOnlineLookup = !meaning && STOP_WORDS.has(key);
  const displayMeaning = skipOnlineLookup ? "常用功能词，帮助句子表达语法关系" : meaning;
  const card = document.createElement("div");
  card.className = "word-card";
  card.style.animationDelay = (idx * 0.05) + "s";
  card.dataset.word = key;
  setCardMeaning(card, displayMeaning || "");

  const num = document.createElement("div");
  num.className = "word-num";
  num.textContent = idx + 1;

  const body = document.createElement("div");
  body.className = "word-body";

  const en = document.createElement("div");
  en.className = "word-en";
  en.textContent = word;

  const ph = document.createElement("div");
  ph.className = "word-phonetic";
  ph.textContent = lookupLocalPhonetic(word);

  const cn = document.createElement("div");
  cn.className = "word-cn";
  if (displayMeaning) {
    cn.textContent = displayMeaning;
  } else {
    cn.innerHTML = '<span style="color:var(--whisper);font-size:.85rem">正在查询中文释义…</span>';
  }

  body.appendChild(en);
  body.appendChild(ph);
  body.appendChild(cn);

  const actions = document.createElement("div");
  actions.className = "word-actions";

  const star = document.createElement("button");
  const starred = isStarred(key);
  star.className = "btn-star" + (starred ? " active" : "");
  star.innerHTML = starred ? STAR_SVG : STAR_OUTLINE;
  star.setAttribute("aria-label", "收藏");
  if (!displayMeaning) {
    star.disabled = true;
    star.setAttribute("aria-label", "释义加载后可收藏");
  }
  star.addEventListener("click", e => {
    e.stopPropagation();
    if (star.disabled) return;
    const added = toggleStar(key, getCardMeaning(card));
    star.className = "btn-star" + (added ? " active" : "");
    star.innerHTML = added ? STAR_SVG : STAR_OUTLINE;
  });

  const speakBtn = document.createElement("button");
  speakBtn.className = "btn-speak";
  speakBtn.innerHTML = SPEAKER_SVG;
  speakBtn.setAttribute("aria-label", "朗读");
  speakBtn.addEventListener("click", e => {
    e.stopPropagation();
    speakWordN(word, card);
  });

  actions.appendChild(star);
  actions.appendChild(speakBtn);

  card.appendChild(num);
  card.appendChild(body);
  card.appendChild(actions);

  card.addEventListener("click", () => speakWordN(word, card));
  container.appendChild(card);
  if (!skipOnlineLookup) {
    hydrateOnlineWord(word, cn, ph, card, { fillMeaning: !meaning, runId: options.runId });
  }
}

/* ====== Home — Analyze ====== */
async function analyzeSentence() {
  const raw = document.getElementById("sentence-input").value.trim();
  if (!raw) return;
  if (document.getElementById("go-btn")?.disabled) return;
  const runId = ++analyzeRunId;
  const bar = document.getElementById("sentence-bar");
  const list = document.getElementById("word-list");

  let sentence = raw;
  setAnalyzeBusy(true);
  bar.classList.add("visible");
  document.getElementById("sentence-text").textContent = raw;
  setSentenceSpeakLabel("朗读整句");

  try {
    if (CHINESE_RE.test(raw)) {
      list.innerHTML = `
        <div class="empty">
          <div class="empty-mascot"><img src="assets/logo-placeholder.jpeg" alt=""></div>
          <p>正在识别中文句子<br><strong>优先使用本地短句和词库</strong></p>
        </div>`;
      try {
        const resolved = await resolveChineseInput(raw);
        if (runId !== analyzeRunId) return;
        sentence = resolved.sentence;
        const sourceLabel = resolved.source === "template" ? "本地课堂短句" : resolved.source === "local-words" ? "本地词库" : "在线翻译";
        document.getElementById("sentence-text").textContent = `${raw} → ${sentence}（${sourceLabel}）`;
        setSentenceSpeakLabel("朗读英文句子");
      } catch(e) {
        if (runId !== analyzeRunId) return;
        list.innerHTML = `
          <div class="empty">
            <div class="empty-mascot"><img src="assets/logo-placeholder.jpeg" alt=""></div>
            <p>中文识别暂时不可用<br><strong>请检查网络，或先输入英文句子</strong></p>
          </div>`;
        return;
      }
    }

    if (runId !== analyzeRunId) return;
    curSentence = sentence;
    const words = sentence.match(/[a-zA-Z']+/g) || [];
    list.innerHTML = "";

    if (!words.length) {
      list.innerHTML = `
        <div class="empty">
          <div class="empty-mascot"><img src="assets/logo-placeholder.jpeg" alt=""></div>
          <p>没有发现英文单词哦<br><strong>试试粘贴一句完整的英语吧～</strong></p>
        </div>`;
      return;
    }

    const seen = new Set();
    const uniqWords = [];
    for (const w of words) {
      const key = w.toLowerCase();
      if (!seen.has(key)) { seen.add(key); uniqWords.push(w); }
    }

    for (let i = 0; i < uniqWords.length; i++) {
      buildWordCard(uniqWords[i], i, lookup(uniqWords[i]), list, { runId });
    }
  } finally {
    if (runId === analyzeRunId) setAnalyzeBusy(false);
  }
}

/* ====== Wordbook ====== */
function renderWordbook() {
  const wb = getWB();
  const stats = document.getElementById("wb-stats");
  const actions = document.getElementById("wb-actions");
  const list = document.getElementById("wb-list");

  if (!wb.length) {
    stats.style.display = "none";
    actions.style.display = "none";
    list.innerHTML = `
      <div class="empty">
        <div class="empty-mascot"><img src="assets/logo-placeholder.jpeg" alt=""></div>
        <p>生词本还是空的<br><strong>在首页点 ☆ 把单词收藏到这里吧</strong></p>
      </div>`;
    return;
  }

  stats.style.display = "flex";
  stats.innerHTML = `
    <div>
      <div class="num">${wb.length}</div>
      <div class="label">个收藏的单词<small>点单词卡片可以听发音</small></div>
    </div>`;

  actions.style.display = "flex";
  list.innerHTML = "";

  for (let i = 0; i < wb.length; i++) {
    const entry = wb[i];
    const card = document.createElement("div");
    card.className = "word-card";
    card.style.animationDelay = (i * 0.04) + "s";

    const num = document.createElement("div");
    num.className = "word-num";
    num.textContent = i + 1;

    const body = document.createElement("div");
    body.className = "word-body";
    const en = document.createElement("div");
    en.className = "word-en";
    en.textContent = entry.w;
    const ph = document.createElement("div");
    ph.className = "word-phonetic";
    ph.textContent = lookupLocalPhonetic(entry.w);
    const cn = document.createElement("div");
    cn.className = "word-cn";
    if (entry.m) {
      cn.textContent = entry.m;
    } else {
      cn.innerHTML = '<span style="color:var(--whisper);font-size:.85rem">正在查询中文释义…</span>';
    }
    body.appendChild(en); body.appendChild(ph); body.appendChild(cn);

    const acts = document.createElement("div");
    acts.className = "word-actions";

    const star = document.createElement("button");
    star.className = "btn-star active";
    star.innerHTML = STAR_SVG;
    star.addEventListener("click", e => {
      e.stopPropagation();
      saveWB(getWB().filter(x => x.w !== entry.w));
      renderWordbook();
    });

    const speakBtn = document.createElement("button");
    speakBtn.className = "btn-speak";
    speakBtn.innerHTML = SPEAKER_SVG;
    speakBtn.addEventListener("click", e => { e.stopPropagation(); speakWordN(entry.w, card); });

    acts.appendChild(star); acts.appendChild(speakBtn);
    card.appendChild(num); card.appendChild(body); card.appendChild(acts);
    setCardMeaning(card, entry.m || "");
    card.addEventListener("click", () => speakWordN(entry.w, card));
    list.appendChild(card);
    hydrateOnlineWord(entry.w, cn, ph, card, { fillMeaning: !entry.m });
  }
}

function reviewAll() {
  const wb = getWB();
  if (!wb.length) return;
  let i = 0;
  const next = () => {
    if (i >= wb.length) return;
    const cards = document.querySelectorAll("#wb-list .word-card");
    if (cards[i]) cards[i].classList.add("speaking");
    const ci = i;
    speak(wb[i].w, () => {
      if (cards[ci]) cards[ci].classList.remove("speaking");
      i++;
      setTimeout(next, 320);
    });
  };
  next();
}

function clearWordbook() {
  if (confirm("确定要清空所有收藏的单词吗？")) {
    saveWB([]);
    renderWordbook();
  }
}

/* ====== Templates ====== */
const TPL_ICONS = {
  homework: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>',
  reading: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  writing: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>',
  math: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="12" y1="5" x2="12" y2="11"/><line x1="8" y1="16" x2="16" y2="16"/><line x1="8" y1="19" x2="16" y2="19"/></svg>',
  science: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v7.31"/><path d="M14 9.3V2"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M5.52 16h12.96"/></svg>',
  classroom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><circle cx="9" cy="9" r="0.5" fill="currentColor"/><circle cx="9" cy="13" r="0.5" fill="currentColor"/></svg>'
};

const TEMPLATES = [
  { cat: "作业类", iconKey: "homework", items: [
    ["Complete the worksheet.", "完成练习单。"],
    ["Show your work.", "写出你的解题过程。"],
    ["Turn in your homework.", "交上你的家庭作业。"],
    ["Do problems 1 through 10.", "做第1题到第10题。"],
    ["Finish the assignment by Friday.", "在周五之前完成作业。"],
    ["Write your name on the top of the page.", "在页面顶部写上你的名字。"],
    ["Use complete sentences.", "使用完整的句子。"],
    ["Check your answers before turning in.", "交之前检查你的答案。"],
    ["Follow the directions carefully.", "仔细按照指示操作。"],
    ["This is due tomorrow.", "这个明天要交。"],
    ["Make sure your work is neat and legible.", "确保你的作业整洁可读。"]
  ]},
  { cat: "阅读类", iconKey: "reading", items: [
    ["Read the passage and answer the questions.", "阅读文章并回答问题。"],
    ["Underline the main idea.", "在主旨句下面画线。"],
    ["Circle the correct answer.", "圈出正确答案。"],
    ["Find the topic sentence.", "找到主题句。"],
    ["Read pages 20 to 35.", "阅读第20页到第35页。"],
    ["Summarize the story in your own words.", "用你自己的话总结这个故事。"],
    ["What is the main idea of this paragraph?", "这段话的主要意思是什么？"],
    ["Compare and contrast the two characters.", "比较两个角色的异同。"],
    ["Make a prediction about what will happen next.", "预测接下来会发生什么。"]
  ]},
  { cat: "写作类", iconKey: "writing", items: [
    ["Write a paragraph about your topic.", "围绕你的主题写一段话。"],
    ["Edit your draft for spelling and grammar.", "检查你的草稿的拼写和语法。"],
    ["Write a rough draft first.", "先写一篇草稿。"],
    ["Include a topic sentence.", "包含一个主题句。"],
    ["Use transition words.", "使用过渡词。"],
    ["Revise your essay.", "修改你的文章。"],
    ["Brainstorm ideas before you start writing.", "写之前先进行头脑风暴。"],
    ["Add more details to support your opinion.", "添加更多细节来支持你的观点。"]
  ]},
  { cat: "数学类", iconKey: "math", items: [
    ["Solve the equation.", "解这个等式。"],
    ["Round to the nearest ten.", "四舍五入到最接近的十位数。"],
    ["Show your work step by step.", "逐步写出你的解题过程。"],
    ["Estimate the answer first.", "先估算一下答案。"],
    ["Find the area and perimeter.", "求面积和周长。"],
    ["Reduce the fraction to lowest terms.", "把分数化简到最简形式。"],
    ["Plot the points on the graph.", "在图表上标出这些点。"],
    ["What is the sum of these numbers?", "这些数字的和是多少？"],
    ["Convert the fraction to a decimal.", "把分数转换成小数。"]
  ]},
  { cat: "科学类", iconKey: "science", items: [
    ["Record your observations.", "记录你的观察结果。"],
    ["Label the diagram.", "标注这个图表。"],
    ["Write a hypothesis.", "写一个假设。"],
    ["What did you conclude from the experiment?", "你从实验中得出了什么结论？"],
    ["Describe the steps of the experiment.", "描述实验的步骤。"],
    ["Draw and label the parts of a plant.", "画出并标注植物的各个部分。"],
    ["List the materials you need.", "列出你需要的材料。"],
    ["Predict what will happen.", "预测会发生什么。"]
  ]},
  { cat: "课堂行为", iconKey: "classroom", items: [
    ["Raise your hand before speaking.", "说话之前先举手。"],
    ["Line up quietly.", "安静地排队。"],
    ["Take out your notebook.", "拿出你的笔记本。"],
    ["Put your materials away.", "把你的东西收好。"],
    ["Pay attention.", "注意听讲。"],
    ["Work with your partner.", "和你的搭档一起做。"],
    ["Take turns.", "轮流来。"],
    ["Keep your hands to yourself.", "管好你自己的手。"],
    ["Clean up your desk.", "整理你的桌子。"],
    ["Walk, don't run, in the hallway.", "在走廊里要走，不要跑。"],
    ["Eyes on me.", "看着我/注意看这里。"],
    ["Please be seated.", "请坐下。"],
    ["You may go to the restroom.", "你可以去洗手间了。"],
    ["Bring your signed permission slip.", "带上你家长签名的许可单。"]
  ]}
];

let activeTplCat = 0;
function renderTemplates() {
  const tabs = document.getElementById("tpl-tabs");
  const list = document.getElementById("tpl-list");
  tabs.innerHTML = "";
  TEMPLATES.forEach((cat, i) => {
    const btn = document.createElement("button");
    btn.className = "tpl-tab" + (i === activeTplCat ? " active" : "");
    btn.innerHTML = TPL_ICONS[cat.iconKey] + "<span>" + cat.cat + "</span>";
    btn.addEventListener("click", () => { activeTplCat = i; renderTemplates(); });
    tabs.appendChild(btn);
  });

  list.innerHTML = "";
  TEMPLATES[activeTplCat].items.forEach(([en, cn]) => {
    const div = document.createElement("div");
    div.className = "tpl-item";
    div.innerHTML = `
      <div class="en">${en}</div>
      <div class="cn">${cn}</div>
      <div class="actions">
        <button class="btn-action moss spk-btn">${SPEAKER_SVG}<span>朗读</span></button>
        <button class="btn-action honey learn-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg><span>学习单词</span></button>
      </div>`;
    div.querySelector(".spk-btn").addEventListener("click", e => { e.stopPropagation(); speak(en); });
    div.querySelector(".learn-btn").addEventListener("click", e => {
      e.stopPropagation();
      document.getElementById("sentence-input").value = en;
      navTo("home");
      analyzeSentence();
      // scroll to word list so user lands directly on results
      requestAnimationFrame(() => {
        const list = document.getElementById("word-list");
        if (list) {
          const y = list.getBoundingClientRect().top + window.scrollY - 12;
          window.scrollTo({ top: y, behavior: "smooth" });
        }
      });
    });
    list.appendChild(div);
  });
}

/* ====== Settings ====== */
function renderSettings() {
  const speeds = [["慢速", "slow"], ["正常", "normal"]];
  const repeats = [1, 3, 5];
  const curSpeed = getSet("speed");
  const curRepeat = getSet("repeat");

  document.getElementById("speed-options").innerHTML =
    speeds.map(([l,v]) => `<button class="set-btn${curSpeed===v?' active':''}" data-speed="${v}">${l}</button>`).join("");
  document.getElementById("repeat-options").innerHTML =
    repeats.map(n => `<button class="set-btn${curRepeat===n?' active':''}" data-repeat="${n}">${n} 遍</button>`).join("");

  document.querySelectorAll("[data-speed]").forEach(b => b.addEventListener("click", () => { setSet("speed", b.dataset.speed); renderSettings(); }));
  document.querySelectorAll("[data-repeat]").forEach(b => b.addEventListener("click", () => { setSet("repeat", parseInt(b.dataset.repeat)); renderSettings(); }));
  const clearCacheBtn = document.getElementById("clear-cache-btn");
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener("click", () => {
      localStorage.removeItem(ONLINE_DICT_CACHE);
      localStorage.removeItem(TRANSLATE_CACHE);
      clearCacheBtn.textContent = "已清除";
      setTimeout(() => { clearCacheBtn.textContent = "清除查询缓存"; }, 1200);
    });
  }

  document.getElementById("dict-count").textContent = Object.keys(DICT).length.toLocaleString();
  const wbCountEl = document.getElementById("about-wb-count");
  if (wbCountEl) wbCountEl.textContent = getWB().length.toLocaleString();
}

/* ====== Nav ====== */
function navTo(pg, opts) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("pg-" + pg).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.pg === pg));
  if (!opts || !opts.keepScroll) window.scrollTo(0, 0);
  if (pg === "wordbook") renderWordbook();
  if (pg === "templates") renderTemplates();
  if (pg === "settings") renderSettings();
}

/* ====== Init ====== */
async function init() {
  [DICT, LOCAL_PHONETICS, PHRASEBOOK] = await Promise.all([
    loadJsonAsset("assets/dict.json", {}),
    loadJsonAsset("assets/phonetics.json", {}),
    loadJsonAsset("assets/phrasebook.json", [])
  ]);

  // nav buttons
  document.querySelectorAll(".nav-item").forEach(b =>
    b.addEventListener("click", () => navTo(b.dataset.pg))
  );

  // home actions
  document.getElementById("go-btn").addEventListener("click", analyzeSentence);
  document.getElementById("speak-sentence-btn").addEventListener("click", () => { if (curSentence) speakSentence(curSentence); });
  document.getElementById("sentence-input").addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); analyzeSentence(); }
  });

  // wordbook actions
  document.getElementById("review-all-btn").addEventListener("click", reviewAll);
  document.getElementById("clear-wb-btn").addEventListener("click", clearWordbook);

  // voices
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = pickVoice;
  }
  setTimeout(() => { speechSynthesis.getVoices(); pickVoice(); }, 100);

  renderSettings();
}

document.addEventListener("DOMContentLoaded", init);
