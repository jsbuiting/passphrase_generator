'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/logic.js');

test('capitalize', () => {
    assert.equal(L.capitalize('word'), 'Word');
    assert.equal(L.capitalize('Word'), 'Word');
    assert.equal(L.capitalize('a'), 'A');
    assert.equal(L.capitalize(''), '');
    assert.equal(L.capitalize(null), '');
    assert.equal(L.capitalize(5), '');
});

test('calculateEntropy', () => {
    assert.deepEqual(L.calculateEntropy(''), { entropy: 0, length: 0, charSetSize: 0 });
    assert.deepEqual(L.calculateEntropy(null), { entropy: 0, length: 0, charSetSize: 0 });
    const lower = L.calculateEntropy('abcd');
    assert.equal(lower.charSetSize, 26);
    assert.ok(Math.abs(lower.entropy - 4 * Math.log2(26)) < 1e-9);
    assert.equal(L.calculateEntropy('aA1!').charSetSize, 26 + 26 + 10 + L.specialChars.length);
    assert.equal(L.calculateEntropy('12').charSetSize, 10);
});

test('randomInt: range and argument validation', () => {
    assert.equal(L.randomInt(1), 0);
    for (let i = 0; i < 2000; i++) {
        const v = L.randomInt(7);
        assert.ok(Number.isInteger(v) && v >= 0 && v < 7);
    }
    assert.ok(L.randomInt(4294967296) < 4294967296);
    for (const bad of [0, -1, 1.5, NaN, Infinity, 4294967297, '5', null, undefined]) {
        assert.throws(() => L.randomInt(bad), RangeError, String(bad));
    }
});

test('randomInt: rough uniformity (chi-square)', () => {
    const k = 10, n = 100000;
    const counts = new Array(k).fill(0);
    for (let i = 0; i < n; i++) counts[L.randomInt(k)]++;
    const expected = n / k;
    const chi = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
    // df=9; critical value at p=1e-6 is ~39.7, so false failures are vanishingly rare
    assert.ok(chi < 40, `chi-square too high: ${chi}`);
});

test('randomInt: rejection sampling avoids modulo bias', () => {
    // maxExclusive = 3e9 -> limit = 3e9 (1 multiple fits); values >= limit must be rejected.
    const origDesc = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    const feed = [4294967295, 3000000000, 2999999999];
    let calls = 0;
    const fake = { getRandomValues(buf) { buf[0] = feed[calls++]; return buf; } };
    Object.defineProperty(globalThis, 'crypto', { value: fake, configurable: true });
    try {
        assert.equal(L.randomInt(3000000000), 2999999999);
        assert.equal(calls, 3);
    } finally {
        Object.defineProperty(globalThis, 'crypto', origDesc);
    }
});

// Deterministic rand: returns a queued value, asserting it is in range
const seq = (...vals) => { const q = [...vals]; return (max) => { const v = q.shift(); assert.ok(v >= 0 && v < max, `${v} out of [0,${max})`); return v; }; };

test('pickRandomWord', () => {
    assert.equal(L.pickRandomWord(['a', 'b', 'c'], seq(2)), 'c');
    assert.throws(() => L.pickRandomWord([]), /empty/);
    assert.throws(() => L.pickRandomWord(null), /empty/);
    assert.ok(['a', 'b'].includes(L.pickRandomWord(['a', 'b'])));
});

test('generateDigit', () => {
    assert.equal(L.generateDigit(seq(7)), '7');
    for (let i = 0; i < 200; i++) assert.match(L.generateDigit(), /^[0-9]$/);
});

test('generateNumber: 1, 2 or 3 digits', () => {
    assert.equal(L.generateNumber(seq(0, 5)), '5');
    assert.equal(L.generateNumber(seq(1, 0)), '10');
    assert.equal(L.generateNumber(seq(1, 89)), '99');
    assert.equal(L.generateNumber(seq(2, 0)), '100');
    assert.equal(L.generateNumber(seq(2, 899)), '999');
    const lens = { 1: 0, 2: 0, 3: 0 };
    for (let i = 0; i < 6000; i++) {
        const s = L.generateNumber();
        assert.match(s, /^[0-9]{1,3}$/);
        assert.ok(s.length === 1 || s[0] !== '0');
        lens[s.length]++;
    }
    for (const l of [1, 2, 3]) assert.ok(lens[l] > 1700 && lens[l] < 2300, `len ${l}: ${lens[l]}`);
});

