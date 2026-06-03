/**
 * Input Validation Middleware
 * Provides validation and sanitization for user inputs
 */

const path = require('path');

/**
 * Validate file path to prevent directory traversal attacks
 */
const validatePath = (filePath) => {
    if (!filePath) {
        throw new Error('Path is required');
    }

    // Check for directory traversal attempts
    const normalized = path.normalize(filePath);
    if (normalized.includes('..')) {
        throw new Error('Invalid path: directory traversal detected');
    }

    return normalized;
};

/**
 * Validate filename
 */
const validateFilename = (filename) => {
    if (!filename) {
        throw new Error('Filename is required');
    }

    // Check for invalid characters
    const invalidChars = /[<>:"|?*\x00-\x1F]/;
    if (invalidChars.test(filename)) {
        throw new Error('Invalid filename: contains illegal characters');
    }

    // Check for reserved names (Windows)
    const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
    if (reserved.test(filename.split('.')[0])) {
        throw new Error('Invalid filename: reserved name');
    }

    return filename;
};

/**
 * Validate agent ID
 */
const validateAgentId = (agentId) => {
    if (!agentId) return null;

    // Agent ID should be alphanumeric with hyphens
    if (!/^[a-zA-Z0-9-]+$/.test(agentId)) {
        throw new Error('Invalid agent ID format');
    }

    return agentId;
};

/**
 * Validate share token
 */
const validateShareToken = (token) => {
    if (!token) {
        throw new Error('Share token is required');
    }

    // Token should be hexadecimal
    if (!/^[a-f0-9]+$/.test(token)) {
        throw new Error('Invalid share token format');
    }

    return token;
};

/**
 * Validate password
 */
const validatePassword = (password) => {
    if (!password) {
        throw new Error('Password is required');
    }

    if (password.length < 4) {
        throw new Error('Password must be at least 4 characters long');
    }

    return password;
};

/**
 * Validate username
 */
const validateUsername = (username) => {
    if (!username) {
        throw new Error('Username is required');
    }

    if (username.length < 3) {
        throw new Error('Username must be at least 3 characters long');
    }

    // Username should be alphanumeric with underscores
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        throw new Error('Username can only contain letters, numbers, and underscores');
    }

    return username;
};

/**
 * Sanitize string input
 */
const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;

    // Remove null bytes
    return str.replace(/\0/g, '');
};

/**
 * Validate URL
 */
const validateUrl = (url) => {
    if (!url) {
        throw new Error('URL is required');
    }

    try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error('URL must use HTTP or HTTPS protocol');
        }
        return url;
    } catch (e) {
        throw new Error('Invalid URL format');
    }
};

module.exports = {
    validatePath,
    validateFilename,
    validateAgentId,
    validateShareToken,
    validatePassword,
    validateUsername,
    sanitizeString,
    validateUrl
};
