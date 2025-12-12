// --- File: js/cref.js ---
// This module handles all logic for the cross-reference feature, including fetching
// data, rendering the expansion panel, and handling user interactions within it.
console.log("[Module Init] cref.js loaded.");

import { getCrossRefDocId, normalizeBookName } from './utils.js';
import { currentState } from './state.js';
import * as api from './api.js';
import * as cache from './cache.js';
import * as ui from './ui.js';

// ===================================================================================
// MODULE-LEVEL STATE & DEPENDENCIES
// ===================================================================================

let _openReadingView = null; // Dependency injected from app.js to handle navigation
let _activeExpansionPanel = null; // Internal state to track the currently visible panel element

// ===================================================================================
// PRIVATE HELPER FUNCTIONS
// ===================================================================================

/**
 * Fetches the text content for a single verse reference string (e.g., "genesis-1-1").
 * This is a critical dependency for building the cross-reference list.
 * It uses an offline-first strategy, checking the cache before falling back to the API.
 * @param {string} refString - The canonical reference ID string.
 * @returns {Promise<string>} The verse text or an appropriate status message.
 */
async function _getVerseTextContent(refString) {
    if (!refString || typeof refString !== "string") {
        return "[Invalid Ref Format]";
    }

    const dbIdMatch = refString.match(/^([a-z0-9-]+)-(\d+)-(\d+(?:-\d+)?)$/);
    if (!dbIdMatch) {
        console.warn(`_getVerseTextContent: Could not parse DB ID format for "${refString}".`);
        return `[Parse Error: ${refString}]`;
    }

    const bookId = dbIdMatch[1];
    const chapterNum = parseInt(dbIdMatch[2], 10);
    const verseNumTarget = dbIdMatch[3];

    if (!currentState.booksInfo[bookId]) {
        return `[Unknown Book ID: ${bookId}]`;
    }

    let [startVerse, endVerse] = (verseNumTarget.includes('-') ? verseNumTarget.split('-') : [verseNumTarget, verseNumTarget]).map(Number);
    if (isNaN(startVerse) || isNaN(endVerse) || startVerse <= 0 || endVerse < startVerse) {
        return "[Invalid Verse/Range]";
    }

    try {
        // 1. Attempt to load from cache
        const storedChapterData = await cache.getChapter(bookId, chapterNum, currentState.language);
        if (storedChapterData?.data) {
            const targetVerses = storedChapterData.data
                .filter(v => v.verse_num >= startVerse && v.verse_num <= endVerse)
                .sort((a, b) => a.verse_num - b.verse_num);

            if (targetVerses.length > 0) {
                const collectedText = targetVerses.map(v => v.verse_text || "[Text Missing]").join(" ");
                return collectedText.trim() || "[Verse Text Missing]";
            }
        }

        // 2. Fallback to API if not in cache or verse not found in cached chapter
        const supabaseClient = api.getSupabaseClient();
        if (!supabaseClient) {
            return "[Offline: Content Unavailable]";
        }

        const { data: versesData, error } = await api.fetchVerseText({
            bookId, chapter: chapterNum, startVerse, endVerse, language: currentState.language
        });

        if (error && error.code !== 'PGRST116') {
            console.error(`Cref Module: Error fetching verses for ${refString}:`, error);
            return "[Data Fetch Error]";
        }
        if (!versesData || versesData.length === 0) {
            return "[Verse Not Found]";
        }

        const collectedText = versesData.map(v => v.verse_text || "[Text Missing]").join(" ");
        return collectedText.trim() || "[Verse Text Missing]";

    } catch (error) {
        console.error(`Cref Module: Error processing verse text for ${refString}:`, error);
        return "[Unexpected Error]";
    }
}

/**
 * Handles the click event for the "Go" button within a cross-reference panel.
 * It navigates the main reading view to the target reference.
 * @param {HTMLButtonElement} button - The button that was clicked.
 */
function _handleGoToRefClick(button) {
    if (!_openReadingView) {
        console.error("Cref Module: `openReadingView` function not initialized.");
        return;
    }

    const { targetBookId, targetChapter, targetVerse, sourceRef } = button.dataset;

    if (!targetBookId || !targetChapter || !currentState.booksInfo[targetBookId]) {
        ui.showTempMessage("Navigation failed: Missing reference data.", "error");
        return;
    }

    // The targetVersePart is sufficient for openReadingView's scrolling logic.
    const navigationTarget = targetVerse || '1';

    try {
        _openReadingView(targetBookId, parseInt(targetChapter, 10), navigationTarget, sourceRef);
    } catch (e) {
        console.error("Cref Module: Error during openReadingView call:", e);
        ui.showTempMessage("An error occurred during navigation.", "error");
    } finally {
        closeExpansion();
    }
}

// ===================================================================================
// PUBLIC API
// ===================================================================================

/**
 * Closes any currently open cross-reference expansion panel.
 * This is the single authoritative way to close the panel.
 */
export function closeExpansion() {
    if (_activeExpansionPanel) {
        // You can add animations here if desired, e.g., by adding a class
        // and listening for 'transitionend' before removing.
        _activeExpansionPanel.remove();
        _activeExpansionPanel = null;
    }
}

/**
 * Toggles the display of a cross-reference panel for a given trigger element.
 * This is the main entry point for the module's functionality.
 * @param {HTMLElement} triggerButton - The button element that triggered the action.
 */
