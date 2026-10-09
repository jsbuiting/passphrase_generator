// --- STATE MANAGEMENT ---
let wordsEn = [];
let wordsNl = [];
const wordListSelected = { en: true, nl: true };
let wordsReady = false;
let selectedWordsCache = null;

// Every part is on by default; a visitor's own choices are restored from
// localStorage (see loadPrefs).
const partOptional = {
    word1: true, word2: true, optDigit: true,
    word3: true, number: true, specialChars: true
};

const passphraseParts = {
    word1: '', word2: '', optDigit: '', 
    word3: '', number: '', specialChars: ''
};

let capitalizedWordKey = 'word1';
let draggedPane = null;
let placeholder = null;
let isDragOperation = false;

// --- DOM ELEMENTS ---
const elements = {
    output: document.getElementById('passphrase-output'),
    copyBtn: document.getElementById('copy-btn'),
    copyIconDefault: document.getElementById('copy-icon-default'),
    copyIconSuccess: document.getElementById('copy-icon-success'),
    genAllBtn: document.getElementById('gen-all-btn'),
    status: document.getElementById('status-message'),
    val: {
        word1: document.getElementById('val-word1'),
        word2: document.getElementById('val-word2'),
        optDigit: document.getElementById('val-optdigit'),
        word3: document.getElementById('val-word3'),
        number: document.getElementById('val-number'),
        specialChars: document.getElementById('val-specialchars'),
    },
    btn: {
        word1: document.getElementById('gen-word1-btn'),
        word2: document.getElementById('gen-word2-btn'),
        optDigit: document.getElementById('gen-optdigit-btn'),
        word3: document.getElementById('gen-word3-btn'),
        number: document.getElementById('gen-number-btn'),
        specialChars: document.getElementById('gen-specialchars-btn'),
    }
};

// --- DATA LOADING ---
function getSelectedWords() {
    if (!selectedWordsCache) {
        selectedWordsCache = mergeWordLists(
            wordListSelected.en ? wordsEn : [],
            wordListSelected.nl ? wordsNl : []
        );
    }
    return selectedWordsCache;
}

async function fetchWordList(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return parseWordList(await response.text());
}

// Rejects when either list is missing or malformed; the caller then leaves
// generation disabled instead of producing a passphrase without real words.
async function loadWords() {
    [wordsEn, wordsNl] = await Promise.all([
        fetchWordList('data/words_en.txt'),
        fetchWordList('data/words_nl.txt')
    ]);
    selectedWordsCache = null;
    wordsReady = true;
    updateWordCount();
}

function toggleWordList(lang) {
    if (!wordsReady) return;
    const other = lang === 'en' ? 'nl' : 'en';
    // At least one list stays selected: with none there is nothing to sample from.
    if (wordListSelected[lang] && !wordListSelected[other]) {
        showStatus('At least one word list must stay selected.', true);
        return;
    }
    wordListSelected[lang] = !wordListSelected[lang];
    selectedWordsCache = null;
    savePrefs();
    clearStatus();
    updateWordCount();
}

function updateWordCount() {
    const selectedWords = getSelectedWords();
    const countElement = document.getElementById('word-count');
    if (countElement) countElement.textContent = selectedWords.length.toLocaleString();
    
    document.getElementById('word-count-en').textContent = wordsEn.length.toLocaleString();
    document.getElementById('word-count-nl').textContent = wordsNl.length.toLocaleString();
    
    // Update visuals
    for (const lang of ['en', 'nl']) {
        const pane = document.getElementById(`wordlist-${lang}-pane`);
        pane.classList.toggle('part-optional', wordListSelected[lang]);
        pane.setAttribute('aria-pressed', String(wordListSelected[lang]));
    }
    updateSecurityReport();
}

// --- GENERATION LOGIC ---
const getRandomWord = () => pickRandomWord(getSelectedWords());
const getRandomDigit = () => generateDigit();
const getRandomNumber = () => generateNumber();
const getRandomSpecialChars = () => generateSpecialChars();

