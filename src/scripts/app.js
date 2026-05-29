/* ===== Lucia's Dictionary · App wiring ===== */

import {
  ONLINE_DICT_CACHE,
  TIP_DISMISSED_KEY,
  clearLookupCaches,
  getSetting,
  loadJsonAsset,
  readCache,
  setSetting,
  writeCache
} from "./storage.js";
import { STOP_WORDS, createDictionaryService } from "./dictionary.js";
import { CHINESE_RE, createTranslationService } from "./translation.js";
import { getSentenceSpeechLabel, renderSpeakableText, resetSentenceSpeech, setupVoices, speak, speakWordN, toggleSentenceSpeech } from "./speech.js";
import {
  clearWordbookItems,
  exportWordbookJson,
  getWordbook,
  importWordbookFile,
  isStarred,
  removeWord,
  saveWordbook,
  toggleStar,
  updateStarredMeaning
} from "./wordbook.js";
import { renderQuiz } from "./quiz.js";
import { TEMPLATES, renderTemplates } from "./templates.js";
import { getOcrErrorMessage, recognizeImageText } from "./ocr.js";
import { updateDailyStreak } from "./streak.js";
import { registerServiceWorker } from "./offline.js";
import { createCameraCaptureController } from "./cameraCapture.js";
import {
  SPEAKER_SVG,
  STAR_SVG,
  buildWordCard,
  createEmptyState,
  hydrateOnlineWord,
  setCardMeaning,
  setMutedText
} from "./ui.js";

const NETWORK_CONCURRENCY = 3;

let dictData = {};
let coreLexicon = {};
let phraseLexicon = {};
let phonetics = {};
let phrasebook = [];
let curSentence = "";
let curSentenceDisplay = "";
let analyzeRunId = 0;
let dictService = null;
let translationService = null;
let activeNetworkRequests = 0;
const networkQueue = [];

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

function getCachedOnlineWord(word) {
  return readCache(ONLINE_DICT_CACHE)[word.toLowerCase()] || null;
}

function setCachedOnlineWord(word, value) {
  const cache = readCache(ONLINE_DICT_CACHE);
  cache[word.toLowerCase()] = { ...value, cachedAt: Date.now() };
  writeCache(ONLINE_DICT_CACHE, cache);
}

function setAnalyzeBusy(isBusy) {
  const btn = document.getElementById("go-btn");
  const input = document.getElementById("sentence-input");
  const imageInput = document.getElementById("image-input");
  const cameraBtn = document.getElementById("camera-btn");
  if (btn) btn.disabled = isBusy;
  if (input) input.disabled = isBusy;
  if (imageInput) imageInput.disabled = isBusy;
  if (cameraBtn) {
    cameraBtn.classList.toggle("is-disabled", isBusy);
    cameraBtn.setAttribute("aria-disabled", String(isBusy));
  }
}

function setSentenceSpeakLabel(label) {
  const labelEl = document.getElementById("speak-sentence-label");
  if (labelEl) labelEl.textContent = label;
}

function setSentenceText(text) {
  const sentenceText = document.getElementById("sentence-text");
  curSentenceDisplay = text;
  if (sentenceText) renderSpeakableText(sentenceText, text);
}

function isCurrentAnalyzeRun(runId) {
  return runId == null || runId === analyzeRunId;
}

function sourceLabel(source) {
  if (source === "template") return "本地课堂短句";
  if (source === "local-words") return "本地词库";
  return "在线翻译";
}

