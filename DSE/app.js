import {
    debounce,
    normalizeBookName,
    parseSearchQuery,
    getTestamentKey, 
} from './utils.js';
import {
    currentState,
    REFLECTION_STORAGE_KEY,
    DOWNLOAD_LANGUAGE_STORAGE_KEY
} from './state.js';
import * as api from './api.js';
import * as cache from './cache.js';
import * as ui from './ui.js';
import * as audio from './audio.js';
import * as votd from './votd.js';
import * as search from './search.js';
import * as userdata from './userdata.js';
import * as download from './download.js';
import * as downloadModal from './downloadModal.js';
import * as cref from './cref.js';
import * as readingView from './readingView.js';
import * as commentary from './commentary.js';
import * as navigation from './navigation.js';
import * as viewInitializer from './viewInitializer.js';
import * as system from './system.js';
import * as theme from './theme.js';

// The Supabase Config constants have been moved to api.js

let supabaseClient = null; // This will be initialized using the api module
let booksDownloadedInThisRun = []; // <-- ADDED: For tracking books during a single download session

// --- Initialize Supabase Client using the API module ---
// The api.initializeSupabase function now contains all the timeout and error handling logic.
// We pass it the showPersistentErrorBanner function to handle UI feedback on failure.
supabaseClient = api.initializeSupabase(ui.showPersistentErrorBanner);
// --- End Supabase Client Initialization ---

