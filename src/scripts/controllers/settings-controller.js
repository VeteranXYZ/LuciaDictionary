import { clearLookupCaches, setSetting } from "../storage.js";
import { updateDailyStreak } from "../streak.js";

export function createSettingsController({ getDictionaryCount }) {
  const speeds = [
    ["慢速", "slow"],
    ["正常", "normal"],
  ];
  const repeats = [1, 3, 5];

  function render(state) {
    const speedOptions = document.getElementById("speed-options");
    const repeatOptions = document.getElementById("repeat-options");
    if (!speedOptions || !repeatOptions) return;

    speedOptions.replaceChildren(
      ...speeds.map(([label, value]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className =
          "set-btn" + (state.settings.speed === value ? " active" : "");
        button.dataset.speed = value;
        button.textContent = label;
        button.setAttribute(
          "aria-pressed",
          String(state.settings.speed === value),
        );
        button.addEventListener("click", () => setSetting("speed", value));
        return button;
      }),
    );

    repeatOptions.replaceChildren(
      ...repeats.map((value) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className =
          "set-btn" + (state.settings.repeat === value ? " active" : "");
        button.dataset.repeat = value;
        button.textContent = `${value} 遍`;
        button.setAttribute(
          "aria-pressed",
          String(state.settings.repeat === value),
        );
        button.addEventListener("click", () => setSetting("repeat", value));
        return button;
      }),
    );

    const dictCount = document.getElementById("dict-count");
    if (dictCount)
      dictCount.textContent = getDictionaryCount().toLocaleString();
    const wordbookCount = document.getElementById("about-wb-count");
    if (wordbookCount) {
      wordbookCount.textContent = state.wordbookSummary.total.toLocaleString();
    }
  }

  function setup() {
    const clearCacheButton = document.getElementById("clear-cache-btn");
    clearCacheButton?.addEventListener("click", () => {
      clearLookupCaches();
      clearCacheButton.textContent = "已清除";
      setTimeout(() => {
        clearCacheButton.textContent = "清除缓存";
      }, 1200);
    });

    const streakLabel = document.getElementById("streak-label");
    if (!streakLabel) return;
    try {
      const streak = updateDailyStreak();
      streakLabel.textContent = `连续 ${streak.count} 天`;
    } catch {
      streakLabel.textContent = "连续 1 天";
    }
  }

  return { render, setup };
}
