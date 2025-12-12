// --- File: js/audio.js ---
// This module encapsulates all logic for the audio player, including state management,
// DOM interaction, and data fetching for audio URLs.
console.log("[Module Init] audio.js loaded.");

import { formatTime } from './utils.js';
import * as api from './api.js';
import * as cache from './cache.js';
import { currentState } from './state.js'; // Read-only access to main state for context
import { showTempMessage } from './ui.js';

// ===================================================================================
// DOM ELEMENT REFERENCES
// ===================================================================================

const audioPlayerModal = document.getElementById('audioPlayerModal');
const audioElement = document.getElementById('audio');
const audioPlayPauseBtn = document.getElementById('playPauseBtn');
const audioProgressBar = document.getElementById('progressBar');
const audioCurrentTimeSpan = document.getElementById('currentTime');
const audioDurationSpan = document.getElementById('duration');
const audioForwardBtn = document.getElementById('forwardBtn');
const audioBackwardBtn = document.getElementById('backwardBtn');
export const audioModalTriggerButton = document.getElementById('audioModalTriggerButton');

// ===================================================================================
// MODULE-LEVEL STATE
// ===================================================================================

const audioState = {
    isPlaying: false,
    isLoading: false,
    duration: 0,
    currentTime: 0,
    loadedUrl: null,
    loadedBookId: null,
    loadedChapter: null,
    currentViewAudioUrl: null,
    currentViewAudioReady: false,
    currentViewBookId: null,
    currentViewChapter: null,
    volume: 1,
    muted: false,
};

// ===================================================================================
// PRIVATE HELPER FUNCTIONS
// ===================================================================================

/**
 * Updates all audio player UI elements based on the current audio state.
 * Reads context (like book names) from the main application state.
 */
function updateUI() {
    if (!audioElement) {
        if (audioModalTriggerButton) audioModalTriggerButton.style.display = 'none';
        return;
    }
    if (audioModalTriggerButton) audioModalTriggerButton.style.display = '';

    const viewBookId = audioState.currentViewBookId || currentState.book;
    const viewChapter = audioState.currentViewChapter || currentState.chapter;
    let modalHeaderRef = '...';

    if (viewBookId && viewChapter) {
        const bookInfo = currentState.booksInfo[viewBookId];
        const viewBookDisplayName = bookInfo ? (currentState.language === 'en' ? bookInfo.englishName : bookInfo.amharicName) || viewBookId : viewBookId;
        modalHeaderRef = `${viewBookDisplayName} ${viewChapter}`;
    } else {
        modalHeaderRef = 'No Chapter Selected';
    }

    const audioModalHeaderRef = audioPlayerModal?.querySelector('#audioModalHeaderRef');
    if (audioModalHeaderRef) audioModalHeaderRef.textContent = modalHeaderRef;

    const isAudioAvailableForView = audioState.currentViewAudioReady;

    if (audioState.isPlaying) {
        audioPlayPauseBtn.textContent = "⏸️";
        audioPlayPauseBtn.setAttribute('aria-label', 'Pause Audio');
    } else {
        if (audioState.isLoading) {
            audioPlayPauseBtn.textContent = "...";
            audioPlayPauseBtn.setAttribute('aria-label', 'Loading Audio');
        } else if (!isAudioAvailableForView) {
            audioPlayPauseBtn.textContent = "🔇";
            audioPlayPauseBtn.setAttribute('aria-label', `Audio Not Available for ${modalHeaderRef}`);
        } else {
            audioPlayPauseBtn.textContent = "▶️";
            audioPlayPauseBtn.setAttribute('aria-label', `Play Audio for ${modalHeaderRef}`);
        }
    }
    audioPlayPauseBtn.disabled = !isAudioAvailableForView || audioState.isLoading;

    const { duration, currentTime } = audioState;
    audioCurrentTimeSpan.textContent = formatTime(currentTime);
    audioDurationSpan.textContent = formatTime(duration);

    const hasDuration = duration > 0 && isFinite(duration);
    if (hasDuration) {
        audioProgressBar.value = (currentTime / duration) * 100;
        audioProgressBar.disabled = false;
    } else {
        audioProgressBar.value = 0;
        audioProgressBar.disabled = true;
    }

    if (audioForwardBtn) audioForwardBtn.disabled = !hasDuration || audioState.isLoading || !isAudioAvailableForView;
    if (audioBackwardBtn) audioBackwardBtn.disabled = !hasDuration || audioState.isLoading || !isAudioAvailableForView;
}

