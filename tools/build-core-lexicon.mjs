import fs from "node:fs";

const required = JSON.parse(fs.readFileSync("tools/required-core-words.json", "utf8"));
const oldDict = JSON.parse(fs.readFileSync("public/assets/dict.json", "utf8"));
const phonetics = JSON.parse(fs.existsSync("public/assets/phonetics.json") ? fs.readFileSync("public/assets/phonetics.json", "utf8") : "{}");
const phrasebook = JSON.parse(fs.existsSync("public/assets/phrasebook.json") ? fs.readFileSync("public/assets/phrasebook.json", "utf8") : "[]");

const TARGET_CORE_COUNT = 3200;
const TARGET_PHRASE_COUNT = 320;

const curatedCore = {
  address: ["地址；住址；写地址；正式讲话", "where someone lives or where something is sent", "noun / verb", "A2", ["daily", "school", "form", "website"], ["addresses", "addressed", "addressing"], "Write your address on the form.", "把你的地址写在表格上。"],
  activity: ["活动；练习活动", "something you do for learning or fun", "noun", "A1", ["school", "worksheet", "daily"], ["activities"], "Complete the activity on page two.", "完成第二页的活动。"],
  thing: ["东西；事情", "an object, idea, or action", "noun", "A1", ["daily", "story"], ["things"], "Put your things in your backpack.", "把你的东西放进书包。"],
  fun: ["有趣的；乐趣", "something that makes you happy", "noun / adjective", "A1", ["daily", "social"], [], "The science lab was fun.", "科学实验室很有趣。"],
  lab: ["实验室", "a room for science work", "noun", "A2", ["science", "school"], [], "We went to the science lab.", "我们去了科学实验室。"],
  inbox: ["收件箱", "the place where new messages arrive", "noun", "B1", ["website", "ui"], [], "Check your inbox for the school email.", "查看收件箱里的学校邮件。"],
  privacy: ["隐私", "information about you that should be protected", "noun", "B1", ["website", "form", "safety"], [], "Read the privacy notice with a parent.", "和家长一起读隐私说明。"],
  policy: ["政策；规则", "a rule or plan from a school or website", "noun", "B1", ["website", "school_notice"], ["policies"], "The privacy policy explains the rules.", "隐私政策解释这些规则。"],
  support: ["支持；帮助", "help someone do something", "noun / verb", "A2", ["daily", "school", "social"], ["supports", "supported", "supporting"], "Teachers support students.", "老师支持学生。"],
  supportive: ["支持的；给人帮助的", "kind and helpful", "adjective", "B1", ["emotion", "social"], [], "A supportive friend listens to you.", "支持你的朋友会听你说话。"],
  thoughtful: ["体贴的；考虑周到的", "kind and thinking about other people", "adjective", "B1", ["emotion", "social"], [], "That was a thoughtful answer.", "那是一个考虑周到的回答。"],
  adventurous: ["爱冒险的；有探索精神的", "ready to try new things", "adjective", "B1", ["story", "personality"], [], "The adventurous child followed the map.", "爱冒险的孩子跟着地图走。"],
  energetic: ["精力充沛的", "full of energy", "adjective", "A2", ["emotion", "personality"], [], "The energetic class ran outside.", "精力充沛的班级跑到外面。"],
  exciting: ["令人兴奋的", "making you feel happy and interested", "adjective", "A2", ["story", "daily"], [], "The field trip was exciting.", "校外活动令人兴奋。"],
  resource: ["资源；资料", "something that helps you learn or work", "noun", "B1", ["school", "website", "academic"], ["resources"], "Use the resource to answer the question.", "用这个资料回答问题。"],
  journey: ["旅程；经历", "a trip or a long learning experience", "noun", "A2", ["story", "academic"], ["journeys"], "The story is about a long journey.", "这个故事讲一次长途旅程。"],
  creature: ["生物；动物", "a living animal or being", "noun", "A2", ["science", "story"], ["creatures"], "A tiny creature lived in the woods.", "一个小生物住在树林里。"],
  challenge: ["挑战；难题", "something hard that you try to do", "noun / verb", "B1", ["school", "story", "academic"], ["challenges", "challenged", "challenging"], "We can face challenges together.", "我们可以一起面对挑战。"],
  clue: ["线索", "something that helps you find an answer", "noun", "A2", ["reading", "story"], ["clues"], "Find a clue in the passage.", "在文章里找一个线索。"],
  treasure: ["宝藏；珍贵的东西", "something valuable or special", "noun", "A2", ["story"], ["treasures"], "The map led to treasure.", "地图通向宝藏。"],
  forest: ["森林", "a large place with many trees", "noun", "A2", ["science", "story"], ["forests"], "The creature walked into the forest.", "那个生物走进森林。"],
  woods: ["树林", "a small forest", "noun", "A2", ["story", "child"], [], "They played near the woods.", "他们在树林附近玩。"],
  guide: ["指南；导游；指导", "a person or thing that helps you know what to do", "noun / verb", "A2", ["school", "website"], ["guides", "guided", "guiding"], "Use the guide to finish the activity.", "用指南完成活动。"],
  tip: ["建议；小提示", "a small helpful idea", "noun", "A2", ["school", "website"], ["tips"], "Read the tips before you start.", "开始前读一读小提示。"],
  favorite: ["最喜欢的", "liked the most", "adjective / noun", "A1", ["daily", "school"], ["favorites"], "What is your favorite book?", "你最喜欢哪本书？"],
  subscribe: ["订阅", "ask to get messages or updates", "verb", "B1", ["website"], ["subscribes", "subscribed", "subscribing"], "Subscribe with a parent if needed.", "需要时和家长一起订阅。"],
  contact: ["联系；联系人", "talk to someone by email, phone, or message", "noun / verb", "A2", ["website", "school_notice"], ["contacts", "contacted", "contacting"], "Contact the office for help.", "联系办公室寻求帮助。"],
  email: ["电子邮件；发邮件", "a message sent on a computer or phone", "noun / verb", "A1", ["website", "form", "school_notice"], ["emails", "emailed", "emailing"], "Write your email on the form.", "在表格上写你的电子邮件。"],
  parent: ["家长；父母之一", "a mother, father, or guardian", "noun", "A1", ["school", "form"], ["parents"], "Ask a parent to sign the paper.", "请家长签这张纸。"],
  birthday: ["生日", "the day someone was born", "noun", "A1", ["daily", "form"], ["birthdays"], "Write your birthday on the form.", "在表格上写生日。"],
  height: ["身高；高度", "how tall someone or something is", "noun", "A2", ["form", "math", "science"], [], "Measure your height in centimeters.", "用厘米量你的身高。"],
  centimeter: ["厘米", "a small unit for measuring length", "noun", "A2", ["math", "science"], ["centimeters"], "The line is five centimeters long.", "这条线长五厘米。"],
  chaperone: ["陪同家长；校外活动陪同人", "an adult who helps watch students on a trip", "noun", "B1", ["school_notice", "field_trip"], ["chaperones"], "A chaperone will help on the field trip.", "陪同家长会在校外活动中帮忙。"]
};

