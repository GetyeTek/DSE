// --- File: js/api.js ---
// This module handles all interactions with the Supabase backend.
// It initializes the client and exports functions for fetching data.
console.log("[Module Init] api.js loaded.");

// --- Supabase Configuration ---
const SUPABASE_URL = 'https://kctnqabxxhlziwipepyu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdG5xYWJ4eGhseml3aXBlcHl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyMTk3MjIsImV4cCI6MjA2MTc5NTcyMn0.pLJK-G8uij-2m0WYluWa2RjvehVX15mIH-OW0AWJmc0';
const SUPABASE_FETCH_TIMEOUT = 7000; // 7 seconds timeout

let supabaseClient = null;

/**
 * Initializes the Supabase client with a custom fetch timeout.
 * This should be called once when the application starts.
 * @param {function} onError - A callback function to handle initialization errors, e.g., showPersistentErrorBanner.
 * @returns {object|null} The initialized Supabase client instance or null on failure.
 */
export function initializeSupabase(onError) {
    try {
        // Check if the Supabase library is loaded on the window object
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                global: {
                    fetch: async (url, options = {}) => {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), SUPABASE_FETCH_TIMEOUT);

                        try {
                            const response = await fetch(url, { ...options, signal: controller.signal });
                            return response;
                        } catch (error) {
                            if (error.name === 'AbortError') {
                                console.warn(`Supabase request aborted (likely timeout: ${SUPABASE_FETCH_TIMEOUT}ms).`);
                            }
                            throw error; // Re-throw for Supabase client to handle
                        } finally {
                            clearTimeout(timeoutId);
                        }
                    },
                },
            });
            console.log("Supabase client initialized successfully.");
            return supabaseClient;
        } else {
            const errorMsg = "Error: Supabase library not loaded. Database features will not work.";
            console.error(errorMsg);
            if (onError) onError(errorMsg);
            return null;
        }
    } catch (e) {
        const errorMsg = "Error: Could not connect to database. Database features will not work.";
        console.error("Supabase initialization failed.", e);
        if (onError) onError(errorMsg);
        return null;
    }
}

/**
 * A simple getter for the Supabase client instance.
 * @returns {object|null} The Supabase client.
 */
export function getSupabaseClient() {
    return supabaseClient;
}

/**
 * Fetches core application data: books, themes, and aliases in parallel.
 * @returns {Promise<object>} A promise that resolves to an object containing { books, themes, aliases, error }.
 */
export async function fetchCoreData() {
    if (!supabaseClient) return { books: null, themes: null, aliases: null, error: new Error("Supabase client not initialized.") };

    try {
        const [booksResult, themesResult, aliasesResult] = await Promise.all([
            supabaseClient.from('books').select('id, name, chapters, amharicName, testament, order, name_en'),
            supabaseClient.from('themes').select('name, bookIds'),
            supabaseClient.from('book_aliases').select('alias, book_id')
        ]);

        // Check for errors in each result
        if (booksResult.error) throw booksResult.error;
        if (themesResult.error) throw themesResult.error;
        if (aliasesResult.error) throw aliasesResult.error;

        return {
            books: booksResult.data,
            themes: themesResult.data,
            aliases: aliasesResult.data,
            error: null
        };
    } catch (error) {
        console.error("API Error fetching core data:", error);
        return { books: null, themes: null, aliases: null, error };
    }
}

/**
 * Fetches the reference for the Verse of the Day.
 * @returns {Promise<object>} A promise resolving to { data, error }.
 */
export async function fetchVerseOfTheDayReference() {
    if (!supabaseClient) return { data: null, error: new Error("Supabase client not initialized.") };
    return supabaseClient
        .from('daily_verses')
        .select('book_id, chapter_num, verse_num')
        .order('verse_date', { ascending: false })
        .limit(1)
        .single();
}

/**
 * Fetches the text for a specific verse or range of verses.
 * @param {object} params - The parameters for the query.
 * @param {string} params.bookId - The canonical book ID.
 * @param {number} params.chapter - The chapter number.
 * @param {number} params.startVerse - The starting verse number.
 * @param {number} [params.endVerse=params.startVerse] - The ending verse number. Defaults to startVerse for a single verse fetch.
 * @param {string} params.language - The language code ('am' or 'en').
 * @returns {Promise<object>} A promise resolving to { data, error }. Data is an array of verse objects.
 */
