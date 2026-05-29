import { getSetting } from "./storage.js";
import { qsa } from "./ui.js";

let speakTimer = null;
let bestVoice = null;

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
  };
  speechSynthesis.speak(utterance);
}

export function setupVoices() {
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = pickVoice;
  }
  setTimeout(() => {
    speechSynthesis.getVoices();
    pickVoice();
  }, 100);
}
