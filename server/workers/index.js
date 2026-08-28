const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const AdmZip = require('adm-zip');
const db = require('../config/database');
const taskQueue = require('../utils/taskQueue');
const clusterService = require('../services/clusterService');
const syncService = require('../services/syncService');
const logger = require('../utils/logger');

// Set to track active sync tasks and avoid overlapping runs
const activeSyncs = new Set();

// Helper to sanitize media names during sync
function sanitizeMediaName(filename) {
    if (!filename) return filename;
    const ext = path.extname(filename);
    const name = path.basename(filename, ext);
    
    // Movie pattern: Titanic (1997)
    const yearMatch = name.match(/^(.*?)[(\[]?((?:19|20)\d{2})[)\]]?/i);
    if (yearMatch) {
        let title = yearMatch[1].trim();
        title = title.replace(/[._-]/g, ' ').replace(/\s+/g, ' ');
        title = title.replace(/^[-._\s]+/, '').replace(/[-._\s]+$/, '');
        return `${title} (${yearMatch[2]})${ext}`;
    }

    // TV Show pattern: Show.S01E01
    const showMatch = name.match(/^(.*?)[. _-](S\d{2}E\d{2})/i);
    if (showMatch) {
        let title = showMatch[1].trim();
        title = title.replace(/[._-]/g, ' ').replace(/\s+/g, ' ');
        title = title.replace(/^[-._\s]+/, '').replace(/[-._\s]+$/, '');
        return `${title} ${showMatch[2].toUpperCase()}${ext}`;
    }

    let cleaned = name.replace(/[._-]/g, ' ').replace(/\s+/g, ' ');
    cleaned = cleaned.replace(/^[-._\s]+/, '').replace(/[-._\s]+$/, '');
    return `${cleaned}${ext}`;
}

const sanitizeRelPath = (relPath) => {
    const parts = relPath.replace(/\\/g, '/').split('/');
    const filename = parts.pop();
    const sanitizedFilename = sanitizeMediaName(filename);
    parts.push(sanitizedFilename);
    return parts.join('/');
};

const getNodeSeparator = (node) => {
    if (!node || node === 'local') {
        return process.platform === 'win32' ? '\\' : '/';
    }
    const agent = clusterService.agents[node];
    if (agent && agent.platform === 'win32') {
        return '\\';
    }
    return '/';
};

const getRelativePath = (basePath, filePath) => {
    const base = basePath.replace(/\\/g, '/').replace(/\/$/, '');
    const file = filePath.replace(/\\/g, '/');
    if (file.startsWith(base)) {
        return file.slice(base.length).replace(/^\//, '');
    }
    return file;
};

const joinPathsForNode = (node, basePath, relPath) => {
    const sep = getNodeSeparator(node);
    const cleanBase = basePath.replace(/[/\\]/g, sep);
    const cleanRel = relPath.replace(/[/\\]/g, sep);
    if (cleanBase.endsWith(sep)) {
        return cleanBase + cleanRel;
    }
    return cleanBase + sep + cleanRel;
};

const getParentDirForNode = (node, filePath) => {
    const sep = getNodeSeparator(node);
    const parts = filePath.split(sep);
    if (parts.length <= 1) return filePath;
    return parts.slice(0, -1).join(sep);
};

const ensureDirExistsOnNode = async (node, dirPath) => {
    const isLocal = !node || node === 'local';
    if (isLocal) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    } else {
        const agent = clusterService.agents[node];
        if (!agent) throw new Error(`Agent ${node} not found or offline`);
        await axios.post(`${agent.url}/api/v1/files/mkdir`, {
            path: dirPath
        });
    }
};

const deleteFileOnNode = async (node, filePath) => {
    const isLocal = !node || node === 'local';
    if (isLocal) {
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
                fs.rmSync(filePath, { recursive: true, force: true });
            } else {
                fs.unlinkSync(filePath);
            }
        }
    } else {
        const agent = clusterService.agents[node];
        if (!agent) throw new Error(`Agent ${node} not found or offline`);
        await axios.delete(`${agent.url}/api/v1/files/delete`, { data: { path: filePath } });
    }
};

