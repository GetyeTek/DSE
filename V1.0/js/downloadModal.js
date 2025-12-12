// --- File: js/downloadModal.js ---
// This module is the controller for the Download Options modal. It manages
// the modal's visibility, checks the status of downloadable packages,
// and handles user interactions within the modal.
console.log("[Module Init] downloadModal.js loaded.");

import { currentState } from './state.js';
import * as ui from './ui.js';
import * as cache from './cache.js'; // We will need this to check status later

// ===================================================================================
// DOM ELEMENT REFERENCES
// ===================================================================================

const modal = document.getElementById('downloadModal');
const closeBtn = document.getElementById('closeDownloadModalBtn');
const startDownloadBtn = document.getElementById('startSelectedDownloadsBtn');
const progressContainer = document.getElementById('downloadModalProgressContainer');
const progressMessage = document.getElementById('downloadModalProgressMessage');
const progressBar = document.getElementById('downloadModalProgressBar');
const optionItems = modal?.querySelectorAll('.download-option-item');

// This is the button in the main Settings page that will open our modal
const openModalTrigger = document.getElementById('startDownloadButton');

// ===================================================================================
// PRIVATE HELPER FUNCTIONS
// ===================================================================================

/**
 * Updates the UI of a single download option item (a row in the modal).
 * @param {HTMLElement} itemEl - The .download-option-item element.
 * @param {string} status - The status ('downloaded', 'not_downloaded', 'checking', 'error').
 * @param {string} message - The text to display in the status message.
 * @param {boolean} [isDownloaded=false] - If true, disable the toggle.
 */
function _updateOptionUI(itemEl, status, message, isDownloaded = false) {
    const statusEl = itemEl.querySelector('.option-status');
    const toggleInput = itemEl.querySelector('input[type="checkbox"]');

    if (statusEl) {
        statusEl.textContent = message;
        statusEl.dataset.status = status;
    }
    if (toggleInput) {
        toggleInput.disabled = isDownloaded;
        toggleInput.checked = isDownloaded;
    }
}

/**
 * Asynchronously checks the cache to determine the status of all packages and updates the UI.
 */
async function _checkAllPackageStatuses() {
    if (!optionItems) return;

    // A placeholder for our future state management.
    // For now, we'll simulate checking. In the next phase, this will read from currentState.downloadedPackages
    const downloadedPackages = {
        // Example: am_bible: true
    };

    for (const item of optionItems) {
        const packageId = item.dataset.packageId;
        const isDownloaded = downloadedPackages[packageId] === true;

        if (isDownloaded) {
            _updateOptionUI(item, 'downloaded', 'Downloaded', true);
        } else {
            // In the future, we could add size estimates here
            _updateOptionUI(item, 'not_downloaded', 'Not downloaded', false);
        }
    }
}


// ===================================================================================
// PUBLIC API
// ===================================================================================

/**
 * Shows the download modal.
 */
export function show() {
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    
    // Every time the modal is shown, re-check the statuses
    _checkAllPackageStatuses();
}

/**
 * Hides the download modal.
 */
export function hide() {
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
}

/**
 * Initializes the download modal module and sets up its event listeners.
 */
export function init() {
    if (!modal) {
        console.warn("Download Modal not found in DOM. Feature will be disabled.");
        return;
    }

    // --- Event Listeners ---
    
    // Listener for the main trigger button in the settings page
    openModalTrigger?.addEventListener('click', show);
    
    // Listeners for controls inside the modal
    closeBtn?.addEventListener('click', hide);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hide();
        }
    });

    startDownloadBtn?.addEventListener('click', () => {
        // This is where the magic will happen.
        // For now, we'll just log which packages are selected.
        const selectedPackages = [];
        optionItems.forEach(item => {
            const toggleInput = item.querySelector('input[type="checkbox"]');
            if (toggleInput && toggleInput.checked && !toggleInput.disabled) {
                selectedPackages.push(item.dataset.packageId);
            }
        });

        if (selectedPackages.length > 0) {
            ui.showTempMessage(`Starting download for: ${selectedPackages.join(', ')}`, 'info');
            // In the next st
