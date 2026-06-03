const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const db = require('../config/database');
const { agents } = require('../config/sharedState');

const activeSyncs = new Set();

const getNodeSeparator = (node) => {
    if (!node || node === 'local') {
        return process.platform === 'win32' ? '\\' : '/';
    }
    const agent = agents[node];
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
        const agent = agents[node];
        if (!agent) throw new Error(`Agent ${node} not found or offline`);
        await axios.post(`${agent.url}/files/create/folder`, {
            parentPath: dirPath,
            folderName: ''
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
        const agent = agents[node];
        if (!agent) throw new Error(`Agent ${node} not found or offline`);
        await axios.post(`${agent.url}/files/delete`, { path: filePath });
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
            console.error('[Sync scan local error]:', e.message);
        }
        return results;
    } else {
        const agent = agents[node];
        if (!agent) throw new Error(`Agent Node ${node} not found or offline`);
        
        const results = [];
        const walk = async (currentPath) => {
            const resp = await axios.get(`${agent.url}/files/list?path=${encodeURIComponent(currentPath)}`);
            const items = resp.data;
            for (const item of items) {
                if (item.isDirectory) {
                    await walk(item.path);
                } else {
                    results.push({
                        relPath: getRelativePath(dirPath, item.path),
                        absPath: item.path,
                        size: item.size,
                        modified: new Date(item.updated).getTime(),
                        isDirectory: false
                    });
                }
            }
        };
        await walk(dirPath);
        return results;
    }
};

