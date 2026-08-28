import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, Copy, Download, Edit, Share2, Trash2, 
    Folder, File, Image as ImageIcon, Calendar, Shield, HardDrive, Info
} from 'lucide-react';

const getMIMEInfo = (fileName, isDir) => {
    if (isDir) {
        return { label: 'System Folder', color: '#f2c94c', bg: 'rgba(242, 201, 76, 0.1)' };
    }
    const parts = fileName.split('.');
    const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
    switch (ext) {
        case 'js':
        case 'jsx':
        case 'ts':
        case 'tsx':
        case 'py':
        case 'go':
        case 'cpp':
        case 'c':
        case 'java':
        case 'sh':
        case 'ps1':
        case 'bat':
        case 'rb':
        case 'rs':
            return { label: 'Code Script', color: '#56ccf2', bg: 'rgba(86, 204, 242, 0.1)' };
        case 'css':
        case 'scss':
        case 'less':
            return { label: 'Stylesheet', color: '#2d9cdb', bg: 'rgba(45, 156, 219, 0.1)' };
        case 'html':
        case 'xml':
        case 'svg':
            return { label: 'Markup Document', color: '#f2994a', bg: 'rgba(242, 153, 74, 0.1)' };
        case 'json':
        case 'yaml':
        case 'yml':
        case 'toml':
        case 'ini':
        case 'conf':
            return { label: 'Configuration', color: '#bb6bd9', bg: 'rgba(187, 107, 217, 0.1)' };
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'webp':
        case 'bmp':
        case 'ico':
            return { label: 'Raster Image', color: '#27ae60', bg: 'rgba(39, 174, 96, 0.1)' };
        case 'mp4':
        case 'mkv':
        case 'avi':
        case 'mov':
        case 'webm':
            return { label: 'Video Media', color: '#eb5757', bg: 'rgba(235, 87, 87, 0.1)' };
        case 'mp3':
        case 'wav':
        case 'ogg':
        case 'm4a':
        case 'flac':
            return { label: 'Audio Media', color: '#9b51e0', bg: 'rgba(155, 81, 224, 0.1)' };
        case 'zip':
        case 'rar':
        case '7z':
        case 'tar':
        case 'gz':
        case 'tgz':
            return { label: 'Compressed Archive', color: '#6fcf97', bg: 'rgba(111, 207, 151, 0.1)' };
        case 'pdf':
            return { label: 'PDF Document', color: '#e056fd', bg: 'rgba(224, 86, 253, 0.1)' };
        case 'doc':
        case 'docx':
        case 'txt':
        case 'md':
        case 'rtf':
            return { label: 'Text Document', color: '#e2e8f0', bg: 'rgba(226, 232, 240, 0.1)' };
        default:
            return { label: 'Binary Fragment', color: '#a0aec0', bg: 'rgba(160, 174, 192, 0.1)' };
    }
};

const parseOctalPermissions = (permStr) => {
    if (!permStr || typeof permStr !== 'string') return null;
    const cleanPerms = permStr.slice(-3);
    if (cleanPerms.length !== 3) return null;

    const parseOctalDigit = (digit) => {
        const val = parseInt(digit, 10);
        return {
            read: (val & 4) !== 0,
            write: (val & 2) !== 0,
            execute: (val & 1) !== 0
        };
    };

    return {
        owner: parseOctalDigit(cleanPerms[0]),
        group: parseOctalDigit(cleanPerms[1]),
        others: parseOctalDigit(cleanPerms[2])
    };
};

