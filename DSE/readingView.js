// --- File: js/readingView.js ---
// This module encapsulates all logic and state management for the Reading View.
// It handles content loading, navigation, UI interactions (like taps and selections),
// and communication with other modules (audio, cache, api) for its specific needs.
console.log("[Module Init] readingView.js loaded.");

import { currentState } from './state.js';
import * as api from './api.js';
import * as cache from './cache.js';
import * as ui from './ui.js';
import * as audio from './audio.js';
import * as userdata from './userdata.js';
import * as cref from './cref.js';
import * as commentary from './commentary.js';
import { normalizeBookName, fallbackCopyTextToClipboard } from './utils.js';

// ===================================================================================
// MODULE-LEVEL STATE
// ===================================================================================

const _state = {
    selectedVerseElements: new Set(),
    clickTimeoutId: null,
    lastClickedVerseElement: null,
    DOUBLE_TAP_DELAY: 250, // ms to wait for a second tap
};

// ===================================================================================
// PRIVATE: SELECTION MANAGEMENT
// ===================================================================================

/** Clears all verse selections and exits selection mode. */
function _clearAllSelections() {
    currentState.isSelectionMode = false;

    if (_state.selectedVerseElements.size === 0) {
        ui.updateActionBarVisibility(0);
        cref.closeExpansion();
        ui.removeActiveCommentaryExpansion();
        ui.showReadingUI();
        ui.resetUIAutoHide();
        return;
    }

    _state.selectedVerseElements.forEach(element => {
        element.classList.remove('selected');
    });
    _state.selectedVerseElements.clear();

    cref.closeExpansion();
    ui.removeActiveCommentaryExpansion();

    ui.updateActionBarVisibility(0);
    ui.showReadingUI();
    ui.resetUIAutoHide();
}

/**
 * Gathers and sorts details of all currently selected verses.
 * @returns {Array<object>} An array of verse detail objects.
 */
function _getSelectedVerseDetails() {
    return Array.from(_state.selectedVerseElements).map(element => ({
        bookId: element.dataset.bookId,
        chapter: parseInt(element.dataset.chapterNum, 10),
        verse: parseInt(element.dataset.verseNum, 10),
        verseId: element.dataset.verseId,
        text: element.textContent.trim()
    })).sort((a, b) => {
        if (a.bookId !== b.bookId) return a.bookId.localeCompare(b.bookId);
        if (a.chapter !== b.chapter) return a.chapter - b.chapter;
        return a.verse - b.verse;
    });
}

// ===================================================================================
// PRIVATE: ACTION BAR HANDLERS
// ===================================================================================

function _handleCopyAction() {
    const selected = _getSelectedVerseDetails();
    if (selected.length === 0) return;

    let fullText = "";
    let lastBook = null, lastChapter = null;

    selected.forEach(v => {
        const bookInfo = currentState.booksInfo[v.bookId];
        const displayBookName = currentState.language === 'en' ? bookInfo?.englishName || v.bookId : bookInfo?.amharicName || v.bookId;

        if (v.bookId !== lastBook || v.chapter !== lastChapter) {
            if (fullText !== "") fullText += "\n";
            fullText += `${displayBookName} ${v.chapter}\n`;
        }
        fullText += `  ${v.verse} ${v.text.replace(/^\d+[:\d-]+\s*/, '')}\n`;
        lastBook = v.bookId;
        lastChapter = v.chapter;
    });

    if (navigator.clipboard) {
        navigator.clipboard.writeText(fullText.trim()).then(() => {
            ui.showTempMessage('Verse(s) copied!', 'success');
        }, (err) => {
            console.error('Async clipboard write failed: ', err);
            fallbackCopyTextToClipboard(fullText.trim());
        });
    } else {
        fallbackCopyTextToClipboard(fullText.trim());
    }
    _clearAllSelections();
}

function _handleSaveAction() {
    const selectedDetails = _getSelectedVerseDetails();
    if (selectedDetails.length === 0) return;
    userdata.toggleFavouritesForVerses(selectedDetails, _state.selectedVerseElements);
    _clearAllSelections();
}

function _handleNoteAction() {
    const selectedDetails = _getSelectedVerseDetails();
    if (selectedDetails.length === 0) return;
    const note = prompt("Enter your note for the selected verse(s):");
    if (note !== null) {
        userdata.saveNoteForVerses(selectedDetails, note, _state.selectedVerseElements);
    }
    _clearAllSelections();
}

