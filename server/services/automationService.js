const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../config/database');
const eventBus = require('../utils/eventBus');
const logger = require('../utils/logger');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Recursively read a directory from the real filesystem */
const readdirReal = (dirPath) => {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.map(e => {
        const fPath = path.join(dirPath, e.name);
        let size = 0;
        try { size = e.isDirectory() ? 0 : fs.statSync(fPath).size; } catch (_) {}
        return { name: e.name, isDirectory: e.isDirectory(), path: fPath, size };
    });
};

/** MD5 hash of a file's content */
const hashFile = (filePath) => {
    try {
        const buf = fs.readFileSync(filePath);
        return crypto.createHash('md5').update(buf).digest('hex');
    } catch (_) { return null; }
};

/** Safely copy file */
const copyFile = (src, dest) => {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, dest);
};

/** Format bytes to human readable */
const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

// ─── AutomationService ────────────────────────────────────────────────────────

class AutomationService {

    async createRule(triggerPath, instructions, actionType = 'organize', schedule = 'on_upload') {
        const res = await db.query(
            'INSERT INTO ai_rules (trigger_path, instructions, action_type, schedule) VALUES ($1, $2, $3, $4) RETURNING id',
            [triggerPath, instructions, actionType, schedule]
        );
        const ruleId = res.rows[0].id;
        logger.info(`[AutomationService] Registered AI rule: "${instructions}" on "${triggerPath}"`);
        return ruleId;
    }

    async getRules() {
        const res = await db.query('SELECT * FROM ai_rules ORDER BY created_at DESC');
        return res.rows;
    }

    async deleteRule(id) {
        await db.query('DELETE FROM ai_rules WHERE id = $1', [id]);
        logger.info(`[AutomationService] Deleted AI rule: ${id}`);
    }

    async getLogs(limit = 50) {
        const res = await db.query('SELECT * FROM ai_logs ORDER BY created_at DESC LIMIT $1', [limit]);
        return res.rows;
    }

    async getStats() {
        const rulesRes = await db.query('SELECT COUNT(*) as total, SUM(CASE WHEN active THEN 1 ELSE 0 END) as active FROM ai_rules');
        const logsRes  = await db.query('SELECT COUNT(*) as runs FROM ai_logs');
        const filesRes = await db.query(`SELECT COALESCE(SUM(jsonb_array_length(files_affected::jsonb)), 0) as total_files FROM ai_logs WHERE files_affected IS NOT NULL AND files_affected != 'null'`);
        return {
            totalRules:  parseInt(rulesRes.rows[0]?.total  || 0),
            activeRules: parseInt(rulesRes.rows[0]?.active || 0),
            totalRuns:   parseInt(logsRes.rows[0]?.runs    || 0),
            totalFiles:  parseInt(filesRes.rows[0]?.total_files || 0)
        };
    }

    async logExecution(ruleId, command, status, logText, filesAffected = []) {
        await db.query(`
            INSERT INTO ai_logs (rule_id, command, status, log_text, files_affected)
            VALUES ($1, $2, $3, $4, $5)
        `, [ruleId || null, command, status, logText, JSON.stringify(filesAffected)]);
        eventBus.publish('AI_WORKFLOW_COMPLETED', { command, status, filesAffected });
    }