export async function fetchVerseText({ bookId, chapter, startVerse, endVerse, language }) {
    if (!supabaseClient) return { data: null, error: new Error("Supabase client not initialized.") };
    const effectiveEndVerse = endVerse || startVerse;
    return supabaseClient
        .from(`verses_${language}`)
        .select("verse_num, verse_text")
        .eq("book_id", bookId)
        .eq("chapter_num", chapter)
        .gte("verse_num", startVerse)
        .lte("verse_num", effectiveEndVerse)
        .order("verse_num", { ascending: true });
}

/**
 * Fetches the full content (verses, commentary, header) for a specific chapter.
 * @param {object} params - The parameters for the query.
 * @param {string} params.bookId - The canonical book ID.
 * @param {number} params.chapter - The chapter number.
 * @param {string} params.language - The language code ('am' or 'en').
 * @returns {Promise<object>} A promise resolving to { data, error }. Data is an array of verse objects.
 */
export async function fetchChapterContent({ bookId, chapter, language }) {
    if (!supabaseClient) return { data: null, error: new Error("Supabase client not initialized.") };
    return supabaseClient
        .from(`verses_${language}`)
        .select(`book_id, chapter_num, verse_num, verse_display_num, verse_text, commentary_text, chapters_${language}(header_text)`)
        .eq("book_id", bookId)
        .eq("chapter_num", chapter)
        .order("verse_num", { ascending: true });
}

/**
 * Fetches all verses for an entire book, handling pagination. Used for downloads.
 * @param {object} params - The parameters for the query.
 * @param {string} params.bookId - The canonical book ID.
 * @param {string} params.language - The language code ('am' or 'en').
 * @param {function} onCancel - A function that returns true if the download should be cancelled.
 * @returns {Promise<object>} A promise resolving to { data, error }. Data is an array of all verse objects for the book.
 */
export async function fetchAllVersesForBook({ bookId, language, onCancel }) {
    if (!supabaseClient) return { data: null, error: new Error("Supabase client not initialized.") };

    let allVersesForBook = [];
    const pageSize = 1000;
    let offset = 0;
    let finished = false;

    while (!finished) {
        if (onCancel && onCancel()) {
            return { data: null, error: new Error("Cancelled during book fetch pagination") };
        }
        try {
            const { data, error } = await supabaseClient
                .from(`verses_${language}`)
                .select("book_id, chapter_num, verse_num, verse_display_num, verse_text, commentary_text")
                .eq("book_id", bookId)
                .order("chapter_num", { ascending: true })
                .order("verse_num", { ascending: true })
                .range(offset, offset + pageSize - 1);

            if (error && error.code !== 'PGRST116') throw error;
            if (!data || data.length === 0) {
                finished = true;
            } else {
                allVersesForBook.push(...data);
                if (data.length < pageSize) {
                    finished = true;
                } else {
                    offset += pageSize;
                }
            }
        } catch (error) {
            console.error(`API Error fetching verses for book ${bookId} (offset: ${offset}):`, error);
            return { data: null, error };
        }
    }
    return { data: allVersesForBook, error: null };
}

/**
 * Fetches the URL for an audio track.
 * @param {object} params - The parameters for the query.
 * @param {string} params.bookId - The canonical book ID.
 * @param {number} params.chapter - The chapter number.
 * @param {string} params.language - The language code ('am' or 'en').
 * @returns {Promise<object>} A promise resolving to { data, error }. Data is an object with `audio_url`.
 */
export async function fetchAudioUrl({ bookId, chapter, language }) {
    if (!supabaseClient) return { data: null, error: new Error("Supabase client not initialized.") };
    return supabaseClient
        .from('audio_tracks')
        .select('audio_url')
        .eq('book_id', bookId)
        .eq('chapter_num', chapter)
        .eq('language', language)
        .single();
}

