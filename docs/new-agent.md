# /new-agent

Line cap: 300

This is the kickoff. Follow it in order. Do not commit, merge, or push. That is [`end-agent.md`](end-agent.md).

There is no plan-approval stop. Write the note in step 4 and implement. Stop for a plan only when the user asked for one.

## What to read

Read these, then stop. Do not read sibling units or the rest of `docs/`.

1. This file.
2. [`scope.md`](scope.md).
3. One unit: `units/<name>/scope.md`, then `architecture.md` and `history.md` if they exist. Architecture is what is true now. If it disagrees with history, follow architecture.
4. A sub-part `scope.md` only when the unit scope names it as the home of this task.

## Docs

Every unit and sub-part uses the same names.

- `scope.md` — what this node is, and a short section for each child. This is the only file that lists children. Change it only when the product boundary changes, by rewriting that sentence. A bugfix, a button label, and work that has not shipped leave scope untouched.
- `architecture.md` — how it works now. Replace the paragraph the change supersedes. Keep a trap a later change will hit again. Work that has not shipped stays in `planning.md`.
- `planning.md` — the work in progress. Replace it when the work finishes. Do not append forever. It stays out of scope, architecture, and history until that work ships.
- `history.md` — a choice it would be wrong to reverse: date, what was decided, why. Newest first. A bugfix that carries out an existing decision gets no entry. When a later decision replaces an earlier one, rewrite that entry in the same edit. When the file would pass the line cap, fold the oldest entries into one Earlier paragraph. Do not add a second history file.

No empty files. No fourth level. Create a sub-part folder only when the parent's section for that piece would pass about 40 lines, or the parent file would pass the cap.

After any doc edit, run:

```bash
node scripts/check-doc-cap.mjs
```

The script reads `Line cap:` from this file and fails if any `docs/**/*.md` is over it. `node --test scripts/check-doc-cap.test.mjs` runs that check with no extra dependencies. When the project has its own test runner, call the same script from a test there too.

## Steps

1. Read the files listed above.
2. Run `git status`. If the tree has changes you did not just write, stop and ask.
3. From a clean `main`, create a worktree and branch together:

```bash
git worktree add -b <prefix>/<kebab> ../<Project>-<purpose> main
```

Prefixes: `feat/`, `fix/`, `refactor/`, `docs/`, `chore/`. If `main` has `node_modules`, junction it into the worktree:

```bat
cmd /c mklink /J "<worktree>\node_modules" "<main>\node_modules"
```

Do not open a new Cursor window. Do the work in this conversation, in the worktree. A repo with no commit yet cannot grow a worktree. That first seed lands on `main`. Every later job uses a worktree.

Do not pull `main` into the branch mid-job. The branch stays at its start commit. If you are resuming, the user must say so. Otherwise start a new worktree off `main`. A related bundle is one job and one worktree.

4. Write a few lines in the unit `planning.md`: what will change, and which tests prove it. Then implement.
5. After each step, run `npm run check` and `npm run test` when those scripts exist. Fix failures before the next step. New logic gets a co-located `*.test.ts` in the same step. Exercise user-visible UI in the browser.
6. If behaviour changed, update that unit's `architecture.md` and replace the paragraph that is no longer true. Update `scope.md` only when the product boundary changed. Add a `history.md` entry only for a choice it would be wrong to reverse. Keep every doc within the cap. Run the doc-cap script.
7. Hand off. Do not commit. End with: Implementation complete. Run `/end-agent` when you want to test, clean up, commit, merge, and push.

Print a copy-paste `Set-Location` (or `cd`) into the worktree and `npm run dev`. Do not hardcode a port.
