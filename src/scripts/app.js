/* ===== Lucia's Dictionary · App wiring ===== */

import {
  ONLINE_DICT_CACHE,
  TIP_DISMISSED_KEY,
  loadJsonAsset,
  readCache,
  writeCache,
} from "./storage.js";
import { STOP_WORDS, createDictionaryService } from "./dictionary.js";
import {
  CHINESE_RE,
  OFFLINE_ONLY_ERROR,
  createTranslationService,
} from "./translation.js";
import {
  getSentenceSpeechLabel,
  renderSpeakableText,
  resetSentenceSpeech,
  setupVoices,
  speak,
  speakWordN,
  toggleSentenceSpeech,
} from "./speech.js";
import {
  getWordbook,
  isStarred,
  saveWordbook,
  toggleStar,
  updateStarredMeaning,
} from "./wordbook.js";
import { getOcrErrorMessage, recognizeImageText } from "./ocr.js";
import { registerServiceWorker } from "./offline.js";
import { extendedLexiconPath } from "../config/site.js";
import { buildWordCard, createEmptyState, setCardMeaning } from "./ui.js";
import { getAppState, subscribeAppState } from "./app-state.js";
import { createMissionController } from "./controllers/mission-controller.js";
import { createNavigationController } from "./controllers/navigation-controller.js";
import { createSettingsController } from "./controllers/settings-controller.js";
import { createWordbookController } from "./controllers/wordbook-controller.js";

const NETWORK_CONCURRENCY = 3;

let dictData = {};
let coreLexicon = {};
let phonetics = {};
let phraseLexicon = {};
let phrasebook = [];
let curSentence = "";
let curSentenceDisplay = "";
let sentenceSource = "";
let analyzeRunId = 0;
let dictService = null;
let translationService = null;
let dictionaryReady = null;
let extendedLexiconReady = null;
let phrasebookReady = null;
let activeNetworkRequests = 0;
const networkQueue = [];
let copyFeedbackTimer = null;
let missionCandidates = new Map();
let missionRefreshTimer = null;
let missionController = null;
let navigationController = null;
let settingsController = null;
let wordbookController = null;

const COPY_ICON =
  '<rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2 2h9a2 2 0 0 1 2 2v1"></path>';
const COPIED_ICON = '<path d="m5 12 4 4L19 6"></path>';

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
  const cameraInput = document.getElementById("camera-input");
  const cameraBtn = document.getElementById("camera-btn");
  if (btn) btn.disabled = isBusy;
  if (input) input.disabled = isBusy;
  if (imageInput) imageInput.disabled = isBusy;
  if (cameraInput) cameraInput.disabled = isBusy;
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

// The child must be able to see where the English came from: a stored classroom
// phrase, a real translation, or a best-effort pile of words.
const SENTENCE_SOURCE_NOTES = {
  template: {
    text: "这句英文来自应用内置的课堂短句库。",
    tone: "info",
  },
  online: {
    text: "这句英文由翻译服务生成，可能和老师的原话略有不同。",
    tone: "info",
  },
  "local-words": {
    text: "没能翻译整句。下面只是句子里可能相关的单词，不是完整的英文句子。",
    tone: "warning",
  },
};

function setSentenceSource(source) {
  const el = document.getElementById("sentence-source");
  if (!el) return;
  const note = SENTENCE_SOURCE_NOTES[source];
  el.hidden = !note;
  el.className = "sentence-source" + (note ? ` is-${note.tone}` : "");
  el.textContent = note?.text || "";
}

async function copyText(text) {
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard API is unavailable");
  }
  await navigator.clipboard.writeText(text);
}

function showCopyFeedback(copied) {
  const button = document.getElementById("copy-sentence-btn");
  const label = document.getElementById("copy-sentence-label");
  const icon = document.getElementById("copy-sentence-icon");
  if (!button || !label || !icon) return;

  clearTimeout(copyFeedbackTimer);
  button.classList.toggle("is-copied", copied);
  label.textContent = copied ? "已复制" : "复制文本";
  icon.innerHTML = copied ? COPIED_ICON : COPY_ICON;
  if (copied) {
    copyFeedbackTimer = setTimeout(() => showCopyFeedback(false), 2000);
  }
}

