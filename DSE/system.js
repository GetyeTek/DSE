// --- File: js/system.js ---
// This module handles system-level interactions, such as the Screen Wake Lock API
// and other browser or device-specific features.
console.log("[Module Init] system.js loaded.");

import { currentState } from './state.js';
import * as ui from './ui.js';

// ===================================================================================
// WAKE LOCK LOGIC
// ===================================================================================

/**
 * Requests a screen wake lock if the API is available.
 * Updates the UI toggle and saves the state to localStorage.
 */
export async function requestWakeLock() {
    if ('wakeLock' in navigator && !currentState.wakeLockSentinel) {
        try {
            currentState.wakeLockSentinel = await navigator.wakeLock.request('screen');

            currentState.wakeLockSentinel.addEventListener('release', () => {
                // This listener is fired if the lock is released by the browser (e.g., tab hidden).
                currentState.wakeLockSentinel = null;
                // Ensure the UI reflects the actual state.
                if (ui.settings.keepAwakeToggle?.checked) {
                    ui.settings.keepAwakeToggle.checked = false;
                    localStorage.setItem('keepAwake', 'false');
                }
            });

            // Update UI and storage on successful request.
            if (ui.settings.keepAwakeToggle) ui.settings.keepAwakeToggle.checked = true;
            localStorage.setItem('keepAwake', 'true');
        } catch (err) {
            console.error(`Wake Lock request failed: ${err.name}`, err);
            currentState.wakeLockSentinel = null;
            if (ui.settings.keepAwakeToggle) ui.settings.keepAwakeToggle.checked = false;
            localStorage.setItem('keepAwake', 'false');
        }
    }
}

/**
 * Releases the screen wake lock if it is currently held.
 * Updates the UI toggle and saves the state to localStorage.
 */
export async function releaseWakeLock() {
    if (currentState.wakeLockSentinel) {
        const sentinel = currentState.wakeLockSentinel;
        currentState.wakeLockSentinel = null; // Clear our reference first
        await sentinel.release();
    }
    // Always ensure UI and storage are set to 'false' when released.
    if (ui.settings.keepAwakeToggle) ui.settings.keepAwakeToggle.checked = false;
    localStorage.setItem('keepAwake', 'false');
}

/**
 * Handles the visibility change event to re-acquire the wake lock if necessary.
 */
function _handleVisibilityChange() {
    if (document.visibilityState === 'visible' && 
        ui.settings.keepAwakeToggle?.checked && 
        ui.readingView?.classList.contains('active') && 
        !currentState.wakeLockSentinel) {
        requestWakeLock();
    }
}

/**
 * Disables the "Keep Awake" toggle if the feature is not supported by the browser.
 */
function _checkSupport() {
    if (!('wakeLock' in navigator) && ui.settings.keepAwakeToggle) {
        ui.settings.keepAwakeToggle.disabled = true;
        ui.settings.keepAwakeToggle.closest('.setting-item')?.setAttribute('title', 'Screen Wake Lock not supported by this browser.');
        localStorage.setItem('keepAwake', 'false');
    }
}

/**
 * Initializes the system module.
 */
export function init() {
    _checkSupport();

    // Event Listeners
    ui.settings.keepAwakeToggle?.addEventListener('change', (e) => {
        e.target.checked ? requestWakeLock() : releaseWakeLock();
    });
    
    document.addEventListener('visibilitychange', _handleVisibilityChange);

    // Expose functions globally for modules that were refactored earlier
    // and might still call them (e.g., readingView.js)
    window.requestWakeLock = requestWakeLock;
    window.releaseWakeLock = releaseWakeLock;
    
    console.log("System module initialized.");
}
