// --- File: js/votd.js ---
// This module encapsulates all functionality for the Verse of the Day feature.
console.log("[Module Init] votd.js loaded.");

import * as api from './api.js';
import { currentState } from './state.js';
import { fallbackCopyTextToClipboard } from './utils.js';
import { showTempMessage } from './ui.js'; // <-- ADD THIS LINE

// ===================================================================================
// DOM ELEMENT REFERENCES
// ===================================================================================

const verseCard = document.getElementById('verseCard');
const verseCardTitle = verseCard?.querySelector('.verse-title');
const verseCardText = verseCard?.querySelector('.verse-text');
const verseCardReference = verseCard?.querySelector('.verse-reference');
const verseCardShareBtn = document.getElementById('shareBtn');
const verseCardSaveBtn = document.getElementById('saveBtn');
const verseCardCopyBtn = document.getElementById('copyBtn');

const fullscreenVerseOverlay = document.getElementById('fullscreenVerse');
const fullscreenVerseContent = fullscreenVerseOverlay?.querySelector('.fullscreen-content');
const fullscreenVerseCloseBtn = fullscreenVerseOverlay?.querySelector('.close-btn');
const fullscreenVerseTitle = fullscreenVerseOverlay?.querySelector('.verse-title');
const fullscreenVerseText = fullscreenVerseOverlay?.querySelector('.verse-text');
const fullscreenVerseReference = fullscreenVerseOverlay?.querySelector('.verse-reference');

// ===================================================================================
// MODULE-LEVEL STATE
// ===================================================================================

const votdState = {
    // Holds the raw reference data from the DB { book_id, chapter_num, verse_num }
    reference: null,
    // Holds the prepared text and display reference for the current language
    text: null,
    displayRef: null,
};

// Module-level variables to hold dependencies passed from app.js
let _openReadingView = null;
let _saveItems = null; // Changed from _saveUserItems
let _renderUserItems = null;

// ===================================================================================
// PRIVATE UI FUNCTIONS
// ===================================================================================

// Dropdown logic removed in UI update

/**
 * Toggles the fullscreen overlay for the Verse of the Day.
 * @param {boolean} [show] - Force show/hide, or toggle if undefined.
 */
function _toggleFullscreen(show) {
    if (!fullscreenVerseOverlay) return;
    const isActive = fullscreenVerseOverlay.classList.contains('active');

    if (show === undefined) {
        show = !isActive;
    }

    if (show && !isActive) {
        fullscreenVerseOverlay.classList.add('active');
        fullscreenVerseOverlay.setAttribute('aria-hidden', 'false');
        if (verseCardText && fullscreenVerseText) fullscreenVerseText.innerHTML = votdState.text || '';
        if (verseCardReference && fullscreenVerseReference) fullscreenVerseReference.textContent = votdState.displayRef || '';
        if (verseCardTitle && fullscreenVerseTitle) fullscreenVerseTitle.textContent = verseCardTitle.textContent;
    } else if (!show && isActive) {
        fullscreenVerseOverlay.classList.remove('active');
        fullscreenVerseOverlay.setAttribute('aria-hidden', 'true');
    }
}

/** Renders the VOTD card based on the internal module state. */
function _renderUI() {
    if (!verseCard || !verseCardTitle || !verseCardText || !verseCardReference) {
        if (verseCard) verseCard.style.display = 'none';
        return;
    }

    const hasData = votdState.text && votdState.displayRef;

    if (!hasData) {
        verseCardTitle.textContent = "Verse of the Day";
        verseCardText.innerHTML = '<em>Loading...</em>';
        verseCardReference.textContent = '';
        verseCard.style.display = '';
        if (verseCardDropdownMenu) {
            verseCardDropdownMenu.querySelectorAll('.menu-item').forEach(item => item.disabled = true);
        }
        return;
    }

    verseCardTitle.textContent = "Today's Scripture";
    verseCardText.innerHTML = votdState.text;
    verseCardReference.textContent = votdState.displayRef;
    verseCard.style.display = '';
}

