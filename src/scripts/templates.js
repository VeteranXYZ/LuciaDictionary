import { normalizePhrasebookEntry } from "./translation.js";
import { SPEAKER_SVG, BOOK_SVG } from "./ui.js";
import { CLASSROOM_TEMPLATE_GROUPS } from "../data/classroom-templates.js";

export const TEMPLATES = CLASSROOM_TEMPLATE_GROUPS;

export const TPL_ICONS = {
  homework:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>',
  reading:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  writing:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>',
  math: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="12" y1="5" x2="12" y2="11"/><line x1="8" y1="16" x2="16" y2="16"/><line x1="8" y1="19" x2="16" y2="19"/></svg>',
  science:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v7.31"/><path d="M14 9.3V2"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M5.52 16h12.96"/></svg>',
  classroom:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><circle cx="9" cy="9" r="0.5" fill="currentColor"/><circle cx="9" cy="13" r="0.5" fill="currentColor"/></svg>',
};

let activeTplCat = 0;

function appendListSection(parent, className, title, items, render) {
  if (!items.length) return;
  const section = document.createElement("div");
  section.className = className;
  const heading = document.createElement("strong");
  heading.textContent = title;
  const list = document.createElement("ul");
  for (const item of items) {
    const li = document.createElement("li");
    render(li, item);
    list.appendChild(li);
  }
  section.append(heading, list);
  parent.appendChild(section);
}

// The classroom data already carries步骤、关键词 and sample replies for the
// richer entries; they used to be generated into the phrasebook and then never
// shown to anyone.
export function buildTemplateDetails(item, id) {
  const steps = item.stepsZh.length ? item.stepsZh : item.steps;
  if (!steps.length && !item.keywords.length && !item.childReply.length) {
    return null;
  }

  const details = document.createElement("details");
  details.className = "tpl-details";
  const summary = document.createElement("summary");
  summary.textContent = "怎么做 · 关键词 · 可以这样回答";
  summary.id = `tpl-summary-${id}`;
  details.appendChild(summary);

  const body = document.createElement("div");
  body.className = "tpl-details-body";

  appendListSection(body, "tpl-steps", "怎么做", steps, (li, step) => {
    li.textContent = step;
  });

  appendListSection(
    body,
    "tpl-keywords",
    "关键词",
    item.keywords,
    (li, keyword) => {
      const word = document.createElement("b");
      word.textContent = keyword.word;
      li.append(word);
      if (keyword.cn) li.append(document.createTextNode(` · ${keyword.cn}`));
    },
  );

  appendListSection(
    body,
    "tpl-replies",
    "可以这样回答",
    item.childReply,
    (li, reply) => {
      const en = document.createElement("b");
      en.textContent = reply.en;
      li.append(en);
      if (reply.cn) li.append(document.createTextNode(` · ${reply.cn}`));
    },
  );

  details.appendChild(body);
  return details;
}

// The generated phrasebook carries步骤/关键词/回答 for every classroom line the
// tab list shows. Matching on the English text lets this page use that content
// without duplicating it into the source template file.
let enrichmentIndex = null;

export function buildEnrichmentIndex(phrasebook) {
  const index = new Map();
  for (const entry of phrasebook || []) {
    const key = String(entry?.en || "")
      .toLowerCase()
      .trim();
    if (key && !index.has(key)) index.set(key, normalizePhrasebookEntry(entry));
  }
  return index;
}

export function enrichTemplateEntry(item, index) {
  const match = index?.get(item.en.toLowerCase().trim());
  if (!match) return item;
  return {
    ...item,
    steps: item.steps.length ? item.steps : match.steps,
    stepsZh: item.stepsZh.length ? item.stepsZh : match.stepsZh,
    keywords: item.keywords.length ? item.keywords : match.keywords,
    childReply: item.childReply.length ? item.childReply : match.childReply,
  };
}

export function resetTemplateEnrichment() {
  enrichmentIndex = null;
}

export function renderTemplates({ speak, learnSentence, loadEnrichment }) {
  const tabs = document.getElementById("tpl-tabs");
  const list = document.getElementById("tpl-list");
  if (!tabs || !list) return;

  if (!enrichmentIndex && loadEnrichment) {
    // Render immediately from local data, then fill in the details once the
    // lazily loaded phrasebook arrives.
    loadEnrichment().then((phrasebook) => {
      if (enrichmentIndex || !phrasebook?.length) return;
      enrichmentIndex = buildEnrichmentIndex(phrasebook);
      if (!document.getElementById("pg-templates")?.hidden) {
        renderTemplates({ speak, learnSentence });
      }
    });
  }

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
      renderTemplates({ speak, learnSentence, loadEnrichment });
    });
    tabs.appendChild(btn);
  });

  list.replaceChildren();
  TEMPLATES[activeTplCat].items.forEach((rawItem, index) => {
    const item = enrichTemplateEntry(
      normalizePhrasebookEntry(rawItem, TEMPLATES[activeTplCat].cat),
      enrichmentIndex,
    );
    const div = document.createElement("div");
    div.className = "tpl-item";

    const en = document.createElement("div");
    en.className = "en";
    en.textContent = item.en;
    const cn = document.createElement("div");
    cn.className = "cn";
    cn.textContent = item.cn;
    const details = buildTemplateDetails(item, `${activeTplCat}-${index}`);
    const actions = document.createElement("div");
    actions.className = "actions";

    const speakBtn = document.createElement("button");
    speakBtn.className = "btn-action moss spk-btn";
    speakBtn.innerHTML = SPEAKER_SVG + "<span>朗读</span>";
    speakBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      speak(item.en);
    });

    const learnBtn = document.createElement("button");
    learnBtn.className = "btn-action honey learn-btn";
    learnBtn.innerHTML = BOOK_SVG + "<span>学习单词</span>";
    learnBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      learnSentence(item.en);
    });

    actions.append(speakBtn, learnBtn);
    div.append(en, cn, actions);
    if (details) div.appendChild(details);
    list.appendChild(div);
  });
}
