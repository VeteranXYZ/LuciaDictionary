# OpenAI Build Week 2026 · YouTube demo production script

## Final format

- Target runtime: **1:50**; acceptable range: 1:40–1:58
- Canvas: **1920 × 1080, 16:9**, 30 fps
- Narration: English, with burned-in English captions; optional smaller Chinese subtitles
- Product capture: public production site at <https://dict.luciaandrayna.com>
- Demo sentence: `Plants need sunlight and water to grow.`
- Music: light, warm, instrumental, mixed well below the narration
- Important: confirm that the Codex task UI identifies the required event model before recording the GPT-5.6 statement

## Shot-by-shot script

| Time      | Picture and edit                                                                                                                                                                                      | English narration                                                                                                                                                                 | On-screen text                                                                |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 0:00–0:08 | **Jimeng animation A.** Lucia arrives home with a classroom worksheet. Rayna looks at the plant-and-sun drawing with her. Slow push-in; no generated text.                                            | **One classroom sentence can follow a child all the way home. Translation explains it, but it does not turn that moment into learning.**                                          | `A classroom moment should not end at translation.`                           |
| 0:08–0:15 | **Jimeng transition B.** The worksheet becomes a few soft purple word cards, then match-cut to the real app on a phone.                                                                               | **Lucia's Dictionary turns that exact sentence into a private, personalized micro-lesson.**                                                                                       | Product logo + `Classroom Relay`                                              |
| 0:15–0:30 | **Real screen recording.** Show the production URL. Enter `Plants need sunlight and water to grow.` and tap Analyze. Pause briefly on the word cards, Chinese meanings, phonetics, and speech button. | **A child or parent can type, paste, or photograph the sentence. The app creates readable word cards with meanings, phonetics, and pronunciation.**                               | `Type · Paste · Photo`                                                        |
| 0:30–0:47 | Scroll to Classroom Relay. Hold on the selected words and their visible reasons. Use a small zoom highlight around one or two reason labels.                                                          | **During Build Week, I added Classroom Relay. It uses local review dates, mastery, past results, and classroom encounters to select up to five words. It explains every choice.** | `NEW FOR BUILD WEEK` + `Explainable personalization`                          |
| 0:47–1:08 | Start the mission. Use three quick cuts: listening question, meaning choice, then the original-sentence cloze. Let the cloze remain visible for about four seconds.                                   | **The mission moves through listening, meaning recall, and the key step: putting the word back into its original context: “Plants need sunlight and water to grow.”**             | `Listen → Recall → Use in context`                                            |
| 1:08–1:23 | Complete the mission. Show learned/needs-review results and the parent handoff prompt. Briefly open the wordbook and show the classroom-source count.                                                 | **Results update spaced review, remember where each word appeared, and give the parent one simple question to continue the lesson at home.**                                      | `Classroom → Child → Home`                                                    |
| 1:23–1:34 | Show a clean close-up of the local-first/privacy message and the browser wordbook. A small lock icon can be added in editing.                                                                         | **There is no child account, no hidden profile, and no uploaded learning history. Personalization stays visible and in the browser.**                                             | `Local-first · Explainable · Parent-friendly`                                 |
| 1:34–1:49 | **Codex proof montage.** Show the Codex task title or model label, the GitHub Build Week commits, the passing-test summary, and the `/feedback` Session ID. Keep each shot readable for 3–4 seconds.  | **I used Codex with GPT-5.6 to understand the existing codebase, design the learning model, implement the complete flow, and add unit, Cloudflare, and mobile end-to-end tests.** | `Built with Codex + GPT-5.6` + `Session 019f675a-a32d-7eb0-9e13-4d4df7cd9969` |
| 1:49–1:57 | **Jimeng animation C.** Lucia and Rayna complete the sentence together and high-five. A small plant grows beside the workbook. Add the real logo and URL in the editor, not in the generated clip.    | **Lucia does not do the homework. It helps children and parents understand it, practice it, and remember it together.**                                                           | `Lucia's Dictionary · Classroom Relay` + `dict.luciaandrayna.com`             |

## Continuous English voiceover

