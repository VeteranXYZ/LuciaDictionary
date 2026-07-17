import { renderQuiz } from "../quiz.js";
import { renderTemplates } from "../templates.js";
import { getWordbook } from "../wordbook.js";
import { createEmptyState } from "../ui.js";

export function createNavigationController({
  analyzeSentence,
  getDictionaryReady,
  getDictionaryService,
  renderSettings,
  renderWordbook,
  speak,
}) {
  function learnTemplateSentence(sentence) {
    const input = document.getElementById("sentence-input");
    if (input) input.value = sentence;
    navigate("home");
    analyzeSentence();
    requestAnimationFrame(() => {
      const list = document.getElementById("word-list");
      if (!list) return;
      const y = list.getBoundingClientRect().top + window.scrollY - 12;
      window.scrollTo({ top: y, behavior: "smooth" });
    });
  }

  function navigate(page, options) {
    document.querySelectorAll(".page").forEach((item) => {
      const active = item.id === "pg-" + page;
      item.classList.toggle("active", active);
      item.hidden = !active;
    });
    document.querySelectorAll(".nav-item").forEach((button) => {
      const active = button.dataset.pg === page;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    if (!options?.keepScroll) window.scrollTo(0, 0);

    if (page === "wordbook") {
      if (getDictionaryService()) {
        renderWordbook();
      } else {
        document
          .getElementById("wb-list")
          ?.replaceChildren(createEmptyState("正在准备词典", "马上就好"));
        getDictionaryReady()?.then(() => {
          if (!document.getElementById("pg-wordbook")?.hidden) {
            renderWordbook();
          }
        });
      }
    }
    if (page === "quiz") renderQuiz({ getWordbook, speak });
    if (page === "templates") {
      renderTemplates({ speak, learnSentence: learnTemplateSentence });
    }
    if (page === "settings") renderSettings();

    if (options?.focusHeading !== false) {
      const heading = document.querySelector(`#pg-${page} h1`);
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    }
  }

  function setup() {
    document.querySelectorAll(".nav-item").forEach((button) => {
      button.addEventListener("click", () => navigate(button.dataset.pg));
    });
    document
      .getElementById("brand-home-btn")
      ?.addEventListener("click", () => navigate("home"));
  }

  return { navigate, setup };
}