test('generateSpecialChars: 1 or 2 chars, 50% each', () => {
    assert.equal(L.generateSpecialChars(seq(0, 0)), L.specialChars[0]);
    assert.equal(L.generateSpecialChars(seq(3, 1, 4)), L.specialChars[3] + L.specialChars[4]);
    let two = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
        const s = L.generateSpecialChars();
        assert.ok(s.length === 1 || s.length === 2);
        for (const c of s) assert.ok(L.specialChars.includes(c));
        if (s.length === 2) two++;
    }
    assert.ok(two > n * 0.45 && two < n * 0.55, `two-char share ${two / n}`);
});

test('parseWordList', () => {
    // 1000 distinct a-z words: the index written in base 26
    const toWord = (i) => i.toString(26).replace(/[0-9a-p]/g, c => String.fromCharCode(97 + parseInt(c, 26)));
    const unique = Array.from({ length: L.MIN_WORD_LIST_SIZE }, (_, i) => 'w' + toWord(i));
    assert.equal(new Set(unique).size, L.MIN_WORD_LIST_SIZE);
    assert.deepEqual(L.parseWordList(unique.join('\n') + '\n'), unique);
    // blank lines, surrounding whitespace and duplicates are dropped
    assert.deepEqual(L.parseWordList(' ' + unique.join(' \n\n') + '\n' + unique[0] + '\n'), unique);
    // too short: e.g. a failed load
    assert.throws(() => L.parseWordList(''), /at least/);
    assert.throws(() => L.parseWordList('one\ntwo\n'), /at least/);
    // not a word list: e.g. an HTML error page
    assert.throws(() => L.parseWordList(unique.join('\n') + '\n<html>\n'), /unexpected entry/);
    assert.throws(() => L.parseWordList(unique.join('\n') + '\nWord\n'), /unexpected entry/);
});

test('mergeWordLists drops words shared between lists', () => {
    assert.deepEqual(L.mergeWordLists(['in', 'tree'], ['boom', 'in']), ['in', 'tree', 'boom']);
    assert.deepEqual(L.mergeWordLists(['a', 'a']), ['a']);
    assert.deepEqual(L.mergeWordLists([], []), []);
    assert.deepEqual(L.mergeWordLists(), []);
});

test('copyText reports whether the copy really happened', async () => {
    const calls = [];
    const ok = async (t) => { calls.push(['api', t]); };
    const denied = async () => { throw new Error('NotAllowedError'); };

    assert.equal(await L.copyText('secret', { writeText: ok }), true);
    assert.deepEqual(calls, [['api', 'secret']]);

    // Clipboard API denied, legacy path succeeds
    assert.equal(await L.copyText('secret', { writeText: denied, legacyCopy: () => true }), true);
    // both paths fail
    assert.equal(await L.copyText('secret', { writeText: denied, legacyCopy: () => false }), false);
    assert.equal(await L.copyText('secret', { writeText: denied, legacyCopy: () => { throw new Error('x'); } }), false);
    assert.equal(await L.copyText('secret', { writeText: denied }), false);
    // no Clipboard API at all
    assert.equal(await L.copyText('secret', { legacyCopy: () => true }), true);
    assert.equal(await L.copyText('secret'), false);
    // legacy path must return exactly true (execCommand returns a boolean)
    assert.equal(await L.copyText('secret', { legacyCopy: () => undefined }), false);
});

test('copyText never reports success for an empty passphrase', async () => {
    let called = false;
    const spy = async () => { called = true; };
    assert.equal(await L.copyText('', { writeText: spy, legacyCopy: () => true }), false);
    assert.equal(await L.copyText(undefined, { writeText: spy }), false);
    assert.equal(called, false);
});

test('shipped word lists are clean', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const blocked = ['fuck', 'shit', 'cunt', 'rape', 'nazi', 'hoer', 'neuk'];
    for (const lang of ['en', 'nl']) {
        const text = fs.readFileSync(path.join(__dirname, '..', 'data', `words_${lang}.txt`), 'utf8');
        const words = L.parseWordList(text);
        for (const w of blocked) assert.ok(!words.includes(w), `${lang} list contains "${w}"`);
    }
});

test('mergePrefs restores saved choices and ignores junk', () => {
    const defaults = {
        parts: { word1: true, word2: true, number: true },
        wordLists: { en: true, nl: true },
    };
    assert.deepEqual(L.mergePrefs(null, defaults), defaults);
    assert.deepEqual(L.mergePrefs('nonsense', defaults), defaults);
    assert.deepEqual(
        L.mergePrefs({ parts: { word2: false, number: 'no', evil: true }, wordLists: { nl: false } }, defaults),
        { parts: { word1: true, word2: false, number: true }, wordLists: { en: true, nl: false } }
    );
    // never both word lists off
    assert.deepEqual(L.mergePrefs({ wordLists: { en: false, nl: false } }, defaults).wordLists, { en: true, nl: true });
    // defaults are not mutated
    L.mergePrefs({ parts: { word1: false } }, defaults);
    assert.equal(defaults.parts.word1, true);
});

