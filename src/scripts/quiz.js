import { getDueWords, recordQuizAnswer } from "./wordbook.js";
import { SPEAKER_SVG, createEmptyState, showCelebration } from "./ui.js";

export const quizState = { current: null, score: 0, total: 0 };

export function getQuizMeaning(entry) {
  return String(entry?.m || "").trim();
}

export function getQuizOptionLabel(entry, flipped) {
  if (!flipped) return entry.w;
  return getQuizMeaning(entry) || entry.w;
}

function shuffle(items, random) {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
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
  const distractors = shuffle(
    wb.filter((item) => item.w !== correct.w),
    random,
  ).slice(0, 3);
  const options = shuffle([correct, ...distractors], random);
  const type = random() > 0.5 ? "listen" : "read";
  const correctMeaning = getQuizMeaning(correct);
  const flipped = type === "read" && !correctMeaning;
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

  const score = document.createElement("div");
  score.className = "quiz-score";
  score.textContent = `本轮答对 ${quizState.score} / ${quizState.total}`;
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
    const speakBtn = document.createElement("button");
    speakBtn.className = "btn-action moss quiz-speak";
    speakBtn.id = "quiz-speak-btn";
    speakBtn.innerHTML = SPEAKER_SVG + "<span>播放发音</span>";
    speakBtn.addEventListener("click", () => speak(correct.w));
    card.appendChild(speakBtn);
    setTimeout(() => speak(correct.w), 300);
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
        setTimeout(() => renderQuiz({ getWordbook, speak }), 1200);
        return;
      }

      btn.classList.add("wrong");
      document.querySelectorAll(".quiz-opt").forEach((option) => {
        if (option.dataset.word === correct.w) option.classList.add("correct");
        option.disabled = true;
      });
      setTimeout(() => renderQuiz({ getWordbook, speak }), 1800);
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
}
