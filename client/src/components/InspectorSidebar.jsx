import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { copyTextToClipboard } from '../utils/clipboard';
import { 
    X, Copy, Download, Edit, Share2, Trash2, 
    Folder, File, Image as ImageIcon, Calendar, Shield, HardDrive, Info,
    Star, Tag, MessageSquare, Clock, RotateCcw, Plus, Send
} from 'lucide-react';

// ── Helpers (keep all existing helpers) ──────────────────────────────────────

const getMIMEInfo = (fileName, isDir) => {
    if (isDir) return { label: 'Folder', color: '#d97706', bg: 'rgba(217, 119, 6, 0.12)' };
    const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
    const map = {
        js: { label: 'Code Script', color: '#56ccf2', bg: 'rgba(86,204,242,0.1)' },
        jsx: { label: 'Code Script', color: '#56ccf2', bg: 'rgba(86,204,242,0.1)' },
        ts: { label: 'Code Script', color: '#56ccf2', bg: 'rgba(86,204,242,0.1)' },
        tsx: { label: 'Code Script', color: '#56ccf2', bg: 'rgba(86,204,242,0.1)' },
        py: { label: 'Code Script', color: '#56ccf2', bg: 'rgba(86,204,242,0.1)' },
        go: { label: 'Code Script', color: '#56ccf2', bg: 'rgba(86,204,242,0.1)' },
        cpp: { label: 'Code Script', color: '#56ccf2', bg: 'rgba(86,204,242,0.1)' },
        c: { label: 'Code Script', color: '#56ccf2', bg: 'rgba(86,204,242,0.1)' },
        java: { label: 'Code Script', color: '#56ccf2', bg: 'rgba(86,204,242,0.1)' },
        sh: { label: 'Code Script', color: '#56ccf2', bg: 'rgba(86,204,242,0.1)' },
        ps1: { label: 'Code Script', color: '#56ccf2', bg: 'rgba(86,204,242,0.1)' },
        bat: { label: 'Code Script', color: '#56ccf2', bg: 'rgba(86,204,242,0.1)' },
        css: { label: 'Stylesheet', color: '#2d9cdb', bg: 'rgba(45,156,219,0.1)' },
        scss: { label: 'Stylesheet', color: '#2d9cdb', bg: 'rgba(45,156,219,0.1)' },
        html: { label: 'Markup Document', color: '#f2994a', bg: 'rgba(242,153,74,0.1)' },
        xml: { label: 'Markup Document', color: '#f2994a', bg: 'rgba(242,153,74,0.1)' },
        svg: { label: 'Markup Document', color: '#f2994a', bg: 'rgba(242,153,74,0.1)' },
        json: { label: 'Configuration', color: '#bb6bd9', bg: 'rgba(187,107,217,0.1)' },
        yaml: { label: 'Configuration', color: '#bb6bd9', bg: 'rgba(187,107,217,0.1)' },
        yml: { label: 'Configuration', color: '#bb6bd9', bg: 'rgba(187,107,217,0.1)' },
        toml: { label: 'Configuration', color: '#bb6bd9', bg: 'rgba(187,107,217,0.1)' },
        ini: { label: 'Configuration', color: '#bb6bd9', bg: 'rgba(187,107,217,0.1)' },
        png: { label: 'Raster Image', color: '#27ae60', bg: 'rgba(39,174,96,0.1)' },
        jpg: { label: 'Raster Image', color: '#27ae60', bg: 'rgba(39,174,96,0.1)' },
        jpeg: { label: 'Raster Image', color: '#27ae60', bg: 'rgba(39,174,96,0.1)' },
        gif: { label: 'Raster Image', color: '#27ae60', bg: 'rgba(39,174,96,0.1)' },
        webp: { label: 'Raster Image', color: '#27ae60', bg: 'rgba(39,174,96,0.1)' },
        bmp: { label: 'Raster Image', color: '#27ae60', bg: 'rgba(39,174,96,0.1)' },
        mp4: { label: 'Video Media', color: '#eb5757', bg: 'rgba(235,87,87,0.1)' },
        mkv: { label: 'Video Media', color: '#eb5757', bg: 'rgba(235,87,87,0.1)' },
        avi: { label: 'Video Media', color: '#eb5757', bg: 'rgba(235,87,87,0.1)' },
        mov: { label: 'Video Media', color: '#eb5757', bg: 'rgba(235,87,87,0.1)' },
        webm: { label: 'Video Media', color: '#eb5757', bg: 'rgba(235,87,87,0.1)' },
        mp3: { label: 'Audio Media', color: '#9b51e0', bg: 'rgba(155,81,224,0.1)' },
        wav: { label: 'Audio Media', color: '#9b51e0', bg: 'rgba(155,81,224,0.1)' },
        ogg: { label: 'Audio Media', color: '#9b51e0', bg: 'rgba(155,81,224,0.1)' },
        m4a: { label: 'Audio Media', color: '#9b51e0', bg: 'rgba(155,81,224,0.1)' },
        flac: { label: 'Audio Media', color: '#9b51e0', bg: 'rgba(155,81,224,0.1)' },
        zip: { label: 'Compressed Archive', color: '#6fcf97', bg: 'rgba(111,207,151,0.1)' },
        rar: { label: 'Compressed Archive', color: '#6fcf97', bg: 'rgba(111,207,151,0.1)' },
        '7z': { label: 'Compressed Archive', color: '#6fcf97', bg: 'rgba(111,207,151,0.1)' },
        tar: { label: 'Compressed Archive', color: '#6fcf97', bg: 'rgba(111,207,151,0.1)' },
        gz: { label: 'Compressed Archive', color: '#6fcf97', bg: 'rgba(111,207,151,0.1)' },
        pdf: { label: 'PDF Document', color: '#e056fd', bg: 'rgba(224,86,253,0.1)' },
        doc: { label: 'Text Document', color: '#e2e8f0', bg: 'rgba(226,232,240,0.1)' },
        docx: { label: 'Text Document', color: '#e2e8f0', bg: 'rgba(226,232,240,0.1)' },
        txt: { label: 'Text Document', color: '#e2e8f0', bg: 'rgba(226,232,240,0.1)' },
        md: { label: 'Text Document', color: '#e2e8f0', bg: 'rgba(226,232,240,0.1)' },
    };
    return map[ext] || { label: 'Binary Fragment', color: '#a0aec0', bg: 'rgba(160,174,192,0.1)' };
};

