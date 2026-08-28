const axios = require('axios');
const db = require('../config/database');
const eventBus = require('../utils/eventBus');
const logger = require('../utils/logger');

// Global rolling in-memory console activities feed (max 150 items)
const inAppActivities = [];

class NotificationService {
    constructor() {
        this.activities = inAppActivities;
        this.registerEventListeners();
        this.loadPersistedAlerts();
    }

    async loadPersistedAlerts() {
        try {
            const res = await db.query('SELECT id, name, status, error, timestamp FROM system_alerts ORDER BY timestamp DESC LIMIT 150');
            for (const row of res.rows) {
                this.activities.push({
                    id: row.id,
                    name: row.name,
                    status: row.status,
                    error: row.error,
                    timestamp: row.timestamp
                });
            }
            logger.info(`[NotificationService] Loaded ${res.rows.length} persisted alerts from database.`);
        } catch (err) {
            logger.error(`[NotificationService] Failed to load persisted alerts: ${err.message}`);
        }
    }

    async getSetting(key, fallback = '') {
        try {
            // Check both snake_case and camelCase key mappings
            const camelCaseKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
            const res = await db.query('SELECT value FROM app_settings WHERE key = $1 OR key = $2', [key, camelCaseKey]);
            if (res.rows.length > 0) return res.rows[0].value;
        } catch (e) {
            // Table might not exist yet or be empty
        }
        return fallback;
    }