const extraWords = {
  page: "页", worksheet: "练习单", assignment: "作业；任务", passage: "文章；段落", evidence: "证据",
  compare: "比较", contrast: "对比", estimate: "估算", observe: "观察", record: "记录",
  conclusion: "结论", permission: "许可；允许", signature: "签名", field: "场地；领域", trip: "旅行；校外活动",
  dismissal: "放学；解散", folder: "文件夹", backpack: "书包", supplies: "学习用品", main: "主要的",
  idea: "想法；主意", character: "人物；角色", setting: "故事背景", problem: "问题；难题", solution: "解决办法",
  paragraph: "段落", sentence: "句子", punctuation: "标点", revise: "修改", edit: "编辑；修改",
  draft: "草稿", explain: "解释", describe: "描述", summarize: "总结", predict: "预测",
  analyze: "分析", identify: "识别；找出", complete: "完成", answer: "答案；回答", question: "问题",
  circle: "圈出；圆圈", underline: "划线", label: "标签；标注", match: "配对；匹配", solve: "解答",
  latest: "最新的；最近的", strong: "强壮的；强的", stronger: "更强的；更坚强的", way: "方式；道路", term: "术语；学期；条款", aug: "八月（缩写）"
};

const phraseSeeds = {
  "email address": ["电子邮件地址", "the address used to send email", ["website", "form"], "Write your email address.", "写下你的电子邮件地址。"],
  "privacy policy": ["隐私政策", "rules about how information is protected", ["website", "safety"], "Read the privacy policy with a parent.", "和家长一起阅读隐私政策。"],
  "give up": ["放弃", "stop trying", ["story", "social"], "Do not give up when it is hard.", "困难时不要放弃。"],
  "face challenges": ["面对挑战", "deal with hard things bravely", ["school", "story"], "We face challenges together.", "我们一起面对挑战。"],
  "grow together": ["一起成长", "learn and improve with others", ["social"], "Friends can grow together.", "朋友可以一起成长。"],
  "stay in the loop": ["及时了解消息", "keep getting updates", ["website", "school_notice"], "Stay in the loop with school news.", "及时了解学校消息。"],
  "learn more": ["了解更多", "get more information", ["website", "ui"], "Tap learn more.", "点击了解更多。"],
  "view all": ["查看全部", "see everything in a list", ["website", "ui"], "Tap view all.", "点击查看全部。"],
  "show your work": ["写出解题过程", "write the steps you used", ["math", "worksheet"], "Show your work on the page.", "在页面上写出过程。"],
  "main idea": ["主要意思", "the most important idea", ["reading"], "Find the main idea.", "找出主要意思。"],
  "complete the activity": ["完成活动", "finish the learning task", ["worksheet", "school"], "Complete the activity.", "完成活动。"],
  "answer the questions": ["回答问题", "write or say the answers", ["worksheet"], "Answer the questions.", "回答问题。"],
  "field trip": ["校外活动", "a school trip outside the classroom", ["school_notice"], "Bring the form for the field trip.", "带上校外活动表格。"],
  "permission slip": ["许可单", "a form a parent signs for school", ["form", "school_notice"], "Return the permission slip.", "交回许可单。"],
  "parent signature": ["家长签名", "a parent's written name", ["form"], "A parent signature is required.", "需要家长签名。"],
  "take out": ["拿出", "remove something from a desk or bag", ["classroom"], "Take out your folder.", "拿出你的文件夹。"],
  "put away": ["收好", "put something back where it belongs", ["classroom"], "Put away your supplies.", "收好你的学习用品。"],
  "line up": ["排队", "stand in a line", ["classroom", "pe"], "Line up at the door.", "在门口排队。"],
  "raise your hand": ["举手", "lift your hand before speaking", ["classroom"], "Raise your hand before you speak.", "说话前请举手。"],
  "word bank": ["词库；词语表", "a list of words to use", ["worksheet", "writing"], "Use the word bank.", "使用词语表。"],
  "number line": ["数轴", "a line that shows numbers in order", ["math"], "Use the number line.", "使用数轴。"],
  "complete sentence": ["完整句", "a sentence with a full idea", ["writing"], "Write a complete sentence.", "写一个完整句。"],
  "rock pool": ["岩石水洼；潮池", "a small pool of water near rocks", ["science", "story"], "The creature lived in a rock pool.", "那个生物住在岩石水洼里。"],
  "social studies": ["社会学习课", "school lessons about people and places", ["school"], "We have social studies today.", "今天我们有社会学习课。"],
  "science lab": ["科学实验室", "a room for science activities", ["science"], "Meet in the science lab.", "在科学实验室集合。"],
  "terms of use": ["使用条款", "rules for using a website or app", ["website", "ui"], "Read the terms of use with a parent.", "和家长一起阅读使用条款。"],
  "all rights reserved": ["版权所有", "a short notice that a website owns its work", ["website"], "The footer says all rights reserved.", "页脚写着版权所有。"]
};

