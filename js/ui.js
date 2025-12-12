// --- File: js/ui.js ---
// This module handles all direct DOM interactions, rendering, and UI state updates.
// It reads from the global state but does not modify it directly. It provides functions
// for the main app controller (app.js) to call.
console.log("[Module Init] ui.js loaded.");

import {
    currentState
} from './state.js';
import {
    formatTime,
    getTestamentKey,
    getCrossRefDocId,
    normalizeBookName
} from './utils.js';
import * as cref from './cref.js';

// ===================================================================================
// DOM ELEMENT REFERENCES
// ===================================================================================
// Exporting these allows app.js to attach event listeners.

export const body = document.body;
export const appContainer = document.querySelector('.app-container');
export const mainHeader = document.querySelector('.header');
export const mainAppContent = document.getElementById('main-app-content');

// --- Views ---
export const views = {
    themeView: document.getElementById('themeView'),
    bookListView: document.getElementById('bookListView'),
    notesView: document.getElementById('notesView'),
    settingsView: document.getElementById('settingsView'),
    readingTabView: document.getElementById('readingTabView')
};

// --- Navigation ---
export const mainViewTabsContainer = document.getElementById('mainViewTabs');
export const bottomNavTabsContainer = document.getElementById('bottomNavTabs');

// --- Book List View ---
export const bookListTabsContainer = document.getElementById('bookListTabsContainer');
export const bookListULs = {
    OT: document.getElementById('bookListOT'),
    AP: document.getElementById('bookListAP'),
    NT: document.getElementById('bookListNT'),
    OTHER: document.getElementById('bookListOTHER')
};
export const bookListSearchContainer = document.getElementById('bookListSearchContainer');
export const bookListSearchInput = document.getElementById('bookListSearchInput');
export const bookListSearchButton = document.getElementById('bookListSearchButton');
export const bookListClearSearchButton = document.getElementById('bookListClearSearchButton');
export const bookListNoResults = document.getElementById('bookListNoResults');
export const bookListStandardContent = document.getElementById('bookListStandardContent');
export const bookListSearchResultsContainer = document.getElementById('bookListSearchResultsContainer');

// --- Settings View ---
export const settings = {
    browseViewModeSelect: document.getElementById('browseViewModeSelect'), // <-- ADD THIS LINE
    darkModeSelect: document.getElementById('darkModeSelect'),
    fontSizeSlider: document.getElementById('fontSizeSlider'),
    fontSizeValue: document.getElementById('fontSizeValue'),
    fontFamilySelect: document.getElementById('fontFamilySelect'),
    keepAwakeToggle: document.getElementById('keepAwakeToggle'),
    autoHideDelaySelect: document.getElementById('autoHideDelaySelect'),
    aboutAppButton: document.getElementById('aboutAppButton'),
    canonInfoButton: document.getElementById('canonInfoButton'),
    appVersionSpan: document.getElementById('appVersion'),
    languageSelect: document.getElementById("languageSelect"),
    downloadLanguageSelect: document.getElementById('downloadLanguageSelect'),
    startDownloadButton: document.getElementById('startDownloadButton'),
    cancelDownloadButton: document.getElementById('cancelDownloadButton'),
    downloadStatus: document.getElementById('downloadStatus'),
    downloadStatusMessage: document.getElementById('downloadStatusMessage'),
    downloadProgressBar: document.getElementById('downloadProgressBar'),
    clearDownloadedDataButton: document.getElementById('clearDownloadedDataButton'),
};

// --- Reading View ---
export const readingView = document.getElementById('readingView');
export const readingContainer = readingView?.querySelector('.reading-container');
export const readingHeader = readingView?.querySelector('.reading-header');
export const readingTitle = document.getElementById('readingViewLabel');
export const readingControls = readingView?.querySelector('.reading-controls');
export const closeReadingViewButton = document.getElementById('closeReadingViewButton');
export const readingQuickThemeButton = document.getElementById('readingQuickThemeButton');
export const readingQuickThemeIcon = document.getElementById('readingQuickThemeIcon');
export const readingQuickLanguageButton = document.getElementById("readingQuickLanguageButton");
export const readingQuickCommentaryButton = document.getElementById('readingQuickCommentaryButton');
export const chapterNavContainer = readingView?.querySelector('.chapter-nav-container');
export const chapterNav = document.getElementById('chapterNav');
export const readingContent = document.getElementById('readingContent');
export const readingFooter = readingView?.querySelector('.reading-footer');
export const prevChapterBtn = document.getElementById('prevChapter');
export const nextChapterBtn = document.getElementById('nextChapter');
export const progressBarContainer = readingView?.querySelector('.reading-progress-bar-container');
export const progressBar = document.getElementById('readingProgressBar');
export const crossRefBackButtonContainer = document.getElementById('crossRefBackButtonContainer');

// --- Audio Player ---
export const audioPlayerModal = document.getElementById('audioPlayerModal');
export const audioElement = document.getElementById('audio');
export const audioPlayPauseBtn = document.getElementById('playPauseBtn');
export const audioProgressBar = document.getElementById('progressBar');
export const audioCurrentTimeSpan = document.getElementById('currentTime');
export const audioDurationSpan = document.getElementById('duration');
export const audioForwardBtn = document.getElementById('forwardBtn');
export const audioBackwardBtn = document.getElementById('backwardBtn');
export const audioModalTriggerButton = document.getElementById('audioModalTriggerButton');

// --- Action Bar ---
export const actionBarContainer = document.getElementById('actionBarContainer');
export const actionButtonsContainer = actionBarContainer?.querySelector('.action-buttons-container');
export const copyVerseBtn = document.getElementById('copyVerseBtn');
export const saveVerseBtn = document.getElementById('saveVerseBtn');
export const noteVerseBtn = document.getElementById('noteVerseBtn');
export const shareVerseBtn = document.getElementById('shareVerseBtn');
export const imageVerseBtn = document.getElementById('imageVerseBtn');
export const commentaryVerseBtn = document.getElementById('commentaryVerseBtn');
export const actionBarDoneBtn = document.getElementById('actionBarDoneBtn');

// --- Notes View ---
export const notesViewTabsContainer = document.getElementById('notesViewTabs');
export const notesViewPanels = {
    userNotesPanel: document.getElementById('userNotesPanel'),
    userFavouritesPanel: document.getElementById('userFavouritesPanel'),
    userReflectionPanel: document.getElementById('userReflectionPanel'),
};
export const notesListContainer = document.getElementById('notesListContainer');
export const favouritesListContainer = document.getElementById('favouritesListContainer');
export const addNewReflectionButton = document.getElementById('addNewReflectionButton');
export const addReflectionForm = document.getElementById('addReflectionForm');
export const newReflectionTextarea = document.getElementById('newReflectionTextarea');
export const saveNewReflectionButton = document.getElementById('saveNewReflectionButton');
export const cancelNewReflectionButton = document.getElementById('cancelNewReflectionButton');
export const reflectionListContainer = document.getElementById('reflectionListContainer');
export const reflectionEmptyListMessage = reflectionListContainer?.querySelector('.empty-list-message');