// ===================================================================================
// PRIVATE DATA & ACTION FUNCTIONS
// ===================================================================================

/** Fetches the VOTD reference, then its text, and updates the state. */
async function _fetchAndPrepareVotd() {
    // 1. Fetch the reference (book, chapter, verse numbers)
    const { data: refData, error: refError } = await api.fetchVerseOfTheDayReference();

    if (refError || !refData) {
        console.error("VOTD Module: Could not fetch verse reference.", refError || "No data returned.");
        votdState.reference = null;
        votdState.text = '<em>Verse not available right now. Please check back later.</em>';
        votdState.displayRef = '';
        _renderUI();
        return;
    }
    votdState.reference = refData;

    // 2. Fetch the text for that reference in the current language
    const { book_id, chapter_num, verse_num } = refData;
    const { data: textDataArray, error: textError } = await api.fetchVerseText({
        bookId: book_id,
        chapter: chapter_num,
        startVerse: verse_num,
        language: currentState.language
    });

    if (textError || !textDataArray?.[0]?.verse_text) {
        console.error("VOTD Module: Could not fetch verse text.", textError || "No text data returned.");
        votdState.text = '<em>Verse text could not be loaded.</em>';
        votdState.displayRef = '';
        _renderUI();
        return;
    }

    // 3. Prepare state for rendering
    votdState.text = textDataArray[0].verse_text;
    const bookInfo = currentState.booksInfo[book_id];
    const displayBookName = bookInfo ? (currentState.language === 'en' ? bookInfo.englishName || book_id : bookInfo.amharicName || book_id) : book_id;
    votdState.displayRef = `${displayBookName} ${chapter_num}:${verse_num}`;

    // 4. Render the final result
    _renderUI();
}

