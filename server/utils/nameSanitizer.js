const path = require('path');

/**
 * Sanitizes a media filename by cleaning up standard release group tags,
 * resolution tags, and encoding attributes, keeping only the title and year/episode.
 * 
 * Example:
 * - "-Titanic (1997) (2160p BluRay x265 DV.HDR10 10bit EAC3 Atmos 5.1 S33D3R112).mp4"
 *   -> "Titanic (1997).mp4"
 * 
 * @param {string} filename Original filename
 * @returns {string} Sanitized filename
 */
function sanitizeMediaName(filename) {
    if (!filename) return filename;
    
    const ext = path.extname(filename);
    const name = path.basename(filename, ext);
    
    // 1. Try to match movie pattern with year: e.g. Name (Year) or Name.Year
    // We match any characters followed by a 4-digit year starting with 19 or 20,
    // optionally enclosed in brackets or parentheses.
    const yearMatch = name.match(/^(.*?)[(\[]?((?:19|20)\d{2})[)\]]?/i);
    if (yearMatch) {
        let title = yearMatch[1].trim();
        // Clean up dots, underscores, dashes to spaces
        title = title.replace(/[._-]/g, ' ').replace(/\s+/g, ' ');
        // Clean up leading/trailing symbols
        title = title.replace(/^[-._\s]+/, '').replace(/[-._\s]+$/, '');
        const year = yearMatch[2];
        return `${title} (${year})${ext}`;
    }

    // 2. Try to match show pattern: S01E01 or similar
    // Match any characters followed by SxxExx or similar
    const showMatch = name.match(/^(.*?)[. _-](S\d{2}E\d{2})/i);
    if (showMatch) {
        let title = showMatch[1].trim();
        title = title.replace(/[._-]/g, ' ').replace(/\s+/g, ' ');
        title = title.replace(/^[-._\s]+/, '').replace(/[-._\s]+$/, '');
        const ep = showMatch[2].toUpperCase();
        return `${title} ${ep}${ext}`;
    }

    // 3. Fallback: clean up dots/underscores to spaces, trim junk symbols
    let cleaned = name.replace(/[._-]/g, ' ').replace(/\s+/g, ' ');
    cleaned = cleaned.replace(/^[-._\s]+/, '').replace(/[-._\s]+$/, '');
    return `${cleaned}${ext}`;
}

module.exports = {
    sanitizeMediaName
};