function _handleCommentaryAction() {
    if (_state.selectedVerseElements.size === 0) return;
    const firstSelectedElement = _state.selectedVerseElements.values().next().value;
    if (firstSelectedElement) {
        commentary.showForVerse(firstSelectedElement);
    }
    _clearAllSelections();
}


// ===================================================================================
// PRIVATE: CONTENT & NAVIGATION LOGIC
// ===================================================================================

/** Finds the verse ID closest to the vertical center of the viewport. */
export function  findCenterVisibleVerseId() {
    if (!ui.readingView?.classList.contains("active") || !ui.readingContent) {
        return null;
    }
    try {
        const containerRect = ui.readingContent.getBoundingClientRect();
        const visibleTop = Math.max(containerRect.top, 0);
        const visibleBottom = Math.min(containerRect.bottom, window.innerHeight);
        const centerY = visibleTop + (visibleBottom - visibleTop) / 2;
        const verseElements = ui.readingContent.querySelectorAll("p[data-verse-id]");
        let closestVerseId = null;
        let minDistance = Infinity;

        for (const p of verseElements) {
            const rect = p.getBoundingClientRect();
            if (rect.bottom > 0 && rect.top < window.innerHeight) {
                const distance = Math.abs(rect.top - centerY);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestVerseId = p.dataset.verseId;
                }
            }
        }
        return closestVerseId;
    } catch (e) {
        console.error("Error finding center visible verse:", e);
        return null;
    }
}

/** Loads and renders the content for the current chapter in the main state. */
async function _loadChapterContent(targetRefOrVerseId = null) {
    if (!currentState.book || !currentState.chapter) {
        if (ui.readingContent) ui.readingContent.innerHTML = '<p class="error-message">Error: No book or chapter.</p>';
        await ui.updateChapterNavUI(0);
        ui.updateProgressBar();
        currentState.versesDataForChapter = null;
        return;
    }

    const { book: bookId, chapter: chapterNum, language: lang } = currentState;
    const bookInfo = currentState.booksInfo[bookId];
    const displayBookName = bookInfo ? (lang === 'en' ? bookInfo.englishName : bookInfo.amharicName) || bookId : bookId;
    const titlePostfix = currentState.readingContentMode === 'commentary' ? ' - Commentary' : '';
    if (ui.readingTitle) ui.readingTitle.textContent = `${displayBookName} ${chapterNum}${titlePostfix}`;

    if (ui.readingContent) {
        ui.readingContent.innerHTML = '<p class="loading-message"><span class="loading-dots">Loading...</span></p>';
        ui.readingContent.scrollTop = 0;
    }

    cref.closeExpansion();
    ui.removeActiveCommentaryExpansion();

    try {
        let versesData = (await cache.getChapter(bookId, chapterNum, lang))?.data;

        if (!versesData) {
            const supabaseClient = api.getSupabaseClient();
            if (!supabaseClient) {
                throw new Error("Content not available offline. DB Error.");
            }
            const { data: fetchedData, error } = await api.fetchChapterContent({ bookId, chapter: chapterNum, language: lang });
            if (error) throw error;
            if (!fetchedData || fetchedData.length === 0) {
                throw new Error(`No content found for ${displayBookName} ${chapterNum}.`);
            }
            versesData = fetchedData;
            cache.saveChapter(bookId, chapterNum, lang, versesData, false);
        }

        currentState.versesDataForChapter = versesData;

        if (ui.readingContent) {
            ui.readingContent.innerHTML = '';
            const chapterHeaderText = versesData[0]?.[`chapters_${lang}`]?.header_text?.trim();
            if (chapterHeaderText) ui.renderChapterIntroduction(chapterHeaderText, ui.readingContent);

            if (currentState.readingContentMode === 'scripture') {
                const crossRefsMap = await _getCrossRefMapForChapter(bookId, chapterNum, lang);
                ui.renderChapterScripture(versesData, crossRefsMap);
            } else {
                ui.renderChapterCommentary(versesData);
            }
            _clearAllSelections();
        }

        const chapterCount = currentState.booksInfo[bookId]?.chapters || 0;
        await ui.updateChapterNavUI(chapterCount);
        ui.performScrollAndHighlightLogic(targetRefOrVerseId);
        ui.updateAudioUI();

    } catch (error) {
        console.error(`LoadChapter Error for ${bookId}-${chapterNum}-${lang}:`, error);
        if (ui.readingContent) ui.readingContent.innerHTML = `<p class="error-message">Error loading chapter: ${error.message}</p>`;
        currentState.versesDataForChapter = null;
        await ui.updateChapterNavUI(0);
        ui.updateProgressBar();
        ui.updateAudioUI();
    }
}