    // ─── NATURAL LANGUAGE WORKFLOW ENGINE ─────────────────────────────────────
    async executeInstruction(folderPath, instruction, ruleId = null, dryRun = false) {
        logger.info(`[AutomationService] ${dryRun ? '[DRY-RUN] ' : ''}Executing: "${instruction}" on "${folderPath}"`);

        const modeTag = dryRun ? '[DRY-RUN] ' : '';
        let status = 'Success';
        let logLines = [
            `[START] ${modeTag}Processing instruction: "${instruction}"`,
            `[TARGET] Folder: ${folderPath}`,
            dryRun ? `[INFO] Dry-run mode — no changes will be written to disk.` : `[INFO] Live mode — changes will be applied.`
        ];
        let filesAffected = [];

        try {
            if (!fs.existsSync(folderPath)) {
                throw new Error(`Target folder does not exist: ${folderPath}`);
            }

            const files = readdirReal(folderPath);
            logLines.push(`[SCAN] Found ${files.length} items in directory.`);

            const q = instruction.toLowerCase();

            // ── 1. ORGANIZE / SORT / CLASSIFY ─────────────────────────────────
            if (q.includes('organize') || q.includes('sort') || q.includes('classify')) {
                logLines.push('[PROCESS] Classifying files into category folders...');
                const categories = {
                    Images:     ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp', '.ico', '.heic'],
                    Documents:  ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.rtf', '.md', '.odt'],
                    Archives:   ['.zip', '.tar', '.gz', '.rar', '.7z', '.tgz', '.bz2'],
                    SourceCode: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.html', '.css', '.go', '.sh', '.rs', '.php'],
                    Videos:     ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'],
                    Audio:      ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'],
                    Data:       ['.json', '.xml', '.yaml', '.yml', '.sql', '.db', '.sqlite']
                };

                for (const file of files) {
                    if (file.isDirectory) continue;
                    const ext = path.extname(file.name).toLowerCase();
                    let category = 'Other';
                    for (const [cat, exts] of Object.entries(categories)) {
                        if (exts.includes(ext)) { category = cat; break; }
                    }
                    const dest = path.join(folderPath, category, file.name);
                    logLines.push(`[${dryRun ? 'WOULD MOVE' : 'MOVE'}] ${file.name} → ${category}/`);
                    if (!dryRun) {
                        copyFile(file.path, dest);
                        fs.unlinkSync(file.path);
                    }
                    filesAffected.push(file.name);
                }
                logLines.push(`[COMPLETED] ${filesAffected.length} file(s) ${dryRun ? 'would be' : ''} classified.`);
            }

            // ── 2. CLEAN / REMOVE JUNK ────────────────────────────────────────
            else if (q.includes('clean') || q.includes('junk') || q.includes('temp') || q.includes('remove temp')) {
                logLines.push('[PROCESS] Scanning for temporary and junk files...');
                const junkExts  = ['.tmp', '.bak', '.log', '.old', '.cache', '.swp', '.ds_store', '.thumbs'];
                const junkNames = ['thumbs.db', '.ds_store', 'desktop.ini', 'ehthumbs.db'];

                for (const file of files) {
                    if (file.isDirectory) continue;
                    const ext  = path.extname(file.name).toLowerCase();
                    const name = file.name.toLowerCase();
                    if (junkExts.includes(ext) || junkNames.includes(name)) {
                        logLines.push(`[${dryRun ? 'WOULD DELETE' : 'DELETE'}] ${file.name}`);
                        if (!dryRun) fs.unlinkSync(file.path);
                        filesAffected.push(file.name);
                    }
                }
                logLines.push(`[COMPLETED] ${filesAffected.length} junk file(s) ${dryRun ? 'identified' : 'removed'}.`);
            }

            // ── 3. DEDUPLICATE ────────────────────────────────────────────────
            else if (q.includes('deduplicate') || q.includes('duplicate') || q.includes('remove duplicate')) {
                logLines.push('[PROCESS] Hashing all files to detect duplicates...');
                const seen = new Map();
                let dupCount = 0;

                for (const file of files) {
                    if (file.isDirectory) continue;
                    const hash = hashFile(file.path);
                    if (!hash) continue;

                    if (seen.has(hash)) {
                        const original = seen.get(hash);
                        logLines.push(`[${dryRun ? 'WOULD DELETE' : 'DELETE'}] Duplicate of "${original}": ${file.name}`);
                        if (!dryRun) fs.unlinkSync(file.path);
                        filesAffected.push(file.name);
                        dupCount++;
                    } else {
                        seen.set(hash, file.name);
                        logLines.push(`[KEEP] Unique: ${file.name}`);
                    }
                }
                logLines.push(`[COMPLETED] ${dupCount} duplicate(s) ${dryRun ? 'found' : 'removed'}. ${seen.size} unique file(s) kept.`);
            }

            // ── 4. COMPRESS / ZIP OLD FILES ───────────────────────────────────
            else if (q.includes('compress') || q.includes('zip old') || q.includes('archive old')) {
                logLines.push('[PROCESS] Compressing old files (older than 30 days)...');
                const AdmZip = require('adm-zip');
                const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
                const toZip  = [];

                for (const file of files) {
                    if (file.isDirectory) continue;
                    try {
                        const mtime = fs.statSync(file.path).mtimeMs;
                        if (mtime < cutoff) {
                            toZip.push(file);
                            logLines.push(`[INCLUDE] ${file.name} (old file)`);
                        } else {
                            logLines.push(`[SKIP] ${file.name} (recent, skipped)`);
                        }
                    } catch (_) {}
                }

                if (toZip.length > 0) {
                    const zipName = `archive-${new Date().toISOString().slice(0, 10)}.zip`;
                    const zipPath = path.join(folderPath, zipName);
                    logLines.push(`[${dryRun ? 'WOULD CREATE' : 'CREATE'}] Archive: ${zipName} (${toZip.length} files)`);
                    if (!dryRun) {
                        const zip = new AdmZip();
                        for (const f of toZip) {
                            zip.addLocalFile(f.path);
                            fs.unlinkSync(f.path);
                        }
                        zip.writeZip(zipPath);
                    }
                    filesAffected = toZip.map(f => f.name);
                    filesAffected.push(zipName);
                }
                logLines.push(`[COMPLETED] ${toZip.length} file(s) ${dryRun ? 'would be archived' : 'archived'}.`);
            }

            // ── 5. TAG / LABEL FILES ──────────────────────────────────────────
            else if (q.includes('tag') || q.includes('label') || q.includes('prefix')) {
                logLines.push('[PROCESS] Adding type-prefix labels to files...');
                const typeMap = {
                    img:  ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic', '.svg'],
                    doc:  ['.pdf', '.doc', '.docx', '.txt', '.md', '.xls', '.xlsx', '.ppt', '.pptx'],
                    vid:  ['.mp4', '.mkv', '.avi', '.mov', '.wmv'],
                    aud:  ['.mp3', '.wav', '.m4a', '.flac', '.ogg', '.aac'],
                    arc:  ['.zip', '.tar', '.gz', '.rar', '.7z'],
                    code: ['.js', '.ts', '.py', '.java', '.html', '.css', '.go', '.sh'],
                    data: ['.json', '.xml', '.yaml', '.yml', '.csv', '.sql']
                };

                for (const file of files) {
                    if (file.isDirectory) continue;
                    const ext = path.extname(file.name).toLowerCase();
                    let tag = 'misc';
                    for (const [t, exts] of Object.entries(typeMap)) {
                        if (exts.includes(ext)) { tag = t; break; }
                    }
                    if (!file.name.startsWith(`[${tag}]`)) {
                        const newName = `[${tag}] ${file.name}`;
                        const dest    = path.join(folderPath, newName);
                        logLines.push(`[${dryRun ? 'WOULD RENAME' : 'RENAME'}] ${file.name} → ${newName}`);
                        if (!dryRun) fs.renameSync(file.path, dest);
                        filesAffected.push(file.name);
                    } else {
                        logLines.push(`[SKIP] ${file.name} (already tagged)`);
                    }
                }
                logLines.push(`[COMPLETED] ${filesAffected.length} file(s) ${dryRun ? 'would be' : ''} tagged.`);
            }

            // ── 6. FLATTEN / COLLAPSE SUBFOLDERS ─────────────────────────────
            else if (q.includes('flatten') || q.includes('collapse') || q.includes('move all to root')) {
                logLines.push('[PROCESS] Flattening nested subdirectories to root...');

                const collectRecursive = (dir, rootDir) => {
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    for (const e of entries) {
                        const full = path.join(dir, e.name);
                        if (e.isDirectory()) {
                            collectRecursive(full, rootDir);
                        } else if (dir !== rootDir) {
                            const dest = path.join(rootDir, e.name);
                            const finalDest = fs.existsSync(dest)
                                ? path.join(rootDir, `${path.basename(e.name, path.extname(e.name))}_${Date.now()}${path.extname(e.name)}`)
                                : dest;
                            logLines.push(`[${dryRun ? 'WOULD MOVE' : 'MOVE'}] ${path.relative(rootDir, full)} → root/`);
                            if (!dryRun) {
                                fs.renameSync(full, finalDest);
                            }
                            filesAffected.push(e.name);
                        }
                    }
                };

                collectRecursive(folderPath, folderPath);

                // Remove empty subdirs
                if (!dryRun) {
                    const subdirs = files.filter(f => f.isDirectory);
                    for (const d of subdirs) {
                        try {
                            const remaining = fs.readdirSync(d.path);
                            if (remaining.length === 0) fs.rmdirSync(d.path);
                        } catch (_) {}
                    }
                }
                logLines.push(`[COMPLETED] ${filesAffected.length} file(s) ${dryRun ? 'would be' : ''} moved to root.`);
            }

            // ── 7. FIND LARGE FILES ───────────────────────────────────────────
            else if (q.includes('find large') || q.includes('find big') || q.includes('large files') || q.includes('big files')) {
                logLines.push('[PROCESS] Scanning for large files (> 50 MB)...');
                const thresholdBytes = 50 * 1024 * 1024; // 50 MB
                const largeFiles = [];

                for (const file of files) {
                    if (!file.isDirectory && file.size > thresholdBytes) {
                        largeFiles.push(file);
                        logLines.push(`[FOUND] ${file.name} — ${formatBytes(file.size)}`);
                        filesAffected.push(`${file.name} (${formatBytes(file.size)})`);
                    }
                }

                if (largeFiles.length === 0) {
                    logLines.push('[INFO] No files exceeding 50 MB found in this directory.');
                }

                // Write a report
                if (!dryRun && largeFiles.length > 0) {
                    const reportPath = path.join(folderPath, 'LargeFiles-Report.md');
                    const reportLines = [
                        `# Large Files Report\n`,
                        `Generated: ${new Date().toLocaleString()}\n`,
                        `Folder: \`${folderPath}\`\n`,
                        `Threshold: 50 MB\n\n`,
                        `| File | Size |`,
                        `|---|---|`,
                        ...largeFiles.map(f => `| ${f.name} | ${formatBytes(f.size)} |`)
                    ];
                    fs.writeFileSync(reportPath, reportLines.join('\n'));
                    logLines.push(`[REPORT] Saved: LargeFiles-Report.md`);
                }
                logLines.push(`[COMPLETED] ${largeFiles.length} large file(s) found.`);
            }

            // ── 8. REPORT / SUMMARIZE ─────────────────────────────────────────
            else if (q.includes('report') || q.includes('summarize') || q.includes('inventory') || q.includes('summary')) {
                logLines.push('[PROCESS] Generating folder inventory report...');
                const filesByType = {};
                let totalSize = 0;

                for (const file of files) {
                    if (file.isDirectory) continue;
                    const ext = path.extname(file.name).toLowerCase() || '(no extension)';
                    if (!filesByType[ext]) filesByType[ext] = { count: 0, size: 0 };
                    filesByType[ext].count++;
                    filesByType[ext].size += file.size;
                    totalSize += file.size;
                    filesAffected.push(file.name);
                }

                const sortedTypes = Object.entries(filesByType).sort((a, b) => b[1].count - a[1].count);

                logLines.push(`[INFO] Total files: ${filesAffected.length}, Total size: ${formatBytes(totalSize)}`);
                for (const [ext, data] of sortedTypes) {
                    logLines.push(`[TYPE] ${ext}: ${data.count} file(s), ${formatBytes(data.size)}`);
                }

                if (!dryRun) {
                    const reportPath = path.join(folderPath, 'FolderInventory.md');
                    const rows = sortedTypes.map(([ext, d]) => `| ${ext} | ${d.count} | ${formatBytes(d.size)} |`);
                    const reportContent = [
                        `# Folder Inventory Report`,
                        `\nGenerated: ${new Date().toLocaleString()}`,
                        `\nFolder: \`${folderPath}\``,
                        `\n**Total:** ${filesAffected.length} files • ${formatBytes(totalSize)}\n`,
                        `| Extension | Count | Size |`,
                        `|---|---|---|`,
                        ...rows
                    ].join('\n');
                    fs.writeFileSync(reportPath, reportContent);
                    logLines.push(`[REPORT] Saved inventory to: FolderInventory.md`);
                    filesAffected.push('FolderInventory.md');
                }
                logLines.push(`[COMPLETED] Inventory report generated.`);
            }

            // ── 9. RENAME SCREENSHOTS ─────────────────────────────────────────
            else if (q.includes('screenshot') || q.includes('rename image') || q.includes('rename screenshots')) {
                logLines.push('[PROCESS] Locating and renaming screenshot files...');
                let counter = 1;
                for (const file of files) {
                    if (file.isDirectory) continue;
                    const nameLower = file.name.toLowerCase();
                    if (nameLower.includes('screenshot') || nameLower.includes('screen_shot') || nameLower.startsWith('capture')) {
                        const ext = path.extname(file.name).toLowerCase();
                        const dateStr = new Date().toISOString().slice(0, 10);
                        const newName = `Screenshot-${dateStr}-${String(counter).padStart(3, '0')}${ext}`;
                        const dest = path.join(folderPath, newName);
                        logLines.push(`[${dryRun ? 'WOULD RENAME' : 'RENAME'}] ${file.name} → ${newName}`);
                        if (!dryRun) fs.renameSync(file.path, dest);
                        filesAffected.push(file.name);
                        counter++;
                    }
                }
                logLines.push(`[COMPLETED] ${filesAffected.length} screenshot(s) ${dryRun ? 'would be' : ''} renamed.`);
            }

            // ── FALLBACK ──────────────────────────────────────────────────────
            else {
                logLines.push(`[WARN] Instruction not recognized. Available actions:`);
                logLines.push(`  • organize / sort / classify — move files into type folders`);
                logLines.push(`  • clean / remove temp — delete junk and temp files`);
                logLines.push(`  • deduplicate — remove exact duplicate files`);
                logLines.push(`  • compress / zip old — archive old files into a zip`);
                logLines.push(`  • tag / label — prefix-rename files by type`);
                logLines.push(`  • flatten — collapse nested subfolders to root`);
                logLines.push(`  • find large / find big — list files over 50 MB`);
                logLines.push(`  • report / summarize — generate Markdown inventory`);
                logLines.push(`  • rename screenshots — rename screenshot files with date`);
            }

        } catch (err) {
            status = 'Failed';
            logLines.push(`[ERROR] Execution halted: ${err.message}`);
            logger.error(`[AutomationService] Instruction run failed: ${err.message}`, err);
        } finally {
            await this.logExecution(ruleId, `${dryRun ? '[DRY-RUN] ' : ''}${instruction}`, status, logLines.join('\n'), filesAffected);
        }

        return { status, logs: logLines, filesAffected };
    }

    // ── POST-UPLOAD TRIGGER ────────────────────────────────────────────────────
    async processUploadRules(filePath) {
        const dir = path.dirname(filePath);
        try {
            const rules = await this.getRules();
            for (const rule of rules) {
                const normalizedRule = path.normalize(rule.trigger_path).toLowerCase();
                const normalizedDir  = path.normalize(dir).toLowerCase();
                if (normalizedRule === normalizedDir && rule.active) {
                    logger.info(`[AutomationService] Post-upload trigger matched rule ${rule.id} on "${dir}"`);
                    setImmediate(() => this.executeInstruction(dir, rule.instructions, rule.id, false));
                }
            }
        } catch (err) {
            logger.error(`[AutomationService] Post-upload rule matching failed: ${err.message}`, err);
        }
    }
}

const automationService = new AutomationService();
module.exports = automationService;
