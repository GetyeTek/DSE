// --- File: js/download.js ---
// This module handles the entire workflow for downloading Bible content for offline use.
console.log("[Module Init] download.js loaded.");

import { currentState, DOWNLOAD_LANGUAGE_STORAGE_KEY } from './state.js';
import * as api from './api.js';
import * as cache from './cache.js';
import * as ui from './ui.js';

// ===================================================================================
// MODULE-LEVEL STATE & DEPENDENCIES
// ===================================================================================

let _supabaseClient = null; // Dependency injected from app.js

// A temporary tracker for a single download session
let _booksDownloadedInThisRun = [];

// ===================================================================================
// PRIVATE HELPER FUNCTIONS
// ===================================================================================

/** Processes a single book: fetches all its verses and saves them to the cache. */
async function _downloadAndProcessBook(bookInfo, language, overallSuccessTracker) {
    const { id: bookId, chapters: totalChaptersInBook, englishName, amharicName } = bookInfo;
    const bookDisplayName = language === 'en' ? englishName || bookId : amharicName || bookId;

    // Update progress UI for the book being started
    currentState.downloadProgress.currentBookId = bookId;
    currentState.downloadProgress.currentBookName = bookDisplayName;
    currentState.downloadProgress.totalChaptersInBook = totalChaptersInBook;
    currentState.downloadProgress.currentChapter = 0;
    ui.throttledUpdateDownloadUI();

    if (currentState.cancelDownloadFlag) return { status: 'cancelled' };

    // Skip if this book is already marked as fully downloaded for this language
    if ((currentState.downloadedBooksByLanguage[language] || []).includes(bookId)) {
        currentState.downloadProgress.downloadedChaptersOverall += totalChaptersInBook;
        _booksDownloadedInThisRun.push(bookId);
        ui.throttledUpdateDownloadUI();
        return { status: 'skipped', chapters: totalChaptersInBook };
    }

    // 1. Fetch all verses for the book from the API
    const { data: allVersesForBook, error: fetchError } = await api.fetchAllVersesForBook({
        bookId: bookId,
        language: language,
        onCancel: () => currentState.cancelDownloadFlag
    });

    if (currentState.cancelDownloadFlag) return { status: 'cancelled' };
    if (fetchError) {
        console.error(`Download Error: Failed to fetch data for book ${bookId}.`, fetchError);
        overallSuccessTracker.isSuccess = false;
        return { status: 'fetch_error' };
    }
    if (!allVersesForBook || allVersesForBook.length === 0) {
        console.warn(`Download Warning: No verse data returned for book ${bookId}.`);
        return { status: 'no_data' };
    }

    // 2. Save all chapters for the book in a single batch transaction to the cache
    const saveResult = await cache.saveBookChaptersInBatch(bookId, language, allVersesForBook);

    if (currentState.cancelDownloadFlag) return { status: 'cancelled' };
    if (saveResult.error) {
        console.error(`Download Error: Failed to save book ${bookId} to cache.`, saveResult.error);
        overallSuccessTracker.isSuccess = false;
        if (saveResult.error.name === 'QuotaExceededError') {
            ui.showTempMessage("Download failed: Device storage is full.", 'error');
            currentState.cancelDownloadFlag = true; // Stop all further downloads
        }
        return { status: 'save_error' };
    }

    // 3. Update progress and status
    currentState.downloadProgress.downloadedChaptersOverall += saveResult.savedCount;
    const lastChapterInBook = [...new Set(allVersesForBook.map(v => v.chapter_num))].pop();
    currentState.downloadProgress.currentChapter = lastChapterInBook || 0;
    
    // Mark as successful for this run only if all expected chapters were saved
    if (saveResult.savedCount >= totalChaptersInBook) {
        _booksDownloadedInThisRun.push(bookId);
    } else {
        console.warn(`Book ${bookId} saved with ${saveResult.savedCount}/${totalChaptersInBook} chapters.`);
        overallSuccessTracker.isSuccess = false; // Partial save is not a full success
    }
    
    return { status: 'success' };
}

