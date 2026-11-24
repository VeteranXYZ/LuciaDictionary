import {
  getDueWords,
  recordQuizAnswer,
  WORDBOOK_SAVE_ERROR,
} from "./wordbook.js";
import { SPEAKER_SVG, createEmptyState, showCelebration } from "./ui.js";
import { shuffle } from "./random.js";

export const quizState = { current: null, score: 0, total: 0 };

// Pending advance timers must never outlive the page the child is looking at:
// they used to keep rendering questions (and speaking) after navigating away.
let advanceTimer = null;

export function cancelPendingQuiz() {
  clearTimeout(advanceTimer);
  advanceTimer = null;
  quizState.current = null;
}

export function resetQuizSession() {
  cancelPendingQuiz();
  quizState.score = 0;
  quizState.total = 0;
}

function scheduleNextQuestion(render, delayMs) {
  clearTimeout(advanceTimer);
  advanceTimer = setTimeout(render, delayMs);
}

export function getQuizMeaning(entry) {
  return String(entry?.m || "").trim();
}

export function createQuizQuestion(
  wordbook,
  random = Math.random,
  now = Date.now(),
) {
  const wb = (wordbook || []).filter((item) => item?.w);
  if (wb.length < 4) return null;
  const due = getDueWords(wb, now);
  const correct = shuffle(due.length ? due : wb, random)[0];
  const type = !getQuizMeaning(correct) || random() > 0.5 ? "listen" : "read";
  const usedWords = new Set([correct.w]);
  const distractors = [];
  for (const item of shuffle(wb, random)) {
    if (distractors.length >= 3) break;
    if (usedWords.has(item.w)) continue;
    usedWords.add(item.w);
    distractors.push(item);
  }

  const options = shuffle([correct, ...distractors], random);
  return { correct, options, type };
}

export async function handleQuizAnswer(word, correctWord) {
  const question = quizState.current;
  const isCorrect = word === correctWord;
  if (!(await recordQuizAnswer(correctWord, isCorrect))) return null;
  if (question !== quizState.current) return isCorrect;
  quizState.total++;
  if (isCorrect) quizState.score++;
  return isCorrect;
}

export function renderQuiz({ getWordbook, speak }) {
  cancelPendingQuiz();
  const wb = getWordbook().filter((item) => item?.w);
  const container = document.getElementById("quiz-content");
  if (!container) return;

  if (wb.length < 4) {
    container.replaceChildren(
      createEmptyState(
        "生词本至少需要 4 个单词才能开始测验",
        "先在首页收藏一些单词吧",
      ),
    );
    return;
  }

  const question = createQuizQuestion(wb);
  const { correct, options, type } = question;
  const correctMeaning = getQuizMeaning(correct);
  quizState.current = question;

  const card = document.createElement("div");
  card.className = "quiz-card";
  let speakButton = null;

  const score = document.createElement("div");
  score.className = "quiz-score";
  score.textContent = quizState.total
    ? `这次进入测验后答对 ${quizState.score} / ${quizState.total}`
    : "开始答题吧";
  card.appendChild(score);

  const prompt = document.createElement("div");
  prompt.className = "quiz-q";
  if (type === "read") {
    const strong = document.createElement("strong");
    strong.textContent = correctMeaning;
    prompt.appendChild(strong);
    prompt.appendChild(document.createTextNode(" 的英文是？"));
    card.appendChild(prompt);
  } else {
    prompt.textContent = "听发音，选出正确的单词";
    card.appendChild(prompt);
    speakButton = document.createElement("button");
    speakButton.className = "btn-action moss quiz-speak";
    speakButton.id = "quiz-speak-btn";
    speakButton.innerHTML = SPEAKER_SVG + "<span>播放发音</span>";
    speakButton.addEventListener("click", () => speak(correct.w));
    card.appendChild(speakButton);
  }

  const opts = document.createElement("div");
  opts.className = "quiz-opts";
  for (const opt of options) {
    const btn = document.createElement("button");
    btn.className = "quiz-opt";
    btn.dataset.word = opt.w;
    btn.textContent = opt.w;
    btn.addEventListener("click", async () => {
      if (opts.dataset.answered) return;
      opts.dataset.answered = "true";
      for (const option of opts.children) option.disabled = true;
      const isCorrect = await handleQuizAnswer(btn.dataset.word, correct.w);
      if (quizState.current !== question || !opts.isConnected) return;
      if (isCorrect == null) {
        delete opts.dataset.answered;
        for (const option of opts.children) option.disabled = false;
        alert(WORDBOOK_SAVE_ERROR);
        return;
      }
      if (isCorrect) {
        btn.classList.add("correct");
        showCelebration();
        scheduleNextQuestion(() => renderQuiz({ getWordbook, speak }), 1200);
        return;
      }

      btn.classList.add("wrong");
      opts.querySelectorAll(".quiz-opt").forEach((option) => {
        if (option.dataset.word === correct.w) option.classList.add("correct");
        option.disabled = true;
      });
      scheduleNextQuestion(() => renderQuiz({ getWordbook, speak }), 1800);
    });
    opts.appendChild(btn);
  }
  card.appendChild(opts);

  const skip = document.createElement("button");
  skip.className = "btn-action honey quiz-skip";
  skip.id = "quiz-skip-btn";
  skip.type = "button";
  const skipText = document.createElement("span");
  skipText.textContent = "换一题";
  skip.appendChild(skipText);
  skip.addEventListener("click", () => renderQuiz({ getWordbook, speak }));

  container.replaceChildren(card, skip);
  // Same rule as the mission: audio only after a deliberate tap.
  speakButton?.focus({ preventScroll: true });
}
