import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Settings, User, Send, ShieldCheck, Clock, Monitor, 
    Bell, HardDrive, CheckCircle2, AlertCircle, RefreshCw, 
    Sparkles, Key, Lock, Layers, Sliders, Globe, Eye,
    Users, Plus, Trash2, Shield, UserCheck, X, Edit, KeyRound, ShieldAlert, Mail
} from 'lucide-react';
import ProfileSettings from '../profile/ProfileSettings';

const SystemSettingsView = ({ 
    username, 
    userRole = 'Admin', 
    appName = 'NexaDisk', 
    settings = {}, 
    setSettings, 
    updateSetting, 
    showClock, 
    setShowClock, 
    format24h, 
    setFormat24h, 
    showToast,
    setView
}) => {
    const [activeTab, setActiveTab] = useState('branding');
    const [localAppName, setLocalAppName] = useState(appName);
    const [discordWebhook, setDiscordWebhook] = useState(settings.discord_webhook_url || settings.discordWebhookUrl || '');
    const [telegramToken, setTelegramToken] = useState(settings.telegramBotToken || '');
    const [telegramChatId, setTelegramChatId] = useState(settings.telegramChatId || '');
    
    // SMTP Email States
    const [smtpHost, setSmtpHost] = useState(settings.smtp_host || '');
    const [smtpPort, setSmtpPort] = useState(settings.smtp_port || '587');
    const [smtpSecure, setSmtpSecure] = useState(settings.smtp_secure === 'true' || settings.smtp_secure === true);
    const [smtpUser, setSmtpUser] = useState(settings.smtp_user || '');
    const [smtpPass, setSmtpPass] = useState(settings.smtp_pass || '');
    const [smtpFrom, setSmtpFrom] = useState(settings.smtp_from || '');
    const [testEmailTarget, setTestEmailTarget] = useState('');
    const [testingSmtp, setTestingSmtp] = useState(false);

    const [testingDiscord, setTestingDiscord] = useState(false);
    const [testingTelegram, setTestingTelegram] = useState(false);
    const [saving, setSaving] = useState(false);

    // Multi-User Management States
    const [userList, setUserList] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [showCreateUserModal, setShowCreateUserModal] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState('Operator');
    const [newEmail, setNewEmail] = useState('');
    const [creatingUser, setCreatingUser] = useState(false);

    // Edit User Modal State
    const [editingUser, setEditingUser] = useState(null);
    const [updatingUserLoading, setUpdatingUserLoading] = useState(false);

    // Reset Password Modal State
    const [resettingUser, setResettingUser] = useState(null);
    const [resetPasswordValue, setResetPasswordValue] = useState('');
    const [resettingPasswordLoading, setResettingPasswordLoading] = useState(false);

    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const fetchAllUsers = async () => {
        setLoadingUsers(true);
        try {
            const res = await axios.get('/api/v1/auth/users', { headers });
            setUserList(res.data || []);
        } catch (e) {
            console.error('Failed to load users:', e);
        } finally {
            setLoadingUsers(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'users') {
            fetchAllUsers();
        }
    }, [activeTab]);

    const handleApplyBranding = () => {
        if (!localAppName) return;
        updateSetting('appName', localAppName);
        if (showToast) showToast('Application name updated successfully!', 'success');
    };

    const handleSaveTelegram = () => {
        updateSetting('telegramBotToken', telegramToken);
        updateSetting('telegramChatId', telegramChatId);
        if (showToast) showToast('Telegram alert credentials saved.', 'success');
    };

    const handleSaveSmtp = async () => {
        try {
            await axios.post('/api/v1/auth/settings', {
                smtp_host: smtpHost,
                smtp_port: smtpPort,
                smtp_secure: String(smtpSecure),
                smtp_user: smtpUser,
                smtp_pass: smtpPass,
                smtp_from: smtpFrom
            }, { headers });
            if (showToast) showToast('SMTP email gateway settings saved successfully! ✉️', 'success');
        } catch (err) {
            if (showToast) showToast('Failed to save SMTP settings', 'error');
        }
    };

    const handleTestSmtp = async () => {
        if (!smtpHost) {
            if (showToast) showToast('Please enter an SMTP Host server first', 'error');
            return;
        }
        if (!testEmailTarget) {
            if (showToast) showToast('Please enter a recipient email address to receive the test message', 'error');
            return;
        }
        setTestingSmtp(true);
        try {
            const res = await axios.post('/api/v1/system/test-email', {
                targetEmail: testEmailTarget,
                config: {
                    host: smtpHost,
                    port: smtpPort,
                    secure: smtpSecure,
                    user: smtpUser,
                    pass: smtpPass,
                    from: smtpFrom
                }
            }, { headers });
            if (showToast) showToast(res.data?.message || 'SMTP test email sent successfully! 🚀', 'success');
        } catch (err) {
            if (showToast) showToast(err.response?.data?.error || 'Failed to send test email. Check SMTP credentials.', 'error');
        } finally {
            setTestingSmtp(false);
        }
    };

    const handleSaveDiscord = () => {
        updateSetting('discord_webhook_url', discordWebhook);
        updateSetting('discordWebhookUrl', discordWebhook);
        if (showToast) showToast('Discord webhook URL saved.', 'success');
    };

    const handleTestDiscord = async () => {
        if (!discordWebhook) {
            if (showToast) showToast('Please enter a Discord Webhook URL first', 'error');
            return;
        }
        setTestingDiscord(true);
        try {
            await axios.post('/api/v1/system/test-discord', {}, { headers });
            if (showToast) showToast('Test notification sent to Discord channel! 🚀', 'success');
        } catch (err) {
            if (showToast) showToast('Failed to send Discord test message. Verify webhook URL.', 'error');
        } finally {
            setTestingDiscord(false);
        }
    };

    const handleTestTelegram = async () => {
        if (!telegramToken || !telegramChatId) {
            if (showToast) showToast('Please enter both Telegram Bot Token and Chat ID', 'error');
            return;
        }
        setTestingTelegram(true);
        try {
            await axios.post('/api/v1/system/test-telegram', {
                botToken: telegramToken,
                chatId: telegramChatId
            }, { headers });
            if (showToast) showToast('Test notification sent to Telegram channel!', 'success');
        } catch (err) {
            if (showToast) showToast('Failed to send Telegram test message', 'error');
        } finally {
            setTestingTelegram(false);
        }
    };

    const handleCreateUserSubmit = async (e) => {
        e.preventDefault();
        if (!newUsername || !newPassword) return;
        setCreatingUser(true);
        try {
            await axios.post('/api/v1/auth/users/create', {
                username: newUsername,
                password: newPassword,
                role: newRole,
                email: newEmail
            }, { headers });
            if (showToast) showToast(`User "${newUsername}" created successfully!`, 'success');
            setShowCreateUserModal(false);
            setNewUsername('');
            setNewPassword('');
            setNewEmail('');
            fetchAllUsers();
        } catch (err) {
            if (showToast) showToast(err.response?.data?.error || 'Failed to create user', 'error');
        } finally {
            setCreatingUser(false);
        }
    };

    const handleUpdateUserSubmit = async (e) => {
        e.preventDefault();
        if (!editingUser) return;
        setUpdatingUserLoading(true);
        try {
            await axios.post('/api/v1/auth/users/update', {
                id: editingUser.id,
                username: editingUser.username,
                display_name: editingUser.display_name,
                first_name: editingUser.first_name,
                last_name: editingUser.last_name,
                email: editingUser.email,
                phone: editingUser.phone,
                role: editingUser.role,
                account_status: editingUser.account_status || 'active'
            }, { headers });
            if (showToast) showToast(`User "${editingUser.username}" profile updated!`, 'success');
            setEditingUser(null);
            fetchAllUsers();
        } catch (err) {
            if (showToast) showToast(err.response?.data?.error || 'Failed to update user', 'error');
        } finally {
            setUpdatingUserLoading(false);
        }
    };

    const handleResetPasswordSubmit = async (e) => {
        e.preventDefault();
        if (!resettingUser || !resetPasswordValue) return;
        setResettingPasswordLoading(true);
        try {
            await axios.post('/api/v1/auth/users/reset-password', {
                id: resettingUser.id,
                newPassword: resetPasswordValue
            }, { headers });
            if (showToast) showToast(`Password for "${resettingUser.username}" reset successfully!`, 'success');
            setResettingUser(null);
            setResetPasswordValue('');
        } catch (err) {
            if (showToast) showToast(err.response?.data?.error || 'Failed to reset password', 'error');
        } finally {
            setResettingPasswordLoading(false);
        }
    };

    const handleAdminDisableMfa = async (user) => {
        if (!window.confirm(`Are you sure you want to remove Two-Factor Authentication (2FA / MFA) for user "${user.username}"? They will be able to log in with password only and reconfigure their authenticator device.`)) return;
        try {
            const res = await axios.post('/api/v1/auth/users/disable-mfa', { id: user.id }, { headers });
            if (showToast) showToast(res.data?.message || `2FA removed for ${user.username}`, 'success');
            if (editingUser) setEditingUser(null);
            fetchAllUsers();
        } catch (err) {
            if (showToast) showToast(err.response?.data?.error || 'Failed to remove 2FA', 'error');
        }
    };

    const handleDeleteUser = async (user) => {
        if (user.username === username) {
            if (showToast) showToast('Cannot delete currently logged in account', 'error');
            return;
        }
        if (!window.confirm(`Permanently remove user account "${user.username}"?`)) return;
        try {
            await axios.post('/api/v1/auth/users/delete', { id: user.id }, { headers });
            if (showToast) showToast(`User "${user.username}" deleted`, 'success');
            fetchAllUsers();
        } catch (err) {
            if (showToast) showToast('Failed to delete user', 'error');
        }
    };

    const tabs = [
        { id: 'branding', label: 'Branding & Interface', icon: <Sparkles size={18} /> },
        { id: 'users', label: 'User Accounts & Roles', icon: <Users size={18} /> },
        { id: 'account', label: 'My Profile & 2FA / MFA', icon: <User size={18} /> },
        { id: 'clock', label: 'Global Clock & Display', icon: <Clock size={18} /> },
        { id: 'telegram', label: 'Email, Discord & Telegram', icon: <Bell size={18} /> },
        { id: 'storage', label: 'Storage & Retention', icon: <HardDrive size={18} /> }
    ];

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', padding: '10px 0' }}>
            {/* Header */}
            <div>
                <h2 style={{ fontSize: '26px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Settings size={28} color="var(--primary)" /> System & Workspace Settings
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Manage cluster accounts, access roles, 2FA/MFA security, branding, clocks, and multi-channel telemetry
                </p>
            </div>

            {/* Layout Grid: Sidebar Tabs + Content Panel */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 260px) 1fr', gap: '24px', alignItems: 'start' }}>
                {/* Settings Navigation Sidebar */}
                <div className="glass" style={{ padding: '12px', borderRadius: '18px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '12px 14px',
                                    borderRadius: '12px',
                                    border: `1px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
                                    background: isActive ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                                    color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                                    fontWeight: isActive ? '800' : '600',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: '0.2s'
                                }}
                            >
                                {tab.icon}
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Settings Content Pane */}
                <div className="glass" style={{ padding: '28px', borderRadius: '22px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)', boxShadow: 'var(--shadow-sm)' }}>
                    <AnimatePresence mode="wait">
                        {/* TAB 1: BRANDING & INTERFACE */}
                        {activeTab === 'branding' && (
                            <motion.div key="branding" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
                                <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Sparkles size={20} color="var(--primary)" /> Workspace Identity & Title
                                </h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>
                                    Customize the organization brand name shown across the sidebar, header, and public share portals.
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '480px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px' }}>Workspace Brand Name</label>
                                        <input
                                            className="m-input"
                                            value={localAppName}
                                            onChange={(e) => setLocalAppName(e.target.value)}
                                            placeholder="NexaDisk"
                                        />
                                    </div>

                                    <button
                                        onClick={handleApplyBranding}
                                        className="btn-primary"
                                        style={{ padding: '10px 18px', fontWeight: '800', borderRadius: '10px', width: 'fit-content' }}
                                    >
                                        Save Brand Settings
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* TAB 2: USER ACCOUNTS & FLEET ROLES */}
                        {activeTab === 'users' && (
                            <motion.div key="users" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                                    <div>
                                        <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Users size={20} color="var(--primary)" /> Cluster User Accounts & Roles
                                        </h3>
                                        <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                                            Manage operator access, create role-based accounts (Admin, Operator, Viewer), and manage security status
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <button
                                            onClick={() => setActiveTab('account')}
                                            className="btn-secondary"
                                            style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            <User size={13} /> My Profile & 2FA (MFA)
                                        </button>
                                        <button
                                            onClick={fetchAllUsers}
                                            className="btn-secondary"
                                            style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '12px' }}
                                            title="Refresh User List"
                                        >
                                            <RefreshCw size={14} className={loadingUsers ? 'spin-anim' : ''} />
                                        </button>
                                        <button
                                            onClick={() => setShowCreateUserModal(true)}
                                            className="btn-primary"
                                            style={{ padding: '8px 16px', fontWeight: '800', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}
                                        >
                                            <Plus size={14} /> Add User
                                        </button>
                                    </div>
                                </div>

                                {loadingUsers ? (
                                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        <RefreshCw size={24} className="spin-anim" style={{ margin: '0 auto 10px' }} />
                                        Loading registered accounts...
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {userList.map(u => {
                                            const isAdmin = u.role === 'Admin' || u.role === 'Administrator';
                                            const roleColor = isAdmin ? 'var(--accent-gold)' : u.role === 'Operator' ? 'var(--primary)' : '#0ea5e9';

                                            return (
                                                <div 
                                                    key={u.id}
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        padding: '14px 18px',
                                                        borderRadius: '12px',
                                                        background: 'var(--bg-surface-2)',
                                                        border: '1px solid var(--border-subtle)',
                                                        flexWrap: 'wrap',
                                                        gap: '12px'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${roleColor}18`, color: roleColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '16px' }}>
                                                            {u.username.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{u.username}</strong>
                                                                {u.display_name && (
                                                                    <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>({u.display_name})</span>
                                                                )}
                                                                <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px', background: `${roleColor}20`, color: roleColor }}>
                                                                    {u.role.toUpperCase()}
                                                                </span>
                                                                {u.username === username && (
                                                                    <span style={{ fontSize: '9px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                                                                        YOU
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                                <span>{u.email || 'No email'}</span>
                                                                <span>•</span>
                                                                <span>Status: <span style={{ textTransform: 'capitalize', fontWeight: '700', color: u.account_status === 'suspended' ? 'var(--accent-red)' : '#10b981' }}>{u.account_status || 'Active'}</span></span>
                                                                <span>•</span>
                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: '800', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: u.mfa_enabled ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-surface-0)', color: u.mfa_enabled ? '#10b981' : 'var(--text-dim)' }}>
                                                                    {u.mfa_enabled ? <ShieldCheck size={11} color="#10b981" /> : <Shield size={11} />}
                                                                    {u.mfa_enabled ? '2FA ON' : '2FA OFF'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                        {u.mfa_enabled && (
                                                            <button
                                                                onClick={() => handleAdminDisableMfa(u)}
                                                                style={{
                                                                    padding: '6px 10px',
                                                                    borderRadius: '8px',
                                                                    background: 'rgba(239, 68, 68, 0.08)',
                                                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                                                    color: '#f87171',
                                                                    fontSize: '11.5px',
                                                                    fontWeight: '700',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    cursor: 'pointer'
                                                                }}
                                                                title="Lost phone / authenticator override: Remove 2FA from this account"
                                                            >
                                                                <ShieldAlert size={12} /> Remove 2FA
                                                            </button>
                                                        )}

                                                        <button
                                                            onClick={() => setEditingUser({ ...u })}
                                                            style={{
                                                                padding: '6px 12px',
                                                                borderRadius: '8px',
                                                                background: 'var(--bg-surface-0)',
                                                                border: '1px solid var(--border-subtle)',
                                                                color: 'var(--text-primary)',
                                                                fontSize: '12px',
                                                                fontWeight: '700',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '5px',
                                                                cursor: 'pointer'
                                                            }}
                                                            title="Edit Profile & Role"
                                                        >
                                                            <Edit size={13} /> Edit
                                                        </button>

                                                        <button
                                                            onClick={() => { setResettingUser(u); setResetPasswordValue(''); }}
                                                            style={{
                                                                padding: '6px 12px',
                                                                borderRadius: '8px',
                                                                background: 'var(--bg-surface-0)',
                                                                border: '1px solid var(--border-subtle)',
                                                                color: 'var(--accent-gold)',
                                                                fontSize: '12px',
                                                                fontWeight: '700',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '5px',
                                                                cursor: 'pointer'
                                                            }}
                                                            title="Reset Password"
                                                        >
                                                            <KeyRound size={13} /> Reset Pass
                                                        </button>

                                                        <button
                                                            onClick={() => handleDeleteUser(u)}
                                                            disabled={u.username === username}
                                                            style={{
                                                                padding: '6px 10px',
                                                                borderRadius: '8px',
                                                                background: 'rgba(239, 68, 68, 0.1)',
                                                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                                                color: '#ef4444',
                                                                cursor: u.username === username ? 'not-allowed' : 'pointer',
                                                                opacity: u.username === username ? 0.3 : 1
                                                            }}
                                                            title="Delete User"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* TAB 3: PERSONAL OPERATOR PROFILE & 2FA / MFA */}
                        {activeTab === 'account' && (
                            <motion.div key="account" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
                                <ProfileSettings />
                            </motion.div>
                        )}

                        {/* TAB 4: GLOBAL CLOCK & DISPLAY */}
                        {activeTab === 'clock' && (
                            <motion.div key="clock" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
                                <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Clock size={20} color="var(--accent-cyan)" /> Topbar Clock & Precision Time
                                </h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>
                                    Control real-time header clock visibility and 24-hour military timestamp format.
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '520px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderRadius: '12px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)' }}>
                                        <div>
                                            <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>Header Real-time Clock</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Show active live clock with date and seconds</div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={showClock}
                                            onChange={(e) => setShowClock(e.target.checked)}
                                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderRadius: '12px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)' }}>
                                        <div>
                                            <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>24-Hour Military Format</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Toggle between 12-hour AM/PM and 24-hour mode</div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={format24h}
                                            onChange={(e) => setFormat24h(e.target.checked)}
                                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* TAB 5: EMAIL, DISCORD & TELEGRAM ALERTS */}
                        {activeTab === 'telegram' && (
                            <motion.div key="telegram" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
                                <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Bell size={20} color="var(--primary)" /> Multi-Channel Notifications & Gateways
                                </h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>
                                    Configure SMTP email delivery for share passkeys & OTPs, plus Discord and Telegram real-time automation webhooks.
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '640px' }}>
                                    {/* SMTP Mail Gateway */}
                                    <div style={{ padding: '20px', borderRadius: '14px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                                <Mail size={18} color="var(--accent-cyan)" /> SMTP Mail Server (Share OTPs & Alerts)
                                            </div>
                                            <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', background: smtpHost ? 'rgba(74, 222, 128, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: smtpHost ? '#4ade80' : '#f87171', fontWeight: '700' }}>
                                                {smtpHost ? 'CONFIGURED' : 'UNCONFIGURED'}
                                            </span>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '10px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-dim)', marginBottom: '4px' }}>SMTP Host Server</label>
                                                <input
                                                    className="m-input"
                                                    placeholder="smtp.gmail.com or mail.domain.com"
                                                    value={smtpHost}
                                                    onChange={(e) => setSmtpHost(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-dim)', marginBottom: '4px' }}>Port</label>
                                                <input
                                                    className="m-input"
                                                    placeholder="587"
                                                    value={smtpPort}
                                                    onChange={(e) => setSmtpPort(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-dim)', marginBottom: '4px' }}>Username / Account Email</label>
                                                <input
                                                    className="m-input"
                                                    placeholder="user@example.com"
                                                    value={smtpUser}
                                                    onChange={(e) => setSmtpUser(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-dim)', marginBottom: '4px' }}>Password / App Passkey</label>
                                                <input
                                                    type="password"
                                                    className="m-input"
                                                    placeholder="••••••••••••"
                                                    value={smtpPass}
                                                    onChange={(e) => setSmtpPass(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'center' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-dim)', marginBottom: '4px' }}>From Email Address (Optional)</label>
                                                <input
                                                    className="m-input"
                                                    placeholder="NexaDisk <noreply@example.com>"
                                                    value={smtpFrom}
                                                    onChange={(e) => setSmtpFrom(e.target.value)}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '16px' }}>
                                                <input
                                                    type="checkbox"
                                                    id="smtpSecureCheck"
                                                    checked={smtpSecure}
                                                    onChange={(e) => setSmtpSecure(e.target.checked)}
                                                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                                />
                                                <label htmlFor="smtpSecureCheck" style={{ fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                                                    Use SSL/TLS (Port 465)
                                                </label>
                                            </div>
                                        </div>

                                        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, minWidth: '240px' }}>
                                                <input
                                                    className="m-input"
                                                    placeholder="Send test email to (e.g. admin@me.com)"
                                                    value={testEmailTarget}
                                                    onChange={(e) => setTestEmailTarget(e.target.value)}
                                                    style={{ fontSize: '12px', padding: '6px 10px' }}
                                                />
                                                <button
                                                    onClick={handleTestSmtp}
                                                    disabled={testingSmtp}
                                                    className="btn-secondary"
                                                    style={{ padding: '7px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                                                >
                                                    {testingSmtp ? 'Sending...' : 'Test SMTP'}
                                                </button>
                                            </div>
                                            <button onClick={handleSaveSmtp} className="btn-primary" style={{ padding: '8px 16px', fontSize: '12px', fontWeight: '700' }}>
                                                Save SMTP Settings
                                            </button>
                                        </div>
                                    </div>

                                    {/* Discord */}
                                    <div style={{ padding: '18px', borderRadius: '14px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>Discord Webhook URL</div>
                                        <input
                                            className="m-input"
                                            placeholder="https://discord.com/api/webhooks/..."
                                            value={discordWebhook}
                                            onChange={(e) => setDiscordWebhook(e.target.value)}
                                        />
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={handleSaveDiscord} className="btn-primary" style={{ padding: '8px 14px', fontSize: '12px', fontWeight: '700' }}>
                                                Save Discord Hook
                                            </button>
                                            <button onClick={handleTestDiscord} disabled={testingDiscord} className="btn-secondary" style={{ padding: '8px 14px', fontSize: '12px' }}>
                                                {testingDiscord ? 'Sending...' : 'Test Discord'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Telegram */}
                                    <div style={{ padding: '18px', borderRadius: '14px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>Telegram Bot Integration</div>
                                        <input
                                            className="m-input"
                                            placeholder="Bot Token (e.g. 123456789:ABCdefGhI...)"
                                            value={telegramToken}
                                            onChange={(e) => setTelegramToken(e.target.value)}
                                        />
                                        <input
                                            className="m-input"
                                            placeholder="Chat ID (e.g. -1001234567890)"
                                            value={telegramChatId}
                                            onChange={(e) => setTelegramChatId(e.target.value)}
                                        />
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={handleSaveTelegram} className="btn-primary" style={{ padding: '8px 14px', fontSize: '12px', fontWeight: '700' }}>
                                                Save Telegram Credentials
                                            </button>
                                            <button onClick={handleTestTelegram} disabled={testingTelegram} className="btn-secondary" style={{ padding: '8px 14px', fontSize: '12px' }}>
                                                {testingTelegram ? 'Sending...' : 'Test Telegram'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* TAB 6: STORAGE & RETENTION */}
                        {activeTab === 'storage' && (
                            <motion.div key="storage" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
                                <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <HardDrive size={20} color="var(--accent-cyan)" /> Storage & Retention Policies
                                </h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>
                                    Configure recycle bin retention lifecycles and background automated file purging.
                                </p>

                                <div style={{ padding: '18px', borderRadius: '14px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>Trash Bin Auto-Purge Lifecycle</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Files in the trash bin are automatically deleted permanently after 30 days.</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#10b981', background: 'rgba(16, 185, 129, 0.12)', padding: '4px 10px', borderRadius: '6px' }}>
                                            Active (30 Days Daily Worker)
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* CREATE USER MODAL */}
            {showCreateUserModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div className="glass" style={{ width: '100%', maxWidth: '440px', background: 'var(--bg-surface-0)', borderRadius: '20px', border: '1px solid var(--border-subtle)', padding: '24px', boxShadow: 'var(--shadow-lg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Users size={18} color="var(--primary)" /> Add Cluster User
                            </h3>
                            <button onClick={() => setShowCreateUserModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><X size={16} /></button>
                        </div>

                        <form onSubmit={handleCreateUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Username *</label>
                                <input className="m-input" required placeholder="e.g. operator1" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Password *</label>
                                <input className="m-input" type="password" required placeholder="Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Access Role</label>
                                <select className="m-input" value={newRole} onChange={e => setNewRole(e.target.value)}>
                                    <option value="Operator">Operator (Upload, Download, Edit)</option>
                                    <option value="Admin">Administrator (Full Access)</option>
                                    <option value="Viewer">Viewer (Read Only)</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Email (Optional)</label>
                                <input className="m-input" type="email" placeholder="user@company.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                                <button type="button" className="btn-secondary" onClick={() => setShowCreateUserModal(false)}>Cancel</button>
                                <button type="submit" disabled={creatingUser} className="btn-primary" style={{ padding: '8px 18px', fontWeight: '800' }}>
                                    {creatingUser ? 'Creating...' : 'Create Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* EDIT USER PROFILE MODAL */}
            {editingUser && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div className="glass" style={{ width: '100%', maxWidth: '520px', background: 'var(--bg-surface-0)', borderRadius: '20px', border: '1px solid var(--border-subtle)', padding: '24px', boxShadow: 'var(--shadow-lg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Edit size={18} color="var(--primary)" /> Edit User: {editingUser.username}
                            </h3>
                            <button onClick={() => setEditingUser(null)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><X size={16} /></button>
                        </div>

                        <form onSubmit={handleUpdateUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Display Name</label>
                                    <input className="m-input" value={editingUser.display_name || ''} onChange={e => setEditingUser({ ...editingUser, display_name: e.target.value })} placeholder="John Doe" />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Access Role</label>
                                    <select className="m-input" value={editingUser.role || 'User'} onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}>
                                        <option value="Admin">Administrator</option>
                                        <option value="Operator">Operator</option>
                                        <option value="User">User</option>
                                        <option value="Viewer">Viewer</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>First Name</label>
                                    <input className="m-input" value={editingUser.first_name || ''} onChange={e => setEditingUser({ ...editingUser, first_name: e.target.value })} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Last Name</label>
                                    <input className="m-input" value={editingUser.last_name || ''} onChange={e => setEditingUser({ ...editingUser, last_name: e.target.value })} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Email</label>
                                    <input className="m-input" type="email" value={editingUser.email || ''} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Phone</label>
                                    <input className="m-input" value={editingUser.phone || ''} onChange={e => setEditingUser({ ...editingUser, phone: e.target.value })} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Account Status</label>
                                <select className="m-input" value={editingUser.account_status || 'active'} onChange={e => setEditingUser({ ...editingUser, account_status: e.target.value })}>
                                    <option value="active">Active (Access Allowed)</option>
                                    <option value="suspended">Suspended (Blocked)</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>

                            {editingUser.mfa_enabled && (
                                <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                    <div>
                                        <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#f87171', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <ShieldAlert size={14} /> 2FA (MFA) Lock Active
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                            Lost device override: Remove 2FA to restore password-only login.
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleAdminDisableMfa(editingUser)}
                                        style={{ padding: '6px 12px', fontSize: '11.5px', fontWeight: '800', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', borderRadius: '8px', cursor: 'pointer' }}
                                    >
                                        Remove 2FA Lock
                                    </button>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                                <button type="button" className="btn-secondary" onClick={() => setEditingUser(null)}>Cancel</button>
                                <button type="submit" disabled={updatingUserLoading} className="btn-primary" style={{ padding: '8px 18px', fontWeight: '800' }}>
                                    {updatingUserLoading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* RESET PASSWORD MODAL */}
            {resettingUser && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div className="glass" style={{ width: '100%', maxWidth: '420px', background: 'var(--bg-surface-0)', borderRadius: '20px', border: '1px solid var(--border-subtle)', padding: '24px', boxShadow: 'var(--shadow-lg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <KeyRound size={18} color="var(--accent-gold)" /> Reset Password: {resettingUser.username}
                            </h3>
                            <button onClick={() => setResettingUser(null)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><X size={16} /></button>
                        </div>

                        <form onSubmit={handleResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>New Password *</label>
                                <input
                                    className="m-input"
                                    type="password"
                                    required
                                    placeholder="Enter new password (min 6 characters)"
                                    value={resetPasswordValue}
                                    onChange={e => setResetPasswordValue(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                                <button type="button" className="btn-secondary" onClick={() => setResettingUser(null)}>Cancel</button>
                                <button type="submit" disabled={resettingPasswordLoading || !resetPasswordValue} className="btn-primary" style={{ padding: '8px 18px', fontWeight: '800', background: 'var(--accent-gold)' }}>
                                    {resettingPasswordLoading ? 'Resetting...' : 'Update Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SystemSettingsView;