async function analyzeSentence() {
  const input = document.getElementById("sentence-input");
  const raw = input?.value.trim() || "";
  if (!raw || document.getElementById("go-btn")?.disabled) return;

  const runId = ++analyzeRunId;
  const bar = document.getElementById("sentence-bar");
  const explanationEl = document.getElementById("sentence-explanation");
  const list = document.getElementById("word-list");

  let sentence = raw;
  setAnalyzeBusy(true);
  bar?.classList.add("visible");
  resetSentenceSpeech();
  setSentenceText(raw);
  setSentenceSpeakLabel(getSentenceSpeechLabel("idle"));
  explanationEl?.replaceChildren();
  if (explanationEl) explanationEl.hidden = true;

  try {
    if (CHINESE_RE.test(raw)) {
      list.replaceChildren(createEmptyState("正在识别中文句子", "优先使用本地短句和词库"));
      try {
        const resolved = await translationService.resolveChineseInput(raw);
        if (runId !== analyzeRunId) return;
        sentence = resolved.sentence;
        setSentenceText(`${raw} → ${sentence}（${sourceLabel(resolved.source)}）`);
        setSentenceSpeakLabel("朗读英文句子");
      } catch (e) {
        if (runId !== analyzeRunId) return;
        list.replaceChildren(createEmptyState("中文识别暂时不可用", "请检查网络，或先输入英文句子"));
        return;
      }
    }

    if (runId !== analyzeRunId) return;
    curSentence = sentence;
    explanationEl?.replaceChildren();
    if (explanationEl) explanationEl.hidden = true;
    const words = dictService.extractLookupTerms(sentence);
    list.replaceChildren();

    if (!words.length) {
      list.replaceChildren(createEmptyState("没有发现英文单词哦", "试试粘贴一句完整的英语吧～"));
      return;
    }

    const seen = new Set();
    const uniqWords = [];
    for (const word of words) {
      const key = word.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqWords.push(word);
      }
    }

    uniqWords.forEach((word, index) => {
      buildWordCard(word, index, dictService.lookup(word), list, {
        stopWords: STOP_WORDS,
        lookupLocalPhonetic: dictService.lookupLocalPhonetic,
        isStarred,
        toggleStar,
        speakWordN,
        getCachedOnlineWord,
        lookupOnlineData: dictService.lookupOnlineData,
        sourceSentence: () => curSentence,
        setMeaning: (card, meaning) => setCardMeaning(card, word.toLowerCase(), meaning, updateStarredMeaning),
        isCurrentRun: isCurrentAnalyzeRun,
        runId
      });
    });
  } finally {
    if (runId === analyzeRunId) setAnalyzeBusy(false);
  }
}

function renderWordbook() {
  const wb = getWordbook();
  const stats = document.getElementById("wb-stats");
  const actions = document.getElementById("wb-actions");
  const list = document.getElementById("wb-list");
  if (!stats || !actions || !list) return;

  if (!wb.length) {
    stats.style.display = "none";
    actions.style.display = "flex";
    setWordbookActionState(false);
    list.replaceChildren(createEmptyState("生词本还是空的", "在首页点 ☆ 把单词收藏到这里吧"));
    return;
  }

  stats.style.display = "flex";
  stats.replaceChildren();
  const statWrap = document.createElement("div");
  const num = document.createElement("div");
  num.className = "num";
  num.textContent = wb.length;
  const label = document.createElement("div");
  label.className = "label";
  label.textContent = "个收藏的单词";
  const small = document.createElement("small");
  small.textContent = "点单词卡片可以听发音";
  label.appendChild(small);
  statWrap.append(num, label);
  stats.appendChild(statWrap);

  actions.style.display = "flex";
  setWordbookActionState(true);
  list.replaceChildren();

  wb.forEach((entry, index) => {
    const card = document.createElement("div");
    card.className = "word-card";
    card.style.animationDelay = (index * 0.04) + "s";

    const count = document.createElement("div");
    count.className = "word-num";
    count.textContent = index + 1;

    const body = document.createElement("div");
    body.className = "word-body";
    const en = document.createElement("div");
    en.className = "word-en";
    en.textContent = entry.w;
    const ph = document.createElement("div");
    ph.className = "word-phonetic";
    ph.textContent = dictService.lookupLocalPhonetic(entry.w) || "暂无音标";
    const cn = document.createElement("div");
    cn.className = "word-cn";
    if (entry.m) cn.textContent = entry.m;
    else setMutedText(cn, "正在查询中文释义…");

    const meta = document.createElement("div");
    meta.className = "word-meta";
    meta.textContent = `正确 ${entry.correct || 0} · 错误 ${entry.wrong || 0} · Level ${entry.level || 0}`;
    body.append(en, ph, cn, meta);

    if (entry.sourceSentence) {
      const source = document.createElement("div");
      source.className = "word-source";
      source.textContent = entry.sourceSentence;
      body.appendChild(source);
    }

    const acts = document.createElement("div");
    acts.className = "word-actions";
    const star = document.createElement("button");
    star.className = "btn-star active";
    star.innerHTML = STAR_SVG;
    star.setAttribute("aria-label", "移出生词本");
    star.addEventListener("click", event => {
      event.stopPropagation();
      removeWord(entry.w);
      renderWordbook();
    });

    const speakBtn = document.createElement("button");
    speakBtn.className = "btn-speak";
    speakBtn.innerHTML = SPEAKER_SVG;
    speakBtn.setAttribute("aria-label", "朗读");
    speakBtn.addEventListener("click", event => {
      event.stopPropagation();
      speakWordN(entry.w, card);
    });

    acts.append(star, speakBtn);
    card.append(count, body, acts);
    setCardMeaning(card, entry.w, entry.m || "", updateStarredMeaning);
    card.addEventListener("click", () => speakWordN(entry.w, card));
    list.appendChild(card);
    hydrateOnlineWord(entry.w, cn, ph, card, {
      getCachedOnlineWord,
      lookupOnlineData: dictService.lookupOnlineData,
      setMeaning: (target, meaning) => setCardMeaning(target, entry.w, meaning, updateStarredMeaning),
      isCurrentRun: () => true,
      fillMeaning: !entry.m,
      allowNetwork: false
    });
  });
}