function generateAll() {
    if (!wordsReady) return;
    clearStatus();
    passphraseParts.word1 = partOptional.word1 ? getRandomWord() : '';
    passphraseParts.word2 = partOptional.word2 ? getRandomWord() : '';
    passphraseParts.word3 = partOptional.word3 ? getRandomWord() : '';
    passphraseParts.optDigit = partOptional.optDigit ? getRandomDigit() : '';
    passphraseParts.number = partOptional.number ? getRandomNumber() : '';
    passphraseParts.specialChars = partOptional.specialChars ? getRandomSpecialChars() : '';
    const wordKeys = ['word1', 'word2', 'word3'].filter(key => partOptional[key]);
    if (wordKeys.length > 0) capitalizedWordKey = wordKeys[randomInt(wordKeys.length)];
    updateDisplay();
}

// --- UI UPDATES ---
function showStatus(message, isError = false) {
    elements.status.textContent = message;
    elements.status.classList.toggle('text-red-400', isError);
    elements.status.classList.toggle('text-gray-300', !isError);
}

function clearStatus() {
    showStatus('');
}

let copyResetTimeout;
function showCopyResult(copied) {
    clearTimeout(copyResetTimeout);
    elements.copyIconDefault.classList.toggle('hidden', copied);
    elements.copyIconSuccess.classList.toggle('hidden', !copied);
    elements.copyBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700', 'bg-green-600', 'bg-red-600');
    elements.copyBtn.classList.add(copied ? 'bg-green-600' : 'bg-red-600');
    if (copied) showStatus('Copied to clipboard.');
    else showStatus('Could not copy. Select the passphrase and copy it manually.', true);
    copyResetTimeout = setTimeout(() => {
        elements.copyIconDefault.classList.remove('hidden');
        elements.copyIconSuccess.classList.add('hidden');
        elements.copyBtn.classList.remove('bg-green-600', 'bg-red-600');
        elements.copyBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
        clearStatus();
    }, 2000);
}

function scaleFontSizeForWord(element, text) {
    if (!element || !text) return;
    const baseFontSize = 18;
    const pane = element.closest('[id$="-pane"]');
    if (!pane) return;
    
    const paneStyle = window.getComputedStyle(pane);
    const availableWidth = pane.offsetWidth - parseFloat(paneStyle.paddingLeft) - parseFloat(paneStyle.paddingRight) - 4;
    
    const tempSpan = document.createElement('span');
    Object.assign(tempSpan.style, {
        visibility: 'hidden', position: 'absolute', whiteSpace: 'nowrap',
        fontFamily: window.getComputedStyle(element).fontFamily,
        fontWeight: window.getComputedStyle(element).fontWeight,
        fontSize: baseFontSize + 'px'
    });
    tempSpan.textContent = text;
    document.body.appendChild(tempSpan);
    const textWidth = tempSpan.offsetWidth;
    document.body.removeChild(tempSpan);
    
    let fontSize = baseFontSize;
    if (textWidth > availableWidth && availableWidth > 0) {
        fontSize = Math.max((availableWidth / textWidth) * baseFontSize, 10);
    }
    element.style.fontSize = fontSize + 'px';
}

function getDisplayParts() {
    const displayParts = { ...passphraseParts };
    
    // Decapitalize then Capitalize logic
    displayParts.word1 = displayParts.word1.toLowerCase();
    displayParts.word2 = displayParts.word2.toLowerCase();
    displayParts.word3 = displayParts.word3.toLowerCase();
    
    if (displayParts[capitalizedWordKey] && partOptional[capitalizedWordKey]) {
        displayParts[capitalizedWordKey] = capitalize(displayParts[capitalizedWordKey]);
    }
    return displayParts;
}

