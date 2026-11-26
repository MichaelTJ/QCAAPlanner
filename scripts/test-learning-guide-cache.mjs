import { createEmptyTeachingWeek, createEmptyUnitPlan } from '../src/lib/defaults.ts';
import {
	applyResolvedLearningGuides,
	applySavedLearningGuide,
	learningGuideSourceHash,
	savedLearningGuideVariant,
	storeLearningGuideVariant
} from '../src/lib/learning-guide-cache.ts';
import { aiField } from '../src/lib/types.ts';

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

const unit = createEmptyUnitPlan('unit-test', 'level-test', 1);
unit.yearLevel.value = 8;
unit.subject.value = 'Digital Technologies';
unit.unitTitle.value = 'Unit 1 — Digital Literacy';
unit.startWeek.value = 'Term 1 Week 1';
unit.finishWeek.value = 'Term 1 Week 10';
unit.unitDescription.value = 'Students learn digital literacy.';
unit.assessments = [
	{
		id: 'uassess-1',
		assessmentNumber: aiField(1),
		yearLevel: aiField(8),
		title: aiField('Portfolio'),
		description: aiField('A digital literacy portfolio.'),
		technique: aiField('Portfolio'),
		mode: aiField('Multimodal'),
		conditions: aiField(),
		timing: aiField('Term 1 Week 10'),
		achievementStandard: aiField(),
		moderation: aiField(),
		contentDescriptions: []
	}
];
unit.teachingSequence = [createEmptyTeachingWeek(1), createEmptyTeachingWeek(2)];
unit.teachingSequence[0].outlineTheme = aiField('Passwords');
unit.teachingSequence[0].theory.value = 'Identify strong passwords.';
unit.teachingSequence[0].prac.value = 'Create a password manager mockup.';
unit.teachingSequence[1].outlineTheme = aiField('Phishing');
unit.teachingSequence[1].theory.value = 'Recognise phishing emails.';
unit.teachingSequence[1].prac.value = 'Sort real versus fake messages.';

const hash = learningGuideSourceHash(unit);
assert(hash.length === 16, `expected 16-char hash, got ${hash}`);
assert(learningGuideSourceHash(unit) === hash, 'hash should be stable');

const unchanged = structuredClone(unit);
unchanged.evaluation.value = 'Students enjoyed the unit.';
unchanged.teachingSequence[0].resources.value = 'Slide deck';
assert(
	learningGuideSourceHash(unchanged) === hash,
	'evaluation and resources should not change the hash'
);

const changed = structuredClone(unit);
changed.teachingSequence[0].theory.value = 'Identify weak and strong passwords.';
assert(learningGuideSourceHash(changed) !== hash, 'theory changes should change the hash');

unit.learningGuides = storeLearningGuideVariant(unit, 'summary', {
	vocabulary: 'Cybersecurity: Password, Phishing',
	weeks: [
		{ week: 1, title: 'Passwords', bullets: ['Identify strong passwords'] },
		{ week: 2, title: 'Phishing', bullets: ['Recognise phishing'] }
	],
	lastGenerated: '2026-09-16T00:00:00.000Z'
});

assert(savedLearningGuideVariant(unit, 'summary'), 'summary variant should match current unit');
assert(!savedLearningGuideVariant(unit, 'detailed'), 'detailed variant is not stored yet');

const applied = applySavedLearningGuide(unit, 'summary');
assert(applied?.vocabulary === unit.learningGuides.summary?.vocabulary, 'applied summary vocabulary');
assert(applied?.weeks[0].title === 'Passwords', 'applied summary weeks');

const stale = structuredClone(unit);
stale.teachingSequence[0].theory.value = 'Changed theory';
assert(!savedLearningGuideVariant(stale, 'summary'), 'stale summary must not be reused');
assert(applySavedLearningGuide(stale, 'summary') === null, 'stale apply returns null');

const clientSave = structuredClone(unit);
delete clientSave.learningGuides;
applyResolvedLearningGuides(clientSave, unit);
assert(clientSave.learningGuides?.summary, 'client save without cache should keep matching saved guide');

clientSave.teachingSequence[0].theory.value = 'Another change';
applyResolvedLearningGuides(clientSave, unit);
assert(!clientSave.learningGuides, 'content change should drop the saved guide');

console.log('learning-guide-cache tests passed');