test('generator entropy matches the generators', () => {
    const near = (a, b) => Math.abs(a - b) < 1e-9;
    // number: log2(3) + mean of log2(10), log2(90), log2(900)
    assert.ok(Math.abs(L.NUMBER_BITS - 8.1275) < 1e-3);
    // special: 1 bit for the length + log2(28) + half the time another log2(28)
    assert.ok(near(L.SPECIAL_BITS, 1 + 1.5 * Math.log2(28)));
    // brute-force check of the number distribution's Shannon entropy
    let h = 0;
    for (const [n, count] of [[10, 10], [90, 90], [900, 900]]) h += count * (1 / 3 / n) * Math.log2(3 * n);
    assert.ok(near(h, L.NUMBER_BITS));

    const all = { word1: true, word2: true, word3: true, optDigit: true, number: true, specialChars: true };
    const n = 16000;
    assert.ok(near(L.calculateGeneratorEntropy(all, n),
        3 * Math.log2(n) + Math.log2(3) + L.DIGIT_BITS + L.NUMBER_BITS + L.SPECIAL_BITS));
    assert.ok(near(L.calculateGeneratorEntropy({ word1: true }, n), Math.log2(n)));
    assert.ok(near(L.calculateGeneratorEntropy({ word1: true, word2: true }, n), 2 * Math.log2(n) + 1));
    assert.ok(near(L.calculateGeneratorEntropy({ number: true }, 0), L.NUMBER_BITS));
    assert.equal(L.calculateGeneratorEntropy({ word1: true }, 0), 0);
    assert.equal(L.calculateGeneratorEntropy({}, n), 0);
    // all parts on with ~16k words is about 63 bits
    assert.ok(Math.abs(L.calculateGeneratorEntropy(all, 16082) - 63.2) < 0.1);
});

test('editDistance', () => {
    assert.equal(L.editDistance('', ''), 0);
    assert.equal(L.editDistance('abc', 'abc'), 0);
    assert.equal(L.editDistance('word1Word2', 'word1W!ord2'), 1);
    assert.equal(L.editDistance('abc', 'abd'), 1);
    assert.equal(L.editDistance('abc', 'ab'), 1);
    assert.equal(L.editDistance('', 'abc'), 3);
    assert.equal(L.editDistance('kitten', 'sitting'), 3);
});

test('estimateEdits', () => {
    assert.deepEqual(L.estimateEdits('word1Word2', 'word1Word2'), { edits: 0, maxExtraBits: 0 });
    const one = L.estimateEdits('word1Word2', 'word1W!ord2');
    assert.equal(one.edits, 1);
    assert.ok(Math.abs(one.maxExtraBits - Math.log2(95 * 12)) < 1e-9);
    assert.equal(L.estimateEdits('word1Word2', 'word1Word2!!').edits, 2);
    // mostly the user's own text: no estimate
    assert.equal(L.estimateEdits('word1Word2', 'Password123!'), null);
    assert.equal(L.estimateEdits('abc', ''), null);
});

test('getStrengthLevel thresholds', () => {
    assert.equal(L.getStrengthLevel(0).level, 'Unknown');
    assert.equal(L.getStrengthLevel(NaN).level, 'Unknown');
    assert.equal(L.getStrengthLevel(39.9).level, 'Weak');
    assert.equal(L.getStrengthLevel(40).level, 'Moderate');
    assert.equal(L.getStrengthLevel(60).level, 'Strong');
    assert.equal(L.getStrengthLevel(80).level, 'Very Strong');
    for (const bits of [10, 50, 70, 200]) assert.doesNotMatch(L.getStrengthLevel(bits).notes, /quantum/i);
});

test('formatCombinations', () => {
    assert.equal(L.formatCombinations(0), '0');
    assert.equal(L.formatCombinations(1234567), '1,234,567');
    assert.equal(L.formatCombinations(1e15), '1.000 × 10^15');
    assert.equal(L.formatCombinations(2.5e20), '2.500 × 10^20');
    // rounding must not produce a 10.000 mantissa
    assert.equal(L.formatCombinations(9.9999e17), '1.000 × 10^18');
});