document.addEventListener('DOMContentLoaded', () => {
console.log("Initializing Divine Scripture Explorer");


const selectedVerseElements = new Set(); // Stores HTMLElement objects of selected verses



const DEBOUNCE_DELAY = 400; // Keep if used for other debounce needs



function setLanguage(langCode) {
    if (langCode !== 'am' && langCode !== 'en') {
        langCode = 'am'; // Default to Amharic if invalid
    }
    if (currentState.language === langCode) {
        return;
    }

    // 1. Update State
    currentState.language = langCode;
    localStorage.setItem("language", langCode);

    // 2. Orchestrate Data/Content Refreshes
    if (ui.readingView?.classList.contains("active") && currentState.book && currentState.chapter) {
        readingView.open(currentState.book, currentState.chapter, readingView.findCenterVisibleVerseId());
    }
    if (currentState.currentView === 'bookListView' && currentState.isSearching) {
        search.clear();
    }
    votd.refresh();

    // 3. Trigger all necessary UI updates with a single call
    ui.handleLanguageChange();
}

function handleThemeViewClick(event) {
    // Handle Navigation Action (Controller's job)
    const bookCard = event.target.closest('.book-card[data-book]');
    if (bookCard) {
        const bookId = bookCard.dataset.book;
        if (bookId && currentState.booksInfo[bookId]) {
            readingView.open(bookId, 1);
        }
        return; // Navigation action handled.
    }

    // Delegate UI Action (View's job)
    const themeCard = event.target.closest('.theme-card[data-theme-name]');
    if (themeCard) {
        ui.toggleThemeCard(themeCard);
    }
}



function handleUserItemClick(event) {
    const itemElement = event.target.closest('[data-item-id]');
    if (!itemElement) return;

    const itemId = itemElement.dataset.itemId;
    const type = itemElement.classList.contains('note-item') ? 'note' : 'favourite';

    if (event.target.closest('.delete-item-button')) {
        deleteUserItem(type, itemId);
    } else if (event.target.closest(`.${type}-item-content`)) {
        const { book, chapter, navigationTarget } = itemElement.dataset;
        if (book && chapter && navigationTarget) {
            readingView.open(book, chapter, navigationTarget);
        }
    }
}

function handleReflectionCardClick(event) {
    const li = event.target.closest('.reflection-card');
    if (!li) return;
    const reflectionId = li.dataset.reflectionId;
    const reflection = currentState.reflections.find(r => r.id === reflectionId);
    if (!reflection) return;

    if (event.target.closest('.edit-reflection-button')) {
        ui.toggleEditMode(li);
    } else if (event.target.closest('.delete-reflection-button')) {
        deleteReflection(reflection.id);
    } else if (event.target.closest('.save-reflection-button')) {
        const textarea = li.querySelector('.reflection-edit-form textarea');
        saveEditedReflection(li, reflection, textarea);
    } else if (event.target.closest('.cancel-reflection-button')) {
        ui.cancelEditMode(li);
    } else if (event.target.closest('.reflection-card-header, .reflection-content-display')) {
        ui.toggleExpanded(li);
    }
}




// [REMOVED] This function is now defined in ui.js

// piece two starts here


// [REMOVED] This function is now defined in ui.js







function handleBookListSearchInteraction() {
    handleSearchExecution();
}




async function getChapterCount(bookId) {
    if (!bookId) return 0; const bookInfo = currentState.booksInfo[bookId]; if (bookInfo?.chapters > 0) { return bookInfo.chapters; }
    if (!supabaseClient) { console.error("Supabase client is not initialized."); return 0; }

    console.warn(`Ch count for ${bookId} not cached. Fetching from Supabase...`);
    try {
        // Fetch book info from Supabase via the API module
        const { data: bookData, error } = await api.fetchBookDetails(bookId);

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found"
            console.error(`Error fetching book info for ${bookId} from Supabase:`, error);
            if (currentState.booksInfo[bookId]) currentState.booksInfo[bookId].chapters = 0;
            return 0;
        }
         if (error && error.code === 'PGRST116') {
             if (currentState.booksInfo[bookId]) currentState.booksInfo[bookId].chapters = 0;
             return 0;
         }


        const chapterCount = bookData?.chapters || 0;
        if (!currentState.booksInfo[bookId]) {
            currentState.booksInfo[bookId] = { id: bookId, name: bookId, chapters: chapterCount, amharicName: bookData?.amharicName || bookId, testament: getTestamentKey(bookData?.testament), order: bookData?.order };
        } else {
            currentState.booksInfo[bookId].chapters = chapterCount;
        }
        return chapterCount;

    } catch(error) {
        console.error(`Error fetching book info for ${bookId} from Supabase catch block:`, error);
        if (currentState.booksInfo[bookId]) currentState.booksInfo[bookId].chapters = 0;
        return 0;
    }
}



function getActivateTabFunction(container, isMainView, panelScopeOverride = null) {
    return (buttonToActivate) => {
         if (!buttonToActivate) return;
         const targetPanelId = buttonToActivate.getAttribute('aria-controls'); const targetViewId = buttonToActivate.dataset.view; const effectiveTargetId = targetViewId || targetPanelId;
         if (effectiveTargetId === 'readingTabView') {
              return;
         }

         if (!effectiveTargetId) { console.warn("Tab button is missing target information:", buttonToActivate); return; }

        Array.from(container.querySelectorAll('[role="tab"]'))
             .filter(btn => btn.dataset.view !== 'readingTabView' && btn.getAttribute('aria-controls') !== 'readingTabView')
            .forEach(btn => {
                btn.setAttribute('aria-selected', 'false');
                btn.classList.remove('active');
            });

        buttonToActivate.setAttribute('aria-selected', 'true');
        buttonToActivate.classList.add('active');

        if (isMainView) {
            Object.values(views).forEach(viewElement => {
                if (viewElement && viewElement !== views.readingTabView) {
                    viewElement.classList.add('hidden');
                    viewElement.classList.remove('active');
                    viewElement.setAttribute('aria-hidden', 'true');
                }
            });
            currentState.currentView = effectiveTargetId;

            currentState.sourceReferenceForBackNav = null;
            ui.updateCrossRefBackButton();


            const targetViewElement = ui.views[effectiveTargetId];
            if (targetViewElement) {
                targetViewElement.classList.remove('hidden');
                targetViewElement.classList.add('active');
                targetViewElement.setAttribute('aria-hidden', 'false');

                 if (effectiveTargetId === 'bookListView' && currentState.isSearching) {
                    clearBookListSearch(false);
                }
                                 if (effectiveTargetId === 'notesView') {
                     ui.renderUserItems('note');
             ui.renderUserItems('favourite');
                     ui.renderReflections(); // <--- ADDED LINE
                 }
                 if (effectiveTargetId === 'themeView') {
                      ui.renderRecentBooks();
                 }
                        } else {
            }

             ui.syncMainViewTabs(currentState.currentView);
            
            // hideHighlightColorPicker(); // REMOVED
            ui.removeActiveExpansion();
        } else {
            const panelScope = ui.mainAppContent; // Define panelScope for non-main views
            if (panelScope) {
                ui.hideAllPanels(panelScope);
                ui.showTargetPanel(targetPanelId, panelScope);
            } else {
            }
        }
    };
}



function handleCrossRefBackClick() {
    if (!currentState.sourceReferenceForBackNav) {
        return;
    }

    const sourceRef = currentState.sourceReferenceForBackNav;
    const match = sourceRef.match(/^(.+?)\s+(\d+):(\d+(?:-\d+)?)$/);

    if (match) {
        const bookInputName = match[1].trim();
        const chapter = parseInt(match[2]);
        const verseRefPart = match[3];
        const bookId = normalizeBookName(bookInputName, currentState.booksInfo, currentState.bookAliasMap);

        // When navigating back using the cross-ref/commentary back button,
        // always set the mode back to 'scripture'.
        currentState.readingContentMode = 'scripture';
        ui.updateReadingContentModeUI(); // Update the quick mode toggle UI (from Step 1)


        if (bookId && currentState.booksInfo[bookId] && chapter) {
             // openReadingView will now use currentState.readingContentMode ('scripture')
             // Pass null as the source reference for the NEXT back nav (you can't go back from 'back')
             readingView.open(bookId, chapter, verseRefPart, null);
        } else {
            console.error(`Navigation back failed: Could not process book "${bookInputName}" from source ref "${sourceRef}".`);
            alert(`Navigation back failed: Could not process book "${bookInputName}".`);
            currentState.sourceReferenceForBackNav = null;
            ui.updateCrossRefBackButton();
        }
    } else {
        console.error(`Navigation back failed: Invalid reference format "${sourceRef}".`);
        alert(`Navigation back failed: Invalid reference format "${sourceRef}".`);
        currentState.sourceReferenceForBackNav = null;
        ui.updateCrossRefBackButton();
    }
}












 




function handleRecentBookClick(event) {
    const bookCard = event.target.closest('.book-card.recent-book-card-item');
    if (!bookCard) return;

    const bookId = bookCard.dataset.book;
    const chapter = parseInt(bookCard.dataset.chapter);
    const navigationTarget = bookCard.dataset.navigationTarget;

    if (bookId && chapter && navigationTarget && currentState.booksInfo[bookId]) {
        openReadingView(bookId, chapter, navigationTarget);
    } else {
        console.error("Missing data attributes for navigation on recent book card:", bookCard);
        alert("Could not navigate to this recent book. Data missing.");
    }
}


/**
 * A central function to bind all event listeners for the application.
 * This is called once during initializeApp().
 */
function addEventListeners() {

    ui.settings.languageSelect?.addEventListener("change", (e) => setLanguage(e.target.value));
     ui.settings.browseViewModeSelect?.addEventListener('change', (e) => {
        const newMode = e.target.value;
        if (currentState.browseViewMode !== newMode) {
            currentState.browseViewMode = newMode;
            localStorage.setItem('browseViewMode', newMode);
            navigation.updatePrimaryNav();
        }
    });   ui.settings.fontSizeSlider?.addEventListener('input', (e) => {
        currentState.fontSize = parseFloat(e.target.value);
        ui.applyReadingSettings();
    });
    ui.settings.fontSizeSlider?.addEventListener('change', () => {
        localStorage.setItem('fontSize', currentState.fontSize.toString());
    });
    ui.settings.fontFamilySelect?.addEventListener('change', (e) => {
        currentState.fontFamily = e.target.value;
        ui.applyReadingSettings();
        localStorage.setItem('fontFamily', currentState.fontFamily);
    });
    ui.settings.autoHideDelaySelect?.addEventListener('change', (e) => {
        currentState.autoHideDelay = parseInt(e.target.value, 10);
        localStorage.setItem('autoHideDelay', currentState.autoHideDelay.toString());
        ui.resetUIAutoHide();
    });



    // -- Download & Data Management Listeners --
    // Note: Most download-related listeners (start, cancel, clear downloaded) are now in download.js
    
    // This listener can remain here as it's a general data maintenance action.
    document.getElementById('clearChapterCacheButton')?.addEventListener('click', async () => {
        if (confirm("Clear all temporary chapter text? This won't affect fully downloaded Bibles.")) {
            const { success, clearedCount } = await cache.clearTemporaryChapterCache();
            if (success) {
                ui.showTempMessage(`Cache cleared. ${clearedCount} items removed.`, 'success');
            } else {
                ui.showTempMessage(`Failed to clear cache.`, 'error');
            }
        }
    });






    window.addEventListener('resize', ui.handleResize);
    window.addEventListener('beforeunload', () => {
        clearTimeout(currentState.scrollSaveTimeoutId);
        updateCurrentRecentBookPosition();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            if (ui.fullscreenVerseOverlay?.classList.contains('active')) ui.toggleFullscreenVerse(false);
            if (ui.audioPlayerModal && !ui.audioPlayerModal.classList.contains('hidden')) toggleAudioModal();
            // ... add escape logic for other modals/popups here
        }
    });

    // -- Theme & Book List View Listeners --
    ui.views.themeView?.addEventListener('click', handleThemeViewClick);

    ui.views.bookListView?.addEventListener('click', (event) => {
        const listItem = event.target.closest('.book-list-item[data-book]');
        if (listItem && !currentState.isSearching) {
            readingView.open(listItem.dataset.book);
        }
    });




    // -- Reading View Quick Action Listeners (still handled by app.js) --
    ui.readingQuickLanguageButton?.addEventListener("click", () => {
        const nextLang = currentState.language === 'am' ? 'en' : 'am';
        setLanguage(nextLang);
    });
           ui.readingQuickThemeButton?.addEventListener('click', theme.toggleReadingQuickTheme);
    
    // Back button for cross-references is a navigation action, keep it here.
    ui.crossRefBackButtonContainer.addEventListener('click', (e) => {
        if (e.target.id === 'crossRefBackButton') handleCrossRefBackClick();
    });

    // -- Audio Player Listeners --
    // All audio-related event listeners are now encapsulated within the audio.js module's init() function.
    // We only need to listen for the trigger button click here to call the module's public interface.
    audio.audioModalTriggerButton?.addEventListener('click', audio.toggleModal);
}


