const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const { copyFileBetweenNodes } = require('./syncRunner');

const activeRulesLocker = new Set();

const extractPathFromInstruction = (instruction) => {
    // 1. Check for quoted paths first (handles spaces)
    const quoteRegex = /(["'])(.*?)\1/;
    const quoteMatch = instruction.match(quoteRegex);
    if (quoteMatch && quoteMatch[2]) return quoteMatch[2];

    // 2. Fall back to standard regexes
    const winRegex = /[a-zA-Z]:[\\/][^,\s]+/;
    const unixRegex = /(?:\/[a-zA-Z0-9_\-\.]+)+/;
    const winMatch = instruction.match(winRegex);
    if (winMatch) return winMatch[0];
    const unixMatch = instruction.match(unixRegex);
    if (unixMatch) return unixMatch[0];
    return null;
};

const executeAICommand = async (commandText, targetNode = 'local') => {
    const logs = [];
    const filesAffected = [];
    
    const log = (msg) => {
        logs.push(`[${new Date().toLocaleTimeString()}] [AI Agent] ${msg}`);
        console.log(`[AI Automator] ${msg}`);
    };

    log(`Received Natural Language instruction: "${commandText}"`);

    // Standardize separators in command
    const commandLower = commandText.toLowerCase();

    // 1. Extract potential path
    const targetPath = extractPathFromInstruction(commandText);
    if (!targetPath) {
        throw new Error('Could not identify a valid target directory path in your command.');
    }

    log(`Target directory resolved: ${targetPath}`);

    if (commandLower.includes('organize') || commandLower.includes('categorize')) {
        log(`Running Smart Directory Organization...`);
        if (!fs.existsSync(targetPath)) {
            throw new Error(`Directory path "${targetPath}" does not exist.`);
        }

        const items = fs.readdirSync(targetPath, { withFileTypes: true });
        const files = items.filter(i => !i.isDirectory());

        log(`Found ${files.length} file(s) to process.`);

        const folders = {
            Images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'],
            Videos: ['.mp4', '.mkv', '.avi', '.mov', '.webm'],
            Documents: ['.pdf', '.doc', '.docx', '.txt', '.md', '.csv', '.xlsx', '.pptx'],
            SourceCode: ['.js', '.jsx', '.ts', '.tsx', '.py', '.go', '.c', '.cpp', '.java', '.html', '.css', '.sh', '.bat'],
            Archives: ['.zip', '.tar', '.gz', '.tar.gz', '.tgz', '.7z', '.rar']
        };

        for (const file of files) {
            const ext = path.extname(file.name).toLowerCase();
            let category = 'Other';
            
            for (const [catName, extensions] of Object.entries(folders)) {
                if (extensions.includes(ext)) {
                    category = catName;
                    break;
                }
            }

            const catDir = path.join(targetPath, category);
            if (!fs.existsSync(catDir)) {
                log(`Creating category directory: ${category}`);
                fs.mkdirSync(catDir, { recursive: true });
            }

            const oldPath = path.join(targetPath, file.name);
            const newPath = path.join(catDir, file.name);
            fs.renameSync(oldPath, newPath);
            log(`Moved: "${file.name}" $\rightarrow$ "${category}/"`);
            filesAffected.push(file.name);
        }

        log(`Smart Organization completed successfully.`);
        return { logs, filesAffected, status: 'Success' };
    }

    if (commandLower.includes('clean') || commandLower.includes('delete') || commandLower.includes('clear')) {
        log(`Running Temporary Logs/Junk Cleaner...`);
        if (!fs.existsSync(targetPath)) {
            throw new Error(`Directory path "${targetPath}" does not exist.`);
        }

        const items = fs.readdirSync(targetPath, { withFileTypes: true });
        const files = items.filter(i => !i.isDirectory());

        let deletedCount = 0;
        for (const file of files) {
            const ext = path.extname(file.name).toLowerCase();
            const nameLower = file.name.toLowerCase();
            
            const isJunk = ext === '.tmp' || ext === '.bak' || ext === '.log' || nameLower.includes('temp') || nameLower.includes('junk');
            if (isJunk) {
                fs.unlinkSync(path.join(targetPath, file.name));
                log(`Deleted junk file: "${file.name}"`);
                filesAffected.push(file.name);
                deletedCount++;
            }
        }

        log(`Junk cleaner completed. Total ${deletedCount} file(s) removed.`);
        return { logs, filesAffected, status: 'Success' };
    }

    if (commandLower.includes('rename') && (commandLower.includes('screenshot') || commandLower.includes('capture'))) {
        log(`Running Screenshot Renaming Optimizer...`);
        if (!fs.existsSync(targetPath)) {
            throw new Error(`Directory path "${targetPath}" does not exist.`);
        }

        const items = fs.readdirSync(targetPath, { withFileTypes: true });
        const files = items.filter(i => !i.isDirectory());

        let renameCount = 0;
        for (const file of files) {
            const nameLower = file.name.toLowerCase();
            if (nameLower.includes('screenshot') || nameLower.includes('screen_shot') || nameLower.includes('capture')) {
                const absPath = path.join(targetPath, file.name);
                const stats = fs.statSync(absPath);
                
                const date = stats.mtime;
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                const formattedDate = `${yyyy}-${mm}-${dd}`;
                
                const ext = path.extname(file.name);
                let counter = 1;
                let newName = `Screenshot-${formattedDate}-${counter}${ext}`;
                while (fs.existsSync(path.join(targetPath, newName))) {
                    counter++;
                    newName = `Screenshot-${formattedDate}-${counter}${ext}`;
                }

                fs.renameSync(absPath, path.join(targetPath, newName));
                log(`Renamed: "${file.name}" $\rightarrow$ "${newName}"`);
                filesAffected.push(newName);
                renameCount++;
            }
        }

        log(`Screenshot renaming completed. Total ${renameCount} file(s) optimized.`);
        return { logs, filesAffected, status: 'Success' };
    }

    if (commandLower.includes('summarize') || commandLower.includes('report') || commandLower.includes('stats')) {
        log(`Conducting folder audit & statistics report...`);
        if (!fs.existsSync(targetPath)) {
            throw new Error(`Directory path "${targetPath}" does not exist.`);
        }

        const walkSync = (dir) => {
            let files = [];
            const list = fs.readdirSync(dir, { withFileTypes: true });
            for (const item of list) {
                const abs = path.join(dir, item.name);
                if (item.isDirectory()) {
                    files = files.concat(walkSync(abs));
                } else {
                    files.push({ absPath: abs, size: fs.statSync(abs).size });
                }
            }
            return files;
        };

        const allFiles = walkSync(targetPath);
        
        let totalSize = 0;
        const extensionMap = {};
        for (const file of allFiles) {
            totalSize += file.size;
            const ext = path.extname(file.absPath).toLowerCase() || 'No Extension';
            extensionMap[ext] = (extensionMap[ext] || 0) + 1;
        }

        const sizeFormatted = (totalSize / 1024 > 1024 ? `${(totalSize / (1024 * 1024)).toFixed(2)} MB` : `${(totalSize / 1024).toFixed(2)} KB`);

        // Generate Markdown report content
        const markdownReport = `# NexaDisk AI Audit: Directory Summary Report

* **Target Folder**: \`${targetPath}\`
* **Scanned Date**: ${new Date().toLocaleString()}
* **Total Size**: \`${sizeFormatted}\` (\`${totalSize} Bytes\`)
* **Total File Count**: \`${allFiles.length}\`

## File Type Distribution
${Object.entries(extensionMap).map(([ext, count]) => `- **${ext}**: ${count} file(s)`).join('\n')}

---
*Generated by NexaDisk AI Workflow Assistant.*
`;

        const reportPath = path.join(targetPath, 'SyncSummary.md');
        fs.writeFileSync(reportPath, markdownReport, 'utf8');
        log(`Report generated successfully: "SyncSummary.md"`);
        filesAffected.push('SyncSummary.md');

        return { logs, filesAffected, status: 'Success' };
    }

    throw new Error('Could not identify a matching AI operation (organize, clean temp files, rename screenshots, folder stats).');
};

const processUploadRules = async (uploadedFilePath) => {
    const parentDir = path.dirname(uploadedFilePath);
    const fileName = path.basename(uploadedFilePath);
    
    db.all("SELECT * FROM ai_rules WHERE active = 1", [], async (err, rules) => {
        if (err || !rules || rules.length === 0) return;

        for (const rule of rules) {
            const ruleDir = path.resolve(rule.triggerFolder);
            const uploadDir = path.resolve(parentDir);

            if (ruleDir.toLowerCase() === uploadDir.toLowerCase()) {
                const targetDir = extractPathFromInstruction(rule.aiInstruction);
                if (!targetDir) continue;

                // Match classification
                const fileExt = path.extname(fileName).toLowerCase();
                const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(fileExt);
                const isDoc = ['.pdf', '.doc', '.docx', '.txt', '.md', '.xlsx', '.pptx', '.csv'].includes(fileExt);
                const isArchive = ['.zip', '.tar', '.gz', '.tar.gz', '.tgz', '.7z', '.rar'].includes(fileExt);
                const isCode = ['.js', '.jsx', '.ts', '.tsx', '.py', '.go', '.c', '.cpp', '.java', '.html', '.css', '.sh', '.bat'].includes(fileExt);

                let match = false;
                const instLower = rule.aiInstruction.toLowerCase();
                if (instLower.includes('image') && isImage) match = true;
                else if (instLower.includes('document') && isDoc) match = true;
                else if (instLower.includes('archive') && isArchive) match = true;
                else if ((instLower.includes('code') || instLower.includes('script')) && isCode) match = true;

                if (match) {
                    const logs = [];
                    logs.push(`[Rule Triggered] Match found for file "${fileName}" in folder "${parentDir}"`);
                    logs.push(`[Action] Moving file to target folder: "${targetDir}"`);
                    
                    try {
                        if (!fs.existsSync(targetDir)) {
                            fs.mkdirSync(targetDir, { recursive: true });
                        }
                        const newPath = path.join(targetDir, fileName);
                        fs.renameSync(uploadedFilePath, newPath);
                        logs.push(`[Success] File successfully organized to "${newPath}"`);
                        
                        db.run(
                            "INSERT INTO ai_logs (ruleId, command, status, logText, filesAffected) VALUES (?, ?, 'Success', ?, ?)",
                            [rule.id, `Trigger rule: ${rule.name}`, logs.join('\n'), JSON.stringify([fileName])]
                        );
                    } catch (e) {
                        logs.push(`[Failed] Error moving file: ${e.message}`);
                        db.run(
                            "INSERT INTO ai_logs (ruleId, command, status, logText) VALUES (?, ?, 'Failed', ?)",
                            [rule.id, `Trigger rule: ${rule.name}`, logs.join('\n')]
                        );
                    }
                }
            }
        }
    });
};

module.exports = {
    executeAICommand,
    processUploadRules
};
