import { getSetting } from "./storage.js";
import { qsa } from "./ui.js";

let speakTimer = null;
let bestVoice = null;
let sentenceState = "idle";
let sentenceTextEl = null;
let sentenceTokens = [];
let sentenceFallbackTimer = null;
let sentenceHighlightIndex = -1;
let sentenceStateHandler = null;

const SENTENCE_LABELS = {
  idle: "朗读整句",
  speaking: "暂停朗读",
  paused: "继续朗读"
};

export function getRate() {
  return getSetting("speed") === "slow" ? 0.6 : 1.0;
}

export function pickVoice() {
  if (bestVoice) return bestVoice;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;
  const blacklist = "Zarvox,Bad,Whisper,Boing,Bells,Trinoids,Cellos,Pipe,Organ,Deranged,Hysterical,Superstar,Wobble,Bubbles,Good News,Jester,Junior,Ralph,Kathy,Fred,Princess,Albert,Bruce,Bahh,Eddy,Flo,Grandma,Grandpa,Reed,Rocko,Sandy,Shelley,Snoop".split(",");
  const isBad = name => blacklist.some(item => name.indexOf(item) >= 0);
  const prefs = [
    "Samantha (Premium)","Samantha (Enhanced)","Ava (Premium)","Ava (Enhanced)",
    "Allison (Premium)","Allison (Enhanced)","Susan (Premium)","Susan (Enhanced)",
    "Microsoft Aria Online","Microsoft Jenny Online","Microsoft Guy Online",
    "Google US English","Google UK English Female",
    "Samantha","Ava","Allison","Susan","Karen","Moira","Tessa","Fiona","Daniel","Alex"
  ];

  for (const pref of prefs) {
    const voice = voices.find(item => item.name === pref || item.name.indexOf(pref) >= 0);
    if (voice && voice.lang.startsWith("en")) {
      bestVoice = voice;
      return voice;
    }
  }

  bestVoice = voices.find(item => item.lang === "en-US" && !item.localService && !isBad(item.name))
    || voices.find(item => item.lang === "en-US" && !isBad(item.name))
    || voices.find(item => item.lang.startsWith("en") && !isBad(item.name));
  return bestVoice;
}

export function speak(text, onEnd) {
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = getRate();
  utterance.pitch = 1.0;
  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  if (onEnd) utterance.onend = onEnd;
  speechSynthesis.speak(utterance);
}

export function speakWordN(word, el) {
  if (speakTimer) {
    clearTimeout(speakTimer);
    speakTimer = null;
  }
  speechSynthesis.cancel();
  qsa(".word-card.speaking").forEach(card => card.classList.remove("speaking"));
  if (el) el.classList.add("speaking");
  const repeat = getSetting("repeat");
  let count = 0;
  const go = () => {
    if (count >= repeat) {
      if (el) el.classList.remove("speaking");
      return;
    }
    count++;
    speak(word, () => {
      speakTimer = setTimeout(go, 380);
    });
  };
  go();
}

export function speakSentence(text) {
  startSentenceSpeech(text);
}

export function getSentenceSpeechState() {
  return sentenceState;
}

export function getSentenceSpeechLabel(state = sentenceState) {
  return SENTENCE_LABELS[state] || SENTENCE_LABELS.idle;
}

