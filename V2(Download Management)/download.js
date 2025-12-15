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
async function _downloadAndProcessBook(bookInfo, language, overallSuccessTracker, flags) {
    const { id: bookId, chapters: totalChaptersInBook, englishName, amharicName } = bookInfo;
    const bookDisplayName = language === 'en' ? englishName || bookId : amharicName || bookId;

    // Update progress UI
    currentState.downloadProgress.currentBookId = bookId;
    currentState.downloadProgress.currentBookName = bookDisplayName;
    currentState.downloadProgress.totalChaptersInBook = totalChaptersInBook;
    currentState.downloadProgress.currentChapter = 0;
    ui.throttledUpdateDownloadUI();

    if (currentState.cancelDownloadFlag) return { status: 'cancelled' };

    // 1. Fetch data from API based on flags
    const { data: fetchedData, error: fetchError } = await api.fetchAllVersesForBook({
        bookId: bookId,
        language: language,
        onCancel: () => currentState.cancelDownloadFlag,
        includeVerses: flags.includeVerses,
        includeCommentary: flags.includeCommentary
    });

    if (currentState.cancelDownloadFlag) return { status: 'cancelled' };
    if (fetchError) {
        console.error(`Download Error: Failed to fetch data for book ${bookId}.`, fetchError);
        overallSuccessTracker.isSuccess = false;
        return { status: 'fetch_error' };
    }

    // 2. Save using the merge-capable cache function
    const saveResult = await cache.saveBookChaptersInBatch(bookId, language, fetchedData);

    if (currentState.cancelDownloadFlag) return { status: 'cancelled' };
    if (saveResult.error) {
        console.error(`Download Error: Failed to save book ${bookId} to cache.`, saveResult.error);
        overallSuccessTracker.isSuccess = false;
        return { status: 'save_error' };
    }

    // 3. Update progress
    currentState.downloadProgress.downloadedChaptersOverall += saveResult.savedCount;
    currentState.downloadProgress.currentChapter = totalChaptersInBook;
    
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
export async function start(resourcesToDownload) {
    // resourcesToDownload is array like ['am-bible', 'en-ref', 'am-commentary']
    if (currentState.isDownloading) return;
    if (!_supabaseClient) {
        ui.showTempMessage("Cannot download: Database not connected.", 'error');
        return;
    }
    
    if (!resourcesToDownload || resourcesToDownload.length === 0) {
        ui.showTempMessage("No resources selected.", 'info');
        return;
    }

    currentState.isDownloading = true;
    currentState.cancelDownloadFlag = false;
    const overallSuccessTracker = { isSuccess: true };

    // Parse request to determine what to do
    const tasks = {
        am: { bible: false, commentary: false, ref: false },
        en: { bible: false, commentary: false, ref: false }
    };

    resourcesToDownload.forEach(id => {
        const [lang, type] = id.split('-');
        if (tasks[lang]) tasks[lang][type] = true;
    });

    const languagesToProcess = ['am', 'en'].filter(lang => tasks[lang].bible || tasks[lang].commentary || tasks[lang].ref);

    try {
        for (const lang of languagesToProcess) {
            if (currentState.cancelDownloadFlag) break;

            const flags = tasks[lang];
            
            // --- 1. Cross References ---
            if (flags.ref) {
                currentState.downloadProgress = {
                    language: lang, currentBookName: "Cross-References",
                    currentChapter: 0, totalChaptersInBook: 0, totalChaptersOverall: 0, downloadedChaptersOverall: 0
                };
                ui.updateDownloadUI();
                
                const success = await _downloadAndProcessCrossRefs(lang, overallSuccessTracker);
                if (success) {
                    currentState.downloadedResources[`${lang}-ref`] = true;
                    localStorage.setItem('downloadedResources', JSON.stringify(currentState.downloadedResources));
                }
            }

            // --- 2. Books (Bible & Commentary) ---
            // Optimization: Determine what actually needs fetching
            let fetchVerses = flags.bible;
            let fetchComm = flags.commentary;
            
            if (fetchVerses && currentState.downloadedResources[`${lang}-bible`]) {
                console.log(`[Download] Skipping Verses for ${lang} (Already downloaded)`);
                fetchVerses = false;
            }
            if (fetchComm && currentState.downloadedResources[`${lang}-commentary`]) {
                console.log(`[Download] Skipping Commentary for ${lang} (Already downloaded)`);
                fetchComm = false;
            }

            if (fetchVerses || fetchComm) {
                 const booksToDownload = Object.values(currentState.booksInfo)
                    .filter(book => book?.chapters > 0)
                    .sort((a, b) => a.order - b.order);
                
                currentState.downloadProgress = {
                    language: lang, currentBookName: "Preparing Books...",
                    currentChapter: 0, totalChaptersInBook: 0,
                    totalChaptersOverall: booksToDownload.reduce((sum, book) => sum + book.chapters, 0),
                    downloadedChaptersOverall: 0
                };
                ui.updateDownloadUI();

                const CONCURRENCY_LIMIT = 3;
                for (let i = 0; i < booksToDownload.length; i += CONCURRENCY_LIMIT) {
                    if (currentState.cancelDownloadFlag) break;
                    const batch = booksToDownload.slice(i, i + CONCURRENCY_LIMIT);
                    await Promise.all(batch.map(book => 
                        _downloadAndProcessBook(book, lang, overallSuccessTracker, {
                            includeVerses: fetchVerses,
                            includeCommentary: fetchComm
                        })
                    ));
                }

                // Update status only if we actually tried to download something new and succeeded
                if (!currentState.cancelDownloadFlag && overallSuccessTracker.isSuccess) {
                    if (fetchVerses) currentState.downloadedResources[`${lang}-bible`] = true;
                    if (fetchComm) currentState.downloadedResources[`${lang}-commentary`] = true;
                    // Also mark as true if they were passed in as flags (even if skipped), to ensure consistency
                    if (flags.bible) currentState.downloadedResources[`${lang}-bible`] = true;
                    if (flags.commentary) currentState.downloadedResources[`${lang}-commentary`] = true;
                    
                    localStorage.setItem('downloadedResources', JSON.stringify(currentState.downloadedResources));
                }
            } else if ((flags.bible || flags.commentary) && !flags.ref) {
                 ui.showTempMessage(`Selected book resources for ${lang.toUpperCase()} are already downloaded.`, 'info');
            }
        }

        ui.showTempMessage("Download process finished.", overallSuccessTracker.isSuccess ? 'success' : 'warning');

    } catch (error) {
        console.error("Critical download error:", error);
        ui.showTempMessage("Download failed.", "error");
    } finally {
        currentState.isDownloading = false;
        currentState.cancelDownloadFlag = false;
        ui.updateDownloadUI();
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

    // ui.settings.startDownloadButton?.addEventListener('click', start); // Removed: Handled by downloadModal.js
    ui.settings.cancelDownloadButton?.addEventListener('click', cancel);
    ui.settings.clearDownloadedDataButton?.addEventListener('click', clear);
    ui.settings.downloadLanguageSelect?.addEventListener('change', (e) => {
        currentState.downloadLanguage = e.target.value;
        localStorage.setItem(DOWNLOAD_LANGUAGE_STORAGE_KEY, e.target.value);
        ui.updateDownloadUI();
    });

    console.log("Download module initialized.");
}
