// --- File: js/theme.js ---
// This module manages the application's visual theme, including dark/light mode
// and the dynamic background images for the main views.
console.log("[Module Init] theme.js loaded.");

import { currentState } from './state.js';
import * as ui from './ui.js';
import * as api from './api.js';

// ===================================================================================
// PRIVATE HELPER FUNCTIONS
// ===================================================================================

/**
 * Applies the current dark mode setting to the body element.
 * It determines whether to use dark mode based on the user's setting and system preference.
 */
function _applyDarkMode() {
    const setting = currentState.darkModeSetting;
    const systemPrefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    
    const darkModeActive = (setting === 'system') ? systemPrefersDark : (setting === 'dark');

    ui.body.classList.toggle('dark-mode', darkModeActive);
    currentState.isDarkMode = darkModeActive;

    // Update the quick toggle button icon in the reading view header
    if (ui.readingQuickThemeIcon) {
        ui.readingQuickThemeIcon.textContent = darkModeActive ? '☀️' : '🌙';
    }
    if (ui.readingQuickThemeButton) {
        ui.readingQuickThemeButton.setAttribute('aria-label', darkModeActive ? 'Switch to Light Theme' : 'Switch to Dark Theme');
    }
}

/**
 * Applies the appropriate background image to the currently active main view.
 * This function is called whenever the theme or the active view changes.
 */
function _applyThemeViewBackground() {
    const targetElement = ui.views[currentState.currentView];
    const urls = currentState.themeViewBackgrounds;

    if (!targetElement || !['themeView', 'bookListView', 'notesView'].includes(currentState.currentView)) {
        if (targetElement) {
            targetElement.style.backgroundImage = 'none'; // Ensure other views don't get a background
        }
        return;
    }
    
    const imageUrl = currentState.isDarkMode ? urls.dark : urls.light;

    if (imageUrl) {
        targetElement.style.backgroundImage = `url('${imageUrl}')`;
    } else {
        targetElement.style.backgroundImage = 'none';
    }
}

// ===================================================================================
// PUBLIC API
// ===================================================================================

/**
 * Updates the entire theme system. Call this function whenever a theme-related setting changes.
 * It applies dark mode and then sets the appropriate background.
 */
export function update() {
    _applyDarkMode();
    _applyThemeViewBackground(); // The background depends on the dark mode state
}

/**
 * Toggles the theme in the reading view between light and dark.
 * This is the handler for the quick action button.
 */
export function toggleReadingQuickTheme() {
    const nextSetting = currentState.isDarkMode ? 'light' : 'dark';
    
    currentState.darkModeSetting = nextSetting;
    localStorage.setItem('darkModeSetting', nextSetting);

    if (ui.settings.darkModeSelect) {
        ui.settings.darkModeSelect.value = nextSetting;
    }

    update(); // Update the entire theme system
    ui.resetUIAutoHide(); // Reset the UI auto-hide timer in the reading view
}

/**
 * Initializes the theme module.
 */
export async function init() {
    // Fetch background image URLs from the API
    try {
        const { data, error } = await api.fetchAppSetting('theme_view_backgrounds');
        if (error && error.code !== 'PGRST116') throw error;
        if (data?.value) {
            currentState.themeViewBackgrounds.light = data.value.light || null;
            currentState.themeViewBackgrounds.dark = data.value.dark || null;
        }
    } catch (backgroundFetchError) {
        console.error("Theme Module: Error fetching background settings:", backgroundFetchError);
    }
    
    // Set initial theme on load
    update();

    // --- Set up event listeners ---
    
    // Listen for changes in the main settings dropdown
    ui.settings.darkModeSelect?.addEventListener('change', (e) => {
        currentState.darkModeSetting = e.target.value;
        localStorage.setItem('darkModeSetting', e.target.value);
        update();
    });

    // Listen for changes in the OS theme preference
    window.matchMedia('(prefers-color-scheme: dark)')?.addEventListener('change', () => {
        if (currentState.darkModeSetting === 'system') {
            update();
        }
    });

    // The reading view quick toggle is handled by app.js since it's a top-level UI element
    console.log("Theme module initialized.");
}
