// YaraService - CLI-based YARA scanner (no native npm bindings required)
// Calls the 'yara' command-line tool if installed, gracefully skips if not.
// Place YARA rule files (*.yar / *.yara) in the `rules/` directory at project root.

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const execAsync = promisify(exec);

const RULES_DIR = path.join(__dirname, '..', '..', 'rules');
const YARA_TIMEOUT_MS = 15000;

class YaraService {
    constructor() {
        this._available = null; // null = not checked yet
    }

    /** Check if the `yara` CLI binary is on PATH */
    async _checkAvailable() {
        if (this._available !== null) return this._available;
        try {
            await execAsync('yara --version', { timeout: 3000 });
            this._available = true;
            logger.info('[YaraService] yara CLI found — scanning enabled.');
        } catch {
            this._available = false;
            logger.warn('[YaraService] yara CLI not found — YARA scanning disabled (install yara-tools to enable).');
        }
        return this._available;
    }

    /** Load .yar / .yara rule files from the rules directory */
    _getRuleFiles() {
        try {
            if (!fs.existsSync(RULES_DIR)) return [];
            return fs.readdirSync(RULES_DIR)
                .filter(f => f.endsWith('.yar') || f.endsWith('.yara'))
                .map(f => path.join(RULES_DIR, f));
        } catch (err) {
            logger.error(`[YaraService] Could not read rules dir: ${err.message}`);
            return [];
        }
    }

    /**
     * Scan a file against all YARA rules.
     * @param {string} filePath Absolute path to the file to scan.
     * @returns {Promise<{ matches: Array, error: string|null }>}
     */
    async scanFile(filePath) {
        const available = await this._checkAvailable();
        if (!available) {
            return { matches: [], error: null }; // graceful no-op
        }

        const ruleFiles = this._getRuleFiles();
        if (ruleFiles.length === 0) {
            return { matches: [], error: null }; // no rules, nothing to do
        }

        const allMatches = [];

        for (const ruleFile of ruleFiles) {
            try {
                // yara <rule-file> <target-file>  →  prints matching rule names
                const { stdout } = await execAsync(
                    `yara "${ruleFile}" "${filePath}"`,
                    { timeout: YARA_TIMEOUT_MS }
                );

                if (stdout && stdout.trim().length > 0) {
                    // Each line: "<RuleName> <filePath>"
                    const lines = stdout.trim().split('\n');
                    for (const line of lines) {
                        const parts = line.trim().split(/\s+/);
                        if (parts[0]) {
                            allMatches.push({
                                rule: parts[0],
                                ruleFile: path.basename(ruleFile),
                                file: filePath
                            });
                        }
                    }
                }
            } catch (err) {
                // Exit code 1 just means "no match" for some yara versions — only log actual errors
                if (err.code !== 1) {
                    logger.warn(`[YaraService] Error scanning with ${path.basename(ruleFile)}: ${err.message}`);
                }
            }
        }

        return { matches: allMatches, error: null };
    }
}

module.exports = new YaraService();
