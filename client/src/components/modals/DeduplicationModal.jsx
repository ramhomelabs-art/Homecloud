import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trash2, AlertTriangle, RefreshCw, X, FolderSync, Info, Check } from 'lucide-react';

const API_BASE = '/api';

const DeduplicationModal = ({ path, agentId, onClose, onRefresh, showToast }) => {
    const [loading, setLoading] = useState(false);
    const [groups, setGroups] = useState([]);
    const [selectedFiles, setSelectedFiles] = useState(new Set());
    const [scanned, setScanned] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const performScan = async () => {
        setLoading(true);
        setGroups([]);
        setSelectedFiles(new Set());
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.post('/api/v1/duplicates/scan', {
                path,
                agentId
            }, { headers });
            setGroups(res.data || []);
            setScanned(true);
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.error || 'Failed to scan directory', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        performScan();
    }, [path, agentId]);

    const formatBytes = (bytes, decimals = 1) => {
        if (bytes === undefined || bytes === null || isNaN(bytes)) return '0.0 KB';
        if (bytes === 0) return '0.0 KB';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
        if (i < 0) return '0.0 KB';
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    const handleToggleFile = (filePath) => {
        const next = new Set(selectedFiles);
        if (next.has(filePath)) next.delete(filePath);
        else next.add(filePath);
        setSelectedFiles(next);
    };

    const autoSelect = (strategy) => {
        const next = new Set();
        groups.forEach(group => {
            // Sort files by modify time
            const sorted = [...group.files].sort((a, b) => a.mtime - b.mtime);
            if (strategy === 'oldest') {
                // Keep oldest (first one in sorted), delete others
                sorted.slice(1).forEach(f => next.add(f.path));
            } else if (strategy === 'newest') {
                // Keep newest (last one in sorted), delete others
                sorted.slice(0, sorted.length - 1).forEach(f => next.add(f.path));
            }
        });
        setSelectedFiles(next);
    };

    const calculateReclaimSpace = () => {
        let size = 0;
        groups.forEach(group => {
            group.files.forEach(file => {
                if (selectedFiles.has(file.path)) {
                    size += group.size;
                }
            });
        });
        return size;
    };

    const handleDeduplicate = async () => {
        if (selectedFiles.size === 0 || deleting) return;
        if (!window.confirm(`Are you sure you want to permanently delete ${selectedFiles.size} duplicate files? This action cannot be undone.`)) return;

        setDeleting(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.post('/api/v1/files/delete/batch', {
                paths: Array.from(selectedFiles),
                agentId
            }, { headers });
            showToast(res.data.message || 'Deduplication completed', 'success');
            onRefresh();
            onClose();
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.error || 'Failed to delete duplicates', 'error');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FolderSync size={24} color="var(--accent-gold)" />
                        <h3 style={{ margin: 0 }}>Deduplication Wizard</h3>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '20px', wordBreak: 'break-all', flexShrink: 0 }}>
                    Scanning Target: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{path}</span> {agentId && <span className="partition-badge" style={{ marginLeft: '8px' }}>Remote Node</span>}
                </div>

                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '60px 0' }}>
                        <RefreshCw style={{ animation: 'spin 2s linear infinite' }} size={40} color="var(--accent-gold)" />
                        <p style={{ marginTop: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>Analyzing directories and files...</p>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Calculating size matches and comparing checksum hashes.</p>
                    </div>
                ) : scanned && groups.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '40px 0', textAlign: 'center' }}>
                        <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(46,164,79,0.1)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                            <Check size={32} color="#2ea44f" />
                        </div>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>Clean Drive!</h4>
                        <p style={{ color: 'var(--text-secondary)', maxWidth: '300px', fontSize: '13px' }}>No duplicate files were found in this directory. Everything is organized.</p>
                        <button className="btn-outline" onClick={onClose} style={{ marginTop: '20px' }}>Close</button>
                    </div>
                ) : (
                    <>
                        {scanned && (
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', flexShrink: 0 }}>
                                <button className="btn-outline" onClick={() => autoSelect('oldest')} style={{ fontSize: '12px', padding: '6px 12px' }}>Auto Select: Keep Oldest</button>
                                <button className="btn-outline" onClick={() => autoSelect('newest')} style={{ fontSize: '12px', padding: '6px 12px' }}>Auto Select: Keep Newest</button>
                                <button className="btn-outline" onClick={() => setSelectedFiles(new Set())} style={{ fontSize: '12px', padding: '6px 12px' }}>Clear Selection</button>
                                <button className="btn-outline" onClick={performScan} style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}><RefreshCw size={12} /> Rescan</button>
                            </div>
                        )}

                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', marginBottom: '20px' }}>
                            {groups.map((group, groupIdx) => (
                                <div key={groupIdx} style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border-dim)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-dim)', paddingBottom: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ background: 'var(--accent-gold-glow)', color: 'var(--accent-gold)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>GROUP {groupIdx + 1}</span>
                                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>MD5 Hash: {group.hash.slice(0, 8)}...</span>
                                        </div>
                                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>Size per file: {formatBytes(group.size)}</span>
                                    </div>
                                    <div style={{ display: 'grid', gap: '8px' }}>
                                        {group.files.map((file, fileIdx) => {
                                            const isChecked = selectedFiles.has(file.path);
                                            const date = new Date(file.mtime).toLocaleString();
                                            return (
                                                <div 
                                                    key={fileIdx} 
                                                    onClick={() => handleToggleFile(file.path)}
                                                    style={{ 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        gap: '12px', 
                                                        padding: '10px 12px', 
                                                        background: isChecked ? 'rgba(248,81,73,0.05)' : 'rgba(0,0,0,0.15)', 
                                                        borderRadius: '8px', 
                                                        border: isChecked ? '1px solid rgba(248,81,73,0.3)' : '1px solid var(--border-dim)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isChecked} 
                                                        onChange={() => {}} // Controlled by outer click
                                                        style={{ accentColor: '#f85149', cursor: 'pointer' }} 
                                                    />
                                                    <div style={{ minWidth: 0, flex: 1 }}>
                                                        <div style={{ fontSize: '13px', fontWeight: '600', color: isChecked ? '#ff7b72' : '#e6edf3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.path}>{file.name}</div>
                                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.path}</div>
                                                    </div>
                                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', flexShrink: 0 }}>Mod: {date}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {groups.length > 0 && (
                            <div className="glass" style={{ padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--border-bright)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', flexShrink: 0 }}>
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Selected for deletion: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{selectedFiles.size} files</span></div>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--accent-gold)', marginTop: '4px' }}>Reclaimable Space: {formatBytes(calculateReclaimSpace())}</div>
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button className="btn-outline" onClick={onClose}>Cancel</button>
                                    <button 
                                        onClick={handleDeduplicate}
                                        disabled={selectedFiles.size === 0 || deleting}
                                        style={{ 
                                            background: '#f85149', 
                                            color: 'var(--text-primary)',
                                            padding: '10px 20px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            fontWeight: 'bold',
                                            cursor: selectedFiles.size === 0 || deleting ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            opacity: selectedFiles.size === 0 || deleting ? 0.6 : 1,
                                            boxShadow: selectedFiles.size > 0 ? '0 0 15px rgba(248,81,73,0.3)' : 'none'
                                        }}
                                    >
                                        <Trash2 size={16} /> {deleting ? 'Deleting...' : 'Reclaim Disk Space'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default DeduplicationModal;