// --- Theme View ---
export const recentThemeCard = document.querySelector('.recent-theme-card');
export const recentBooksContainer = recentThemeCard?.querySelector('.books-container');
export const recentEmptyMessage = recentThemeCard?.querySelector('.recent-empty-message');
export const verseCard = document.getElementById('verseCard');
export const verseCardTitle = verseCard?.querySelector('.verse-title');
export const verseCardText = verseCard?.querySelector('.verse-text');
export const verseCardReference = verseCard?.querySelector('.verse-reference');
export const verseCardMenuDots = document.getElementById('menuDots');
export const verseCardDropdownMenu = document.getElementById('dropdownMenu');
export const verseCardCreateImageBtn = document.getElementById('createImageBtn');
export const verseCardShareBtn = document.getElementById('shareBtn');
export const verseCardSaveBtn = document.getElementById('saveBtn');
export const fullscreenVerseOverlay = document.getElementById('fullscreenVerse');
export const fullscreenVerseContent = fullscreenVerseOverlay?.querySelector('.fullscreen-content');
export const fullscreenVerseCloseBtn = fullscreenVerseOverlay?.querySelector('.close-btn');
export const fullscreenVerseTitle = fullscreenVerseOverlay?.querySelector('.verse-title');
export const fullscreenVerseText = fullscreenVerseOverlay?.querySelector('.verse-text');
export const fullscreenVerseReference = fullscreenVerseOverlay?.querySelector('.verse-reference');


// ===================================================================================
// UI FEEDBACK AND MESSAGES
// ===================================================================================

export function showPersistentErrorBanner(message) {
    console.error("APP ERROR:", message);
    // In a real implementation, this would create and show a permanent banner at the top of the page.
}

export function showTempMessage(message, type = 'info', duration = 3000) {
    // Also log to console for debugging
    const logPrefix = `APP MESSAGE (${type.toUpperCase()}):`;
    if (type === 'error') console.error(logPrefix, message);
    else if (type === 'warning') console.warn(logPrefix, message);
    else console.log(logPrefix, message);

    // --- Create and display the visual toast notification ---
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    document.body.appendChild(toast);

    // Trigger the animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Set a timer to remove the toast
    setTimeout(() => {
        toast.classList.remove('show');
        
        // Listen for the fade-out transition to end before removing the element
        toast.addEventListener('transitionend', () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, { once: true }); // Ensure the event listener is removed after it runs

    }, duration);
}


// ===================================================================================
// TAB AND PANEL MANAGEMENT
// ===================================================================================

export function showTargetPanel(panelId, scope) {
    if (!scope) return;
    const targetPanel = scope.querySelector(`#${panelId}`);
    if (targetPanel) {
        targetPanel.classList.remove('hidden');
        targetPanel.classList.add('active');
        targetPanel.setAttribute('aria-hidden', 'false');
    }
}

export function hideAllPanels(scope) {
    if (!scope) return;
    scope.querySelectorAll(':scope > [role="tabpanel"]').forEach(panel => {
        panel.classList.add('hidden');
        panel.classList.remove('active');
        panel.setAttribute('aria-hidden', 'true');
    });
}




// ===================================================================================
// GENERAL & THEME VIEW UI
// ===================================================================================



export function toggleThemeCard(card) {
    if (!card) return;
    const content = card.querySelector('.theme-card-content');
    if (!content) return;

    const isActive = card.classList.contains('active');
    const currentlyActiveCard = views.themeView?.querySelector('.theme-card.active');

    if (currentlyActiveCard && currentlyActiveCard !== card && !isActive) {
        currentlyActiveCard.classList.remove('active');
        const currentContent = currentlyActiveCard.querySelector('.theme-card-content');
        if (currentContent) {
            currentContent.style.maxHeight = null;
            currentlyActiveCard.setAttribute('aria-expanded', 'false');
            currentContent.setAttribute('aria-hidden', 'true');
        }
    }

    card.classList.toggle('active', !isActive);
    card.setAttribute('aria-expanded', String(!isActive));
    content.setAttribute('aria-hidden', String(isActive));

    if (!isActive) {
        content.style.maxHeight = content.scrollHeight + "px";
    } else {
        content.style.maxHeight = null;
    }
}

export function renderVerseOfTheDay(verseTextToUse, displayReference) {
    if (!verseCard || !verseCardTitle || !verseCardText || !verseCardReference) {
        if (verseCard) verseCard.style.display = 'none';
        return;
    }

    if (!verseTextToUse || !displayReference) {
        verseCardTitle.textContent = "Verse of the Day";
        verseCardText.innerHTML = '<em>Verse not available right now. Please check back later.</em>';
        verseCardReference.textContent = '';
        verseCard.style.display = '';
        if (verseCardDropdownMenu) {
            verseCardDropdownMenu.querySelectorAll('.menu-item').forEach(item => item.disabled = true);
        }
        return;
    }

    verseCardTitle.textContent = "Today's Scripture";
    verseCardText.innerHTML = verseTextToUse;
    verseCardReference.textContent = displayReference;
    verseCard.style.display = '';
    if (verseCardDropdownMenu) {
        verseCardDropdownMenu.querySelectorAll('.menu-item').forEach(item => item.disabled = false);
    }
}

export function toggleFullscreenVerse(show) {
    if (!fullscreenVerseOverlay) return;
    const isActive = fullscreenVerseOverlay.classList.contains('active');

    if (show === undefined) {
        show = !isActive;
    }

    if (show && !isActive) {
        fullscreenVerseOverlay.classList.add('active');
        fullscreenVerseOverlay.setAttribute('aria-hidden', 'false');
        if (verseCardText && fullscreenVerseText) fullscreenVerseText.innerHTML = verseCardText.innerHTML;
        if (verseCardReference && fullscreenVerseReference) fullscreenVerseReference.textContent = verseCardReference.textContent;
        if (verseCardTitle && fullscreenVerseTitle) fullscreenVerseTitle.textContent = verseCardTitle.textContent;
    } else if (!show && isActive) {
        fullscreenVerseOverlay.classList.remove('active');
        fullscreenVerseOverlay.setAttribute('aria-hidden', 'true');
    }
}

