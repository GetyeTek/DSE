// --- File: js/userdata.js ---
// This module manages all user-specific data including notes, favourites, reflections,
// recent books, settings, and data management operations (import/export/clear).
console.log("[Module Init] userdata.js loaded.");

import { currentState, REFLECTION_STORAGE_KEY, DOWNLOAD_LANGUAGE_STORAGE_KEY } from './state.js';
import * as ui from './ui.js';
import * as theme from './theme.js';

// ===================================================================================
// MODULE-LEVEL STATE & DEPENDENCIES
// ===================================================================================

let _openReadingView = null; // Dependency injected from app.js

// ===================================================================================
// PRIVATE CORE FUNCTIONS (Load & Save from LocalStorage)
// ===================================================================================

/** Generic function to load an array of items from LocalStorage. */
function _loadItems(key, stateProperty) {
    try {
        const storedData = localStorage.getItem(key);
        currentState[stateProperty] = storedData ? JSON.parse(storedData) : [];
    } catch (error) {
        console.error(`Error loading ${stateProperty} from LocalStorage:`, error);
        currentState[stateProperty] = [];
    }
}

/** Generic function to save an array of items to LocalStorage. */
export function saveItems(key, stateProperty) {
    try {
        const itemsToSave = currentState[stateProperty].map(item => ({
            ...item,
            timestamp: item.timestamp || Date.now() // Ensure timestamp on save
        })).sort((a, b) => b.timestamp - a.timestamp); // Sort by newest first

        localStorage.setItem(key, JSON.stringify(itemsToSave));
    } catch (error) {
        console.error(`Error saving ${stateProperty} to LocalStorage:`, error);
        ui.showTempMessage(`Could not save ${stateProperty}. Storage might be full.`, 'error');
    }
}

// ===================================================================================
// NOTES & FAVOURITES LOGIC
// ===================================================================================

/** Saves a note for an array of selected verse details. */
export function saveNoteForVerses(verseDetailsArray, noteText, selectedElements) {
    if (!verseDetailsArray?.length || !noteText?.trim()) {
        if (noteText !== null) ui.showTempMessage('Note cannot be empty.', 'error');
        return;
    }
    
    let notesAdded = 0;
    verseDetailsArray.forEach(v => {
        const bookInfo = currentState.booksInfo[v.bookId];
        const displayBookName = currentState.language === 'en' ? bookInfo?.englishName || v.bookId : bookInfo?.amharicName || v.bookId;
        const selectedElement = Array.from(selectedElements).find(el => el.dataset.verseId === v.verseId);
        const displayNum = selectedElement?.dataset.verseDisplayNum || v.verse;
        const displayRef = `${displayBookName} ${v.chapter}:${displayNum}`;
        const verseTextSpan = selectedElement?.querySelector('.verse-text');
        const textOnly = verseTextSpan?.textContent.trim() || v.text || '';

        const newNote = {
            id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            bookId: v.bookId,
            chapter: v.chapter,
            verse: v.verse,
            verseDisplayNum: displayNum,
            verseId: v.verseId,
            verseText: textOnly,
            userNote: noteText.trim(),
            displayRef: displayRef,
            timestamp: Date.now()
        };
        currentState.userNotes.push(newNote);
        notesAdded++;
    });

    if (notesAdded > 0) {
        saveItems('userNotes', 'userNotes');
        ui.renderUserItems('note');
        ui.showTempMessage(`Note saved for ${notesAdded} verse(s)!`, 'success');
    }
}

