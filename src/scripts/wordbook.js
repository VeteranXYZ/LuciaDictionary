import {
  WORDBOOK_KEY,
  readStoredJson,
  writeStoredJson,
  subscribeStorage,
  withStorageLock,
} from "./storage.js";
import { MASTERY_STATES } from "./learning-labels.js";

export const WORDBOOK_SAVE_ERROR =
  "未能保存学习记录。请检查浏览器存储空间和网站数据权限，然后重试。";
export const REVIEW_DAY_MS = 24 * 60 * 60 * 1000;
export const REVIEW_INTERVALS = [0, 1, 2, 4, 7, 30];
export const REVIEW_RESULTS = new Set(["know", "unsure", "forgot"]);

function masteryForLevel(level) {
  if (level >= 5) return "mastered";
  if (level >= 3) return "reviewing";
  if (level >= 1) return "learning";
  return "new";
}

function normalizeSourceSentences(item) {
  const sources = Array.isArray(item?.sourceSentences)
    ? item.sourceSentences
    : [];
  const legacy = String(item?.sourceSentence || "").trim();
  const normalized = sources
    .map((source) => ({
      text: String(source?.text || source || "").trim(),
      firstSeenAt: Math.max(0, Number(source?.firstSeenAt || item?.t || 0)),
      lastSeenAt: Math.max(0, Number(source?.lastSeenAt || item?.t || 0)),
      count: Math.max(1, Number(source?.count || 1)),
    }))
    .filter((source) => source.text);
  if (legacy && !normalized.some((source) => source.text === legacy)) {
    normalized.push({
      text: legacy,
      firstSeenAt: Math.max(0, Number(item?.t || 0)),
      lastSeenAt: Math.max(0, Number(item?.t || 0)),
      count: 1,
    });
  }
  return normalized.sort((a, b) => b.lastSeenAt - a.lastSeenAt).slice(0, 12);
}

