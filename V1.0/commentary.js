// --- File: js/commentary.js ---
// This module handles the logic for displaying and interacting with the
// inline commentary expansion panel within the reading view.
console.log("[Module Init] commentary.js loaded.");

import { currentState } from './state.js';
import * as ui from './ui.js';

// ===================================================================================
// MODULE-LEVEL STATE & DEPENDENCIES
// ===================================================================================

let _openReadingView = null; // Dependency injected from app.js for navigation
let _activeExpansionPanel = null; // Internal state for the current DOM element

// ===================================================================================
// PRIVATE HELPER FUNCTIONS
// ===================================================================================

/**
 * Handles the click of the "Go to full commentary" button inside the panel.
 * @param {HTMLButtonElement} button - The button that was clicked.
 */
function _handleGoToFullCommentaryClick(button) {
    if (!_openReadingView) {
        console.error("Commentary Module: `openReadingView` is not initialized.");
        return;
    }
    
    const { targetBookId, targetChapter, targetVerse } = button.dataset;

    if (!targetBookId || !targetChapter || !targetVerse || !currentState.booksInfo[targetBookId]) {
        ui.showTempMessage("Navigation failed: Missing reference data.", "error");
        close();
        return;
    }

    // Set the mode to commentary before navigating
    currentState.readingContentMode = 'commentary';

    // Construct the display reference for the "Back to..." button
    const triggerVerseId = _activeExpansionPanel?.dataset.triggerVerseId;
    let sourceDisplayRef = null;
    if (triggerVerseId) {
        const idMatch = triggerVerseId.match(/^v-([a-z0-9-]+)-(\d+)-(\d+)$/);
        if (idMatch) {
            const [_, sourceBookId, sourceChapter, sourceVerse] = idMatch;
            const sourceBookInfo = currentState.booksInfo[sourceBookId];
            if (sourceBookInfo) {
                const sourceDisplayBookName = currentState.language === 'en' ? sourceBookInfo.englishName : sourceBookInfo.amharicName || sourceBookId;
                sourceDisplayRef = `${sourceDisplayBookName} ${sourceChapter}:${sourceVerse}`;
            }
        }
    }

    try {
        _openReadingView(
            targetBookId,
            parseInt(targetChapter, 10),
            `${targetChapter}:${targetVerse}`, // Target for scrolling
            sourceDisplayRef // Source for the "Back to" button
        );
    } catch (e) {
        console.error("Commentary Module: Error during openReadingView call:", e);
        ui.showTempMessage("An error occurred during navigation.", "error");
    } finally {
        close(); // Always close the panel after the action
    }
}

// ===================================================================================
// PUBLIC API
// ===================================================================================

/**
 * Closes the currently open inline commentary panel.
 */
export function close() {
    if (_activeExpansionPanel) {
        // Use the existing UI function to handle removal and animation
        ui.removeActiveCommentaryExpansion(_activeExpansionPanel);
        _activeExpansionPanel = null;
    }
}

/**
 * Renders and displays the inline commentary panel for a given verse element.
 * @param {HTMLElement} verseElement - The <p> element of the verse.
 */
export function showForVerse(verseElement) {
    if (!verseElement) return;

    // Close any other open panels first
    close();
    if (window.cref) window.cref.closeExpansion(); // Ensure cross-ref is also closed

    const { bookId, chapterNum, verseNum } = verseElement.dataset;
    const verseData = currentState.versesDataForChapter?.find(v => 
        v.book_id === bookId && 
        v.chapter_num === parseInt(chapterNum) && 
        v.verse_num === parseInt(verseNum)
    );

    if (!verseData) {
        ui.showTempMessage('Commentary data not found for this verse.', 'error');
        return;
    }

    const commentaryText = verseData.commentary_text?.trim();
    if (!commentaryText) {
        ui.showTempMessage('No commentary available for this verse.', 'info');
        return;
    }
    
    // The ui.js module is responsible for the actual DOM creation
    const expansionPanel = ui.renderInlineCommentaryPanel(verseElement, commentaryText);

    if (expansionPanel) {
        _activeExpansionPanel = expansionPanel;
        
        // Wire up event listeners for the new panel
        expansionPanel.querySelector('.close-expansion-button')?.addEventListener('click', close);
        expansionPanel.querySelector('.go-to-full-commentary-button')?.addEventListener('click', (e) => _handleGoToFullCommentaryClick(e.target));
    }
}


/**
 * Initializes the Commentary module.
 * @param {object} dependencies - Dependencies from other modules.
 * @param {function} dependencies.openReadingView - Function to navigate the reading view.
 */
export function init(dependencies) {
    if (!dependencies.openReadingView) {
        throw new Error("Commentary Module Initialization Error: `openReadingView` dependency is required.");
    }
    _openReadingView = dependencies.openReadingView;
    // Expose a global handle to the cross-ref module for inter-module communication if needed.
    // This allows `commentary.showForVerse` to call `cref.closeExpansion`.
    window.commentary = { close }; 
    console.log("Commentary module initialized.");
}
