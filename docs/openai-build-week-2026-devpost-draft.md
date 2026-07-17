# OpenAI Build Week 2026 · Devpost submission draft

## Submission fields

- **Project name:** Lucia's Dictionary · Classroom Relay
- **Track:** Education
- **Tagline:** Turn today's classroom sentence into tonight's personalized micro-lesson.
- **Website:** <https://dict.luciaandrayna.com>
- **Repository:** <https://github.com/VeteranXYZ/LuciaDictionary>
- **Demo video:** pending public YouTube URL
- **Codex `/feedback` Session ID:** `019f675a-a32d-7eb0-9e13-4d4df7cd9969`
- **Codex model:** confirm the model displayed for the current task before naming it in Devpost or the video
- **Codex credits request:** submitted July 15, 2026

## Credits request form · 2–3 sentence idea

Lucia's Dictionary helps Chinese-speaking families understand the English sentences children actually encounter in elementary-school classrooms. During Build Week, I am using Codex to add Classroom Relay, an explainable local learning loop that selects the words a child most needs, practices them inside the original sentence, schedules future review, and gives the parent one immediate follow-up prompt. The project is mobile-first, requires no child account, and keeps learning history in the browser.

## Short description

Lucia's Dictionary turns a real classroom sentence into a private, adaptive micro-lesson. Instead of generating homework answers or teaching isolated vocabulary, Classroom Relay explains which words deserve attention, practices them through listening and original-context recall, remembers where the child encountered them, and helps a parent continue the lesson at home.

## Inspiration

Children in bilingual families often bring home English classroom instructions, reading prompts, and science sentences that their parents cannot confidently explain. Translation tools can translate the text, flashcard apps teach isolated words, and homework assistants often jump directly to answers. We wanted a tool that preserves the child's real classroom context and helps the family learn from it without replacing the child's work.

## What it does

A parent or child types, pastes, photographs, or uploads an English classroom sentence. Lucia's Dictionary creates local word cards with Chinese meanings, phonetics, learning bands, and speech.

The new Classroom Relay flow then:

1. selects up to five words using the child's local review state;
2. explains every recommendation, such as “new word,” “due today,” “unsure last time,” or “forgot last time”;
3. rotates through listening, meaning recall, and a cloze in the original classroom sentence;
4. updates the spaced-review schedule after completion;
5. remembers multiple real classroom sentences for each word; and
6. creates one simple parent-child follow-up prompt.

No account is required. Wordbook data, mission results, source sentences, review history, and recommendations stay in the current browser.

## How we built it

The interface is an Astro 7 static application written in JavaScript and CSS. A compact local lexicon contains 10,574 English entries with Chinese meanings, forms, phonetics, and broad learning bands. Browser speech synthesis provides pronunciation, `localStorage` stores learning state, and a generated Service Worker keeps the core English flow available offline.

Optional photo OCR uses a same-origin Cloudflare Pages Function. The function validates file type and signatures, applies request limits and timeouts, keeps the OCR key server-side, and never logs image contents or recognized classroom text.

Classroom Relay itself is deterministic and explainable. Its priority engine combines due status, the last know/unsure/forgot result, mastery level, learning band, and repeated classroom encounters. This keeps the child-facing learning decision understandable and avoids adding a new runtime AI dependency or uploading learning history.

## How we used Codex

Codex was used as an engineering collaborator throughout the Build Week extension. It inspected the existing repository and learning model, helped narrow the product concept from a generic “AI vocabulary task” into a classroom-to-home learning relay, designed the explainable recommendation rules and backward-compatible source-sentence model, implemented the complete vertical slice, added unit and mobile end-to-end tests, and verified the production experience at a 390 × 844 mobile viewport.

The human product decisions remained explicit: do not generate homework answers, do not create child accounts, do not send learning events to analytics, and keep the recommendation system visible to parents instead of presenting it as a black box.

The `/feedback` Session ID is recorded above. Before submission, confirm the exact Codex model shown for this task.

## Challenges we ran into

The biggest challenge was adding meaningful personalization without weakening the project's privacy and offline constraints. A cloud-generated lesson would have been easier to market as “AI,” but it would introduce child-content transmission, cost, latency, and unpredictable output. We instead built an explainable local ranking engine and reused the child's actual classroom sentence as the learning context.