/**
 * Fetches an audio URL, checking cache first and falling back to the API.
 * @param {string} bookId The canonical book ID.
 * @param {number} chapter The chapter number.
 * @param {string} language The language code.
 * @returns {Promise<{url: string|null, source: 'cache'|'network'|'none'}>} The URL and its source.
 */
async function _fetchUrl(bookId, chapter, language) {
    try {
        const cachedUrl = await cache.getAudioUrl(bookId, chapter, language);
        if (cachedUrl) {
            return { url: cachedUrl, source: 'cache' };
        }

        const { data, error } = await api.fetchAudioUrl({ bookId, chapter, language });
        if (error && error.code !== 'PGRST116') {
            console.error(`Audio Module: API error fetching URL for ${bookId}-${chapter}-${language}:`, error);
            return { url: null, source: 'none' };
        }
        
        if (data?.audio_url) {
            // Asynchronously save the newly fetched URL to cache, but don't wait for it.
            cache.saveAudioUrl(bookId, chapter, language, data.audio_url);
            return { url: data.audio_url, source: 'network' };
        }

        return { url: null, source: 'none' };
    } catch (err) {
        console.error("Audio Module: Unexpected error during URL fetch process:", err);
        return { url: null, source: 'none' };
    }
}

// ===================================================================================
// AUDIO CONTROL FUNCTIONS
// ===================================================================================

/** Starts or resumes audio playback. Loads new audio if necessary. */
function play() {
    if (!audioElement) return;
    if (!audioElement.paused) {
        pause();
        return;
    }

    if (!audioState.currentViewAudioReady || !audioState.currentViewAudioUrl) {
        console.warn(`Play clicked, but audio is not available for the current view.`);
        return;
    }

    const targetUrlForView = audioState.currentViewAudioUrl;
    const isCorrectTrackLoaded = audioState.loadedUrl === targetUrlForView && audioElement.src === targetUrlForView;
    const canResume = isCorrectTrackLoaded && audioElement.currentTime > 0 && audioElement.readyState >= 2;

    if (canResume) {
        audioElement.play().catch(error => {
            console.error("Error resuming audio playback:", error);
            audioState.isPlaying = false;
            updateUI();
        });
        return;
    }

    stop(); // Fully stop and reset before loading new source
    audioState.isLoading = true;
    updateUI();

    audioElement.autoplay = true;
    audioState.loadedUrl = targetUrlForView;
    audioState.loadedBookId = audioState.currentViewBookId;
    audioState.loadedChapter = audioState.currentViewChapter;
    audioElement.src = targetUrlForView;
}

/** Pauses the currently playing audio. */
function pause() {
    if (!audioElement || !audioState.isPlaying) return;
    audioElement.pause();
}

/** Stops playback, resets time to 0, and clears the audio source. */
export function stop() {
    if (!audioElement) return;
    audioElement.pause();
    if (audioElement.hasAttribute('src')) {
        audioElement.removeAttribute('src');
    }
    audioElement.load();
    audioElement.currentTime = 0;

    audioState.isPlaying = false;
    audioState.isLoading = false;
    audioState.currentTime = 0;
    audioState.duration = 0;
    audioState.loadedUrl = null;
    audioState.loadedBookId = null;
    audioState.loadedChapter = null;
    updateUI();
}

/** Seeks the audio to a specific time. */
function seek(time) {
    if (!audioElement || audioElement.readyState < 2 || !isFinite(audioElement.duration)) return;
    const clampedTime = Math.min(Math.max(0, time), audioElement.duration);
    audioElement.currentTime = clampedTime;
}

/** Seeks forward 10 seconds. */
function forward10s() { if(audioElement) seek(audioElement.currentTime + 10); }

/** Seeks backward 10 seconds. */
function backward10s() { if(audioElement) seek(audioElement.currentTime - 10); }

// ===================================================================================
// PUBLIC INTERFACE / ORCHESTRATION
// ===================================================================================