async function initializeApp() {
    ui.body.classList.add('app-loading');

    try {
        // 1. Initialize the User Data module (loads settings, notes, etc.)
        userdata.init({
            openReadingView: readingView.open
        });

        // 2. Initialize the Theme module (fetches backgrounds and sets initial theme)
        await theme.init();

        // 3. Apply Initial UI Settings from State
        if (ui.settings.browseViewModeSelect) {
            ui.settings.browseViewModeSelect.value = currentState.browseViewMode;
        }
        ui.applyReadingSettings();
        if (ui.settings.autoHideDelaySelect) ui.settings.autoHideDelaySelect.value = currentState.autoHideDelay;
        const shouldKeepAwake = localStorage.getItem('keepAwake') === 'true';

        if (ui.settings.downloadLanguageSelect) {
            ui.settings.downloadLanguageSelect.value = currentState.downloadLanguage;
        }
        if (ui.settings.appVersionSpan) ui.settings.appVersionSpan.textContent = '3.0.0 (Offline Core)';
        setLanguage(currentState.language);

        // 4. Load Core App Data (Books, Themes, Aliases) and Render Static Views
        await viewInitializer.loadAndRender();

        // 5. Initialize the Verse of the Day Module
        votd.init({
            openReadingView: readingView.open,
            saveItems: userdata.saveItems, // Pass the generic save function from the userdata module
            renderUserItems: ui.renderUserItems,
        });

        // 6. Setup UI Structure (Tabs)
        navigation.init();

        // 7. Initialize Modules and Bind Event Listeners
        system.init();
        ui.init();
        audio.init();
        search.init({
            openReadingView: readingView.open,
            supabaseClient: supabaseClient,
        });
        download.init({
            supabaseClient: supabaseClient,
        });
        downloadModal.init();
        cref.init({
            openReadingView: readingView.open,
        });
        commentary.init({
            openReadingView: readingView.open,
        });
        readingView.init();
        addEventListeners(); // Centralized event listener setup for the rest of the app
        // 8. Final UI State Updates
        ui.updateDownloadUI();
        ui.body.classList.remove('app-loading');

    } catch (initError) {
        console.error("Critical error during app initialization:", initError);
        ui.body.innerHTML = '<p style="color: red; padding: 20px;">Error: App failed to start. Check console.</p>';
        ui.body.classList.remove('app-loading');
    }
}

initializeApp();

}); // End DOMContentLoaded listener