import { cancelPendingQuiz, renderQuiz, resetQuizSession } from "../quiz.js";
import { renderTemplates } from "../templates.js";
import { getWordbook } from "../wordbook.js";
import { createEmptyState } from "../ui.js";

export function createNavigationController({
  analyzeSentence,
  getDictionaryReady,
  getDictionaryService,
  loadPhrasebook,
  renderSettings,
  renderWordbook,
  speak,
}) {
  let currentPage = "home";

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

  function getNavButtons() {
    return Array.from(document.querySelectorAll(".nav-item"));
  }

  function navigate(page, options) {
    if (currentPage === "quiz" && page !== "quiz") cancelPendingQuiz();
    currentPage = page;

    document.querySelectorAll(".page").forEach((item) => {
      const active = item.id === "pg-" + page;
      item.classList.toggle("active", active);
      item.hidden = !active;
    });
    getNavButtons().forEach((button) => {
      const active = button.dataset.pg === page;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
      // Roving tabindex: a tablist is one Tab stop, and the arrow keys move
      // between the tabs inside it.
      button.tabIndex = active ? 0 : -1;
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
    if (page === "quiz") {
      // Each visit is its own round, so the score line matches what it says.
      resetQuizSession();
      renderQuiz({ getWordbook, speak });
    }
    if (page === "templates") {
      renderTemplates({
        speak,
        learnSentence: learnTemplateSentence,
        loadEnrichment: loadPhrasebook,
      });
    }
    if (page === "settings") renderSettings();

    if (options?.focusHeading !== false) {
      const heading = document.querySelector(`#pg-${page} .hero-title`);
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    }
  }

  function moveTabFocus(fromButton, step) {
    const buttons = getNavButtons();
    const index = buttons.indexOf(fromButton);
    if (index < 0) return;
    const next =
      buttons[(index + step + buttons.length) % buttons.length] || fromButton;
    next.focus();
    navigate(next.dataset.pg, { focusHeading: false });
  }

  function handleTabKeydown(event) {
    const button = event.currentTarget;
    const buttons = getNavButtons();
    const keys = {
      ArrowRight: () => moveTabFocus(button, 1),
      ArrowLeft: () => moveTabFocus(button, -1),
      ArrowDown: () => moveTabFocus(button, 1),
      ArrowUp: () => moveTabFocus(button, -1),
      Home: () => moveTabFocus(buttons[0], 0),
      End: () => moveTabFocus(buttons[buttons.length - 1], 0),
    };
    const handler = keys[event.key];
    if (!handler) return;
    event.preventDefault();
    handler();
  }

  function setup() {
    getNavButtons().forEach((button) => {
      button.addEventListener("click", () => navigate(button.dataset.pg));
      button.addEventListener("keydown", handleTabKeydown);
      button.tabIndex = button.classList.contains("active") ? 0 : -1;
    });
    document
      .getElementById("brand-home-btn")
      ?.addEventListener("click", () => navigate("home"));
  }

  return { navigate, setup };
}