const parseOctalPermissions = (permStr) => {
    if (!permStr || typeof permStr !== 'string') return null;
    const cleanPerms = permStr.slice(-3);
    if (cleanPerms.length !== 3) return null;
    const parseOctalDigit = (digit) => {
        const val = parseInt(digit, 10);
        return { read: (val & 4) !== 0, write: (val & 2) !== 0, execute: (val & 1) !== 0 };
    };
    return { owner: parseOctalDigit(cleanPerms[0]), group: parseOctalDigit(cleanPerms[1]), others: parseOctalDigit(cleanPerms[2]) };
};

const PermissionGrid = ({ permissions }) => {
    const grid = parseOctalPermissions(permissions);
    if (!grid) return <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Unavailable (Windows Host)</div>;
    const renderBit = (val, char) => (
        <span style={{ color: val ? 'var(--accent-gold)' : 'rgba(255,255,255,0.15)', fontWeight: val ? 'bold' : 'normal', margin: '0 2px', fontFamily: 'monospace', fontSize: '13px' }}>
            {val ? char : '-'}
        </span>
    );
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-surface-2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginTop: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                <span>Role</span><span>R W X</span>
            </div>
            {['owner', 'group', 'others'].map(role => (
                <div key={role} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{role}</span>
                    <div>{renderBit(grid[role].read, 'r')}{renderBit(grid[role].write, 'w')}{renderBit(grid[role].execute, 'x')}</div>
                </div>
            ))}\
            <div style={{ fontSize: '11px', textAlign: 'right', color: 'var(--accent-gold)', fontFamily: 'monospace', fontWeight: 'bold', marginTop: '4px' }}>octal: {permissions}</div>
        </div>
    );
};

const formatSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return '0.0 KB';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    if (i < 0) return '0.0 KB';
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDate = (dateStr) => {
    if (!dateStr) return '---';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '---';
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
};

const TAG_PALETTE = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6','#06b6d4','#84cc16','#f97316'];

// ── Main Component ────────────────────────────────────────────────────────────

const InspectorSidebar = ({ isOpen, metadata, loading, onClose, handleAction, guestToken, showToast, agentId, token: tokenProp, currentUsername }) => {
    const token = tokenProp || localStorage.getItem('token');
    const [activeTab, setActiveTab] = useState('info');
    const [imageDimensions, setImageDimensions] = useState(null);

    // Tags state
    const [allTags, setAllTags] = useState([]);
    const [fileTags, setFileTags] = useState([]);
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState(TAG_PALETTE[0]);
    const [tagsLoading, setTagsLoading] = useState(false);

    // Comments state
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState('');
    const [commentsLoading, setCommentsLoading] = useState(false);

    // Versions state
    const [versions, setVersions] = useState([]);
    const [versionsLoading, setVersionsLoading] = useState(false);

    const authHeaders = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        setActiveTab('info');
        setImageDimensions(null);
        setComments([]);
        setVersions([]);
        setFileTags([]);
        if (metadata && !metadata.isDirectory) {
            const ext = metadata.name.split('.').pop().toLowerCase();
            if (['png','jpg','jpeg','gif','webp','bmp','ico'].includes(ext)) {
                const agentIdQuery = agentId ? `&agentId=${agentId}` : '';
                const url = guestToken
                    ? `/public/share/${localStorage.getItem('shareId')}/download?path=${encodeURIComponent(metadata.path)}&token=${guestToken}&intent=stream`
                    : `/api/files/download?path=${encodeURIComponent(metadata.path)}&token=${token || ''}${agentIdQuery}&intent=stream`;
                const img = new Image();
                img.onload = () => setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                img.onerror = () => setImageDimensions(null);
                img.src = url;
            }
        }
    }, [metadata?.path, agentId, guestToken]);

    // Fetch tags when tab switches or path changes
    useEffect(() => {
        if (!metadata?.path || guestToken || activeTab !== 'tags') return;
        const fetchTags = async () => {
            setTagsLoading(true);
            try {
                const [allRes, fileRes] = await Promise.all([
                    axios.get('/api/v1/social/tags', { headers: authHeaders }),
                    axios.get(`/api/v1/social/file-tags?path=${encodeURIComponent(metadata.path)}`, { headers: authHeaders })
                ]);
                setAllTags(allRes.data);
                setFileTags(fileRes.data);
            } catch (e) { console.error('Tags fetch error', e); }
            finally { setTagsLoading(false); }
        };
        fetchTags();
    }, [activeTab, metadata?.path]);

    // Fetch comments
    useEffect(() => {
        if (!metadata?.path || guestToken || activeTab !== 'comments') return;
        const fetchComments = async () => {
            setCommentsLoading(true);
            try {
                const res = await axios.get(`/api/v1/social/comments?path=${encodeURIComponent(metadata.path)}`, { headers: authHeaders });
                setComments(res.data);
            } catch (e) { console.error('Comments fetch error', e); }
            finally { setCommentsLoading(false); }
        };
        fetchComments();
    }, [activeTab, metadata?.path]);

    // Fetch versions
    useEffect(() => {
        if (!metadata?.path || metadata?.isDirectory || guestToken || activeTab !== 'versions') return;
        const fetchVersions = async () => {
            setVersionsLoading(true);
            try {
                const res = await axios.get(`/api/v1/files/versions?path=${encodeURIComponent(metadata.path)}`, { headers: authHeaders });
                setVersions(res.data);
            } catch (e) { console.error('Versions fetch error', e); }
            finally { setVersionsLoading(false); }
        };
        fetchVersions();
    }, [activeTab, metadata?.path]);

    const handleCopyPath = async () => {
        if (metadata?.path) {
            const success = await copyTextToClipboard(metadata.path);
            if (success) {
                showToast && showToast('Path copied to clipboard', 'success');
            } else {
                showToast && showToast('Failed to copy path', 'error');
            }
        }
    };

    const handleCreateTag = async () => {
        if (!newTagName.trim()) return;
        try {
            const res = await axios.post('/api/v1/social/tags', { name: newTagName.trim(), color: newTagColor }, { headers: authHeaders });
            setAllTags(prev => [...prev.filter(t => t.id !== res.data.id), res.data].sort((a,b) => a.name.localeCompare(b.name)));
            setNewTagName('');
            showToast && showToast('Tag created', 'success');
        } catch (e) { showToast && showToast('Failed to create tag', 'error'); }
    };

    const handleAttachTag = async (tag) => {
        const alreadyAttached = fileTags.some(ft => ft.id === tag.id);
        if (alreadyAttached) return;
        try {
            await axios.post('/api/v1/social/file-tags', { path: metadata.path, tagId: tag.id }, { headers: authHeaders });
            setFileTags(prev => [...prev, tag]);
            showToast && showToast(`Tag "${tag.name}" attached`, 'success');
        } catch (e) { showToast && showToast('Failed to attach tag', 'error'); }
    };

    const handleDetachTag = async (tag) => {
        try {
            await axios.delete('/api/v1/social/file-tags', { data: { path: metadata.path, tagId: tag.id }, headers: authHeaders });
            setFileTags(prev => prev.filter(ft => ft.id !== tag.id));
        } catch (e) { showToast && showToast('Failed to remove tag', 'error'); }
    };

    const handleDeleteTag = async (tag) => {
        try {
            await axios.delete(`/api/v1/social/tags/${tag.id}`, { headers: authHeaders });
            setAllTags(prev => prev.filter(t => t.id !== tag.id));
            setFileTags(prev => prev.filter(ft => ft.id !== tag.id));
        } catch (e) { showToast && showToast('Failed to delete tag', 'error'); }
    };

    const handleAddComment = async () => {
        if (!commentText.trim()) return;
        try {
            const res = await axios.post('/api/v1/social/comments', { path: metadata.path, comment: commentText.trim() }, { headers: authHeaders });
            setComments(prev => [...prev, res.data]);
            setCommentText('');
        } catch (e) { showToast && showToast('Failed to add comment', 'error'); }
    };

    const handleDeleteComment = async (id) => {
        try {
            await axios.delete(`/api/v1/social/comments/${id}`, { headers: authHeaders });
            setComments(prev => prev.filter(c => c.id !== id));
        } catch (e) { showToast && showToast('Failed to delete comment', 'error'); }
    };

    const handleRestoreVersion = async (versionId, vNum) => {
        try {
            await axios.post('/api/v1/files/versions/restore', { versionId }, { headers: authHeaders });
            showToast && showToast(`Restored to version ${vNum}`, 'success');
            // Refresh versions list
            const res = await axios.get(`/api/v1/files/versions?path=${encodeURIComponent(metadata.path)}`, { headers: authHeaders });
            setVersions(res.data);
        } catch (e) { showToast && showToast(e.response?.data?.error || 'Restore failed', 'error'); }
    };

    const handleDeleteVersion = async (id) => {
        try {
            await axios.delete(`/api/v1/files/versions/${id}`, { headers: authHeaders });
            setVersions(prev => prev.filter(v => v.id !== id));
            showToast && showToast('Version deleted', 'success');
        } catch (e) { showToast && showToast('Failed to delete version', 'error'); }
    };

    if (!isOpen) return null;

    const mime = metadata ? getMIMEInfo(metadata.name, metadata.isDirectory) : null;
    const agentIdQuery = agentId ? `&agentId=${agentId}` : '';
    const isImage = metadata && !metadata.isDirectory && ['png','jpg','jpeg','gif','webp','bmp','ico'].includes(metadata.name.split('.').pop().toLowerCase());
    const previewUrl = (metadata && isImage)
        ? (guestToken
            ? `/public/share/${localStorage.getItem('shareId')}/download?path=${encodeURIComponent(metadata.path)}&token=${guestToken}&intent=stream`
            : `/api/files/download?path=${encodeURIComponent(metadata.path)}&token=${token || ''}${agentIdQuery}&intent=stream`)
        : null;

    const tabStyle = (tab) => ({
        padding: '6px 12px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: '700',
        cursor: 'pointer',
        border: 'none',
        background: activeTab === tab ? 'rgba(255,255,255,0.1)' : 'transparent',
        color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.4)',
        transition: 'all 0.15s',
        display: 'flex', alignItems: 'center', gap: '4px'
    });

    const TABS = [
        { id: 'info', label: 'Info', icon: <Info size={12} /> },
        { id: 'tags', label: 'Tags', icon: <Tag size={12} />, hidden: !!guestToken },
        { id: 'comments', label: 'Comments', icon: <MessageSquare size={12} />, hidden: !!guestToken },
        { id: 'versions', label: 'Versions', icon: <Clock size={12} />, hidden: !!guestToken || metadata?.isDirectory },
    ].filter(t => !t.hidden);

    return (
        <motion.div
            className="inspector-sidebar-panel glass"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        >
            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px', height: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="skeleton" style={{ width: '120px', height: '24px', borderRadius: '4px' }}></div>
                        <button className="inspector-close-btn" onClick={onClose}><X size={18} /></button>
                    </div>
                    <div className="skeleton" style={{ width: '100%', height: '180px', borderRadius: '12px' }}></div>
                    <div className="skeleton" style={{ width: '80px', height: '18px', borderRadius: '4px' }}></div>
                    {[1,2,3].map(i => <div key={i} className="skeleton" style={{ width: '100%', height: '40px', borderRadius: '6px' }}></div>)}
                </div>
            ) : metadata ? (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    {/* Header */}
                    <div className="inspector-header">
                        <div style={{ overflow: 'hidden' }}>
                            <h3 className="inspector-title" title={metadata.name}>{metadata.name}</h3>
                            <span className="inspector-mime-badge" style={{ color: mime.color, backgroundColor: mime.bg, border: `1px solid ${mime.color}40` }}>{mime.label}</span>
                        </div>
                        <button className="inspector-close-btn" onClick={onClose} title="Close Panel"><X size={18} /></button>
                    </div>

                    {/* Tab Bar */}
                    <div style={{ display: 'flex', gap: '4px', padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                        {TABS.map(tab => (
                            <button key={tab.id} style={tabStyle(tab.id)} onClick={() => setActiveTab(tab.id)}>
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="inspector-scroll-area" style={{ flex: 1, overflowY: 'auto' }}>
                        {/* ── INFO TAB ── */}
                        {activeTab === 'info' && (
                            <>
                                <div className="inspector-preview-section">
                                    {previewUrl ? (
                                        <img src={previewUrl} alt={metadata.name} className="inspector-img-thumbnail" />
                                    ) : (
                                        <div className="inspector-icon-wrapper" style={{ background: metadata.isDirectory ? 'var(--accent-gold-glow)' : 'rgba(255,255,255,0.03)' }}>
                                            {metadata.isDirectory ? <Folder size={56} color="var(--accent-gold)" /> : <File size={56} color="#8b949e" />}
                                        </div>
                                    )}
                                </div>
                                <div className="inspector-details-section">
                                    <h4 className="section-subtitle">File Properties</h4>
                                    {!guestToken && (
                                        <div className="inspector-prop-row inline">
                                            <span className="prop-label">Full Path</span>
                                            <div className="path-copy-container">
                                                <span className="path-text" title={metadata.path}>{metadata.path}</span>
                                                <button className="path-copy-btn" onClick={handleCopyPath} title="Copy absolute path"><Copy size={13} /></button>
                                            </div>
                                        </div>
                                    )}
                                    <div className="inspector-prop-row">
                                        <span className="prop-label">Size</span>
                                        <span className="prop-value" style={{ fontWeight: '600' }}>{formatSize(metadata.size)}</span>
                                    </div>
                                    {imageDimensions && (
                                        <div className="inspector-prop-row">
                                            <span className="prop-label">Resolution</span>
                                            <span className="prop-value" style={{ color: 'var(--accent-cyan)', fontWeight: '600' }}>{imageDimensions.width} × {imageDimensions.height} px</span>
                                        </div>
                                    )}
                                    <div className="inspector-prop-row">
                                        <span className="prop-label">Modified</span>
                                        <span className="prop-value">{formatDate(metadata.modified)}</span>
                                    </div>
                                    {metadata.birthtime && (
                                        <div className="inspector-prop-row">
                                            <span className="prop-label">Created</span>
                                            <span className="prop-value">{formatDate(metadata.birthtime)}</span>
                                        </div>
                                    )}
                                    <div className="inspector-prop-row" style={{ borderBottom: 'none' }}>
                                        <span className="prop-label">Permissions</span>
                                        <PermissionGrid permissions={metadata.permissions} />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ── TAGS TAB ── */}
                        {activeTab === 'tags' && (
                            <div style={{ padding: '16px' }}>
                                {/* Attached tags */}
                                <div style={{ marginBottom: '16px' }}>
                                    <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Attached Tags</p>
                                    {fileTags.length === 0 ? (
                                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', textAlign: 'center', padding: '16px 0' }}>No tags yet</div>
                                    ) : (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {fileTags.map(tag => (
                                                <span key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: `${tag.color}22`, border: `1px solid ${tag.color}66`, borderRadius: '20px', padding: '4px 10px', fontSize: '12px', fontWeight: '600', color: tag.color }}>
                                                    {tag.name}
                                                    <button onClick={() => handleDetachTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: tag.color, display: 'flex', padding: 0, opacity: 0.7 }}><X size={10} /></button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Create new tag */}
                                <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-surface-2)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                                    <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>New Tag</p>
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                        <input
                                            value={newTagName}
                                            onChange={e => setNewTagName(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleCreateTag()}
                                            placeholder="Tag name..."
                                            style={{ flex: 1, background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '6px 10px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                                        />
                                        <button onClick={handleCreateTag} style={{ background: 'var(--accent-gold)', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontWeight: '700', fontSize: '12px', color: '#000' }}>Create</button>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {TAG_PALETTE.map(c => (
                                            <div key={c} onClick={() => setNewTagColor(c)} style={{ width: '20px', height: '20px', borderRadius: '50%', background: c, cursor: 'pointer', border: newTagColor === c ? '2px solid #fff' : '2px solid transparent', transition: 'border 0.15s' }} />
                                        ))}
                                    </div>
                                </div>

                                {/* All user tags */}
                                <div>
                                    <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Your Tags</p>
                                    {tagsLoading ? (
                                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div>
                                    ) : allTags.length === 0 ? (
                                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>No tags created yet</div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {allTags.map(tag => {
                                                const isAttached = fileTags.some(ft => ft.id === tag.id);
                                                return (
                                                    <div key={tag.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '6px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)' }}>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                                                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: tag.color, flexShrink: 0 }} />
                                                            {tag.name}
                                                        </span>
                                                        <div style={{ display: 'flex', gap: '4px' }}>
                                                            <button onClick={() => isAttached ? handleDetachTag(tag) : handleAttachTag(tag)} style={{ background: isAttached ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)', border: `1px solid ${isAttached ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)'}`, borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', color: isAttached ? '#ef4444' : '#818cf8' }}>{isAttached ? 'Remove' : 'Attach'}</button>
                                                            <button onClick={() => handleDeleteTag(tag)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '4px', padding: '3px 6px', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={11} /></button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── COMMENTS TAB ── */}
                        {activeTab === 'comments' && (
                            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
                                {commentsLoading ? (
                                    <div style={{ textAlign: 'center', padding: '24px', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>Loading comments...</div>
                                ) : comments.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '24px', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
                                        <MessageSquare size={28} style={{ marginBottom: '8px', opacity: 0.4 }} />
                                        <div>No comments yet. Be the first!</div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {comments.map(c => (
                                            <div key={c.id} style={{ padding: '10px 12px', background: 'var(--bg-surface-2)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-cyan)' }}>{c.display_name || c.username}</span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{timeAgo(c.created_at)}</span>
                                                        {(c.username === currentUsername) && (
                                                            <button onClick={() => handleDeleteComment(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex', padding: 0 }}><Trash2 size={11} /></button>
                                                        )}
                                                    </div>
                                                </div>
                                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>{c.comment}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {/* Add comment input */}
                                <div style={{ marginTop: 'auto', display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                                    <textarea
                                        value={commentText}
                                        onChange={e => setCommentText(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                                        placeholder="Add a comment... (Enter to send)"
                                        rows={2}
                                        style={{ flex: 1, background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                                    />
                                    <button onClick={handleAddComment} style={{ background: 'var(--accent-gold)', border: 'none', borderRadius: '6px', padding: '0 12px', cursor: 'pointer', color: '#000' }}><Send size={14} /></button>
                                </div>
                            </div>
                        )}

                        {/* ── VERSIONS TAB ── */}
                        {activeTab === 'versions' && (
                            <div style={{ padding: '12px' }}>
                                {versionsLoading ? (
                                    <div style={{ textAlign: 'center', padding: '24px', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>Loading versions...</div>
                                ) : versions.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '24px', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
                                        <Clock size={28} style={{ marginBottom: '8px', opacity: 0.4 }} />
                                        <div>No version history yet.</div>
                                        <div style={{ fontSize: '11px', marginTop: '6px', opacity: 0.6 }}>Overwrite this file to create a version snapshot.</div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {versions.map((v, i) => (
                                            <div key={v.id} style={{ padding: '10px 12px', background: 'var(--bg-surface-2)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                                                    <div>
                                                        <span style={{ fontSize: '12px', fontWeight: '800', color: '#f2c94c' }}>v{v.version_num}</span>
                                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>{formatSize(v.size)}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        <button onClick={() => handleRestoreVersion(v.id, v.version_num)} style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}><RotateCcw size={10} /> Restore</button>
                                                        <button onClick={() => handleDeleteVersion(v.id)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '4px', padding: '3px 6px', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={11} /></button>
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{formatDate(v.created_at)} · by {v.display_name || v.username || 'System'}</div>
                                            </div>
                                        ))}
                                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', paddingTop: '8px' }}>Last {versions.length} version{versions.length !== 1 ? 's' : ''} kept (max 10)</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Quick Actions Panel (only on Info tab) */}
                    {activeTab === 'info' && (
                        <div className="inspector-actions-panel">
                            {!guestToken ? (
                                <>
                                    <button className="inspector-action-btn primary" onClick={() => handleAction('download', metadata)}><Download size={14} /> Download</button>
                                    <button className="inspector-action-btn" onClick={() => handleAction('rename', metadata)}><Edit size={14} /> Rename</button>
                                    <button className="inspector-action-btn" onClick={() => handleAction('share', metadata)}><Share2 size={14} /> Share</button>
                                    <button className="inspector-action-btn danger" onClick={() => handleAction('delete', metadata)}><Trash2 size={14} /> Delete</button>
                                </>
                            ) : (
                                <button className="inspector-action-btn primary" style={{ width: '100%' }} onClick={() => handleAction('download', metadata)}><Download size={14} /> Download File</button>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5, padding: '24px' }}>
                    <Info size={36} style={{ marginBottom: '12px' }} />
                    <p style={{ textAlign: 'center', fontSize: '13px' }}>Select a single file or folder to view details</p>
                </div>
            )}
        </motion.div>
    );
};

export default InspectorSidebar;