// Redraws the part panes only; never touches the passphrase field.
function renderPanes(displayParts) {
    const paneMap = {
        word1: 'word1-pane', word2: 'word2-pane', optDigit: 'optdigit-pane',
        word3: 'word3-pane', number: 'number-pane', specialChars: 'specialchars-pane'
    };
    // Update UI Elements
    Object.keys(elements.val).forEach(key => {
        const element = elements.val[key];
        const isOptional = partOptional[key];
        
        if (!isOptional) {
            element.innerHTML = '<span class="text-red-500 text-2xl">✕</span>';
            element.style.fontSize = '';
        } else {
            element.textContent = displayParts[key];
            element.classList.remove('text-gray-500');
            scaleFontSizeForWord(element, displayParts[key]);
        }
        
        // Highlights
        const pane = document.getElementById(paneMap[key]);
        if (pane) isOptional ? pane.classList.add('part-optional') : pane.classList.remove('part-optional');
        const toggle = pane && pane.querySelector('.part-toggle');
        if (toggle) toggle.setAttribute('aria-pressed', String(isOptional));
        // Buttons
        const btn = elements.btn[key];
        if (btn) {
            btn.disabled = !isOptional;
            btn.className = isOptional 
                ? 'resample-btn bg-gray-600 hover:bg-gray-500 text-white text-sm py-2 px-3 rounded-lg w-full transition-all duration-150'
                : 'resample-btn bg-gray-400 cursor-not-allowed opacity-50 text-white text-sm py-2 px-3 rounded-lg w-full transition-all duration-150';
        }
    });
}

function updateDisplay() {
    const displayParts = getDisplayParts();
    renderPanes(displayParts);
    // Build Final String based on Order
    const order = getPartsOrder();
    generatedValue = order.map(part => partOptional[part] ? displayParts[part] : '').join('');
    elements.output.value = generatedValue;
    
    updateSecurityReport();
}

// The text updateDisplay last generated; the field differs from it once the
// user edits the passphrase.
let generatedValue = '';

function updateSecurityReport() {
    // Scenario 1: what the generator put in
    const generatorBits = calculateGeneratorEntropy(partOptional, getSelectedWords().length);
    document.getElementById('generator-bits').textContent = generatorBits.toFixed(1);
    document.getElementById('combinations-count').textContent = formatCombinations(2 ** generatorBits);

    // Scenario 2: character-based ceiling
    const current = elements.output.value;
    const entropyData = calculateEntropy(current);
    document.getElementById('password-length').textContent = entropyData.length;
    document.getElementById('entropy-bits').textContent = entropyData.entropy.toFixed(1);

    // Headline: the generator's entropy, plus at most what the user's edits add
    const edits = current === '' ? null : estimateEdits(generatedValue, current);
    const editNotes = document.getElementById('edit-notes');
    let bits = generatorBits;
    let bitsText = `${generatorBits.toFixed(1)} bits`;
    if (current === '') {
        bits = 0;
        bitsText = '';
        editNotes.textContent = '';
    } else if (edits === null) {
        bits = 0;
        bitsText = '';
        editNotes.textContent = 'This is mostly your own text, so its strength cannot be estimated from the generator.';
    } else if (edits.edits > 0) {
        const plural = edits.edits === 1 ? 'change' : 'changes';
        bitsText = `${generatorBits.toFixed(1)}–${(generatorBits + edits.maxExtraBits).toFixed(1)} bits`;
        editNotes.textContent = `You made ${edits.edits} ${plural}. Random changes add up to ${edits.maxExtraBits.toFixed(1)} bits; predictable ones (such as "!" at the end) add little, because cracking tools try them.`;
    } else {
        editNotes.textContent = '';
    }

    const level = getStrengthLevel(bits);
    const levelEl = document.getElementById('security-level');
    levelEl.textContent = level.level;
    levelEl.className = `font-bold px-3 py-1 rounded-lg inline-block ${level.color} ${level.textColor}`;
    document.getElementById('strength-bits').textContent = bitsText;
    document.getElementById('security-notes').textContent = level.notes;
}