export function hideVerseCardDropdownMenu() {
    if (verseCardDropdownMenu) {
        verseCardDropdownMenu.classList.remove('active');
        if (verseCardMenuDots) verseCardMenuDots.setAttribute('aria-expanded', 'false');
        verseCardDropdownMenu.setAttribute('aria-hidden', 'true');
    }
}

export function renderRecentBooks() {
    if (!recentBooksContainer) return;

    recentBooksContainer.innerHTML = '';

    if (!currentState.recentBooks || currentState.recentBooks.length === 0) {
        if (recentEmptyMessage) {
            recentEmptyMessage.style.display = 'block';
        }
        return;
    }

    if (recentEmptyMessage) recentEmptyMessage.style.display = 'none';

    const fragment = document.createDocumentFragment();
    const sortedRecent = currentState.recentBooks.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    sortedRecent.forEach(item => {
        const bookInfo = currentState.booksInfo[item.bookId];
        if (!bookInfo) return;

        const bookCard = document.createElement('div');
        bookCard.className = 'book-card recent-book-card-item';
        bookCard.dataset.book = item.bookId;
        bookCard.dataset.chapter = item.chapter;
        bookCard.dataset.navigationTarget = item.verseId || `${item.chapter}:1`;
        bookCard.setAttribute('role', 'button');
        bookCard.tabIndex = 0;

        const displayBookName = currentState.language === 'en' ? bookInfo.englishName || bookInfo.id : bookInfo.amharicName || bookInfo.id;
        const displayChapterVerse = item.verseId ?
            (String(item.verseId).startsWith('v-') ? String(item.verseId).split('-').slice(-2).join(':') : (String(item.verseId).includes(':') ? String(item.verseId).split(':').slice(-2).join(':') : `${item.chapter}:1`)) :
            `${item.chapter}:1`;

        const bookTitle = document.createElement('h3');
        bookTitle.textContent = displayBookName;
        const chapterVerseSpan = document.createElement('span');
        chapterVerseSpan.className = 'recent-chapter-verse';
        chapterVerseSpan.textContent = `Last Read: ${displayChapterVerse}`;
        const testamentDiv = document.createElement('div');
        testamentDiv.className = 'testament';
        const testamentKey = bookInfo.testament || 'OTHER';
        testamentDiv.textContent = testamentKey;
        testamentDiv.classList.add(testamentKey === 'OT' ? 'old-testament' : testamentKey === 'NT' ? 'new-testament' : testamentKey === 'AP' ? 'apocrypha' : 'other-testament');

        bookCard.appendChild(bookTitle);
        bookCard.appendChild(chapterVerseSpan);
        bookCard.appendChild(testamentDiv);
        fragment.appendChild(bookCard);
    });
    recentBooksContainer.appendChild(fragment);
}


// ===================================================================================
// BOOK LIST & SEARCH UI
// ===================================================================================

export function populateBookLists() {
    let hasOtherBooks = currentState.bookList['OTHER'] && currentState.bookList['OTHER'].length > 0;
    const otherTabButton = document.getElementById('tab-bookListTabOTHER');

    Object.keys(bookListULs).forEach(testamentKey => {
        const ul = bookListULs[testamentKey];
        if (ul) {
            ul.innerHTML = '';
            const booksForTestament = currentState.bookList[testamentKey] || [];
            if (booksForTestament.length > 0) {
                const fragment = document.createDocumentFragment();
                booksForTestament.forEach(bookId => {
                    const bookInfo = currentState.booksInfo[bookId];
                    if (!bookInfo) return;
                    const li = document.createElement('li');
                    li.className = 'book-list-item';
                    li.dataset.book = bookId;
                    li.setAttribute('role', 'button');
                    li.tabIndex = 0;
                    li.textContent = currentState.language === 'en' ? bookInfo.englishName || bookInfo.id : bookInfo.amharicName || bookInfo.id;
                    fragment.appendChild(li);
                });
                ul.appendChild(fragment);
            } else {
                ul.innerHTML = `<li class="empty-list-message">No books in this section.</li>`;
            }
        }
    });

    if (otherTabButton) otherTabButton.style.display = hasOtherBooks ? '' : 'none';
}

export function handleLanguageChange() {
    const newLang = currentState.language;

    // 1. Update settings dropdown
    if (settings.languageSelect && settings.languageSelect.value !== newLang) {
        settings.languageSelect.value = newLang;
    }

    // 2. Update the quick toggle button in the reading view
    updateQuickLanguageToggleUI();

    // 3. Re-render the book lists with the new language names
    populateBookLists();
    
    // 4. If the Notes/Favourites view is active, re-render its items
    if (views.notesView && views.notesView.classList.contains('active')) {
        renderUserItems("note");
        renderUserItems("favourite");
    }
}

export function toggleBookListViewMode(showSearchResults) {
    if (showSearchResults) {
        if (bookListStandardContent) bookListStandardContent.style.display = 'none';
        if (bookListSearchResultsContainer) bookListSearchResultsContainer.style.display = 'block';
    } else {
        if (bookListStandardContent) bookListStandardContent.style.display = '';
        if (bookListSearchResultsContainer) bookListSearchResultsContainer.style.display = 'none';
        if (bookListNoResults) bookListNoResults.style.display = 'none';
    }

    if (bookListClearSearchButton && bookListSearchInput) {
        const hasQuery = bookListSearchInput.value.trim().length > 0;
        bookListClearSearchButton.style.display = hasQuery ? 'inline-block' : 'none';
    }
}

export function displaySearchResults(results, parsedQuery) {
    if (!bookListSearchResultsContainer || !bookListNoResults) return;

    bookListSearchResultsContainer.innerHTML = '';

    if (results && results.length > 0) {
        bookListNoResults.style.display = 'none';
        const fragment = document.createDocumentFragment();
        const resultHeader = document.createElement('h3');
        resultHeader.className = 'search-results-heading';
        const resultCount = results.length;
        const MAX_KEYWORD_RESULTS = 50;
        const queryTypeDesc = parsedQuery.type === 'reference' ? 'Reference Match' : 'Keyword Matches';
        resultHeader.textContent = `Found ${resultCount} ${queryTypeDesc} for "${parsedQuery.originalQuery}"`;
        if (parsedQuery.type === 'keyword' && resultCount >= MAX_KEYWORD_RESULTS) {
            resultHeader.textContent += ` (Showing first ${MAX_KEYWORD_RESULTS})`;
        }
        fragment.appendChild(resultHeader);

        results.forEach(result => {
            const resultDiv = document.createElement('div');
            resultDiv.classList.add('search-result-item');
            resultDiv.dataset.book = result.bookId;
            resultDiv.dataset.chapter = result.chapter || '1';
            const targetVerseNav = result.verse ? String(result.verse).split('-')[0] : null;
            if (targetVerseNav) {
                resultDiv.dataset.verse = targetVerseNav;
            }
            resultDiv.setAttribute('role', 'button');
            resultDiv.tabIndex = 0;
            resultDiv.innerHTML = `<div class="result-header" aria-label="Reference: ${result.fullReference}">${result.fullReference}</div><div class="result-snippet">${result.highlightedHtml || ''}</div>${result.isRefResult ? `<div class="result-type-match">Reference Match</div>` : ''}`;
            fragment.appendChild(resultDiv);
        });
        bookListSearchResultsContainer.appendChild(fragment);
    } else {
        bookListNoResults.textContent = `No results found for "${parsedQuery.originalQuery}".`;
        bookListNoResults.style.display = 'block';
    }
}

