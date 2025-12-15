// --- File: js/api.js ---
// This module handles all interactions with the Supabase backend.
// It initializes the client and exports functions for fetching data.
console.log("[Module Init] api.js loaded.");

// --- Supabase Configuration ---
const SUPABASE_URL = 'https://vlzgfaqrnyiqfxxxvtas.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsemdmYXFybnlpcWZ4eHh2dGFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NTk5NDAsImV4cCI6MjA4MTEzNTk0MH0.y93d68JWyGL7NKXZEHLunAuayMEWw1K6yATFGLxkUxY';
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

// Helper to invoke the Brain
async function _invokeBrain(action, params = {}) {
    if (!supabaseClient) return { data: null, error: new Error("Supabase client not initialized.") };
    try {
        const { data, error } = await supabaseClient.functions.invoke('orchestrator', {
            body: { action, ...params }
        });
        if (error) throw error;
        return data; 
    } catch (e) {
        console.error(`[API] Orchestrator Error (${action}):`, e);
        return { data: null, error: e };
    }
}

/**
 * Fetches core application data via Orchestrator.
 */
export async function fetchCoreData() {
    const { data, error } = await _invokeBrain('fetch_core_data');
    if (error) return { books: null, themes: null, aliases: null, error };
    return { books: data.books, themes: data.themes, aliases: data.aliases, error: null };
}

/**
 * Fetches the reference for the Verse of the Day.
 * @returns {Promise<object>} A promise resolving to { data, error }.
 */
export async function fetchVerseOfTheDayReference() {
    // The orchestrator handles fetching the ref logic
    const { data, error } = await _invokeBrain('fetch_votd', { language: 'am' });
    return { data, error };
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
    return _invokeBrain('fetch_chapter_content', { bookId, chapter, language });
}

/**
 * Fetches all verses for an entire book, handling pagination. Used for downloads.
 * @param {object} params - The parameters for the query.
 * @param {string} params.bookId - The canonical book ID.
 * @param {string} params.language - The language code ('am' or 'en').
 * @param {function} onCancel - A function that returns true if the download should be cancelled.
 * @returns {Promise<object>} A promise resolving to { data, error }. Data is an array of all verse objects for the book.
 */
export async function fetchAllVersesForBook({ bookId, language, onCancel, includeVerses = true, includeCommentary = true }) {
    // Loops via Orchestrator Pages to download books
    let allVerses = [];
    let allComm = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
        if (onCancel && onCancel()) return { data: null, error: new Error("Cancelled") };
        
        const { data, error } = await _invokeBrain('fetch_book_full', {
            bookId, language, page, includeVerses, includeCommentary
        });

        if (error) return { data: null, error };
        
        if (data.verses) allVerses.push(...data.verses);
        if (data.commentaries) allComm.push(...data.commentaries);
        hasMore = data.hasMore;
        page++;
    }

    return { 
        data: { verses: allVerses, commentaries: allComm }, 
        error: null 
    };
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
    return _invokeBrain('get_audio_url', { bookId, chapter, language });
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
    let allCrossrefs = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
        if (onCancel && onCancel()) return { data: null, error: new Error("Cancelled") };
        if (onProgress) onProgress({ page: page + 1, totalFetched: allCrossrefs.length });

        const { data, error } = await _invokeBrain('fetch_cross_refs', { page });
        
        if (error) return { data: null, error };

        if (data.crossrefs) allCrossrefs.push(...data.crossrefs);
        hasMore = data.hasMore;
        page++;
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
    return _invokeBrain('search', { language, keyword });
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