// --- DRAG AND DROP UTILS ---
function getPartsOrder() {
    const container = document.getElementById('parts-container');
    if (!container) return Object.keys(passphraseParts);
    return Array.from(container.children).map(pane => pane.getAttribute('data-part'));
}

function savePartsOrder() {
    // Storage can be blocked (private mode, site data disabled); the order
    // then simply is not remembered.
    try {
        localStorage.setItem('passphrasePartsOrder', JSON.stringify(getPartsOrder()));
    } catch (e) { console.error(e); }
}

const PREFS_KEY = 'passphrasePrefs';

// Only the on/off choices are stored, never a passphrase or a part of one.
function savePrefs() {
    try {
        localStorage.setItem(PREFS_KEY, JSON.stringify({ parts: partOptional, wordLists: wordListSelected }));
    } catch (e) { console.error(e); }
}

function loadPrefs() {
    const defaults = { parts: { ...partOptional }, wordLists: { ...wordListSelected } };
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem(PREFS_KEY));
    } catch (e) { console.error(e); }
    const prefs = mergePrefs(saved, defaults);
    Object.assign(partOptional, prefs.parts);
    Object.assign(wordListSelected, prefs.wordLists);
}

function togglePart(key) {
    if (!wordsReady) return;
    partOptional[key] = !partOptional[key];
    if (partOptional[key]) {
        if (passphraseParts[key] === '') passphraseParts[key] = generatePart(key);
    } else {
        passphraseParts[key] = '';
    }
    savePrefs();
    updateDisplay();
}

function generatePart(key) {
    if (key.startsWith('word')) return getRandomWord();
    if (key === 'optDigit') return getRandomDigit();
    if (key === 'number') return getRandomNumber();
    return getRandomSpecialChars();
}

function loadPartsOrder() {
    try {
        const saved = localStorage.getItem('passphrasePartsOrder');
        if (saved) {
            const order = JSON.parse(saved);
            const container = document.getElementById('parts-container');
            const paneMap = {};
            Array.from(container.children).forEach(p => paneMap[p.getAttribute('data-part')] = p);
            order.forEach(part => { if (paneMap[part]) container.appendChild(paneMap[part]); });
        }
    } catch (e) { console.error(e); }
}