function announce(message) {
  const status = document.getElementById("app-status");
  if (status) status.textContent = message;
}

function createCurrentTranslationService() {
  translationService = createTranslationService({
    dictService,
    phrasebook,
    enqueueNetwork,
  });
}

async function loadDictionaryServices() {
  [dictData, coreLexicon, phonetics, phraseLexicon] = await Promise.all([
    loadJsonAsset("assets/dict.json", {}),
    loadJsonAsset("assets/lexicon/core-lexicon.json", {}),
    loadJsonAsset("assets/phonetics.json", {}),
    loadJsonAsset("assets/lexicon/phrase-lexicon.json", {}),
  ]);
  if (!Object.keys(coreLexicon).length)
    throw new Error("Local dictionary failed to load");

  dictService = createDictionaryService({
    dict: dictData,
    coreLexicon,
    phraseLexicon,
    phonetics,
    translateText: (...args) => translationService.translateText(...args),
    enqueueNetwork,
    getCachedOnlineWord,
    setCachedOnlineWord,
  });
  createCurrentTranslationService();
  settingsController?.render(getAppState());
  announce("词典已准备好");
  scheduleExtendedLexicon();
  return dictService;
}

// The long-tail shard is fetched after the app is usable. Analysis waits for it
// only when a sentence actually contains a word the head could not resolve.
function ensureExtendedLexiconReady() {
  if (!dictService) return Promise.resolve(false);
  if (!extendedLexiconReady) {
    extendedLexiconReady = loadJsonAsset(extendedLexiconPath.slice(1), {})
      .then((entries) => {
        const added = dictService.extendCoreLexicon(entries);
        if (added) settingsController?.render(getAppState());
        return added > 0;
      })
      .catch(() => false);
  }
  return extendedLexiconReady;
}

function scheduleExtendedLexicon() {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => ensureExtendedLexiconReady(), {
      timeout: 5000,
    });
  } else {
    window.setTimeout(() => ensureExtendedLexiconReady(), 1200);
  }
}

function startDictionaryServices() {
  if (!dictionaryReady) {
    dictionaryReady = loadDictionaryServices();
    dictionaryReady.catch(() => announce("词典加载失败，请刷新页面重试"));
  }
  return dictionaryReady;
}

function scheduleDictionaryStartup() {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => startDictionaryServices(), {
      timeout: 2000,
    });
  } else {
    window.setTimeout(() => startDictionaryServices(), 0);
  }
}

async function ensurePhrasebookReady() {
  if (phrasebook.length) return phrasebook;
  if (!phrasebookReady) {
    phrasebookReady = loadJsonAsset("assets/phrasebook.json", []).then(
      (items) => {
        phrasebook = Array.isArray(items) ? items : [];
        createCurrentTranslationService();
        return phrasebook;
      },
    );
  }
  return phrasebookReady;
}

function isCurrentAnalyzeRun(runId) {
  return runId == null || runId === analyzeRunId;
}

// A "local-words" result is a bag of related words, not a sentence, so it must
// not be read aloud as one or used as cloze material.
function isReadableSentence() {
  return sentenceSource !== "local-words";
}

function renderMissionPreview() {
  missionController.renderPreview(Array.from(missionCandidates.values()));
}

function recordResolvedMeaning(runId, word, meaning) {
  if (!meaning || runId !== analyzeRunId || !isReadableSentence()) return;
  const key = String(word).toLowerCase();
  const candidate = missionCandidates.get(key);
  if (!candidate || candidate.meaning) return;
  missionCandidates.set(key, { ...candidate, meaning });
  clearTimeout(missionRefreshTimer);
  // Meanings land one network response at a time; rebuild once they settle,
  // and never while the child is part-way through the exercise.
  missionRefreshTimer = setTimeout(() => {
    if (runId === analyzeRunId && !missionController.isStarted()) {
      renderMissionPreview();
    }
  }, 400);
}