export function displaySearchResultsError(message) {
    if (!bookListSearchResultsContainer || !bookListNoResults) return;
    bookListSearchResultsContainer.innerHTML = '';
    bookListNoResults.textContent = message;
    bookListNoResults.style.display = 'block';
}


// ===================================================================================
// READING VIEW UI
// ===================================================================================

export function applyReadingSettings() {
    const fontSize = `${currentState.fontSize}em`;
    const fontFamily = currentState.fontFamily;

    if (readingContent) {
        readingContent.style.fontSize = fontSize;
        readingContent.style.fontFamily = fontFamily;
    }
    if (settings.fontSizeValue) {
        settings.fontSizeValue.textContent = `${currentState.fontSize.toFixed(1)}em`;
    }
    if (settings.fontSizeSlider && settings.fontSizeSlider.value !== String(currentState.fontSize)) {
        settings.fontSizeSlider.value = currentState.fontSize;
    }
    if (settings.fontFamilySelect && settings.fontFamilySelect.value !== fontFamily) {
        settings.fontFamilySelect.value = fontFamily;
    }
}

export function hideReadingUI() {
    if (!readingView?.classList.contains('active') || readingView.classList.contains('ui-hidden')) return;
    readingView.classList.add('ui-hidden');
    [readingHeader, chapterNavContainer, readingFooter, progressBarContainer].forEach(el => {
        if (el) {
            el.setAttribute('aria-hidden', 'true');
            el.classList.add('visually-hidden-transition');
        }
    });
}

export function showReadingUI() {
    if (!readingView?.classList.contains('active')) return;
    readingView.classList.remove('ui-hidden');
    [readingHeader, chapterNavContainer, readingFooter, progressBarContainer].forEach(el => {
        if (el) {
            el.removeAttribute('aria-hidden');
            el.classList.remove('visually-hidden-transition');
        }
    });
}

export function resetUIAutoHide() {
    clearTimeout(currentState.uiHideTimeoutId);
    showReadingUI();
    if (readingView?.classList.contains('active') && currentState.autoHideDelay < 99999999) {
        currentState.uiHideTimeoutId = setTimeout(hideReadingUI, currentState.autoHideDelay);
    }
}

export function updateQuickLanguageToggleUI() {
    if (readingQuickLanguageButton) {
        const currentLang = currentState.language;
        readingQuickLanguageButton.textContent = currentLang.toUpperCase();
        readingQuickLanguageButton.setAttribute('aria-label', `Switch to ${currentLang === 'am' ? 'English' : 'Amharic'}`);
    }
}

export function updateReadingContentModeUI() {
    if (readingQuickCommentaryButton) {
        const currentMode = currentState.readingContentMode;
        if (currentMode === 'commentary') {
            readingQuickCommentaryButton.textContent = '📖';
            readingQuickCommentaryButton.setAttribute('aria-label', 'Switch to Scripture View');
            readingQuickCommentaryButton.classList.add('active');
        } else {
            readingQuickCommentaryButton.textContent = '📝';
            readingQuickCommentaryButton.setAttribute('aria-label', 'Switch to Commentary View');
            readingQuickCommentaryButton.classList.remove('active');
        }
    }
}

export function updateProgressBar() {
    if (!readingContent || !progressBar) return;
    const scrollHeight = readingContent.scrollHeight;
    const clientHeight = readingContent.clientHeight;
    const scrollTop = readingContent.scrollTop;
    const maxScroll = scrollHeight - clientHeight;
    const progress = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
    progressBar.style.width = `${progress}%`;
    progressBar.setAttribute('aria-valuenow', progress.toFixed(0));
}

export function updateCrossRefBackButton() {
    if (!crossRefBackButtonContainer) return;

    if (currentState.sourceReferenceForBackNav) {
        const sourceRef = currentState.sourceReferenceForBackNav;
        const match = sourceRef.match(/^(.+?)\s+(\d+):?(\d+(?:-\d+)?)?$/);
        let displayRef = sourceRef;

        if (match) {
            const savedBookDisplayName = match[1].trim();
            const bookId = normalizeBookName(savedBookDisplayName, currentState.booksInfo, currentState.bookAliasMap);

            if (bookId) {
                const currentBookInfo = currentState.booksInfo[bookId];
                const currentBookDisplayName = currentState.language === 'en' ? currentBookInfo?.englishName || bookId : currentBookInfo?.amharicName || bookId;
                displayRef = `${currentBookDisplayName} ${match[2]}${match[3] ? ':' + match[3] : ''}`.trim();
            }
        }
        crossRefBackButtonContainer.innerHTML = `<button id="crossRefBackButton" class="button-secondary" aria-label="Go back to ${displayRef}">← Back to ${displayRef}</button>`;
        crossRefBackButtonContainer.style.display = 'block';
    } else {
        crossRefBackButtonContainer.innerHTML = '';
        crossRefBackButtonContainer.style.display = 'none';
    }
}

export function generateChapterNav(totalChapters) {
    if (!chapterNav) return;
    chapterNav.innerHTML = '';
    if (!totalChapters || totalChapters <= 0) {
        chapterNav.innerHTML = '<span class="chapter-nav-info">No Chapters</span>';
        if (prevChapterBtn) prevChapterBtn.disabled = true;
        if (nextChapterBtn) nextChapterBtn.disabled = true;
        return;
    }
    const fragment = document.createDocumentFragment();
    for (let i = 1; i <= totalChapters; i++) {
        const btn = document.createElement('button');
        btn.textContent = `${i}`;
        btn.className = 'chapter-nav-btn';
        btn.dataset.chapter = i;
        btn.setAttribute('aria-label', `Chapter ${i}`);
        if (i === currentState.chapter) {
            btn.classList.add('active');
            btn.setAttribute('aria-current', 'page');
        }
        fragment.appendChild(btn);
    }
    chapterNav.appendChild(fragment);
    updateChapterNavUI(totalChapters);
}

