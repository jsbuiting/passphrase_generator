const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>/?~';
const SPECIAL_CHARS_COUNT = specialChars.length;

// Helper: Capitalize first letter
const capitalize = (s) => {
    if (typeof s !== 'string' || s.length === 0) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
};

// --- Strength estimates ---

// Entropy (bits) of each generator, from the distributions below.
// Number: 1, 2 or 3 digits with probability 1/3 each, uniform within each.
const NUMBER_BITS = Math.log2(3) + (Math.log2(10) + Math.log2(90) + Math.log2(900)) / 3;
// Special: 1 or 2 characters with probability 1/2 each.
const SPECIAL_BITS = 1 + 1.5 * Math.log2(SPECIAL_CHARS_COUNT);
const DIGIT_BITS = Math.log2(10);

// Scenario 1: an attacker who knows how this generator works and enumerates
// its outputs. This is the passphrase's real strength while it is unedited.
function calculateGeneratorEntropy(activeParts, wordCount) {
    const words = ['word1', 'word2', 'word3'].filter(key => activeParts[key]).length;
    if (words > 0 && wordCount < 1) return 0;
    let bits = 0;
    if (words > 0) bits += words * Math.log2(wordCount) + Math.log2(words); // + which word is capitalised
    if (activeParts.optDigit) bits += DIGIT_BITS;
    if (activeParts.number) bits += NUMBER_BITS;
    if (activeParts.specialChars) bits += SPECIAL_BITS;
    return bits;
}

// Scenario 2: an attacker who treats the text as random characters. Only a
// ceiling: real cracking tools try word-based patterns first.
function calculateEntropy(password) {
    if (!password || password.length === 0) return { entropy: 0, length: 0, charSetSize: 0 };

    let hasLower = false, hasUpper = false, hasDigit = false, hasSpecial = false;
    for (let char of password) {
        if (char >= 'a' && char <= 'z') hasLower = true;
        else if (char >= 'A' && char <= 'Z') hasUpper = true;
        else if (char >= '0' && char <= '9') hasDigit = true;
        else hasSpecial = true;
    }

    let charSetSize = 0;
    if (hasLower) charSetSize += 26;
    if (hasUpper) charSetSize += 26;
    if (hasDigit) charSetSize += 10;
    if (hasSpecial) charSetSize += specialChars.length;

    const entropy = charSetSize > 0 ? password.length * Math.log2(charSetSize) : 0;
    return { entropy, length: password.length, charSetSize };
}

// Levenshtein distance: the number of single-character insertions,
// deletions or substitutions between the generated and the current text.
function editDistance(a, b) {
    const s = [...a], t = [...b];
    let prev = Array.from({ length: t.length + 1 }, (_, j) => j);
    for (let i = 1; i <= s.length; i++) {
        const cur = [i];
        for (let j = 1; j <= t.length; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1));
        }
        prev = cur;
    }
    return prev[t.length];
}

// Printable ASCII a user can type.
const TYPABLE_CHARS = 95;

// How much a user's own edits can add on top of the generator's entropy.
// Each change adds at most log2(characters × positions) bits, and only when
// it is random; predictable edits ("!" at the end) add far less, because
// cracking tools apply such rules to word lists. Returns null when the text
// is mostly the user's own, so the generator figure no longer describes it.
function estimateEdits(generated, current) {
    const edits = editDistance(generated, current);
    if (edits === 0) return { edits: 0, maxExtraBits: 0 };
    if (edits * 2 > Math.max(generated.length, 1)) return null;
    const perEdit = Math.log2(TYPABLE_CHARS * (current.length + 1));
    return { edits, maxExtraBits: edits * perEdit };
}

const STRENGTH_LEVELS = [
    { min: 80, level: 'Very Strong', color: 'bg-emerald-500', notes: 'Far beyond practical cracking.' },
    { min: 60, level: 'Strong', color: 'bg-green-600', notes: 'Holds up even if a site leaks its password database.' },
    { min: 40, level: 'Moderate', color: 'bg-yellow-600', notes: 'Fine where the site limits login attempts; crackable if a weakly protected password database leaks.' },
    { min: 0, level: 'Weak', color: 'bg-red-600', notes: 'Can be cracked quickly by a determined attacker.' },
];

function getStrengthLevel(bits) {
    if (!(bits > 0)) return { level: 'Unknown', color: 'bg-gray-500', textColor: 'text-white', notes: '' };
    const { level, color, notes } = STRENGTH_LEVELS.find(l => bits >= l.min);
    return { level, color, textColor: 'text-white', notes };
}

// Large numbers as "1.234 × 10^18"; small ones in full.
function formatCombinations(count) {
    if (!(count > 0)) return '0';
    if (count < 1e15) return Math.round(count).toLocaleString('en-US');
    const [mantissa, exponent] = count.toExponential(3).split('e');
    return `${mantissa} × 10^${Number(exponent)}`;
}


