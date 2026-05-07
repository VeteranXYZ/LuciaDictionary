/* ===== Lucia's Dictionary · App Logic ===== */

let DICT = {};
let curSentence = "";
let speakTimer = null;
let bestVoice = null;
const SPEAKER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
const STAR_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
const STAR_OUTLINE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';

/* ====== Settings ====== */
const DEFAULTS = { speed: "normal", repeat: 3 };
const getSet = k => { try { const v = localStorage.getItem("lucia-" + k); return v !== null ? JSON.parse(v) : DEFAULTS[k]; } catch(e){ return DEFAULTS[k]; } };
const setSet = (k,v) => { try { localStorage.setItem("lucia-" + k, JSON.stringify(v)); } catch(e){} };

/* ====== Wordbook ====== */
const getWB = () => { try { return JSON.parse(localStorage.getItem("lucia-wordbook") || "[]"); } catch(e){ return []; } };
const saveWB = wb => { try { localStorage.setItem("lucia-wordbook", JSON.stringify(wb)); } catch(e){} };
const isStarred = w => getWB().some(x => x.w === w);
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
  if (DICT[w]) return DICT[w];
  if (w.length > 2 && w.endsWith('ly') && DICT[w.slice(0,-2)]) return DICT[w.slice(0,-2)] + '地';
  if (w.length > 3 && w.endsWith('ies') && DICT[w.slice(0,-3) + 'y']) return DICT[w.slice(0,-3) + 'y'];
  if (w.length > 2 && w.endsWith('es') && DICT[w.slice(0,-2)]) return DICT[w.slice(0,-2)];
  if (w.length > 1 && w.endsWith('s') && DICT[w.slice(0,-1)]) return DICT[w.slice(0,-1)];
  if (w.length > 2 && w.endsWith('ed') && DICT[w.slice(0,-2)]) return DICT[w.slice(0,-2)] + '(过去式)';
  if (w.length > 2 && w.endsWith('ed') && DICT[w.slice(0,-1)]) return DICT[w.slice(0,-1)] + '(过去式)';
  if (w.length > 2 && w.endsWith('er') && DICT[w.slice(0,-2)]) return '更' + DICT[w.slice(0,-2)];
  if (w.length > 3 && w.endsWith('est') && DICT[w.slice(0,-3)]) return '最' + DICT[w.slice(0,-3)];
  if (w.length > 3 && w.endsWith('ing') && DICT[w.slice(0,-3)]) return '正在' + DICT[w.slice(0,-3)];
  if (w.length > 3 && w.endsWith('ing') && DICT[w.slice(0,-3) + 'e']) return '正在' + DICT[w.slice(0,-3) + 'e'];
  return null;
}

/* ====== Phonetic — heuristic from spelling ====== */
/* Used as a placeholder; real phonetic comes from online API on click. */
function approxPhonetic(word) {
  // very simple heuristic — show /word/ format with stress mark
  const w = word.toLowerCase();
  if (w.length < 2) return '';
  return '/' + w + '/';
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

/* ====== Online lookup (Free Dictionary API) ====== */
function lookupOnline(word, mountEl, phoneticEl) {
  const w = String(word).toLowerCase().trim();
  if (!w) return;
  mountEl.innerHTML = '<span style="color:var(--whisper);font-size:.85rem">⏳ 查询中…</span>';
  fetch("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(w))
    .then(r => r.json())
    .then(data => {
      if (!data || data.title || !Array.isArray(data)) {
        mountEl.innerHTML = '<span style="color:var(--whisper);font-size:.85rem">未找到释义</span>';
        return;
      }
      const entry = data[0];
      if (entry.phonetic && phoneticEl) phoneticEl.textContent = entry.phonetic;
      const meanings = entry.meanings || [];
      let html = '';
      let count = 0;
      for (const mg of meanings) {
        if (count >= 2) break;
        const defs = mg.definitions || [];
        if (defs.length) {
          html += '<div style="margin-top:3px"><span class="pos-tag">' + (mg.partOfSpeech || '') + '</span>' + defs[0].definition + '</div>';
          count++;
        }
      }
      mountEl.innerHTML = html || '<span style="color:var(--whisper);font-size:.85rem">未找到释义</span>';
    })
    .catch(() => {
      mountEl.innerHTML = '<span style="color:var(--whisper);font-size:.85rem">网络错误，请重试</span>';
    });
}

/* ====== Word Card builder ====== */
function buildWordCard(word, idx, meaning, container) {
  const card = document.createElement("div");
  card.className = "word-card";
  card.style.animationDelay = (idx * 0.05) + "s";

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
  ph.textContent = approxPhonetic(word);

  const cn = document.createElement("div");
  cn.className = "word-cn";
  if (meaning) {
    cn.textContent = meaning;
  } else {
    const link = document.createElement("a");
    link.className = "lookup-link";
    link.textContent = "点击查询英文释义";
    link.addEventListener("click", e => {
      e.preventDefault(); e.stopPropagation();
      lookupOnline(word, cn, ph);
    });
    cn.appendChild(link);
  }

  body.appendChild(en);
  body.appendChild(ph);
  body.appendChild(cn);

  const actions = document.createElement("div");
  actions.className = "word-actions";

  const star = document.createElement("button");
  const starred = isStarred(word.toLowerCase());
  star.className = "btn-star" + (starred ? " active" : "");
  star.innerHTML = starred ? STAR_SVG : STAR_OUTLINE;
  star.setAttribute("aria-label", "收藏");
  star.addEventListener("click", e => {
    e.stopPropagation();
    const added = toggleStar(word.toLowerCase(), meaning || "");
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
}

/* ====== Home — Analyze ====== */
function analyzeSentence() {
  const raw = document.getElementById("sentence-input").value.trim();
  if (!raw) return;
  curSentence = raw;
  const bar = document.getElementById("sentence-bar");
  bar.classList.add("visible");
  document.getElementById("sentence-text").textContent = raw;

  const words = raw.match(/[a-zA-Z']+/g) || [];
  const list = document.getElementById("word-list");
  list.innerHTML = "";

  if (!words.length) {
    list.innerHTML = `
      <div class="empty">
        <div class="empty-mascot"><img src="assets/logo-placeholder.jpeg" alt=""></div>
        <p>没有发现英文单词哦<br><strong>试试粘贴一句完整的英语吧～</strong></p>
      </div>`;
    return;
  }

  // dedupe but keep order
  const seen = new Set();
  const uniqWords = [];
  for (const w of words) {
    const key = w.toLowerCase();
    if (!seen.has(key)) { seen.add(key); uniqWords.push(w); }
  }

  for (let i = 0; i < uniqWords.length; i++) {
    buildWordCard(uniqWords[i], i, lookup(uniqWords[i]), list);
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
    ph.textContent = approxPhonetic(entry.w);
    const cn = document.createElement("div");
    cn.className = "word-cn";
    if (entry.m) {
      cn.textContent = entry.m;
    } else {
      const link = document.createElement("a");
      link.className = "lookup-link";
      link.textContent = "点击查询英文释义";
      link.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); lookupOnline(entry.w, cn, ph); });
      cn.appendChild(link);
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
    card.addEventListener("click", () => speakWordN(entry.w, card));
    list.appendChild(card);
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
  // load dictionary
  try {
    const res = await fetch("assets/dict.json");
    DICT = await res.json();
  } catch (e) {
    console.error("Dict load failed", e);
    DICT = {};
  }

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