export function renderSpeakableText(el, text) {
  if (!el) return [];
  el.replaceChildren();
  const source = String(text || "");
  const tokens = [];
  const re = /[a-zA-Z]+(?:'[a-zA-Z]+)?/g;
  let last = 0;
  let match;
  while ((match = re.exec(source))) {
    if (match.index > last) el.appendChild(document.createTextNode(source.slice(last, match.index)));
    const span = document.createElement("span");
    span.className = "speech-token";
    span.dataset.speechToken = String(tokens.length);
    span.textContent = match[0];
    el.appendChild(span);
    tokens.push({ text: match[0], start: match.index, end: match.index + match[0].length, el: span });
    last = match.index + match[0].length;
  }
  if (last < source.length) el.appendChild(document.createTextNode(source.slice(last)));
  return tokens;
}

export function clearSentenceHighlight() {
  sentenceTextEl?.querySelectorAll?.(".speaking-word").forEach(item => item.classList.remove("speaking-word"));
  sentenceHighlightIndex = -1;
}

export function highlightSentenceToken(index) {
  if (!sentenceTokens.length) return;
  sentenceTokens.forEach((token, i) => token.el.classList.toggle("speaking-word", i === index));
  sentenceHighlightIndex = index;
}

export function resetSentenceSpeech() {
  if (sentenceFallbackTimer) {
    clearInterval(sentenceFallbackTimer);
    sentenceFallbackTimer = null;
  }
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  clearSentenceHighlight();
  setSentenceState("idle");
}

export function toggleSentenceSpeech(text, options = {}) {
  if (sentenceState === "speaking") {
    pauseSentenceSpeech();
    return sentenceState;
  }
  if (sentenceState === "paused") {
    resumeSentenceSpeech();
    return sentenceState;
  }
  startSentenceSpeech(text, options);
  return sentenceState;
}

export function startSentenceSpeech(text, options = {}) {
  if (typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") {
    options.onUnavailable?.();
    return;
  }
  if (sentenceFallbackTimer) clearInterval(sentenceFallbackTimer);
  sentenceStateHandler = options.onStateChange || sentenceStateHandler;
  sentenceTextEl = options.textEl || sentenceTextEl;
  sentenceTokens = sentenceTextEl ? renderSpeakableText(sentenceTextEl, options.displayText || text) : [];
  sentenceHighlightIndex = -1;

  speechSynthesis.cancel();
  qsa(".word-card.sentence-active").forEach(card => card.classList.remove("sentence-active"));

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = getRate();
  utterance.pitch = 1.0;
  const voice = pickVoice();
  if (voice) utterance.voice = voice;

  const cards = qsa("#word-list .word-card");
  const cardByWord = {};
  cards.forEach(card => {
    const word = card.querySelector(".word-en");
    if (word) {
      const key = word.textContent.trim().toLowerCase();
      if (!cardByWord[key]) cardByWord[key] = card;
    }
  });
  const tokens = (text.match(/[a-zA-Z']+/g) || []).map(token => token.toLowerCase());
  let lastCard = null;

  utterance.onboundary = event => {
    if (event.name && event.name !== "word") return;
    const before = text.slice(0, event.charIndex);
    const beforeTokens = before.match(/[a-zA-Z']+/g) || [];
    highlightSentenceToken(beforeTokens.length);
    const word = tokens[beforeTokens.length];
    if (!word) return;
    const card = cardByWord[word];
    if (lastCard && lastCard !== card) lastCard.classList.remove("sentence-active");
    if (card) {
      card.classList.add("sentence-active");
      lastCard = card;
      const rect = card.getBoundingClientRect();
      if (rect.top < 80 || rect.bottom > window.innerHeight - 80) {
        const y = rect.top + window.scrollY - window.innerHeight / 2 + rect.height / 2;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    }
  };
  utterance.onend = utterance.onerror = () => {
    qsa(".word-card.sentence-active").forEach(card => card.classList.remove("sentence-active"));
    if (sentenceFallbackTimer) {
      clearInterval(sentenceFallbackTimer);
      sentenceFallbackTimer = null;
    }
    clearSentenceHighlight();
    setSentenceState("idle");
  };
  setSentenceState("speaking");
  if (sentenceTokens.length) {
    highlightSentenceToken(0);
    startFallbackHighlight();
  }
  speechSynthesis.speak(utterance);
}

export function pauseSentenceSpeech() {
  if (typeof speechSynthesis !== "undefined") speechSynthesis.pause();
  if (sentenceFallbackTimer) {
    clearInterval(sentenceFallbackTimer);
    sentenceFallbackTimer = null;
  }
  setSentenceState("paused");
}

export function resumeSentenceSpeech() {
  if (typeof speechSynthesis !== "undefined") speechSynthesis.resume();
  setSentenceState("speaking");
  startFallbackHighlight();
}

function startFallbackHighlight() {
  if (!sentenceTokens.length || sentenceFallbackTimer) return;
  sentenceFallbackTimer = setInterval(() => {
    if (sentenceState !== "speaking") return;
    const next = Math.min(sentenceTokens.length - 1, sentenceHighlightIndex + 1);
    highlightSentenceToken(next);
    if (next >= sentenceTokens.length - 1) {
      clearInterval(sentenceFallbackTimer);
      sentenceFallbackTimer = null;
    }
  }, Math.max(280, 560 / getRate()));
}

function setSentenceState(state) {
  sentenceState = state;
  sentenceStateHandler?.(state);
}

export function setupVoices() {
  if (typeof speechSynthesis === "undefined") return;
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = pickVoice;
  }
  setTimeout(() => {
    speechSynthesis.getVoices();
    pickVoice();
  }, 100);
}
