import React, { useState, useEffect } from 'react';
import { 
    Search, Bell, Activity, ShieldCheck, User, Trash2, Folder, File, RotateCcw,
    LayoutDashboard, FolderTree, Star, Cpu, Link2, Globe, RefreshCw, Sparkles,
    Settings, Clock, X, Menu, Sun, Moon, Wifi, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import Avatar from '../profile/Avatar';

const LiveClock = ({ format24h = true }) => {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="header-clock">
            <div className="header-clock-time">
                {time.toLocaleTimeString('en-US', { hour12: !format24h })}
            </div>
            <div className="header-clock-date">
                {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '')}
            </div>
        </div>
    );
};

const staticOptions = [
    // Navigation / Pages
    { type: 'nav', label: 'Dashboard', category: 'Pages', view: 'dashboard', description: 'Real-time telemetry and active operations' },
    { type: 'nav', label: 'File Explorer', category: 'Pages', view: 'browse', description: 'Exposed folders and active device partitions' },
    { type: 'nav', label: 'Starred Files', category: 'Pages', view: 'starred', description: 'Quick access for flagged items' },
    { type: 'nav', label: 'Trash Bin', category: 'Pages', view: 'trash', description: 'Recycle bin and purged storage files' },
    { type: 'nav', label: 'Machines Fleet', category: 'Pages', view: 'machines', description: 'Manage approved nodes and provisioning' },
    { type: 'nav', label: 'Cluster Monitor', category: 'Pages', view: 'monitor', description: 'Live telemetry diagnostics console log stream' },
    { type: 'nav', label: 'Active Share Links', category: 'Pages', view: 'active_shares', description: 'Clipboard URLs and access expirations' },
    { type: 'nav', label: 'Network Mounts', category: 'Pages', view: 'network', description: 'Mount CIFS, SMB and NFS shares' },
    { type: 'nav', label: 'Wireless Settings', category: 'Pages', view: 'wifi', description: 'Configure SSID, encryption and frequency bands' },
    { type: 'nav', label: 'Sync Center', category: 'Pages', view: 'sync', description: 'Automated mirror directories sync' },
    { type: 'nav', label: 'Security Center (SOC)', category: 'Pages', view: 'security', roleRequired: ['Admin', 'Administrator', 'Operator'], description: 'Security scan history, quarantines, and threats' },
    { type: 'nav', label: 'Alert Management', category: 'Pages', view: 'alerts', description: 'Configuring system webhooks and notification rules' },
    { type: 'nav', label: 'My Profile settings', category: 'Pages', view: 'profile', description: 'Reset password, recovery codes, and profile details' },
    { type: 'nav', label: 'System Settings', category: 'Pages', view: 'settings', description: 'Branding options, application name and clock formats' },

    // Settings Quick Actions
    { type: 'action', label: 'Toggle Global Clock display', category: 'Settings Actions', actionKey: 'toggleClock', description: 'Show or hide the top clock panel' },
    { type: 'action', label: 'Toggle 24-Hour clock format', category: 'Settings Actions', actionKey: 'toggleFormat', description: 'Switch between 12h and 24h formats' },
    { type: 'action', label: 'Edit Application Name branding', category: 'Settings Actions', view: 'settings', description: 'Change the custom logo name across views' },
    { type: 'action', label: 'Change Account Password', category: 'Settings Actions', view: 'profile', description: 'Update profile login keys' },
    { type: 'action', label: 'Scan & Purge Temp Cache', category: 'Settings Actions', view: 'profile', description: 'Analyze storage metrics and clean logs' },
    { type: 'action', label: 'Configure n8n Webhook Url', category: 'Settings Actions', view: 'alerts', description: 'Setup automation event targets' },
    { type: 'action', label: 'Setup Telegram Notifications channel', category: 'Settings Actions', view: 'alerts', description: 'Set bot keys and chat identifier targets' }
];

