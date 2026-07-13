import { WORDBOOK_KEY, readStoredJson, writeStoredJson } from "./storage.js";

export const REVIEW_DAY_MS = 24 * 60 * 60 * 1000;
export const REVIEW_INTERVALS = [0, 1, 2, 4, 7, 30];
export const REVIEW_RESULTS = new Set(["know", "unsure", "forgot"]);

function masteryForLevel(level) {
  if (level >= 5) return "mastered";
  if (level >= 3) return "reviewing";
  if (level >= 1) return "learning";
  return "new";
}

export function normalizeWordbookItem(item) {
  const word = String(item?.w || item?.word || "")
    .toLowerCase()
    .trim();
  if (!word) return null;
  const level = Math.max(0, Math.min(5, Number(item?.level || 0)));
  const reviewHistory = Array.isArray(item?.reviewHistory)
    ? item.reviewHistory
        .map((review) => ({
          at: Number(review?.at || 0),
          result: String(review?.result || ""),
        }))
        .filter((review) => review.at > 0 && REVIEW_RESULTS.has(review.result))
        .slice(-20)
    : [];
  return {
    w: word,
    m: String(item?.m || item?.meaning || ""),
    t: Number(item?.t || item?.createdAt || Date.now()),
    sourceSentence: String(item?.sourceSentence || ""),
    correct: Math.max(0, Number(item?.correct || 0)),
    wrong: Math.max(0, Number(item?.wrong || 0)),
    lastReviewedAt: item?.lastReviewedAt ? Number(item.lastReviewedAt) : null,
    level,
    mastery: ["new", "learning", "reviewing", "mastered"].includes(
      item?.mastery,
    )
      ? item.mastery
      : masteryForLevel(level),
    intervalDays: Math.max(0, Number(item?.intervalDays || 0)),
    nextReviewAt: Math.max(0, Number(item?.nextReviewAt || 0)),
    lastResult: REVIEW_RESULTS.has(item?.lastResult) ? item.lastResult : "",
    reviewHistory,
  };
}

export function normalizeWordbook(value) {
  const raw = Array.isArray(value) ? value : [];
  const byWord = new Map();
  for (const item of raw) {
    const normalized = normalizeWordbookItem(item);
    if (!normalized) continue;
    const existing = byWord.get(normalized.w);
    if (!existing) {
      byWord.set(normalized.w, normalized);
      continue;
    }
    byWord.set(normalized.w, mergeWordbookItem(existing, normalized));
  }
  return Array.from(byWord.values()).sort((a, b) => (b.t || 0) - (a.t || 0));
}

export function mergeWordbookItem(existing, incoming) {
  const latest =
    (incoming.lastReviewedAt || 0) >= (existing.lastReviewedAt || 0)
      ? incoming
      : existing;
  return {
    ...existing,
    ...incoming,
    m: incoming.m || existing.m,
    sourceSentence: incoming.sourceSentence || existing.sourceSentence,
    correct: Math.max(existing.correct || 0, incoming.correct || 0),
    wrong: Math.max(existing.wrong || 0, incoming.wrong || 0),
    level: Math.max(existing.level || 0, incoming.level || 0),
    lastReviewedAt:
      Math.max(existing.lastReviewedAt || 0, incoming.lastReviewedAt || 0) ||
      null,
    mastery:
      latest.mastery ||
      masteryForLevel(Math.max(existing.level || 0, incoming.level || 0)),
    intervalDays: latest.intervalDays || 0,
    nextReviewAt: latest.nextReviewAt || 0,
    lastResult: latest.lastResult || "",
    reviewHistory: [
      ...(existing.reviewHistory || []),
      ...(incoming.reviewHistory || []),
    ]
      .sort((a, b) => a.at - b.at)
      .filter(
        (review, index, items) =>
          index === 0 ||
          review.at !== items[index - 1].at ||
          review.result !== items[index - 1].result,
      )
      .slice(-20),
    t: existing.t || incoming.t || Date.now(),
  };
}

export function getWordbook() {
  return normalizeWordbook(readStoredJson(WORDBOOK_KEY, []));
}

export function saveWordbook(wordbook) {
  return writeStoredJson(WORDBOOK_KEY, normalizeWordbook(wordbook));
}

export function isStarred(word) {
  const key = String(word || "").toLowerCase();
  return getWordbook().some((item) => item.w === key);
}

