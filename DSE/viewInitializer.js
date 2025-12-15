// --- File: js/viewInitializer.js ---
// This module is responsible for loading the core application data (books, themes, aliases)
// and performing the initial rendering of the main views like the Theme and Book List views.
console.log("[Module Init] viewInitializer.js loaded.");

import { currentState } from './state.js';
import * as api from './api.js';
import * as cache from './cache.js';
import * as ui from './ui.js';
import { getTestamentKey } from './utils.js';

// ===================================================================================
// PRIVATE HELPER FUNCTIONS
// ===================================================================================

/**
 * Displays loading indicators in the UI before data is fetched.
 */
function _showLoadingIndicators() {
    const themeViewContainer = ui.views.themeView;
    if (themeViewContainer) {
        themeViewContainer.querySelectorAll('.theme-card[data-theme-name] .books-container').forEach(container => {
            container.innerHTML = '<p class="loading-books"><span class="loading-dots">Loading Books...</span></p>';
        });
    }
    if (ui.recentBooksContainer) {
        ui.recentBooksContainer.innerHTML = '<p class="loading-books"><span class="loading-dots">Loading...</span></p>';
    }
    Object.values(ui.bookListULs).forEach(ul => {
        if (ul) ul.innerHTML = '<li><span class="loading-dots">Loading...</span></li>';
    });
    if (ui.bookListSearchInput) ui.bookListSearchInput.disabled = true;
    if (ui.bookListSearchButton) ui.bookListSearchButton.disabled = true;
}

/**
 * Populates the `currentState` with processed book and alias data.
 * @param {Array} booksData - The raw book data from cache or API.
 * @param {Array} aliasesData - The raw alias data from cache or API.
 */
function _processAndPopulateState(booksData, aliasesData) {
    currentState.booksInfo = {};
    currentState.bookAliasMap = {};
    currentState.bookList = { OT: [], NT: [], AP: [], OTHER: [] };

    // Process aliases first
    if (aliasesData && Array.isArray(aliasesData)) {
        aliasesData.forEach(item => {
            if (item?.alias && item.book_id) {
                currentState.bookAliasMap[item.alias.toLowerCase()] = item.book_id;
            }
        });
    }

    // Process books
    if (booksData && Array.isArray(booksData)) {
        booksData.forEach(bookData => {
            const bookId = bookData?.id;
            if (!bookId) return;
            const testamentKey = getTestamentKey(bookData.testament);
            currentState.booksInfo[bookId] = {
                id: bookId,
                name: bookData.name || bookId,
                chapters: bookData.chapters || 0,
                amharicName: bookData.amharicName || bookData.name,
                englishName: bookData.name_en || bookData.name,
                testament: testamentKey,
                order: bookData.order,
            };
            if (currentState.bookList[testamentKey]) {
                currentState.bookList[testamentKey].push(bookId);
            }
        });
    }

    // Sort book lists by order
    Object.values(currentState.bookList).forEach(list => {
        list.sort((a, b) => (currentState.booksInfo[a]?.order || 999) - (currentState.booksInfo[b]?.order || 999));
    });
}

/**
 * Renders the Theme View using processed themes data.
 * @param {Array} themesData - The raw themes data from cache or API.
 */
function _renderThemeView(themesData) {
    const themeViewContainer = ui.views.themeView;
    if (!themeViewContainer) return;

    const processedThemes = {};
    if (themesData && Array.isArray(themesData)) {
        themesData.forEach(theme => {
            if (theme?.name && theme.bookIds) {
                processedThemes[theme.name.trim()] = theme.bookIds;
            }
        });
    }

    themeViewContainer.querySelectorAll('.theme-card[data-theme-name]:not([data-theme-name="Recent"])').forEach(cardElement => {
        const themeName = cardElement.dataset.themeName;
        const booksContainer = cardElement.querySelector('.books-container');
        if (!booksContainer) return;

        booksContainer.innerHTML = '';
        const bookIdsForTheme = processedThemes[themeName];

        if (bookIdsForTheme && bookIdsForTheme.length > 0) {
            const fragment = document.createDocumentFragment();
            bookIdsForTheme.forEach(bookId => {
                const bookInfo = currentState.booksInfo[bookId];
                if (bookInfo) {
                    const bookCard = document.createElement('div');
                    bookCard.className = 'book-card theme-book-card-item';
                    bookCard.dataset.book = bookId;
                    const title = document.createElement('h4');
                    title.textContent = currentState.language === 'en' ? bookInfo.englishName : bookInfo.amharicName;
                    bookCard.appendChild(title);
                    
                    const testamentDiv = document.createElement('div');
                    testamentDiv.className = `testament ${bookInfo.testament.toLowerCase()}-testament`; // Simplified class name
                    testamentDiv.textContent = bookInfo.testament;
                    bookCard.appendChild(testamentDiv);
                    fragment.appendChild(bookCard);
                }
            });
            booksContainer.appendChild(fragment);
        } else {
            booksContainer.innerHTML = '<p class="empty-list-message">No books assigned to this theme.</p>';
        }
    });
}


// ===================================================================================
// PUBLIC API
// ===================================================================================

/**
 * The main function of this module. It orchestrates the loading of core data
 * and the initial rendering of the application's main views.
 */
export async function loadAndRender() {
    _showLoadingIndicators();
    let booksData, themesData, aliasesData, loadError;

    // 1. Offline-first data fetching from cache
    try {
        [booksData, themesData, aliasesData] = await Promise.all([
            cache.getCoreData('books'),
            cache.getCoreData('themes'),
            cache.getCoreData('aliases')
        ]);
    } catch (cacheError) {
        console.error("ViewInitializer: Error accessing cache for core data.", cacheError);
        loadError = cacheError;
    }

    // 2. Fallback to API for any missing data
    const supabaseClient = api.getSupabaseClient();
    if (supabaseClient && (!booksData || !themesData || !aliasesData)) {
        const { books, themes, aliases, error } = await api.fetchCoreData();
        if (error) {
            if (!loadError) loadError = error;
        } else {
            if (!booksData && books) {
                booksData = books;
                cache.saveCoreData('books', booksData);
            }
            if (!themesData && themes) {
                themesData = themes;
                cache.saveCoreData('themes', themesData);
            }
            if (!aliasesData && aliases) {
                aliasesData = aliases;
                cache.saveCoreData('aliases', aliases);
            }
        }
    }

    // 3. Handle critical load failure
    if (!booksData || booksData.length === 0) {
        console.error("CRITICAL: Core book data could not be loaded from cache or API.", loadError);
        // In a real app, you'd show a persistent error message in the UI.
        Object.values(ui.bookListULs).forEach(ul => { if (ul) ul.innerHTML = `<li class="error-message">Error loading books.</li>`; });
        return;
    }

    // 4. Process data and populate application state
    _processAndPopulateState(booksData, aliasesData || []);
    
    // 5. Render the views with the now-populated state
    _renderThemeView(themesData || []);
    ui.populateBookLists(); // This UI function renders the Book List view
    ui.renderRecentBooks(); // This UI function renders the Recent Books card

    // 6. Re-enable UI elements
    if (ui.bookListSearchInput) ui.bookListSearchInput.disabled = false;
    if (ui.bookListSearchButton) ui.bookListSearchButton.disabled = false;
    
    console.log("ViewInitializer: Core data loaded and initial views rendered.");
}
