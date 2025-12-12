// --- File: js/navigation.js ---
// This module manages the main application navigation, including the setup and
// handling of all tabbed interfaces that switch between major views.
console.log("[Module Init] navigation.js loaded.");

import { currentState } from './state.js';
import * as ui from './ui.js';
import * as search from './search.js';
import * as readingView from './readingView.js';
import * as theme from './theme.js';

// ===================================================================================
// PRIVATE HELPER FUNCTIONS
// ===================================================================================

/**
 * Activates a specific tab and its corresponding panel/view.
 * @param {HTMLElement} buttonToActivate - The tab button element to make active.
 * @param {Array<HTMLElement>} allTabButtons - An array of all buttons in the tab group.
 * @param {boolean} isMainView - Flag indicating if this is for main app navigation.
 * @param {HTMLElement} panelScope - The parent element containing the panels to toggle.
 */
function _activateTab(buttonToActivate, allTabButtons, isMainView, panelScope) {
    if (!buttonToActivate) return;

    const targetViewId = buttonToActivate.dataset.view || buttonToActivate.getAttribute('aria-controls');
    if (!targetViewId) {
        console.warn("Tab button is missing target view/panel information:", buttonToActivate);
        return;
    }

    // Deactivate all other tabs in the group
    allTabButtons.forEach(btn => {
        btn.setAttribute('aria-selected', 'false');
        btn.classList.remove('active');
    });

    // Activate the selected tab
    buttonToActivate.setAttribute('aria-selected', 'true');
    buttonToActivate.classList.add('active');

    if (isMainView) {
        // --- Main Application View Switching Logic ---
        if (ui.readingView && ui.readingView.classList.contains('active')) {
            readingView.close(); // Cleanly close reading view if switching away
        }

        const currentActiveViewId = currentState.currentView;
        
        // Hide all main views
        Object.values(ui.views).forEach(viewElement => {
            if (viewElement && viewElement !== ui.views.readingTabView) {
                const isCurrent = viewElement.id === currentActiveViewId;
                viewElement.classList.add('hidden');
                viewElement.classList.remove('active');
                viewElement.setAttribute('aria-hidden', 'true');
            }
        });
        
        currentState.currentView = targetViewId;
        currentState.sourceReferenceForBackNav = null; // Clear back-nav state
        ui.updateCrossRefBackButton();

        // Show the target view
        const targetViewElement = ui.views[targetViewId];
        if (targetViewElement) {
            targetViewElement.classList.remove('hidden');
            targetViewElement.classList.add('active');
            targetViewElement.setAttribute('aria-hidden', 'false');

            // Update the theme system, which will apply the correct background
            // to the newly activated view.
            theme.update();

            // Trigger view-specific logic
            if (targetViewId === 'bookListView' && currentState.isSearching) {
                search.clear();
            }
            if (targetViewId === 'notesView') {
                ui.renderUserItems('note');
                ui.renderUserItems('favourite');
                ui.renderReflections();
            }
            if (targetViewId === 'themeView') {
                ui.renderRecentBooks();
            }
        }
        
        _syncMainViewTabs(targetViewId);

    } else {
        // --- Logic for secondary tab panels (like in Notes or Book List view) ---
        if (panelScope) {
            ui.hideAllPanels(panelScope);
            ui.showTargetPanel(targetViewId, panelScope);
        }
    }
}

/**
 * Keeps the top and bottom navigation bars in sync.
 * @param {string} activeViewId - The ID of the currently active main view.
 */
function _syncMainViewTabs(activeViewId) {
    const containers = [ui.mainViewTabsContainer];
    if (ui.bottomNavTabsContainer) {
        containers.push(ui.bottomNavTabsContainer.querySelector('[role="tablist"]'));
    }

    containers.forEach(container => {
        if (!container) return;
        container.querySelectorAll('[role="tab"]').forEach(btn => {
            const btnTargetView = btn.dataset.view || btn.getAttribute('aria-controls');
            if (btnTargetView === 'readingTabView' || btnTargetView === 'searchView') return;
            
            const isMatch = (btnTargetView === activeViewId);
            btn.classList.toggle('active', isMatch);
            btn.setAttribute('aria-selected', String(isMatch));
        });
    });
}

