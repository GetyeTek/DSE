// --- File: js/cache.js ---
// This module handles all interactions with the IndexedDB cache.
// It provides a clean interface for getting, setting, and clearing cached data.
console.log("[Module Init] cache.js loaded.");

const CACHE_DB_NAME = 'dse-cache';
const CACHE_DB_VERSION = 2;
const CHAPTER_STORE_NAME = 'chapter_text';

let db = null; // Module-scoped database connection

/**
 * Opens and initializes the IndexedDB database connection.
 * Subsequent calls will return the existing connection.
 * @returns {Promise<IDBDatabase>} A promise that resolves with the database connection.
 */
function openCacheDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);

        request.onupgradeneeded = (event) => {
            const dbInstance = event.target.result;
            if (!dbInstance.objectStoreNames.contains(CHAPTER_STORE_NAME)) {
                dbInstance.createObjectStore(CHAPTER_STORE_NAME);
                console.log(`[Cache] Object store "${CHAPTER_STORE_NAME}" created.`);
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            db.onerror = (event) => {
                console.error(`[Cache] Generic DB Error:`, event.target.errorCode, event);
            };
            resolve(db);
        };

        request.onerror = (event) => {
            console.error(`[Cache] DB open error:`, event.target.errorCode, event);
            db = null;
            reject(new Error(`IndexDB error on open: ${event.target.errorCode}`));
        };
    });
}

/**
 * Retrieves a chapter's data from IndexedDB.
 * @param {string} bookId - The canonical book ID.
 * @param {number} chapterNum - The chapter number.
 * @param {string} language - The language code ('am' or 'en').
 * @returns {Promise<object|null>} The stored object { data, isDownloaded } or null if not found.
 */
export async function getChapter(bookId, chapterNum, language) {
    const key = `${bookId}-${chapterNum}-${language}`;
    try {
        const db = await openCacheDB();
        const transaction = db.transaction([CHAPTER_STORE_NAME], 'readonly');
        const store = transaction.objectStore(CHAPTER_STORE_NAME);
        const request = store.get(key);

        return new Promise((resolve) => {
            request.onsuccess = (event) => {
                const result = event.target.result;
                resolve(result && typeof result === 'object' ? result : null);
            };
            request.onerror = (event) => {
                console.error(`[Cache] Get error for key ${key}:`, event.target.errorCode, event);
                resolve(null);
            };
        });
    } catch (error) {
        console.error(`[Cache] Error accessing DB for get operation on key ${key}:`, error);
        return null;
    }
}

/**
 * Saves a chapter's verse data to IndexedDB.
 * @param {string} bookId - The canonical book ID.
 * @param {number} chapterNum - The chapter number.
 * @param {string} language - The language code.
 * @param {Array} versesData - The array of verse objects to store.
 * @param {boolean} [isDownloaded=false] - Flag indicating if this is part of a full download.
 * @returns {Promise<boolean>} A promise that resolves to true on success, false on failure.
 */
