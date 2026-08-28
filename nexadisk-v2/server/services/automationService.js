const path = require('path');
const db = require('../config/database');
const storageProvider = require('../utils/storageProvider');
const eventBus = require('../utils/eventBus');
const logger = require('../utils/logger');

class AutomationService {
    async createRule(triggerPath, instructions, actionType = 'organize') {
        const res = await db.query(
            'INSERT INTO ai_rules (trigger_path, instructions, action_type) VALUES ($1, $2, $3) RETURNING id',
            [triggerPath, instructions, actionType]
        );
        const ruleId = res.rows[0].id;
        logger.info(`[AutomationService] Registered AI rule: ${instructions} on "${triggerPath}"`);
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

    async logExecution(ruleId, command, status, logText, filesAffected = []) {
        await db.query(`
            INSERT INTO ai_logs (rule_id, command, status, log_text, files_affected)
            VALUES ($1, $2, $3, $4, $5)
        `, [ruleId || null, command, status, logText, JSON.stringify(filesAffected)]);

        eventBus.publish('AI_WORKFLOW_COMPLETED', { command, status, filesAffected });
    }

    // ─── NATURAL LANGUAGE WORKFLOW IMPLEMENTATION ────────────────────────────
    async executeInstruction(folderPath, instruction, ruleId = null) {
        logger.info(`[AutomationService] Executing instruction: "${instruction}" on folder "${folderPath}"`);
        
        let status = 'Success';
        let logLines = [`[START] Processing workflow instruction: "${instruction}"`, `[TARGET] Folder: ${folderPath}`];
        let filesAffected = [];

        try {
            const exists = await storageProvider.exists(folderPath);
            if (!exists) {
                throw new Error('Target folder does not exist on disk');
            }

            const files = await storageProvider.readdir(folderPath);
            logLines.push(`[SCAN] Identified ${files.length} items inside directory.`);

            const queryLower = instruction.toLowerCase();

            // 1. ORGANIZATION INSTRUCTION
            if (queryLower.includes('organize') || queryLower.includes('sort') || queryLower.includes('classify')) {
                logLines.push('[PROCESS] Classifying files into standard category folders...');
                
                const categories = {
                    Images: ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp'],
                    Documents: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.rtf', '.md'],
                    Archives: ['.zip', '.tar', '.gz', '.tar.gz', '.rar', '.7z', '.tgz'],
                    SourceCode: ['.js', '.ts', '.py', '.java', '.c', '.cpp', '.h', '.html', '.css', '.go', '.sh'],
                    Videos: ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv'],
                    Audio: ['.mp3', '.wav', '.ogg', '.m4a', '.flac']
                };

                for (const file of files) {
                    if (file.isDirectory) continue;
                    const ext = path.extname(file.name).toLowerCase();
                    let category = 'Other';

                    for (const [catName, extensions] of Object.entries(categories)) {
                        if (extensions.includes(ext)) {
                            category = catName;
                            break;
                        }
                    }

                    const catFolder = path.join(folderPath, category);
                    const sourceFile = path.join(folderPath, file.name);
                    const destFile = path.join(catFolder, file.name);

                    // Ensure category folder exists
                    await storageProvider.mkdir(catFolder);
                    
                    // Relocate file
                    logger.info(`[AI Organize] Relocating ${file.name} -> ${category}/`);
                    await storageProvider.writeStream(destFile, storageProvider.readStream(sourceFile));
                    await storageProvider.delete(sourceFile);

                    filesAffected.push(file.name);
                    logLines.push(`[MOVE] Relocated ${file.name} to target folder: ${category}`);
                }
                logLines.push(`[COMPLETED] Successfully classified ${filesAffected.length} files.`);
            }
            
            // 2. CLEANUP TEMPORARY FILES
            else if (queryLower.includes('clean') || queryLower.includes('remove junk') || queryLower.includes('delete temp')) {
                logLines.push('[PROCESS] Scanning for temporary junk files (.tmp, .log, .bak)...');
                const junkExts = ['.tmp', '.bak', '.log'];

                for (const file of files) {
                    if (file.isDirectory) continue;
                    const ext = path.extname(file.name).toLowerCase();

                    if (junkExts.includes(ext)) {
                        const target = path.join(folderPath, file.name);
                        logger.info(`[AI Cleanup] Deleting temporary junk file: ${file.name}`);
                        await storageProvider.delete(target);
                        filesAffected.push(file.name);
                        logLines.push(`[DELETE] Deleted temporary file: ${file.name}`);
                    }
                }
                logLines.push(`[COMPLETED] Successfully cleaned up ${filesAffected.length} temporary files.`);
            }

            // 3. RENAME SCREENSHOTS
            else if (queryLower.includes('screenshot') || queryLower.includes('rename image')) {
                logLines.push('[PROCESS] Identifying and renaming screenshot files...');
                let counter = 1;

                for (const file of files) {
                    if (file.isDirectory) continue;
                    const nameLower = file.name.toLowerCase();

                    if (nameLower.includes('screenshot') || nameLower.includes('screen_shot') || nameLower.startsWith('capture')) {
                        const ext = path.extname(file.name).toLowerCase();
                        const dateStr = new Date().toISOString().slice(0, 10);
                        const newName = `Screenshot-${dateStr}-${counter}${ext}`;
                        
                        const source = path.join(folderPath, file.name);
                        const dest = path.join(folderPath, newName);

                        logger.info(`[AI Rename] Renaming ${file.name} -> ${newName}`);
                        await storageProvider.writeStream(dest, storageProvider.readStream(source));
                        await storageProvider.delete(source);

                        filesAffected.push(file.name);
                        logLines.push(`[RENAME] Converted: "${file.name}" to: "${newName}"`);
                        counter++;
                    }
                }
                logLines.push(`[COMPLETED] Successfully processed and renamed ${filesAffected.length} screenshot files.`);
            }
            
            // Unknown instruction fallback
            else {
                logLines.push(`[WARN] Unrecognized instruction query. Writing summary report to folder...`);
                const summaryFile = path.join(folderPath, 'WorkflowSummary.md');
                const content = `# NexaDisk Workflow Report\n\nExecuted instruction: "${instruction}" on ${new Date().toLocaleString()}.\n\n*   No active operations were mapped to this instruction keyword.`;
                
                const Readable = require('stream').Readable;
                const s = new Readable();
                s.push(content);
                s.push(null);
                await storageProvider.writeStream(summaryFile, s, 'text/markdown');
                filesAffected.push('WorkflowSummary.md');
            }
        } catch (err) {
            status = 'Failed';
            logLines.push(`[ERROR] Execution halted: ${err.message}`);
            logger.error(`[AutomationService] Instruction run failed: ${err.message}`, err);
        } finally {
            await this.logExecution(ruleId, instruction, status, logLines.join('\n'), filesAffected);
        }
    }

    // Trigger hooks evaluated after new uploads complete
    async processUploadRules(filePath) {
        const dir = path.dirname(filePath);
        try {
            const rules = await this.getRules();
            for (const rule of rules) {
                const normalizedRulePath = path.normalize(rule.trigger_path).toLowerCase();
                const normalizedDirPath = path.normalize(dir).toLowerCase();
                
                if (normalizedRulePath === normalizedDirPath && rule.active) {
                    logger.info(`[AutomationService] Post-upload trigger matched rule: ${rule.id} on folder "${dir}"`);
                    // Trigger asynchronous execution
                    setImmediate(() => this.executeInstruction(dir, rule.instructions, rule.id));
                }
            }
        } catch (err) {
            logger.error(`[AutomationService] Post-upload rule matching failed: ${err.message}`, err);
        }
    }
}

const automationService = new AutomationService();
module.exports = automationService;