/** Toggles favourite status for an array of selected verse details. */
export function toggleFavouritesForVerses(verseDetailsArray, selectedElements) {
    if (!verseDetailsArray?.length) return;

    let addedCount = 0;
    let removedCount = 0;
    const existingFavVerseIds = new Set(currentState.userFavourites.map(fav => fav.verseId));
    const toAdd = verseDetailsArray.filter(v => !existingFavVerseIds.has(v.verseId));
    const toRemoveIds = new Set(verseDetailsArray.filter(v => existingFavVerseIds.has(v.verseId)).map(v => v.verseId));

    if (toRemoveIds.size > 0) {
        currentState.userFavourites = currentState.userFavourites.filter(fav => !toRemoveIds.has(fav.verseId));
        removedCount = toRemoveIds.size;
    }

    if (toAdd.length > 0) {
        const newFavourites = toAdd.map(v => {
            const bookInfo = currentState.booksInfo[v.bookId];
            const displayBookName = currentState.language === 'en' ? bookInfo?.englishName || v.bookId : bookInfo?.amharicName || v.bookId;
            const selectedElement = Array.from(selectedElements).find(el => el.dataset.verseId === v.verseId);
            const displayNum = selectedElement?.dataset.verseDisplayNum || v.verse;
            const displayRef = `${displayBookName} ${v.chapter}:${displayNum}`;
            const verseTextSpan = selectedElement?.querySelector('.verse-text');
            const textOnly = verseTextSpan?.textContent.trim() || v.text || '';

            return {
                id: `fav-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                bookId: v.bookId, chapter: v.chapter, verse: v.verse,
                verseDisplayNum: displayNum, verseId: v.verseId, verseText: textOnly,
                displayRef: displayRef, timestamp: Date.now()
            };
        });
        currentState.userFavourites.push(...newFavourites);
        addedCount = newFavourites.length;
    }

    if (addedCount > 0 || removedCount > 0) {
        saveItems('userFavourites', 'userFavourites');
        ui.renderUserItems('favourite');
        let feedback = [];
        if (addedCount > 0) feedback.push(`Added ${addedCount} to favourites.`);
        if (removedCount > 0) feedback.push(`Removed ${removedCount} from favourites.`);
        ui.showTempMessage(feedback.join(' '), 'success');
    }
}

/** Deletes a single note or favourite by its ID. */
function _deleteUserItem(type, itemId) {
    if (!itemId || !confirm(`Are you sure you want to delete this ${type}?`)) return;

    const key = type === 'note' ? 'userNotes' : 'userFavourites';
    const initialLength = currentState[key].length;
    currentState[key] = currentState[key].filter(item => item.id !== itemId);

    if (currentState[key].length < initialLength) {
        saveItems(key, key);
        ui.renderUserItems(type);
        ui.showTempMessage(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted.`, 'success');
    }
}

// ===================================================================================
// REFLECTIONS LOGIC
// ===================================================================================

/** Saves a new reflection from the main input form. */
function _saveNewReflection() {
    const text = ui.newReflectionTextarea?.value.trim();
    if (!text) {
        ui.showTempMessage('Reflection cannot be empty.', 'error');
        ui.newReflectionTextarea.focus();
        return;
    }
    const newReflection = {
        id: `reflect-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        text: text,
        timestamp: Date.now()
    };
    currentState.reflections.push(newReflection);
    saveItems(REFLECTION_STORAGE_KEY, 'reflections');
    ui.renderReflections();
    ui.hideAddForm();
}

/** Deletes a reflection by its ID. */
function _deleteReflection(id) {
    if (!confirm('Are you sure you want to delete this reflection?')) return;

    const initialLength = currentState.reflections.length;
    currentState.reflections = currentState.reflections.filter(r => r.id !== id);

    if (currentState.reflections.length < initialLength) {
        saveItems(REFLECTION_STORAGE_KEY, 'reflections');
        ui.renderReflections();
    }
}

/** Saves an edited reflection. */
function _saveEditedReflection(li, reflection, textarea) {
    const newText = textarea.value.trim();
    if (!newText) {
        if (confirm('Reflection is empty. Delete it instead?')) {
            _deleteReflection(reflection.id);
        }
        return;
    }
    const reflectionIndex = currentState.reflections.findIndex(r => r.id === reflection.id);
    if (reflectionIndex > -1) {
        currentState.reflections[reflectionIndex].text = newText;
        currentState.reflections[reflectionIndex].timestamp = Date.now();
        saveItems(REFLECTION_STORAGE_KEY, 'reflections');
        ui.renderReflections(); // Re-renders list and exits edit mode
    }
}

// ===================================================================================
// RECENT BOOKS LOGIC
// ===================================================================================

/** Updates the list of recently viewed books. */
export function updateRecentBooks(bookId, chapterNum, verseIdOrRef) {
    if (!bookId || !chapterNum || !currentState.booksInfo[bookId]) return;

    const existingIndex = currentState.recentBooks.findIndex(item => item.bookId === bookId);
    let updatedEntry;

    if (existingIndex > -1) {
        updatedEntry = currentState.recentBooks.splice(existingIndex, 1)[0];
    } else {
        updatedEntry = { bookId };
    }
    
    updatedEntry.chapter = chapterNum;
    updatedEntry.verseId = verseIdOrRef;
    updatedEntry.timestamp = Date.now();
    
    currentState.recentBooks.unshift(updatedEntry);
    currentState.recentBooks.splice(currentState.MAX_RECENT_BOOKS);
    
    saveItems('userRecentBooks', 'recentBooks');
    ui.renderRecentBooks();
}

/** Updates the last-viewed position (verse) for the currently open book. */
export function updateCurrentRecentPosition(centerVerseId) {
    if (!currentState.book || !centerVerseId) return;

    const recentEntry = currentState.recentBooks.find(item => item.bookId === currentState.book);
    if (recentEntry) {
        recentEntry.verseId = centerVerseId;
        recentEntry.timestamp = Date.now();
        recentEntry.chapter = currentState.chapter; // Ensure chapter is also up-to-date
        saveItems('userRecentBooks', 'recentBooks');
        // No need to re-render here, as it's a background save on scroll.
    }
}

// ===================================================================================
// DATA MANAGEMENT (Export, Import, Clear)
// ===================================================================================

function _clearAllData() {
    if (!confirm("WARNING: This will delete ALL your notes, favourites, reflections, history, recent books, and reset all settings. This cannot be undone. Are you sure?")) {
        return false;
    }
    
    const keysToClear = [
        'userNotes', 'userFavourites', REFLECTION_STORAGE_KEY, 'searchHistory', 'userRecentBooks',
        'fontSize', 'fontFamily', 'darkModeSetting', 'autoHideDelay', 'keepAwake', 'browseViewMode',
        'downloadedLanguages', 'downloadedBooksByLanguage', DOWNLOAD_LANGUAGE_STORAGE_KEY,
    ];
    keysToClear.forEach(key => localStorage.removeItem(key));

    try {
        indexedDB.deleteDatabase('dse-cache');
    } catch (e) { console.error("Error clearing IndexedDB:", e); }

    // Reset runtime state
    Object.assign(currentState, {
        userNotes: [], userFavourites: [], reflections: [], recentBooks: [], searchHistory: [],
        downloadedLanguages: [], downloadedBooksByLanguage: {}, isDownloading: false,
        fontSize: 1.1, fontFamily: "'EB Garamond', serif", darkModeSetting: 'system',
        autoHideDelay: 3000, downloadLanguage: "am",
        globalCrossRefsMapByLang: { am: null, en: null },
    });
    
    ui.showTempMessage("All user data cleared and settings reset.", "success");
    return true;
}

function _exportData() {
    const userData = {
        timestamp: Date.now(),
        version: ui.settings.appVersionSpan?.textContent || 'unknown',
        data: {
            notes: currentState.userNotes,
            favourites: currentState.userFavourites,
            reflections: currentState.reflections,
            searchHistory: currentState.searchHistory,
            recentBooks: currentState.recentBooks,
            settings: {
                fontSize: currentState.fontSize,
                fontFamily: currentState.fontFamily,
                darkModeSetting: currentState.darkModeSetting,
                autoHideDelay: currentState.autoHideDelay,
                keepAwake: localStorage.getItem('keepAwake') === 'true',
                language: currentState.language,
                downloadLanguage: currentState.downloadLanguage
            }
        }
    };
    
    try {
        const dataStr = JSON.stringify(userData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dse_export_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
    } catch (error) {
        console.error("Error during data export:", error);
        ui.showTempMessage("Failed to export data.", "error");
    }
}

function _importData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const imported = JSON.parse(event.target.result);
            if (!imported?.data) {
                ui.showTempMessage("Invalid import file format.", "error");
                return;
            }
            const data = imported.data;
            
            // Merge arrays (notes, favourites, reflections)
            ['notes', 'favourites', 'reflections'].forEach(key => {
                if (Array.isArray(data[key])) {
                    const stateKey = key === 'notes' ? 'userNotes' : key === 'favourites' ? 'userFavourites' : 'reflections';
                    const storageKey = key === 'reflections' ? REFLECTION_STORAGE_KEY : `user${key.charAt(0).toUpperCase() + key.slice(1)}`;
                    const existingIds = new Set(currentState[stateKey].map(item => item.id));
                    const newItems = data[key].filter(item => item.id && !existingIds.has(item.id));
                    currentState[stateKey].push(...newItems);
                    saveItems(storageKey, stateKey);
                }
            });

            // Overwrite arrays (history, recents)
            if (Array.isArray(data.searchHistory)) {
                currentState.searchHistory = [...new Set(data.searchHistory)].slice(0, currentState.MAX_HISTORY);
                localStorage.setItem('searchHistory', JSON.stringify(currentState.searchHistory));
            }
            if (Array.isArray(data.recentBooks)) {
                currentState.recentBooks = data.recentBooks.slice(0, currentState.MAX_RECENT_BOOKS);
                saveItems('userRecentBooks', 'recentBooks');
            }

            // Overwrite settings
            if (data.settings) {
                const s = data.settings;
                currentState.fontSize = parseFloat(s.fontSize) || 1.1;
                currentState.fontFamily = s.fontFamily || "'EB Garamond', serif";
                currentState.darkModeSetting = s.darkModeSetting || 'system';
                currentState.browseViewMode = s.browseViewMode || 'theme';
                currentState.autoHideDelay = parseInt(s.autoHideDelay) || 3000;

                currentState.downloadLanguage = s.downloadLanguage || 'am';
                
                localStorage.setItem('fontFamily', currentState.fontFamily);
                localStorage.setItem('darkModeSetting', currentState.darkModeSetting);
                localStorage.setItem('browseViewMode', currentState.browseViewMode);
                localStorage.setItem('autoHideDelay', currentState.autoHideDelay);       localStorage.setItem('autoHideDelay', currentState.autoHideDelay);
                localStorage.setItem('keepAwake', String(!!s.keepAwake));
                localStorage.setItem(DOWNLOAD_LANGUAGE_STORAGE_KEY, currentState.downloadLanguage);
            }

            // Refresh entire UI
            ui.renderUserItems('note');
            ui.renderUserItems('favourite');
            ui.renderReflections();
            ui.renderRecentBooks();
            ui.applyReadingSettings();
            theme.update();
            ui.updateDownloadUI();
            
            ui.showTempMessage(`Successfully imported data.`, "success");

        } catch (e) {
            console.error("Error processing import file:", e);
            ui.showTempMessage("Failed to process import file.", "error");
        }
    };
    reader.readAsText(file);
}

// ===================================================================================
// EVENT HANDLERS
// ===================================================================================

function _handleUserItemClick(event) {
    const itemElement = event.target.closest('[data-item-id]');
    if (!itemElement) return;

    const itemId = itemElement.dataset.itemId;
    const type = itemElement.classList.contains('note-item') ? 'note' : 'favourite';

    if (event.target.closest('.delete-item-button')) {
        _deleteUserItem(type, itemId);
    } else if (event.target.closest(`.${type}-item-content`) && _openReadingView) {
        const { book, chapter, navigationTarget } = itemElement.dataset;
        if (book && chapter && navigationTarget) {
            _openReadingView(book, chapter, navigationTarget);
        }
    }
}

function _handleReflectionCardClick(event) {
    const li = event.target.closest('.reflection-card');
    if (!li) return;
    const reflectionId = li.dataset.reflectionId;
    const reflection = currentState.reflections.find(r => r.id === reflectionId);
    if (!reflection) return;

    if (event.target.closest('.edit-reflection-button')) ui.toggleEditMode(li);
    else if (event.target.closest('.delete-reflection-button')) _deleteReflection(reflection.id);
    else if (event.target.closest('.save-reflection-button')) _saveEditedReflection(li, reflection, li.querySelector('textarea'));
    else if (event.target.closest('.cancel-reflection-button')) ui.cancelEditMode(li);
    else if (event.target.closest('.reflection-card-header, .reflection-content-display')) ui.toggleExpanded(li);
}

function _handleRecentBookClick(event) {
    const bookCard = event.target.closest('.recent-book-card-item');
    if (bookCard && _openReadingView) {
        const { book, chapter, navigationTarget } = bookCard.dataset;
        if (book && chapter && navigationTarget) {
            _openReadingView(book, chapter, navigationTarget);
        }
    }
}

// ===================================================================================
// PUBLIC INTERFACE
// ===================================================================================

/**
 * Initializes the User Data module.
 * @param {object} dependencies - Functions from app.js needed for cross-module interaction.
 * @param {function} dependencies.openReadingView - Function to open the main reading view.
 */
export function init(dependencies) {
    _openReadingView = dependencies.openReadingView;

    // Load initial data from LocalStorage
    _loadItems('userNotes', 'userNotes');
    _loadItems('userFavourites', 'userFavourites');
    _loadItems(REFLECTION_STORAGE_KEY, 'reflections');
    _loadItems('userRecentBooks', 'recentBooks');
    currentState.searchHistory = JSON.parse(localStorage.getItem('searchHistory') || '[]');

    // Bind event listeners
    ui.notesListContainer?.addEventListener('click', _handleUserItemClick);
    ui.favouritesListContainer?.addEventListener('click', _handleUserItemClick);
    ui.reflectionListContainer?.addEventListener('click', _handleReflectionCardClick);
    ui.addNewReflectionButton?.addEventListener('click', ui.showAddForm);
    ui.cancelNewReflectionButton?.addEventListener('click', ui.hideAddForm);
    ui.saveNewReflectionButton?.addEventListener('click', _saveNewReflection);
    ui.recentBooksContainer?.addEventListener('click', _handleRecentBookClick);

    // Data Management Listeners
    document.getElementById('clearAllUserDataButton')?.addEventListener('click', () => {
        if (_clearAllData()) {
            // Re-render all relevant UI after a full clear
            ui.renderUserItems('note');
            ui.renderUserItems('favourite');
            ui.renderReflections();
            ui.renderRecentBooks();
            ui.applyReadingSettings();
            theme.update();
            ui.updateDownloadUI();
        }
    });
    document.getElementById('exportUserDataButton')?.addEventListener('click', _exportData);
    document.getElementById('importUserDataFile')?.addEventListener('change', (event) => {
        const file = event.target.files?.[0];
        if (file) {
            _importData(file);
            event.target.value = ''; // Reset file input
        }
    });

    console.log("User Data module initialized.");
}