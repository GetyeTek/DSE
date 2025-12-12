// --- File: js/search.js ---
// This module encapsulates all logic for search functionality, including query parsing,
// offline/online execution, and UI rendering for the book list view.
console.log("[Module Init] search.js loaded.");

import { parseSearchQuery } from './utils.js';
import * as api from './api.js';
import * as cache from './cache.js';
import { currentState } from './state.js';

// ===================================================================================
// DOM ELEMENT REFERENCES
// ===================================================================================

const bookListSearchInput = document.getElementById('bookListSearchInput');
const bookListSearchButton = document.getElementById('bookListSearchButton');
const bookListClearSearchButton = document.getElementById('bookListClearSearchButton');

const bookListStandardContent = document.getElementById('bookListStandardContent');
const bookListSearchResultsContainer = document.getElementById('bookListSearchResultsContainer');
const bookListNoResults = document.getElementById('bookListNoResults');

// ===================================================================================
// MODULE-LEVEL STATE & DEPENDENCIES
// ===================================================================================

let _openReadingView = null; // Dependency injected from app.js
let _supabaseClient = null; // Dependency injected from app.js

// ===================================================================================
// PRIVATE UI FUNCTIONS
// ===================================================================================

/** Toggles the book list view between standard list and search results. */
function _toggleViewMode(showSearchResults) {
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

/** Displays search results in the UI. */
function _displayResults(results, parsedQuery) {
    if (!bookListSearchResultsContainer || !bookListNoResults) return;

    bookListSearchResultsContainer.innerHTML = '';

    if (results?.length > 0) {
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

/** Displays an error message in the search results area. */
function _displayError(message) {
    if (!bookListSearchResultsContainer || !bookListNoResults) return;
    bookListSearchResultsContainer.innerHTML = '';
    bookListNoResults.textContent = message;
    bookListNoResults.style.display = 'block';
}

// ===================================================================================
// PRIVATE SEARCH LOGIC
// ===================================================================================

/** Performs a keyword search on locally cached (IndexedDB) data. */
async function _performClientSideSearch(keyword) {
    const searchTerm = keyword.toLowerCase().trim();
    if (searchTerm.length < 2) return [];

    const results = [];
    const languageToSearch = currentState.language;

    try {
        const allChapterKeys = await cache.getAllChapterKeysForLanguage(languageToSearch);
        
        for (const key of allChapterKeys) {
            const chapterData = await cache.getChapterByKey(key);
            if (chapterData?.data) {
                const keyParts = key.split('-');
                const bookId = keyParts.slice(0, -2).join('-');
                const chapterNum = parseInt(keyParts[keyParts.length - 2], 10);
                
                if (bookId && !isNaN(chapterNum) && currentState.booksInfo[bookId]) {
                    const bookInfo = currentState.booksInfo[bookId];
                    const displayBookName = languageToSearch === 'en' ? bookInfo.englishName || bookId : bookInfo.amharicName || bookId;
                    
                    for (const verse of chapterData.data) {
                        const verseText = verse?.verse_text;
                        if (verseText && verseText.toLowerCase().includes(searchTerm)) {
                            const fullRef = `${displayBookName} ${verse.chapter_num}:${verse.verse_num}`;
                            const highlightRegex = new RegExp(searchTerm, 'gi');
                            const highlightedHtml = verseText.replace(highlightRegex, '<mark>$&</mark>');
                            
                            results.push({
                                bookId: bookId,
                                chapter: chapterNum,
                                verse: verse.verse_num,
                                fullReference: fullRef,
                                highlightedHtml: highlightedHtml,
                                isRefResult: false,
                            });
                        }
                    }
                }
            }
        }
        return results;
    } catch (error) {
        console.error(`Error during client-side search:`, error);
        return []; // Return empty on error
    }
}

/** Performs a full-text search against the backend API. */
async function _performOnlineSearch(keyword) {
    if (!_supabaseClient) return [];
    
    const searchTerm = keyword.toLowerCase().trim();
    if (searchTerm.length < 2) {
        _displayError("Search term too short (min 2 characters).");
        return [];
    }
    
    try {
        const { data, error } = await api.searchVerses({
            language: currentState.language,
            keyword: searchTerm
        });
        if (error) throw error;
        if (!data || !Array.isArray(data)) return [];

        return data.map(result => {
            const bookInfo = currentState.booksInfo[result.book_id];
            const displayBookName = bookInfo ? (currentState.language === 'en' ? bookInfo.englishName || result.book_id : bookInfo.amharicName || result.book_id) : result.book_id;
            const fullRef = `${displayBookName} ${result.chapter_num}:${result.verse_num}`;
            return {
                bookId: result.book_id,
                chapter: result.chapter_num,
                verse: result.verse_num,
                fullReference: fullRef,
                highlightedHtml: result.headline || result.text || '',
                isRefResult: false,
            };
        }).filter(Boolean);
    } catch (error) {
        console.error("Error during online search:", error);
        return [];
    }
}

/** Finds a direct Bible reference, checking cache first. */
async function _findReference(parsedRef) {
    const { bookId, chapter, verse } = parsedRef;
    const bookInfo = currentState.booksInfo[bookId];
    if (!bookId || !bookInfo) return [];

    const lang = currentState.language;
    const displayBookName = lang === 'en' ? bookInfo.englishName || bookId : bookInfo.amharicName || bookId;

    if (!chapter) { // Book-only result
        return [{
            bookId, chapter: 1, verse: null, fullReference: displayBookName,
            highlightedHtml: `View Book (${bookInfo.chapters || '?'} chapters)`, isRefResult: true,
        }];
    }
    
    // Chapter or Verse search
    let versesData = (await cache.getChapter(bookId, chapter, lang))?.data;
    if (!versesData && _supabaseClient) {
        const { data } = await api.fetchChapterContent({ bookId, chapter, language: lang });
        versesData = data;
        if (versesData) {
            cache.saveChapter(bookId, chapter, lang, versesData, false);
        }
    }
    
    if (!versesData) return [];

    if (!verse) { // Chapter-only result
        return [{
            bookId, chapter, verse: null, fullReference: `${displayBookName} ${chapter}`,
            highlightedHtml: `View Chapter ${chapter} (${versesData.length} verses)`, isRefResult: true,
        }];
    }

    // Verse/range result
    let [startVerse, endVerse] = (verse.includes('-') ? verse.split('-') : [verse, verse]).map(Number);
    const targetVerses = versesData.filter(v => v.verse_num >= startVerse && v.verse_num <= endVerse);
    
    if (targetVerses.length > 0) {
        const textSnippet = targetVerses.map(v => v.verse_text || '').join(" ");
        return [{
            bookId, chapter, verse, fullReference: `${displayBookName} ${chapter}:${verse}`,
            highlightedHtml: textSnippet.trim(), isRefResult: true,
        }];
    }
    
    return [];
}

// ===================================================================================
// PUBLIC INTERFACE / ORCHESTRATION
// ===================================================================================

/** Clears the search input and results, returning to the standard book list. */
export function clear() {
    if (bookListSearchInput) bookListSearchInput.value = '';
    currentState.isSearching = false;
    _toggleViewMode(false);
}

/** The main function to execute a search based on the input field's value. */
export async function execute() {
    const query = bookListSearchInput?.value.trim();
    if (!query) {
        clear();
        return;
    }

    const parsedQuery = parseSearchQuery(query, currentState.booksInfo, currentState.bookAliasMap);
    if (!parsedQuery) {
        _displayError("Could not understand search query.");
        return;
    }

    currentState.isSearching = true;
    _toggleViewMode(true);
    bookListSearchResultsContainer.innerHTML = '<p class="loading-message"><span class="loading-dots">Searching...</span></p>';
    
    let finalResults = [];
    let searchError = null;

    try {
        if (parsedQuery.type === 'reference') {
            finalResults = await _findReference(parsedQuery);
        } else { // Keyword search
            // Offline-first approach
            finalResults = await _performClientSideSearch(parsedQuery.query);
            if (finalResults.length === 0 && _supabaseClient) {
                bookListSearchResultsContainer.innerHTML = '<p class="loading-message"><span class="loading-dots">No offline results, searching database...</span></p>';
                finalResults = await _performOnlineSearch(parsedQuery.query);
            }
        }
    } catch (e) {
        searchError = e;
        console.error("Critical error during search execution:", e);
    }
    
    if (searchError) {
        _displayError("An error occurred during the search.");
    } else {
        _displayResults(finalResults, parsedQuery);
    }
}

/** Handles clicks on a search result item to navigate. */
function _handleResultClick(event) {
    const resultItem = event.target.closest('.search-result-item');
    if (resultItem && _openReadingView) {
        const { book, chapter, verse } = resultItem.dataset;
        if (book && currentState.booksInfo[book]) {
            _openReadingView(book, chapter || 1, verse);
        } else {
            console.error("Search result navigation failed: Invalid book ID", book);
        }
    }
}

/**
 * Initializes the Search module.
 * @param {object} dependencies - Functions from app.js needed for cross-module interaction.
 * @param {function} dependencies.openReadingView - Function to open the main reading view.
 * @param {object} dependencies.supabaseClient - The initialized Supabase client instance.
 */
export function init(dependencies) {
    _openReadingView = dependencies.openReadingView;
    _supabaseClient = dependencies.supabaseClient;

    bookListSearchInput?.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            execute();
            e.target.blur();
        } else if (e.key === 'Escape') {
            clear();
        }
    });

    bookListSearchInput?.addEventListener('input', () => {
        if (bookListClearSearchButton) {
            bookListClearSearchButton.style.display = bookListSearchInput.value.trim() ? 'inline-block' : 'none';
        }
    });
    
    bookListSearchButton?.addEventListener('click', execute);
    bookListClearSearchButton?.addEventListener('click', clear);
    bookListSearchResultsContainer?.addEventListener('click', _handleResultClick);

    console.log("Search module initialized.");
}