const scanDirectory = async (node, dirPath) => {
    const isLocal = !node || node === 'local';

    if (isLocal) {
        const results = [];
        const walk = (currentPath) => {
            const items = fs.readdirSync(currentPath, { withFileTypes: true });
            for (const item of items) {
                const fullPath = path.join(currentPath, item.name);
                if (item.isDirectory()) {
                    walk(fullPath);
                } else {
                    const stats = fs.statSync(fullPath);
                    results.push({
                        relPath: getRelativePath(dirPath, fullPath),
                        absPath: fullPath,
                        size: stats.size,
                        modified: stats.mtime.getTime(),
                        isDirectory: false
                    });
                }
            }
        };
        try {
            if (fs.existsSync(dirPath)) {
                walk(dirPath);
            }
        } catch (e) {
            logger.error(`[Sync Worker] Scan local path ${dirPath} failed: ${e.message}`);
        }
        return results;
    } else {
        const agent = clusterService.agents[node];
        if (!agent) throw new Error(`Agent Node ${node} not found or offline`);
        
        const results = [];
        const walk = async (currentPath) => {
            const resp = await axios.get(`${agent.url}/api/v1/files/list?path=${encodeURIComponent(currentPath)}`);
            const items = resp.data;
            for (const item of items) {
                if (item.isDirectory) {
                    await walk(item.path || path.join(currentPath, item.name));
                } else {
                    results.push({
                        relPath: getRelativePath(dirPath, item.path || path.join(currentPath, item.name)),
                        absPath: item.path || path.join(currentPath, item.name),
                        size: item.size,
                        modified: new Date(item.modified).getTime(),
                        isDirectory: false
                    });
                }
            }
        };
        await walk(dirPath);
        return results;
    }
};

