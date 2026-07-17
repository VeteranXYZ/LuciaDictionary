import {
  clearWordbookItems,
  exportWordbookJson,
  getDueWords,
  getReviewSummary,
  getWordbook,
  importWordbookFile,
  removeWord,
  recordReviewFeedback,
  updateStarredMeaning,
} from "../wordbook.js";
import {
  SPEAKER_SVG,
  STAR_OUTLINE,
  STAR_SVG,
  createEmptyState,
  hydrateOnlineWord,
  setCardMeaning,
  setMutedText,
} from "../ui.js";

export function createWordbookController({
  announce,
  getCachedOnlineWord,
  getDictionaryService,
  speak,
  speakWordN,
}) {
  function syncHomeCards(wordbook) {
    const savedWords = new Set(wordbook.map((entry) => entry.w));

    document.querySelectorAll("#word-list .word-card").forEach((card) => {
      const star = card.querySelector(".btn-star");
      if (!star) return;
      const starred = savedWords.has(card.dataset.word);
      star.classList.toggle("active", starred);
      star.innerHTML = starred ? STAR_SVG : STAR_OUTLINE;
      star.setAttribute(
        "aria-label",
        starred
          ? "移出生词本"
          : star.disabled
            ? "找到释义后可以收藏"
            : "收藏到生词本",
      );
    });

    const wordbookCount = document.getElementById("about-wb-count");
    if (wordbookCount) {
      wordbookCount.textContent = wordbook.length.toLocaleString();
    }
  }

  function setActionState(hasItems) {
    const review = document.getElementById("review-all-btn");
    const exportButton = document.getElementById("export-wb-btn");
    const clearButton = document.getElementById("clear-wb-btn");
    if (review) {
      review.disabled = !hasItems;
      const label = review.querySelector("span");
      if (label && !hasItems) label.textContent = "朗读";
    }
    if (exportButton) exportButton.disabled = !hasItems;
    if (clearButton) clearButton.disabled = !hasItems;
  }

  function render(wordbook = getWordbook()) {
    syncHomeCards(wordbook);
    const dictionaryService = getDictionaryService();
    const stats = document.getElementById("wb-stats");
    const actions = document.getElementById("wb-actions");
    const list = document.getElementById("wb-list");
    if (!stats || !actions || !list || !dictionaryService) return;

    if (!wordbook.length) {
      stats.style.display = "none";
      actions.style.display = "flex";
      setActionState(false);
      list.replaceChildren(
        createEmptyState("生词本还是空的", "在首页点 ☆ 把单词收藏到这里吧"),
      );
      return;
    }

    stats.style.display = "flex";
    stats.replaceChildren();
    const summary = getReviewSummary(wordbook);
    for (const [value, text] of [
      [summary.total, "收藏"],
      [summary.due, "今日复习"],
      [summary.mastered, "已掌握"],
    ]) {
      const statWrap = document.createElement("div");
      const number = document.createElement("div");
      number.className = "num";
      number.textContent = value;
      const label = document.createElement("div");
      label.className = "label";
      label.textContent = text;
      statWrap.append(number, label);
      stats.appendChild(statWrap);
    }

    const reviewLabel = document.querySelector("#review-all-btn span");
    if (reviewLabel) {
      reviewLabel.textContent = summary.due
        ? `复习 ${summary.due} 个`
        : "朗读全部";
    }

    actions.style.display = "flex";
    setActionState(true);
    list.replaceChildren();

    wordbook.forEach((entry, index) => {
      const card = document.createElement("div");
      card.className = "word-card";
      card.style.animationDelay = index * 0.04 + "s";

      const count = document.createElement("div");
      count.className = "word-num";
      count.textContent = index + 1;

      const body = document.createElement("div");
      body.className = "word-body";
      const word = document.createElement("div");
      word.className = "word-en";
      word.textContent = entry.w;
      const band = document.createElement("span");
      band.className = "word-level";
      const bandKey = dictionaryService.lookupLearningBand(entry.w);
      band.textContent =
        { foundation: "基础词", developing: "进阶词", expanding: "拓展词" }[
          bandKey
        ] || "复习词";
      const phonetic = document.createElement("div");
      phonetic.className = "word-phonetic";
      phonetic.textContent =
        dictionaryService.lookupLocalPhonetic(entry.w) || "暂无音标";
      const meaning = document.createElement("div");
      meaning.className = "word-cn";
      if (entry.m) meaning.textContent = entry.m;
      else setMutedText(meaning, "正在查找中文释义…");

      const source = document.createElement("div");
      source.className = "word-source";
      const encounterTotal = (entry.sourceSentences || []).reduce(
        (total, item) => total + Math.max(1, Number(item.count || 1)),
        0,
      );
      if (entry.sourceSentences?.length) {
        const latestSentence = entry.sourceSentences[0].text;
        source.textContent = `来自 ${entry.sourceSentences.length} 个课堂句子 · 已遇到 ${encounterTotal} 次 · ${latestSentence}`;
        source.title = latestSentence;
      } else {
        source.hidden = true;
      }

      body.append(word, band, phonetic, meaning, source);

      const actionsWrap = document.createElement("div");
      actionsWrap.className = "word-actions";
      const star = document.createElement("button");
      star.className = "btn-star active";
      star.innerHTML = STAR_SVG;
      star.setAttribute("aria-label", "移出生词本");
      star.addEventListener("click", (event) => {
        event.stopPropagation();
        removeWord(entry.w);
      });

      const speakButton = document.createElement("button");
      speakButton.className = "btn-speak";
      speakButton.innerHTML = SPEAKER_SVG;
      speakButton.setAttribute("aria-label", "朗读");
      speakButton.addEventListener("click", (event) => {
        event.stopPropagation();
        speakWordN(entry.w, card);
      });

      actionsWrap.append(star, speakButton);
      const feedback = document.createElement("div");
      feedback.className = "review-feedback";
      const reviewMeta = document.createElement("span");
      reviewMeta.className = "review-meta";
      const masteryLabel =
        {
          new: "新词",
          learning: "学习中",
          reviewing: "复习中",
          mastered: "已掌握",
        }[entry.mastery] || "新词";
      reviewMeta.textContent =
        entry.nextReviewAt > Date.now()
          ? `${masteryLabel} · ${new Date(entry.nextReviewAt).toLocaleDateString("zh-CN")} 再复习`
          : `${masteryLabel} · 今天复习`;
      feedback.appendChild(reviewMeta);
      for (const [result, text] of [
        ["know", "会"],
        ["unsure", "不确定"],
        ["forgot", "忘记"],
      ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `review-btn ${result}`;
        button.textContent = text;
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          recordReviewFeedback(entry.w, result);
          announce(`${entry.w} 已记录为${text}`);
        });
        feedback.appendChild(button);
      }
      card.append(count, body, actionsWrap, feedback);
      setCardMeaning(card, entry.w, entry.m || "", updateStarredMeaning);
      card.addEventListener("click", () => speakWordN(entry.w, card));
      list.appendChild(card);
      hydrateOnlineWord(entry.w, meaning, phonetic, card, {
        getCachedOnlineWord,
        lookupOnlineData: dictionaryService.lookupOnlineData,
        setMeaning: (target, nextMeaning) =>
          setCardMeaning(target, entry.w, nextMeaning, updateStarredMeaning),
        isCurrentRun: () => true,
        fillMeaning: !entry.m,
        allowNetwork: false,
      });
    });
  }

  function reviewAll() {
    const allWords = getWordbook();
    const dueWords = getDueWords(allWords);
    const wordbook = dueWords.length ? dueWords : allWords;
    if (!wordbook.length) return;
    let index = 0;
    const next = () => {
      if (index >= wordbook.length) return;
      const cards = document.querySelectorAll("#wb-list .word-card");
      if (cards[index]) cards[index].classList.add("speaking");
      const currentIndex = index;
      speak(wordbook[index].w, () => {
        if (cards[currentIndex]) {
          cards[currentIndex].classList.remove("speaking");
        }
        index++;
        setTimeout(next, 320);
      });
    };
    next();
  }

  function clear() {
    if (confirm("确定要清空生词本中的全部单词吗？此操作无法撤销。")) {
      clearWordbookItems();
      announce("生词本已清空");
    }
  }

  function exportItems() {
    const blob = new Blob([exportWordbookJson()], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lucia-wordbook.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importItems(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const result = await importWordbookFile(file);
      if (!result.ok) {
        alert(result.error || "备份导入失败");
      }
    } catch {
      alert("导入失败，请选择此前备份的生词本文件。");
    }
  }

  function setup() {
    document
      .getElementById("review-all-btn")
      ?.addEventListener("click", reviewAll);
    document.getElementById("clear-wb-btn")?.addEventListener("click", clear);
    document
      .getElementById("export-wb-btn")
      ?.addEventListener("click", exportItems);
    document
      .getElementById("import-wb-input")
      ?.addEventListener("change", importItems);
    document.getElementById("import-wb-btn")?.addEventListener("click", () => {
      document.getElementById("import-wb-input")?.click();
    });
  }

  function onStateChange(state, change) {
    if (change.scope !== "all" && change.scope !== "wordbook") return;
    syncHomeCards(state.wordbook);
    const page = document.getElementById("pg-wordbook");
    if (page && !page.hidden && getDictionaryService()) render(state.wordbook);
  }

  return { onStateChange, render, setup, syncHomeCards };
}
