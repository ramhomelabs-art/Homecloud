import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, Activity, Search, Trash2, Filter, CheckCircle2, 
    AlertTriangle, ShieldAlert, FileText, Copy, Download, 
    Upload, Server, RefreshCw, Layers
} from 'lucide-react';
import axios from 'axios';

export default function FleetEventsModal({
    isOpen,
    onClose,
    activities = [],
    activityHistory = [],
    onClear,
    showToast
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all'); // 'all', 'transfers', 'nodes', 'security'
    const [selectedEvent, setSelectedEvent] = useState(null);

    if (!isOpen) return null;

    const allEvents = [
        ...activityHistory,
        ...activities.map(a => ({
            id: a.id || `${a.name}-${a.timestamp}`,
            name: a.name,
            type: a.error === 'error' ? 'Security / Node' : a.error === 'warning' ? 'Alert' : (a.type || 'System Event'),
            status: a.error === 'error' ? 'Error' : a.error === 'warning' ? 'Alert' : (a.status || 'Completed'),
            timestamp: a.timestamp,
            error: typeof a.status === 'string' && a.status.length < 80 ? a.status : null,
            details: a.details || null
        }))
    ].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

    const filteredEvents = allEvents.filter(event => {
        const textMatch = !searchTerm || 
            (event.name && event.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (event.type && event.type.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (event.status && event.status.toLowerCase().includes(searchTerm.toLowerCase()));

        if (!textMatch) return false;

        const typeLower = (event.type || '').toLowerCase();
        const nameLower = (event.name || '').toLowerCase();
        const statusLower = (event.status || '').toLowerCase();

        if (filterCategory === 'transfers') {
            return typeLower.includes('transfer') || typeLower.includes('file') || typeLower.includes('copy') ||
                   nameLower.includes('copy') || nameLower.includes('.mkv') || nameLower.includes('.mp4') || nameLower.includes('.zip');
        }
        if (filterCategory === 'nodes') {
            return typeLower.includes('node') || typeLower.includes('agent') || nameLower.includes('agent') || nameLower.includes('node');
        }
        if (filterCategory === 'security') {
            return statusLower === 'error' || statusLower === 'alert' || statusLower === 'warning' ||
                   typeLower.includes('security') || typeLower.includes('alert');
        }
        return true;
    });

    const getEventIcon = (event) => {
        const name = (event.name || '').toLowerCase();
        const type = (event.type || '').toLowerCase();
        const status = (event.status || '').toLowerCase();

        if (status === 'error' || type.includes('security') || name.includes('offline')) {
            return <AlertTriangle size={16} color="#ef4444" />;
        }
        if (status === 'alert' || status === 'warning') {
            return <ShieldAlert size={16} color="#f59e0b" />;
        }
        if (name.includes('copy') || type.includes('copy')) {
            return <Copy size={16} color="#0ea5e9" />;
        }
        if (name.includes('download') || type.includes('download')) {
            return <Download size={16} color="#06b6d4" />;
        }
        if (name.includes('upload') || type.includes('upload')) {
            return <Upload size={16} color="#10b981" />;
        }
        if (name.includes('agent') || type.includes('node')) {
            return <Server size={16} color="#a855f7" />;
        }
        return <Activity size={16} color="#10b981" />;
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(10px)',
            zIndex: 3500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            <div style={{ position: 'absolute', inset: 0 }} onClick={onClose} />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ type: 'spring', damping: 25, stiffness: 280 }}
                style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '920px',
                    maxHeight: '90vh',
                    background: 'var(--bg-surface-0, #1e222b)',
                    border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                    borderRadius: '20px',
                    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    zIndex: 2
                }}
            >
                {/* Modal Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '20px 24px',
                    borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                    background: 'var(--bg-surface-1, rgba(255,255,255,0.02))'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 6px 16px rgba(14, 165, 233, 0.3)'
                        }}>
                            <Activity size={22} color="#ffffff" />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '850', color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                                    Fleet Event Stream & Audit Log
                                </h3>
                                <span style={{
                                    fontSize: '10px',
                                    fontWeight: '800',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    background: 'rgba(14, 165, 233, 0.15)',
                                    color: '#0ea5e9',
                                    border: '1px solid rgba(14, 165, 233, 0.3)'
                                }}>
                                    {allEvents.length} EVENTS
                                </span>
                            </div>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                Real-time cluster operations, node telemetry alerts, and file system transfer history
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {allEvents.length > 0 && (
                            <button
                                onClick={onClear}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                    color: '#ef4444',
                                    padding: '7px 14px',
                                    borderRadius: '9px',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    cursor: 'pointer'
                                }}
                            >
                                <Trash2 size={14} />
                                <span>Clear Events</span>
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            style={{
                                background: 'var(--bg-surface-2, rgba(255,255,255,0.06))',
                                border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                                color: 'var(--text-secondary)',
                                width: '32px',
                                height: '32px',
                                borderRadius: '9px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                            }}
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 24px',
                    borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
                    background: 'var(--bg-surface-1, rgba(0,0,0,0.02))',
                    gap: '16px',
                    flexWrap: 'wrap'
                }}>
                    {/* Category Pills */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {[
                            { id: 'all', label: 'All' },
                            { id: 'transfers', label: 'File Transfers' },
                            { id: 'nodes', label: 'Node Telemetry' },
                            { id: 'security', label: 'Alerts & Errors' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setFilterCategory(tab.id)}
                                style={{
                                    padding: '6px 14px',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: '750',
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: filterCategory === tab.id ? 'var(--accent-gold, #f59e0b)' : 'transparent',
                                    color: filterCategory === tab.id ? '#000000' : 'var(--text-secondary)',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Search Field */}
                    <div style={{
                        position: 'relative',
                        minWidth: '220px',
                        flex: '0 1 300px'
                    }}>
                        <Search size={14} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            type="text"
                            placeholder="Search event history..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                background: 'var(--bg-surface-2, rgba(255,255,255,0.06))',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '9px',
                                padding: '7px 12px 7px 34px',
                                fontSize: '12px',
                                color: 'var(--text-primary)',
                                outline: 'none'
                            }}
                        />
                    </div>
                </div>

                {/* Event Rows Scroll List */}
                <div style={{
                    padding: '16px 24px',
                    overflowY: 'auto',
                    maxHeight: '480px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                }}>
                    {filteredEvents.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.6 }}>
                            <Activity size={40} color="var(--text-secondary)" />
                            <h4 style={{ margin: '14px 0 4px', fontSize: '15px', color: 'var(--text-primary)' }}>No Matching Events</h4>
                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                                No fleet activity recorded matching your current query or category filter.
                            </p>
                        </div>
                    ) : (
                        filteredEvents.map((act, i) => {
                            const isSuccess = act.status === 'Completed' || act.status === 'Done';
                            const isAlert = act.status === 'Alert' || act.status === 'Warning';
                            const isError = act.status === 'Error' || act.status === 'Failed';
                            const badgeBg = isSuccess 
                                ? 'rgba(16, 185, 129, 0.12)' 
                                : isAlert 
                                ? 'rgba(245, 158, 11, 0.12)' 
                                : 'rgba(239, 68, 68, 0.12)';
                            const badgeColor = isSuccess ? '#10b981' : isAlert ? '#f59e0b' : '#ef4444';

                            return (
                                <div
                                    key={act.id || i}
                                    style={{
                                        background: 'var(--bg-surface-1, rgba(255,255,255,0.02))',
                                        border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
                                        borderRadius: '12px',
                                        padding: '12px 16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '14px',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '8px',
                                            background: badgeBg,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            {getEventIcon(act)}
                                        </div>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div 
                                                style={{
                                                    fontSize: '13px',
                                                    fontWeight: '750',
                                                    color: 'var(--text-primary)',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}
                                                title={act.name}
                                            >
                                                {act.name}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span>{act.type || 'Event'}</span>
                                                <span>•</span>
                                                <span>{act.timestamp ? new Date(act.timestamp).toLocaleTimeString() : 'Just now'}</span>
                                                {act.timestamp && (
                                                    <>
                                                        <span>•</span>
                                                        <span>{new Date(act.timestamp).toLocaleDateString()}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                        <span style={{
                                            fontSize: '10px',
                                            fontWeight: '800',
                                            padding: '3px 8px',
                                            borderRadius: '6px',
                                            background: badgeBg,
                                            color: badgeColor,
                                            textTransform: 'uppercase'
                                        }}>
                                            {act.status || 'COMPLETED'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '14px 24px',
                    borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                    background: 'var(--bg-surface-1, rgba(255,255,255,0.02))',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Showing {filteredEvents.length} of {allEvents.length} recorded events
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'var(--accent-gold, #f59e0b)',
                            border: 'none',
                            color: '#000000',
                            padding: '8px 18px',
                            borderRadius: '10px',
                            fontSize: '12px',
                            fontWeight: '800',
                            cursor: 'pointer'
                        }}
                    >
                        Close
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