export function updateChapterNavUI(totalChapters) {
    if (!chapterNav || !prevChapterBtn || !nextChapterBtn) return;
    const buttons = chapterNav.querySelectorAll('.chapter-nav-btn');
    buttons.forEach(btn => {
        const isCurrent = parseInt(btn.dataset.chapter) === currentState.chapter;
        btn.classList.toggle('active', isCurrent);
        btn.setAttribute('aria-current', isCurrent ? 'page' : 'false');
    });
    prevChapterBtn.disabled = currentState.chapter <= 1;
    nextChapterBtn.disabled = totalChapters <= 0 || currentState.chapter >= totalChapters;
    scrollToActiveChapter();
}

export function scrollToActiveChapter() {
    if (!chapterNav) return;
    const activeBtn = chapterNav.querySelector('.chapter-nav-btn.active');
    if (activeBtn) {
        activeBtn.scrollIntoView({
            behavior: 'smooth',
            inline: 'center',
            block: 'nearest'
        });
    }
}

export function renderChapterIntroduction(headerText, containerElement) {
    if (!headerText || !containerElement) return;
    const introductionWrapper = document.createElement('div');
    introductionWrapper.className = 'chapter-introduction';
    const introductionParagraph = document.createElement('p');
    introductionParagraph.className = 'introduction-text';
    introductionParagraph.innerHTML = headerText.replace(/\n/g, '<br>');
    introductionWrapper.appendChild(introductionParagraph);
    containerElement.prepend(introductionWrapper);
}

export function renderChapterScripture(versesData, crossRefsMap) {
    if (!readingContent || !Array.isArray(versesData)) return;

    const fragment = document.createDocumentFragment();
    for (const verseData of versesData) {
        const p = document.createElement("p");
        p.classList.add("verse-paragraph");
        const {
            chapter_num,
            verse_num,
            verse_display_num,
            verse_text
        } = verseData;
        const textToUse = verse_text?.trim() ? verse_text : "[Text Missing]";
        const displayNum = verse_display_num || verse_num;
        const verseRef = `${chapter_num}:${displayNum}`;
        const verseId = `v-${currentState.book.replace(/[^a-zA-Z0-9]/g, "-")}-${chapter_num}-${verse_num}`;

        p.dataset.bookId = currentState.book;
        p.dataset.chapterNum = chapter_num;
        p.dataset.verseNum = verse_num;
        p.dataset.verseDisplayNum = displayNum;
        p.dataset.verseId = verseId;

        let crossRefTriggerHtml = "";
        let verseNumberClasses = "verse-number";

        const crossRefDocId = getCrossRefDocId(currentState.book, chapter_num, verse_num, currentState.booksInfo, currentState.bookAliasMap);
        const bookInfo = currentState.booksInfo[currentState.book];
        const displayBookName = bookInfo ? (currentState.language === 'en' ? bookInfo.englishName : bookInfo.amharicName) || currentState.book : currentState.book;
        const displayRef = `${displayBookName} ${verseRef}`;

        if (crossRefDocId && crossRefsMap.has(crossRefDocId)) {
            crossRefTriggerHtml = ` <button class="cross-ref-trigger" data-ref="${displayRef}" aria-label="Show cross references for ${displayRef}">✨</button>`;
            verseNumberClasses += " has-cross-refs";
        }
        p.innerHTML = `<span class="${verseNumberClasses}" id="${verseId}" aria-label="Verse ${verseRef}">${verseRef}</span> <span class="verse-text">${textToUse}</span>${crossRefTriggerHtml}`;
        fragment.appendChild(p);
    }
    readingContent.appendChild(fragment);
}

export function renderChapterCommentary(versesData) {
    if (!readingContent || !Array.isArray(versesData)) return;

    const fragment = document.createDocumentFragment();
    const hasCommentary = versesData.some(v => v.commentary_text?.trim());

    if (!hasCommentary) {
        const infoMsg = document.createElement('p');
        infoMsg.className = 'info-message';
        infoMsg.textContent = `No commentary available for this chapter.`;
        fragment.appendChild(infoMsg);
    } else {
        for (const verseData of versesData) {
            const {
                chapter_num,
                verse_num,
                commentary_text
            } = verseData;
            const commentaryId = `comm-${currentState.book.replace(/[^a-zA-Z0-9]/g, "-")}-${chapter_num}-${verse_num}`;
            const verseRef = `${chapter_num}:${verse_num}`;
            const commentaryBlock = document.createElement("div");
            commentaryBlock.className = "commentary-block";
            commentaryBlock.dataset.bookId = currentState.book;
            commentaryBlock.dataset.chapterNum = chapter_num;
            commentaryBlock.dataset.verseNum = verse_num;
            commentaryBlock.id = commentaryId;

            const bookInfo = currentState.booksInfo[currentState.book];
            const displayBookName = bookInfo ? (currentState.language === 'en' ? bookInfo.englishName : bookInfo.amharicName) || currentState.book : currentState.book;

            const heading = document.createElement("h3");
            heading.className = "commentary-heading";
            heading.textContent = `${displayBookName} ${verseRef}`;
            const textContent = document.createElement("div");
            textContent.className = "commentary-text";
            if (commentary_text?.trim()) {
                textContent.innerHTML = commentary_text.trim().replace(/\n/g, '<br>');
            } else {
                textContent.innerHTML = '<p class="empty-commentary-placeholder">[No commentary for this verse]</p>';
            }
            commentaryBlock.appendChild(heading);
            commentaryBlock.appendChild(textContent);
            fragment.appendChild(commentaryBlock);
        }
    }
    readingContent.appendChild(fragment);
}