/** Fetches or builds the cross-reference map for a given chapter. */
async function _getCrossRefMapForChapter(bookId, chapterNum, lang) {
    const globalLangMap = await _getOrBuildGlobalCrossRefMap(lang);
    if (globalLangMap?.size > 0) {
        return globalLangMap;
    }
    
    // Fallback to per-chapter network request if global map is unavailable
    const crossRefsMap = new Map();
    const supabaseClient = api.getSupabaseClient();
    if (supabaseClient) {
        const { data: idsData } = await api.fetchChapterCrossRefIds({ bookId, chapter: chapterNum });
        idsData?.forEach(item => item?.doc_id && crossRefsMap.set(item.doc_id, true));
    }
    return crossRefsMap;
}

/** Caches the global cross-reference map for a language to improve performance. */
async function _getOrBuildGlobalCrossRefMap(language) {
    if (currentState.globalCrossRefsMapByLang[language] instanceof Map) {
        return currentState.globalCrossRefsMapByLang[language];
    }

    const map = new Map();
    try {
        const cachedData = await cache.getCoreData(`crossrefs_${language}`);
        if (cachedData) {
            cachedData.forEach(entry => {
                if (entry?.doc_id) map.set(entry.doc_id, true);
            });
        }
    } catch (e) {
        console.error(`Error building global cross-ref map for ${language}:`, e);
    }
    currentState.globalCrossRefsMapByLang[language] = map;
    return map;
}

// ===================================================================================
// PUBLIC API
// ===================================================================================

/**
 * Opens the reading view to a specific book, chapter, and optional verse.
 * This is the primary entry point for displaying scripture.
 */
export async function open(bookIdOrName, chapterNum = 1, targetRefOrVerseId = null, sourceReference = null) {
    const bookId = normalizeBookName(bookIdOrName, currentState.booksInfo, currentState.bookAliasMap);

    if (!bookId || !currentState.booksInfo[bookId]) {
        ui.showTempMessage(`Book "${bookIdOrName}" not found.`, 'error');
        return;
    }

    currentState.book = bookId;
    currentState.chapter = parseInt(chapterNum) || 1;
    currentState.targetVerseRef = targetRefOrVerseId;
    currentState.sourceReferenceForBackNav = sourceReference;

    const displayBookName = currentState.booksInfo[bookId] ?
        (currentState.language === 'en' ? currentState.booksInfo[bookId].englishName : currentState.booksInfo[bookId].amharicName) || bookId :
        bookId;

    if (ui.readingTitle) ui.readingTitle.textContent = `${displayBookName} ${currentState.chapter}`;

    userdata.updateRecentBooks(bookId, currentState.chapter, currentState.targetVerseRef);

    ui.readingView.classList.add('active');
    ui.readingView.setAttribute('aria-hidden', 'false');
    ui.body.style.overflow = 'hidden';
    ui.applyReadingSettings();

    const chapterCount = currentState.booksInfo[bookId]?.chapters || 0; // Use cached chapter count if available
    ui.generateChapterNav(chapterCount);
    ui.updateCrossRefBackButton();
    ui.updateReadingContentModeUI();

    audio.updateViewContext(currentState.book, currentState.chapter, currentState.language);
    await _loadChapterContent(currentState.targetVerseRef);

    ui.resetUIAutoHide();
    if (ui.settings.keepAwakeToggle?.checked) {
        // This function will need to be exposed from app.js or moved to a general `system.js` module
        window.requestWakeLock?.(); 
    }
    ui.removeActiveCommentaryExpansion();
    currentState.currentView = 'readingTabView';
}

/** Closes the reading view and performs necessary cleanup. */
export function close() {
    if (!ui.readingView?.classList.contains('active')) return;

    clearTimeout(currentState.scrollSaveTimeoutId);
    userdata.updateCurrentRecentPosition(findCenterVisibleVerseId());

    audio.stop();
    
    ui.readingView.classList.remove('active');
    ui.readingView.setAttribute('aria-hidden', 'true');
    ui.body.style.overflow = '';
    
    currentState.book = null;
    currentState.chapter = 1;
    currentState.targetVerseRef = null;
    currentState.sourceReferenceForBackNav = null;
    ui.updateCrossRefBackButton();
    clearTimeout(currentState.uiHideTimeoutId);
    window.releaseWakeLock?.(); // Expose from app.js or move to `system.js`
    
    cref.closeExpansion();
    _clearAllSelections();

ui.renderRecentBooks();
}

