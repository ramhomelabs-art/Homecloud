const axios = require('axios');
const db = require('../config/database');

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
        db.all("SELECT key, value FROM app_settings WHERE key LIKE 'telegram%'", (err, rows) => {
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
 * Formats and sends a sync completion notification
 */
const sendSyncAlert = async (task, result) => {
    try {
        const settings = await getTelegramSettings();
        if (settings.telegramNotifySync !== '1') return;

        const { name } = task;
        const { status, filesCopied, bytesTransferred, errors } = result;
        
        let statusEmoji = 'ℹ️';
        if (status === 'Success') statusEmoji = '✅';
        else if (status === 'Partial Success') statusEmoji = '⚠️';
        else if (status === 'Failed') statusEmoji = '❌';

        let text = `${statusEmoji} <b>[Sync Task Completed]</b>\n`;
        text += `<b>Task Name:</b> ${name}\n`;
        text += `<b>Status:</b> ${status}\n`;
        text += `<b>Files Copied:</b> ${filesCopied || 0}\n`;
        text += `<b>Bytes Transferred:</b> ${formatSize(bytesTransferred || 0)}\n`;
        
        if (errors) {
            const errStr = Array.isArray(errors) ? errors.join('\n') : errors;
            text += `<b>Errors:</b>\n<pre>${errStr.substring(0, 500)}</pre>\n`;
        }

        await sendTelegramMessage(text);
    } catch (err) {
        console.error('[Telegram Sync Alert Error]:', err.message);
    }
};

/**
 * Formats and sends an AI Automator notification
 */
const sendAiAlert = async (command, result) => {
    try {
        const settings = await getTelegramSettings();
        if (settings.telegramNotifyAi !== '1') return;

        const { status, logs, filesAffected } = result;
        
        let statusEmoji = 'ℹ️';
        if (status === 'Success') statusEmoji = '✅';
        else if (status === 'Failed') statusEmoji = '❌';

        let text = `${statusEmoji} <b>[AI Automator Action]</b>\n`;
        text += `<b>Command:</b> <code>${command}</code>\n`;
        text += `<b>Status:</b> ${status}\n`;
        
        if (filesAffected && filesAffected.length > 0) {
            text += `<b>Files Affected:</b> ${filesAffected.length}\n`;
            text += `<pre>${filesAffected.slice(0, 10).join('\n')}${filesAffected.length > 10 ? '\n...and more' : ''}</pre>\n`;
        }
        
        if (logs) {
            const logStr = Array.isArray(logs) ? logs.join('\n') : logs;
            text += `<b>Logs:</b>\n<pre>${logStr.substring(0, 500)}</pre>`;
        }

        await sendTelegramMessage(text);
    } catch (err) {
        console.error('[Telegram AI Alert Error]:', err.message);
    }
};

module.exports = {
    sendSyncAlert,
    sendAiAlert
};