const copyFileBetweenNodes = async (srcNode, srcPath, destNode, destPath, mtime) => {
    const srcIsLocal = !srcNode || srcNode === 'local';
    const destIsLocal = !destNode || destNode === 'local';
    let bytes = 0;

    if (srcIsLocal && destIsLocal) {
        fs.copyFileSync(srcPath, destPath);
        const stats = fs.statSync(srcPath);
        bytes = stats.size;
    } else if (srcIsLocal && !destIsLocal) {
        const targetAgent = clusterService.agents[destNode];
        if (!targetAgent) throw new Error(`Destination Agent ${destNode} not found or offline`);

        const form = new FormData();
        form.append('files', fs.createReadStream(srcPath), path.basename(destPath));

        const targetDir = getParentDirForNode(destNode, destPath);
        const uploadUrl = `${targetAgent.url}/api/v1/files/upload?path=${encodeURIComponent(targetDir)}`;
        await axios.post(uploadUrl, form, {
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        const stats = fs.statSync(srcPath);
        bytes = stats.size;
    } else if (!srcIsLocal && destIsLocal) {
        const sourceAgent = clusterService.agents[srcNode];
        if (!sourceAgent) throw new Error(`Source Agent ${srcNode} not found or offline`);

        const downloadUrl = `${sourceAgent.url}/api/v1/files/download?path=${encodeURIComponent(srcPath)}`;
        const response = await axios({
            method: 'get',
            url: downloadUrl,
            responseType: 'stream'
        });

        bytes = await new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(destPath);
            let totalBytes = 0;
            response.data.on('data', chunk => totalBytes += chunk.length);
            response.data.pipe(writer);
            writer.on('finish', () => resolve(totalBytes));
            writer.on('error', reject);
        });
    } else if (!srcIsLocal && !destIsLocal) {
        const sourceAgent = clusterService.agents[srcNode];
        const targetAgent = clusterService.agents[destNode];
        if (!sourceAgent) throw new Error(`Source Agent ${srcNode} not found or offline`);
        if (!targetAgent) throw new Error(`Destination Agent ${destNode} not found or offline`);

        const downloadUrl = `${sourceAgent.url}/api/v1/files/download?path=${encodeURIComponent(srcPath)}`;
        const downloadResponse = await axios({
            method: 'get',
            url: downloadUrl,
            responseType: 'stream'
        });

        const form = new FormData();
        form.append('files', downloadResponse.data, path.basename(destPath));

        const targetDir = getParentDirForNode(destNode, destPath);
        const uploadUrl = `${targetAgent.url}/api/v1/files/upload?path=${encodeURIComponent(targetDir)}`;
        await axios.post(uploadUrl, form, {
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        const contentLength = parseInt(downloadResponse.headers['content-length'] || '0', 10);
        bytes = contentLength;
    }

    // Preserve modified time (mtime) on destination file
    if (mtime) {
        if (destIsLocal) {
            try {
                const date = new Date(mtime);
                fs.utimesSync(destPath, date, date);
            } catch (err) {
                logger.warn(`[Sync Worker] Failed to set utimes on local destination: ${err.message}`);
            }
        } else {
            const targetAgent = clusterService.agents[destNode];
            if (targetAgent) {
                try {
                    await axios.post(`${targetAgent.url}/api/v1/files/utimes`, {
                        path: destPath,
                        mtime
                    });
                } catch (err) {
                    logger.warn(`[Sync Worker] Failed to set utimes on remote agent destination: ${err.message}`);
                }
            }
        }
    }

    return bytes;
};

// ─── INITIALIZE WORKERS ──────────────────────────────────────────────────────
function initWorkers() {
    logger.info('[Workers] Registering queue processors...');

    // 1. Register File-Worker Queue
    taskQueue.processQueue('file-worker', async (job) => {
        const { name, data } = job;
        
        if (name === 'zip_directory') {
            const { sourcePath, tempZipPath } = data;
            logger.info(`[File Worker] Zipping path: "${sourcePath}" -> "${tempZipPath}"`);
            
            if (!fs.existsSync(sourcePath)) {
                throw new Error(`Directory ${sourcePath} does not exist`);
            }

            const zip = new AdmZip();
            zip.addLocalFolder(sourcePath);
            await zip.writeZipPromise(tempZipPath);
            return { status: 'Success', tempZipPath };
        }

        throw new Error(`Unknown job type in file-worker queue: ${name}`);
    });

    // 2. Register Sync-Worker Queue
    taskQueue.processQueue('sync-worker', async (job) => {
        const { name, data } = job;

        if (name === 'run_sync_job') {
            const { taskId } = data;
            if (activeSyncs.has(taskId)) {
                logger.warn(`[Sync Worker] Sync task ${taskId} is already running. Skipping.`);
                return { status: 'Skipped', message: 'Already running' };
            }

            activeSyncs.add(taskId);
            let filesCopied = 0;
            let bytesTransferred = 0;
            let errors = [];

            try {
                // Fetch latest details from PostgreSQL
                const task = await syncService.getSyncTaskById(taskId);
                if (!task) throw new Error(`Sync task not found in database: ${taskId}`);

                logger.info(`[Sync Worker] Starting sync execution: "${task.name}"`);

                const sourceFiles = await scanDirectory(task.source_node, task.source_path);
                const destFiles = await scanDirectory(task.dest_node, task.dest_path);

                const destFilesMap = new Map(destFiles.map(f => [f.relPath, f]));

                const filesToCopy = [];
                for (const srcFile of sourceFiles) {
                    const targetRelPath = task.sanitize_media ? sanitizeRelPath(srcFile.relPath) : srcFile.relPath;
                    const destFile = destFilesMap.get(targetRelPath);
                    if (!destFile || srcFile.size !== destFile.size || Math.abs(srcFile.modified - destFile.modified) > 2000) {
                        filesToCopy.push(srcFile);
                    }
                }

                const filesToDelete = [];
                if (task.mode === 'mirror') {
                    const sourceFilesSet = new Set(
                        task.sanitize_media 
                            ? sourceFiles.map(f => sanitizeRelPath(f.relPath)) 
                            : sourceFiles.map(f => f.relPath)
                    );
                    for (const destFile of destFiles) {
                        if (!sourceFilesSet.has(destFile.relPath)) {
                            filesToDelete.push(destFile);
                        }
                    }
                }

                // A. Delete extra files if mirror mode
                for (const delFile of filesToDelete) {
                    try {
                        await deleteFileOnNode(task.dest_node, delFile.absPath);
                    } catch (delErr) {
                        errors.push(`Delete error: ${delFile.relPath} -> ${delErr.message}`);
                    }
                }

                // B. Copy new/updated files
                for (const copyFile of filesToCopy) {
                    try {
                        const targetRelPath = task.sanitize_media ? sanitizeRelPath(copyFile.relPath) : copyFile.relPath;
                        const targetPath = joinPathsForNode(task.dest_node, task.dest_path, targetRelPath);
                        await ensureDirExistsOnNode(task.dest_node, getParentDirForNode(task.dest_node, targetPath));
                        
                        const bytes = await copyFileBetweenNodes(task.source_node, copyFile.absPath, task.dest_node, targetPath, copyFile.modified);
                        filesCopied++;
                        bytesTransferred += bytes;
                    } catch (copyErr) {
                        errors.push(`Copy error: ${copyFile.relPath} -> ${copyErr.message}`);
                    }
                }

                const status = errors.length === 0 ? 'Success' : 'Failed';
                const errorStr = errors.length > 0 ? errors.join('\n') : null;

                // Log outcome to PG database
                await syncService.logHistory(taskId, status, filesCopied, bytesTransferred, errorStr);

                // Update sync task table status
                await db.query(
                    'UPDATE sync_tasks SET last_run = CURRENT_TIMESTAMP, last_status = $2 WHERE id = $1',
                    [taskId, status]
                );

                return { status, filesCopied, bytesTransferred, errors: errorStr };
            } catch (err) {
                logger.error(`[Sync Worker] Sync task ${taskId} crashed: ${err.message}`, err);
                await syncService.logHistory(taskId, 'Failed', 0, 0, err.message);
                await db.query(
                    'UPDATE sync_tasks SET last_run = CURRENT_TIMESTAMP, last_status = $2 WHERE id = $1',
                    [taskId, 'Failed']
                );
                throw err;
            } finally {
                activeSyncs.delete(taskId);
            }
        }

        throw new Error(`Unknown job type in sync-worker queue: ${name}`);
    });
}

module.exports = {
    initWorkers
};