const tagRules = [
  [/school|class|teacher|student|homework|worksheet|assignment|folder|backpack|supply|supplies|page|answer|question/, "school"],
  [/math|number|add|sum|subtract|multiply|divide|measure|centimeter|graph|solve|estimate/, "math"],
  [/science|plant|animal|lab|observe|record|experiment|weather|rock|energy/, "science"],
  [/read|story|passage|character|setting|main|idea|evidence|summary|clue|forest|woods|creature/, "reading"],
  [/write|sentence|paragraph|punctuation|revise|edit|draft|describe|explain/, "writing"],
  [/email|privacy|policy|subscribe|contact|inbox|website|account|address/, "website"],
  [/parent|permission|signature|form|dismissal|chaperone|field|trip/, "school_notice"],
  [/friend|kind|support|feeling|happy|sad|thoughtful|energetic|favorite/, "social"]
];

function levelForRank(rank) {
  if (rank <= 900) return "A1";
  if (rank <= 1900) return "A2";
  if (rank <= 2850) return "B1";
  return "B2";
}

function guessTags(word, cn, extra = []) {
  const text = `${word} ${cn}`;
  const tags = new Set(extra);
  for (const [re, tag] of tagRules) if (re.test(text)) tags.add(tag);
  if (!tags.size) tags.add("daily");
  return Array.from(tags).slice(0, 5);
}

function formsFor(word) {
  const forms = new Set();
  if (word.endsWith("y") && word.length > 2 && !/[aeiou]y$/.test(word)) forms.add(word.slice(0, -1) + "ies");
  else if (/(s|x|z|ch|sh)$/.test(word)) forms.add(word + "es");
  else forms.add(word + "s");
  if (word.endsWith("e")) {
    forms.add(word + "d");
    forms.add(word.slice(0, -1) + "ing");
  } else {
    forms.add(word + "ed");
    forms.add(word + "ing");
  }
  return Array.from(forms).filter(item => item !== word && item.length > 2);
}

