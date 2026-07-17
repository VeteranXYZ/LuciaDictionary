/* ===== Lucia's Dictionary · App wiring ===== */

import {
  ONLINE_DICT_CACHE,
  TIP_DISMISSED_KEY,
  loadJsonAsset,
  readCache,
  writeCache,
} from "./storage.js";
import { STOP_WORDS, createDictionaryService } from "./dictionary.js";
import { CHINESE_RE, createTranslationService } from "./translation.js";
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
import { TEMPLATES } from "./templates.js";
import { getOcrErrorMessage, recognizeImageText } from "./ocr.js";
import { registerServiceWorker } from "./offline.js";
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
let phrasebook = [];
let curSentence = "";
let curSentenceDisplay = "";
let analyzeRunId = 0;
let dictService = null;
let translationService = null;
let dictionaryReady = null;
let phrasebookReady = null;
let activeNetworkRequests = 0;
const networkQueue = [];
let copyFeedbackTimer = null;
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

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Copy command was unavailable");
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
    templateGroups: TEMPLATES,
    enqueueNetwork,
  });
}

async function loadDictionaryServices() {
  [dictData, coreLexicon, phonetics] = await Promise.all([
    loadJsonAsset("assets/dict.json", {}),
    loadJsonAsset("assets/lexicon/core-lexicon.json", {}),
    loadJsonAsset("assets/phonetics.json", {}),
  ]);
  if (!Object.keys(coreLexicon).length)
    throw new Error("Local dictionary failed to load");

  dictService = createDictionaryService({
    dict: dictData,
    coreLexicon,
    phonetics,
    translateText: (...args) => translationService.translateText(...args),
    enqueueNetwork,
    getCachedOnlineWord,
    setCachedOnlineWord,
  });
  createCurrentTranslationService();
  settingsController?.render(getAppState());
  announce("词典已准备好");
  return dictService;
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

function createOcrUncertainPanel(words, lookupWord) {
  const panel = document.createElement("section");
  panel.className = "ocr-uncertain";
  panel.setAttribute("aria-label", "可能识别有误的词");

  const copy = document.createElement("div");
  copy.className = "ocr-uncertain-copy";
  const title = document.createElement("strong");
  title.textContent = `已收起 ${words.length} 个可能识别有误的词`;
  const hint = document.createElement("span");
  hint.textContent = "这些词可能是图片识别误差。点一下可以联网确认。";
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
          ? `还有 ${remaining} 个词可能识别有误`
          : "已确认全部可查询词";
        if (!remaining) hint.textContent = "查询到的词已加入下方单词卡。";
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
  setSentenceText(raw);
  setSentenceSpeakLabel(getSentenceSpeechLabel("idle"));
  list.setAttribute("aria-busy", "true");
  missionContainer?.replaceChildren();
  if (missionContainer) missionContainer.hidden = true;

  try {
    if (!dictService) {
      list.replaceChildren(
        createEmptyState("正在准备词典", "首次打开只需要一点时间"),
      );
      await dictionaryReady;
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
        setSentenceText(sentence);
        setSentenceSpeakLabel("朗读英文句子");
      } catch (e) {
        if (runId !== analyzeRunId) return;
        list.replaceChildren(
          createEmptyState(
            "中文翻译暂时不可用",
            "请检查网络，或先输入英文句子",
          ),
        );
        return;
      }
    }

    if (runId !== analyzeRunId) return;
    curSentence = sentence;
    const words = dictService.extractLookupTerms(sentence);
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
      setMeaning: (card, meaning) =>
        setCardMeaning(card, word.toLowerCase(), meaning, updateStarredMeaning),
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
    missionController.renderPreview(
      visibleWords
        .filter((word) => !STOP_WORDS.has(word.toLowerCase()))
        .map((word) => ({
          word,
          meaning: dictService.lookup(word),
          band: dictService.lookupLearningBand(word),
        })),
    );
    const uncertainNote = uncertainWords.length
      ? `，另收起 ${uncertainWords.length} 个待确认词`
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
    getDictionaryCount: () =>
      new Set([...Object.keys(dictData), ...Object.keys(coreLexicon)]).size,
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
    getDictionaryReady: () => dictionaryReady,
    getDictionaryService: () => dictService,
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

  dictionaryReady = loadDictionaryServices();
  dictionaryReady.catch(() => announce("词典加载失败，请刷新页面重试"));

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
  registerServiceWorker();
  setupVoices();
  setupLearningTip();
}

document.addEventListener("DOMContentLoaded", init);
