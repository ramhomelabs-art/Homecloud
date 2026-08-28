import React, { useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Bell, Send, CheckCircle2, Loader, 
    ShieldCheck, AlertCircle, Info, Server, User, Sparkles,
    Search, Filter, Trash2, Upload, Download, ShieldAlert, X, 
    Webhook, MessageSquare, Zap, HardDrive, Lock, Shield,
    FileSpreadsheet, FileCode, AlertTriangle, RefreshCw, Radio,
    Volume2, VolumeX, DownloadCloud, Globe
} from 'lucide-react';

// Discord logo SVG as inline component
const DiscordIcon = ({ size = 18, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.11 18.1.128 18.116a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.995a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
);

const AlertManagement = ({ settings = {}, updateSetting, activities = [], showToast, refreshData }) => {
    const [testingTelegram, setTestingTelegram] = useState(false);
    const [testingDiscord, setTestingDiscord] = useState(false);
    const [severityFilter, setSeverityFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [clearing, setClearing] = useState(false);
    const [dismissingIds, setDismissingIds] = useState(new Set());
    const [soundEnabled, setSoundEnabled] = useState(true);

    const handleDismissAlert = async (id) => {
        if (!id) return;
        setDismissingIds(prev => { const next = new Set(prev); next.add(id); return next; });
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post('/api/v1/files/activities/dismiss', { id }, { headers });
            if (showToast) showToast('Alert dismissed', 'success');
            if (refreshData) refreshData();
        } catch (err) {
            if (showToast) showToast('Failed to dismiss alert', 'error');
        } finally {
            setDismissingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
        }
    };

    // Extended Enterprise Event Subsystems
    const alertEvents = [
        { key: 'security_threat',   title: 'Malware & Threat Quarantine', desc: 'Triggered when a file scan flags malicious or suspicious entropy / signatures.',   category: 'Security', icon: <ShieldAlert size={18} color="#f85149" /> },
        { key: 'canary_alert',      title: 'Ransomware Canary Trip',     desc: 'Triggered when autonomous decoy canary honeyfiles detect unauthorized write/wipe.', category: 'Security', icon: <ShieldAlert size={18} color="#e11d48" /> },
        { key: 'fail2ban_ban',      title: 'Perimeter Firewall IP Blacklist', desc: 'Triggered when an IP is automatically banned after brute-force threshold breaches.', category: 'Security', icon: <Lock size={18} color="#f85149" /> },
        { key: 'integrity_mismatch',title: 'SHA-256 Bit-Rot Integrity',   desc: 'Triggered when cryptographic checksum scrubber discovers file data corruption.',   category: 'Storage',  icon: <HardDrive size={18} color="#f59e0b" /> },
        { key: 'sync_failure',      title: 'Sync Task Failure',          desc: 'Triggered when node cluster replication or mirroring encounters errors.',          category: 'Storage',  icon: <AlertCircle size={18} color="#f85149" /> },
        { key: 'sync_success',      title: 'Sync Task Success',          desc: 'Triggered when a scheduled replication or mirror job completes with 0 errors.',     category: 'Storage',  icon: <CheckCircle2 size={18} color="#10b981" /> },
        { key: 'cloud_mount_error', title: 'Cloud & Network Mount Error',desc: 'Triggered when Google Drive, S3 bucket, SMB share, or SFTP loses connectivity.',   category: 'Network',  icon: <Globe size={18} color="#f59e0b" /> },
        { key: 'agent_offline',     title: 'Agent Node Offline',         desc: 'Triggered when a registered agent node heartbeat expires or goes offline.',         category: 'Fleet',    icon: <Server size={18} color="#f59e0b" /> },
        { key: 'file_upload',       title: 'File Uploaded',              desc: 'Triggered when a new file or vault is uploaded to storage nodes.',                  category: 'Files',    icon: <Upload size={18} color="var(--accent-cyan)" /> },
        { key: 'file_download',     title: 'File Downloaded / Shared',   desc: 'Triggered when a file or public link payload is accessed and downloaded.',          category: 'Files',    icon: <Download size={18} color="#10b981" /> },
        { key: 'file_shred',        title: 'DoD 3-Pass File Shredded',   desc: 'Triggered when permanent DoD 5220.22-M 3-pass disk block overwrite completes.',     category: 'Storage',  icon: <Trash2 size={18} color="#f85149" /> },
        { key: 'user_login',        title: 'Operator Login',             desc: 'Triggered when an authenticated operator logs into the cluster.',                   category: 'Access',   icon: <User size={18} color="var(--primary)" /> }
    ];

    const getToggleState = (eventKey, channel) => {
        const key = `alert_${eventKey}_${channel}`;
        if (settings[key] !== undefined) return settings[key] === '1';
        // Defaults
        if (channel === 'telegram') {
            if (eventKey.startsWith('security_') || eventKey.startsWith('canary_') || eventKey.startsWith('fail2ban_') || eventKey.startsWith('sync_failure')) return true;
            return false;
        }
        if (channel === 'discord') return false;
        return true; // in-app defaults ON
    };

    const handleToggle = async (eventKey, channel) => {
        const key = `alert_${eventKey}_${channel}`;
        const currentVal = getToggleState(eventKey, channel);
        await updateSetting(key, currentVal ? '0' : '1');
    };

    const handleSendTestTelegram = async () => {
        setTestingTelegram(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post('/api/v1/system/test-telegram', {}, { headers });
            if (showToast) showToast('Telegram test notification dispatched ✅', 'success');
            if (refreshData) setTimeout(refreshData, 1000);
        } catch (err) {
            if (showToast) showToast('Test failed. Please verify Telegram Bot Token & Chat ID in Settings.', 'error');
        } finally {
            setTestingTelegram(false);
        }
    };

    const handleSendTestDiscord = async () => {
        setTestingDiscord(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post('/api/v1/system/test-discord', {}, { headers });
            if (showToast) showToast('Discord test notification dispatched ✅', 'success');
            if (refreshData) setTimeout(refreshData, 1000);
        } catch (err) {
            if (showToast) showToast('Test failed. Please verify Discord Webhook URL in Settings.', 'error');
        } finally {
            setTestingDiscord(false);
        }
    };

    const handleClearAlerts = async () => {
        if (!window.confirm('Clear all triggered alert history?')) return;
        setClearing(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post('/api/v1/files/activities/clear', {}, { headers });
            if (showToast) showToast('Alert logs cleared successfully', 'success');
            if (refreshData) refreshData();
        } catch (err) {
            if (showToast) showToast('Failed to clear alert logs', 'error');
        } finally {
            setClearing(false);
        }
    };

    const handleExportLogs = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activities, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `nexadisk_incident_alerts_${Date.now()}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        if (showToast) showToast('Incident alerts exported to JSON', 'success');
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return '';
        const d = new Date(timeStr);
        return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString();
    };

    const filteredActivities = (activities || []).filter(act => {
        const name   = act.name   || 'System Notification';
        const status = act.status || act.message || '';
        const severity = act.error || 'info';
        const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) || status.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSeverity = severityFilter === 'all' || severity === severityFilter;
        return matchesSearch && matchesSeverity;
    });

    const counts = {
        total: activities.length,
        errors: activities.filter(a => a.error === 'error').length,
        warnings: activities.filter(a => a.error === 'warning').length,
        infos: activities.filter(a => a.error === 'info' || !a.error).length
    };

    // Toggle Cell
    const ToggleCell = ({ eventKey, channel, color = 'var(--primary)' }) => {
        const active = getToggleState(eventKey, channel);
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <button 
                    type="button"
                    onClick={() => handleToggle(eventKey, channel)}
                    title={active ? `${channel.toUpperCase()} Enabled` : `${channel.toUpperCase()} Disabled`}
                    style={{ 
                        width: '44px',
                        height: '22px',
                        borderRadius: '999px',
                        background: active ? color : 'var(--border-subtle)',
                        border: 'none',
                        position: 'relative',
                        cursor: 'pointer',
                        transition: '0.2s',
                        outline: 'none'
                    }}
                >
                    <div 
                        style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: '#ffffff',
                            position: 'absolute',
                            top: '3px',
                            left: active ? '24px' : '4px',
                            transition: '0.2s'
                        }}
                    />
                </button>
            </div>
        );
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', padding: '10px 0' }}>
            {/* Top Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h2 style={{ fontSize: '26px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Bell size={28} color="var(--primary)" /> Alert & Incident Command Center
                    </h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Manage automated triggers across Telegram, Discord, and in-app logs for storage, fleet, and cyber defense events.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                        onClick={handleExportLogs}
                        className="btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', padding: '8px 14px', borderRadius: '10px', fontWeight: '700' }}
                    >
                        <DownloadCloud size={14} /> Export Logs
                    </button>
                    <button
                        disabled={testingTelegram}
                        onClick={handleSendTestTelegram}
                        className="btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', padding: '8px 14px', borderRadius: '10px', fontWeight: '700', color: '#0ea5e9', border: '1px solid rgba(14,165,233,0.3)' }}
                    >
                        {testingTelegram ? <Loader size={14} className="spin-anim" /> : <Send size={14} />} Test Telegram
                    </button>
                    <button
                        disabled={testingDiscord}
                        onClick={handleSendTestDiscord}
                        className="btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', padding: '8px 14px', borderRadius: '10px', fontWeight: '700', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)' }}
                    >
                        {testingDiscord ? <Loader size={14} className="spin-anim" /> : <DiscordIcon size={14} color="#6366f1" />} Test Discord
                    </button>
                </div>
            </div>

            {/* Subsystem Health / Status Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div className="glass" style={{ padding: '16px 18px', borderRadius: '14px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(14, 165, 233, 0.12)', color: '#0ea5e9' }}>
                        <Send size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Telegram Bot</div>
                        <div style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
                            {settings.telegramBotToken ? '🟢 Configured' : '⚪ Not Set'}
                        </div>
                    </div>
                </div>

                <div className="glass" style={{ padding: '16px 18px', borderRadius: '14px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1' }}>
                        <DiscordIcon size={20} color="#6366f1" />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Discord Webhook</div>
                        <div style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
                            {settings.discordWebhookUrl ? '🟢 Configured' : '⚪ Not Set'}
                        </div>
                    </div>
                </div>

                <div className="glass" style={{ padding: '16px 18px', borderRadius: '14px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
                        <ShieldAlert size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Critical Incidents</div>
                        <div style={{ fontSize: '13.5px', fontWeight: '800', color: counts.errors > 0 ? '#f85149' : '#10b981', marginTop: '2px' }}>
                            {counts.errors} Unresolved Threats
                        </div>
                    </div>
                </div>

                <div className="glass" style={{ padding: '16px 18px', borderRadius: '14px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                        <Bell size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Total Alerts Logged</div>
                        <div style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
                            {counts.total} Recorded Events
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Layout Grid: Event Channels Matrix + Live Incident Feed */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px', alignItems: 'start' }}>
                {/* Event Matrix */}
                <div className="glass" style={{ padding: '24px', borderRadius: '18px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)' }}>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Zap size={18} color="var(--primary)" /> Multi-Channel Trigger Matrix
                    </h3>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
                        Activate alerts individually per channel for high-priority cluster and security events.
                    </p>

                    {/* Table Header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr', alignItems: 'center', padding: '0 12px 10px 12px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Subsystem Event</span>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#0ea5e9', textTransform: 'uppercase', textAlign: 'center' }}>Telegram</span>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#6366f1', textTransform: 'uppercase', textAlign: 'center' }}>Discord</span>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#10b981', textTransform: 'uppercase', textAlign: 'center' }}>In-App</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '580px', overflowY: 'auto' }}>
                        {alertEvents.map((evt) => (
                            <div 
                                key={evt.key}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '2.5fr 1fr 1fr 1fr',
                                    alignItems: 'center',
                                    padding: '12px 14px',
                                    borderRadius: '10px',
                                    background: 'var(--bg-surface-2)',
                                    border: '1px solid var(--border-subtle)'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                    <div style={{ padding: '6px', borderRadius: '8px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                                        {evt.icon}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {evt.title}
                                        </div>
                                        <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {evt.desc}
                                        </div>
                                    </div>
                                </div>
                                <ToggleCell eventKey={evt.key} channel="telegram" color="#0ea5e9" />
                                <ToggleCell eventKey={evt.key} channel="discord" color="#6366f1" />
                                <ToggleCell eventKey={evt.key} channel="inapp" color="#10b981" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Live Incident & Activity Log Feed */}
                <div className="glass" style={{ padding: '24px', borderRadius: '18px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', height: '690px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ShieldCheck size={18} color="var(--primary)" /> Incident & Event Feed
                        </h3>
                        {filteredActivities.length > 0 && (
                            <button
                                onClick={handleClearAlerts}
                                disabled={clearing}
                                style={{ background: 'transparent', border: 'none', color: '#f85149', cursor: 'pointer', fontSize: '11.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                <Trash2 size={13} /> Clear All
                            </button>
                        )}
                    </div>

                    {/* Filter Pills & Search */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '6px 10px' }}>
                            <Search size={14} color="var(--text-dim)" />
                            <input 
                                placeholder="Search incidents, files, IPs..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '12px', width: '100%' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {[
                                { id: 'all', label: `All (${counts.total})` },
                                { id: 'error', label: `🚨 Critical (${counts.errors})`, color: '#f85149' },
                                { id: 'warning', label: `⚠️ Warning (${counts.warnings})`, color: '#f59e0b' },
                                { id: 'info', label: `ℹ️ Info (${counts.infos})`, color: '#0ea5e9' }
                            ].map(filter => {
                                const isActive = severityFilter === filter.id;
                                return (
                                    <button
                                        key={filter.id}
                                        onClick={() => setSeverityFilter(filter.id)}
                                        style={{
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            border: `1px solid ${isActive ? (filter.color || 'var(--primary)') : 'var(--border-subtle)'}`,
                                            background: isActive ? `${filter.color || 'var(--primary)'}18` : 'var(--bg-surface-2)',
                                            color: isActive ? (filter.color || 'var(--primary)') : 'var(--text-secondary)',
                                            fontSize: '11px',
                                            fontWeight: '800',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {filter.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Scrollable Feed List */}
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {filteredActivities.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim)', fontSize: '13px' }}>
                                <ShieldCheck size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                                No incident alerts matching current criteria.
                            </div>
                        ) : (
                            filteredActivities.map((act) => {
                                const isError = act.error === 'error';
                                const isWarning = act.error === 'warning';
                                const badgeColor = isError ? '#f85149' : isWarning ? '#f59e0b' : '#0ea5e9';
                                const borderColor = isError ? '#f85149' : isWarning ? '#f59e0b' : 'var(--primary)';

                                return (
                                    <div 
                                        key={act.id}
                                        style={{
                                            padding: '12px 14px',
                                            borderRadius: '10px',
                                            background: 'var(--bg-surface-2)',
                                            borderLeft: `4px solid ${borderColor}`,
                                            borderTop: '1px solid var(--border-subtle)',
                                            borderRight: '1px solid var(--border-subtle)',
                                            borderBottom: '1px solid var(--border-subtle)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '4px'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <strong style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>{act.name}</strong>
                                                <span style={{ fontSize: '9px', fontWeight: '800', padding: '1px 6px', borderRadius: '4px', background: `${badgeColor}18`, color: badgeColor, textTransform: 'uppercase' }}>
                                                    {act.error || 'INFO'}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                                    {formatTime(act.timestamp)}
                                                </span>
                                                <button
                                                    onClick={() => handleDismissAlert(act.id)}
                                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '2px' }}
                                                    title="Dismiss Alert"
                                                >
                                                    <X size={13} />
                                                </button>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4', wordBreak: 'break-word', whiteSpace: 'pre-line' }}>
                                            {act.status || act.message}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AlertManagement;
