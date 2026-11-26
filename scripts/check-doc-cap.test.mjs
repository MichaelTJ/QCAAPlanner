import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('docs stay within the line cap', () => {
	assert.doesNotThrow(() =>
		execFileSync(process.execPath, ['scripts/check-doc-cap.mjs'], { stdio: 'pipe' })
	);
});