export async function saveChapter(bookId, chapterNum, language, versesData, isDownloaded = false) {
    const key = `${bookId}-${chapterNum}-${language}`;
    if (!versesData || !Array.isArray(versesData) || versesData.length === 0) {
        console.warn(`[Cache] Not saving empty or invalid data for key ${key}.`);
        return false;
    }
    const dataToStore = { data: versesData, isDownloaded: !!isDownloaded };

    try {
        const db = await openCacheDB();
        const transaction = db.transaction([CHAPTER_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(CHAPTER_STORE_NAME);
        const request = store.put(dataToStore, key);

        return new Promise((resolve) => {
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = (event) => {
                console.error(`[Cache] Transaction error for put on key ${key}:`, event.target.error);
                resolve(false);
            };
        });
    } catch (error) {
        console.error(`[Cache] Error accessing DB for save operation on key ${key}:`, error);
        return false;
    }
}

/**
 * Saves core app data (like books, themes, aliases) to IndexedDB.
 * @param {string} dataType - The type of data (e.g., 'books', 'themes', 'crossrefs_am').
 * @param {Array} data - The data array to store.
 * @returns {Promise<boolean>} True on success, false on failure.
 */
export async function saveCoreData(dataType, data) {
    const key = `core-${dataType}`;
    if (!data || !Array.isArray(data)) {
        console.warn(`[Cache] Not saving empty or invalid core data for key ${key}.`);
        return false;
    }

    try {
        const db = await openCacheDB();
        const transaction = db.transaction([CHAPTER_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(CHAPTER_STORE_NAME);
        store.put(data, key);

        return new Promise((resolve) => {
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = (event) => {
                console.error(`[Cache] Transaction error for put on core key ${key}:`, event.target.error);
                resolve(false);
            };
        });
    } catch (error) {
        console.error(`[Cache] Error accessing DB for save operation on core key ${key}:`, error);
        return false;
    }
}

/**
 * Retrieves core app data from IndexedDB.
 * @param {string} dataType - The type of data to get (e.g., 'books').
 * @returns {Promise<Array|null>} The stored data array or null.
 */
export async function getCoreData(dataType) {
    const key = `core-${dataType}`;
    try {
        const db = await openCacheDB();
        const transaction = db.transaction([CHAPTER_STORE_NAME], 'readonly');
        const store = transaction.objectStore(CHAPTER_STORE_NAME);
        const request = store.get(key);

        return new Promise((resolve) => {
            request.onsuccess = (event) => resolve(event.target.result || null);
            request.onerror = (event) => {
                console.error(`[Cache] Get error for core key ${key}:`, event.target.errorCode, event);
                resolve(null);
            };
        });
    } catch (error) {
        console.error(`[Cache] Error accessing DB for get operation on core key ${key}:`, error);
        return null;
    }
}

/**
 * Clears all content marked as 'downloaded' for a specific language.
 * @param {string} languageToClear - The language code ('am' or 'en').
 * @returns {Promise<{success: boolean, clearedCount: number}>} An object indicating success and count of deleted items.
 */
export async function clearDownloadedDataForLanguage(languageToClear) {
    console.log(`[Cache] Clearing downloaded data for language: ${languageToClear}`);
    let clearedCount = 0;
    try {
        const db = await openCacheDB();
        const transaction = db.transaction([CHAPTER_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(CHAPTER_STORE_NAME);
        
        // Also delete the core cross-ref file for this language
        const crossrefsKey = `core-crossrefs_${languageToClear}`;
        store.delete(crossrefsKey);

        const request = store.openCursor();

        await new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const key = cursor.key;
                    const storedObject = cursor.value;
                    if (typeof key === 'string' && key.endsWith(`-${languageToClear}`) && storedObject?.isDownloaded === true) {
                        cursor.delete();
                        clearedCount++;
                    }
                    cursor.continue();
                } else {
                    resolve(); // Cursor finished
                }
            };
            transaction.oncomplete = resolve;
            transaction.onerror = reject;
            request.onerror = reject;
        });
        
        console.log(`[Cache] Finished clearing downloaded data for ${languageToClear}. Items deleted: ${clearedCount}.`);
        return { success: true, clearedCount };

    } catch (error) {
        console.error(`[Cache] Error during clearDownloadedData for ${languageToClear}:`, error);
        return { success: false, clearedCount };
    }
}

/**
 * Clears all temporarily cached chapter text (items not marked as 'downloaded').
 * @returns {Promise<{success: boolean, clearedCount: number}>} An object indicating success and count of deleted items.
 */
export async function clearTemporaryChapterCache() {
    console.log("[Cache] Clearing temporary chapter text cache...");
    let clearedCount = 0;
    try {
        const db = await openCacheDB();
        const transaction = db.transaction([CHAPTER_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(CHAPTER_STORE_NAME);
        const request = store.openCursor();

        await new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const key = cursor.key;
                    const storedObject = cursor.value;
                    // Condition to delete: a chapter entry where isDownloaded is false or undefined
                    const isChapterKey = typeof key === 'string' && !key.startsWith('core-') && !key.startsWith('audio-');
                    if (isChapterKey && typeof storedObject === 'object' && !storedObject.isDownloaded) {
                        cursor.delete();
                        clearedCount++;
                    }
                    cursor.continue();
                } else {
                    resolve(); // Cursor finished
                }
            };
            transaction.oncomplete = resolve;
            transaction.onerror = reject;
            request.onerror = reject;
        });

        console.log(`[Cache] Finished clearing temporary cache. Items deleted: ${clearedCount}.`);
        return { success: true, clearedCount };
    } catch (error) {
        console.error(`[Cache] Error during clearTemporaryChapterCache:`, error);
        return { success: false, clearedCount };
    }
}

/**
 * Saves a book's worth of chapters in a single IndexedDB transaction for efficiency.
 * @param {string} bookId The book's canonical ID.
 * @param {string} language The language code.
 * @param {Array} allVersesForBook An array containing all verse objects for the entire book.
 * @returns {Promise<{savedCount: number, error: Error|null}>} The number of chapters successfully saved and any error that occurred.
 */