> One classroom sentence can follow a child all the way home. Translation explains it, but it does not turn that moment into learning.
>
> Lucia's Dictionary turns that exact sentence into a private, personalized micro-lesson.
>
> A child or parent can type, paste, or photograph the sentence. The app creates readable word cards with meanings, phonetics, and pronunciation.
>
> During Build Week, I added Classroom Relay. It uses local review dates, mastery, past results, and classroom encounters to select up to five words. It explains every choice.
>
> The mission moves through listening, meaning recall, and the key step: putting the word back into its original context: “Plants need sunlight and water to grow.”
>
> Results update spaced review, remember where each word appeared, and give the parent one simple question to continue the lesson at home.
>
> There is no child account, no hidden profile, and no uploaded learning history. Personalization stays visible and in the browser.
>
> I used Codex with GPT-5.6 to understand the existing codebase, design the learning model, implement the complete flow, and add unit, Cloudflare, and mobile end-to-end tests.
>
> Lucia does not do the homework. It helps children and parents understand it, practice it, and remember it together.

## Jimeng prompts

Use the established Lucia and Rayna character reference images for every generated shot. Generate clean plates without captions, logos, phone UI, or readable worksheet text; add those elements during editing.

### Animation A · The classroom sentence comes home (8 seconds)

> 16:9 cinematic 3D family animation, use the uploaded Lucia and Rayna character references and preserve their faces, hairstyles, ages, proportions, and clothing. Cozy after-school home interior, warm late-afternoon light. Lucia places a classroom worksheet with a simple non-readable drawing of a green plant, sun, and water on the table. Rayna sits beside her and looks at it with supportive curiosity. Lucia first looks uncertain, then hopeful. Slow camera push-in, subtle natural hand and eye movement, emotionally warm, premium animated-film lighting, uncluttered background, no readable text, no logos, no phone screen, no extra characters, no distorted hands.

### Animation B · Paper becomes a learning path (7 seconds; use only 4–5 seconds)

> 16:9 stylized 3D transition using the same Lucia and Rayna references. Close-up of the worksheet on the table. Soft purple and lavender light traces the plant, sunlight, and water drawings; three clean floating vocabulary-card shapes rise from the paper and move toward a simple neutral phone silhouette. Smooth magical transition, gentle particles, child-friendly educational mood, locked camera with slight parallax, no readable text, no real app interface, no logos, no warped objects. End on a bright neutral phone-shaped frame suitable for a match cut to real screen recording.

### Animation C · Learning together (8 seconds)

> 16:9 cinematic 3D family animation, same Lucia and Rayna character references with strong visual consistency. Lucia confidently points to the final blank on the worksheet; Rayna smiles and they complete the activity together, then share a natural high-five. A small healthy green plant beside the workbook gently grows two new leaves as a visual metaphor. Warm purple accent light, joyful but calm, premium animation, slow pull-back, clean negative space on the right for title and URL, no readable text, no logos, no distorted fingers, no additional characters.

## Screen-recording checklist

1. Use a clean browser profile and hide bookmarks, personal tabs, notifications, and extensions.
2. Record the production site at a readable mobile width, but compose it inside the 16:9 video with a soft branded background rather than stretching the phone UI.
3. Seed or clear local data so recommendation reasons and the full mission appear predictably.
4. Record each product moment as a separate take: analysis, recommendation, three exercises, results, wordbook.
5. Cut waiting time and repeated questions; never speed the UI so much that labels become unreadable.
6. Show the real Codex model label before saying GPT-5.6, and keep the Session ID visible long enough to pause and read.
7. Use the exact public GitHub repository and production URL.
8. End below two minutes and upload as a **public** YouTube video, not private or unlisted.

## Editing notes

- Keep animation to roughly 20 seconds total; the real product should remain the hero.
- Use purple highlights only for callouts that match the product's visual language.
- Favor hard cuts or short 6–8-frame dissolves. Avoid long template transitions.
- Add subtle click sounds for the three mission stages and lower the music by about 8–10 dB under speech.
- Put the strongest proof inside the video rather than only in the YouTube description: the working flow, Codex/GPT-5.6 statement, repository, and Session ID.
