# OpenAI Build Week 2026 · Classroom Relay evidence

## Submission identity

- Project: Lucia's Dictionary
- Category: Education
- Build Week extension: Classroom Relay / 课堂接力
- Extension version: 3.1.0
- Implementation date: July 15, 2026
- Feature commit: `880077b feat: add Classroom Relay learning missions`
- Production deployment: Cloudflare Pages production deployment sourced from `880077b`
- Production URL: <https://dict.luciaandrayna.com>
- Codex `/feedback` Session ID: `019f675a-a32d-7eb0-9e13-4d4df7cd9969`
- Repository license: Apache-2.0
- Devpost registration: completed July 15, 2026
- $100 Codex Credits request: submitted July 15, 2026; approval pending
- YouTube demo: <https://www.youtube.com/watch?v=FZw5PjDj8Uo>

## What existed before the submission period

The v3.0.0 project already supported English and Chinese sentence input, optional OCR, local-first word cards, phonetics, browser speech, a local wordbook, lightweight spaced review, and vocabulary quizzes.

These capabilities are useful infrastructure, but they did not decide what a child should learn from a sentence, preserve multiple classroom encounters, or carry the original sentence through a complete learning activity.

## What was added during Build Week

Classroom Relay is a new learning unit built around a real sentence from the child's classroom:

1. An explainable recommendation engine selects up to five words using review state, due dates, the last know/unsure/forgot result, mastery, learning band, and prior encounters.
2. Every selected word shows a plain-language recommendation reason.
3. A mission rotates through listening identification, meaning recall, and a cloze in the original sentence.
4. Starting a mission records the real source sentence for each selected word without uploading it.
5. Completing a mission updates the existing review schedule and stores a bounded local mission record.
6. The result card identifies learned and weak words and gives the parent one immediate follow-up prompt.
7. The wordbook shows how many classroom sources and encounters are attached to a learned word.

## Product decision record

The feature deliberately does not generate homework answers, create a child account, send learning events to analytics, or introduce a new runtime AI request. The recommendation and practice loop run locally and remain explainable to a parent. Codex was used to inspect the existing architecture, design the scoring and persistence model, implement the vertical slice, add tests, and verify mobile behavior.

## Demo path

Use this sentence in the public demo:

> Plants need sunlight and water to grow.

Then show:

1. the generated word cards;
2. the Classroom Relay recommendation reasons;
3. a listening question;
4. the cloze `Plants need sunlight and _____ to grow.`;
5. the completion and parent handoff card;
6. the wordbook's classroom-source memory.

This path can be demonstrated in under 90 seconds and does not require an account or seeded server data.

## Verification record

The implementation was verified through:

- 17 unit-test files with 97 passing tests;
- 1 Cloudflare runtime test file with 6 passing tests;
- 7 mobile Chromium end-to-end tests, including the complete Classroom Relay path;
- Astro type checking and production build;
- lexicon, SEO, OCR sample, translation quality, and offline audits;
- Cloudflare binding type validation and Pages Functions compilation;
- dependency audit with zero moderate-or-higher vulnerabilities;
- manual 390 × 844 mobile-browser review with no console errors.

## Final submission checklist

- [x] Register for OpenAI Build Week on Devpost.
- [x] Submit the $100 Codex Credits request before the July 17 deadline; approval is pending.
- [x] Run `/feedback` in the current Codex task and add the Session ID above and to Devpost.
- [x] Commit the extension with a dated message that names Classroom Relay.
- [x] Push the repository and confirm the public or reviewer-accessible URL.
- [x] License the public repository under Apache-2.0.
- [x] Deploy v3.1.0 and run the demo path on the production URL.
- [x] Record and upload the under-three-minute YouTube demo with audio.
- [x] Verify the YouTube video is Public and add the link to Devpost.
- [x] Copy the pre-existing/new-work distinction into the Devpost project description.