function addCore(target, word, data, rank) {
  const key = word.toLowerCase();
  if (!/^[a-z][a-z-]*$/.test(key)) return;
  if (target[key]) return;
  const cn = Array.isArray(data) ? data[0] : String(data || "");
  const simple = Array.isArray(data) ? data[1] : "";
  const pos = Array.isArray(data) ? data[2] : "";
  const level = Array.isArray(data) ? data[3] : levelForRank(rank);
  const tags = Array.isArray(data) ? data[4] : guessTags(key, cn);
  const forms = Array.isArray(data) ? data[5] : formsFor(key);
  const exampleEn = Array.isArray(data) ? data[6] : `Read the word ${key}.`;
  const exampleCn = Array.isArray(data) ? data[7] : `读单词 ${key}。`;
  target[key] = {
    word: key,
    cn,
    simple,
    pos,
    phonetic: phonetics[key] || "",
    forms: forms.filter(form => form && form !== key),
    level,
    rank,
    tags,
    examples: [{ en: exampleEn, cn: exampleCn }]
  };
}

function addPhrase(target, phrase, data) {
  const key = phrase.toLowerCase();
  if (target[key]) return;
  target[key] = {
    phrase: key,
    cn: data[0],
    simple: data[1] || "",
    tags: data[2] || ["school"],
    examples: [{ en: data[3] || phrase, cn: data[4] || data[0] }]
  };
}

const core = {};
let rank = 1;
for (const [word, data] of Object.entries(curatedCore)) addCore(core, word, data, rank++);
for (const [word, cn] of Object.entries(extraWords)) addCore(core, word, [cn, "", "", "A2", guessTags(word, cn), formsFor(word), `Use ${word} in your work.`, `在作业中使用 ${word}。`], rank++);

for (const word of required.words) {
  const base = word.toLowerCase();
  if (core[base]) continue;
  const singular = base.endsWith("ies") ? base.slice(0, -3) + "y" : base.endsWith("s") ? base.slice(0, -1) : base;
  if (core[singular]) continue;
  addCore(core, base, oldDict[base] || "常用词", rank++);
}

for (const [word, cn] of Object.entries(oldDict)) {
  if (Object.keys(core).length >= TARGET_CORE_COUNT) break;
  addCore(core, word, cn, rank++);
}

const phrases = {};
for (const [phrase, data] of Object.entries(phraseSeeds)) addPhrase(phrases, phrase, data);
for (const entry of phrasebook) {
  if (Object.keys(phrases).length >= TARGET_PHRASE_COUNT) break;
  if (!entry?.en || !entry?.cn) continue;
  addPhrase(phrases, entry.en, [entry.cn, entry.steps?.[0] || "", [entry.cat, entry.scene].filter(Boolean).map(item => String(item).toLowerCase().replace(/\s+/g, "_")), entry.en, entry.cn]);
}

const extraPhraseBases = [
  "school office", "reading log", "classroom rules", "quiet voice", "kind words", "learning goal",
  "story map", "topic sentence", "first draft", "final copy", "math problem", "science journal",
  "library book", "lunch money", "water bottle", "school notice", "emergency card", "home folder",
  "answer box", "spelling words", "vocabulary list", "reading passage", "text evidence", "story setting",
  "character trait", "problem and solution", "compare and contrast", "summary sentence", "activity page",
  "online account", "contact information", "birthday party", "class party", "dismissal time", "bus note",
  "home address", "phone number", "website link", "parent email", "teacher note", "safety rule",
  "group work", "partner talk", "turn and talk", "share ideas", "ask for help", "try again",
  "do your best", "stay safe", "school supplies", "art project", "field day", "picture day",
  "book report", "word problem", "number sentence", "place value", "reading group", "science activity",
  "writing prompt", "worksheet page", "permission form", "signed paper", "take turns", "clean up",
  "line leader", "class helper", "lost and found", "nurse office", "playground rules", "quiet area",
  "learning resources", "helpful tips", "favorite book", "exciting journey", "hidden treasure", "forest path",
  "tiny creature", "big challenge", "important clue", "supportive friend"
];
for (const phrase of extraPhraseBases) {
  if (Object.keys(phrases).length >= TARGET_PHRASE_COUNT) break;
  addPhrase(phrases, phrase, [`${phrase}（常用短语）`, "", guessTags(phrase, ""), `Read the phrase: ${phrase}.`, `读这个短语：${phrase}。`]);
}

for (const [word, entry] of Object.entries(core)) {
  entry.forms = (entry.forms || []).filter(form => form !== word && !core[form]);
}

fs.writeFileSync("public/assets/core-lexicon.json", JSON.stringify(core, null, 2) + "\n");
fs.writeFileSync("public/assets/phrase-lexicon.json", JSON.stringify(phrases, null, 2) + "\n");
console.log(`core entries: ${Object.keys(core).length}`);
console.log(`phrase entries: ${Object.keys(phrases).length}`);