export function performScrollAndHighlightLogic(targetRefOrVerseId) {
    if (!readingContent) return;
    let scrollTargetElement = null;
    let targetVerseIdToFind = null;
    const {
        book,
        chapter
    } = currentState;

    if (targetRefOrVerseId && typeof targetRefOrVerseId === "string") {
        if (targetRefOrVerseId.startsWith("v-")) {
            targetVerseIdToFind = targetRefOrVerseId;
        } else {
            let targetVerseNumOnly = targetRefOrVerseId;
            if (targetRefOrVerseId.includes(":")) {
                const parts = targetRefOrVerseId.split(":");
                const refChapter = parseInt(parts[0], 10);
                if (!isNaN(refChapter) && refChapter === chapter) {
                    targetVerseNumOnly = parts[1];
                } else {
                    targetVerseNumOnly = null;
                }
            }
            if (targetVerseNumOnly?.trim()) {
                const verseNumStart = targetVerseNumOnly.split("-")[0];
                if (!isNaN(parseInt(verseNumStart, 10)) && parseInt(verseNumStart, 10) > 0) {
                    targetVerseIdToFind = `v-${book.replace(/[^a-zA-Z0-9]/g, "-")}-${chapter}-${verseNumStart}`;
                }
            }
        }
        if (targetVerseIdToFind) {
            scrollTargetElement = readingContent.querySelector(`p[data-verse-id="${targetVerseIdToFind}"]`);
        }
    }

    setTimeout(() => {
        const shouldHighlight = scrollTargetElement && targetRefOrVerseId !== null;
        if (scrollTargetElement && readingContent.contains(scrollTargetElement)) {
            const scrollBlock = shouldHighlight ? "center" : "start";
            scrollTargetElement.scrollIntoView({
                behavior: "smooth",
                block: scrollBlock
            });
            if (shouldHighlight) {
                readingContent.querySelectorAll('.highlight-target').forEach(el => el.classList.remove('highlight-target'));
                scrollTargetElement.classList.add("highlight-target");
                setTimeout(() => {
                    if (scrollTargetElement && readingContent.contains(scrollTargetElement)) {
                        scrollTargetElement.classList.remove("highlight-target");
                    }
                }, 2500);
            }
        } else if (!targetRefOrVerseId) {
            readingContent.scrollTop = 0;
        } else {
            console.warn(`performScrollAndHighlightLogic: Target element with ID "${targetVerseIdToFind}" not found.`);
            readingContent.scrollTop = 0;
        }
        updateProgressBar();
    }, 100);
}


// ===================================================================================
// ACTION BAR & EXPANSION PANELS (Cross-Ref, Commentary)
// ===================================================================================

export function updateActionBarVisibility(selectedVerseCount) {
    if (!actionBarContainer) return;
    const shouldShow = selectedVerseCount > 0;
    actionBarContainer.classList.toggle('hidden', !shouldShow);
    actionBarContainer.setAttribute('aria-hidden', String(!shouldShow));
    if (actionBarDoneBtn) actionBarDoneBtn.style.display = shouldShow ? '' : 'none';

    if (commentaryVerseBtn) {
        commentaryVerseBtn.disabled = !shouldShow;
        if (shouldShow) {
            commentaryVerseBtn.setAttribute('aria-label', `Show commentary for one of the ${selectedVerseCount} selected verses`);
        } else {
            commentaryVerseBtn.setAttribute('aria-label', 'Commentary (Select a verse first)');
        }
    }
    [copyVerseBtn, saveVerseBtn, noteVerseBtn, shareVerseBtn, imageVerseBtn].forEach(btn => {
        if (btn) btn.disabled = !shouldShow;
    });
}

export function removeActiveExpansion() {
    // The cref module now manages its own state and DOM element.
    // We just call its public closer function.
    cref.closeExpansion();
}

export function removeActiveCommentaryExpansion(panelElement) {
    // This function now simply handles the animation and removal of a given element.
    // The state is managed by the commentary.js module.
    if (panelElement) {
        panelElement.classList.remove('visible');
        // Add a small safety delay before removing to ensure transition starts
        setTimeout(() => {
             panelElement.addEventListener('transitionend', () => panelElement.remove(), { once: true });
        }, 50);
        // Fallback removal in case transitionend doesn't fire
        setTimeout(() => panelElement.remove(), 500);
    }
}

export function renderInlineCommentaryPanel(verseElement, commentaryText) {
    const { bookId, chapterNum, verseNum } = verseElement.dataset;
    const bookInfo = currentState.booksInfo[bookId];
    const displayBookName = bookInfo ? (currentState.language === 'en' ? bookInfo.englishName : bookInfo.amharicName) || bookId : bookId;
    const displayRef = `${displayBookName} ${chapterNum}:${verseNum}`;

    const expansionPanel = document.createElement('div');
    expansionPanel.className = 'commentary-expansion';
    expansionPanel.dataset.targetBookId = bookId;
    expansionPanel.dataset.targetChapter = chapterNum;
    expansionPanel.dataset.targetVerse = verseNum;
    expansionPanel.dataset.triggerVerseId = verseElement.dataset.verseId;
    expansionPanel.setAttribute('role', 'dialog');
    expansionPanel.setAttribute('aria-label', `Commentary for ${displayRef}`);
    expansionPanel.tabIndex = -1;

    expansionPanel.innerHTML = `
        <div class="commentary-expansion-header">
            <span class="commentary-expansion-ref">${displayRef}</span>
            <button class="close-expansion-button" aria-label="Close commentary">×</button>
        </div>
        <div class="commentary-expansion-text">${commentaryText.replace(/\n/g, '<br>')}</div>
        <div class="commentary-expansion-footer">
            <button class="go-to-full-commentary-button"
                    data-target-book-id="${bookId}"
                    data-target-chapter="${chapterNum}"
                    data-target-verse="${verseNum}"
                    aria-label="Go to full chapter commentary for ${displayRef}">
                Go to full commentary
            </button>
        </div>
    `;

    verseElement.insertAdjacentElement('afterend', expansionPanel);

    requestAnimationFrame(() => {
        expansionPanel.style.maxHeight = expansionPanel.scrollHeight + 'px';
        expansionPanel.classList.add('visible');
        expansionPanel.querySelector('button')?.focus();
    });

    resetUIAutoHide();
    return expansionPanel; // Return the created element
}


// ===================================================================================
// USER DATA & NOTES VIEW UI
// ===================================================================================

export function renderUserItems(type) {
    const container = type === 'note' ? notesListContainer : favouritesListContainer;
    const items = type === 'note' ? currentState.userNotes : currentState.userFavourites;
    const panel = type === 'note' ? notesViewPanels.userNotesPanel : notesViewPanels.userFavouritesPanel;
    if (!container || !panel) return;

    container.innerHTML = '';
    if (!items || items.length === 0) {
        container.innerHTML = `<p class="empty-list-message">You have no saved ${type}s yet.</p>`;
        panel.classList.add('empty');
        return;
    }

    panel.classList.remove('empty');
    const fragment = document.createDocumentFragment();
    items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    items.forEach(item => {
        const li = document.createElement('li');
        li.className = `${type}-item`;
        li.dataset.itemId = item.id;
        li.dataset.book = item.bookId;
        li.dataset.chapter = item.chapter;
        li.dataset.navigationTarget = item.verseId || `${item.chapter}:${String(item.verse).split('-')[0]}`;
        const itemDate = item.timestamp ? new Date(item.timestamp).toLocaleDateString() : '';
        const bookInfo = currentState.booksInfo[item.bookId];
        const itemBookDisplayName = bookInfo ? (currentState.language === 'en' ? bookInfo.englishName : bookInfo.amharicName) || item.bookId : item.bookId;
        const versePart = item.verseId ? String(item.verseId).split('-').pop() : (item.verse || '');
        const itemDisplayRef = `${itemBookDisplayName} ${item.chapter}${versePart ? ':' + versePart : ''}`.trim();

        li.innerHTML = `
            <div class="${type}-item-content" role="button" tabindex="0">
                <div class="item-header">
                    <span class="item-ref">${itemDisplayRef}</span>
                    ${itemDate ? `<span class="item-date">${itemDate}</span>` : ''}
                </div>
                <p class="item-verse-text">${item.verseText || "[Verse text missing]"}</p>
                ${type === 'note' && item.userNote ? `<p class="item-user-note"><strong>Note:</strong> ${item.userNote}</p>` : ''}
            </div>
            <button class="delete-item-button" aria-label="Delete ${type}">×</button>
        `;
        fragment.appendChild(li);
    });
    container.appendChild(fragment);
}