const getOptionIcon = (opt) => {
    if (opt.view === 'dashboard') return <LayoutDashboard size={16} />;
    if (opt.view === 'browse') return <FolderTree size={16} />;
    if (opt.view === 'starred') return <Star size={16} />;
    if (opt.view === 'trash') return <Trash2 size={16} />;
    if (opt.view === 'machines') return <Cpu size={16} />;
    if (opt.view === 'monitor') return <Activity size={16} />;
    if (opt.view === 'active_shares') return <Link2 size={16} />;
    if (opt.view === 'network') return <Globe size={16} />;
    if (opt.view === 'sync') return <RefreshCw size={16} />;
    if (opt.view === 'security') return <ShieldCheck size={16} />;
    if (opt.view === 'alerts') return <Bell size={16} />;
    if (opt.view === 'profile') return <User size={16} />;
    if (opt.view === 'settings') return <Settings size={16} />;
    if (opt.actionKey === 'toggleClock') return <Clock size={16} />;
    if (opt.actionKey === 'toggleFormat') return <Clock size={16} />;
    return <Settings size={16} />;
};

const getParentPath = (filePath) => {
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    if (lastSlash === -1) return '/';
    return filePath.substring(0, lastSlash) || '/';
};

export default function Header({
    guestToken,
    guestPermissions,
    filterText,
    setFilterText,
    showClock,
    setShowClock,
    format24h,
    setFormat24h,
    showNotifications,
    setShowNotifications,
    activities = [],
    lastSeenAlertTime,
    setLastSeenAlertTime,
    view,
    setView,
    operations = [],
    setShowOperations,
    currentUser,
    username,
    token,
    showToast,
    trashItems = [],
    setTrashItems,
    fetchTrashItems,
    starredItems = [],
    setStarredItems,
    fetchStarredItems,
    setPath,
    selectedDevice,
    mobileOpen = false,
    setMobileOpen
}) {
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
    const [showTrashDropdown, setShowTrashDropdown] = useState(false);
    const [showStarredDropdown, setShowStarredDropdown] = useState(false);
    const [query, setQuery] = useState('');
    const [fileResults, setFileResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    const hasQuery = query.trim() !== '';
    const filteredNavs = staticOptions
        .filter(opt => opt.type === 'nav')
        .filter(opt => {
            if (opt.roleRequired && currentUser && !opt.roleRequired.includes(currentUser.role)) return false;
            if (!hasQuery) {
                // Show default favorites when empty
                return ['Dashboard', 'File Explorer', 'Starred Files', 'Trash Bin', 'My Profile settings'].includes(opt.label);
            }
            const matchStr = `${opt.label} ${opt.description || ''}`.toLowerCase();
            return matchStr.includes(query.toLowerCase());
        });

    const filteredActions = staticOptions
        .filter(opt => opt.type === 'action')
        .filter(opt => {
            if (!hasQuery) {
                // Show default actions when empty
                return ['Toggle Global Clock display', 'Toggle 24-Hour clock format'].includes(opt.label);
            }
            const matchStr = `${opt.label} ${opt.description || ''}`.toLowerCase();
            return matchStr.includes(query.toLowerCase());
        });

    const handleOptionClick = (opt) => {
        if (opt.type === 'nav') {
            setView(opt.view);
        } else if (opt.type === 'action') {
            if (opt.view) setView(opt.view);
            if (opt.actionKey === 'toggleClock' && setShowClock) {
                setShowClock(prev => {
                    const newVal = !prev;
                    localStorage.setItem('showClock', newVal);
                    return newVal;
                });
                if (showToast) showToast("Toggled Global Clock display", "info");
            } else if (opt.actionKey === 'toggleFormat' && setFormat24h) {
                setFormat24h(prev => {
                    const newVal = !prev;
                    localStorage.setItem('format24h', newVal);
                    return newVal;
                });
                if (showToast) showToast("Toggled 24-hour clock format", "info");
            }
        }
        setShowSearchDropdown(false);
        setQuery('');
        setFilterText('');
    };

    const handleFileClick = (file) => {
        if (file.isDirectory) {
            if (setPath) setPath(file.path);
            setFilterText('');
        } else {
            const parentPath = getParentPath(file.path);
            if (setPath) setPath(parentPath);
            setFilterText(file.name);
        }
        setView('browse');
        setShowSearchDropdown(false);
        setQuery('');
    };

    const handleRestoreItem = async (id) => {
        try {
            const res = await axios.post(`/api/v1/trash/restore/${id}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (showToast) showToast(res.data.message || 'Item restored successfully.', 'success');
            setTrashItems(prev => prev.filter(item => item.id !== id));
        } catch (err) {
            if (showToast) showToast(err.response?.data?.error || 'Failed to restore item.', 'error');
        }
    };

    const handleDeleteItem = async (id) => {
        try {
            const res = await axios.delete(`/api/v1/trash/permanent/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (showToast) showToast(res.data.message || 'Item permanently deleted.', 'success');
            setTrashItems(prev => prev.filter(item => item.id !== id));
        } catch (err) {
            if (showToast) showToast(err.response?.data?.error || 'Failed to delete item.', 'error');
        }
    };

    const handleUnstarItem = async (e, item) => {
        e.stopPropagation();
        try {
            await axios.delete(`/api/v1/social/star?path=${encodeURIComponent(item.path)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (setStarredItems) {
                setStarredItems(prev => prev.filter(i => i.id !== item.id));
            }
            if (showToast) showToast(`Removed "${item.name}" from starred`, 'success');
        } catch (e) {
            if (showToast) showToast('Failed to unstar', 'error');
        }
    };

    useEffect(() => {
        if (token && !guestToken) {
            if (fetchTrashItems) fetchTrashItems();
            if (fetchStarredItems) fetchStarredItems();
        }
    }, [token, guestToken]);

    // Global File Search Debounce Effect
    useEffect(() => {
        if (!query || query.trim().length < 2) {
            setFileResults([]);
            return;
        }
        const delayDebounceFn = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const agentParam = selectedDevice ? `&agentId=${selectedDevice.id}` : '';
                const res = await axios.get(`/api/v1/files/search?query=${encodeURIComponent(query)}${agentParam}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setFileResults(res.data);
            } catch (e) {
                console.error('File search error', e);
            } finally {
                setSearchLoading(false);
            }
        }, 250);

        return () => clearTimeout(delayDebounceFn);
    }, [query, selectedDevice, token]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showSearchDropdown && !event.target.closest('.search-container')) {
                setShowSearchDropdown(false);
            }
            if (showTrashDropdown && !event.target.closest('.trash-dropdown-container')) {
                setShowTrashDropdown(false);
            }
            if (showNotifications && !event.target.closest('.notifications-dropdown-container')) {
                setShowNotifications(false);
            }
            if (showStarredDropdown && !event.target.closest('.starred-dropdown-container')) {
                setShowStarredDropdown(false);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [showSearchDropdown, showTrashDropdown, showNotifications, showStarredDropdown, setShowNotifications]);

    const unreadCount = activities.filter(act => new Date(act.timestamp) > new Date(lastSeenAlertTime)).length;

    const handleBellClick = (e) => {
        e.stopPropagation();
        setShowNotifications(!showNotifications);
        setShowTrashDropdown(false);
        setShowStarredDropdown(false);
        if (!showNotifications && setLastSeenAlertTime) {
            // Update last seen alert time to now
            setLastSeenAlertTime(new Date().toISOString());
        }
    };

    const handleTrashClick = async (e) => {
        e.stopPropagation();
        setShowTrashDropdown(!showTrashDropdown);
        setShowNotifications(false);
        setShowStarredDropdown(false);
        if (!showTrashDropdown && token && fetchTrashItems) {
            fetchTrashItems();
        }
    };

    const handleStarredClick = async (e) => {
        e.stopPropagation();
        setShowStarredDropdown(!showStarredDropdown);
        setShowNotifications(false);
        setShowTrashDropdown(false);
        if (!showStarredDropdown && token && fetchStarredItems) {
            fetchStarredItems();
        }
    };

    return (
        <>
            {!(guestToken && guestPermissions === 'Upload') && (
                <header className="top-bar">
                    <div className="top-bar-left">
                        <button 
                            className="mobile-menu-toggle"
                            onClick={() => setMobileOpen && setMobileOpen(!mobileOpen)}
                            title="Toggle Navigation Menu"
                        >
                            <Menu size={20} />
                        </button>
                    </div>

                    {!guestToken ? (
                        <div className="search-container" style={{ position: 'relative' }}>
                            <div className="search-bar">
                                <Search size={18} color="#8b949e" />
                                <input 
                                    placeholder="Search files, nodes, or commands..." 
                                    value={query} 
                                    onChange={e => {
                                        const val = e.target.value;
                                        setQuery(val);
                                        setShowSearchDropdown(true);
                                        if (view === 'browse') {
                                            setFilterText(val);
                                        }
                                    }}
                                    onFocus={() => setShowSearchDropdown(true)}
                                />
                            </div>

                            <AnimatePresence>
                                {showSearchDropdown && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        transition={{ duration: 0.15 }}
                                        className="search-dropdown"
                                    >
                                        <div className="search-dropdown-content">
                                            {/* Pages Section */}
                                            {filteredNavs.length > 0 && (
                                                <>
                                                    <div className="search-section-title">Pages</div>
                                                    {filteredNavs.map((opt, idx) => (
                                                        <div key={`nav-${idx}`} className="search-item" onClick={() => handleOptionClick(opt)}>
                                                            <div className="search-item-icon">
                                                                {getOptionIcon(opt)}
                                                            </div>
                                                            <div className="search-item-info">
                                                                <span className="search-item-title">{opt.label}</span>
                                                                <span className="search-item-desc">{opt.description}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </>
                                            )}

                                            {/* Actions Section */}
                                            {filteredActions.length > 0 && (
                                                <>
                                                    <div className="search-section-title">Settings & Actions</div>
                                                    {filteredActions.map((opt, idx) => (
                                                        <div key={`act-${idx}`} className="search-item" onClick={() => handleOptionClick(opt)}>
                                                            <div className="search-item-icon">
                                                                {getOptionIcon(opt)}
                                                            </div>
                                                            <div className="search-item-info">
                                                                <span className="search-item-title">{opt.label}</span>
                                                                <span className="search-item-desc">{opt.description}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </>
                                            )}

                                            {/* Global Files Section */}
                                            {query.trim().length >= 2 && (
                                                <>
                                                    <div className="search-section-title">
                                                        Files & Folders {selectedDevice ? `(on ${selectedDevice.name})` : '(Local)'}
                                                    </div>
                                                    {searchLoading ? (
                                                        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                                                            Searching file system...
                                                        </div>
                                                    ) : fileResults.length === 0 ? (
                                                        <div className="search-no-results">No matching files found.</div>
                                                    ) : (
                                                        fileResults.slice(0, 15).map((file, idx) => (
                                                            <div key={`file-${idx}`} className="search-item" onClick={() => handleFileClick(file)}>
                                                                <div className="search-item-icon">
                                                                    {file.isDirectory ? (
                                                                        <Folder size={16} color="var(--accent-gold)" />
                                                                    ) : (
                                                                        <File size={16} color="var(--accent-cyan)" />
                                                                    )}
                                                                </div>
                                                                <div className="search-item-info">
                                                                    <span className="search-item-title">{file.name}</span>
                                                                    <span className="search-item-desc" style={{ fontFamily: 'monospace', fontSize: '10px' }}>
                                                                        {file.path || '/'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </>
                                            )}

                                            {filteredNavs.length === 0 && filteredActions.length === 0 && (query.trim().length < 2 || fileResults.length === 0) && (
                                                <div className="search-no-results">No matches found for "{query}"</div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ) : (
                        <div style={{ flex: 1 }} />
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {!guestToken && showClock && <LiveClock format24h={format24h} />}

                        {/* Next-Gen Cyber Theme Switcher */}
                        {!guestToken && (
                            <button
                                onClick={toggleTheme}
                                title={theme === 'dark' ? "Switch to Cyber Platinum (Light)" : "Switch to Cyber Obsidian (Dark)"}
                                style={{
                                    cursor: 'pointer',
                                    padding: '7px',
                                    background: 'var(--bg-surface-2)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: theme === 'dark' ? '#f59e0b' : 'var(--primary)',
                                    height: '36px',
                                    width: '36px',
                                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                                    boxShadow: 'var(--shadow-sm)'
                                }}
                            >
                                {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                            </button>
                        )}

                        {/* Transfer Engine Quick Trigger */}
                        {!guestToken && (
                            <div
                                onClick={() => setShowOperations && setShowOperations(true)}
                                title="Open Transfer Engine (Queue, Speedometer & Background Operations)"
                                style={{
                                    cursor: 'pointer',
                                    padding: '6px 14px',
                                    background: operations?.some(o => o.status !== 'Completed' && o.status !== 'Failed') ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-surface-2)',
                                    border: `1px solid ${operations?.some(o => o.status !== 'Completed' && o.status !== 'Failed') ? 'var(--primary)' : 'var(--border-subtle)'}`,
                                    borderRadius: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '7px',
                                    transition: 'all 0.15s ease',
                                    height: '36px',
                                    color: operations?.some(o => o.status !== 'Completed' && o.status !== 'Failed') ? 'var(--primary)' : 'var(--text-primary)',
                                    boxShadow: operations?.some(o => o.status !== 'Completed' && o.status !== 'Failed') ? '0 0 14px rgba(99, 102, 241, 0.25)' : 'none'
                                }}
                            >
                                <Zap 
                                    size={15} 
                                    color={operations?.some(o => o.status !== 'Completed' && o.status !== 'Failed') ? 'var(--primary)' : 'var(--text-muted)'} 
                                    style={operations?.some(o => o.status !== 'Completed' && o.status !== 'Failed') ? { animation: 'pulse 1s infinite' } : {}} 
                                />
                                <span style={{ fontSize: '12.5px', fontWeight: '800' }}>
                                    Transfer Engine
                                </span>
                                {operations?.length > 0 && (
                                    <span style={{ fontSize: '10px', background: operations?.some(o => o.status !== 'Completed' && o.status !== 'Failed') ? '#10b981' : 'var(--primary)', color: '#ffffff', padding: '1px 6px', borderRadius: '10px', fontWeight: '900', fontFamily: 'var(--font-mono)' }}>
                                        {operations.filter(o => o.status !== 'Completed' && o.status !== 'Failed').length || operations.length}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Cluster Monitor shortcut icon */}
                        {!guestToken && (
                            <div
                                onClick={() => setView('monitor')}
                                title="Cluster Monitor"
                                style={{
                                    cursor: 'pointer',
                                    padding: '8px 10px',
                                    background: view === 'monitor' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${view === 'monitor' ? 'rgba(0,242,255,0.35)' : 'rgba(255,255,255,0.05)'}`,
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: '0.2s',
                                    height: '36px',
                                    width: '36px'
                                }}
                            >
                                <Activity size={18} color={view === 'monitor' ? 'var(--accent-cyan)' : '#8b949e'} />
                            </div>
                        )}

                        {/* Network Shares shortcut icon */}
                        {!guestToken && (
                            <div
                                onClick={() => setView('network')}
                                title="Network Shares"
                                style={{
                                    cursor: 'pointer',
                                    padding: '8px 10px',
                                    background: view === 'network' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${view === 'network' ? 'rgba(0,242,255,0.35)' : 'rgba(255,255,255,0.05)'}`,
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: '0.2s',
                                    height: '36px',
                                    width: '36px'
                                }}
                            >
                                <Globe size={18} color={view === 'network' ? 'var(--accent-cyan)' : '#8b949e'} />
                            </div>
                        )}

                        {/* Network Traffic & Sessions shortcut icon */}
                        {!guestToken && (
                            <div
                                onClick={() => setView('traffic')}
                                title="Live Network Traffic & Sessions"
                                style={{
                                    cursor: 'pointer',
                                    padding: '8px 10px',
                                    background: view === 'traffic' ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${view === 'traffic' ? 'var(--primary)' : 'rgba(255,255,255,0.05)'}`,
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: '0.2s',
                                    height: '36px',
                                    width: '36px'
                                }}
                            >
                                <Wifi size={18} color={view === 'traffic' ? 'var(--primary)' : '#8b949e'} />
                            </div>
                        )}
                        
                        {!guestToken && (
                            <div className="notifications-dropdown-container" style={{ position: 'relative' }}>
                                <div 
                                    className={`active-badge ${showNotifications ? 'active' : ''}`}
                                    onClick={handleBellClick} 
                                    style={{ 
                                        cursor: 'pointer',
                                        padding: '8px 10px',
                                        background: showNotifications ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                                        border: '1px solid var(--border-subtle)',
                                        borderRadius: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        position: 'relative',
                                        transition: '0.2s',
                                        height: '36px',
                                        width: '36px'
                                    }}
                                    title="System Alerts"
                                >
                                    <Bell size={18} color={unreadCount > 0 ? "var(--accent-gold)" : "#8b949e"} />
                                    {unreadCount > 0 && (
                                        <span style={{
                                            position: 'absolute',
                                            top: '-2px',
                                            right: '-2px',
                                            background: '#f85149',
                                            color: 'var(--text-primary)',
                                            borderRadius: '50%',
                                            width: '14px',
                                            height: '14px',
                                            fontSize: '8px',
                                            fontWeight: '900',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: '0 0 0 2px #0d1117'
                                        }}>
                                            {unreadCount}
                                        </span>
                                    )}
                                </div>

                                <AnimatePresence>
                                    {showNotifications && (
                                        <motion.div 
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            transition={{ duration: 0.15 }}
                                            style={{
                                                position: 'absolute',
                                                top: '44px',
                                                right: '0px',
                                                width: '360px',
                                                background: 'var(--bg-surface-0)',
                                                backdropFilter: 'blur(20px)',
                                                border: '1px solid var(--border-subtle)',
                                                borderRadius: '12px',
                                                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                                                zIndex: 1000,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                maxHeight: '480px',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            {/* Header */}
                                            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Bell size={16} color="var(--accent-gold)" />
                                                    <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>Notifications Log</span>
                                                </div>
                                                <span 
                                                    onClick={() => {
                                                        setShowNotifications(false);
                                                        setView('alerts');
                                                    }}
                                                    style={{ fontSize: '11px', color: 'var(--accent-cyan)', cursor: 'pointer', fontWeight: '600' }}
                                                >
                                                    Configure
                                                </span>
                                            </div>

                                            {/* List */}
                                            <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {(!activities || activities.length === 0) ? (
                                                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                                                        No notifications recorded yet.
                                                    </div>
                                                ) : (
                                                    activities.slice(0, 10).map((act, index) => {
                                                        let sideBarCol = 'rgba(255,255,255,0.1)';
                                                        const severity = act.error || 'info';
                                                        if (severity === 'warning') sideBarCol = '#f2c94c';
                                                        else if (severity === 'error') sideBarCol = '#eb5757';
                                                        else if (severity === 'info') sideBarCol = 'var(--accent-cyan)';

                                                        return (
                                                            <div 
                                                                key={act.id || index} 
                                                                style={{ 
                                                                    padding: '10px 12px',
                                                                    background: 'var(--bg-surface-2)',
                                                                    border: '1px solid var(--border-subtle)',
                                                                    borderLeft: `3px solid ${sideBarCol}`,
                                                                    borderRadius: '6px',
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    gap: '4px',
                                                                    textAlign: 'left'
                                                                }}
                                                            >
                                                                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>{act.name}</div>
                                                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{act.status}</div>
                                                                <div style={{ fontSize: '9px', color: '#484f58', alignSelf: 'flex-end' }}>{new Date(act.timestamp).toLocaleTimeString()}</div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        {!guestToken && (
                            <div className="starred-dropdown-container" style={{ position: 'relative' }}>
                                <div 
                                    className={`active-badge ${showStarredDropdown ? 'active' : ''}`}
                                    onClick={handleStarredClick} 
                                    style={{ 
                                        cursor: 'pointer',
                                        padding: '8px 10px',
                                        background: showStarredDropdown ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                                        border: '1px solid var(--border-subtle)',
                                        borderRadius: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        position: 'relative',
                                        transition: '0.2s',
                                        height: '36px',
                                        width: '36px'
                                    }}
                                    title="Starred Items"
                                >
                                    <Star size={18} color={starredItems.length > 0 ? "#f2c94c" : "#8b949e"} fill={starredItems.length > 0 ? "#f2c94c" : "none"} />
                                    {starredItems.length > 0 && (
                                        <span style={{
                                            position: 'absolute',
                                            top: '-2px',
                                            right: '-2px',
                                            background: 'var(--accent-cyan)',
                                            color: '#0d1117',
                                            borderRadius: '50%',
                                            width: '14px',
                                            height: '14px',
                                            fontSize: '8px',
                                            fontWeight: '900',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: '0 0 0 2px #0d1117'
                                        }}>
                                            {starredItems.length}
                                        </span>
                                    )}
                                </div>

                                <AnimatePresence>
                                    {showStarredDropdown && (
                                        <motion.div 
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            transition={{ duration: 0.15 }}
                                            style={{
                                                position: 'absolute',
                                                top: '44px',
                                                right: '0px',
                                                width: '320px',
                                                background: 'var(--bg-surface-0)',
                                                backdropFilter: 'blur(20px)',
                                                border: '1px solid var(--border-subtle)',
                                                borderRadius: '12px',
                                                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                                                zIndex: 1000,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                maxHeight: '400px',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            {/* Header */}
                                            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Star size={16} color="#f2c94c" fill="#f2c94c" />
                                                <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>Starred Items</span>
                                            </div>

                                            {/* List */}
                                            <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {starredItems.length === 0 ? (
                                                    <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                                                        No starred items yet.
                                                    </div>
                                                ) : (
                                                    starredItems.slice(0, 5).map((item, index) => (
                                                        <div 
                                                            key={item.id || index} 
                                                            style={{ 
                                                                padding: '10px 12px',
                                                                background: 'var(--bg-surface-2)',
                                                                border: '1px solid var(--border-subtle)',
                                                                borderRadius: '6px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '10px',
                                                                textAlign: 'left',
                                                                cursor: 'pointer'
                                                            }}
                                                            onClick={() => {
                                                                setShowStarredDropdown(false);
                                                                if (item.is_directory) {
                                                                    if (setPath) setPath(item.path);
                                                                    setFilterText('');
                                                                } else {
                                                                    const parentPath = getParentPath(item.path);
                                                                    if (setPath) setPath(parentPath);
                                                                    setFilterText(item.name);
                                                                }
                                                                setView('browse');
                                                            }}
                                                        >
                                                            {item.is_directory ? (
                                                                <Folder size={14} color="var(--accent-gold)" />
                                                            ) : (
                                                                <File size={14} color="var(--accent-cyan)" />
                                                            )}
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {item.name}
                                                                </div>
                                                                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {item.path}
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={(e) => handleUnstarItem(e, item)}
                                                                style={{
                                                                    cursor: 'pointer',
                                                                    color: '#f2c94c',
                                                                    padding: '4px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    borderRadius: '6px',
                                                                    background: 'rgba(242, 201, 76, 0.05)',
                                                                    border: '1px solid rgba(242, 201, 76, 0.1)',
                                                                    transition: '0.2s'
                                                                }}
                                                                title="Unstar"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>

                                            {/* Footer Action Button */}
                                            <div 
                                                onClick={() => {
                                                    setShowStarredDropdown(false);
                                                    setView('starred');
                                                }}
                                                style={{ 
                                                    padding: '12px', 
                                                    borderTop: '1px solid var(--border-subtle)', 
                                                    textAlign: 'center', 
                                                    color: 'var(--accent-cyan)', 
                                                    fontSize: '12px', 
                                                    fontWeight: '700', 
                                                    cursor: 'pointer',
                                                    background: 'var(--bg-surface-2)',
                                                    transition: '0.2s'
                                                }}
                                            >
                                                Go to Starred
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        {!guestToken && (
                            <div className="trash-dropdown-container" style={{ position: 'relative' }}>
                                <div 
                                    className={`active-badge ${showTrashDropdown ? 'active' : ''}`}
                                    onClick={handleTrashClick} 
                                    style={{ 
                                        cursor: 'pointer',
                                        padding: '8px 10px',
                                        background: showTrashDropdown ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                                        border: '1px solid var(--border-subtle)',
                                        borderRadius: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        position: 'relative',
                                        transition: '0.2s',
                                        height: '36px',
                                        width: '36px'
                                    }}
                                    title="Trash Bin"
                                >
                                    <Trash2 size={18} color={trashItems.length > 0 ? "var(--accent-gold)" : "#8b949e"} />
                                    {trashItems.length > 0 && (
                                        <span style={{
                                            position: 'absolute',
                                            top: '-2px',
                                            right: '-2px',
                                            background: 'var(--accent-cyan)',
                                            color: '#0d1117',
                                            borderRadius: '50%',
                                            width: '14px',
                                            height: '14px',
                                            fontSize: '8px',
                                            fontWeight: '900',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: '0 0 0 2px #0d1117'
                                        }}>
                                            {trashItems.length}
                                        </span>
                                    )}
                                </div>

                                <AnimatePresence>
                                    {showTrashDropdown && (
                                        <motion.div 
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            transition={{ duration: 0.15 }}
                                            style={{
                                                position: 'absolute',
                                                top: '44px',
                                                right: '0px',
                                                width: '320px',
                                                background: 'var(--bg-surface-0)',
                                                backdropFilter: 'blur(20px)',
                                                border: '1px solid var(--border-subtle)',
                                                borderRadius: '12px',
                                                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                                                zIndex: 1000,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                maxHeight: '400px',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            {/* Header */}
                                            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Trash2 size={16} color="var(--accent-gold)" />
                                                <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>Trash Bin Preview</span>
                                            </div>

                                            {/* List */}
                                            <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {trashItems.length === 0 ? (
                                                    <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                                                        Trash is empty.
                                                    </div>
                                                ) : (
                                                    trashItems.slice(0, 5).map((item, index) => (
                                                        <div 
                                                            key={item.id || index} 
                                                            style={{ 
                                                                padding: '10px 12px',
                                                                background: 'var(--bg-surface-2)',
                                                                border: '1px solid var(--border-subtle)',
                                                                borderRadius: '6px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '10px',
                                                                textAlign: 'left'
                                                            }}
                                                        >
                                                            {item.is_directory ? (
                                                                <Folder size={14} color="var(--accent-gold)" />
                                                            ) : (
                                                                <File size={14} color="var(--accent-cyan)" />
                                                            )}
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {item.original_name}
                                                                </div>
                                                                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {item.original_path}
                                                                </div>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleRestoreItem(item.id);
                                                                    }}
                                                                    style={{
                                                                        cursor: 'pointer',
                                                                        color: '#4ade80',
                                                                        padding: '4px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        borderRadius: '6px',
                                                                        background: 'rgba(74, 222, 128, 0.05)',
                                                                        border: '1px solid rgba(74, 222, 128, 0.1)',
                                                                        transition: '0.2s'
                                                                    }}
                                                                    title="Restore Item"
                                                                >
                                                                    <RotateCcw size={12} />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteItem(item.id);
                                                                    }}
                                                                    style={{
                                                                        cursor: 'pointer',
                                                                        color: '#f85149',
                                                                        padding: '4px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        borderRadius: '6px',
                                                                        background: 'rgba(248, 81, 73, 0.05)',
                                                                        border: '1px solid rgba(248, 81, 73, 0.1)',
                                                                        transition: '0.2s'
                                                                    }}
                                                                    title="Delete Permanently"
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>

                                            {/* Footer Action Button */}
                                            <div 
                                                onClick={() => {
                                                    setShowTrashDropdown(false);
                                                    setView('trash');
                                                }}
                                                style={{ 
                                                    padding: '12px', 
                                                    borderTop: '1px solid var(--border-subtle)', 
                                                    textAlign: 'center', 
                                                    color: 'var(--accent-cyan)', 
                                                    fontSize: '12px', 
                                                    fontWeight: '700', 
                                                    cursor: 'pointer',
                                                    background: 'var(--bg-surface-2)',
                                                    transition: '0.2s'
                                                }}
                                            >
                                                Go to Trash
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}


                        {guestToken ? (
                            <>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Guest Session</div>
                                    <div style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}>Secure Session</div>
                                </div>
                                <div className="user-avatar" style={{ background: 'var(--accent-cyan-glow)', border: '1px solid var(--accent-cyan)' }}>
                                    <ShieldCheck size={20} color="var(--accent-cyan)" />
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{currentUser?.display_name || username}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Operator Online</div>
                                </div>
                                <div 
                                    className="user-avatar" 
                                    onClick={() => setView('profile')} 
                                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}
                                >
                                    <Avatar user={currentUser || { username }} size={36} />
                                </div>
                            </>
                        )}
                    </div>
                </header>
            )}
        </>
    );
}