function createOcrUncertainPanel(words, lookupWord) {
  const panel = document.createElement("section");
  panel.className = "ocr-uncertain";
  panel.setAttribute("aria-label", "还没查到的词");

  const copy = document.createElement("div");
  copy.className = "ocr-uncertain-copy";
  const title = document.createElement("strong");
  title.textContent = `还有 ${words.length} 个词没查到`;
  const hint = document.createElement("span");
  // These are simply words the local dictionary does not carry — they may be
  // names or rarer words, not necessarily OCR mistakes.
  hint.textContent =
    "本地词典里没有这些词，也可能是拍照识别看错了。点一下可以联网查一查。";
  copy.append(title, hint);

  const chips = document.createElement("div");
  chips.className = "ocr-uncertain-chips";
  for (const word of words) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ocr-uncertain-chip";
    button.textContent = word;
    button.addEventListener("click", async () => {
      button.disabled = true;
      button.classList.remove("is-missing");
      button.textContent = `${word} · 查询中`;
      const found = await lookupWord(word);
      if (found) {
        button.remove();
        const remaining = chips.querySelectorAll("button").length;
        title.textContent = remaining
          ? `还有 ${remaining} 个词没查到`
          : "这些词都查过了";
        if (!remaining) hint.textContent = "查到的词已经加到上面的单词卡里。";
      } else {
        button.disabled = false;
        button.classList.add("is-missing");
        button.textContent = `${word} · 未查到`;
      }
    });
    chips.appendChild(button);
  }

  panel.append(copy, chips);
  return panel;
}

