import { normalizePhrasebookEntry } from "./translation.js";
import { SPEAKER_SVG, BOOK_SVG } from "./ui.js";

export const TPL_ICONS = {
  homework: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>',
  reading: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  writing: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>',
  math: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="12" y1="5" x2="12" y2="11"/><line x1="8" y1="16" x2="16" y2="16"/><line x1="8" y1="19" x2="16" y2="19"/></svg>',
  science: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v7.31"/><path d="M14 9.3V2"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M5.52 16h12.96"/></svg>',
  classroom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><circle cx="9" cy="9" r="0.5" fill="currentColor"/><circle cx="9" cy="13" r="0.5" fill="currentColor"/></svg>'
};

export const TEMPLATES = [
  { cat: "作业类", iconKey: "homework", items: [
    rich("Complete the worksheet.", "完成练习单。", ["找到 worksheet", "按题目顺序完成", "完成后交给老师"], [["complete", "完成"], ["worksheet", "练习单"]]),
    rich("Show your work.", "写出你的解题过程。", ["不要只写答案", "把每一步怎么算写出来"], [["show", "展示/写出"], ["work", "解题过程"]]),
    ["Turn in your homework.", "交上你的家庭作业。"],
    ["Do problems 1 through 10.", "做第1题到第10题。"],
    ["Finish the assignment by Friday.", "在周五之前完成作业。"],
    ["Write your name on the top of the page.", "在页面顶部写上你的名字。"],
    ["Use complete sentences.", "使用完整的句子。"],
    ["Check your answers before turning in.", "交之前检查你的答案。"],
    ["Follow the directions carefully.", "仔细按照指示操作。"],
    ["This is due tomorrow.", "这个明天要交。"],
    ["Make sure your work is neat and legible.", "确保你的作业整洁可读。"]
  ]},
  { cat: "阅读类", iconKey: "reading", items: [
    rich("Read the passage and answer the questions.", "阅读文章并回答问题。", ["先读短文", "再看问题", "回到文章里找答案"], [["read", "阅读"], ["passage", "短文"], ["answer", "回答"]]),
    ["Underline the main idea.", "在主旨句下面画线。"],
    ["Circle the correct answer.", "圈出正确答案。"],
    ["Find the topic sentence.", "找到主题句。"],
    ["Read pages 20 to 35.", "阅读第20页到第35页。"],
    ["Summarize the story in your own words.", "用你自己的话总结这个故事。"],
    ["What is the main idea of this paragraph?", "这段话的主要意思是什么？"],
    ["Compare and contrast the two characters.", "比较两个角色的异同。"],
    ["Make a prediction about what will happen next.", "预测接下来会发生什么。"]
  ]},
  { cat: "写作类", iconKey: "writing", items: [
    ["Write a paragraph about your topic.", "围绕你的主题写一段话。"],
    ["Edit your draft for spelling and grammar.", "检查你的草稿的拼写和语法。"],
    ["Write a rough draft first.", "先写一篇草稿。"],
    ["Include a topic sentence.", "包含一个主题句。"],
    ["Use transition words.", "使用过渡词。"],
    ["Revise your essay.", "修改你的文章。"],
    ["Brainstorm ideas before you start writing.", "写之前先进行头脑风暴。"],
    ["Add more details to support your opinion.", "添加更多细节来支持你的观点。"]
  ]},
  { cat: "数学类", iconKey: "math", items: [
    ["Solve the equation.", "解这个等式。"],
    ["Round to the nearest ten.", "四舍五入到最接近的十位数。"],
    ["Show your work step by step.", "逐步写出你的解题过程。"],
    ["Estimate the answer first.", "先估算一下答案。"],
    ["Find the area and perimeter.", "求面积和周长。"],
    ["Reduce the fraction to lowest terms.", "把分数化简到最简形式。"],
    ["Plot the points on the graph.", "在图表上标出这些点。"],
    ["What is the sum of these numbers?", "这些数字的和是多少？"],
    ["Convert the fraction to a decimal.", "把分数转换成小数。"]
  ]},
  { cat: "科学类", iconKey: "science", items: [
    ["Record your observations.", "记录你的观察结果。"],
    ["Label the diagram.", "标注这个图表。"],
    ["Write a hypothesis.", "写一个假设。"],
    ["What did you conclude from the experiment?", "你从实验中得出了什么结论？"],
    ["Describe the steps of the experiment.", "描述实验的步骤。"],
    ["Draw and label the parts of a plant.", "画出并标注植物的各个部分。"],
    ["List the materials you need.", "列出你需要的材料。"],
    ["Predict what will happen.", "预测会发生什么。"]
  ]},
  { cat: "课堂行为", iconKey: "classroom", items: [
    rich("Raise your hand before speaking.", "说话之前先举手。", ["先举手", "等老师叫到你", "再说话"], [["raise", "举起"], ["hand", "手"], ["speaking", "说话"]]),
    ["Line up quietly.", "安静地排队。"],
    ["Take out your notebook.", "拿出你的笔记本。"],
    ["Put your materials away.", "把你的东西收好。"],
    ["Pay attention.", "注意听讲。"],
    ["Work with your partner.", "和你的搭档一起做。"],
    ["Take turns.", "轮流来。"],
    ["Keep your hands to yourself.", "管好你自己的手。"],
    ["Clean up your desk.", "整理你的桌子。"],
    ["Walk, don't run, in the hallway.", "在走廊里要走，不要跑。"],
    ["Eyes on me.", "看着我/注意看这里。"],
    ["Please be seated.", "请坐下。"],
    ["You may go to the restroom.", "你可以去洗手间了。"],
    ["Bring your signed permission slip.", "带上你家长签名的许可单。"]
  ]}
];

