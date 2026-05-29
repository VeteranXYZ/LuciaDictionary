import { readCache, writeCache, TRANSLATE_CACHE } from "./storage.js";

export const CHINESE_RE = /[\u3400-\u9fff]/;

export function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[，。！？、,.!?;；:："'“”‘’()（）]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

const TASK_INTENTS = [
  ["raise_hand", ["raise your hand", "raise my hand"], "Raise your hand before speaking.", "说话前先举手。", "raise your hand", "举手"],
  ["turn_in", ["turn in", "hand in"], "Give your work to the teacher.", "把作业交给老师。", "turn in", "交上"],
  ["take_out", ["take out"], "Take the item out of your backpack or desk.", "把东西从书包或桌子里拿出来。", "take out", "拿出"],
  ["put_away", ["put away"], "Put the item back where it belongs.", "把东西放回原处。", "put away", "收好"],
  ["line_up", ["line up"], "Stand in line quietly.", "安静排队。", "line up", "排队"],
  ["compare_contrast", ["compare and contrast"], "Tell what is the same and what is different.", "说出相同点和不同点。", "compare and contrast", "比较和对比"],
  ["circle", ["circle"], "Find the correct item.", "找到正确的项目。", "circle", "圈出"],
  ["underline", ["underline"], "Draw a line under the word or answer.", "在单词或答案下面画线。", "underline", "划线"],
  ["write", ["write"], "Write your answer neatly.", "工整写下答案。", "write", "写"],
  ["read", ["read"], "Read the words carefully.", "认真读文字。", "read", "读"],
  ["answer", ["answer"], "Write or say your answer.", "写出或说出答案。", "answer", "回答"],
  ["explain", ["explain"], "Tell why or how you know.", "说明为什么或你是怎么知道的。", "explain", "解释"],
  ["show", ["show"], "Show your work or your idea.", "展示过程或想法。", "show", "展示"],
  ["solve", ["solve"], "Work out the problem.", "解出题目。", "solve", "解答"],
  ["compare", ["compare"], "Tell how two things are the same or different.", "说出两个事物怎样相同或不同。", "compare", "比较"],
  ["contrast", ["contrast"], "Tell how two things are different.", "说出两个事物的不同。", "contrast", "对比"],
  ["describe", ["describe"], "Tell details about it.", "说出细节。", "describe", "描述"],
  ["summarize", ["summarize"], "Tell the main idea in a short way.", "简短说出主要意思。", "summarize", "总结"],
  ["predict", ["predict"], "Make a good guess about what will happen.", "猜一猜接下来会发生什么。", "predict", "预测"],
  ["estimate", ["estimate"], "Make a close guess before solving.", "先估算一个接近的答案。", "estimate", "估算"],
  ["draw", ["draw"], "Draw a picture or model.", "画图或模型。", "draw", "画"],
  ["label", ["label"], "Write the name next to the part.", "在部位旁写名称。", "label", "标注"],
  ["match", ["match"], "Connect the things that go together.", "把配对的内容连起来。", "match", "配对"],
  ["complete", ["complete"], "Finish all parts of the work.", "完成所有部分。", "complete", "完成"],
  ["listen", ["listen"], "Listen quietly and carefully.", "安静认真听。", "listen", "听"],
  ["discuss", ["discuss"], "Talk about your ideas with others.", "和别人讨论想法。", "discuss", "讨论"],
  ["share", ["share"], "Tell your idea to the class or group.", "把想法分享给全班或小组。", "share", "分享"],
  ["revise", ["revise"], "Make your writing better.", "修改文章，让它更好。", "revise", "修改"],
  ["edit", ["edit"], "Check spelling, punctuation, and grammar.", "检查拼写、标点和语法。", "edit", "编辑"],
  ["cut", ["cut"], "Cut on the line carefully.", "沿线小心剪。", "cut", "剪"],
  ["glue", ["glue"], "Put glue on the back and attach it.", "背面涂胶并贴上。", "glue", "粘"],
  ["color", ["color"], "Color the picture neatly.", "把图画涂整齐。", "color", "涂色"],
  ["fold", ["fold"], "Fold the paper on the line.", "沿线折纸。", "fold", "折"],
  ["sign", ["sign"], "Ask a parent to sign the paper.", "请家长签字。", "sign", "签字"],
  ["return", ["return"], "Bring the paper back to school.", "把纸带回学校。", "return", "交回"],
  ["bring", ["bring"], "Bring the item to school.", "把东西带到学校。", "bring", "带来"]
];

export function parseTaskIntent(text) {
  const value = String(text || "").toLowerCase().replace(/[.,!?;:]/g, " ");
  const padded = ` ${value.replace(/\s+/g, " ")} `;
  for (const [intent, phrases, step, stepZh, word, cn] of TASK_INTENTS) {
    if (phrases.some(phrase => padded.includes(` ${phrase} `))) {
      return {
        intent,
        steps: [step],
        stepsZh: [stepZh],
        keywords: [{ word, cn }]
      };
    }
  }
  return null;
}

export function normalizePhrasebookEntry(entry, fallbackCat = "") {
  if (Array.isArray(entry)) {
    return {
      id: "",
      en: String(entry[0] || ""),
      cn: String(entry[1] || ""),
      cat: fallbackCat,
      scene: "",
      speaker: "",
      intent: "",
      steps: [],
      stepsZh: [],
      keywords: [],
      childReply: [],
      difficulty: "easy"
    };
  }

  return {
    id: String(entry?.id || ""),
    en: String(entry?.en || ""),
    cn: String(entry?.cn || ""),
    cat: String(entry?.cat || fallbackCat || ""),
    scene: String(entry?.scene || ""),
    speaker: String(entry?.speaker || ""),
    intent: String(entry?.intent || ""),
    steps: Array.isArray(entry?.steps) ? entry.steps.map(String).filter(Boolean) : [],
    stepsZh: Array.isArray(entry?.stepsZh) ? entry.stepsZh.map(String).filter(Boolean) : [],
    keywords: Array.isArray(entry?.keywords)
      ? entry.keywords
          .map(item => ({ word: String(item?.word || ""), cn: String(item?.cn || "") }))
          .filter(item => item.word || item.cn)
      : [],
    childReply: Array.isArray(entry?.childReply)
      ? entry.childReply
          .map(item => ({ en: String(item?.en || ""), cn: String(item?.cn || "") }))
          .filter(item => item.en || item.cn)
      : [],
    difficulty: entry?.difficulty === "medium" ? "medium" : "easy"
  };
}

export function flattenPhrasebook(phrasebook, templateGroups = []) {
  const items = [];

  for (const entry of phrasebook || []) {
    const normalized = normalizePhrasebookEntry(entry);
    if (normalized.en || normalized.cn) items.push(normalized);
  }

  for (const group of templateGroups || []) {
    for (const item of group.items || []) {
      const normalized = normalizePhrasebookEntry(item, group.cat);
      if (!items.some(existing => normalizeText(existing.en) === normalizeText(normalized.en))) {
        items.push(normalized);
      }
    }
  }

  return items;
}

export function matchPhrasebook(text, phrasebook, templateGroups = []) {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  const allowLooseMatch = normalized.length >= 4;

  for (const item of flattenPhrasebook(phrasebook, templateGroups)) {
    const cn = normalizeText(item.cn);
    const en = normalizeText(item.en);
    const cnMatches = cn && (normalized === cn || (allowLooseMatch && (cn.includes(normalized) || normalized.includes(cn))));
    const enMatches = en && (normalized === en || (allowLooseMatch && (en.includes(normalized) || normalized.includes(en))));
    if (cnMatches || enMatches) return item;
  }

  return null;
}

export function findTemplateTranslation(text, phrasebook, templateGroups = []) {
  return matchPhrasebook(text, phrasebook, templateGroups)?.en || "";
}

export function buildSentenceExplanation({ raw, sentence, phrasebook, templateGroups, fallbackMeaning }) {
  const match = matchPhrasebook(raw, phrasebook, templateGroups) || matchPhrasebook(sentence, phrasebook, templateGroups);
  if (match) {
    return {
      sentenceMeaning: match.cn,
      taskSteps: match.stepsZh.length ? match.stepsZh : match.steps,
      keywords: match.keywords,
      childReply: match.childReply,
      intent: match.intent,
      source: "phrasebook"
    };
  }

  const intent = parseTaskIntent(sentence || raw);
  if (intent) {
    return {
      sentenceMeaning: fallbackMeaning || "",
      taskSteps: intent.stepsZh,
      keywords: intent.keywords,
      childReply: [],
      intent: intent.intent,
      source: "intent"
    };
  }

  return {
    sentenceMeaning: fallbackMeaning || "",
    taskSteps: [],
    keywords: [],
    source: fallbackMeaning ? "translation" : "none"
  };
}

export function createTranslationService({ dictService, phrasebook, templateGroups, enqueueNetwork }) {
  async function translateText(text, from, to) {
    const value = String(text || "").trim();
    if (!value) return "";

    const key = `${from}:${to}:${value}`;
    const cache = readCache(TRANSLATE_CACHE);
    if (cache[key]?.text) return cache[key].text;

    if ("Translator" in window && typeof window.Translator?.create === "function") {
      try {
        const translator = await window.Translator.create({ sourceLanguage: from, targetLanguage: to });
        const translated = String(await translator.translate(value)).trim();
        if (translated) {
          cache[key] = { text: translated, cachedAt: Date.now(), source: "browser" };
          writeCache(TRANSLATE_CACHE, cache);
          return translated;
        }
      } catch (e) {}
    }

    const url = "https://translate.googleapis.com/translate_a/single?client=gtx"
      + "&dt=t"
      + "&sl=" + encodeURIComponent(from)
      + "&tl=" + encodeURIComponent(to)
      + "&q=" + encodeURIComponent(value);
    const res = await enqueueNetwork(() => fetch(url));
    if (!res.ok) throw new Error("Translate request failed");
    const data = await res.json();
    const translated = Array.isArray(data?.[0])
      ? data[0].map(part => part?.[0] || "").join("").trim()
      : "";
    if (!translated) throw new Error("Translate response was empty");

    cache[key] = { text: translated, cachedAt: Date.now(), source: "online-fallback" };
    writeCache(TRANSLATE_CACHE, cache);
    return translated;
  }

  async function resolveChineseInput(raw) {
    const localTemplate = findTemplateTranslation(raw, phrasebook, templateGroups);
    if (localTemplate) {
      return {
        sentence: localTemplate,
        source: "template",
        explanation: buildSentenceExplanation({ raw, sentence: localTemplate, phrasebook, templateGroups, fallbackMeaning: raw })
      };
    }

    const localWords = dictService.reverseLookupChineseWords(raw);
    try {
      const sentence = await translateText(raw, "zh-CN", "en");
      return {
        sentence,
        source: "online",
        explanation: buildSentenceExplanation({ raw, sentence, phrasebook, templateGroups, fallbackMeaning: raw })
      };
    } catch (e) {
      if (localWords) {
        return {
          sentence: localWords,
          source: "local-words",
          explanation: buildSentenceExplanation({ raw, sentence: localWords, phrasebook, templateGroups, fallbackMeaning: raw })
        };
      }
      throw e;
    }
  }

  async function explainEnglishSentence(raw, sentence) {
    const local = buildSentenceExplanation({ raw, sentence, phrasebook, templateGroups, fallbackMeaning: "" });
    if (local.source === "phrasebook") return local;

    try {
      const fallbackMeaning = await translateText(sentence, "en", "zh-CN");
      return buildSentenceExplanation({ raw, sentence, phrasebook, templateGroups, fallbackMeaning });
    } catch (e) {
      return local;
    }
  }

  return {
    translateText,
    resolveChineseInput,
    explainEnglishSentence,
    findTemplateTranslation: text => findTemplateTranslation(text, phrasebook, templateGroups),
    matchPhrasebook: text => matchPhrasebook(text, phrasebook, templateGroups)
  };
}
