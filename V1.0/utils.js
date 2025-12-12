console.log("[Module Init] utils.js loaded.");
// --- File: js/utils.js ---
// This module contains shared helper functions used across the application.
// They are designed to be as "pure" as possible, taking inputs and returning outputs
// with minimal side effects or dependencies on the global state.

/**
 * A classic debounce function to limit the rate at which a function gets called.
 * @param {Function} func The function to debounce.
 * @param {number} wait The debounce delay in milliseconds.
 * @param {boolean} immediate If true, trigger the function on the leading edge instead of the trailing.
 * @returns {Function} The debounced function.
 */
export function debounce(func, wait, immediate) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        var later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

/**
 * Formats a time in seconds into a m:ss string.
 * @param {number} time The time in seconds.
 * @returns {string} The formatted time string (e.g., "3:05").
 */
export function formatTime(time) {
  if (isNaN(time) || time === Infinity) return '0:00';
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${secs < 10 ? '0' + secs : secs}`;
}

/**
 * Determines the canonical testament key ('OT', 'NT', 'AP', 'OTHER') from a string.
 * @param {string} testamentValue The string value of the testament.
 * @returns {string} The corresponding testament key.
 */
export function getTestamentKey(testamentValue) {
    if (!testamentValue || typeof testamentValue !== 'string') { return 'OTHER'; }
    const lowerValue = testamentValue.toLowerCase().trim();
    if (lowerValue === 'ot' || lowerValue === 'old' || lowerValue.includes('old testament')) return 'OT';
    if (lowerValue === 'nt' || lowerValue === 'new' || lowerValue.includes('new testament')) return 'NT';
    if (lowerValue === 'ap' || lowerValue === 'apocrypha' || lowerValue === 'deuterocanon' || lowerValue === 'eotc') return 'AP';
    return 'OTHER';
}

/**
 * Returns the full name for a testament key.
 * @param {string} key The testament key ('OT', 'NT', 'AP', 'OTHER').
 * @returns {string} The full testament name.
 */
export function getTestamentFullName(key) {
     if (key === 'OT') return 'Old Testament';
     if (key === 'NT') return 'New Testament';
     if (key === 'AP') return 'Apocrypha / EOTC';
     if (key === 'OTHER') return 'Other Books';
     return '';
}

/**
 * Fallback method to copy text to the clipboard using the deprecated execCommand.
 * @param {string} text The text to copy.
 */
export function fallbackCopyTextToClipboard(text) {
    let success = false;
    let textarea;
    try {
        textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        textarea.style.width = '0';
        textarea.style.height = '0';
        textarea.setAttribute('readonly', 'readonly');
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        success = document.execCommand('copy');
        if (success) {
             alert('Verse text copied to clipboard! (Fallback method)');
        } else {
             alert(`Copy failed. Please copy manually:\n${text}`);
        }
    } catch (err) {
        console.error('Error attempting execCommand fallback:', err);
        alert(`Copy failed. Please copy manually:\n${text}`);
    } finally {
        if (textarea && textarea.parentNode) {
            textarea.parentNode.removeChild(textarea);
        }
    }
}

/**
 * Normalizes a book name or alias to its canonical book ID.
 * This version is independent and receives the necessary state as arguments.
 * @param {string} name The book name or alias to normalize.
 * @param {object} booksInfo The map of book information from the main state.
 * @param {object} bookAliasMap The map of aliases to book IDs from the main state.
 * @returns {string|null} The canonical book ID or null if not found.
 */
export function normalizeBookName(name, booksInfo, bookAliasMap) {
    if (!name) return null;

    const rawLowerTrimmedName = name.toLowerCase().trim();
    if (booksInfo && booksInfo[rawLowerTrimmedName]) {
        return rawLowerTrimmedName;
    }

    let normalizedPrimary = rawLowerTrimmedName
        .replace(/[\s_]+/g, ' ')
        .replace(/[\.,;:'"!?]+/g, '')
        .trim();

    let normalizedForNumberedWithSpace = normalizedPrimary;
    if (/^\d/.test(normalizedPrimary)) {
        normalizedForNumberedWithSpace = normalizedPrimary.replace(/^(\d+)\s*/, '$1 ');
    }

    let normalizedForNumberedWithoutSpace = null;
    const numberAndTextMatch = rawLowerTrimmedName.match(/^(\d+)(.*)$/);
    if (numberAndTextMatch) {
        normalizedForNumberedWithoutSpace = (numberAndTextMatch[1] + numberAndTextMatch[2].replace(/[\s\._\-'"!?]+/g, '')).trim();
    }

    if (bookAliasMap) {
        const uniqueAliasCandidates = Array.from(new Set([
            normalizedPrimary,
            normalizedForNumberedWithSpace,
            normalizedForNumberedWithoutSpace,
            rawLowerTrimmedName
        ].filter(c => c)));

        for (const candidate of uniqueAliasCandidates) {
            if (bookAliasMap.hasOwnProperty(candidate)) {
                return bookAliasMap[candidate];
            }
        }
    }

    if (Object.keys(booksInfo).length > 0) {
        const uniqueCanonicalCandidates = Array.from(new Set([
            rawLowerTrimmedName,
            normalizedPrimary,
            normalizedForNumberedWithSpace,
        ].filter(c => c)));

        for (const candidate of uniqueCanonicalCandidates) {
            if (booksInfo[candidate]) {
                return candidate;
            }
            const lowerCandidate = candidate.toLowerCase();
            let infoMatchByIDLower = Object.keys(booksInfo).find(bookID => bookID.toLowerCase() === lowerCandidate);
            if (infoMatchByIDLower) {
                return infoMatchByIDLower;
            }
        }

        const infoMatchByAmharicName = Object.keys(booksInfo).find(bookID =>
            booksInfo[bookID]?.amharicName?.toLowerCase() === rawLowerTrimmedName
        );
        if (infoMatchByAmharicName) { return infoMatchByAmharicName; }
    }

    const spacedNumberBookMatch = normalizedForNumberedWithSpace.match(/^(\d+)\s+(.+)$/);
    if (spacedNumberBookMatch) {
        const bookNamePart = spacedNumberBookMatch[2].replace(/\s+/g, '-');
        const potentialHyphenatedID = `${spacedNumberBookMatch[1]}-${bookNamePart}`;
        if (booksInfo && booksInfo[potentialHyphenatedID]) {
            if (bookAliasMap && !bookAliasMap[normalizedForNumberedWithSpace]) {
                // This is a side-effect, but can be a performance optimization.
                // For a truly pure function, this line would be removed.
                // bookAliasMap[normalizedForNumberedWithSpace] = potentialHyphenatedID;
            }
            return potentialHyphenatedID;
        }
    }

    console.warn(`--- normalizeBookName END: Could not map input "${name}" ---`);
    return null;
}

/**
 * Generates the document ID used for cross-reference lookups.
 * @param {string} bookName The display name of the book.
 * @param {number} chapterNum The chapter number.
 * @param {string|number} verseNum The verse number or range string.
 * @param {object} booksInfo The map of book information from the main state.
 * @param {object} bookAliasMap The map of aliases to book IDs from the main state.
 * @returns {string|null} The cross-reference doc_id or null.
 */
export function getCrossRefDocId(bookName, chapterNum, verseNum, booksInfo, bookAliasMap) {
    const canonicalBookId = normalizeBookName(bookName, booksInfo, bookAliasMap);
    if (!canonicalBookId || !chapterNum || !verseNum) { return null; }

    const startVerse = String(verseNum).split('-')[0];
    const normalizedBookIdPart = canonicalBookId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
    return `${normalizedBookIdPart}-${chapterNum}-${startVerse}`;
}

/**
 * Parses a search query into a structured object (reference or keyword).
 * @param {string} query The user's search query.
 * @param {object} booksInfo The map of book information from the main state.
 * @param {object} bookAliasMap The map of aliases to book IDs from the main state.
 * @returns {object|null} A parsed query object or null.
 */
export function parseSearchQuery(query, booksInfo, bookAliasMap) {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return null;

    const fullRefMatch = trimmedQuery.match(/^(.+?)\s+(\d+):(\d+(?:-\d+)?)$/i);
    if (fullRefMatch) {
        const bookName = fullRefMatch[1].trim();
        const bookId = normalizeBookName(bookName, booksInfo, bookAliasMap);
        if (bookId) {
            return { type: 'reference', bookId: bookId, chapter: parseInt(fullRefMatch[2]), verse: fullRefMatch[3], originalQuery: query };
        }
    }

    const bookChapterMatch = trimmedQuery.match(/^(.+?)\s+(\d+)$/i);
    if (bookChapterMatch) {
        const bookName = bookChapterMatch[1].trim();
        const bookId = normalizeBookName(bookName, booksInfo, bookAliasMap);
         if (bookId) {
             return { type: 'reference', bookId: bookId, chapter: parseInt(bookChapterMatch[2]), verse: null, originalQuery: query };
         }
    }

    const bookOnlyId = normalizeBookName(trimmedQuery, booksInfo, bookAliasMap);
    if (bookOnlyId) {
        return { type: 'reference', bookId: bookOnlyId, chapter: null, verse: null, originalQuery: query };
    }

    return { type: 'keyword', query: trimmedQuery, originalQuery: query };
}