const PermissionGrid = ({ permissions }) => {
    const grid = parseOctalPermissions(permissions);
    if (!grid) return <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>Unavailable (Windows Host)</div>;

    const renderBit = (val, char) => (
        <span style={{
            color: val ? 'var(--accent-gold)' : 'rgba(255,255,255,0.15)',
            fontWeight: val ? 'bold' : 'normal',
            margin: '0 2px',
            fontFamily: 'monospace',
            fontSize: '13px'
        }}>
            {val ? char : '-'}
        </span>
    );

    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px', 
            background: 'rgba(255,255,255,0.02)', 
            padding: '12px', 
            borderRadius: '8px', 
            border: '1px solid rgba(255,255,255,0.05)',
            marginTop: '6px'
        }}>
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                borderBottom: '1px solid rgba(255,255,255,0.05)', 
                paddingBottom: '4px', 
                fontSize: '11px', 
                fontWeight: 'bold', 
                color: 'rgba(255,255,255,0.4)', 
                textTransform: 'uppercase' 
            }}>
                <span>Role</span>
                <span>R W X</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: '#c9d1d9' }}>Owner</span>
                <div>
                    {renderBit(grid.owner.read, 'r')}
                    {renderBit(grid.owner.write, 'w')}
                    {renderBit(grid.owner.execute, 'x')}
                </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: '#c9d1d9' }}>Group</span>
                <div>
                    {renderBit(grid.group.read, 'r')}
                    {renderBit(grid.group.write, 'w')}
                    {renderBit(grid.group.execute, 'x')}
                </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: '#c9d1d9' }}>Others</span>
                <div>
                    {renderBit(grid.others.read, 'r')}
                    {renderBit(grid.others.write, 'w')}
                    {renderBit(grid.others.execute, 'x')}
                </div>
            </div>
            <div style={{ 
                fontSize: '11px', 
                textAlign: 'right', 
                color: 'var(--accent-gold)', 
                fontFamily: 'monospace', 
                fontWeight: 'bold', 
                marginTop: '4px' 
            }}>
                octal: {permissions}
            </div>
        </div>
    );
};

