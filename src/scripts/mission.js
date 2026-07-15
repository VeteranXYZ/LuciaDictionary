import { readStoredJson, writeStoredJson } from "./storage.js";

export const MISSION_HISTORY_KEY = "lucia-classroom-missions-v1";
export const MISSION_TYPES = ["listen", "meaning", "cloze"];
export const MAX_MISSION_TARGETS = 5;
export const MAX_MISSION_HISTORY = 20;

function normalizeWord(value) {
  return String(value || "")
    .toLowerCase()
    .trim();
}

function bandBonus(band) {
  return { foundation: 3, developing: 2, expanding: 1 }[band] || 0;
}

function encounterCount(item) {
  return (item?.sourceSentences || []).reduce(
    (total, source) => total + Math.max(1, Number(source?.count || 1)),
    0,
  );
}

export function explainCandidatePriority(candidate, item, now = Date.now()) {
  if (!item) {
    return {
      score: 55 + bandBonus(candidate.band),
      reason: "这是这句话里的新词",
      reasonCode: "new",
    };
  }

  const repeated = encounterCount(item);
  const repeatBonus = Math.min(6, Math.max(0, repeated - 1) * 2);
  if (item.lastResult === "forgot") {
    return {
      score: 90 + repeatBonus + bandBonus(candidate.band),
      reason: "上次选择了“忘记”",
      reasonCode: "forgot",
    };
  }
  if (item.lastResult === "unsure") {
    return {
      score: 80 + repeatBonus + bandBonus(candidate.band),
      reason: "上次还不确定",
      reasonCode: "unsure",
    };
  }
  if (item.nextReviewAt && item.nextReviewAt <= now) {
    return {
      score: 70 + repeatBonus + bandBonus(candidate.band),
      reason: "已经到了复习时间",
      reasonCode: "due",
    };
  }
  if (repeated > 1) {
    return {
      score: 64 + repeatBonus + bandBonus(candidate.band),
      reason: `已经在课堂内容中遇到 ${repeated} 次`,
      reasonCode: "repeated",
    };
  }
  if (item.mastery === "mastered") {
    return {
      score: 10 + bandBonus(candidate.band),
      reason: "最近已经掌握，用原句巩固",
      reasonCode: "mastered",
    };
  }
  if (item.level > 0) {
    return {
      score: 60 + bandBonus(candidate.band),
      reason: "还在学习中",
      reasonCode: "learning",
    };
  }
  return {
    score: 65 + bandBonus(candidate.band),
    reason: "已收藏，今天适合开始学习",
    reasonCode: "saved",
  };
}

export function selectMissionTargets(
  candidates,
  wordbook = [],
  { now = Date.now(), maxTargets = MAX_MISSION_TARGETS } = {},
) {
  const byWord = new Map(
    (wordbook || []).map((item) => [normalizeWord(item?.w), item]),
  );
  const seen = new Set();
  return (candidates || [])
    .map((candidate, index) => ({
      word: normalizeWord(candidate?.word || candidate?.w),
      meaning: String(candidate?.meaning || candidate?.m || "").trim(),
      band: String(candidate?.band || ""),
      index,
    }))
    .filter((candidate) => {
      if (!candidate.word || !candidate.meaning || seen.has(candidate.word))
        return false;
      seen.add(candidate.word);
      return true;
    })
    .map((candidate) => ({
      ...candidate,
      ...explainCandidatePriority(candidate, byWord.get(candidate.word), now),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(1, maxTargets))
    .map(({ index, ...target }) => target);
}

function shuffle(items, random) {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function createClozeText(sentence, word) {
  const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, "i");
  return String(sentence || "").replace(pattern, "_____");
}

function buildOptions(answer, pool, random) {
  const distractors = shuffle(
    pool.filter((item) => item.word !== answer),
    random,
  )
    .slice(0, 3)
    .map((item) => item.word);
  return shuffle([answer, ...distractors], random);
}

export function createMissionQuestions(
  targets,
  sentence,
  answerPool = [],
  random = Math.random,
) {
  const poolMap = new Map();
  for (const item of [...(targets || []), ...(answerPool || [])]) {
    const word = normalizeWord(item?.word || item?.w);
    const meaning = String(item?.meaning || item?.m || "").trim();
    if (word && meaning && !poolMap.has(word)) {
      poolMap.set(word, { word, meaning });
    }
  }
  const pool = Array.from(poolMap.values());

  return (targets || []).map((target, index) => {
    const type = MISSION_TYPES[index % MISSION_TYPES.length];
    const options = buildOptions(target.word, pool, random);
    return {
      id: `${index + 1}-${target.word}`,
      type,
      word: target.word,
      meaning: target.meaning,
      prompt:
        type === "meaning"
          ? `“${target.meaning}”对应哪个英文词？`
          : type === "cloze"
            ? createClozeText(sentence, target.word)
            : "听发音，选出正确的单词",
      options,
    };
  });
}

export function createLearningMission({
  sentence,
  candidates,
  wordbook = [],
  now = Date.now(),
  maxTargets = MAX_MISSION_TARGETS,
  random = Math.random,
}) {
  const targets = selectMissionTargets(candidates, wordbook, {
    now,
    maxTargets,
  });
  if (!String(sentence || "").trim() || !targets.length) return null;
  return {
    id: `mission-${now}`,
    sentence: String(sentence).trim(),
    createdAt: now,
    targets,
    questions: createMissionQuestions(
      targets,
      sentence,
      [...(candidates || []), ...(wordbook || [])],
      random,
    ),
  };
}

export function summarizeMission(mission, results = []) {
  const correct = results.filter((result) => result.correct).length;
  const needsReview = results
    .filter((result) => !result.correct)
    .map((result) => result.word);
  const learned = results
    .filter((result) => result.correct)
    .map((result) => result.word);
  const focus =
    needsReview[0] || learned[0] || mission?.targets?.[0]?.word || "";
  const focusTarget = mission?.targets?.find((target) => target.word === focus);
  return {
    total: results.length,
    correct,
    learned,
    needsReview,
    parentPrompt: focusTarget
      ? `请问孩子：“${focusTarget.word} 是什么意思？”然后一起读一遍原句。`
      : "请和孩子一起读一遍今天的课堂原句。",
  };
}

export function saveMissionResult(mission, results, completedAt = Date.now()) {
  const history = readStoredJson(MISSION_HISTORY_KEY, []);
  const entry = {
    id: mission.id,
    sentence: mission.sentence,
    createdAt: mission.createdAt,
    completedAt,
    targets: mission.targets.map((target) => target.word),
    results: results.map((result) => ({
      word: result.word,
      correct: Boolean(result.correct),
    })),
  };
  writeStoredJson(
    MISSION_HISTORY_KEY,
    [entry, ...(Array.isArray(history) ? history : [])]
      .filter(
        (item, index, items) =>
          items.findIndex((candidate) => candidate.id === item.id) === index,
      )
      .slice(0, MAX_MISSION_HISTORY),
  );
  return entry;
}

export function getMissionHistory() {
  const history = readStoredJson(MISSION_HISTORY_KEY, []);
  return Array.isArray(history) ? history.slice(0, MAX_MISSION_HISTORY) : [];
}