export function renderReflections() {
    if (!reflectionListContainer) return;
    reflectionListContainer.innerHTML = '';

    if (currentState.reflections.length === 0) {
        const emptyLi = document.createElement('li');
        emptyLi.className = 'empty-list-message';
        emptyLi.textContent = 'No reflections saved yet.';
        reflectionListContainer.appendChild(emptyLi);
        return;
    }

    const fragment = document.createDocumentFragment();
    currentState.reflections.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    currentState.reflections.forEach(reflection => {
        const li = document.createElement('li');
        li.className = 'reflection-card user-item';
        li.dataset.reflectionId = reflection.id;
        const dateTime = new Date(reflection.timestamp || Date.now()).toLocaleString(undefined, {
            dateStyle: 'short',
            timeStyle: 'short'
        });
        li.innerHTML = `
            <div class="reflection-card-header item-header" tabindex="0">
                <span class="reflection-date item-date">${dateTime}</span>
                <button class="reflection-icon-button edit-reflection-button" aria-label="Edit Reflection">✏️</button>
                <button class="reflection-icon-button delete-reflection-button" aria-label="Delete Reflection">×</button>
            </div>
            <div class="reflection-content-display item-verse-text" tabindex="0">
                ${reflection.text ? `<p>${reflection.text.replace(/\n/g, '<br>')}</p>` : '<p class="empty-reflection-placeholder">[Empty reflection]</p>'}
            </div>
            <div class="reflection-edit-form">
                <textarea placeholder="Write your reflection here...">${reflection.text || ''}</textarea>
                <div class="form-buttons">
                    <button class="save-button save-reflection-button">Save Edit</button>
                    <button class="cancel-button cancel-reflection-button">Cancel</button>
                </div>
            </div>
        `;
        fragment.appendChild(li);
    });
    reflectionListContainer.appendChild(fragment);
}

export function toggleExpanded(li) {
    if (!li || li.classList.contains('editing')) return;
    li.classList.toggle('expanded');
    if (li.classList.contains('expanded')) {
        li.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
        });
    }
}

export function toggleEditMode(li) {
    if (!li || !reflectionListContainer) return;
    reflectionListContainer.querySelectorAll('.reflection-card.editing').forEach(card => {
        if (card !== li) cancelEditMode(card);
    });
    if (li.classList.contains('expanded')) toggleExpanded(li);
    li.classList.add('editing');
    const textarea = li.querySelector('.reflection-edit-form textarea');
    if (textarea) setTimeout(() => textarea.focus(), 50);
}

export function cancelEditMode(li) {
    if (li) li.classList.remove('editing');
}

export function showAddForm() {
    if (!addReflectionForm || !addNewReflectionButton || !newReflectionTextarea) return;
    addReflectionForm.classList.add('visible');
    addNewReflectionButton.style.display = 'none';
    newReflectionTextarea.value = '';
    setTimeout(() => newReflectionTextarea.focus(), 50);
}

export function hideAddForm() {
    if (!addReflectionForm || !addNewReflectionButton) return;
    addReflectionForm.classList.remove('visible');
    addNewReflectionButton.style.display = 'inline-flex';
}


// ===================================================================================
// DOWNLOAD UI & SETTINGS
// ===================================================================================

export function updateDownloadUI() {
    if (!settings.downloadStatus || !settings.downloadProgressBar || !settings.startDownloadButton) return;
    const {
        isDownloading,
        downloadProgress
    } = currentState;

    settings.startDownloadButton.disabled = isDownloading || Object.keys(currentState.booksInfo).length === 0;
    settings.cancelDownloadButton.classList.toggle('hidden', !isDownloading);
    settings.startDownloadButton.classList.toggle('hidden', isDownloading);
    settings.clearDownloadedDataButton.disabled = isDownloading;

    if (isDownloading) {
        settings.downloadStatus.style.display = 'block';
        settings.downloadProgressBar.style.display = 'block';
        const {
            downloadedChaptersOverall,
            totalChaptersOverall,
            currentBookName,
            currentChapter,
            totalChaptersInBook,
            language
        } = downloadProgress;
        settings.downloadStatusMessage.textContent =
            `Downloading ${language?.toUpperCase()} Bible: ${currentBookName} Ch ${currentChapter}/${totalChaptersInBook} (${downloadedChaptersOverall} of ${totalChaptersOverall} chapters overall)...`;
        if (totalChaptersOverall > 0) {
            settings.downloadProgressBar.value = (downloadedChaptersOverall / totalChaptersOverall) * 100;
        }
    } else {
        const statusMsg = settings.downloadStatusMessage.textContent;
        if (!statusMsg?.trim() || statusMsg.includes('Clearing')) {
            settings.downloadStatus.style.display = 'none';
        }
        settings.downloadProgressBar.style.display = 'none';
        const languageSelected = currentState.downloadLanguage;
        const isLanguageDownloaded = currentState.downloadedLanguages.includes(languageSelected);
        if (isLanguageDownloaded) {
            settings.startDownloadButton.textContent = `Downloaded (${languageSelected.toUpperCase()})`;
            settings.startDownloadButton.disabled = true;
            if (!settings.downloadStatusMessage.textContent.includes('Clearing')) {
                settings.downloadStatusMessage.textContent = `Bible for ${languageSelected.toUpperCase()} is downloaded.`;
                settings.downloadStatus.style.display = 'block';
            }
        } else {
            settings.startDownloadButton.textContent = 'Download Bible for Offline Use';
            settings.startDownloadButton.disabled = Object.keys(currentState.booksInfo).length === 0;
            if (!statusMsg.includes('complete') && !statusMsg.includes('failed') && !statusMsg.includes('cancelled')) {
                settings.downloadStatusMessage.textContent = '';
                settings.downloadStatus.style.display = 'none';
            }
        }
    }
}

