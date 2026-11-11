# AI News Editor

Add stories and photos, press one button, and get a print-ready newspaper PDF.

Built for Telugu dailies (and designed to grow to other Indian languages). Editors drop in their stories; the app acts as the layout editor: it decides what leads, fits the text into a 6-column broadsheet, builds the "continued on page 2" jumps, and exports the pages for print.

## What it does

- **Story desk.** Type or paste stories, attach `.docx` files and photos, and give each story an importance from 1 to 10. Drafts autosave in the browser.
- **One-click layout.** A 340 × 540 mm, 6-column broadsheet: masthead, info bar, front-page teasers, mid stories, a lead and a side story, then inside pages grouped by section.
- **Automatic fitting.** Each story is trimmed to exactly the words that fit its box. Overflow from page 1 moves to a "continued from page 1" rail on page 2, with matching "…continues on page 2" markers.
- **Proof view.** Real page previews with clickable stories and jump links, a layout report, warnings (empty gaps, cut text), and an "Adjust a story" panel to change importance, swap stories or promote one to lead, then regenerate.
- **Optional AI editor.** A switch that lets a model write headlines and key points and set each story's section and importance. Off by default. See [AI editor](#ai-editor).
- **Telugu-first typography.** Anek Telugu and Noto Serif Telugu are embedded in the PDF, so conjuncts render correctly.

## How it works

```
Story desk (browser)
   │  POST /api/generate   (streams progress as it goes)
   ▼
Ingest ─► [optional AI editor] ─► Plan ─► Layout & fit ─► Measure ─► PDF + page PNGs
```

1. **Ingest** (`app/api/generate/route.ts`): validates stories, reads `.docx` text, saves photos.
2. **AI editor** (`lib/ai/editorBrain.ts`): only if switched on.
3. **Plan** (`lib/editor/plan.ts`): ranks stories by importance. The top seven fill the front page (1 lead, 3 teasers, 2 mid stories, 1 side story); the rest go inside, grouped by section.
4. **Layout & fit** (`lib/render/layoutCore.ts`): builds the pages as HTML/CSS in headless Chromium and binary-searches how many words fit each story box.
5. **Measure and export** (`lib/render/pdf.ts`): records story positions, jump links and empty gaps for the proof screen, then writes the PDF and one PNG per page.

The planner is rule-based. There is no model in the loop unless the AI editor is on.

## Quick start

Requires Node 20.9 or newer.

```bash
npm install
npx playwright install chromium   # the PDF engine needs a Chromium browser
npm run dev
```

Open http://localhost:3000, click **Load sample edition**, then **Generate edition**. The press-ready PDF is available from the proof screen.

To build the sample edition from the command line instead:

```bash
npx tsx scripts/build-sample.ts    # writes out/edition.pdf and a PNG per page
```

## Configuration

Copy `.env.example` to `.env.local`. Everything is optional.

| Variable | Purpose |
|---|---|
| `OPENROUTER_API_KEY` | Enables the AI editor. Without it the switch stays disabled. |
| `OPENROUTER_MODEL` | Override the model. Default: `google/gemini-2.5-flash-lite`. |

Never commit real keys. `.env*` files are git-ignored, except `.env.example`.

## AI editor

When switched on, all stories go to the model in a single request through [OpenRouter](https://openrouter.ai), using a strict JSON schema, so the model can rank stories against each other. For every story it returns a section, an importance (1–10), a print headline, 3–5 key points and a one-line reason.

- A story only needs its text; the headline can be left blank.
- If your headline is already short and accurate, the model is told to keep it.
- The proof screen lists everything the AI wrote, with your original headline struck through, so it can be reviewed before printing. Read it. Machine-written Telugu printed under a paper's name needs a human check.
- If the AI call fails (bad key, no credit, rate limit, refusal, unreadable answer), the edition still builds from your own values and a warning explains why.
- Regenerating from the proof screen does not call the model again, so manual adjustments are not overwritten.

The default model was chosen for low cost ($0.10 / $0.40 per million tokens at the time of writing) and good Indic-language output. It has not been benchmarked on Telugu, so check real output before relying on it.

## Project structure

```
app/                      Next.js routes
  api/generate/           Ingest, optional AI step, layout, PDF (streams progress)
  api/files/[job]/[name]/ Serves generated PDFs and page previews
  api/ai-status/          Reports whether the AI editor is configured
  api/sample/             Serves the bundled sample edition
components/editor/        Story desk, generating screen, proof view, how-to dialog
lib/
  editor/plan.ts          Rule-based "chief editor"
  ai/editorBrain.ts       Optional AI editor (OpenRouter)
  render/                 HTML/CSS pages, fitting, measuring, PDF export
samples/                  Sample stories and placeholder photos
scripts/build-sample.ts   Build the sample edition from the command line
spikes/cf-pdf/            Cloudflare Browser Rendering experiment (see below)
```

## Limitations

- **Storage is temporary.** Drafts live in the browser's `localStorage`: story text and settings are kept, but uploaded photos and `.docx` files are not. Generated PDFs are written to `out/jobs/` and never cleaned up. There is no database, no edition history and no sign-in.
- **Needs a real server.** PDF generation runs headless Chromium, so it will not run on typical serverless hosts as is.
- **Telugu fonts only.** Other Indian scripts need their fonts bundled first; Urdu (right-to-left) needs layout work.
- **Short stories leave gaps.** Inside pages with little text show large empty areas; the proof screen warns about them, but nothing fills them automatically yet.
- **Simple placement rules.** There are no ads, no multi-column photo spreads and no per-section templates yet.

## Roadmap

- Host on Cloudflare Workers, with the PDF engine on Browser Rendering
- Persist photos and PDFs in R2 and editions in D1; sign-in through Cloudflare Access
- Language selector (fonts, date line, AI output language)
- Automatic gap filling and style learning from past editions

### Cloudflare experiment

`spikes/cf-pdf/` is a small Worker that runs the same layout code on Cloudflare Browser Rendering. It produced the same layout and a correct Telugu PDF there. To try it, generate a payload and start the Worker:

```bash
npx tsx spikes/cf-pdf/make-payload.ts
cd spikes/cf-pdf && npm install && npx wrangler dev
```

The free Browser Rendering plan allows one new browser every 20 seconds, so repeated test runs can return a 429 error. This folder is an experiment, not part of the app.

## Notes for contributors

This project uses Next.js 16 with newer settings than most documentation covers (see `AGENTS.md`). Check `node_modules/next/dist/docs/` before changing framework-level code.

```bash
npm run lint
npx tsc --noEmit
```