/** Navigates to the previous or next chapter. */
export async function navigateChapter(direction) {
    if (!currentState.book) return;
    const totalChapters = currentState.booksInfo[currentState.book]?.chapters || 0;
    if (totalChapters <= 0) return;

    const newChapter = currentState.chapter + direction;
    if (newChapter >= 1 && newChapter <= totalChapters) {
        currentState.chapter = newChapter;
        currentState.targetVerseRef = null;
        currentState.sourceReferenceForBackNav = null;
        ui.updateCrossRefBackButton();
        audio.updateViewContext(currentState.book, currentState.chapter, currentState.language);
        await _loadChapterContent();
        ui.resetUIAutoHide();
    }
}

/** Toggles between 'scripture' and 'commentary' content modes. */
export function toggleContentMode() {
    if (!ui.readingView?.classList.contains('active') || !currentState.versesDataForChapter) {
        ui.showTempMessage("Cannot toggle view: Chapter data not available.", "warning");
        return;
    }
    
    const newMode = currentState.readingContentMode === 'scripture' ? 'commentary' : 'scripture';
    currentState.readingContentMode = newMode;
    ui.updateReadingContentModeUI();
    _clearAllSelections();
    audio.stop();
    _loadChapterContent(null);
    ui.resetUIAutoHide();
}

// ===================================================================================
// EVENT HANDLERS
// ===================================================================================

export function handleContentClick(event) {
    const crossRefTrigger = event.target.closest('.cross-ref-trigger');
    if (crossRefTrigger) {
        cref.toggleExpansion(crossRefTrigger);
        return;
    }
    // Commentary-related clicks will be handled separately in their module/UI file.

    const verseParagraph = event.target.closest('p.verse-paragraph[data-verse-id]');
    if (verseParagraph) {
        if (_state.lastClickedVerseElement === verseParagraph && _state.clickTimeoutId) {
            clearTimeout(_state.clickTimeoutId);
            _state.clickTimeoutId = null;
            _state.lastClickedVerseElement = null;

            const isSelected = verseParagraph.classList.toggle('selected');
            isSelected ? _state.selectedVerseElements.add(verseParagraph) : _state.selectedVerseElements.delete(verseParagraph);
            ui.updateActionBarVisibility(_state.selectedVerseElements.size);

        } else {
            clearTimeout(_state.clickTimeoutId);
            _state.lastClickedVerseElement = verseParagraph;
            _state.clickTimeoutId = setTimeout(() => {
                ui.readingView.classList.contains('ui-hidden') ? ui.showReadingUI() : ui.hideReadingUI();
                _state.clickTimeoutId = null;
                _state.lastClickedVerseElement = null;
            }, _state.DOUBLE_TAP_DELAY);
        }
    } else {
        clearTimeout(_state.clickTimeoutId);
        _state.clickTimeoutId = null;
        _state.lastClickedVerseElement = null;

        if (_state.selectedVerseElements.size > 0) {
            _clearAllSelections();
        } else {
            ui.readingView.classList.contains('ui-hidden') ? (ui.showReadingUI(), ui.resetUIAutoHide()) : ui.hideReadingUI();
        }
    }
}

export function handleChapterNavClick(event) {
    const chapterButton = event.target.closest('.chapter-nav-btn[data-chapter]');
    if (chapterButton) {
        const chapterNum = parseInt(chapterButton.dataset.chapter);
        if (chapterNum && chapterNum !== currentState.chapter) {
            currentState.chapter = chapterNum;
            currentState.targetVerseRef = null;
            _loadChapterContent();
        }
    }
}

/**
 * Initializes the Reading View module by setting up its event listeners.
 */
export function init() {
    ui.closeReadingViewButton?.addEventListener('click', close);
    ui.readingQuickCommentaryButton?.addEventListener('click', toggleContentMode);
    ui.prevChapterBtn?.addEventListener('click', () => navigateChapter(-1));
    ui.nextChapterBtn?.addEventListener('click', () => navigateChapter(1));
    ui.chapterNav?.addEventListener('click', handleChapterNavClick);
    ui.readingContent?.addEventListener('click', handleContentClick);
    
    // Action Bar Listeners
    ui.actionBarDoneBtn?.addEventListener('click', _clearAllSelections);
    ui.copyVerseBtn?.addEventListener('click', _handleCopyAction);
    ui.saveVerseBtn?.addEventListener('click', _handleSaveAction);
    ui.noteVerseBtn?.addEventListener('click', _handleNoteAction);
    ui.commentaryVerseBtn?.addEventListener('click', _handleCommentaryAction);
    
    console.log("Reading View module initialized.");
}
