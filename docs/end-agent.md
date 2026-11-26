# /end-agent

Line cap: 300

Wrap-up. The user invoked this, which is consent to test, clean up, commit, merge, and push. Follow the steps in order. If a step fails, stop and report. Do not skip tests to get green.

## Steps

1. Confirm the starting state.

```bash
git status
git branch --show-current
git worktree list
```

You are in the feature worktree, not on `main`. If this is the first seed and there is no worktree yet, stay on `main` and skip worktree removal in step 6. If the tree has changes you did not write, stop and ask.

2. Backfill missing tests for logic added on this branch. Run `npm run check` and `npm run test` when they exist. Always run:

```bash
node scripts/check-doc-cap.mjs
```

Do not mark a test `.skip` or `.todo` to get green. Fix the test or fix the code.

3. Remove debug debris: stray logs, commented-out code, unused imports, finished TODOs. If that edit is more than debris, re-run the suite.

4. Make the docs match what shipped, using the rules in [`new-agent.md`](new-agent.md). Update `architecture.md` when behaviour changed. Update `scope.md` only when the product boundary changed. Add a history entry only for a choice it would be wrong to reverse. `planning.md` shrinks to the next slice or is removed when the work is done. Respect the line cap.

5. Review the diff, then commit, merge, and push.

```bash
git status
git diff
git add <files>
git commit -m "<type>: <why>"
```

Commit types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `perf`. Do not `git add -A` or `git add .` without reading `git status`. Do not bundle a dependency bump into a feature commit.

From the main checkout (`<main>` comes from `git worktree list`):

```bash
git -C <main> switch main
git -C <main> merge --ff-only <branch>
```

If it cannot fast-forward, rebase the feature branch onto `main`, re-run the suite, then fast-forward. Never force-push `main`. Never amend a commit that was already pushed. Push `main` only after the suite is green on `main`. If the push is rejected, stop and say so.

6. Remove the worktree, then the branch. Skip this step when the job ran on `main` because the repo had no commit yet.

Unlink a `node_modules` junction first. `cmd /c rmdir` removes the junction only. Never `Remove-Item -Recurse` a junction.

```bat
cmd /c rmdir "<worktree>\node_modules"
git -C <main> worktree remove "<worktree>"
git -C <main> branch -d <branch>
```

On Windows, if a window still has the worktree open, ask for it to be closed before `worktree remove`. Delete the remote branch only if it was pushed.

7. Report what shipped, the commit hash, test results, and anything the user should click through.
