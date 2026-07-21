import {
  createLearningMission,
  saveMissionResult,
  summarizeMission,
} from "../mission.js";
import {
  getWordbook,
  recordReviewFeedback,
  recordWordEncounter,
} from "../wordbook.js";

export function createMissionController({ announce, getSentence, speak }) {
  let currentMission = null;
  let questionIndex = 0;
  let results = [];

  function stageLabel(type) {
    return (
      {
        listen: "听音辨词",
        meaning: "看义选词",
        cloze: "放回原句",
      }[type] || "练习"
    );
  }

  function createHeader(eyebrow, title, copy) {
    const header = document.createElement("div");
    header.className = "mission-head";
    const eyebrowElement = document.createElement("div");
    eyebrowElement.className = "mission-eyebrow";
    eyebrowElement.textContent = eyebrow;
    const titleElement = document.createElement("h2");
    titleElement.textContent = title;
    const copyElement = document.createElement("p");
    copyElement.textContent = copy;
    header.append(eyebrowElement, titleElement, copyElement);
    return header;
  }

  function renderPreview(candidates) {
    const container = document.getElementById("classroom-mission");
    if (!container) return;
    currentMission = createLearningMission({
      sentence: getSentence(),
      candidates,
      wordbook: getWordbook(),
    });
    questionIndex = 0;
    results = [];

    if (!currentMission) {
      container.hidden = true;
      container.replaceChildren();
      return;
    }

    container.hidden = false;
    container.className = "classroom-mission mission-preview";
    const header = createHeader(
      "3 分钟课堂小练习",
      "用 3 分钟练熟这句话",
      "会根据生词本和复习记录，先练现在最需要记住的词。",
    );
    const targets = document.createElement("div");
    targets.className = "mission-targets";
    for (const target of currentMission.targets) {
      const item = document.createElement("div");
      item.className = "mission-target";
      const word = document.createElement("strong");
      word.textContent = target.word;
      const reason = document.createElement("span");
      reason.textContent = target.reason;
      item.append(word, reason);
      targets.appendChild(item);
    }

    const start = document.createElement("button");
    start.type = "button";
    start.className = "mission-primary";
    start.textContent = `开始练习 · ${currentMission.targets.length} 个词`;
    start.addEventListener("click", () => startMission(true));
    container.replaceChildren(header, targets, start);
  }

  function startMission(recordEncounter = false) {
    if (!currentMission) return;
    questionIndex = 0;
    results = [];
    if (recordEncounter) {
      for (const target of currentMission.targets) {
        recordWordEncounter(
          target.word,
          target.meaning,
          currentMission.sentence,
        );
      }
    }
    renderQuestion();
  }

  function renderQuestion() {
    const container = document.getElementById("classroom-mission");
    const question = currentMission?.questions?.[questionIndex];
    if (!container || !question) {
      finish();
      return;
    }

    container.hidden = false;
    container.className = "classroom-mission mission-active";
    const progress = document.createElement("div");
    progress.className = "mission-progress";
    const progressLabel = document.createElement("span");
    progressLabel.textContent = `${questionIndex + 1} / ${currentMission.questions.length}`;
    const track = document.createElement("div");
    track.className = "mission-progress-track";
    const fill = document.createElement("div");
    fill.style.width = `${((questionIndex + 1) / currentMission.questions.length) * 100}%`;
    track.appendChild(fill);
    progress.append(progressLabel, track);

    const type = document.createElement("div");
    type.className = "mission-question-type";
    type.textContent = stageLabel(question.type);
    const prompt = document.createElement("div");
    prompt.className = `mission-question ${question.type}`;
    prompt.textContent = question.prompt;

    const body = document.createElement("div");
    body.className = "mission-question-body";
    body.append(type, prompt);
    if (question.type === "listen") {
      const listen = document.createElement("button");
      listen.type = "button";
      listen.className = "mission-listen";
      listen.setAttribute("aria-label", "播放目标单词发音");
      listen.textContent = "▶ 播放发音";
      listen.addEventListener("click", () => speak(question.word));
      body.appendChild(listen);
      setTimeout(() => speak(question.word), 250);
    }

    const options = document.createElement("div");
    options.className = "mission-options";
    for (const option of question.options) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mission-option";
      button.dataset.word = option;
      button.textContent = option;
      button.addEventListener("click", () => answerQuestion(option, options));
      options.appendChild(button);
    }
    container.replaceChildren(progress, body, options);
  }

  function answerQuestion(selectedWord, options) {
    const question = currentMission?.questions?.[questionIndex];
    if (!question || options.dataset.answered === "true") return;
    options.dataset.answered = "true";
    const correct = selectedWord === question.word;
    results.push({ word: question.word, correct });
    for (const button of options.querySelectorAll("button")) {
      button.disabled = true;
      if (button.dataset.word === question.word)
        button.classList.add("correct");
      if (button.dataset.word === selectedWord && !correct) {
        button.classList.add("wrong");
      }
    }

    const feedback = document.createElement("div");
    feedback.className = `mission-feedback ${correct ? "correct" : "wrong"}`;
    feedback.textContent = correct
      ? `答对了 · ${question.word}`
      : `再记一次 · 正确答案是 ${question.word}`;
    const next = document.createElement("button");
    next.type = "button";
    next.className = "mission-next";
    next.textContent =
      questionIndex + 1 < currentMission.questions.length
        ? "下一题"
        : "查看学习结果";
    next.addEventListener("click", () => {
      questionIndex++;
      renderQuestion();
    });
    feedback.appendChild(next);
    document.getElementById("classroom-mission")?.appendChild(feedback);
    announce(correct ? "回答正确" : `正确答案是 ${question.word}`);
  }

  function finish() {
    const container = document.getElementById("classroom-mission");
    if (!container || !currentMission || !results.length) return;
    for (const result of results) {
      recordReviewFeedback(result.word, result.correct ? "know" : "forgot");
    }
    saveMissionResult(currentMission, results);
    const summary = summarizeMission(currentMission, results);
    container.className = "classroom-mission mission-complete";

    const header = createHeader(
      "练习完成",
      "这句话现在更熟悉了",
      `答对 ${summary.correct} / ${summary.total} 个词。结果已保存，下次会优先复习没记住的词。`,
    );
    const resultGrid = document.createElement("div");
    resultGrid.className = "mission-result-grid";
    for (const [label, words, emptyText] of [
      ["这次记住了", summary.learned, "继续加油"],
      ["下次再复习", summary.needsReview, "全部答对啦"],
    ]) {
      const card = document.createElement("div");
      const title = document.createElement("span");
      title.textContent = label;
      const value = document.createElement("strong");
      value.textContent = words.length ? words.join(" · ") : emptyText;
      card.append(title, value);
      resultGrid.appendChild(card);
    }
    const parent = document.createElement("aside");
    parent.className = "mission-parent-card";
    const parentLabel = document.createElement("strong");
    parentLabel.textContent = "和孩子再练一句";
    const parentCopy = document.createElement("p");
    parentCopy.textContent = summary.parentPrompt;
    const sentence = document.createElement("blockquote");
    sentence.textContent = currentMission.sentence;
    parent.append(parentLabel, parentCopy, sentence);

    const actions = document.createElement("div");
    actions.className = "mission-complete-actions";
    const speakSentence = document.createElement("button");
    speakSentence.type = "button";
    speakSentence.className = "mission-primary";
    speakSentence.textContent = "一起朗读原句";
    speakSentence.addEventListener("click", () =>
      speak(currentMission.sentence),
    );
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "mission-secondary";
    retry.textContent = "再练一次";
    retry.addEventListener("click", () => startMission());
    actions.append(speakSentence, retry);
    container.replaceChildren(header, resultGrid, parent, actions);
    announce("课堂小练习已完成，答题结果已保存");
  }

  return { renderPreview };
}