/**
 * Fetches the list of cross-reference document IDs for a given chapter.
 * @param {object} params - The parameters for the query.
 * @param {string} params.bookId - The canonical book ID.
 * @param {number} params.chapter - The chapter number.
 * @returns {Promise<object>} A promise resolving to { data, error }. Data is an array of objects with `doc_id`.
 */
export async function fetchChapterCrossRefIds({ bookId, chapter }) {
    if (!supabaseClient) return { data: null, error: new Error("Supabase client not initialized.") };
    const pattern = `${bookId}-${chapter}-%`;
    return supabaseClient
        .from('cross_references')
        .select('doc_id')
        .like('doc_id', pattern);
}

/**
 * Fetches the details for a specific cross-reference document ID.
 * @param {string} docId - The document ID (e.g., 'genesis-1-1').
 * @returns {Promise<object>} A promise resolving to { data, error }. Data contains `related_refs`.
 */
export async function fetchCrossRefDetails(docId) {
    if (!supabaseClient) return { data: null, error: new Error("Supabase client not initialized.") };
    return supabaseClient
        .from('cross_references')
        .select('related_refs')
        .eq('doc_id', docId)
        .single();
}

/**
 * Fetches all cross-references from the database, handling pagination. Used for downloads.
 * @param {object} params - The parameters for the operation.
 * @param {function} params.onCancel - A function that returns true if the download should be cancelled.
 * @param {function} params.onProgress - A callback to report progress, e.g., onProgress({ page, totalFetched }).
 * @returns {Promise<object>} A promise resolving to { data, error }. Data is the complete array of cross-ref objects.
 */
export async function fetchAllCrossRefs({ onCancel, onProgress }) {
    if (!supabaseClient) return { data: null, error: new Error("Supabase client not initialized.") };
    
    let allCrossrefs = [];
    const pageSize = 1000;
    let offset = 0;
    let finished = false;
    let page = 1;

    while (!finished) {
        if (onCancel && onCancel()) {
            return { data: null, error: new Error("Cancelled during cross-reference fetch") };
        }
        if (onProgress) onProgress({ page, totalFetched: allCrossrefs.length });
        
        try {
            const { data, error } = await supabaseClient
                .from('cross_references')
                .select('doc_id, related_refs')
                .order('doc_id', { ascending: true })
                .range(offset, offset + pageSize - 1);

            if (error && error.code !== 'PGRST116') throw error;
            if (!data || data.length === 0) {
                finished = true;
            } else {
                allCrossrefs.push(...data);
                if (data.length < pageSize) {
                    finished = true;
                } else {
                    offset += pageSize;
                    page++;
                }
            }
        } catch (error) {
            console.error(`API Error fetching cross-references (offset: ${offset}):`, error);
            return { data: null, error };
        }
    }
    return { data: allCrossrefs, error: null };
}

/**
 * Performs a full-text search by calling the 'search_verses' RPC.
 * @param {object} params - The parameters for the search.
 * @param {string} params.language - The language code ('am' or 'en').
 * @param {string} params.keyword - The search term.
 * @returns {Promise<object>} A promise resolving to { data, error }.
 */
export async function searchVerses({ language, keyword }) {
    if (!supabaseClient) return { data: null, error: new Error("Supabase client not initialized.") };
    return supabaseClient.rpc("search_verses", {
        language_code: language,
        keyword_term: keyword,
        limit_count: 50,
        offset_count: 0,
    });
}

/**
 * Fetches details for a single book, used as a fallback for chapter count.
 * @param {string} bookId - The canonical book ID.
 * @returns {Promise<object>} A promise resolving to { data, error }.
 */
export async function fetchBookDetails(bookId) {
    if (!supabaseClient) return { data: null, error: new Error("Supabase client not initialized.") };
    return supabaseClient
        .from('books')
        .select('id, chapters') // Only fetch what's needed
        .eq('id', bookId)
        .single();
}

/**
 * Fetches application settings, like theme background URLs.
 * @param {string} settingName - The name of the setting to fetch.
 * @returns {Promise<object>} A promise resolving to { data, error }.
 */
export async function fetchAppSetting(settingName) {
    if (!supabaseClient) return { data: null, error: new Error("Supabase client not initialized.") };
    return supabaseClient
        .from('app_settings')
        .select('name, value')
        .eq('name', settingName)
        .single();
}