function getDragAfterElement(container, x, y) {
    const draggableElements = [...container.querySelectorAll('[draggable="true"]:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        // Simple logic: distance to center
        const distX = x - (box.left + box.width / 2);
        const distY = y - (box.top + box.height / 2);
        const distance = Math.sqrt(distX*distX + distY*distY);
        
        if (distance < closest.distance) return { distance: distance, element: child };
        else return closest;
    }, { distance: Number.POSITIVE_INFINITY }).element;
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Setup Drag
    loadPrefs();
    loadPartsOrder();
    const container = document.getElementById('parts-container');
    const panes = container.querySelectorAll('[draggable="true"]');
    
    panes.forEach(pane => {
        pane.addEventListener('dragstart', e => {
            draggedPane = pane;
            isDragOperation = true;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', pane.id);
            setTimeout(() => {
                pane.classList.add('dragging');
                pane.style.display = 'none';
                placeholder = document.createElement('div');
                placeholder.className = 'drag-placeholder';
                pane.parentNode.insertBefore(placeholder, pane);
            }, 0);
        });

        pane.addEventListener('dragend', () => {
            if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
            placeholder = null;
            if (draggedPane) {
                draggedPane.classList.remove('dragging');
                draggedPane.style.display = ''; 
            }
            draggedPane = null;
            setTimeout(() => isDragOperation = false, 100);
            savePartsOrder();
            updateDisplay();
        });
    });

    container.addEventListener('dragover', e => {
        e.preventDefault();
        if (!draggedPane || !placeholder) return;
        const afterElement = getDragAfterElement(container, e.clientX, e.clientY);
        if (afterElement == null) container.appendChild(placeholder);
        else container.insertBefore(placeholder, afterElement);
    });
    
    container.addEventListener('drop', e => {
        e.preventDefault();
        if (draggedPane && placeholder) container.insertBefore(draggedPane, placeholder);
    });

    // 2. Event Listeners (attached before the word lists load; the handlers
    // do nothing until wordsReady)
    elements.genAllBtn.addEventListener('click', generateAll);
    
    elements.copyBtn.addEventListener('click', async () => {
        const copied = await copyText(elements.output.value, {
            writeText: navigator.clipboard ? (text) => navigator.clipboard.writeText(text) : undefined,
            legacyCopy: () => {
                elements.output.select();
                return document.execCommand('copy');
            }
        });
        showCopyResult(copied);
    });

    elements.output.addEventListener('input', updateSecurityReport);

    document.getElementById('wordlist-en-pane').addEventListener('click', () => toggleWordList('en'));
    document.getElementById('wordlist-nl-pane').addEventListener('click', () => toggleWordList('nl'));

    // Resample buttons (prevent drag/toggle on click)
    Object.keys(elements.btn).forEach(key => {
        elements.btn[key].addEventListener('click', (e) => {
            e.stopPropagation();
            if (!wordsReady) return;
            if (partOptional[key]) {
                passphraseParts[key] = generatePart(key);
                updateDisplay();
            }
        });
        
        // Prevent drag on button mousedown
        elements.btn[key].addEventListener('mousedown', (e) => {
            e.stopPropagation();
            const pane = elements.btn[key].closest('[draggable]');
            if(pane) {
                pane.draggable = false;
                setTimeout(() => pane.draggable = true, 100);
            }
        });
    });

    // Toggle Pane Logic (complex click vs drag detection)
    const paneMap = {
        word1: 'word1-pane', word2: 'word2-pane', optDigit: 'optdigit-pane',
        word3: 'word3-pane', number: 'number-pane', specialChars: 'specialchars-pane'
    };
    
    let clickStartPos = null;
    let clickStartTime = null;
    Object.keys(paneMap).forEach(key => {
        const pane = document.getElementById(paneMap[key]);
        if(!pane) return;
        pane.addEventListener('mousedown', e => {
            if (e.target.closest('.resample-btn')) return;
            clickStartPos = { x: e.clientX, y: e.clientY };
            clickStartTime = Date.now();
        });
        pane.addEventListener('click', e => {
            if (e.target.closest('.resample-btn')) return;
            if (isDragOperation || !wordsReady) return;
            
            // Check if it was a drag attempt based on movement/time
            if (!clickStartPos) return;
            const dx = Math.abs(e.clientX - clickStartPos.x);
            const dy = Math.abs(e.clientY - clickStartPos.y);
            const dt = Date.now() - clickStartTime;
            
            if (dx > 5 || dy > 5 || dt > 300) return; // Moved too much or held too long = drag
            togglePart(key);
        });

        // The label is a real button so the part can be toggled from the keyboard.
        pane.querySelector('.part-toggle').addEventListener('click', e => {
            e.stopPropagation();
            if (isDragOperation) return;
            togglePart(key);
        });
    });

    // Resize only rescales the pane text. It must not rebuild the passphrase
    // field: that would discard edits (a mobile keyboard opening fires resize).
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => renderPanes(getDisplayParts()), 100);
    });

    // 3. Load Data, then Initial Run
    updateDisplay();
    try {
        await loadWords();
    } catch (error) {
        console.error('Failed to load word lists:', error);
        elements.output.placeholder = 'Unavailable';
        showStatus('Could not load the word lists, so no passphrase was generated. Reload the page to try again.', true);
        return;
    }
    elements.output.placeholder = '';
    elements.genAllBtn.disabled = false;
    elements.copyBtn.disabled = false;
    generateAll();
});