export function updateWordbookItem(word, updater) {
  const key = String(word || "")
    .toLowerCase()
    .trim();
  if (!key) return null;
  const wb = getWordbook();
  const index = wb.findIndex((item) => item.w === key);
  if (index < 0) return null;
  wb[index] = normalizeWordbookItem(updater(wb[index])) || wb[index];
  saveWordbook(wb);
  return wb[index];
}

export function updateStarredMeaning(word, meaning) {
  if (!word || !meaning) return;
  updateWordbookItem(word, (item) => ({ ...item, m: item.m || meaning }));
}

export function toggleStar(word, meaning, sourceSentence = "") {
  const key = String(word || "")
    .toLowerCase()
    .trim();
  if (!key) return false;
  const wb = getWordbook();
  const index = wb.findIndex((item) => item.w === key);
  if (index >= 0) {
    wb.splice(index, 1);
    saveWordbook(wb);
    return false;
  }
  wb.push(
    normalizeWordbookItem({
      w: key,
      m: meaning,
      t: Date.now(),
      sourceSentence,
      correct: 0,
      wrong: 0,
      lastReviewedAt: null,
      level: 0,
      mastery: "new",
      intervalDays: 0,
      nextReviewAt: 0,
      lastResult: "",
      reviewHistory: [],
    }),
  );
  saveWordbook(wb);
  return true;
}

export function removeWord(word) {
  const key = String(word || "").toLowerCase();
  saveWordbook(getWordbook().filter((item) => item.w !== key));
}

export function clearWordbookItems() {
  saveWordbook([]);
}

export function recordQuizAnswer(word, isCorrect, now = Date.now()) {
  return recordReviewFeedback(word, isCorrect ? "know" : "forgot", now);
}

export function recordReviewFeedback(word, result, now = Date.now()) {
  if (!REVIEW_RESULTS.has(result)) return null;
  return updateWordbookItem(word, (item) => {
    const level = Math.max(
      0,
      Math.min(
        5,
        (item.level || 0) +
          (result === "know" ? 1 : result === "forgot" ? -1 : 0),
      ),
    );
    const intervalDays =
      result === "forgot"
        ? 10 / 1440
        : result === "unsure"
          ? 1
          : REVIEW_INTERVALS[level] || 30;
    const history = [...(item.reviewHistory || []), { at: now, result }].slice(
      -20,
    );
    return {
      ...item,
      correct: (item.correct || 0) + (result === "know" ? 1 : 0),
      wrong: (item.wrong || 0) + (result === "know" ? 0 : 1),
      level,
      mastery: masteryForLevel(level),
      intervalDays,
      nextReviewAt: now + intervalDays * REVIEW_DAY_MS,
      lastReviewedAt: now,
      lastResult: result,
      reviewHistory: history,
    };
  });
}

export function getDueWords(wordbook = getWordbook(), now = Date.now()) {
  return normalizeWordbook(wordbook)
    .filter((item) => !item.nextReviewAt || item.nextReviewAt <= now)
    .sort(
      (a, b) =>
        (a.nextReviewAt || 0) - (b.nextReviewAt || 0) ||
        (a.t || 0) - (b.t || 0),
    );
}

export function getReviewSummary(wordbook = getWordbook(), now = Date.now()) {
  const items = normalizeWordbook(wordbook);
  return {
    total: items.length,
    due: getDueWords(items, now).length,
    mastered: items.filter((item) => item.mastery === "mastered").length,
  };
}

export function validateImportedWordbook(value) {
  if (!Array.isArray(value))
    return { ok: false, error: "导入文件必须是数组格式" };
  const normalized = normalizeWordbook(value);
  if (!normalized.length && value.length)
    return { ok: false, error: "没有找到有效的单词项目" };
  return { ok: true, items: normalized };
}

export function mergeImportedWordbook(current, imported) {
  return normalizeWordbook([...(current || []), ...(imported || [])]);
}

export function exportWordbookJson() {
  return JSON.stringify(getWordbook(), null, 2);
}

export async function importWordbookFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const validation = validateImportedWordbook(parsed);
  if (!validation.ok) return validation;
  const merged = mergeImportedWordbook(getWordbook(), validation.items);
  saveWordbook(merged);
  return { ok: true, items: merged };
}