let activeTplCat = 0;

export function renderTemplates({ speak, learnSentence }) {
  const tabs = document.getElementById("tpl-tabs");
  const list = document.getElementById("tpl-list");
  if (!tabs || !list) return;

  tabs.replaceChildren();
  TEMPLATES.forEach((cat, index) => {
    const btn = document.createElement("button");
    btn.className = "tpl-tab" + (index === activeTplCat ? " active" : "");
    btn.innerHTML = TPL_ICONS[cat.iconKey];
    const span = document.createElement("span");
    span.textContent = cat.cat;
    btn.appendChild(span);
    btn.addEventListener("click", () => {
      activeTplCat = index;
      renderTemplates({ speak, learnSentence });
    });
    tabs.appendChild(btn);
  });

  list.replaceChildren();
  TEMPLATES[activeTplCat].items.forEach(rawItem => {
    const item = normalizePhrasebookEntry(rawItem, TEMPLATES[activeTplCat].cat);
    const div = document.createElement("div");
    div.className = "tpl-item";

    const en = document.createElement("div");
    en.className = "en";
    en.textContent = item.en;
    const cn = document.createElement("div");
    cn.className = "cn";
    cn.textContent = item.cn;
    const actions = document.createElement("div");
    actions.className = "actions";

    const speakBtn = document.createElement("button");
    speakBtn.className = "btn-action moss spk-btn";
    speakBtn.innerHTML = SPEAKER_SVG + "<span>朗读</span>";
    speakBtn.addEventListener("click", event => {
      event.stopPropagation();
      speak(item.en);
    });

    const learnBtn = document.createElement("button");
    learnBtn.className = "btn-action honey learn-btn";
    learnBtn.innerHTML = BOOK_SVG + "<span>学习单词</span>";
    learnBtn.addEventListener("click", event => {
      event.stopPropagation();
      learnSentence(item.en);
    });

    actions.append(speakBtn, learnBtn);
    div.append(en, cn, actions);
    list.appendChild(div);
  });
}

function rich(en, cn, steps, keywordPairs) {
  return {
    en,
    cn,
    steps,
    keywords: keywordPairs.map(([word, meaning]) => ({ word, cn: meaning }))
  };
}