async function analyzeSentence({ source = "manual" } = {}) {
  const input = document.getElementById("sentence-input");
  const raw = input?.value.trim() || "";
  if (!raw || document.getElementById("go-btn")?.disabled) return;

  const runId = ++analyzeRunId;
  const bar = document.getElementById("sentence-bar");
  const list = document.getElementById("word-list");
  const missionContainer = document.getElementById("classroom-mission");
  if (!list) return;

  let sentence = raw;
  setAnalyzeBusy(true);
  bar?.classList.add("visible");
  resetSentenceSpeech();
  sentenceSource = "";
  missionCandidates = new Map();
  clearTimeout(missionRefreshTimer);
  setSentenceText(raw);
  setSentenceSource("");
  setSentenceSpeakLabel(getSentenceSpeechLabel("idle"));
  list.setAttribute("aria-busy", "true");
  missionContainer?.replaceChildren();
  if (missionContainer) missionContainer.hidden = true;

  try {
    if (!dictService) {
      list.replaceChildren(
        createEmptyState("正在准备词典", "首次打开只需要一点时间"),
      );
      await startDictionaryServices();
      if (runId !== analyzeRunId) return;
    }

    if (CHINESE_RE.test(raw)) {
      list.replaceChildren(
        createEmptyState("正在翻译中文句子", "先从常见课堂表达中查找"),
      );
      try {
        await ensurePhrasebookReady();
        const resolved = await translationService.resolveChineseInput(raw);
        if (runId !== analyzeRunId) return;
        sentence = resolved.sentence;
        sentenceSource = resolved.source;
        setSentenceText(sentence);
        setSentenceSource(resolved.source);
        setSentenceSpeakLabel(
          isReadableSentence() ? "朗读英文句子" : "朗读这些单词",
        );
      } catch (e) {
        if (runId !== analyzeRunId) return;
        list.replaceChildren(
          createEmptyState(
            e?.code === OFFLINE_ONLY_ERROR
              ? "仅离线模式下无法翻译中文"
              : "中文翻译暂时不可用",
            e?.code === OFFLINE_ONLY_ERROR
              ? "可以在设置里关闭仅离线模式，或直接输入英文句子"
              : "请检查网络，或先输入英文句子",
          ),
        );
        return;
      }
    }

    if (runId !== analyzeRunId) return;
    curSentence = sentence;
    let words = dictService.extractLookupTerms(sentence);

    const needsExtendedLexicon = words.some(
      (word) =>
        !STOP_WORDS.has(word.toLowerCase()) && !dictService.lookup(word),
    );
    if (needsExtendedLexicon) {
      await ensureExtendedLexiconReady();
      if (runId !== analyzeRunId) return;
      // New entries can also merge two words into one phrase card.
      words = dictService.extractLookupTerms(sentence);
    }
    list.replaceChildren();

    if (!words.length) {
      list.replaceChildren(
        createEmptyState("没有发现英文单词哦", "试试粘贴一句完整的英语吧～"),
      );
      announce("没有发现英文单词");
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

    const makeCardOptions = (word) => ({
      stopWords: STOP_WORDS,
      lookupLocalPhonetic: dictService.lookupLocalPhonetic,
      lookupLearningBand: dictService.lookupLearningBand,
      isStarred,
      toggleStar,
      speakWordN,
      getCachedOnlineWord,
      lookupOnlineData: dictService.lookupOnlineData,
      sourceSentence: () => curSentence,
      setMeaning: (card, meaning) => {
        setCardMeaning(card, word.toLowerCase(), meaning, updateStarredMeaning);
        // A meaning that only arrives from the network still deserves a place
        // in the mission — those are often exactly the words worth practising.
        recordResolvedMeaning(runId, word, meaning);
      },
      isCurrentRun: isCurrentAnalyzeRun,
      runId,
    });

    const uncertainWords =
      source === "ocr"
        ? uniqWords.filter(
            (word) =>
              !dictService.lookup(word) && !STOP_WORDS.has(word.toLowerCase()),
          )
        : [];
    const uncertainKeys = new Set(
      uncertainWords.map((word) => word.toLowerCase()),
    );
    const visibleWords = uniqWords.filter(
      (word) => !uncertainKeys.has(word.toLowerCase()),
    );

    visibleWords.forEach((word, index) => {
      buildWordCard(
        word,
        index,
        dictService.lookup(word),
        list,
        makeCardOptions(word),
      );
    });

    if (uncertainWords.length) {
      list.appendChild(
        createOcrUncertainPanel(uncertainWords, async (word) => {
          try {
            const data = await dictService.lookupOnlineData(word);
            if (!data || runId !== analyzeRunId) return false;
            buildWordCard(
              word,
              list.querySelectorAll(".word-card").length,
              data.meaning,
              list,
              makeCardOptions(word),
            );
            return true;
          } catch {
            return false;
          }
        }),
      );
    }
    missionCandidates = new Map(
      visibleWords
        .filter((word) => !STOP_WORDS.has(word.toLowerCase()))
        .map((word) => [
          word.toLowerCase(),
          {
            word,
            meaning: dictService.lookup(word) || "",
            band: dictService.lookupLearningBand(word),
          },
        ]),
    );
    // A pile of unrelated words is not a sentence to practise inside.
    if (isReadableSentence()) renderMissionPreview();
    const uncertainNote = uncertainWords.length
      ? `，另有 ${uncertainWords.length} 个词还没查到`
      : "";
    announce(`已生成 ${visibleWords.length} 张单词卡${uncertainNote}`);
  } catch {
    list.replaceChildren(
      createEmptyState("词典暂时无法加载", "请刷新页面后再试"),
    );
    announce("词典加载失败");
  } finally {
    list.setAttribute("aria-busy", "false");
    if (runId === analyzeRunId) setAnalyzeBusy(false);
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
  const cameraInput = document.getElementById("camera-input");
  const sentenceInput = document.getElementById("sentence-input");
  const cameraButton = document.getElementById("camera-btn");
  const sourceDialog = document.getElementById("image-source-dialog");
  if (!imageInput || !sentenceInput) return;

  async function processOcrFile(file) {
    if (!file) return;
    let releasedBeforeAnalyze = false;
    setAnalyzeBusy(true);
    try {
      const result = await recognizeImageText(file, {
        onProgress: (stage) => {
          if (stage === "compressing") {
            setOcrStatus("正在处理图片…");
          } else if (stage === "uploading") {
            setOcrStatus("正在识别英文…");
          }
        },
      });

      if (!result.text) {
        setOcrStatus("没有识别到英文，请换一张更清晰的图片。", "warning");
        return;
      }

      sentenceInput.value = result.text;
      setOcrStatus("正在生成单词卡…");
      releasedBeforeAnalyze = true;
      setAnalyzeBusy(false);
      await analyzeSentence({ source: "ocr" });
      setOcrStatus("");
    } catch (error) {
      setOcrStatus(getOcrErrorMessage(error), "error");
    } finally {
      if (!releasedBeforeAnalyze) setAnalyzeBusy(false);
    }
  }

  for (const input of [cameraInput, imageInput].filter(Boolean)) {
    input.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (sourceDialog?.open) sourceDialog.close();
      await processOcrFile(file);
    });
  }

  cameraButton?.addEventListener("click", () => {
    if (cameraButton.getAttribute("aria-disabled") === "true") return;
    if (sourceDialog?.showModal) sourceDialog.showModal();
    else imageInput.click();
  });

  sourceDialog?.addEventListener("click", (event) => {
    if (event.target === sourceDialog) sourceDialog.close();
  });
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

function init() {
  saveWordbook(getWordbook());
  settingsController = createSettingsController({
    getDictionaryCount: () => dictService?.countLoadedWords() || 0,
  });
  wordbookController = createWordbookController({
    announce,
    getCachedOnlineWord,
    getDictionaryService: () => dictService,
    speak,
    speakWordN,
  });
  missionController = createMissionController({
    announce,
    getSentence: () => curSentence,
    speak,
  });
  navigationController = createNavigationController({
    analyzeSentence,
    getDictionaryReady: startDictionaryServices,
    getDictionaryService: () => dictService,
    loadPhrasebook: ensurePhrasebookReady,
    renderSettings: () => settingsController.render(getAppState()),
    renderWordbook: () => wordbookController.render(),
    speak,
  });

  settingsController.setup();
  wordbookController.setup();
  navigationController.setup();
  subscribeAppState((state, change) => {
    wordbookController.onStateChange(state, change);
    if (["all", "settings", "wordbook"].includes(change.scope)) {
      settingsController.render(state);
    }
  });

  document.getElementById("go-btn")?.addEventListener("click", analyzeSentence);
  document
    .getElementById("speak-sentence-btn")
    ?.addEventListener("click", () => {
      if (!curSentence) return;
      toggleSentenceSpeech(curSentence, {
        textEl: document.getElementById("sentence-text"),
        displayText: curSentenceDisplay || curSentence,
        onStateChange: (state) =>
          setSentenceSpeakLabel(getSentenceSpeechLabel(state)),
        onUnavailable: () => setOcrStatus("当前浏览器不支持朗读。", "warning"),
      });
    });
  document
    .getElementById("copy-sentence-btn")
    ?.addEventListener("click", async () => {
      const text = curSentenceDisplay || curSentence;
      if (!text) return;
      try {
        await copyText(text);
        showCopyFeedback(true);
        announce("原句已复制到剪贴板。");
      } catch {
        announce("复制失败，请手动选择原句复制。");
      }
    });
  document
    .getElementById("sentence-input")
    ?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        analyzeSentence();
      }
    });
  setupImageOcr();
  scheduleDictionaryStartup();
  registerServiceWorker();
  setupVoices();
  setupLearningTip();
}

document.addEventListener("DOMContentLoaded", init);
