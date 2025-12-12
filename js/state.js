// --- File: js/state.js ---
// This module defines and exports the global application state, serving as the single source of truth.
console.log("[Module Init] state.js loaded.");
export const REFLECTION_STORAGE_KEY = 'dse_userReflections';
export const DOWNLOAD_LANGUAGE_STORAGE_KEY = 'dse_downloadLanguage';

export const currentState = {
    book: null, // Keep track of current book in reading view
    chapter: 1, // Keep track of current chapter in reading view
    targetVerseRef: null, // Keep track of target verse for current navigation (for initial load/scroll)
    fontSize: parseFloat(localStorage.getItem('fontSize') || '1.1'),
    fontFamily: localStorage.getItem('fontFamily') || "'EB Garamond', serif",
    isDarkMode: false,
    darkModeSetting: localStorage.getItem('darkModeSetting') || 'system',
    browseViewMode: localStorage.getItem('browseViewMode') || 'theme', // 'theme' or 'list'
    currentView: 'themeView', // Default view
    uiHideTimeoutId: null,
    autoHideDelay: parseInt(localStorage.getItem('autoHideDelay') || '3000'),
    wakeLockSentinel: null,
    searchHistory: JSON.parse(localStorage.getItem('searchHistory') || '[]'),
    MAX_HISTORY: 10,
    activeCrossRefExpansion: null,
    activeCommentaryExpansion: null, // <--- ADDED LINE: Track active inline commentary panel
    readingContentMode: 'scripture', // <--- ADDED LINE: 'scripture' or 'commentary'
    versesDataForChapter: null, // <--- ADDED LINE: Cache fetched verses data for the current chapter
    // --- Audio State ---
    audioState: {
        isPlaying: false,
        isLoading: false, // Indicates if audio is currently loading the file
        duration: 0,
        currentTime: 0,
        // What audio is currently loaded in the <audio> element's src
        loadedUrl: null,
        loadedBookId: null,
        loadedChapter: null,
        // What audio is ready/available for the *currently displayed* reading chapter
        currentViewAudioUrl: null,
        currentViewAudioReady: false, // True if URL was successfully fetched for current view
        currentViewBookId: null, // Keep track of which view chapter these refer to
        currentViewChapter: null,
        // Add volume/mute if using those controls in the modal (your example didn't)
        volume: 1, // Default volume
        muted: false,
    },
    // --- End Audio State ---
    lastScrollTop: 0, // Keep this for general scroll position
    contextMenuTargetElement: null,
    sourceReferenceForBackNav: null,
    bookList: { OT: [], NT: [], AP: [], OTHER: [] },
    booksInfo: {},
    bookAliasMap: {},
    isSearching: false,
    scrollSaveTimeoutId: null,
    SCROLL_SAVE_THROTTLE: 500,
    // User Data State (Loaded from LocalStorage)
    userNotes: [], // Array of note objects
    userFavourites: [], // Array of favourite objects
    reflections: [], // Array of reflection objects <--- ADDED LINE

    // Recent Books State
    recentBooks: [], // Array of { bookId, chapter, verseId, timestamp }
    MAX_RECENT_BOOKS: 6, // Keep track of the last 6
    verseOfTheDay: null, // Holds the fetched Verse of the Day data { book_id, chapter_num, verse_num, verse_text, verse_text_en, ... } <--- ADDED LINE
    language: localStorage.getItem("language") || "am", // Main UI/Reading language
    downloadLanguage: localStorage.getItem(DOWNLOAD_LANGUAGE_STORAGE_KEY) || "am", // <--- ADDED LINE: Download/Clear language
    themeViewBackgrounds: { light: null, dark: null },
    globalCrossRefsMapByLang: { am: null, en: null }, // To cache the fully processed cross-ref doc_id map
    // --- Verse Selection / Action Bar State --- <--- MODIFIED COMMENT
    isSelectionMode: false, // <--- ADDED LINE: Track if verse selection mode is active (enabled by double tap)
    tapTimeoutId: null, // <--- ADDED LINE: For single/double tap detection
    lastTapTime: 0, // <--- ADDED LINE: For single/double tap detection
    DOUBLE_TAP_THRESHOLD: 300, // <--- ADDED LINE: Max time between taps for double tap (ms)

    // --- Download State --- <--- ADDED COMMENTS
    downloadedLanguages: JSON.parse(localStorage.getItem('downloadedLanguages') || '[]'), // Array of language codes fully downloaded
    downloadedBooksByLanguage: JSON.parse(localStorage.getItem('downloadedBooksByLanguage') || '{}'), // { 'lang': ['bookId1', 'bookId2'], ...}
    isDownloading: false,
    downloadProgress: {
        language: null,
        currentBookId: null,
        currentBookName: null, // Store display name for UI
        currentChapter: 0,
        totalChaptersInBook: 0,
        totalChaptersOverall: 0,
        downloadedChaptersOverall: 0,
    },
    cancelDownloadFlag: false, // Flag to signal cancellation
    // --- End Download State ---
};