export async function saveBookChaptersInBatch(bookId, language, { verses, commentaries }) {
    // We allow saving if EITHER verses or commentaries are present
    if ((!verses || verses.length === 0) && (!commentaries || commentaries.length === 0)) {
        return { savedCount: 0, error: new Error("No data provided to save.") };
    }

    try {
        const db = await openCacheDB();
        const transaction = db.transaction([CHAPTER_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(CHAPTER_STORE_NAME);

        // Identify all unique chapters involved in this update
        const chapters = new Set();
        if (verses) verses.forEach(v => chapters.add(v.chapter_num));
        if (commentaries) commentaries.forEach(c => chapters.add(c.chapter_num));

        let putsAttempted = 0;

        for (const chapterNum of chapters) {
            const key = `${bookId}-${chapterNum}-${language}`;
            
            // 1. Get existing data first (Read-Modify-Write) to preserve what's already there
            const existingEntry = await new Promise((resolve, reject) => {
                const req = store.get(key);
                req.onsuccess = (e) => resolve(e.target.result || { data: [], isDownloaded: true });
                req.onerror = () => resolve({ data: [], isDownloaded: true }); // Fallback on error
            });

            // Use a Map to merge by verse_num
            let chapterDataMap = new Map();
            
            // Load existing data into map
            if (Array.isArray(existingEntry.data)) {
                existingEntry.data.forEach(v => chapterDataMap.set(v.verse_num, v));
            }

            // 2. Merge NEW Verses (if downloaded)
            if (verses && verses.length > 0) {
                verses.filter(v => v.chapter_num === chapterNum).forEach(v => {
                    const existing = chapterDataMap.get(v.verse_num) || {};
                    // Overwrite verse text, keep commentary if it exists
                    chapterDataMap.set(v.verse_num, { ...existing, ...v, chapter_num: chapterNum, verse_num: v.verse_num });
                });
            }

            // 3. Merge NEW Commentary (if downloaded)
            if (commentaries && commentaries.length > 0) {
                commentaries.filter(c => c.chapter_num === chapterNum).forEach(c => {
                    const existing = chapterDataMap.get(c.verse_num) || {};
                    // Overwrite commentary, keep verse text if it exists
                    chapterDataMap.set(c.verse_num, { 
                        ...existing, 
                        commentary_text: c.commentary_text,
                        chapter_num: chapterNum, 
                        verse_num: c.verse_num 
                    });
                });
            }

            // 4. Convert map back to array and save
            const mergedData = Array.from(chapterDataMap.values()).sort((a,b) => a.verse_num - b.verse_num);
            
            store.put({ data: mergedData, isDownloaded: true }, key);
            putsAttempted++;
        }

        await new Promise((resolve, reject) => {
            transaction.oncomplete = resolve;
            transaction.onerror = (event) => reject(event.target.error);
        });

        return { savedCount: putsAttempted, error: null };
    } catch (error) {
        console.error(`[Cache] Transaction error saving book ${bookId} in batch:`, error);
        return { savedCount: 0, error };
    }
}


// --- Audio URL Caching ---

export async function getAudioUrl(bookId, chapterNum, language) {
    const key = `audio-${bookId}-${chapterNum}-${language}`;
    try {
        const db = await openCacheDB();
        const transaction = db.transaction([CHAPTER_STORE_NAME], 'readonly');
        const store = transaction.objectStore(CHAPTER_STORE_NAME);
        const request = store.get(key);

        return new Promise((resolve) => {
            request.onsuccess = (event) => {
                const result = event.target.result;
                resolve(typeof result === 'string' && result.trim() ? result : null);
            };
            request.onerror = (event) => {
                console.error(`[Cache] Get error for audio URL key ${key}:`, event.target.errorCode, event);
                resolve(null);
            };
        });
    } catch (error) {
        console.error(`[Cache] Error accessing DB for audio URL get operation on key ${key}:`, error);
        return null;
    }
}

export async function saveAudioUrl(bookId, chapterNum, language, audioUrl) {
    const key = `audio-${bookId}-${chapterNum}-${language}`;
    if (!audioUrl || typeof audioUrl !== 'string' || audioUrl.trim() === '') {
        console.warn(`[Cache] Not saving empty or invalid audio URL for key ${key}.`);
        return false;
    }
    
    try {
        const db = await openCacheDB();
        const transaction = db.transaction([CHAPTER_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(CHAPTER_STORE_NAME);
        store.put(audioUrl, key);

        return new Promise((resolve) => {
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = (event) => {
                console.error(`[Cache] Transaction error saving audio URL key ${key}:`, event.target.error);
                resolve(false);
            };
        });
    } catch (error) {
        console.error(`[Cache] Error accessing DB for audio URL save operation on key ${key}:`, error);
        return false;
    }
}

/**
 * Counts all items in the cache that are marked as downloaded for a specific language.
 * @param {string} language - The language code ('am' or 'en').
 * @returns {Promise<number>} A promise that resolves with the total count.
 */
export async function countDownloadedChaptersForLanguage(language) {
    let finalCount = 0;
    try {
        const db = await openCacheDB();
        const transaction = db.transaction([CHAPTER_STORE_NAME], 'readonly');
        const store = transaction.objectStore(CHAPTER_STORE_NAME);
        const request = store.openCursor();

        await new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const key = cursor.key;
                    const value = cursor.value;
                    const keyParts = typeof key === 'string' ? key.split('-') : [];
                    if (keyParts.length >= 3 && keyParts[keyParts.length - 1] === language && value?.isDownloaded === true && !key.startsWith('core-')) {
                        finalCount++;
                    }
                    cursor.continue();
                } else {
                    resolve(); // Cursor finished
                }
            };
            request.onerror = reject;
        });

        return finalCount;
    } catch (error) {
        console.error(`[Cache] Error recounting downloaded chapters for ${language}:`, error);
        return 0; // Return 0 on any error
    }
}
