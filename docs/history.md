# History

Line cap: 300

## 2026-10 — Agent bridge for best-model weeks

Generate/enrich weeks can run outside the Gemini API via `lessons:agent`, using the same prompts and normalisers as the batch. Used so Gemini 3.8 Flash subagents in Cursor can fill weeks when API keys are rate-limited. Batch still owns Flash-Lite enrich and resume state unless `enrich-import` marks the week done.

## 2026-10 — Rate-limit split

"Too many requests" is not always a daily quota. Per-minute 429s wait and retry; daily 429s skip the model until Pacific midnight. Treating every 429 as daily was burning the cascade and forcing weaker models too early.

## 2026-09 — Upgrade regenerate ≠ enrich on 3.8

Upgrade mode regenerates on 3.8/3.7 only. Enrich after regenerate stays on Flash-Lite so enrich tokens are not spent on the best generate models.