/** Fetches and caches all cross-reference data for a given language. */
async function _downloadAndProcessCrossRefs(language, overallSuccessTracker) {
    if (currentState.cancelDownloadFlag) return false;
    
    const onProgress = ({ page }) => {
        currentState.downloadProgress.currentBookName = `Downloading Cross-Refs (Page ${page})...`;
        ui.throttledUpdateDownloadUI();
    };

    const { data: allCrossrefs, error } = await api.fetchAllCrossRefs({
        onCancel: () => currentState.cancelDownloadFlag,
        onProgress: onProgress
    });

    if (currentState.cancelDownloadFlag) return false;
    if (error) {
        console.error(`Download Error: Failed to fetch cross-references.`, error);
        overallSuccessTracker.isSuccess = false;
        return false;
    }
    if (!allCrossrefs || allCrossrefs.length === 0) {
        console.log("No cross-references found to download.");
        return true; // No data is not an error
    }
    
    currentState.downloadProgress.currentBookName = `Saving ${allCrossrefs.length} Cross-Refs...`;
    ui.throttledUpdateDownloadUI();
    
    const saveSuccess = await cache.saveCoreData(`crossrefs_${language}`, allCrossrefs);
    if (!saveSuccess) {
        console.error("Download Error: Failed to save cross-references to cache.");
        overallSuccessTracker.isSuccess = false;
        return false;
    }

    return true;
}

// ===================================================================================
// PUBLIC INTERFACE / ORCHESTRATION
// ===================================================================================

/** Starts the download process for the language selected in the UI. */
export async function start() {
    if (currentState.isDownloading) {
        ui.showTempMessage("Download already in progress.", 'info');
        return;
    }
    if (!_supabaseClient) {
        ui.showTempMessage("Cannot download: Database not connected.", 'error');
        return;
    }
    if (Object.keys(currentState.booksInfo).length === 0) {
        ui.showTempMessage("Cannot download: Book list not loaded.", 'error');
        return;
    }

    const language = currentState.downloadLanguage;
    const langDisplayName = language === 'am' ? 'Amharic' : 'English';
    if (!confirm(`Download the entire ${langDisplayName} Bible for offline use? This may use significant storage space.`)) {
        return;
    }
    
    // 1. Initialize State
    currentState.isDownloading = true;
    currentState.cancelDownloadFlag = false;
    _booksDownloadedInThisRun = [];
    const overallSuccessTracker = { isSuccess: true };

    const booksToDownload = Object.values(currentState.booksInfo)
        .filter(book => book?.chapters > 0)
        .sort((a, b) => a.order - b.order);

    currentState.downloadProgress = {
        language: language,
        currentBookId: null,
        currentBookName: "Preparing...",
        currentChapter: 0,
        totalChaptersInBook: 0,
        totalChaptersOverall: booksToDownload.reduce((sum, book) => sum + book.chapters, 0),
        downloadedChaptersOverall: 0,
    };
    ui.updateDownloadUI();

    try {
        // 2. Download Cross-References first
        const crossrefsSuccess = await _downloadAndProcessCrossRefs(language, overallSuccessTracker);
        
        // 3. Download Books in parallel batches
        const CONCURRENCY_LIMIT = 3;
        currentState.downloadProgress.currentBookName = "Downloading books...";
        ui.throttledUpdateDownloadUI();

        for (let i = 0; i < booksToDownload.length; i += CONCURRENCY_LIMIT) {
            if (currentState.cancelDownloadFlag) break;
            const batch = booksToDownload.slice(i, i + CONCURRENCY_LIMIT);
            await Promise.all(
                batch.map(book => _downloadAndProcessBook(book, language, overallSuccessTracker))
            );
        }

        // 4. Finalize and Update State
        const wasCancelled = currentState.cancelDownloadFlag;
        
        // Update the list of permanently downloaded books
        if (!currentState.downloadedBooksByLanguage[language]) {
            currentState.downloadedBooksByLanguage[language] = [];
        }
        _booksDownloadedInThisRun.forEach(bookId => {
            if (!currentState.downloadedBooksByLanguage[language].includes(bookId)) {
                currentState.downloadedBooksByLanguage[language].push(bookId);
            }
        });

        // Check if the entire language is now complete
        const allBooksDownloaded = booksToDownload.every(book => currentState.downloadedBooksByLanguage[language].includes(book.id));
        const isLangComplete = allBooksDownloaded && crossrefsSuccess;

        if (isLangComplete && !currentState.downloadedLanguages.includes(language)) {
            currentState.downloadedLanguages.push(language);
        } else if (!isLangComplete) {
            currentState.downloadedLanguages = currentState.downloadedLanguages.filter(lang => lang !== language);
        }
        
        // Persist download status to localStorage
        localStorage.setItem('downloadedBooksByLanguage', JSON.stringify(currentState.downloadedBooksByLanguage));
        localStorage.setItem('downloadedLanguages', JSON.stringify(currentState.downloadedLanguages));

        // Invalidate in-memory cross-ref map so it gets rebuilt from cache on next use
        currentState.globalCrossRefsMapByLang[language] = null;
        
        // Final UI Message
        const finalChaptersCount = await cache.countDownloadedChaptersForLanguage(language);
        let finalMessage;
        if (wasCancelled) {
            finalMessage = `Download cancelled. ${finalChaptersCount} chapters saved.`;
            ui.showTempMessage(finalMessage, 'info');
        } else if (overallSuccessTracker.isSuccess && isLangComplete) {
            finalMessage = `Download complete for ${langDisplayName}!`;
            ui.showTempMessage(finalMessage, 'success');
        } else {
            finalMessage = `Download finished with some issues. Check console for details.`;
            ui.showTempMessage(finalMessage, 'warning');
        }
        if (ui.settings.downloadStatusMessage) {
            ui.settings.downloadStatusMessage.textContent = finalMessage;
        }

    } catch (error) {
        console.error("A critical error occurred during the download process:", error);
        ui.showTempMessage("Download failed due to a critical error.", "error");
        overallSuccessTracker.isSuccess = false;
    } finally {
        currentState.isDownloading = false;
        currentState.cancelDownloadFlag = false;
        ui.updateDownloadUI(); // Update UI to final state
    }
}