function setWordbookActionState(hasItems) {
  const review = document.getElementById("review-all-btn");
  const exportBtn = document.getElementById("export-wb-btn");
  const clear = document.getElementById("clear-wb-btn");
  if (review) review.disabled = !hasItems;
  if (exportBtn) exportBtn.disabled = !hasItems;
  if (clear) clear.disabled = !hasItems;
}

function reviewAll() {
  const wb = getWordbook();
  if (!wb.length) return;
  let index = 0;
  const next = () => {
    if (index >= wb.length) return;
    const cards = document.querySelectorAll("#wb-list .word-card");
    if (cards[index]) cards[index].classList.add("speaking");
    const currentIndex = index;
    speak(wb[index].w, () => {
      if (cards[currentIndex]) cards[currentIndex].classList.remove("speaking");
      index++;
      setTimeout(next, 320);
    });
  };
  next();
}

function clearWordbook() {
  if (confirm("确定要清空所有收藏的单词吗？")) {
    clearWordbookItems();
    renderWordbook();
  }
}

function exportWordbook() {
  const blob = new Blob([exportWordbookJson()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "lucia-wordbook.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function importWordbook(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  try {
    const result = await importWordbookFile(file);
    if (!result.ok) {
      alert(result.error || "导入失败");
      return;
    }
    renderWordbook();
  } catch (e) {
    alert("导入失败：请选择有效的 JSON 文件");
  }
}

function setOcrStatus(message, type = "") {
  const status = document.getElementById("ocr-status");
  if (!status) return;
  status.hidden = !message;
  status.className = "ocr-status" + (type ? ` ${type}` : "");
  status.textContent = message || "";
}

function setupImageOcr() {
  const imageInput = document.getElementById("image-input");
  const sentenceInput = document.getElementById("sentence-input");
  const cameraButton = document.getElementById("camera-btn");
  if (!imageInput || !sentenceInput) return;

  async function processOcrFile(file) {
    if (!file) return;
    let releasedBeforeAnalyze = false;
    setAnalyzeBusy(true);
    try {
      if (!file.type.startsWith("image/")) {
        throw new Error("请选择图片文件");
      }

      const result = await recognizeImageText(file, {
        onProgress: stage => {
          if (stage === "compressing") {
            setOcrStatus("正在处理图片…");
          } else if (stage === "uploading") {
            setOcrStatus("正在识别英文…");
          }
        }
      });

      if (!result.text) {
        setOcrStatus("没有识别到英文，请换一张更清晰的图片。", "warning");
        return;
      }

      sentenceInput.value = result.text;
      setOcrStatus("正在生成单词卡…");
      releasedBeforeAnalyze = true;
      setAnalyzeBusy(false);
      await analyzeSentence();
      setOcrStatus("");
    } catch (error) {
      setOcrStatus(getOcrErrorMessage(error), "error");
    } finally {
      if (!releasedBeforeAnalyze) setAnalyzeBusy(false);
    }
  }

  imageInput.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    event.target.value = "";
    await processOcrFile(file);
  });

  createCameraCaptureController({
    cameraButton,
    imageInput,
    setStatus: setOcrStatus,
    onFile: processOcrFile
  });
}

function setupDailyStreak() {
  const label = document.getElementById("streak-label");
  if (!label) return;
  try {
    const streak = updateDailyStreak();
    label.textContent = `Day ${streak.count}`;
  } catch (e) {
    label.textContent = "Day 1";
  }
}

function renderSettings() {
  const speeds = [["慢速", "slow"], ["正常", "normal"]];
  const repeats = [1, 3, 5];
  const curSpeed = getSetting("speed");
  const curRepeat = getSetting("repeat");
  const speedOptions = document.getElementById("speed-options");
  const repeatOptions = document.getElementById("repeat-options");
  if (!speedOptions || !repeatOptions) return;

  speedOptions.replaceChildren(...speeds.map(([label, value]) => {
    const btn = document.createElement("button");
    btn.className = "set-btn" + (curSpeed === value ? " active" : "");
    btn.dataset.speed = value;
    btn.textContent = label;
    btn.addEventListener("click", () => {
      setSetting("speed", value);
      renderSettings();
    });
    return btn;
  }));

  repeatOptions.replaceChildren(...repeats.map(value => {
    const btn = document.createElement("button");
    btn.className = "set-btn" + (curRepeat === value ? " active" : "");
    btn.dataset.repeat = value;
    btn.textContent = `${value} 遍`;
    btn.addEventListener("click", () => {
      setSetting("repeat", value);
      renderSettings();
    });
    return btn;
  }));

  const clearCacheBtn = document.getElementById("clear-cache-btn");
  if (clearCacheBtn && !clearCacheBtn.dataset.bound) {
    clearCacheBtn.dataset.bound = "1";
    clearCacheBtn.addEventListener("click", () => {
      clearLookupCaches();
      clearCacheBtn.textContent = "已清除";
      setTimeout(() => {
        clearCacheBtn.textContent = "清除查询缓存";
      }, 1200);
    });
  }

  const dictCount = document.getElementById("dict-count");
  if (dictCount) dictCount.textContent = (Object.keys(dictData).length + Object.keys(coreLexicon).length).toLocaleString();
  const wbCount = document.getElementById("about-wb-count");
  if (wbCount) wbCount.textContent = getWordbook().length.toLocaleString();
}