/** Handles the "Save" button click. */
async function _handleSaveFavourite() {
    if (!votdState.reference) {
        showTempMessage("Cannot save, verse data not loaded.", "error");
        return;
    }

    // Check if the functions were passed in during init
    if (!_saveItems || !_renderUserItems) {
        console.error("VOTD Module: Dependencies (saveItems, renderUserItems) not provided during init.");
        return;
    }

    const { book_id, chapter_num, verse_num } = votdState.reference;
    const verseId = `v-${book_id.replace(/[^a-zA-Z0-9]/g, "-")}-${chapter_num}-${verse_num}`;
    const existingFavIndex = currentState.userFavourites.findIndex(fav => fav.verseId === verseId);

    if (existingFavIndex > -1) {
        if (confirm(`"${votdState.displayRef}" is already a favourite. Remove it?`)) {
            currentState.userFavourites.splice(existingFavIndex, 1);
            _saveItems('userFavourites', 'userFavourites');
            _renderUserItems('favourite');
            showTempMessage("Removed from favourites.", "success");
        }
    } else {
        const newFavourite = {
            id: `fav-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            bookId: book_id,
            chapter: chapter_num,
            verse: verse_num,
            verseId: verseId,
            verseText: votdState.text,
            displayRef: votdState.displayRef,
            timestamp: Date.now()
        };
        currentState.userFavourites.push(newFavourite);
                    _saveItems('userFavourites', 'userFavourites');
        _renderUserItems('favourite');
        showTempMessage("Added to favourites!", "success");
    }
}

/** Handles the "Copy" button click. */
function _handleCopy() {
    if (!votdState.text || !votdState.displayRef) {
        showTempMessage('Verse content not available to copy.', 'error');
        return;
    }
    const textToCopy = `"${votdState.text}"\n- ${votdState.displayRef}`;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            showTempMessage('Verse of the Day copied!', 'success');
        }, () => fallbackCopyTextToClipboard(textToCopy));
    } else {
        fallbackCopyTextToClipboard(textToCopy);
    }
}

/** Handles the "Share" button click. */
async function _handleShare() {
    if (!votdState.text || !votdState.displayRef) {
        showTempMessage('Verse content not available to share.', 'error');
        return;
    }

    const shareData = {
        title: "Verse of the Day",
        text: `"${votdState.text}"\n- ${votdState.displayRef}`,
    };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Error sharing VotD:', err);
                showTempMessage('Could not share verse.', 'error');
            }
        }
    } else {
        showTempMessage('Web Share not supported. Copied instead!', 'info');
        _handleCopy();
    }
}

/** Handles clicks on the main VOTD card. */
function _handleCardClick(event) {
    // Ignore clicks on any button inside the card (Share, Copy, Save)
    if (event.target.closest('button')) return;
    
    // If the reference part is clicked, navigate to the chapter
    if (event.target.closest('.verse-reference')) {
        const verse = votdState.reference;
        if (verse?.book_id && verse?.chapter_num && _openReadingView) {
            _openReadingView(verse.book_id, verse.chapter_num, `${verse.chapter_num}:${verse.verse_num}`);
        }
    } else {
        // Otherwise, open the fullscreen view
        _toggleFullscreen(true);
    }
}

// ===================================================================================
// PUBLIC INTERFACE
// ===================================================================================

/**
 * Initializes the Verse of the Day module.
 * @param {object} dependencies - Functions from app.js needed for cross-module interaction.
 * @param {function} dependencies.openReadingView - Function to open the main reading view.
 * @param {function} dependencies.saveItems - Function from userdata.js to save items.
 * @param {function} dependencies.renderUserItems - Function from ui.js to re-render the favourites/notes list.
 */
export function init(dependencies) {
    // Store dependencies
    _openReadingView = dependencies.openReadingView;
    _saveItems = dependencies.saveItems;
    _renderUserItems = dependencies.renderUserItems;

    // Set up event listeners
    verseCard?.addEventListener('click', _handleCardClick);
    
    // Button listeners
    verseCardSaveBtn?.addEventListener('click', (e) => { e.stopPropagation(); _handleSaveFavourite(); });
    verseCardShareBtn?.addEventListener('click', (e) => { e.stopPropagation(); _handleShare(); });
    verseCardCopyBtn?.addEventListener('click', (e) => { e.stopPropagation(); _handleCopy(); });
    fullscreenVerseCloseBtn?.addEventListener('click', (e) => { e.stopPropagation(); _toggleFullscreen(false); });
    fullscreenVerseOverlay?.addEventListener('click', (e) => { if (e.target === fullscreenVerseOverlay) _toggleFullscreen(false); });

    // Initial render (shows "Loading...") and data fetch
    _renderUI();
    _fetchAndPrepareVotd();
    
    console.log("VOTD module initialized.");
}

/** Re-fetches the VOTD text (e.g., for language change) and re-renders the card. */
export async function refresh() {
    // No need to fetch reference again, just re-fetch text and re-render.
    if (!votdState.reference) {
        await _fetchAndPrepareVotd(); // If there was no reference, do a full fetch
    } else {
        const { book_id, chapter_num, verse_num } = votdState.reference;
        const { data: textDataArray, error: textError } = await api.fetchVerseText({
            bookId: book_id,
            chapter: chapter_num,
            startVerse: verse_num,
            language: currentState.language
        });

        if (!textError && textDataArray?.[0]?.verse_text) {
            votdState.text = textDataArray[0].verse_text;
            const bookInfo = currentState.booksInfo[book_id];
            const displayBookName = bookInfo ? (currentState.language === 'en' ? bookInfo.englishName || book_id : bookInfo.amharicName || book_id) : book_id;
            votdState.displayRef = `${displayBookName} ${chapter_num}:${verse_num}`;
        } else {
            console.error("VOTD Module Refresh: Could not re-fetch verse text.", textError);
            // Keep existing text as a fallback
        }
        _renderUI();
    }
}
