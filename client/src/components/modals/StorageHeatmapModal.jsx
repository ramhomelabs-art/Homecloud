import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, PieChart, HardDrive, RefreshCw, Folder, File, 
    Trash2, Eye, ChevronRight, Layers, AlertCircle, 
    Sparkles, ArrowUpRight, BarChart2, ShieldAlert, Check
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const CATEGORY_COLORS = {
    video: '#8b5cf6',   // Purple
    image: '#06b6d4',   // Cyan
    audio: '#ec4899',   // Pink
    archive: '#f59e0b', // Amber
    code: '#3b82f6',    // Blue
    document: '#10b981',// Emerald
    other: '#64748b'    // Slate
};

const StorageHeatmapModal = ({ path: initialPath = '', agentId = null, onClose, showToast, onNavigateToFile }) => {
    const [currentPath, setCurrentPath] = useState(initialPath);
    const [loading, setLoading] = useState(true);
    const [treeData, setTreeData] = useState(null);
    const [activeCategory, setActiveCategory] = useState('all');
    const [deletingPath, setDeletingPath] = useState(null);
    const [fileToDelete, setFileToDelete] = useState(null);

    const fetchTree = async (scanPath) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.post('/api/v1/files/storage/tree', {
                path: scanPath,
                agentId
            }, { headers });
            setTreeData(res.data);
        } catch (err) {
            if (showToast) showToast('Failed to scan storage: ' + (err.response?.data?.error || err.message), 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTree(currentPath);
    }, [currentPath]);

    const confirmDeleteFile = async () => {
        if (!fileToDelete) return;
        const filePath = fileToDelete;
        setFileToDelete(null);
        setDeletingPath(filePath);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.delete('/api/v1/files/delete', {
                data: { path: filePath, agentId },
                headers
            });
            if (showToast) showToast('File deleted successfully', 'success');
            fetchTree(currentPath);
        } catch (err) {
            if (showToast) showToast('Delete failed: ' + (err.response?.data?.error || err.message), 'error');
        } finally {
            setDeletingPath(null);
        }
    };

    const handleDeleteFile = (filePath) => {
        setFileToDelete(filePath);
    };

    const isSmb = currentPath && (currentPath.startsWith('\\\\') || currentPath.startsWith('//') || currentPath.startsWith('smb://'));

    const getCrumbs = () => {
        if (!currentPath) return [];
        if (isSmb) {
            const clean = currentPath.replace(/^[\\/]+/, '').replace(/^smb:[\\/]+/, '');
            const parts = clean.split(/[/\\]/).filter(Boolean);
            return parts.map((part, idx) => {
                const subPath = `//${parts.slice(0, idx + 1).join('/')}`;
                return { name: part, path: subPath };
            });
        }
        const parts = currentPath.split(/[/\\]/).filter(Boolean);
        return parts.map((part, idx) => {
            const isWindowsDrive = /^[a-zA-Z]:/.test(parts[0]);
            let subPath;
            if (isWindowsDrive) {
                subPath = parts.slice(0, idx + 1).join('\\');
                if (idx === 0) subPath += '\\';
            } else {
                subPath = '/' + parts.slice(0, idx + 1).join('/');
            }
            return { name: part, path: subPath };
        });
    };

    const crumbs = getCrumbs();

    const filteredFiles = (treeData?.topLargestFiles || []).filter(file => {
        if (activeCategory === 'all') return true;
        return file.category === activeCategory;
    });

    const totalCategoryBytes = Object.values(treeData?.typeCategories || {}).reduce((a, b) => a + b, 0);

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(12px)',
            zIndex: 3000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
        }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                style={{
                    width: '100%',
                    maxWidth: '1240px',
                    height: '88vh',
                    background: 'var(--bg-surface-0)',
                    borderRadius: '20px',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '0 30px 70px rgba(0,0,0,0.6)'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '16px 24px',
                    background: 'var(--bg-surface-1)',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexShrink: 0
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(6, 182, 212, 0.2))',
                            border: '1px solid rgba(139, 92, 246, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--accent-cyan)'
                        }}>
                            <PieChart size={22} />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                    Storage Disk Heatmap & Treemap
                                </h3>
                                <span style={{ fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px', background: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)' }}>
                                    {isSmb ? 'SMB Share Analyzer' : 'Live Analyzer'}
                                </span>
                            </div>
                            {/* Breadcrumbs */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px', fontSize: '11.5px', color: 'var(--text-dim)' }}>
                                <span 
                                    onClick={() => {
                                        if (isSmb) {
                                            const clean = currentPath.replace(/^[\\/]+/, '').replace(/^smb:[\\/]+/, '');
                                            const parts = clean.split(/[/\\]/).filter(Boolean);
                                            if (parts.length > 1) {
                                                setCurrentPath(`//${parts[0]}/${parts[1]}`);
                                            } else {
                                                setCurrentPath(`//${parts[0]}`);
                                            }
                                        } else {
                                            setCurrentPath('');
                                        }
                                    }} 
                                    style={{ cursor: 'pointer', color: currentPath === '' ? 'var(--text-primary)' : 'var(--primary)', fontWeight: '700' }}
                                >
                                    {isSmb ? 'Share Root' : 'Root'}
                                </span>
                                {crumbs.map((crumb, idx) => (
                                    <React.Fragment key={idx}>
                                        <ChevronRight size={12} />
                                        <span 
                                            onClick={() => setCurrentPath(crumb.path)} 
                                            style={{ cursor: 'pointer', color: idx === crumbs.length - 1 ? 'var(--text-primary)' : 'var(--primary)', fontWeight: '700' }}
                                        >
                                            {crumb.name}
                                        </span>
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                            onClick={() => fetchTree(currentPath)}
                            className="btn-secondary"
                            style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            <RefreshCw size={14} className={loading ? 'spin-anim' : ''} /> Rescan
                        </button>
                        <button
                            onClick={onClose}
                            style={{ padding: '8px', borderRadius: '8px', background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    {loading ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--text-secondary)' }}>
                            <RefreshCw size={32} className="spin-anim" color="var(--primary)" />
                            <div style={{ fontSize: '14px', fontWeight: '700' }}>Analyzing disk consumption across cluster...</div>
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '24px', gap: '24px' }}>
                            {/* Summary Metrics Bar */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                                <div style={{ padding: '16px', borderRadius: '14px', background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Analyzed Space</div>
                                    <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '4px' }}>
                                        {formatBytes(treeData?.totalSize || 0)}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                                        {treeData?.fileCount || 0} indexed files
                                    </div>
                                </div>

                                {Object.entries(treeData?.typeCategories || {}).map(([cat, bytes]) => {
                                    if (bytes === 0) return null;
                                    const pct = totalCategoryBytes > 0 ? ((bytes / totalCategoryBytes) * 100).toFixed(1) : 0;
                                    return (
                                        <div 
                                            key={cat}
                                            onClick={() => setActiveCategory(activeCategory === cat ? 'all' : cat)}
                                            style={{
                                                padding: '16px',
                                                borderRadius: '14px',
                                                background: activeCategory === cat ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-surface-1)',
                                                border: `1px solid ${activeCategory === cat ? 'var(--primary)' : 'var(--border-subtle)'}`,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '11px', fontWeight: '800', color: CATEGORY_COLORS[cat] || 'var(--text-dim)', textTransform: 'uppercase' }}>
                                                    {cat}
                                                </span>
                                                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)' }}>
                                                    {pct}%
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '4px' }}>
                                                {formatBytes(bytes)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Visual Treemap Heat Grid */}
                            <div style={{ borderRadius: '16px', background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)', padding: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Layers size={18} color="var(--primary)" />
                                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                            Folder Consumption Treemap
                                        </h4>
                                    </div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                        Click any folder box to zoom in
                                    </span>
                                </div>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                                    gap: '12px'
                                }}>
                                    {(treeData?.children || []).map((item, idx) => {
                                        const pct = treeData.totalSize > 0 ? Math.max(1, Math.round((item.size / treeData.totalSize) * 100)) : 0;
                                        const color = item.isDirectory ? 'var(--primary)' : (CATEGORY_COLORS[item.category] || 'var(--text-dim)');

                                        return (
                                            <motion.div
                                                key={idx}
                                                whileHover={{ scale: 1.02 }}
                                                onClick={() => {
                                                    if (item.isDirectory) setCurrentPath(item.path);
                                                }}
                                                style={{
                                                    padding: '14px',
                                                    borderRadius: '12px',
                                                    background: 'var(--bg-surface-2)',
                                                    border: '1px solid var(--border-subtle)',
                                                    cursor: item.isDirectory ? 'pointer' : 'default',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    justifyContent: 'space-between',
                                                    minHeight: '90px'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                                    {item.isDirectory ? <Folder size={16} color="var(--accent-gold)" /> : <File size={16} color={color} />}
                                                    <span style={{
                                                        fontSize: '12.5px',
                                                        fontWeight: '700',
                                                        color: 'var(--text-primary)',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {item.name}
                                                    </span>
                                                </div>

                                                <div style={{ marginTop: '10px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                                                        <span>{formatBytes(item.size)}</span>
                                                        <span style={{ fontWeight: '800', color }}>{pct}%</span>
                                                    </div>
                                                    <div style={{ width: '100%', height: '4px', background: 'var(--bg-surface-0)', borderRadius: '4px', overflow: 'hidden' }}>
                                                        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '4px' }} />
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Top Largest Files Table */}
                            <div style={{ borderRadius: '16px', background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <BarChart2 size={18} color="var(--accent-cyan)" />
                                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                            Top Space Consumers ({filteredFiles.length} files)
                                        </h4>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        {['all', 'video', 'image', 'archive', 'code', 'document'].map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => setActiveCategory(cat)}
                                                style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '6px',
                                                    border: 'none',
                                                    background: activeCategory === cat ? 'var(--primary)' : 'var(--bg-surface-2)',
                                                    color: activeCategory === cat ? '#fff' : 'var(--text-secondary)',
                                                    fontSize: '11px',
                                                    fontWeight: '700',
                                                    cursor: 'pointer',
                                                    textTransform: 'capitalize'
                                                }}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                                        <thead>
                                            <tr style={{ textAlign: 'left', color: 'var(--text-dim)', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface-2)' }}>
                                                <th style={{ padding: '10px 20px', fontWeight: '800' }}>NAME</th>
                                                <th style={{ padding: '10px 16px', fontWeight: '800' }}>CATEGORY</th>
                                                <th style={{ padding: '10px 16px', fontWeight: '800' }}>SIZE</th>
                                                <th style={{ padding: '10px 20px', textAlign: 'right', fontWeight: '800' }}>ACTIONS</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredFiles.map((file, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                                                    <td style={{ padding: '12px 20px' }}>
                                                        <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{file.name}</div>
                                                        <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', marginTop: '2px' }}>{file.path}</div>
                                                    </td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <span style={{
                                                            fontSize: '10.5px',
                                                            fontWeight: '800',
                                                            padding: '2px 8px',
                                                            borderRadius: '5px',
                                                            background: `${CATEGORY_COLORS[file.category] || '#64748b'}20`,
                                                            color: CATEGORY_COLORS[file.category] || 'var(--text-dim)',
                                                            textTransform: 'uppercase'
                                                        }}>
                                                            {file.category}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px 16px', fontWeight: '800', fontFamily: 'var(--font-mono)' }}>
                                                        {formatBytes(file.size)}
                                                    </td>
                                                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                                                        <button
                                                            onClick={() => handleDeleteFile(file.path)}
                                                            disabled={deletingPath === file.path}
                                                            title="Delete file to free space"
                                                            style={{
                                                                padding: '6px 10px',
                                                                borderRadius: '6px',
                                                                background: 'rgba(244, 63, 94, 0.12)',
                                                                border: '1px solid rgba(244, 63, 94, 0.3)',
                                                                color: '#f43f5e',
                                                                cursor: 'pointer',
                                                                fontSize: '11.5px',
                                                                fontWeight: '700',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '4px'
                                                            }}
                                                        >
                                                            {deletingPath === file.path ? <RefreshCw size={12} className="spin-anim" /> : <Trash2 size={12} />}
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* In-UI Confirmation: Delete File */}
            <ConfirmModal
                show={!!fileToDelete}
                title="Delete Large File"
                message={`Are you sure you want to permanently delete "${fileToDelete ? fileToDelete.split(/[/\\]/).pop() : ''}" to reclaim disk space? This action cannot be undone.`}
                confirmText="Delete File"
                cancelText="Cancel"
                type="danger"
                onConfirm={confirmDeleteFile}
                onCancel={() => setFileToDelete(null)}
            />
        </div>
    );
};

export default StorageHeatmapModal;