let lastUiUpdateTime = 0;
const UI_UPDATE_INTERVAL = 300;
export function throttledUpdateDownloadUI() {
    const now = Date.now();
    if (now - lastUiUpdateTime > UI_UPDATE_INTERVAL) {
        updateDownloadUI();
        lastUiUpdateTime = now;
    }
}


// ===================================================================================
// AUDIO PLAYER UI
// ===================================================================================

export function updateAudioUI() {
    if (!audioElement || !audioPlayPauseBtn || !audioProgressBar) {
        if (audioModalTriggerButton) audioModalTriggerButton.style.display = 'none';
        return;
    }
    if (audioModalTriggerButton) audioModalTriggerButton.style.display = '';

    const viewBookId = currentState.audioState.currentViewBookId || currentState.book;
    const viewChapter = currentState.audioState.currentViewChapter || currentState.chapter;
    let modalHeaderRef = '...';
    if (viewBookId && viewChapter) {
        const bookInfo = currentState.booksInfo[viewBookId];
        const viewBookDisplayName = bookInfo ? (currentState.language === 'en' ? bookInfo.englishName : bookInfo.amharicName) || viewBookId : viewBookId;
        modalHeaderRef = `${viewBookDisplayName} ${viewChapter}`;
    } else {
        modalHeaderRef = 'No Chapter Selected';
    }
    const audioModalHeaderRef = audioPlayerModal?.querySelector('#audioModalHeaderRef');
    if (audioModalHeaderRef) audioModalHeaderRef.textContent = modalHeaderRef;

    const isAudioAvailableForView = currentState.audioState.currentViewAudioReady;

    if (currentState.audioState.isPlaying) {
        audioPlayPauseBtn.textContent = "⏸️";
        audioPlayPauseBtn.setAttribute('aria-label', 'Pause Audio');
    } else {
        if (currentState.audioState.isLoading) {
            audioPlayPauseBtn.textContent = "...";
            audioPlayPauseBtn.setAttribute('aria-label', 'Loading Audio');
        } else if (!isAudioAvailableForView) {
            audioPlayPauseBtn.textContent = "🔇";
            audioPlayPauseBtn.setAttribute('aria-label', `Audio Not Available for ${modalHeaderRef}`);
        } else {
            audioPlayPauseBtn.textContent = "▶️";
            audioPlayPauseBtn.setAttribute('aria-label', `Play Audio for ${modalHeaderRef}`);
        }
    }
    audioPlayPauseBtn.disabled = !isAudioAvailableForView || currentState.audioState.isLoading;

    const duration = currentState.audioState.duration;
    const currentTime = currentState.audioState.currentTime;
    audioCurrentTimeSpan.textContent = formatTime(currentTime);
    audioDurationSpan.textContent = formatTime(duration);
    const hasDuration = duration > 0 && isFinite(duration);
    if (hasDuration) {
        audioProgressBar.value = (currentTime / duration) * 100;
        audioProgressBar.disabled = false;
    } else {
        audioProgressBar.value = 0;
        audioProgressBar.disabled = true;
    }
    if (audioForwardBtn) audioForwardBtn.disabled = !hasDuration || currentState.audioState.isLoading || !isAudioAvailableForView;
    if (audioBackwardBtn) audioBackwardBtn.disabled = !hasDuration || currentState.audioState.isLoading || !isAudioAvailableForView;
}


/**
 * Initializes the UI module by setting up event listeners for UI-specific,
 * non-orchestrated actions.
 */
export function init() {
    settings.aboutAppButton?.addEventListener('click', () => {
        const version = settings.appVersionSpan?.textContent || '?.?.?';
        alert(`Divine Scripture Explorer v${version}\n\n` +
            `Core Features:\n` +
            `- **Offline Book & Theme Browsing**\n` +
            `- **Offline Chapter Reading (Downloaded)**\n` +
            `- Verse of the Day (Online)\n` +
            `- Flexible Reading View\n` +
            `- Cross-References (Online/Downloaded)\n` +
            `- Personal Notes, Favourites, Reflections\n` +
            `- Reference & Keyword Search (Online/Downloaded)\n` +
            `- Recent Books History\n\n` +
            `Usability & Customization:\n` +
            `- Appearance Settings (Font, Size, Dark Mode)\n` +
            `- UI Auto-Hide\n` +
            `- Screen Keep Awake\n` +
            `- Data Export/Import/Clear\n` +
            `- Dynamic Theme View Backgrounds (Online)\n` +
            `- Audio Player (Online)\n` +
            `- Action Bar & Verse Selection\n` +
            `- Download Management\n\n` +
            `Recent Updates (v3.0.0):\n` +
            `- **Major Offline Capability Update:** Books, Themes, and Downloaded Chapters are now accessible offline.\n` +
            `- Improved Download Reliability via Pagination.\n` +
            `- Enhanced Error Handling and UI Resilience.\n` +
            `- Verse of the Day Feature.\n` +
            `- Action Bar & Enhanced Verse Selection Logic.\n\n` +
            `Uses Supabase (Online DB & Storage) & IndexedDB/LocalStorage (Offline Cache).`);
    });

    settings.canonInfoButton?.addEventListener('click', () => {
        const { OT, NT, AP, OTHER } = currentState.bookList;
        if (!OT) return; // Guard against null if data isn't loaded
        const total = OT.length + NT.length + AP.length + (OTHER?.length || 0);
        alert(`Canon Info (Loaded: ${total} Books)\n\nOT: ${OT.length}\nNT: ${NT.length}\nApocrypha/EOTC: ${AP.length}${(OTHER?.length || 0) > 0 ? `\nOther: ${OTHER.length}` : ''}`);
    });

    console.log("UI module initialized with its own listeners.");
}

    // --- Settings View: Data Management Accordion ---
    const dataManagementTrigger = document.getElementById('dataManagementTrigger');
    const dataManagementOptions = document.getElementById('dataManagementOptions');
    const triggerIcon = dataManagementTrigger?.querySelector('.trigger-icon');

    if (dataManagementTrigger && dataManagementOptions && triggerIcon) {
        const toggleAccordion = () => {
            const isExpanded = dataManagementTrigger.getAttribute('aria-expanded') === 'true';
            dataManagementTrigger.setAttribute('aria-expanded', String(!isExpanded));
            dataManagementOptions.classList.toggle('hidden');
            dataManagementOptions.setAttribute('aria-hidden', String(isExpanded));
            triggerIcon.textContent = isExpanded ? '▶' : '▼';
        };

        dataManagementTrigger.addEventListener('click', toggleAccordion);
        dataManagementTrigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleAccordion();
            }
        });
    }