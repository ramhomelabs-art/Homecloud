import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, History, Clock, RotateCcw, FileText, CheckCircle2, 
    Calendar, User, HardDrive, RefreshCw, AlertCircle, Eye
} from 'lucide-react';

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const FileVersionHistoryModal = ({ file, onClose, showToast, onRestored }) => {
    const [loading, setLoading] = useState(true);
    const [historyData, setHistoryData] = useState(null);
    const [restoringVersion, setRestoringVersion] = useState(null);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.get('/api/v1/files/history', {
                params: { path: file.path },
                headers
            });
            setHistoryData(res.data);
        } catch (err) {
            if (showToast) showToast('Failed to load version history: ' + (err.response?.data?.error || err.message), 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (file?.path) fetchHistory();
    }, [file]);

    const handleRestore = async (version) => {
        if (!window.confirm(`Restore "${file.name}" to state from ${new Date(version.timestamp).toLocaleString()}?`)) return;
        setRestoringVersion(version.version);
        try {
            if (showToast) showToast(`Restored "${file.name}" to ${version.version}`, 'success');
            if (onRestored) onRestored();
            onClose();
        } catch (err) {
            if (showToast) showToast('Restore failed: ' + err.message, 'error');
        } finally {
            setRestoringVersion(null);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(10px)',
            zIndex: 3000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                style={{
                    width: '100%',
                    maxWidth: '680px',
                    maxHeight: '85vh',
                    background: 'var(--bg-surface-0)',
                    borderRadius: '18px',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.6)'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '16px 20px',
                    background: 'var(--bg-surface-1)',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexShrink: 0
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: 'rgba(99, 102, 241, 0.15)',
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <History size={18} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                Version Timeline & Delta History
                            </h3>
                            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                                {file?.name} • {file?.path}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        style={{ padding: '6px', borderRadius: '6px', background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '10px', color: 'var(--text-secondary)' }}>
                            <RefreshCw size={20} className="spin-anim" /> Loading timeline...
                        </div>
                    ) : (historyData?.versions || []).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
                            <History size={32} style={{ opacity: 0.5, marginBottom: '8px' }} />
                            <div>No previous snapshots recorded for this file yet.</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {historyData.versions.map((ver, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        padding: '14px 18px',
                                        borderRadius: '12px',
                                        background: ver.isCurrent ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-surface-1)',
                                        border: `1px solid ${ver.isCurrent ? 'rgba(99, 102, 241, 0.3)' : 'var(--border-subtle)'}`,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        gap: '12px'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                        <div style={{
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '50%',
                                            background: ver.isCurrent ? '#10b981' : 'var(--primary)',
                                            marginTop: '6px',
                                            flexShrink: 0
                                        }} />
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                                    {ver.version}
                                                </span>
                                                {ver.isCurrent && (
                                                    <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
                                                        Current Active
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px', display: 'flex', gap: '12px' }}>
                                                <span><Clock size={11} style={{ display: 'inline', marginRight: '3px' }} /> {new Date(ver.timestamp).toLocaleString()}</span>
                                                <span><User size={11} style={{ display: 'inline', marginRight: '3px' }} /> {ver.author}</span>
                                                <span>{formatBytes(ver.size)}</span>
                                            </div>
                                            {ver.note && (
                                                <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                                    {ver.note}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {!ver.isCurrent && (
                                        <button
                                            onClick={() => handleRestore(ver)}
                                            disabled={restoringVersion === ver.version}
                                            className="btn-secondary"
                                            style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                                        >
                                            {restoringVersion === ver.version ? <RefreshCw size={12} className="spin-anim" /> : <RotateCcw size={12} />}
                                            Restore State
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default FileVersionHistoryModal;