    async sendTelegramMessage(text) {
        const token = await this.getSetting('telegram_bot_token');
        const chatId = await this.getSetting('telegram_chat_id');

        if (!token || !chatId) {
            logger.warn('[NotificationService] Telegram alerts requested, but credentials are not configured in settings.');
            return;
        }

        try {
            await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML'
            });
            logger.info('[NotificationService] Telegram alert dispatched successfully.');
        } catch (err) {
            logger.error(`[NotificationService] Telegram dispatch failed: ${err.message}`, err);
        }
    }

    async sendDiscordMessage(title, description, severity = 'info') {
        const webhookUrl = (await this.getSetting('discord_webhook_url')) || (await this.getSetting('discordWebhookUrl'));
        if (!webhookUrl) {
            logger.warn('[NotificationService] Discord alerts requested, but webhook URL is not configured.');
            return;
        }

        // Map severity to Discord embed colour (decimal)
        const colourMap = {
            info:    0x2D9CDB,   // cyan-blue
            warning: 0xF2C94C,   // amber
            error:   0xEB5757,   // red
            success: 0x27AE60    // green
        };
        const colour = colourMap[severity] || colourMap.info;

        let discordEmoji = '🔵';
        let discordBadge = 'INFO';
        if (severity === 'error') {
            discordEmoji = '🚨';
            discordBadge = 'CRITICAL';
        } else if (severity === 'warning') {
            discordEmoji = '⚠️';
            discordBadge = 'WARNING';
        } else if (severity === 'success') {
            discordEmoji = '✅';
            discordBadge = 'SUCCESS';
        }

        // Parse description lines to extract key-value fields dynamically
        const fields = [];
        const lines = (description || '').split('\n');
        let cleanDescription = '';

        for (const line of lines) {
            if (line.includes(': ')) {
                const parts = line.split(': ');
                const label = parts[0].trim();
                const value = parts.slice(1).join(': ').trim();
                if (label.length > 0 && label.length < 35 && value.length > 0 && value.length < 100) {
                    fields.push({ name: label, value: value, inline: true });
                    continue;
                }
            }
            if (line.trim()) {
                cleanDescription += line + '\n';
            }
        }

        cleanDescription = cleanDescription.trim();

        const payload = {
            username: 'NexaDisk Alerts',
            avatar_url: 'https://cdn-icons-png.flaticon.com/512/2885/2885417.png',
            embeds: [{
                title: `${discordEmoji} [${discordBadge}] ${title}`,
                description: cleanDescription || undefined,
                color: colour,
                fields: fields.length > 0 ? fields : undefined,
                footer: {
                    text: `NexaDisk Monitor`
                },
                timestamp: new Date().toISOString()
            }]
        };

        try {
            await axios.post(webhookUrl, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 6000
            });
            logger.info('[NotificationService] Discord alert dispatched successfully.');
        } catch (err) {
            logger.error(`[NotificationService] Discord dispatch failed: ${err.message}`, err);
        }
    }

    async sendWebhookMessage(eventKey, name, status, error = 'info') {
        const webhookUrl = await this.getSetting('n8n_webhook_url');
        if (!webhookUrl) return;

        try {
            await axios.post(webhookUrl, {
                event: eventKey,
                title: name,
                detail: status,
                severity: error,
                timestamp: new Date().toISOString()
            }, { timeout: 5000 });
            logger.info(`[NotificationService] Webhook payload dispatched successfully to: ${webhookUrl}`);
        } catch (err) {
            logger.error(`[NotificationService] Webhook dispatch failed: ${err.message}`, err);
        }
    }

    async sendInAppAlert(name, status, error = 'info') {
        let alertId = Math.random().toString(36).substring(2, 15);
        try {
            const res = await db.query(
                'INSERT INTO system_alerts (name, status, error) VALUES ($1, $2, $3) RETURNING id',
                [name, status, error]
            );
            if (res.rows[0]) alertId = res.rows[0].id;
        } catch (e) {
            logger.error(`[NotificationService] Failed to insert system alert: ${e.message}`);
        }

        const timestamp = new Date().toISOString();
        this.activities.unshift({ id: alertId, name, status, error, timestamp });
        
        // Cap list at 150 entries
        if (this.activities.length > 150) {
            this.activities.pop();
        }
        logger.info(`[NotificationService] In-App alert recorded: "${name} - ${status}"`);
    }

    async notify(eventKey, name, payload = {}) {
        try {
            const detail = typeof payload === 'string' ? payload : (payload.status || payload.detail || payload.message || JSON.stringify(payload));
            const severity = payload.error || payload.severity || 'info';
            return await this.dispatchAlert(eventKey, name, detail, severity);
        } catch (e) {
            logger.warn(`[NotificationService] notify error: ${e.message}`);
        }
    }

    async dispatchAlert(eventKey, name, status, error = 'info') {
        // Query database settings to check if this trigger channel is toggled
        const isTelegramEnabled = ['true', '1'].includes(await this.getSetting(`alert_${eventKey}_telegram`, 'false'));
        const isDiscordEnabled  = ['true', '1'].includes(await this.getSetting(`alert_${eventKey}_discord`,  'false'));
        const isInAppEnabled    = ['true', '1'].includes(await this.getSetting(`alert_${eventKey}_inapp`,    'true'));

        if (isTelegramEnabled) {
            let telegramEmoji = '🔵';
            let telegramBadge = 'INFO';
            if (error === 'error') {
                telegramEmoji = '🚨';
                telegramBadge = 'CRITICAL';
            } else if (error === 'warning') {
                telegramEmoji = '⚠️';
                telegramBadge = 'WARNING';
            } else if (error === 'success') {
                telegramEmoji = '✅';
                telegramBadge = 'SUCCESS';
            }

            const telegramStatus = status
                .split('\n')
                .map(line => {
                    if (line.includes(': ')) {
                        const parts = line.split(': ');
                        const label = parts[0].trim();
                        const value = parts.slice(1).join(': ').trim();
                        if (value && value.length < 100) {
                            return `<b>${label}</b>: <code>${value}</code>`;
                        }
                    }
                    return line;
                })
                .join('\n');

            const telegramText = `${telegramEmoji} <b>[${telegramBadge}] ${name}</b>\n\n${telegramStatus}\n\n📅 <i>${new Date().toUTCString()}</i>`;
            await this.sendTelegramMessage(telegramText);
        }
        if (isDiscordEnabled) {
            await this.sendDiscordMessage(name, status, error);
        }
        if (isInAppEnabled) {
            await this.sendInAppAlert(name, status, error);
        }

        // Always dispatch to n8n webhook if configured
        await this.sendWebhookMessage(eventKey, name, status, error);
    }

    // Subscribe to EventBus lifecycle events dynamically
    registerEventListeners() {
        logger.info('[NotificationService] Subscribing to core system events for alerts dispatch...');

        // 1. Sync completed event listener
        eventBus.subscribe('SYNC_COMPLETED', async (data) => {
            const statusEmoji = data.status === 'Success' ? '✅' : '❌';
            const title = `Sync Task ${data.status} ${statusEmoji}`;
            const detail = `Task completed. Files Copied: ${data.filesCopied}\nErrors: ${data.errors || 'None'}`;
            const key = data.status === 'Success' ? 'sync_success' : 'sync_failure';
            const severity = data.status === 'Success' ? 'info' : 'error';
            await this.dispatchAlert(key, title, detail, severity);
        });

        // 2. AI Workflow completed event listener
        eventBus.subscribe('AI_WORKFLOW_COMPLETED', async (data) => {
            const statusEmoji = data.status === 'Success' ? '🤖' : '⚠️';
            const title = `AI Automator: ${data.command} ${statusEmoji}`;
            const detail = `Status: ${data.status}\nFiles Impacted: ${data.filesAffected ? data.filesAffected.length : 0}`;
            const key = data.command.includes('clean') ? 'ai_clean' : 'ai_organize';
            const severity = data.status === 'Success' ? 'info' : 'warning';
            await this.dispatchAlert(key, title, detail, severity);
        });

        // 3. Agent offline event listener
        eventBus.subscribe('AGENT_WENT_OFFLINE', async (data) => {
            const title = `Agent Node Offline ⚠️`;
            const detail = `Approved agent node "${data.hostname}" (ID: ${data.id}) transitioned to OFFLINE. Please verify agent status.`;
            await this.dispatchAlert('agent_offline', title, detail, 'error');
        });

        // 4. User login alert listener
        eventBus.subscribe('USER_LOGIN', async (data) => {
            const title = `Operator Login 🔑`;
            const detail = `Successful login detected. Username: ${data.username}\nRole: ${data.role}\nIP Address: ${data.ip}`;
            await this.dispatchAlert('user_login', title, detail, 'info');
        });
    }
}

const notificationService = new NotificationService();
module.exports = notificationService;
