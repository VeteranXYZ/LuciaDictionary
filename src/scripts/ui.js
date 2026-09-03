import { cleanPhonetic } from "./phonetic.js";
import { isNetworkAllowed } from "./storage.js";
import { emptyMascotPath } from "../config/site.js";
import { LEARNING_BAND_LABELS } from "./learning-labels.js";

export const SPEAKER_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
export const STAR_SVG =
  '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
export const STAR_OUTLINE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
export const BOOK_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';
export const LOCAL_MISSING_MESSAGE = "暂时没有释义，可联网查词";
export const ONLINE_FAILURE_MESSAGE = "联网查词失败，请稍后再试";
export const OFFLINE_ONLY_MESSAGE = "仅离线模式下没有这个词的释义";
export const ONLINE_LOOKUP_BUTTON_LABEL = "联网查词";
export { LEARNING_BAND_LABELS } from "./learning-labels.js";

export function getLookupFallbackMessage({
  explicitLookup = false,
  failed = false,
  networkAllowed = true,
} = {}) {
  // Offering "联网查词" while offline-only mode is on would promise something
  // the app has just been told not to do.
  if (!networkAllowed) return OFFLINE_ONLY_MESSAGE;
  return explicitLookup && failed
    ? ONLINE_FAILURE_MESSAGE
    : LOCAL_MISSING_MESSAGE;
}

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function setIcon(button, svg) {
  button.innerHTML = svg;
}

export function createEmptyState(message, strongText) {
  const wrap = document.createElement("div");
  wrap.className = "empty";

  const mascot = document.createElement("div");
  mascot.className = "empty-mascot";
  const img = document.createElement("img");
  img.src = emptyMascotPath;
  img.width = 160;
  img.height = 160;
  img.alt = "Lucia 猴子插画";
  mascot.appendChild(img);

  const p = document.createElement("p");
  p.appendChild(document.createTextNode(message));
  if (strongText) {
    p.appendChild(document.createElement("br"));
    const strong = document.createElement("strong");
    strong.textContent = strongText;
    p.appendChild(strong);
  }

  wrap.appendChild(mascot);
  wrap.appendChild(p);
  return wrap;
}

export function replaceWithEmptyState(container, message, strongText) {
  container.replaceChildren(createEmptyState(message, strongText));
}

export function renderDefinitionsToElement(el, definitions) {
  el.replaceChildren();
  if (!definitions?.length) {
    const span = document.createElement("span");
    span.className = "muted-inline";
    span.textContent = "暂时没有中文释义";
    el.appendChild(span);
    return;
  }

  for (const item of definitions) {
    const row = document.createElement("div");
    row.className = "definition-row";
    const pos = document.createElement("span");
    pos.className = "pos-tag";
    pos.textContent = item.pos;
    row.appendChild(pos);
    row.appendChild(document.createTextNode(item.cn));
    el.appendChild(row);
  }
}

export function setMutedText(el, text) {
  el.replaceChildren();
  const span = document.createElement("span");
  span.className = "muted-inline";
  span.textContent = text;
  el.appendChild(span);
}

export function createWordCardFrame({
  word,
  index,
  bandKey = "",
  bandFallback = "",
  phonetic = "",
  meaning = "",
  loadingMessage = "正在查找中文释义…",
  animationStep = 0.05,
}) {
  const card = document.createElement("div");
  card.className = "word-card";
  card.style.animationDelay = index * animationStep + "s";
  card.dataset.word = String(word).toLowerCase();

  const number = document.createElement("div");
  number.className = "word-num";
  number.textContent = index + 1;

  const body = document.createElement("div");
  body.className = "word-body";
  const wordElement = document.createElement("div");
  wordElement.className = "word-en";
  wordElement.textContent = word;
  const band = document.createElement("span");
  band.className = "word-level";
  band.textContent = LEARNING_BAND_LABELS[bandKey] || bandFallback;
  band.hidden = !band.textContent;
  const phoneticElement = document.createElement("div");
  phoneticElement.className = "word-phonetic";
  phoneticElement.textContent = phonetic || "暂无音标";
  const meaningElement = document.createElement("div");
  meaningElement.className = "word-cn";
  if (meaning) meaningElement.textContent = meaning;
  else setMutedText(meaningElement, loadingMessage);

  body.append(wordElement, band, phoneticElement, meaningElement);
  const actions = document.createElement("div");
  actions.className = "word-actions";
  card.append(number, body, actions);

  return {
    card,
    body,
    actions,
    band,
    meaningElement,
    phoneticElement,
    wordElement,
  };
}