const formatSize = (bytes) => {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return '0.0 KB';
    if (bytes === 0) return '0.0 KB';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    if (i < 0) return '0.0 KB';
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDate = (dateStr) => {
    if (!dateStr) return '---';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '---';
    return d.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
};

const InspectorSidebar = ({
    isOpen,
    metadata,
    loading,
    onClose,
    handleAction,
    guestToken,
    showToast,
    agentId
}) => {
    const [imageDimensions, setImageDimensions] = useState(null);

    useEffect(() => {
        setImageDimensions(null);
        if (metadata && !metadata.isDirectory) {
            const ext = metadata.name.split('.').pop().toLowerCase();
            const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico'].includes(ext);
            if (isImage) {
                const token = localStorage.getItem('token');
                const agentIdQuery = agentId ? `&agentId=${agentId}` : '';
                const url = guestToken
                    ? `/public/share/${localStorage.getItem('shareId')}/download?path=${encodeURIComponent(metadata.path)}&token=${guestToken}`
                    : `/api/files/download?path=${encodeURIComponent(metadata.path)}&token=${token || ''}${agentIdQuery}`;
                
                const img = new Image();
                img.onload = () => {
                    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                };
                img.onerror = () => {
                    console.error('Failed to load image resolution dynamically');
                    setImageDimensions(null);
                };
                img.src = url;
            }
        }
    }, [metadata?.path, agentId, guestToken]);

    const handleCopyPath = () => {
        if (metadata?.path) {
            navigator.clipboard.writeText(metadata.path);
            showToast('Path copied to clipboard', 'success');
        }
    };

    if (!isOpen) return null;

    const mime = metadata ? getMIMEInfo(metadata.name, metadata.isDirectory) : null;
    const token = localStorage.getItem('token');
    const agentIdQuery = agentId ? `&agentId=${agentId}` : '';
    const isImage = metadata && !metadata.isDirectory && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico'].includes(metadata.name.split('.').pop().toLowerCase());
    const previewUrl = (metadata && isImage)
        ? (guestToken
            ? `/public/share/${localStorage.getItem('shareId')}/download?path=${encodeURIComponent(metadata.path)}&token=${guestToken}`
            : `/api/files/download?path=${encodeURIComponent(metadata.path)}&token=${token || ''}${agentIdQuery}`)
        : null;

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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div className="skeleton" style={{ width: '100%', height: '40px', borderRadius: '6px' }}></div>
                        <div className="skeleton" style={{ width: '100%', height: '40px', borderRadius: '6px' }}></div>
                        <div className="skeleton" style={{ width: '100%', height: '40px', borderRadius: '6px' }}></div>
                    </div>
                </div>
            ) : metadata ? (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    {/* Header */}
                    <div className="inspector-header">
                        <div style={{ overflow: 'hidden' }}>
                            <h3 className="inspector-title" title={metadata.name}>{metadata.name}</h3>
                            <span 
                                className="inspector-mime-badge"
                                style={{ 
                                    color: mime.color, 
                                    backgroundColor: mime.bg,
                                    border: `1px solid ${mime.color}40`
                                }}
                            >
                                {mime.label}
                            </span>
                        </div>
                        <button className="inspector-close-btn" onClick={onClose} title="Close Panel">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Scrollable content area */}
                    <div className="inspector-scroll-area">
                        {/* Preview / Large Icon Container */}
                        <div className="inspector-preview-section">
                            {previewUrl ? (
                                <img src={previewUrl} alt={metadata.name} className="inspector-img-thumbnail" />
                            ) : (
                                <div className="inspector-icon-wrapper" style={{ background: metadata.isDirectory ? 'var(--accent-gold-glow)' : 'rgba(255,255,255,0.03)' }}>
                                    {metadata.isDirectory ? (
                                        <Folder size={56} color="var(--accent-gold)" />
                                    ) : (
                                        <File size={56} color="#8b949e" />
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Details list */}
                        <div className="inspector-details-section">
                            <h4 className="section-subtitle">File Properties</h4>
                            
                            {/* Path with Copy */}
                            {!guestToken && (
                                <div className="inspector-prop-row inline">
                                    <span className="prop-label">Full Path</span>
                                    <div className="path-copy-container">
                                        <span className="path-text" title={metadata.path}>{metadata.path}</span>
                                        <button className="path-copy-btn" onClick={handleCopyPath} title="Copy absolute path">
                                            <Copy size={13} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Size */}
                            <div className="inspector-prop-row">
                                <span className="prop-label">Size</span>
                                <span className="prop-value" style={{ fontWeight: '600' }}>
                                    {formatSize(metadata.size)}
                                </span>
                            </div>

                            {/* Image Resolution */}
                            {imageDimensions && (
                                <div className="inspector-prop-row">
                                    <span className="prop-label">Resolution</span>
                                    <span className="prop-value" style={{ color: 'var(--accent-cyan)', fontWeight: '600' }}>
                                        {imageDimensions.width} × {imageDimensions.height} px
                                    </span>
                                </div>
                            )}

                            {/* Mod Date */}
                            <div className="inspector-prop-row">
                                <span className="prop-label">Modified</span>
                                <span className="prop-value">{formatDate(metadata.modified)}</span>
                            </div>

                            {/* Birth Date */}
                            {metadata.birthtime && (
                                <div className="inspector-prop-row">
                                    <span className="prop-label">Created</span>
                                    <span className="prop-value">{formatDate(metadata.birthtime)}</span>
                                </div>
                            )}

                            {/* Permissions */}
                            <div className="inspector-prop-row" style={{ borderBottom: 'none' }}>
                                <span className="prop-label">Permissions</span>
                                <PermissionGrid permissions={metadata.permissions} />
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions Panel */}
                    <div className="inspector-actions-panel">
                        {!guestToken ? (
                            <>
                                <button className="inspector-action-btn primary" onClick={() => handleAction('download', metadata)}>
                                    <Download size={14} /> Download
                                </button>
                                <button className="inspector-action-btn" onClick={() => handleAction('rename', metadata)}>
                                    <Edit size={14} /> Rename
                                </button>
                                <button className="inspector-action-btn" onClick={() => handleAction('share', metadata)}>
                                    <Share2 size={14} /> Share
                                </button>
                                <button className="inspector-action-btn danger" onClick={() => handleAction('delete', metadata)}>
                                    <Trash2 size={14} /> Delete
                                </button>
                            </>
                        ) : (
                            <button className="inspector-action-btn primary" style={{ width: '100%' }} onClick={() => handleAction('download', metadata)}>
                                <Download size={14} /> Download File
                            </button>
                        )}
                    </div>
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