/**
 * Updates the audio module's context when the reading view changes.
 * This fetches the audio URL for the new context but does not play it.
 */
export async function updateViewContext(bookId, chapter, language) {
    audioState.currentViewBookId = bookId;
    audioState.currentViewChapter = chapter;
    audioState.currentViewAudioUrl = null;
    audioState.currentViewAudioReady = false;
    updateUI();

    if (!bookId || !chapter) return;

    const { url } = await _fetchUrl(bookId, chapter, language);
    if (url) {
        audioState.currentViewAudioUrl = url;
        audioState.currentViewAudioReady = true;
    }
    updateUI();
}

/**
 * Toggles the visibility of the audio player modal.
 */
export function toggleModal() {
    if (!audioPlayerModal) return;

    const isModalHidden = audioPlayerModal.classList.contains('hidden');
    audioPlayerModal.classList.toggle('hidden', !isModalHidden);
    audioPlayerModal.setAttribute('aria-hidden', String(isModalHidden));

    if (!isModalHidden) return; // Modal was visible, now hidden.
    
    // Modal is now visible, ensure context is up-to-date.
    updateViewContext(currentState.book, currentState.chapter, currentState.language);
}

/**
 * Initializes the audio module by setting up all necessary event listeners.
 */
export function init() {
    if (!audioElement) {
        console.warn("Audio module init: <audio> element not found. Player will be disabled.");
        if (audioModalTriggerButton) audioModalTriggerButton.style.display = 'none';
        return;
    }

    // --- HTML <audio> Element Event Listeners ---
    audioElement.addEventListener('loadstart', () => { audioState.isLoading = true; updateUI(); });
    audioElement.addEventListener('canplay', () => { audioState.isLoading = false; updateUI(); });
    audioElement.addEventListener('waiting', () => { audioState.isLoading = true; updateUI(); });
    audioElement.addEventListener('loadedmetadata', () => { audioState.duration = audioElement.duration || 0; updateUI(); });
    audioElement.addEventListener('play', () => {
        audioState.isPlaying = true;
        if (audioElement.autoplay) {
            audioElement.autoplay = false;
        }
        updateUI();
    });
    audioElement.addEventListener('pause', () => { audioState.isPlaying = false; updateUI(); });
    audioElement.addEventListener('ended', () => { stop(); });
    audioElement.addEventListener('timeupdate', () => { audioState.currentTime = audioElement.currentTime; updateUI(); }, { passive: true });
    
    // --- Self-Healing Error Handler ---
    audioElement.addEventListener('error', async () => {
        if (!audioElement.hasAttribute('src')) return; // Ignore errors from intentional stops.

        showTempMessage("Error: Could not load audio file.", 'error');
        const failedUrl = audioState.loadedUrl;
        const bookId = audioState.loadedBookId;
        const chapter = audioState.loadedChapter;
        const language = currentState.language;
        
        stop(); // Reset state immediately.

        if (bookId && chapter && language) {
            const cachedUrl = await cache.getAudioUrl(bookId, chapter, language);
            // If the failed URL was the one from the cache, clear it.
            if (failedUrl && cachedUrl === failedUrl) {
                showTempMessage("Invalid cached audio, attempting to refresh...", 'info');
                await cache.saveAudioUrl(bookId, chapter, language, null); // Clear bad cache entry.
                // Re-run the context update, which will now be forced to go to the network.
                await updateViewContext(bookId, chapter, language);
            }
        }
    });
    
    // --- Player Control Listeners ---
    audioPlayPauseBtn?.addEventListener('click', play);
    audioForwardBtn?.addEventListener('click', forward10s);
    audioBackwardBtn?.addEventListener('click', backward10s);
    audioProgressBar?.addEventListener('change', (e) => {
        if (isFinite(audioElement.duration)) {
            seek((parseFloat(e.target.value) / 100) * audioElement.duration);
        }
    });

    // --- Modal Listeners ---
    audioModalTriggerButton?.addEventListener('click', toggleModal);
    audioPlayerModal?.addEventListener('click', (event) => {
        if (event.target === audioPlayerModal) {
            toggleModal();
        }
    });
    
    updateUI();
    console.log("Audio module initialized.");
}