import { getDueWords, recordQuizAnswer } from "./wordbook.js";
import { SPEAKER_SVG, createEmptyState, showCelebration } from "./ui.js";
import { shuffle } from "./random.js";

export const quizState = { current: null, score: 0, total: 0 };

// Pending advance timers must never outlive the page the child is looking at:
// they used to keep rendering questions (and speaking) after navigating away.
let advanceTimer = null;

export function cancelPendingQuiz() {
  clearTimeout(advanceTimer);
  advanceTimer = null;
}

export function resetQuizSession() {
  cancelPendingQuiz();
  quizState.current = null;
  quizState.score = 0;
  quizState.total = 0;
}

function scheduleNextQuestion(render, delayMs) {
  cancelPendingQuiz();
  advanceTimer = setTimeout(render, delayMs);
}

export function getQuizMeaning(entry) {
  return String(entry?.m || "").trim();
}

export function getQuizOptionLabel(entry, flipped) {
  if (!flipped) return entry.w;
  return getQuizMeaning(entry) || entry.w;
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
  const type = random() > 0.5 ? "listen" : "read";
  const correctMeaning = getQuizMeaning(correct);
  const flipped = type === "read" && !correctMeaning;

  // Two entries that share a label make the question unanswerable, so compare
  // the rendered option text rather than the word.
  const usedLabels = new Set([getQuizOptionLabel(correct, flipped)]);
  const distractors = [];
  for (const item of shuffle(
    wb.filter((item) => item.w !== correct.w),
    random,
  )) {
    if (distractors.length >= 3) break;
    const label = getQuizOptionLabel(item, flipped);
    if (usedLabels.has(label)) continue;
    usedLabels.add(label);
    distractors.push(item);
  }

  const options = shuffle([correct, ...distractors], random);
  return { correct, options, type, flipped };
}

export function handleQuizAnswer(word, correctWord) {
  const isCorrect = word === correctWord;
  recordQuizAnswer(correctWord, isCorrect);
  quizState.total++;
  if (isCorrect) quizState.score++;
  return isCorrect;
}

export function renderQuiz({ getWordbook, speak }) {
  cancelPendingQuiz();
  const wb = getWordbook().filter((item) => item?.w);
  const container = document.getElementById("quiz-content");
  if (!container) return;

  document.querySelectorAll(".quiz-opt").forEach((el) => {
    el.classList.remove(
      "correct",
      "wrong",
      "selected",
      "active",
      "chosen",
      "on",
    );
    el.disabled = false;
    el.style.removeProperty("background");
    el.style.removeProperty("border-color");
    el.style.removeProperty("color");
  });

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
  const { correct, options, type, flipped } = question;
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
    if (flipped) {
      prompt.appendChild(document.createTextNode("单词 "));
      const strong = document.createElement("strong");
      strong.textContent = correct.w;
      prompt.appendChild(strong);
      prompt.appendChild(document.createTextNode(" 的中文是？"));
    } else {
      const strong = document.createElement("strong");
      strong.textContent = correctMeaning;
      prompt.appendChild(strong);
      prompt.appendChild(document.createTextNode(" 的英文是？"));
    }
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
    btn.textContent = getQuizOptionLabel(opt, flipped);
    btn.addEventListener("click", () => {
      const isCorrect = handleQuizAnswer(btn.dataset.word, correct.w);
      if (isCorrect) {
        btn.classList.add("correct");
        showCelebration();
        scheduleNextQuestion(() => renderQuiz({ getWordbook, speak }), 1200);
        return;
      }

      btn.classList.add("wrong");
      document.querySelectorAll(".quiz-opt").forEach((option) => {
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
