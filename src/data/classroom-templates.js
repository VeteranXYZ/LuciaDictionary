export const CLASSROOM_TEMPLATE_GROUPS = [
  {
    cat: "作业",
    iconKey: "homework",
    items: [
      rich(
        "Complete the worksheet.",
        "完成练习单。",
        ["找到 worksheet", "按题目顺序完成", "完成后交给老师"],
        [
          ["complete", "完成"],
          ["worksheet", "练习单"],
        ],
      ),
      rich(
        "Show your work.",
        "写出你的解题过程。",
        ["不要只写答案", "把每一步怎么算写出来"],
        [
          ["show", "展示/写出"],
          ["work", "解题过程"],
        ],
      ),
      ["Turn in your homework.", "交上你的家庭作业。"],
      ["Do problems 1 through 10.", "做第1题到第10题。"],
      ["Finish the assignment by Friday.", "在周五之前完成作业。"],
      ["Write your name on the top of the page.", "把名字写在页面上方。"],
      ["Use complete sentences.", "用完整的句子作答。"],
      ["Check your answers before turning in.", "交作业前检查一遍答案。"],
      ["Follow the directions carefully.", "仔细按照题目要求完成。"],
      ["This is due tomorrow.", "这个明天要交。"],
      ["Make sure your work is neat and legible.", "书写要整洁、清楚。"],
    ],
  },
  {
    cat: "阅读",
    iconKey: "reading",
    items: [
      rich(
        "Read the passage and answer the questions.",
        "阅读文章并回答问题。",
        ["先读短文", "再看问题", "回到文章里找答案"],
        [
          ["read", "阅读"],
          ["passage", "短文"],
          ["answer", "回答"],
        ],
      ),
      ["Underline the main idea.", "在主旨句下面画线。"],
      ["Circle the correct answer.", "圈出正确答案。"],
      ["Find the topic sentence.", "找到主题句。"],
      ["Read pages 20 to 35.", "阅读第 20 页到第 35 页。"],
      ["Summarize the story in your own words.", "用你自己的话总结这个故事。"],
      ["What is the main idea of this paragraph?", "这段话的主要意思是什么？"],
      ["Compare and contrast the two characters.", "比较两个角色的异同。"],
      [
        "Make a prediction about what will happen next.",
        "预测接下来会发生什么。",
      ],
    ],
  },
  {
    cat: "写作",
    iconKey: "writing",
    items: [
      ["Write a paragraph about your topic.", "围绕你的主题写一段话。"],
      ["Edit your draft for spelling and grammar.", "检查草稿中的拼写和语法。"],
      ["Write a rough draft first.", "先写一份初稿。"],
      ["Include a topic sentence.", "要写出主题句。"],
      ["Use transition words.", "使用过渡词。"],
      ["Revise your essay.", "修改你的文章。"],
      [
        "Brainstorm ideas before you start writing.",
        "动笔前，先想一想可以写什么。",
      ],
      [
        "Add more details to support your opinion.",
        "添加更多细节来支持你的观点。",
      ],
    ],
  },
  {
    cat: "数学",
    iconKey: "math",
    items: [
      ["Solve the equation.", "解这个方程。"],
      ["Round to the nearest ten.", "四舍五入到最接近的十位。"],
      ["Show your work step by step.", "逐步写出你的解题过程。"],
      ["Estimate the answer first.", "先估算一下答案。"],
      ["Find the area and perimeter.", "求面积和周长。"],
      ["Reduce the fraction to lowest terms.", "把分数约成最简分数。"],
      ["Plot the points on the graph.", "在坐标图上标出这些点。"],
      ["What is the sum of these numbers?", "这些数字的和是多少？"],
      ["Convert the fraction to a decimal.", "把分数转换成小数。"],
    ],
  },
  {
    cat: "科学",
    iconKey: "science",
    items: [
      ["Record your observations.", "记录你的观察结果。"],
      ["Label the diagram.", "给图示添加标注。"],
      ["Write a hypothesis.", "提出一个假设。"],
      [
        "What did you conclude from the experiment?",
        "你从实验中得出了什么结论？",
      ],
      ["Describe the steps of the experiment.", "描述实验的步骤。"],
      ["Draw and label the parts of a plant.", "画出并标注植物的各个部分。"],
      ["List the materials you need.", "列出你需要的材料。"],
      ["Predict what will happen.", "预测会发生什么。"],
    ],
  },
  {
    cat: "课堂习惯",
    iconKey: "classroom",
    items: [
      rich(
        "Raise your hand before speaking.",
        "说话之前先举手。",
        ["先举手", "等老师叫到你", "再说话"],
        [
          ["raise", "举起"],
          ["hand", "手"],
          ["speaking", "说话"],
        ],
      ),
      ["Line up quietly.", "安静地排队。"],
      ["Take out your notebook.", "拿出你的笔记本。"],
      ["Put your materials away.", "把你的东西收好。"],
      ["Pay attention.", "注意听讲。"],
      ["Work with your partner.", "和你的搭档一起做。"],
      ["Take turns.", "轮流来。"],
      ["Keep your hands to yourself.", "手不要碰别人或别人的东西。"],
      ["Clean up your desk.", "整理你的桌子。"],
      ["Walk, don't run, in the hallway.", "在走廊里要走，不要跑。"],
      ["Eyes on me.", "看老师这里。"],
      ["Please be seated.", "请坐下。"],
      ["You may go to the restroom.", "你可以去洗手间了。"],
      ["Bring your signed permission slip.", "带上家长签字的同意书。"],
    ],
  },
];

function rich(en, cn, steps, keywordPairs) {
  return {
    en,
    cn,
    steps,
    keywords: keywordPairs.map(([word, meaning]) => ({ word, cn: meaning })),
  };
}