/** Signals the running download process to stop. */
export function cancel() {
    if (currentState.isDownloading) {
        currentState.cancelDownloadFlag = true;
        if (ui.settings.downloadStatusMessage) ui.settings.downloadStatusMessage.textContent = "Cancelling...";
        if (ui.settings.cancelDownloadButton) ui.settings.cancelDownloadButton.disabled = true;
    }
}

/** Clears all downloaded data for the currently selected language. */
export async function clear() {
    const language = currentState.downloadLanguage;
    const langDisplayName = language === 'am' ? 'Amharic' : 'English';
    if (!confirm(`Are you sure you want to clear all downloaded data for ${langDisplayName}? This cannot be undone.`)) {
        return;
    }
    
    if (ui.settings.downloadStatusMessage) ui.settings.downloadStatusMessage.textContent = `Clearing downloaded data...`;
    if (ui.settings.downloadStatus) ui.settings.downloadStatus.style.display = 'block';

    const { success, clearedCount } = await cache.clearDownloadedDataForLanguage(language);

    // Update state and localStorage
    currentState.downloadedBooksByLanguage[language] = [];
    currentState.downloadedLanguages = currentState.downloadedLanguages.filter(lang => lang !== language);
    currentState.globalCrossRefsMapByLang[language] = null;
    localStorage.setItem('downloadedBooksByLanguage', JSON.stringify(currentState.downloadedBooksByLanguage));
    localStorage.setItem('downloadedLanguages', JSON.stringify(currentState.downloadedLanguages));
    
    const finalMessage = success ? `Cleared ${clearedCount} downloaded items.` : `An error occurred while clearing data.`;
    ui.showTempMessage(finalMessage, success ? 'success' : 'error');

    if (ui.settings.downloadStatusMessage) ui.settings.downloadStatusMessage.textContent = finalMessage;
    ui.updateDownloadUI();
}

/**
 * Initializes the Download module.
 * @param {object} dependencies - Dependencies from other modules.
 * @param {object} dependencies.supabaseClient - The initialized Supabase client.
 */
export function init(dependencies) {
    _supabaseClient = dependencies.supabaseClient;

    ui.settings.startDownloadButton?.addEventListener('click', start);
    ui.settings.cancelDownloadButton?.addEventListener('click', cancel);
    ui.settings.clearDownloadedDataButton?.addEventListener('click', clear);
    ui.settings.downloadLanguageSelect?.addEventListener('change', (e) => {
        currentState.downloadLanguage = e.target.value;
        localStorage.setItem(DOWNLOAD_LANGUAGE_STORAGE_KEY, e.target.value);
        ui.updateDownloadUI();
    });

    console.log("Download module initialized.");
}