function setupLearningTip() {
  const tip = document.getElementById("learning-tip");
  const closeBtn = document.getElementById("tip-close-btn");
  if (!tip || !closeBtn) return;
  if (localStorage.getItem(TIP_DISMISSED_KEY) === "1") {
    tip.hidden = true;
    return;
  }
  closeBtn.addEventListener("click", () => {
    tip.hidden = true;
    try {
      localStorage.setItem(TIP_DISMISSED_KEY, "1");
    } catch (e) {}
  });
}

function learnTemplateSentence(sentence) {
  const input = document.getElementById("sentence-input");
  if (input) input.value = sentence;
  navTo("home");
  analyzeSentence();
  requestAnimationFrame(() => {
    const list = document.getElementById("word-list");
    if (list) {
      const y = list.getBoundingClientRect().top + window.scrollY - 12;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  });
}

function navTo(page, opts) {
  document.querySelectorAll(".page").forEach(item => item.classList.remove("active"));
  document.getElementById("pg-" + page)?.classList.add("active");
  document.querySelectorAll(".nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.pg === page));
  if (!opts || !opts.keepScroll) window.scrollTo(0, 0);
  if (page === "wordbook") renderWordbook();
  if (page === "quiz") renderQuiz({ getWordbook, speak });
  if (page === "templates") renderTemplates({ speak, learnSentence: learnTemplateSentence });
  if (page === "settings") renderSettings();
}

async function init() {
  [dictData, coreLexicon, phraseLexicon, phonetics, phrasebook] = await Promise.all([
    loadJsonAsset("assets/dict.json", {}),
    loadJsonAsset("assets/lexicon/core-lexicon.json", {}),
    loadJsonAsset("assets/phrase-lexicon.json", {}),
    loadJsonAsset("assets/phonetics.json", {}),
    loadJsonAsset("assets/phrasebook.json", [])
  ]);

  dictService = createDictionaryService({
    dict: dictData,
    coreLexicon,
    phraseLexicon,
    phonetics,
    translateText: (...args) => translationService.translateText(...args),
    enqueueNetwork,
    getCachedOnlineWord,
    setCachedOnlineWord
  });
  translationService = createTranslationService({
    dictService,
    phrasebook,
    templateGroups: TEMPLATES,
    enqueueNetwork
  });

  saveWordbook(getWordbook());

  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => navTo(btn.dataset.pg));
  });
  document.getElementById("brand-home-btn")?.addEventListener("click", () => navTo("home"));
  document.getElementById("go-btn")?.addEventListener("click", analyzeSentence);
  document.getElementById("speak-sentence-btn")?.addEventListener("click", () => {
    if (!curSentence) return;
    toggleSentenceSpeech(curSentence, {
      textEl: document.getElementById("sentence-text"),
      displayText: curSentenceDisplay || curSentence,
      onStateChange: state => setSentenceSpeakLabel(getSentenceSpeechLabel(state)),
      onUnavailable: () => setOcrStatus("当前浏览器不支持朗读。", "warning")
    });
  });
  document.getElementById("sentence-input")?.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      analyzeSentence();
    }
  });
  document.getElementById("review-all-btn")?.addEventListener("click", reviewAll);
  document.getElementById("clear-wb-btn")?.addEventListener("click", clearWordbook);
  document.getElementById("export-wb-btn")?.addEventListener("click", exportWordbook);
  document.getElementById("import-wb-input")?.addEventListener("change", importWordbook);
  document.getElementById("import-wb-btn")?.addEventListener("click", () => {
    document.getElementById("import-wb-input")?.click();
  });

  setupImageOcr();
  setupDailyStreak();
  registerServiceWorker();
  setupVoices();
  renderSettings();
  setupLearningTip();
}

document.addEventListener("DOMContentLoaded", init);
