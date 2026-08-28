const nodemailer = require('nodemailer');
const db = require('../config/database');
const logger = require('../utils/logger');

class EmailService {
    async getSetting(key, fallback = '') {
        try {
            const camelCaseKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            const res = await db.query('SELECT value FROM app_settings WHERE key = $1 OR key = $2', [key, camelCaseKey]);
            if (res.rows.length > 0 && res.rows[0].value !== undefined && res.rows[0].value !== null) {
                return res.rows[0].value;
            }
        } catch (_) {}
        return process.env[key.toUpperCase()] || fallback;
    }

    async getTransport(customConfig = null) {
        if (customConfig) {
            return nodemailer.createTransport({
                host: customConfig.host,
                port: parseInt(customConfig.port, 10) || 587,
                secure: customConfig.secure === true || customConfig.secure === 'true' || parseInt(customConfig.port, 10) === 465,
                auth: (customConfig.user && customConfig.pass) ? {
                    user: customConfig.user,
                    pass: customConfig.pass
                } : undefined,
                tls: {
                    rejectUnauthorized: false // Permissive for self-signed certificates in enterprise/homelab
                }
            });
        }

        const host = await this.getSetting('smtp_host');
        const port = await this.getSetting('smtp_port', '587');
        const secure = await this.getSetting('smtp_secure', 'false');
        const user = await this.getSetting('smtp_user');
        const pass = await this.getSetting('smtp_pass');

        if (!host) {
            return null;
        }

        return nodemailer.createTransport({
            host,
            port: parseInt(port, 10) || 587,
            secure: secure === 'true' || secure === true || parseInt(port, 10) === 465,
            auth: (user && pass) ? {
                user,
                pass
            } : undefined,
            tls: {
                rejectUnauthorized: false
            }
        });
    }

    async getFromAddress() {
        const from = await this.getSetting('smtp_from');
        const appName = await this.getSetting('app_name', 'NexaDisk');
        if (from) {
            return from.includes('<') ? from : `"${appName}" <${from}>`;
        }
        const user = await this.getSetting('smtp_user');
        if (user && user.includes('@')) {
            return `"${appName}" <${user}>`;
        }
        return `"${appName}" <noreply@nexadisk.local>`;
    }

    /**
     * Send OTP Verification Code to recipient
     */
    async sendOTP({ to, otpCode, shareTitle = 'Shared Item', expiresMinutes = 10 }) {
        try {
            const transporter = await this.getTransport();
            const from = await this.getFromAddress();
            const appName = await this.getSetting('app_name', 'NexaDisk');

            if (!transporter) {
                logger.warn(`[EmailService] SMTP not configured. OTP generated for ${to}: [${otpCode}] (Simulation mode)`);
                return {
                    success: true,
                    simulated: true,
                    message: 'SMTP not configured; code logged to server console.'
                };
            }

            const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
                    .container { max-width: 520px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; border: 1px solid #334155; padding: 32px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); }
                    .logo { font-size: 22px; font-weight: 700; color: #60a5fa; letter-spacing: -0.5px; margin-bottom: 24px; display: inline-block; }
                    .title { font-size: 18px; font-weight: 600; color: #f1f5f9; margin-bottom: 12px; }
                    .desc { font-size: 14px; color: #94a3b8; line-height: 1.5; margin-bottom: 24px; }
                    .code-box { background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1)); border: 1px dashed #3b82f6; border-radius: 8px; padding: 18px; text-align: center; margin-bottom: 24px; }
                    .otp-code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 32px; font-weight: 700; color: #38bdf8; letter-spacing: 6px; }
                    .footer { font-size: 12px; color: #64748b; text-align: center; margin-top: 24px; border-top: 1px solid #334155; padding-top: 16px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="logo">⚡ ${appName}</div>
                    <div class="title">Secure Access Passkey</div>
                    <div class="desc">
                        You requested access to <strong>${shareTitle}</strong> on ${appName}. Use the one-time verification code below to authorize your session:
                    </div>
                    <div class="code-box">
                        <div class="otp-code">${otpCode}</div>
                    </div>
                    <div class="desc" style="font-size: 13px; color: #cbd5e1;">
                        ⏱️ This verification code will expire in <strong>${expiresMinutes} minutes</strong>. If you did not request this code, please ignore this email.
                    </div>
                    <div class="footer">
                        Protected by ${appName} Zero-Trust File Gateway &bull; Autonomous Data Mesh
                    </div>
                </div>
            </body>
            </html>
            `;

            const info = await transporter.sendMail({
                from,
                to,
                subject: `[${appName}] Your Access Passkey: ${otpCode}`,
                text: `Your ${appName} access code for "${shareTitle}" is: ${otpCode}. It expires in ${expiresMinutes} minutes.`,
                html
            });

            logger.info(`[EmailService] OTP email sent to ${to}. MessageId: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (err) {
            logger.error(`[EmailService] Failed to send OTP to ${to}: ${err.message}`);
            return { success: false, error: err.message };
        }
    }

    /**
     * Send test email to verify SMTP configuration
     */
    async sendTestEmail(targetEmail, customConfig = null) {
        try {
            const transporter = await this.getTransport(customConfig);
            if (!transporter) {
                throw new Error('SMTP Host is not configured');
            }

            // Verify connection configuration first
            await transporter.verify();

            const from = customConfig?.from || await this.getFromAddress();
            const appName = await this.getSetting('app_name', 'NexaDisk');

            const info = await transporter.sendMail({
                from,
                to: targetEmail,
                subject: `[${appName}] SMTP Integration Test Successful`,
                text: `Success! Your NexaDisk SMTP configuration is working properly.\nTimestamp: ${new Date().toISOString()}`,
                html: `
                <div style="font-family: sans-serif; background: #0f172a; color: #fff; padding: 24px; border-radius: 8px;">
                    <h2 style="color: #4ade80; margin-top: 0;">✅ SMTP Connection Verified</h2>
                    <p>This email confirms that your NexaDisk SMTP notification gateway is successfully connected and transmitting messages.</p>
                    <p style="color: #94a3b8; font-size: 13px;">Timestamp: ${new Date().toUTCString()}</p>
                </div>
                `
            });

            logger.info(`[EmailService] Test email delivered to ${targetEmail}. MessageId: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (err) {
            logger.error(`[EmailService] Test email failed: ${err.message}`);
            return { success: false, error: err.message };
        }
    }
}

module.exports = new EmailService();