export async function toggleExpansion(triggerButton) {
    const sourceRef = triggerButton.dataset.ref;
    if (!sourceRef) return;

    // If the same trigger is clicked again, just close the panel.
    if (_activeExpansionPanel && _activeExpansionPanel.dataset.triggerRef === sourceRef) {
        closeExpansion();
        return;
    }
    
    // Close any other panel that might be open before creating a new one.
    closeExpansion();
    ui.removeActiveCommentaryExpansion(); // Also close commentary panel for clean UI

    const sourceMatch = sourceRef.match(/^(.+?)\s+(\d+):(\d+(?:-\d+)?)$/);
    if (!sourceMatch) {
        ui.showTempMessage("Invalid source reference format.", "error");
        return;
    }
    const [_, sourceBookDisplayName, sourceChapterNum, sourceVerseNumPart] = sourceMatch;
    const sourceBookCanonicalId = normalizeBookName(sourceBookDisplayName.trim(), currentState.booksInfo, currentState.bookAliasMap);

    if (!sourceBookCanonicalId) {
        ui.showTempMessage(`Unknown source book: "${sourceBookDisplayName}"`, "error");
        return;
    }

    const crossRefDocId = getCrossRefDocId(sourceBookCanonicalId, sourceChapterNum, sourceVerseNumPart, currentState.booksInfo, currentState.bookAliasMap);
    if (!crossRefDocId) {
        ui.showTempMessage("No cross-references found for this verse.", "info", 2000);
        return;
    }

    let relatedRefsData = null;
    const lang = currentState.language;

    try {
        // --- OFFLINE-FIRST DATA FETCH ---
        const cachedData = await cache.getCoreData(`crossrefs_${lang}`);
        const localEntry = cachedData?.find(entry => entry?.doc_id === crossRefDocId && entry?.related_refs?.length > 0);
        if (localEntry) {
            relatedRefsData = localEntry.related_refs;
        } else if (api.getSupabaseClient()) {
            const { data, error } = await api.fetchCrossRefDetails(crossRefDocId);
            if (error && error.code !== 'PGRST116') throw error;
            relatedRefsData = data?.related_refs;
        } else {
            ui.showTempMessage("Offline. Cross-references not downloaded.", "info");
            return;
        }
        
        if (!relatedRefsData || relatedRefsData.length === 0) {
            ui.showTempMessage("No cross-references found.", "info", 2000);
            return;
        }

        // --- RENDER THE PANEL ---
        const expansionPanel = document.createElement('div');
        expansionPanel.className = 'cross-ref-expansion';
        expansionPanel.dataset.triggerRef = sourceRef;
        expansionPanel.setAttribute('role', 'dialog');
        expansionPanel.setAttribute('aria-label', `Cross References for ${sourceRef}`);
        expansionPanel.innerHTML = `<div class="panel-loading"><span class="loading-dots">Loading References...</span></div>`;

        const parentParagraph = triggerButton.closest('p[data-verse-id]');
        if (!parentParagraph) return;
        
        parentParagraph.insertAdjacentElement('afterend', expansionPanel);
        _activeExpansionPanel = expansionPanel;

        // Fetch text for all references in parallel
        const listItemPromises = relatedRefsData.map(async (refData) => {
            if (!refData?.ref) return '';
            
            const targetParts = refData.ref.match(/^([a-z0-9-]+)-(\d+)-(\d+(?:-\d+)?)$/);
            if (!targetParts) return `<li>Invalid Ref: ${refData.ref}</li>`;

            const [_, targetBookId, targetChapter, targetVerse] = targetParts;
            const targetBookInfo = currentState.booksInfo[targetBookId];
            const displayBook = targetBookInfo ? (lang === 'en' ? targetBookInfo.englishName : targetBookInfo.amharicName) || targetBookId : targetBookId;
            const displayTargetRef = `${displayBook} ${targetChapter}:${targetVerse}`;

            const verseText = await _getVerseTextContent(refData.ref);
            const goToButtonHtml = `<button class="go-to-ref-button" data-target-book-id="${targetBookId}" data-target-chapter="${targetChapter}" data-target-verse="${targetVerse}" data-source-ref="${sourceRef}" aria-label="Go to ${displayTargetRef}">Go</button>`;
            
            return `<li><div class="ref-details"><span class="cross-ref-target">${displayTargetRef}</span><span class="cross-ref-text">${verseText}</span></div>${goToButtonHtml}</li>`;
        });

        const listItemsHtml = await Promise.all(listItemPromises);
        
        // Populate the panel with the final content
        expansionPanel.innerHTML = `
            <button class="close-expansion-button" aria-label="Close references">×</button>
            <ul>${listItemsHtml.join('')}</ul>
        `;

        // Wire up event listeners for the new content
        expansionPanel.querySelector('.close-expansion-button')?.addEventListener('click', closeExpansion);
        expansionPanel.querySelectorAll('.go-to-ref-button').forEach(btn => {
            btn.addEventListener('click', () => _handleGoToRefClick(btn));
        });
        
        // Animate the panel opening
        requestAnimationFrame(() => {
            expansionPanel.style.maxHeight = '0px';
            expansionPanel.classList.add('visible');
            expansionPanel.style.maxHeight = expansionPanel.scrollHeight + 'px';
        });

    } catch (error) {
        console.error("Error displaying cross-references:", error);
        ui.showTempMessage("Error loading cross-references.", "error");
        closeExpansion(); // Clean up on error
    }
}

/**
 * Initializes the Cross-Reference module.
 * @param {object} dependencies - Dependencies from other modules.
 * @param {function} dependencies.openReadingView - The function from app.js to navigate the reading view.
 */
export function init(dependencies) {
    if (!dependencies.openReadingView) {
        throw new Error("Cref Module Initialization Error: `openReadingView` dependency is required.");
    }
    _openReadingView = dependencies.openReadingView;
    console.log("Cross-Reference module initialized.");
}