// --- Cryptographically secure randomness ---

// Uniform integer in [0, maxExclusive) using crypto.getRandomValues with
// rejection sampling (no modulo bias). maxExclusive must be an integer in [1, 2^32].
function randomInt(maxExclusive) {
    if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 4294967296) {
        throw new RangeError('randomInt: maxExclusive must be an integer between 1 and 2^32');
    }
    if (maxExclusive === 1) return 0;
    const cryptoObj = globalThis.crypto;
    if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
        throw new Error('randomInt: crypto.getRandomValues is not available');
    }
    const range = 4294967296; // 2^32
    const limit = range - (range % maxExclusive); // largest multiple of maxExclusive <= 2^32
    const buf = new Uint32Array(1);
    for (;;) {
        cryptoObj.getRandomValues(buf);
        if (buf[0] < limit) return buf[0] % maxExclusive;
    }
}

// Throws on an empty list: a placeholder word would look like a real
// passphrase while adding no entropy.
function pickRandomWord(list, rand = randomInt) {
    if (!Array.isArray(list) || list.length === 0) {
        throw new Error('pickRandomWord: word list is empty');
    }
    return list[rand(list.length)];
}

// --- Word lists ---

const MIN_WORD_LIST_SIZE = 1000;

// One lowercase a-z word per line. Throws when the text does not look like a
// word list (e.g. an HTML error page served with status 200).
function parseWordList(text) {
    const words = [...new Set(String(text).split('\n').map(l => l.trim()).filter(l => l.length > 0))];
    if (words.length < MIN_WORD_LIST_SIZE) {
        throw new Error(`parseWordList: expected at least ${MIN_WORD_LIST_SIZE} words, got ${words.length}`);
    }
    const invalid = words.find(w => !/^[a-z]+$/.test(w));
    if (invalid !== undefined) {
        throw new Error('parseWordList: unexpected entry in word list');
    }
    return words;
}

// Union of the lists; a word present in several lists is kept once so it is
// not sampled with a higher probability.
function mergeWordLists(...lists) {
    return [...new Set(lists.flat())];
}

// --- Preferences ---

// Applies saved on/off choices (from localStorage, so untrusted) to the
// defaults. Unknown keys and non-boolean values are ignored, and at least one
// word list always stays selected.
function mergePrefs(saved, defaults) {
    const parts = { ...defaults.parts };
    const wordLists = { ...defaults.wordLists };
    if (saved && typeof saved === 'object') {
        for (const key of Object.keys(parts)) {
            if (typeof saved.parts?.[key] === 'boolean') parts[key] = saved.parts[key];
        }
        for (const key of Object.keys(wordLists)) {
            if (typeof saved.wordLists?.[key] === 'boolean') wordLists[key] = saved.wordLists[key];
        }
    }
    if (!Object.values(wordLists).some(Boolean)) Object.assign(wordLists, defaults.wordLists);
    return { parts, wordLists };
}

// --- Clipboard ---

// Resolves to true only when the text was actually copied. writeText is the
// async Clipboard API; legacyCopy is a synchronous fallback returning a boolean.
async function copyText(text, { writeText, legacyCopy } = {}) {
    if (typeof text !== 'string' || text.length === 0) return false;
    if (typeof writeText === 'function') {
        try {
            await writeText(text);
            return true;
        } catch {
            // fall through to the legacy path
        }
    }
    if (typeof legacyCopy === 'function') {
        try {
            return legacyCopy(text) === true;
        } catch {
            return false;
        }
    }
    return false;
}

function generateDigit(rand = randomInt) {
    return rand(10).toString();
}

// 1, 2 or 3 digits with equal probability (1/3 each): 0-9, 10-99, 100-999
function generateNumber(rand = randomInt) {
    const kind = rand(3);
    if (kind === 0) return rand(10).toString();
    if (kind === 1) return (rand(90) + 10).toString();
    return (rand(900) + 100).toString();
}

// 1 or 2 special characters, 50% each
function generateSpecialChars(rand = randomInt) {
    const char1 = specialChars[rand(SPECIAL_CHARS_COUNT)];
    return rand(2) === 0 ? char1 : char1 + specialChars[rand(SPECIAL_CHARS_COUNT)];
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        specialChars, SPECIAL_CHARS_COUNT, capitalize, NUMBER_BITS, SPECIAL_BITS, DIGIT_BITS,
        calculateGeneratorEntropy, calculateEntropy, editDistance, estimateEdits, getStrengthLevel,
        formatCombinations, randomInt, pickRandomWord,
        generateDigit, generateNumber, generateSpecialChars,
        MIN_WORD_LIST_SIZE, parseWordList, mergeWordLists, mergePrefs, copyText,
    };
}