export function showCelebration() {
  const el = document.createElement("div");
  el.className = "celebration";
  const marks = ["答对啦！", "真棒！", "很好！", "继续加油！"];
  el.textContent = marks[Math.floor(Math.random() * marks.length)];
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

export function setCardMeaning(card, word, meaning, updateStarredMeaning) {
  if (!meaning) return;
  card.dataset.meaning = meaning;
  updateStarredMeaning(word, meaning);
  const star = card.querySelector(".btn-star");
  if (star) {
    star.disabled = false;
    star.setAttribute(
      "aria-label",
      star.classList.contains("active") ? "移出生词本" : "收藏到生词本",
    );
  }
}

export function getCardMeaning(card) {
  return card.dataset.meaning || "";
}

export async function hydrateOnlineWord(word, cnEl, phoneticEl, card, options) {
  const w = String(word).toLowerCase().trim();
  if (!w) return;
  const {
    getCachedOnlineWord,
    lookupOnlineData,
    setMeaning,
    isCurrentRun,
    runId,
    fillMeaning,
    allowNetwork,
    explicitLookup,
  } = options;

  const cached = getCachedOnlineWord(w);
  if (cached) {
    if (!isCurrentRun(runId)) return;
    if (cached.phonetic && phoneticEl)
      phoneticEl.textContent = cleanPhonetic(cached.phonetic);
    if (fillMeaning) {
      renderDefinitionsToElement(cnEl, cached.definitions);
      setMeaning(card, cached.meaning);
    }
    return;
  }

  if (!allowNetwork) {
    if (fillMeaning)
      setMutedText(
        cnEl,
        getLookupFallbackMessage({ networkAllowed: isNetworkAllowed() }),
      );
    if (phoneticEl && !phoneticEl.textContent.trim())
      phoneticEl.textContent = "暂无音标";
    return;
  }

  if (fillMeaning) setMutedText(cnEl, "正在查找中文释义…");
  if (phoneticEl && !phoneticEl.textContent.trim()) {
    phoneticEl.textContent = "音标查询中…";
  }

  try {
    const data = await lookupOnlineData(w);
    if (!isCurrentRun(runId)) return;
    if (!data) {
      if (fillMeaning)
        setMutedText(
          cnEl,
          getLookupFallbackMessage({ explicitLookup, failed: explicitLookup }),
        );
      if (phoneticEl && phoneticEl.textContent === "音标查询中…")
        phoneticEl.textContent = "暂无音标";
      return;
    }
    if (data.phonetic && phoneticEl)
      phoneticEl.textContent = cleanPhonetic(data.phonetic);
    if (fillMeaning) {
      renderDefinitionsToElement(cnEl, data.definitions);
      setMeaning(card, data.meaning);
    }
  } catch (e) {
    if (!isCurrentRun(runId)) return;
    if (fillMeaning)
      setMutedText(
        cnEl,
        getLookupFallbackMessage({ explicitLookup, failed: explicitLookup }),
      );
    if (phoneticEl && phoneticEl.textContent === "音标查询中…")
      phoneticEl.textContent = "暂无音标";
  }
}

export function buildWordCard(word, index, meaning, container, options) {
  const key = word.toLowerCase();
  const skipOnlineLookup = !meaning && options.stopWords.has(key);
  const displayMeaning = skipOnlineLookup
    ? "小小的连接词，帮句子里的词连在一起"
    : meaning;
  const {
    card,
    actions,
    meaningElement: cn,
    phoneticElement: ph,
  } = createWordCardFrame({
    word,
    index,
    bandKey: options.lookupLearningBand?.(word) || "",
    phonetic: options.lookupLocalPhonetic(word),
    meaning: displayMeaning,
  });
  options.setMeaning(card, displayMeaning || "");

  const star = document.createElement("button");
  const starred = options.isStarred(key);
  star.className = "btn-star" + (starred ? " active" : "");
  setIcon(star, starred ? STAR_SVG : STAR_OUTLINE);
  star.setAttribute("aria-label", starred ? "移出生词本" : "收藏到生词本");
  if (!displayMeaning) {
    star.disabled = true;
    star.setAttribute("aria-label", "找到释义后可以收藏");
  }
  star.addEventListener("click", (event) => {
    event.stopPropagation();
    if (star.disabled) return;
    const added = options.toggleStar(
      key,
      getCardMeaning(card),
      options.sourceSentence(),
    );
    star.className = "btn-star" + (added ? " active" : "");
    setIcon(star, added ? STAR_SVG : STAR_OUTLINE);
    star.setAttribute("aria-label", added ? "移出生词本" : "收藏到生词本");
  });

  const speakBtn = document.createElement("button");
  speakBtn.className = "btn-speak";
  setIcon(speakBtn, SPEAKER_SVG);
  speakBtn.setAttribute("aria-label", "朗读");
  speakBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    options.speakWordN(word, card);
  });

  actions.append(star, speakBtn);
  if (!displayMeaning && !skipOnlineLookup && isNetworkAllowed()) {
    const onlineBtn = document.createElement("button");
    onlineBtn.className = "btn-online-lookup";
    onlineBtn.textContent = ONLINE_LOOKUP_BUTTON_LABEL;
    onlineBtn.setAttribute("aria-label", "联网查词");
    onlineBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      onlineBtn.disabled = true;
      await hydrateOnlineWord(word, cn, ph, card, {
        getCachedOnlineWord: options.getCachedOnlineWord,
        lookupOnlineData: options.lookupOnlineData,
        setMeaning: options.setMeaning,
        isCurrentRun: options.isCurrentRun,
        runId: options.runId,
        fillMeaning: true,
        allowNetwork: true,
        explicitLookup: true,
      });
      onlineBtn.disabled = false;
    });
    actions.appendChild(onlineBtn);
  }
  card.addEventListener("click", () => options.speakWordN(word, card));
  container.appendChild(card);

  if (!skipOnlineLookup) {
    hydrateOnlineWord(word, cn, ph, card, {
      getCachedOnlineWord: options.getCachedOnlineWord,
      lookupOnlineData: options.lookupOnlineData,
      setMeaning: options.setMeaning,
      isCurrentRun: options.isCurrentRun,
      runId: options.runId,
      fillMeaning: !meaning,
      allowNetwork: false,
    });
  }
}
