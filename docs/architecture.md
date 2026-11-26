# Architecture

Line cap: 300

QCAA / faculty planning app (SvelteKit). Plans and assessments live as JSON under `data/`. Gemini generates and enriches ASPIRE lesson weeks.

## Lesson generate / enrich

`src/lib/server/generate-lessons.ts` builds prompts, calls the Gemini cascade, and normalises JSON into `LessonPlan`s. Generate covers a week (three lessons). Enrich expands one Enhance activity at a time with printable `workbookSpec` and answer keys. Lenient JSON repair is in `src/lib/server/repair-json.ts`.

UI Generate uses Standard tier. Batch generate may use Flex on the last successful model; enrich stays Standard / Flash-Lite.

## Gemini client

`src/lib/gemini-client.ts` walks the model cascade and optional second key (`GEMINI_API_KEY2`). Thinking config is sent only to Gemini 3.x.

429s: daily (`PerDay`) benches a model until Pacific midnight; per-minute waits for the server retry delay and retries the same model. Batch scripts call `configureRatePacing` (default 4s between calls per model per key). 503 / timeout uses a short cooldown, not a day ban.

## Batch and agent bridge

`scripts/generate-dt-lessons.ts` walks Digital / Design Technologies units (not Manual Arts), resumes from `data/lesson-batch-progress.json`, and supports `--upgrade` / `--wait`. Upgrade regenerates on 3.8 → 3.7 and re-enriches with Flash-Lite.

`scripts/lessons-agent.ts` writes the same prompts for an external model (e.g. Cursor subagent), then imports replies through the same parse path. Prompt/response files go under `data/agent-lessons/` (gitignored). Shared helpers live in `scripts/lesson-batch-shared.ts`.

## Exports

Faculty ZIP and the export page include teacher Word, teacher PowerPoint, and student workbook when a unit has lessons. Those builders are deterministic and do not call Gemini. Learning guides are the only export-time Gemini path.