// ===================================================================================
// PUBLIC API
// ===================================================================================

/**
 * Dynamically updates the primary navigation tabs based on the user's chosen browse mode.
 */
export function updatePrimaryNav() {
    const mode = currentState.browseViewMode; // 'theme' or 'list'
    
    const navContainers = [
        ui.mainViewTabsContainer, 
        ui.bottomNavTabsContainer?.querySelector('[role="tablist"]')
    ];

    navContainers.forEach(container => {
        if (!container) return;

        const themeTab = container.querySelector('[aria-controls="themeView"]');
        const listTab = container.querySelector('[aria-controls="bookListView"]');

        if (!themeTab || !listTab) return;

        if (mode === 'theme') {
            themeTab.style.display = '';
            listTab.style.display = 'none';
        } else { // mode === 'list'
            themeTab.style.display = 'none';
            listTab.style.display = '';
        }
    });

    // Ensure the correct view is active
    const newDefaultView = (mode === 'theme') ? 'themeView' : 'bookListView';
    const currentActiveButton = ui.mainViewTabsContainer.querySelector('[aria-selected="true"]');
    
    // If the currently active view is now hidden, switch to the new default
    if (currentActiveButton && currentActiveButton.style.display === 'none') {
        const allTabs = Array.from(ui.mainViewTabsContainer.querySelectorAll('[role="tab"]'));
        const newActiveButton = ui.mainViewTabsContainer.querySelector(`[data-view="${newDefaultView}"]`);
        _activateTab(newActiveButton, allTabs, true, ui.mainAppContent);
    }
}


/**
 * Sets up a group of tabs and their corresponding panels/views.
 * @param {HTMLElement} container - The element containing the tab buttons (e.g., a `[role="tablist"]`).
 * @param {string} defaultTabIdOrView - The ID of the tab/view to activate by default.
 * @param {boolean} [isMainView=false] - True if this tab group controls the main application views.
 * @param {HTMLElement} [panelScopeOverride=null] - Explicitly provide the parent of the panels.
 */
export function setupTabs(container, defaultTabIdOrView, isMainView = false, panelScopeOverride = null) {
    if (!container) return;

    const tabButtons = Array.from(container.querySelectorAll('[role="tab"]'))
        .filter(btn => btn.dataset.view !== 'readingTabView');

    if (tabButtons.length === 0) return;

    const panelScope = panelScopeOverride || (isMainView ? ui.mainAppContent : container.nextElementSibling);
    
    tabButtons.forEach(button => {
        const handler = (e) => {
            e.preventDefault();
            _activateTab(button, tabButtons, isMainView, panelScope);
        };
        button.addEventListener('click', handler);
        button.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                handler(e);
            }
        });
    });

    // This part of the logic is now simplified, as the initial active view
    // will be determined by the browseViewMode setting.
}


/**
 * Initializes the navigation system on application startup.
 */
export function init() {
    // Initial setup of listeners for ALL tabs.
    // We don't activate a default here, as updatePrimaryNav will handle it.
    setupTabs(ui.mainViewTabsContainer, null, true);
    setupTabs(ui.bottomNavTabsContainer?.querySelector('[role="tablist"]'), null, true);
    setupTabs(ui.bookListTabsContainer, 'bookListTabOT');
    if (ui.notesViewTabsContainer && ui.views.notesView) {
        setupTabs(ui.notesViewTabsContainer, 'userNotesPanel', false, ui.views.notesView);
    }

    // Set the initial navigation layout based on user's setting
    updatePrimaryNav();
    
    // Now determine and activate the startup view
    const initialView = currentState.browseViewMode === 'theme' ? 'themeView' : 'bookListView';
    const allTabs = Array.from(ui.mainViewTabsContainer.querySelectorAll('[role="tab"]'));
    const initialButton = ui.mainViewTabsContainer.querySelector(`[data-view="${initialView}"]`);
    _activateTab(initialButton, allTabs, true, ui.mainAppContent);

    console.log("Navigation module initialized.");
}
