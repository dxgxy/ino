import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 验证真实词库的引用完整性，避免词书存在但无法生成卡片。
const dictionary = JSON.parse(await readFile(new URL('../src/data/ecdict.json', import.meta.url), 'utf8'));
const ids = new Set(dictionary.cards.map(card => card.id));
assert.equal(ids.size, dictionary.cards.length);
assert.equal(dictionary.cards.length, dictionary.metadata.cardCount);
for (const card of dictionary.cards) {
  assert.ok(card.content.trim() && /[\u3400-\u9fff]/.test(card.translation), `Missing Chinese definition: ${card.content}`);
  assert.equal(card.kind, 'word');
  assert.ok(card.sourceUrl && card.source === 'ECDICT');
}
for (const book of dictionary.books) {
  assert.ok(book.cardIds.length > 0);
  assert.equal(new Set(book.cardIds).size, book.cardIds.length);
  assert.ok(book.cardIds.every(id => ids.has(id)));
}

const tsc = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url));
const compile = spawnSync(process.execPath, [tsc, '--ignoreConfig', '--target', 'es2022', '--module', 'esnext', '--moduleResolution', 'bundler', '--skipLibCheck', '--outDir', 'output/library-check', 'src/services/studyLists.ts'], { stdio: 'inherit' });
assert.equal(compile.status, 0);
const { studyListService, generationCandidates, loadLearningState, saveLearningState } = await import('../output/library-check/services/studyLists.js');
const memory = new Map();
const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
assert.deepEqual(loadLearningState(storage), { lists: [], reviewed: [], reviewRecords: [] }, 'First launch must not create default Lists');
const userList = studyListService.create('我的计划', dictionary.cards.slice(0, 2));
const eligible = generationCandidates(dictionary.cards.slice(0, 43), [userList], true);
assert.equal(eligible.length, 41, 'Assigned words should be skipped');
const generated = studyListService.generate('自选范围', eligible, 20);
assert.deepEqual(generated.map(list => list.cards.length), [20, 20, 1]);
assert.equal(new Set(generated.flatMap(list => list.cards.map(card => card.id))).size, 41);
assert.throws(() => studyListService.generate('无效', eligible, 0));
assert.throws(() => studyListService.generate('无效', eligible, 31));
assert.throws(() => studyListService.create('  '));
const state = { lists: [userList, ...generated], reviewed: [userList.cards[0].id], reviewRecords: [] };
saveLearningState(storage, state);
assert.deepEqual(loadLearningState(storage), state, 'Lists and review history must survive reload');
saveLearningState(storage, { lists: [], reviewed: [], reviewRecords: [] }, 'account-b');
saveLearningState(storage, { lists: [userList], reviewed: [], reviewRecords: [] }, 'account-a');
assert.equal(loadLearningState(storage, 'account-a').lists.length, 1);
assert.equal(loadLearningState(storage, 'account-b').lists.length, 0);
assert.deepEqual(loadLearningState(storage), state, 'Account persistence must not overwrite guest data');
assert.equal(userList.cards.length, 2, 'Generation must not change existing Lists');
console.log(`PASS: ${dictionary.cards.length} real cards; ${dictionary.books.length} books; empty launch, user generation, deduplication and persistence`);

