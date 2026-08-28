import React, { useState } from 'react';
import axios from 'axios';
import { 
    Bell, Send, CheckCircle2, ToggleLeft, ToggleRight, Loader, 
    ShieldCheck, AlertCircle, Info, RefreshCw, Server, User, Sparkles,
    Search, Filter, Trash2
} from 'lucide-react';

const AlertManagement = ({ settings, updateSetting, activities, showToast, refreshData }) => {
    const [testing, setTesting] = useState(false);
    const [severityFilter, setSeverityFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [clearing, setClearing] = useState(false);

    const alertEvents = [
        {
            key: 'sync_success',
            title: 'Sync Task Success',
            desc: 'Triggered when a replication or mirror task completes successfully.',
            icon: <CheckCircle2 size={18} color="#27ae60" />
        },
        {
            key: 'sync_failure',
            title: 'Sync Task Failure',
            desc: 'Triggered when a replication or mirror task encounters errors or fails.',
            icon: <AlertCircle size={18} color="#eb5757" />
        },
        {
            key: 'ai_organize',
            title: 'AI Folder Organization',
            desc: 'Triggered when the AI Automator completes folder categorization.',
            icon: <Sparkles size={18} color="var(--accent-cyan)" />
        },
        {
            key: 'ai_clean',
            title: 'AI Temporary Logs Clean',
            desc: 'Triggered when the AI Automator sweeps and deletes temp/junk files.',
            icon: <Sparkles size={18} color="var(--accent-gold)" />
        },
        {
            key: 'agent_offline',
            title: 'Agent Node Offline',
            desc: 'Triggered when a registered agent node transitions to offline or unreachable.',
            icon: <Server size={18} color="#f2c94c" />
        },
        {
            key: 'user_login',
            title: 'Operator Login',
            desc: 'Triggered when any user account signs in successfully.',
            icon: <User size={18} color="#9b51e0" />
        }
    ];

    const getToggleState = (eventKey, channel) => {
        const key = `alert_${eventKey}_${channel}`;
        if (settings[key] !== undefined) {
            return settings[key] === '1';
        }
        // Legacy fallback settings
        if (channel === 'telegram') {
            if (eventKey.startsWith('sync_')) return settings.telegramNotifySync === '1';
            if (eventKey.startsWith('ai_')) return settings.telegramNotifyAi === '1';
            return false;
        }
        return true; // Default in-app notifications to ON
    };

    const handleToggle = async (eventKey, channel) => {
        const key = `alert_${eventKey}_${channel}`;
        const currentVal = getToggleState(eventKey, channel);
        const nextVal = currentVal ? '0' : '1';
        await updateSetting(key, nextVal);
    };

    const handleSendTestAlert = async () => {
        setTesting(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post('/api/system/test-alert', {}, { headers });
            showToast('Test notification dispatched', 'success');
            if (refreshData) setTimeout(refreshData, 1000);
        } catch (err) {
            console.error('Failed to send test notification', err);
            showToast('Test failed. Please verify Telegram Credentials in settings.', 'error');
        } finally {
            setTesting(false);
        }
    };

    const handleClearAlerts = async () => {
        if (!window.confirm('Are you sure you want to clear all triggered alerts history?')) return;
        setClearing(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post('/api/files/activities/clear', {}, { headers });
            showToast('Alert logs cleared successfully', 'success');
            if (refreshData) refreshData();
        } catch (err) {
            console.error('Failed to clear alert logs', err);
            showToast('Failed to clear alert logs', 'error');
        } finally {
            setClearing(false);
        }
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return '';
        const d = new Date(timeStr);
        return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString();
    };

    const filteredActivities = (activities || []).filter(act => {
        const name = act.name || 'System Notification';
        const status = act.status || act.message || '';
        const severity = act.error || 'info';

        const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              status.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesSeverity = severityFilter === 'all' || severity === severityFilter;

        return matchesSearch && matchesSeverity;
    });

    return (
        <div style={{ padding: '0 10px', height: '100%', overflowY: 'auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h2 style={{ fontSize: '28px', fontWeight: '800', margin: 0 }}>System Alert Control Room</h2>
                    <p style={{ color: '#8b949e', marginTop: '4px', margin: 0 }}>Configure channels and select triggers for automated Telegram notifications and in-app system alerts</p>
                </div>
                <button 
                    disabled={testing}
                    onClick={handleSendTestAlert}
                    className="btn-primary shadow-premium" 
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '12px', padding: '10px 20px', fontWeight: '800' }}
                >
                    {testing ? <Loader size={16} style={{ animation: 'spin 1.5s linear infinite' }} /> : <Send size={16} />}
                    Send Test Alert
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.1fr', gap: '24px', alignItems: 'start', marginBottom: '40px' }}>
                {/* Alert Rules Selection Matrix */}
                <div className="st-card-wide glass" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Bell size={20} color="var(--accent-gold)" /> Event Channels Matrix
                    </h3>
                    <p style={{ fontSize: '12px', color: '#8b949e', marginBottom: '24px', margin: '0 0 24px 0' }}>
                        Configure triggers on individual event levels. Disabled channels will suppress notifications for that specific category.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {alertEvents.map((evt) => {
                            const isTel = getToggleState(evt.key, 'telegram');
                            const isInApp = getToggleState(evt.key, 'inapp');

                            return (
                                <div key={evt.key} style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: '3.2fr 1.1fr 1.1fr', 
                                    alignItems: 'center', 
                                    background: 'rgba(255, 255, 255, 0.015)', 
                                    padding: '16px', 
                                    borderRadius: '12px', 
                                    border: '1px solid rgba(255,255,255,0.03)' 
                                }}>
                                    {/* Info */}
                                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                                        <div style={{ 
                                            background: 'rgba(255,255,255,0.03)', 
                                            padding: '10px', 
                                            borderRadius: '8px', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            marginTop: '2px'
                                        }}>
                                            {evt.icon}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>{evt.title}</div>
                                            <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '2px', lineHeight: '1.4' }}>{evt.desc}</div>
                                        </div>
                                    </div>

                                    {/* Telegram Toggle */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Telegram</span>
                                        <button 
                                            onClick={() => handleToggle(evt.key, 'telegram')}
                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                                        >
                                            {isTel ? (
                                                <ToggleRight size={32} color="var(--accent-gold)" />
                                            ) : (
                                                <ToggleLeft size={32} color="rgba(255,255,255,0.2)" />
                                            )}
                                        </button>
                                    </div>

                                    {/* In-App Toggle */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>In-App Log</span>
                                        <button 
                                            onClick={() => handleToggle(evt.key, 'inapp')}
                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                                        >
                                            {isInApp ? (
                                                <ToggleRight size={32} color="var(--accent-cyan)" />
                                            ) : (
                                                <ToggleLeft size={32} color="rgba(255,255,255,0.2)" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Live System Alerts Log */}
                <div className="st-card-wide glass" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', height: '600px', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ShieldCheck size={20} color="var(--accent-cyan)" /> Triggered Activity Log
                    </h3>
                    <p style={{ fontSize: '12px', color: '#8b949e', marginBottom: '16px', margin: '0 0 16px 0' }}>
                        Real-time feed showing recent system alerts recorded locally.
                    </p>

                    {/* Filter and Search Controls */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                        <div style={{ 
                            flex: 1, 
                            display: 'flex', 
                            alignItems: 'center', 
                            background: 'rgba(255, 255, 255, 0.02)', 
                            border: '1px solid rgba(255,255,255,0.05)', 
                            borderRadius: '8px', 
                            padding: '6px 10px', 
                            gap: '8px' 
                        }}>
                            <Search size={14} color="#8b949e" />
                            <input 
                                type="text"
                                placeholder="Search logs..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ 
                                    background: 'transparent', 
                                    border: 'none', 
                                    outline: 'none', 
                                    color: '#fff', 
                                    fontSize: '12px', 
                                    width: '100%' 
                                }}
                            />
                        </div>

                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            background: 'rgba(255, 255, 255, 0.02)', 
                            border: '1px solid rgba(255,255,255,0.05)', 
                            borderRadius: '8px', 
                            padding: '6px 10px', 
                            gap: '6px' 
                        }}>
                            <Filter size={14} color="#8b949e" />
                            <select
                                value={severityFilter}
                                onChange={e => setSeverityFilter(e.target.value)}
                                style={{ 
                                    background: 'transparent', 
                                    border: 'none', 
                                    outline: 'none', 
                                    color: '#fff', 
                                    fontSize: '12px', 
                                    cursor: 'pointer' 
                                }}
                            >
                                <option value="all" style={{ background: '#161b22', color: '#fff' }}>All</option>
                                <option value="info" style={{ background: '#161b22', color: '#fff' }}>Info</option>
                                <option value="warning" style={{ background: '#161b22', color: '#fff' }}>Warn</option>
                                <option value="error" style={{ background: '#161b22', color: '#fff' }}>Error</option>
                            </select>
                        </div>

                        <button
                            disabled={clearing || !activities || activities.length === 0}
                            onClick={handleClearAlerts}
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                background: 'rgba(235, 87, 87, 0.08)', 
                                border: '1px solid rgba(235, 87, 87, 0.15)', 
                                borderRadius: '8px', 
                                padding: '6px 12px', 
                                cursor: (clearing || !activities || activities.length === 0) ? 'not-allowed' : 'pointer',
                                opacity: (clearing || !activities || activities.length === 0) ? 0.4 : 1,
                                color: '#eb5757',
                                transition: 'background-color 0.2s'
                            }}
                            title="Clear Logs"
                        >
                            {clearing ? <Loader size={14} style={{ animation: 'spin 1.5s linear infinite' }} /> : <Trash2 size={14} />}
                        </button>
                    </div>

                    {/* Alert List Container */}
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
                        {filteredActivities.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '60px', opacity: 0.4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                                <Info size={32} style={{ marginBottom: '12px' }} />
                                <p style={{ margin: 0, fontSize: '13px' }}>No alert history matches filters</p>
                            </div>
                        ) : (
                            filteredActivities.map((act, idx) => {
                                let typeBg = 'rgba(255,255,255,0.015)';
                                let borderCol = 'rgba(255,255,255,0.04)';
                                let sideBarCol = 'rgba(255,255,255,0.1)';
                                let severityBadgeBg = 'rgba(255,255,255,0.04)';
                                let severityBadgeText = '#8b949e';

                                const severity = act.error || 'info';
                                if (severity === 'warning') {
                                    typeBg = 'rgba(242, 201, 76, 0.02)';
                                    borderCol = 'rgba(242, 201, 76, 0.08)';
                                    sideBarCol = '#f2c94c';
                                    severityBadgeBg = 'rgba(242, 201, 76, 0.1)';
                                    severityBadgeText = '#f2c94c';
                                } else if (severity === 'error') {
                                    typeBg = 'rgba(235, 87, 87, 0.02)';
                                    borderCol = 'rgba(235, 87, 87, 0.08)';
                                    sideBarCol = '#eb5757';
                                    severityBadgeBg = 'rgba(235, 87, 87, 0.1)';
                                    severityBadgeText = '#eb5757';
                                } else if (severity === 'info') {
                                    typeBg = 'rgba(45, 156, 219, 0.02)';
                                    borderCol = 'rgba(45, 156, 219, 0.08)';
                                    sideBarCol = 'var(--accent-cyan)';
                                    severityBadgeBg = 'rgba(45, 156, 219, 0.1)';
                                    severityBadgeText = 'var(--accent-cyan)';
                                }

                                const title = act.name || 'System Notification';
                                const detail = act.status || act.message || '';

                                return (
                                    <div key={act.id || idx} style={{ 
                                        padding: '12px 14px', 
                                        borderRadius: '8px', 
                                        background: typeBg,
                                        border: `1px solid ${borderCol}`,
                                        borderLeft: `4px solid ${sideBarCol}`,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <strong style={{ fontSize: '13px', color: '#fff' }}>{title}</strong>
                                                <span style={{ 
                                                    fontSize: '9px', 
                                                    fontWeight: '800', 
                                                    textTransform: 'uppercase', 
                                                    padding: '1px 5px', 
                                                    borderRadius: '3px', 
                                                    background: severityBadgeBg, 
                                                    color: severityBadgeText 
                                                }}>
                                                    {severity}
                                                </span>
                                            </div>
                                            <span style={{ fontSize: '10px', color: '#8b949e' }}>{formatTime(act.timestamp)}</span>
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#c9d1d9', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>{detail}</div>
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