const copyFileBetweenNodes = async (srcNode, srcPath, destNode, destPath) => {
    const srcIsLocal = !srcNode || srcNode === 'local';
    const destIsLocal = !destNode || destNode === 'local';

    if (srcIsLocal && destIsLocal) {
        fs.copyFileSync(srcPath, destPath);
        const stats = fs.statSync(srcPath);
        return stats.size;
    }

    if (srcIsLocal && !destIsLocal) {
        const targetAgent = agents[destNode];
        if (!targetAgent) throw new Error(`Destination Agent ${destNode} not found or offline`);

        const form = new FormData();
        form.append('files', fs.createReadStream(srcPath), path.basename(srcPath));

        const targetDir = getParentDirForNode(destNode, destPath);
        const uploadUrl = `${targetAgent.url}/files/upload?path=${encodeURIComponent(targetDir)}`;
        await axios.post(uploadUrl, form, {
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        const stats = fs.statSync(srcPath);
        return stats.size;
    }

    if (!srcIsLocal && destIsLocal) {
        const sourceAgent = agents[srcNode];
        if (!sourceAgent) throw new Error(`Source Agent ${srcNode} not found or offline`);

        const downloadUrl = `${sourceAgent.url}/files/download?path=${encodeURIComponent(srcPath)}`;
        const response = await axios({
            method: 'get',
            url: downloadUrl,
            responseType: 'stream'
        });

        return new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(destPath);
            let bytes = 0;
            response.data.on('data', chunk => bytes += chunk.length);
            response.data.pipe(writer);
            writer.on('finish', () => resolve(bytes));
            writer.on('error', reject);
        });
    }

    if (!srcIsLocal && !destIsLocal) {
        const sourceAgent = agents[srcNode];
        const targetAgent = agents[destNode];
        if (!sourceAgent) throw new Error(`Source Agent ${srcNode} not found or offline`);
        if (!targetAgent) throw new Error(`Destination Agent ${destNode} not found or offline`);

        const downloadUrl = `${sourceAgent.url}/files/download?path=${encodeURIComponent(srcPath)}`;
        const downloadResponse = await axios({
            method: 'get',
            url: downloadUrl,
            responseType: 'stream'
        });

        const form = new FormData();
        form.append('files', downloadResponse.data, path.basename(srcPath));

        const targetDir = getParentDirForNode(destNode, destPath);
        const uploadUrl = `${targetAgent.url}/files/upload?path=${encodeURIComponent(targetDir)}`;
        await axios.post(uploadUrl, form, {
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        const contentLength = parseInt(downloadResponse.headers['content-length'] || '0', 10);
        return contentLength;
    }
};

const computeNextRun = (interval) => {
    if (!interval || interval === 'manual') return null;
    const now = new Date();
    if (interval === 'hourly') {
        return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    }
    if (interval === 'daily') {
        return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    }
    if (interval === 'weekly') {
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    }
    const mins = parseInt(interval, 10);
    if (!isNaN(mins)) {
        return new Date(now.getTime() + mins * 60 * 1000).toISOString();
    }
    return null;
};

const runSyncTask = async (taskId) => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM sync_tasks WHERE id = ?", [taskId], async (err, task) => {
            if (err || !task) {
                return reject(err || new Error(`Task ${taskId} not found`));
            }

            if (activeSyncs.has(taskId)) {
                return resolve({ status: 'Skipped', message: 'Already in progress' });
            }

            activeSyncs.add(taskId);
            
            db.run("UPDATE sync_tasks SET lastStatus = 'In Progress', lastRun = CURRENT_TIMESTAMP WHERE id = ?", [taskId]);

            let filesCopied = 0;
            let bytesTransferred = 0;
            let errors = [];

            try {
                const sourceFiles = await scanDirectory(task.sourceNode, task.sourcePath);
                const destFiles = await scanDirectory(task.destNode, task.destPath);

                const destFilesMap = new Map(destFiles.map(f => [f.relPath, f]));

                const filesToCopy = [];
                for (const srcFile of sourceFiles) {
                    const destFile = destFilesMap.get(srcFile.relPath);
                    if (!destFile || srcFile.size !== destFile.size || srcFile.modified > destFile.modified) {
                        filesToCopy.push(srcFile);
                    }
                }

                const filesToDelete = [];
                if (task.syncMode === 'mirror') {
                    const sourceFilesSet = new Set(sourceFiles.map(f => f.relPath));
                    for (const destFile of destFiles) {
                        if (!sourceFilesSet.has(destFile.relPath)) {
                            filesToDelete.push(destFile);
                        }
                    }
                }

                for (const delFile of filesToDelete) {
                    try {
                        await deleteFileOnNode(task.destNode, delFile.absPath);
                    } catch (delErr) {
                        errors.push(`Delete error: ${delFile.relPath} -> ${delErr.message}`);
                    }
                }

                for (const copyFile of filesToCopy) {
                    try {
                        const targetPath = joinPathsForNode(task.destNode, task.destPath, copyFile.relPath);
                        await ensureDirExistsOnNode(task.destNode, getParentDirForNode(task.destNode, targetPath));
                        
                        const bytes = await copyFileBetweenNodes(task.sourceNode, copyFile.absPath, task.destNode, targetPath);
                        filesCopied++;
                        bytesTransferred += bytes;
                    } catch (copyErr) {
                        errors.push(`Copy error: ${copyFile.relPath} -> ${copyErr.message}`);
                    }
                }

                const status = errors.length === 0 ? 'Success' : 'Partial Success';
                const errorStr = errors.length > 0 ? errors.join('\n') : null;
                const nextRun = computeNextRun(task.scheduleInterval);

                db.run(
                    "UPDATE sync_tasks SET lastStatus = ?, lastError = ?, nextRun = ? WHERE id = ?",
                    [status, errorStr, nextRun, taskId]
                );

                db.run(
                    "INSERT INTO sync_history (taskId, status, filesCopied, bytesTransferred, errors) VALUES (?, ?, ?, ?, ?)",
                    [taskId, status, filesCopied, bytesTransferred, errorStr]
                );

                resolve({ status, filesCopied, bytesTransferred, errors });
            } catch (runErr) {
                console.error(`[Sync Task ${taskId} Run Error]:`, runErr.message);
                const nextRun = computeNextRun(task.scheduleInterval);
                db.run(
                    "UPDATE sync_tasks SET lastStatus = 'Failed', lastError = ?, nextRun = ? WHERE id = ?",
                    [runErr.message, nextRun, taskId]
                );
                db.run(
                    "INSERT INTO sync_history (taskId, status, errors) VALUES (?, 'Failed', ?)",
                    [taskId, runErr.message]
                );
                reject(runErr);
            } finally {
                activeSyncs.delete(taskId);
            }
        });
    });
};

const startScheduler = () => {
    console.log('[Scheduler] Initializing background synchronization checks (1-minute intervals)...');
    setInterval(() => {
        const nowStr = new Date().toISOString();
        db.all(
            "SELECT id FROM sync_tasks WHERE active = 1 AND nextRun IS NOT NULL AND nextRun <= ?",
            [nowStr],
            (err, rows) => {
                if (err) {
                    console.error('[Scheduler Error] Failed to query sync tasks:', err.message);
                    return;
                }
                if (rows && rows.length > 0) {
                    console.log(`[Scheduler] Found ${rows.length} sync task(s) due for execution.`);
                    for (const row of rows) {
                        runSyncTask(row.id)
                            .then(res => {
                                console.log(`[Scheduler] Sync Task ${row.id} completed:`, res);
                            })
                            .catch(runErr => {
                                console.error(`[Scheduler] Sync Task ${row.id} failed:`, runErr.message);
                            });
                    }
                }
            }
        );
    }, 60000);
};

module.exports = {
    runSyncTask,
    startScheduler,
    copyFileBetweenNodes,
    scanDirectory,
    computeNextRun
};