function mergeSourceSentences(existing = [], incoming = []) {
  const byText = new Map();
  for (const source of [...existing, ...incoming]) {
    if (!source?.text) continue;
    const current = byText.get(source.text);
    if (!current) {
      byText.set(source.text, { ...source });
      continue;
    }
    const firstSeenValues = [current.firstSeenAt, source.firstSeenAt].filter(
      (value) => value > 0,
    );
    byText.set(source.text, {
      text: source.text,
      firstSeenAt: firstSeenValues.length ? Math.min(...firstSeenValues) : 0,
      lastSeenAt: Math.max(current.lastSeenAt || 0, source.lastSeenAt || 0),
      count: Math.max(current.count || 1, source.count || 1),
    });
  }
  return Array.from(byText.values())
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    .slice(0, 12);
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
  const sourceSentences = normalizeSourceSentences(item);
  return {
    w: word,
    m: String(item?.m || item?.meaning || "")
      .split("；")
      .filter((part) => !part.endsWith("中文释义暂时不可用"))
      .join("；"),
    t: Number(item?.t || item?.createdAt || Date.now()),
    sourceSentence: String(
      item?.sourceSentence || sourceSentences[0]?.text || "",
    ),
    sourceSentences,
    correct: Math.max(0, Number(item?.correct || 0)),
    wrong: Math.max(0, Number(item?.wrong || 0)),
    unsure: Math.max(0, Number(item?.unsure || 0)),
    lastReviewedAt: item?.lastReviewedAt ? Number(item.lastReviewedAt) : null,
    level,
    mastery: MASTERY_STATES.includes(item?.mastery)
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
  const sourceSentences = mergeSourceSentences(
    existing.sourceSentences,
    incoming.sourceSentences,
  );
  return {
    ...existing,
    ...incoming,
    m: incoming.m || existing.m,
    sourceSentence:
      sourceSentences[0]?.text ||
      incoming.sourceSentence ||
      existing.sourceSentence,
    sourceSentences,
    correct: Math.max(existing.correct || 0, incoming.correct || 0),
    wrong: Math.max(existing.wrong || 0, incoming.wrong || 0),
    unsure: Math.max(existing.unsure || 0, incoming.unsure || 0),
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

// getWordbook() sits on hot paths — every word card asks whether it is starred,
// so a sentence used to cost dozens of parse-and-normalize passes.
let wordbookCache = null;

subscribeStorage(({ key, external }) => {
  if (external && (key === WORDBOOK_KEY || key === null))
    invalidateWordbookCache();
});

export function invalidateWordbookCache() {
  wordbookCache = null;
}

export function getWordbook() {
  if (!wordbookCache) {
    wordbookCache = normalizeWordbook(readStoredJson(WORDBOOK_KEY, []));
  }
  // Callers splice and push into the result, so hand out a fresh array while
  // still sharing the (treated-as-immutable) item objects.
  return wordbookCache.slice();
}

export function saveWordbook(wordbook) {
  const normalized = normalizeWordbook(wordbook);
  wordbookCache = normalized;
  const written = writeStoredJson(WORDBOOK_KEY, normalized);
  if (!written) invalidateWordbookCache();
  return written;
}

function findCachedItem(word) {
  const key = String(word || "")
    .toLowerCase()
    .trim();
  if (!key) return null;
  if (!wordbookCache) getWordbook();
  return wordbookCache.find((item) => item.w === key) || null;
}

export function isStarred(word) {
  return Boolean(findCachedItem(word));
}

async function editWordbook(edit) {
  try {
    return await withStorageLock(WORDBOOK_KEY, () => {
      // Reload under the lock. A storage event from the previous writer may
      // still be queued while this tab is already handling the next click.
      invalidateWordbookCache();
      const words = getWordbook();
      const result = edit(words);
      return result != null && saveWordbook(words) ? result : null;
    });
  } catch {
    return null;
  }
}

export function updateStarredMeaning(word, meaning) {
  const existing = findCachedItem(word);
  if (!meaning || !existing || existing.m) return;
  return editWordbook((words) => {
    const index = words.findIndex((entry) => entry.w === existing.w);
    if (index < 0 || words[index].m) return null;
    words[index] = { ...words[index], m: meaning };
    return true;
  });
}

export function toggleStar(word, meaning, sourceSentence = "", desired) {
  const key = String(word || "")
    .toLowerCase()
    .trim();
  if (!key) return null;
  return editWordbook((words) => {
    const index = words.findIndex((item) => item.w === key);
    const add = desired ?? index < 0;
    if (add && index < 0)
      words.push(normalizeWordbookItem({ w: key, m: meaning, sourceSentence }));
    if (!add && index >= 0) words.splice(index, 1);
    return add;
  });
}

function applyEncounter(wb, word, meaning, sourceSentence, now) {
  const key = String(word || "")
    .toLowerCase()
    .trim();
  const sentence = String(sourceSentence || "").trim();
  if (!key || !sentence) return null;

  let index = wb.findIndex((item) => item.w === key);
  if (index < 0) {
    wb.push(
      normalizeWordbookItem({
        w: key,
        m: meaning,
        t: now,
      }),
    );
    index = wb.length - 1;
  }

  const item = wb[index];
  const existingSource = item.sourceSentences.find(
    (source) => source.text === sentence,
  );
  const nextSource = existingSource
    ? {
        ...existingSource,
        count: existingSource.count + 1,
        lastSeenAt: now,
      }
    : {
        text: sentence,
        firstSeenAt: now,
        lastSeenAt: now,
        count: 1,
      };
  wb[index] = normalizeWordbookItem({
    ...item,
    m: item.m || meaning,
    sourceSentence: sentence,
    sourceSentences: [
      nextSource,
      ...item.sourceSentences.filter((source) => source.text !== sentence),
    ],
  });
  return wb[index];
}

export function recordWordEncounter(
  word,
  meaning,
  sourceSentence,
  now = Date.now(),
) {
  return editWordbook((words) =>
    applyEncounter(words, word, meaning, sourceSentence, now),
  );
}

export function recordMissionEncounters(targets, sentence, now = Date.now()) {
  return editWordbook(
    (words) =>
      targets.every((target) =>
        applyEncounter(words, target.word, target.meaning, sentence, now),
      ) || null,
  );
}

export function removeWord(word) {
  return editWordbook((words) => {
    const index = words.findIndex((entry) => entry.w === word.toLowerCase());
    if (index >= 0) words.splice(index, 1);
    return true;
  });
}

export function clearWordbookItems() {
  return editWordbook((words) => {
    words.length = 0;
    return true;
  });
}

export function recordQuizAnswer(word, isCorrect, now = Date.now()) {
  return recordReviewFeedback(word, isCorrect ? "know" : "forgot", now);
}

function applyReview(words, word, result, now) {
  if (!REVIEW_RESULTS.has(result)) return null;
  const index = words.findIndex((entry) => entry.w === word.toLowerCase());
  if (index < 0) return null;
  const item = words[index];
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
  words[index] = {
    ...item,
    correct: (item.correct || 0) + (result === "know" ? 1 : 0),
    // "不确定" is its own answer, not a wrong one. Folding it into `wrong`
    // made the three-way feedback report as two-way.
    wrong: (item.wrong || 0) + (result === "forgot" ? 1 : 0),
    unsure: (item.unsure || 0) + (result === "unsure" ? 1 : 0),
    level,
    mastery: masteryForLevel(level),
    intervalDays,
    nextReviewAt: now + intervalDays * REVIEW_DAY_MS,
    lastReviewedAt: now,
    lastResult: result,
    reviewHistory: history,
  };
  return words[index];
}

export function recordReviewFeedback(word, result, now = Date.now()) {
  return editWordbook((words) => applyReview(words, word, result, now));
}

export function recordMissionReviews(results, now = Date.now()) {
  return editWordbook(
    (words) =>
      results.every((result) =>
        applyReview(
          words,
          result.word,
          result.correct ? "know" : "forgot",
          now,
        ),
      ) || null,
  );
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
    return { ok: false, error: "这不是有效的生词本备份文件" };
  const normalized = normalizeWordbook(value);
  if (!normalized.length && value.length)
    return { ok: false, error: "备份文件中没有找到可导入的单词" };
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
  const merged = await editWordbook((words) => {
    const items = mergeImportedWordbook(words, validation.items);
    words.length = 0;
    for (const item of items) words.push(item);
    return items;
  });
  return merged
    ? { ok: true, items: merged }
    : { ok: false, error: WORDBOOK_SAVE_ERROR };
}
