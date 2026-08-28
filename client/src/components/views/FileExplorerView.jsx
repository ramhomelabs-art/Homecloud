import React from 'react';
import { 
    Copy, Scissors, Edit, Share2, Trash2, Box, FolderOpen, Download, Eye, X, 
    ChevronRight, ChevronUp, ChevronDown, Upload, HardDrive, Globe, Server, Plus, 
    Database, ShieldAlert, CheckCircle2, ListIcon, LayoutGrid, LayoutList, Filter, 
    Square, File, Folder, Image as ImageIcon, Video, Activity, Star, Tag 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatBytes, formatGB } from './UiUtils';
import InspectorSidebar from '../InspectorSidebar';

const ExplorerToolbar = ({ 
    viewMode, 
    setViewMode, 
    onSelectAll, 
    selectedCount, 
    totalItems, 
    sortBy, 
    setSortBy, 
    sortOrder, 
    setSortOrder,
    tagFilter,
    setTagFilter,
    allTags = []
}) => {
    return (
        <div className="explorer-toolbar" style={{ padding: '0 16px', height: '48px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                    className="selection-checkbox-wrapper"
                    onClick={onSelectAll}
                    style={{ background: 'var(--bg-surface-2)', borderRadius: '6px', padding: '6px', cursor: 'pointer' }}
                >
                    <div className={`selection-checkbox ${(selectedCount === totalItems && totalItems > 0) ? 'checked' : (selectedCount > 0 ? 'partial' : '')}`}>
                        {(selectedCount === totalItems && totalItems > 0) ? <CheckCircle2 size={12} /> : (selectedCount > 0 && <Square size={10} fill="currentColor" />)}
                    </div>
                </div>
                {selectedCount > 0 && (
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--accent-gold)' }}>
                        {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
                    </span>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginLeft: 'auto' }}>
                {allTags && allTags.length > 0 && (
                    <div className="view-controls" style={{ borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '800' }}>
                            <Tag size={14} /> FILTER BY TAG
                            <select
                                value={tagFilter || ''}
                                onChange={(e) => setTagFilter(e.target.value || null)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                <option value="" style={{ color: 'var(--text-secondary)', background: 'var(--bg-surface-0)' }}>All Tags</option>
                                {allTags.map(tag => (
                                    <option key={tag.id} value={tag.name} style={{ color: tag.name === tagFilter ? '#fff' : tag.color, background: 'var(--bg-surface-0)' }}>
                                        {tag.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
                <div className="view-controls" style={{ borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '800' }}>
                        <Filter size={14} title="Sort By" />
                        <select
                            value={sortBy}
                            onChange={(e) => { setSortBy(e.target.value); localStorage.setItem('sortBy', e.target.value); }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            <option value="name">Name</option>
                            <option value="size">Size</option>
                            <option value="modified">Modified</option>
                        </select>
                        <button
                            onClick={() => { const next = sortOrder === 'asc' ? 'desc' : 'asc'; setSortOrder(next); localStorage.setItem('sortOrder', next); }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                        >
                            {sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    </div>
                </div>

                <div className="view-controls">
                    <button
                        className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                        onClick={() => { setViewMode('list'); localStorage.setItem('viewMode', 'list'); }}
                        title="List View"
                    >
                        <ListIcon size={18} />
                    </button>
                    <button
                        className={`view-btn ${viewMode === 'icons-sm' ? 'active' : ''}`}
                        onClick={() => { setViewMode('icons-sm'); localStorage.setItem('viewMode', 'icons-sm'); }}
                        title="Small Icons"
                    >
                        <LayoutGrid size={18} />
                    </button>
                    <button
                        className={`view-btn ${viewMode === 'icons-lg' ? 'active' : ''}`}
                        onClick={() => { setViewMode('icons-lg'); localStorage.setItem('viewMode', 'icons-lg'); }}
                        title="Large Icons"
                    >
                        <LayoutList size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function FileExplorerView({
    guestToken,
    guestPermissions,
    selectedPaths,
    setSelectedPaths,
    files = [],
    sortedFiles = [],
    handleAction,
    handleFileClick,
    tagFilter,
    setTagFilter,
    allTags = [],
    token,
    currentUsername,
    explorerMode,
    selectedDevice,
    path,
    goBack,
    goForward,
    history = [],
    future = [],
    serverPlatform = 'linux',
    navigateTo,
    viewMode,
    setViewMode,
    selectAll,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    activeOps = [],
    avgProgress = 0,
    setShowOperations,
    fileInputRef,
    clipboard,
    handlePaste,
    fileTypeFilter = 'all',
    setFileTypeFilter,
    handleDragOver,
    handleDrop,
    devices = [],
    networkShares = [],
    agentStorage = [],
    setShowProvisionModal,
    handleUpload,
    droppedSessionFiles = [],
    inspectorOpen,
    setInspectorOpen,
    inspectorMetadata,
    loadingMetadata,
    showToast,
    toggleSelection,
    onRightClick,
    handleDragStart
}) {
    const API_BASE = '/api';

    return (
        <motion.div key="exp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {selectedPaths.size > 0 && (() => {
                const canEdit = !guestToken || guestPermissions === 'Edit' || guestPermissions === 'Full Access';
                const firstPath = Array.from(selectedPaths)[0];
                const selectedItem = files.find(f => f.path === firstPath);
                const isFile = selectedItem && !selectedItem.isDirectory;

                return (
                    <div className="selection-toolbar">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '12px', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '16px', whiteSpace: 'nowrap' }}>
                            <span className="selection-toolbar-count">{selectedPaths.size} SELECTED</span>
                        </div>
                        
                        <button className="selection-toolbar-action" onClick={() => handleAction('download')}><Download size={16} /> Download</button>
                        {selectedPaths.size === 1 && isFile && (
                            <button className="selection-toolbar-action" onClick={() => handleFileClick(selectedItem)}><Eye size={16} /> View</button>
                        )}

                        <button className="selection-toolbar-action" onClick={() => handleAction('copy')}><Copy size={16} /> Copy</button>
                        {canEdit && (
                            <button className="selection-toolbar-action" onClick={() => handleAction('cut')}><Scissors size={16} /> Cut</button>
                        )}

                        {selectedPaths.size === 1 && canEdit && (
                            <button className="selection-toolbar-action" onClick={() => handleAction('rename')}><Edit size={16} /> Rename</button>
                        )}

                        {selectedPaths.size === 1 && !guestToken && (
                            <button className="selection-toolbar-action" onClick={() => handleAction('share')}><Share2 size={16} /> Share</button>
                        )}

                        {canEdit && (
                            <button className="selection-toolbar-action danger" onClick={() => handleAction('delete')}><Trash2 size={16} /> Delete</button>
                        )}

                        {!guestToken && (
                            <>
                                <button className="selection-toolbar-action" onClick={() => handleAction('compress')}><Box size={16} /> Archive</button>
                                {selectedPaths.size === 1 && selectedItem && !selectedItem.isDirectory && /\.(zip|tar|tar\.gz|tgz|gz|rar|7z)$/i.test(selectedItem.name) && (
                                    <button className="selection-toolbar-action" onClick={() => handleAction('extract', selectedItem)}>
                                        <FolderOpen size={16} /> Extract
                                    </button>
                                )}
                            </>
                        )}

                        <button className="selection-toolbar-action" style={{ background: 'var(--bg-surface-2)', borderRadius: '50%', padding: '8px', width: '36px', height: '36px', minWidth: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelectedPaths(new Set())}><X size={16} /></button>
                    </div>
                );
            })()}
            
            {!(guestToken && guestPermissions === 'Upload') && (
                <div className="explorer-command-bar">
                    <div className="command-bar-nav">
                        <div className="explorer-nav-buttons">
                            <button
                                className="nav-btn"
                                onClick={goBack}
                                disabled={history.length === 0}
                                title="Back (Alt+Left)"
                            >
                                <ChevronRight size={18} style={{ transform: 'rotate(180deg)', opacity: history.length === 0 ? 0.3 : 1 }} />
                            </button>
                            <button
                                className="nav-btn"
                                onClick={goForward}
                                disabled={future.length === 0}
                                title="Forward (Alt+Right)"
                            >
                                <ChevronRight size={18} style={{ opacity: future.length === 0 ? 0.3 : 1 }} />
                            </button>
                            <button
                                className="nav-btn"
                                onClick={() => {
                                    if (explorerMode === 'files') {
                                        const normalized = path.replace(/\\/g, '/');
                                        const parts = normalized.split('/').filter(Boolean);
                                        const isUNC = path.startsWith('\\\\') || path.startsWith('//');

                                        if ((isUNC && parts.length > 2) || (!isUNC && parts.length > 1)) {
                                            const newParts = parts.slice(0, -1);
                                            const sep = isUNC || serverPlatform === 'win32' ? '\\' : '/';
                                            let prefix = serverPlatform === 'win32' ? '' : '/';
                                            if (isUNC) {
                                                prefix = path.startsWith('\\\\') ? '\\\\' : '//';
                                            } else if (newParts.length > 0 && newParts[0].indexOf(':') !== -1) {
                                                prefix = '';
                                            }
                                            const newPath = prefix + newParts.join(sep);
                                            navigateTo(newPath, 'files');
                                        } else if (selectedDevice?.children) {
                                            navigateTo('/', 'partitions', selectedDevice);
                                        } else {
                                            navigateTo('/', 'devices', null);
                                        }
                                    } else if (explorerMode === 'partitions') {
                                        navigateTo('/', 'devices', null);
                                    }
                                }}
                                disabled={explorerMode === 'devices'}
                                title="Up (Alt+Up)"
                            >
                                <ChevronRight size={18} style={{ transform: 'rotate(-90deg)', opacity: explorerMode === 'devices' ? 0.3 : 1 }} />
                            </button>
                        </div>
                    </div>

                    <div className="command-bar-center">
                        <div className="premium-breadcrumbs">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                {!guestToken && <div className="crumb-item" onClick={() => navigateTo('/', 'devices', null)}>Hardware</div>}
                                {guestToken && <div className="crumb-item" onClick={() => navigateTo('', 'files')}>Shared Drive</div>}

                                {explorerMode !== 'devices' && !guestToken && (
                                    <>
                                        <ChevronRight size={14} color="var(--border-dim)" />
                                        <div className={`crumb-item ${explorerMode === 'partitions' ? 'active' : ''}`} onClick={() => navigateTo('/', 'partitions', selectedDevice)}>
                                            {selectedDevice?.name || 'Device'}
                                        </div>
                                    </>
                                )}

                                {explorerMode === 'files' && path && path.split(/[/\\]/).filter(Boolean).map((p, i, arr) => (
                                    <React.Fragment key={i}>
                                        <ChevronRight size={14} color="var(--border-dim)" />
                                        <div
                                            className={`crumb-item ${i === arr.length - 1 ? 'active' : ''}`}
                                            onClick={() => {
                                                const isUNC = path.startsWith('\\\\');
                                                const parts = path.split(/[/\\]/).filter(Boolean);
                                                const targetParts = parts.slice(0, i + 1).join(path.includes('/') ? '/' : '\\');
                                                const newPath = isUNC ? `\\\\${targetParts}` : (targetParts.includes(':') ? targetParts : (path.startsWith('/') ? '/' + targetParts : targetParts));
                                                navigateTo(newPath, 'files');
                                            }}
                                        >
                                            {p}
                                        </div>
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="command-bar-actions">
                        {explorerMode === 'files' && (
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <ExplorerToolbar
                                    viewMode={viewMode}
                                    setViewMode={setViewMode}
                                    onSelectAll={selectAll}
                                    selectedCount={selectedPaths.size}
                                    totalItems={files.length}
                                    sortBy={sortBy}
                                    setSortBy={setSortBy}
                                    sortOrder={sortOrder}
                                    setSortOrder={setSortOrder}
                                    tagFilter={tagFilter}
                                    setTagFilter={setTagFilter}
                                    allTags={allTags}
                                />

                                {activeOps.length > 0 && (
                                    <div className="header-progress-container" onClick={() => setShowOperations(true)} style={{ cursor: 'pointer' }}>
                                        <div className="header-progress-bar" style={{ width: `${avgProgress}%` }}></div>
                                        <div style={{ position: 'relative', zIndex: 1, fontSize: '11px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            <Activity size={12} color="var(--accent-gold)" style={{ animation: 'spin 2s linear infinite' }} />
                                            <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{activeOps.length}</span>
                                            <span style={{ color: 'var(--accent-gold)' }}>{Math.round(avgProgress)}%</span>
                                        </div>
                                    </div>
                                )}

                                {(!guestToken || guestPermissions === 'Edit' || guestPermissions === 'Full Access' || guestPermissions === 'Upload') && (
                                    <button 
                                        className="btn-primary shadow-premium upload-button" 
                                        style={{ borderRadius: '12px', padding: '8px 20px', fontWeight: '800' }} 
                                        onClick={() => fileInputRef.current.click()}
                                    >
                                        <Upload size={18} /> Upload
                                    </button>
                                )}
                                {clipboard && (!guestToken || guestPermissions === 'Edit' || guestPermissions === 'Full Access') && (
                                    <button 
                                        className="btn-primary shadow-premium" 
                                        style={{ borderRadius: '12px', padding: '8px 20px', fontWeight: '800' }} 
                                        onClick={handlePaste}
                                    >
                                        <Copy size={18} /> Paste
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {explorerMode === 'files' && !(guestToken && guestPermissions === 'Upload') && (
                <div className="explorer-filter-bar" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 24px',
                    background: 'var(--bg-surface-0)',
                    borderBottom: '1px solid var(--border-dim)',
                    overflowX: 'auto',
                    scrollbarWidth: 'none'
                }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: '8px' }}>Filter:</span>
                    {[
                        { id: 'all', label: 'All Files', icon: <Filter size={14} /> },
                        { id: 'folders', label: 'Folders', icon: <Folder size={14} /> },
                        { id: 'documents', label: 'Documents', icon: <File size={14} /> },
                        { id: 'images', label: 'Images', icon: <ImageIcon size={14} /> },
                        { id: 'media', label: 'Media', icon: <Video size={14} /> }
                    ].map(item => {
                        const isActive = fileTypeFilter === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setFileTypeFilter(item.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 16px',
                                    borderRadius: '20px',
                                    border: isActive ? '1px solid var(--accent-gold)' : '1px solid var(--border-dim)',
                                    background: isActive ? 'var(--accent-gold-glow)' : 'rgba(255, 255, 255, 0.02)',
                                    color: isActive ? 'var(--accent-gold)' : '#c9d1d9',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    transition: 'all 0.2s ease',
                                    outline: 'none',
                                    boxShadow: isActive ? '0 0 10px var(--accent-gold-glow)' : 'none'
                                }}
                                className="filter-pill"
                            >
                                {item.icon}
                                {item.label}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="explorer-body">
                <div className={`file-row-grid ${
                    explorerMode === 'devices' ? 'devices-grid' : 
                    explorerMode === 'partitions' ? 'partitions-grid' : 
                    (viewMode === 'list' ? 'list' : (viewMode === 'icons-sm' ? 'icons-sm' : ''))
                }`}
                    style={{ 
                        paddingRight: inspectorOpen ? '370px' : '10px',
                        transition: 'padding-right 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e)}
                    onContextMenu={(e) => {
                        if (e.target.classList.contains('file-row-grid')) {
                            onRightClick(e);
                        }
                    }}
                >
                    {explorerMode === 'devices' && (
                        <>
                            {devices.map((dev, i) => (
                                <div key={i} className="file-card" onClick={() => navigateTo('/', 'partitions', dev)}>
                                    <HardDrive size={56} color="var(--accent-gold)" />
                                    <div className="label">{dev.name}</div>
                                    <div style={{ fontSize: '11px', color: '#484f58' }}>{formatGB((dev.size || 0) / 1e9)} {dev.type}</div>
                                </div>
                            ))}
                            {networkShares.map((ns, i) => (
                                <div key={`net-${i}`} className="file-card" onClick={() => navigateTo(ns.path, 'files', { name: ns.label })}>
                                    <Globe size={56} color="var(--accent-cyan)" />
                                    <div className="label">{ns.label}</div>
                                    <div style={{ fontSize: '11px', color: '#484f58' }}>{ns.type} Cluster</div>
                                </div>
                            ))}
                            {agentStorage.map((ag, i) => (
                                <div key={`ag-${i}`} className="file-card" onClick={() => {
                                    navigateTo('/', 'partitions', {
                                        name: ag.hostname,
                                        type: 'Agent',
                                        id: ag.id,
                                        children: (ag.disks || []).map(d => ({ ...d, name: d.mount, mountpoint: d.mount }))
                                    });
                                }}>
                                    <Server size={56} color="var(--accent-gold)" />
                                    <div className="label">{ag.hostname}</div>
                                    <div style={{ fontSize: '11px', color: '#484f58' }}>Remote Agent</div>
                                </div>
                            ))}
                            <div className="file-card" style={{ border: '2px dashed rgba(242,201,76,0.2)', opacity: 0.8 }} onClick={() => setShowProvisionModal(true)}>
                                <Plus size={56} color="var(--accent-gold)" style={{ opacity: 0.5 }} />
                                <div className="label" style={{ color: 'var(--accent-gold)' }}>Provision New Node</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Install Agent</div>
                            </div>
                        </>
                    )}

                    {explorerMode === 'partitions' && (
                        <>
                            {(selectedDevice?.children || []).map((part, i) => (
                                <div key={i} className="file-card" onClick={() => {
                                    const root = serverPlatform === 'win32' ? 'C:\\' : '/';
                                    let validPath = part.mountpoint || (part.name?.startsWith('/') ? '/' : root);
                                    if (validPath.startsWith('\\\\') && validPath.split('\\').length <= 3) {
                                        validPath = validPath.includes('/') ? '/' : root;
                                    }
                                    navigateTo(validPath, 'files');
                                }}>
                                    {part.type === 'network' ? (
                                        <Globe size={56} color="var(--accent-cyan)" />
                                    ) : (
                                        <Database size={56} color="var(--accent-cyan)" />
                                    )}
                                    <div className="label">{part.label || part.name}</div>
                                    <div style={{ fontSize: '11px', color: '#484f58' }}>{part.type === 'network' ? 'Network Share' : (part.fstype || 'Local Disk')} | {part.mountpoint || 'Not Mounted'}</div>
                                </div>
                            ))}
                        </>
                    )}

                    {explorerMode === 'files' && (
                        <>
                            {guestToken && guestPermissions === 'Upload' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '80vh', padding: '40px 20px', boxSizing: 'border-box', gridColumn: '1/-1' }}>
                                    <div 
                                        className="glass animate-fade-in" 
                                        style={{ 
                                            width: '100%', 
                                            maxWidth: '600px', 
                                            padding: '48px 32px', 
                                            borderRadius: '24px', 
                                            border: '1px solid var(--border-bright)', 
                                            textAlign: 'center', 
                                            background: 'var(--bg-surface-0)', 
                                            boxShadow: '0 24px 80px rgba(0, 0, 0, 0.4)', 
                                            transition: 'all 0.3s ease', 
                                            position: 'relative' 
                                        }}
                                        onDragOver={e => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            e.currentTarget.style.borderColor = 'var(--accent-gold)';
                                            e.currentTarget.style.boxShadow = '0 0 30px var(--accent-gold-glow)';
                                        }}
                                        onDragLeave={e => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }}
                                        onDrop={e => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                            e.currentTarget.style.boxShadow = 'none';
                                            const files = Array.from(e.dataTransfer.files);
                                            if (files.length > 0) handleUpload(files);
                                        }}
                                    >
                                        <div style={{ width: '80px', height: '80px', background: 'linear-gradient(135deg, var(--accent-gold), var(--accent-cyan))', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 8px 24px var(--accent-gold-glow)' }}>
                                            <Upload size={36} color="#000" />
                                        </div>
                                        <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px', color: 'var(--text-primary)' }}>Secure File Drop Box</h2>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>Anonymous upload portal. Drag & drop files here or click below to browse.</p>
                                        <button 
                                            className="btn-primary shadow-premium" 
                                            onClick={() => fileInputRef.current.click()} 
                                            style={{ padding: '12px 32px', borderRadius: '12px', fontWeight: '800', fontSize: '15px' }}
                                        >
                                            Select Files to Drop
                                        </button>
                                    </div>

                                    {droppedSessionFiles.length > 0 && (
                                        <div 
                                            className="glass animate-fade-in" 
                                            style={{ 
                                                width: '100%', 
                                                maxWidth: '600px', 
                                                marginTop: '32px', 
                                                borderRadius: '16px', 
                                                border: '1px solid var(--border-dim)', 
                                                background: 'var(--bg-surface-0)', 
                                                padding: '20px 24px', 
                                                textAlign: 'left' 
                                            }}
                                        >
                                            <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                                Dropped in this session ({droppedSessionFiles.length})
                                            </h4>
                                            <div style={{ display: 'grid', gap: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                                                {droppedSessionFiles.map((p, y) => (
                                                    <div 
                                                        key={y} 
                                                        style={{ 
                                                            display: 'flex', 
                                                            alignItems: 'center', 
                                                            justifyContent: 'space-between', 
                                                            padding: '10px 12px', 
                                                            background: 'rgba(0,0,0,0.2)', 
                                                            borderRadius: '8px', 
                                                            border: '1px solid var(--border-dim)' 
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                                            {p.status === 'quarantined' ? (
                                                                <ShieldAlert size={16} color="var(--accent-gold)" style={{ flexShrink: 0 }} />
                                                            ) : (
                                                                <CheckCircle2 size={16} color="#2ea44f" style={{ flexShrink: 0 }} />
                                                            )}
                                                            <span style={{ 
                                                                fontSize: '13px', 
                                                                fontWeight: '600', 
                                                                color: p.status === 'quarantined' ? 'var(--accent-gold)' : '#e6edf3', 
                                                                overflow: 'hidden', 
                                                                textOverflow: 'ellipsis', 
                                                                whiteSpace: 'nowrap',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px'
                                                            }}>
                                                                {p.name}
                                                                {p.status === 'quarantined' && (
                                                                    <span style={{ fontSize: '9px', fontWeight: '800', background: 'rgba(242, 201, 76, 0.15)', color: 'var(--accent-gold)', border: '1px solid rgba(242, 201, 76, 0.25)', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending Review</span>
                                                                )}
                                                            </span>
                                                        </div>
                                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '12px', flexShrink: 0 }}>
                                                            {(p.size / 1024).toFixed(1)} KB
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    {viewMode === 'list' && files.length > 0 && (
                                        <div className="file-row-list-header">
                                            <div></div>
                                            <div>Name</div>
                                            <div>Size</div>
                                            <div>Type</div>
                                            <div>Modified</div>
                                        </div>
                                    )}

                                    {viewMode === 'list' ? (
                                        sortedFiles.map((f, i) => {
                                            const isSelected = selectedPaths.has(f.path);
                                            const mtime = f.mtime || f.modified;
                                            let formattedDate = mtime ? new Date(mtime).toLocaleDateString() : 'N/A';
                                            if (formattedDate === 'Invalid Date' && mtime) {
                                                const dateObj = new Date(Number(mtime));
                                                if (!isNaN(dateObj.getTime())) {
                                                    formattedDate = dateObj.toLocaleDateString();
                                                }
                                            }

                                            return (
                                                <div 
                                                    key={i} 
                                                    className={`file-row-list-item ${isSelected ? 'selected' : ''}`}
                                                    onClick={(e) => {
                                                        if (e.ctrlKey || e.metaKey) toggleSelection(e, f.path);
                                                        else if (f.isDirectory) navigateTo(f.path, 'files');
                                                        else handleFileClick(f);
                                                    }}
                                                    onContextMenu={(e) => onRightClick(e, f)}
                                                >
                                                    <div className="selection-checkbox-wrapper" onClick={(e) => toggleSelection(e, f.path)}>
                                                        <div className={`selection-checkbox ${isSelected ? 'checked' : ''}`}>
                                                            {isSelected && <CheckCircle2 size={12} />}
                                                        </div>
                                                    </div>
                                                    <div className="col-name">
                                                        {f.isDirectory ? <Folder size={18} color="var(--accent-gold)" /> : <File size={18} color="#8b949e" />}
                                                        <div style={{ marginLeft: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                                            <span style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                {f.name}
                                                                {f.starred && <Star size={12} color="#f2c94c" fill="#f2c94c" style={{ flexShrink: 0 }} />}
                                                            </span>
                                                            {f.tags && f.tags.length > 0 && (
                                                                <div style={{ display: 'flex', gap: '4px', marginTop: '2px', flexWrap: 'wrap' }}>
                                                                    {f.tags.map(t => (
                                                                        <span key={t.id} style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: t.color }} title={t.name} />
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="col-size" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                                                        {formatBytes(f.size)}
                                                    </div>
                                                    <div className="col-type" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                                                        {f.extension || (f.isDirectory ? 'Folder' : 'File')}
                                                    </div>
                                                    <div className="col-mtime" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                                                        {formattedDate}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <>
                                            {files.filter(f => f.isDirectory).length > 0 && (
                                                <div className="explorer-section">
                                                    <div className="section-label"><Folder size={14} /> FOLDERS</div>
                                                    <div className="grid-shelf">
                                                        {sortedFiles.filter(f => f.isDirectory).map((f, i) => (
                                                            <div 
                                                                key={i}
                                                                className={`file-card ${selectedPaths.has(f.path) ? 'selected' : ''}`}
                                                                draggable
                                                                onDragStart={(e) => handleDragStart(e, f)}
                                                                onClick={(e) => {
                                                                    if (e.ctrlKey || e.metaKey) toggleSelection(e, f.path);
                                                                    else navigateTo(f.path, 'files');
                                                                }}
                                                                onContextMenu={(e) => onRightClick(e, f)}
                                                            >
                                                                <div className="selection-checkbox-wrapper" onClick={(e) => toggleSelection(e, f.path)}>
                                                                    <div className={`selection-checkbox ${selectedPaths.has(f.path) ? 'checked' : ''}`}>
                                                                        {selectedPaths.has(f.path) && <CheckCircle2 size={12} />}
                                                                    </div>
                                                                </div>
                                                                <Folder size={64} color="var(--accent-gold)" />
                                                                <p style={{ marginTop: '16px', fontSize: '13px', fontWeight: '700', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                                    {f.name}
                                                                    {f.starred && <Star size={12} color="#f2c94c" fill="#f2c94c" style={{ flexShrink: 0 }} />}
                                                                </p>
                                                                {f.tags && f.tags.length > 0 && (
                                                                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                                                        {f.tags.map(t => (
                                                                            <span key={t.id} style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: t.color }} title={t.name} />
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '800', marginTop: '6px', letterSpacing: '0.08em' }}>{f.itemCount !== undefined ? `FOLDER • ${f.itemCount} ${f.itemCount === 1 ? 'ITEM' : 'ITEMS'}` : (f.size > 0 ? `FOLDER • ${formatBytes(f.size)}` : 'FOLDER')}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {files.filter(f => !f.isDirectory).length > 0 && (
                                                <div className="explorer-section">
                                                    <div className="section-label"><File size={14} /> FILES</div>
                                                    <div className="grid-shelf">
                                                        {sortedFiles.filter(f => !f.isDirectory).map((f, i) => (
                                                            <div 
                                                                key={i}
                                                                className={`file-card ${selectedPaths.has(f.path) ? 'selected' : ''}`}
                                                                draggable
                                                                onDragStart={(e) => handleDragStart(e, f)}
                                                                onClick={(e) => {
                                                                    if (e.ctrlKey || e.metaKey) toggleSelection(e, f.path);
                                                                    else handleFileClick(f);
                                                                }}
                                                                onContextMenu={(e) => onRightClick(e, f)}
                                                            >
                                                                <div className="selection-checkbox-wrapper" onClick={(e) => toggleSelection(e, f.path)}>
                                                                    <div className={`selection-checkbox ${selectedPaths.has(f.path) ? 'checked' : ''}`}>
                                                                        {selectedPaths.has(f.path) && <CheckCircle2 size={12} />}
                                                                    </div>
                                                                </div>
                                                                <File size={64} color={selectedPaths.has(f.path) ? 'var(--accent-gold)' : '#8b949e'} />
                                                                <p style={{ marginTop: '16px', fontSize: '13px', fontWeight: '700', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                                    {f.name}
                                                                    {f.starred && <Star size={12} color="#f2c94c" fill="#f2c94c" style={{ flexShrink: 0 }} />}
                                                                </p>
                                                                {f.tags && f.tags.length > 0 && (
                                                                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                                                        {f.tags.map(t => (
                                                                            <span key={t.id} style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: t.color }} title={t.name} />
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '800', marginTop: '6px', letterSpacing: '0.08em' }}>{(f.extension || 'FILE').toUpperCase()} • {formatBytes(f.size)}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {files.length === 0 && (
                                        <div style={{ padding: '60px', textAlign: 'center', opacity: 0.3, gridColumn: '1/-1' }}>
                                            <Folder size={48} />
                                            <p>This folder is empty</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>

                <AnimatePresence>
                    {inspectorOpen && (
                        <InspectorSidebar
                            isOpen={inspectorOpen}
                            metadata={inspectorMetadata}
                            loading={loadingMetadata}
                            onClose={() => {
                                setInspectorOpen(false);
                                setSelectedPaths(new Set());
                            }}
                            handleAction={handleAction}
                            guestToken={guestToken}
                            showToast={showToast}
                            agentId={selectedDevice?.type === 'Agent' ? selectedDevice.id : undefined}
                            token={token}
                            currentUsername={currentUsername}
                        />
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