We also needed to extend an existing wordbook without breaking old exported data. The new model migrates legacy single-source sentences into a bounded multi-source encounter history while preserving existing mastery, scheduling, and import behavior.

## Accomplishments that we're proud of

- The new feature forms a complete learning loop instead of adding an isolated screen.
- Every personalized recommendation has a visible reason.
- Practice returns to the exact sentence the child encountered at school.
- The parent receives an immediate, usable follow-up prompt rather than a complex dashboard.
- The feature adds no new child account or learning-data network flow.
- The release passes 97 unit tests, 6 Cloudflare runtime tests, and 7 mobile end-to-end tests.
- The local OCR audit sample retains 100% dictionary coverage with no online fallback.

## What we learned

Personalization is more useful when a family can understand why a word was selected. We also learned that the strongest use of Codex was not producing more code; it was helping connect existing OCR, dictionary, speech, review, offline, and testing systems into one coherent product experience while preserving the project's constraints.

## What's next

Next we want to evaluate whether children complete due reviews and whether practicing a word inside its original sentence improves later recall. Possible extensions include spelling and dictation, better confusion-based distractors, and a seven-day parent summary. Account sync, generated explanations, and speech scoring will only be considered after a separate child-privacy and content-safety review.

## Built with

- Codex
- Astro 7
- JavaScript and CSS
- Cloudflare Pages and Pages Functions
- Web Speech API
- Service Worker and Cache API
- `localStorage`
- Vitest and Playwright
- OCR.Space for optional user-triggered OCR

## Public demo script · target 2:35

### 0:00–0:18 · The problem

**Narration:**

> Children in bilingual families bring home English sentences their parents may not feel confident explaining. Translation gives the meaning, and homework assistants give the answer, but neither turns that real classroom moment into learning.

**Screen:** Show the Lucia's Dictionary home page on a mobile viewport.

### 0:18–0:38 · Real classroom input

**Narration:**

> Lucia's Dictionary starts with the sentence the child actually encountered. I can type it, paste it, or photograph it. Let's use: “Plants need sunlight and water to grow.”

**Screen:** Enter the demo sentence and select the purple analyze button. Briefly show word cards, Chinese meanings, phonetics, and speech.

### 0:38–1:00 · Explainable personalization

**Narration:**

> Classroom Relay looks at the local wordbook, review dates, mastery, and previous “know, unsure, or forgot” feedback. It selects up to five words and explains every choice. There is no hidden child profile and no learning history is uploaded.

**Screen:** Scroll to the Classroom Relay preview and pause on the recommendation reasons.

### 1:00–1:35 · Contextual practice

**Narration:**

> The mission rotates through listening, meaning recall, and the most important step: putting the word back into the original classroom sentence.

**Screen:** Start the mission. Show one listening question, one meaning question, and the cloze: `Plants need sunlight and _____ to grow.` Use quick edits between questions if necessary; do not make the viewer watch every transition.

### 1:35–1:58 · Learning result

**Narration:**

> Results update the existing spaced-review schedule. The child sees what was learned and what still needs practice, and the parent gets one simple question they can use immediately at home.

**Screen:** Show the completion card, “needs review” area, parent prompt, and original sentence.

### 1:58–2:15 · Classroom memory

**Narration:**

> Each learned word remembers the real classroom sentences where it appeared, so future review comes from the child's own experience instead of a generic curriculum.

**Screen:** Open the wordbook and show the classroom source count on one card.

### 2:15–2:35 · Codex and close

**Narration:**

> I used Codex to understand the existing codebase, design the explainable learning model, implement the vertical slice, add automated tests, and verify the mobile production experience. Lucia does not do the homework. It helps the child and parent understand it, practice it, and remember it together.

**Screen:** Return to the Classroom Relay card, then finish on the product name and production URL.

## Recording checklist

- Keep the final video under three minutes.
- Record at a mobile-sized viewport with readable zoom.
- Include spoken audio covering both Codex and the confirmed event model.
- Do not use copyrighted background music or third-party trademarks without permission.
- Show the public production URL working, not a static mockup.
- Upload as a publicly visible YouTube video that judges can open without signing in.
