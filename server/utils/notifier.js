const axios = require('axios');
const db = require('../config/database');
const { activities } = require('../config/sharedState');

/**
 * Helper to format bytes into readable sizes
 */
const formatSize = (bytes) => {
    if (typeof bytes !== 'number' || isNaN(bytes)) return '0 Bytes';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Retrieve Telegram settings from the database
 */
const getTelegramSettings = () => {
    return new Promise((resolve) => {
        db.all("SELECT key, value FROM app_settings WHERE key LIKE 'telegram%' OR key LIKE 'alert%'", (err, rows) => {
            if (err || !rows) return resolve({});
            const settings = {};
            rows.forEach(r => settings[r.key] = r.value);
            resolve(settings);
        });
    });
};

/**
 * Send a raw Telegram message
 */
const sendTelegramMessage = async (text) => {
    try {
        const settings = await getTelegramSettings();
        const token = settings.telegramBotToken;
        const chatId = settings.telegramChatId;
        
        if (!token || !chatId) {
            return; // Telegram alerts are not configured
        }
        
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        await axios.post(url, {
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
        });
    } catch (err) {
        console.error('[Telegram Notifier Error]: Failed to send notification:', err.message);
    }
};

/**
 * Core alert dispatcher function
 * Checks user settings to determine if Telegram and/or In-App notification should be dispatched.
 * 
 * @param {string} eventKey Event identifier (e.g. 'sync_success', 'sync_failure', 'user_login')
 * @param {object} details Notification details { title, text, htmlText, type }
 */
const sendAlert = async (eventKey, { title, text, htmlText, type = 'info' }) => {
    try {
        const settings = await getTelegramSettings();
        
        // 1. Resolve Telegram Toggle (legacy fallback to notifySync / notifyAi settings)
        let isTelegramEnabled = false;
        if (settings[`alert_${eventKey}_telegram`] !== undefined) {
            isTelegramEnabled = settings[`alert_${eventKey}_telegram`] === '1';
        } else {
            if (eventKey.startsWith('sync_')) {
                isTelegramEnabled = settings.telegramNotifySync === '1';
            } else if (eventKey.startsWith('ai_')) {
                isTelegramEnabled = settings.telegramNotifyAi === '1';
            } else {
                isTelegramEnabled = false; // Default off for logins, offline alerts unless checked
            }
        }

        // 2. Resolve In-App/Browser Notification Toggle (default to true/enabled)
        const isInAppEnabled = settings[`alert_${eventKey}_inapp`] !== undefined
            ? settings[`alert_${eventKey}_inapp`] === '1'
            : true;

        // 3. Dispatch to Telegram
        if (isTelegramEnabled) {
            await sendTelegramMessage(htmlText);
        }

        // 4. Dispatch to In-App Activities log
        if (isInAppEnabled && activities) {
            activities.unshift({
                id: Date.now() + Math.random(),
                type: eventKey,
                name: title,
                status: text,
                timestamp: new Date().toISOString(),
                error: type // matches UI severity levels ('info', 'warning', 'error')
            });
            
            // Limit buffer to 100 items
            if (activities.length > 100) {
                activities.pop();
            }
        }
    } catch (err) {
        console.error(`[Alert Dispatcher Error] eventKey: ${eventKey}:`, err.message);
    }
};

/**
 * Formats and sends a sync completion notification
 */
const sendSyncAlert = async (task, result) => {
    const { name } = task;
    const { status, filesCopied, bytesTransferred, errors } = result;
    
    const isSuccess = status === 'Success' || status === 'Partial Success';
    const eventKey = isSuccess ? 'sync_success' : 'sync_failure';
    const statusEmoji = isSuccess ? '✅' : '❌';
    const severity = isSuccess ? 'info' : 'error';
    
    const title = `Sync Job: ${name}`;
    let text = `Sync status: ${status}. Copied ${filesCopied} files (${formatSize(bytesTransferred)}).`;
    if (errors) {
        text += ` Error notes: ${errors}`;
    }
    
    let htmlText = `${statusEmoji} <b>[Sync Task Completed]</b>\n`;
    htmlText += `<b>Task Name:</b> ${name}\n`;
    htmlText += `<b>Status:</b> ${status}\n`;
    htmlText += `<b>Files Copied:</b> ${filesCopied || 0}\n`;
    htmlText += `<b>Bytes Transferred:</b> ${formatSize(bytesTransferred || 0)}\n`;
    if (errors) {
        htmlText += `<b>Errors:</b>\n<pre>${errors.substring(0, 500)}</pre>\n`;
    }

    await sendAlert(eventKey, { title, text, htmlText, type: severity });
};

/**
 * Formats and sends an AI Automator notification
 */
const sendAiAlert = async (command, result) => {
    const { status, logs, filesAffected } = result;
    const isSuccess = status === 'Success';
    
    const commandLower = command.toLowerCase();
    const isClean = commandLower.includes('clean') || commandLower.includes('delete') || commandLower.includes('clear');
    const eventKey = isClean ? 'ai_clean' : 'ai_organize';
    
    const statusEmoji = isSuccess ? '✅' : '❌';
    const severity = isSuccess ? 'info' : 'error';
    const actionName = isClean ? 'Junk Cleanup' : 'File Organization';
    
    const title = `AI Automator: ${actionName}`;
    const text = `AI ${actionName} status: ${status}. Affected ${filesAffected ? filesAffected.length : 0} files.`;
    
    let htmlText = `${statusEmoji} <b>[AI Automator Action]</b>\n`;
    htmlText += `<b>Command:</b> <code>${command}</code>\n`;
    htmlText += `<b>Status:</b> ${status}\n`;
    if (filesAffected && filesAffected.length > 0) {
        htmlText += `<b>Files Affected:</b> ${filesAffected.length}\n`;
    }
    
    if (logs) {
        const logStr = Array.isArray(logs) ? logs.join('\n') : logs;
        htmlText += `<b>Logs:</b>\n<pre>${logStr.substring(0, 500)}</pre>`;
    }

    await sendAlert(eventKey, { title, text, htmlText, type: severity });
};

module.exports = {
    sendAlert,
    sendSyncAlert,
    sendAiAlert
};
