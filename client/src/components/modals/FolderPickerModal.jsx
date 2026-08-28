import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Folder, FolderOpen, ArrowLeft, Loader, X, Server } from 'lucide-react';

const API_BASE = '/api';

const FolderPickerModal = ({ agents, onClose, onSelect, showToast, initialNode = 'local', initialPath = '', lockNode = false }) => {
    const [selectedNode, setSelectedNode] = useState(initialNode);
    const [currentPath, setCurrentPath] = useState(initialPath);
    const [folders, setFolders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedFolderPath, setSelectedFolderPath] = useState(initialPath);
    const [currentPathInput, setCurrentPathInput] = useState(initialPath);

    useEffect(() => {
        setCurrentPathInput(currentPath);
    }, [currentPath]);

    const handlePathInputSubmit = () => {
        fetchFolders(currentPathInput);
    };

    const fetchFolders = async (path = '') => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            let url = `${API_BASE}/files/list?path=${encodeURIComponent(path)}`;
            if (selectedNode !== 'local') {
                url += `&agentId=${selectedNode}`;
            }
            const res = await axios.get(url, { headers });
            
            // Filter only directories
            const dirList = (res.data || []).filter(item => item.isDirectory);
            setFolders(dirList);
            setCurrentPath(path);
            setSelectedFolderPath(path); // Default selection is the current browsed folder
        } catch (err) {
            console.error('Failed to list folders:', err);
            showToast('Failed to retrieve directories', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedNode === initialNode) {
            fetchFolders(initialPath);
        } else {
            fetchFolders('');
        }
    }, [selectedNode]);

    const handleNavigate = (path) => {
        fetchFolders(path);
    };

    const handleGoBack = () => {
        if (!currentPath) return;
        const normalized = currentPath.replace(/\\/g, '/');
        const parts = normalized.split('/');
        parts.pop();
        let parentPath = parts.join('/');
        if (parentPath.endsWith(':')) parentPath += '/';
        fetchFolders(parentPath);
    };

    const handleConfirm = () => {
        onSelect(selectedFolderPath, selectedNode);
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
            <div className="modal-content" style={{ width: '500px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '24px', textAlign: 'left', background: 'var(--bg-surface-0)', borderRadius: '16px', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-lg)' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.4px' }}>Select Target Directory</h3>
                    <button onClick={onClose} style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', borderRadius: '6px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        <X size={16} />
                    </button>
                </div>

                {/* Node Selector */}
                <div style={{ marginBottom: '16px' }}>
                    <label className="m-label" style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Target Storage Node</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '6px 12px' }}>
                        <Server size={15} color="var(--primary)" />
                        <select
                            value={selectedNode}
                            onChange={e => setSelectedNode(e.target.value)}
                            disabled={lockNode}
                            style={{ 
                                background: 'transparent', 
                                border: 'none', 
                                color: 'var(--text-primary)', 
                                outline: 'none', 
                                width: '100%', 
                                fontSize: '13px', 
                                fontWeight: '600',
                                cursor: lockNode ? 'not-allowed' : 'pointer',
                                opacity: lockNode ? 0.6 : 1
                            }}
                        >
                            <option value="local">Local Master Node</option>
                            {(agents || []).filter(a => a.status === 'approved').map(a => (
                                <option key={a.id} value={a.id}>{a.hostname} (Remote Agent)</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Current path display / back button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <button 
                        onClick={handleGoBack}
                        disabled={!currentPath || loading}
                        style={{
                            background: currentPath ? 'var(--bg-surface-2)' : 'var(--bg-surface-1)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '8px',
                            color: currentPath ? 'var(--text-primary)' : 'var(--text-dim)',
                            padding: '8px 12px',
                            cursor: currentPath ? 'pointer' : 'default',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease'
                        }}
                        title="Up one level"
                    >
                        <ArrowLeft size={14} />
                    </button>
                    <div style={{ flex: 1, display: 'flex', gap: '6px' }}>
                        <input
                            type="text"
                            value={currentPathInput}
                            onChange={e => setCurrentPathInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    handlePathInputSubmit();
                                }
                            }}
                            placeholder="Enter absolute path (e.g. C:\ or D:\)"
                            style={{
                                flex: 1,
                                fontSize: '12px',
                                color: 'var(--text-primary)',
                                fontFamily: 'var(--font-mono)',
                                background: 'var(--bg-surface-2)',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-subtle)',
                                outline: 'none'
                            }}
                        />
                        <button
                            type="button"
                            onClick={handlePathInputSubmit}
                            style={{
                                background: 'var(--bg-surface-2)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                padding: '8px 14px',
                                fontSize: '12px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            Go
                        </button>
                    </div>
                </div>

                {/* Folder list */}
                <div style={{ flex: 1, minHeight: '220px', maxHeight: '320px', overflowY: 'auto', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '6px', marginBottom: '20px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '180px', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                            <Loader size={16} className="spin" />
                            <span>Loading directories...</span>
                        </div>
                    ) : folders.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '180px', color: 'var(--text-muted)', gap: '8px' }}>
                            <Folder size={32} opacity={0.5} />
                            <span style={{ fontSize: '12.5px', fontWeight: '500' }}>No subdirectories found</span>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '3px' }}>
                            {folders.map((folder, index) => {
                                const isSelected = selectedFolderPath === folder.path;
                                return (
                                    <div 
                                        key={index}
                                        onClick={() => setSelectedFolderPath(folder.path)}
                                        onDoubleClick={() => handleNavigate(folder.path)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            padding: '8px 12px',
                                            borderRadius: '8px',
                                            background: isSelected ? 'rgba(79, 70, 229, 0.1)' : 'var(--bg-surface-0)',
                                            border: `1px solid ${isSelected ? 'var(--primary-light)' : 'var(--border-subtle)'}`,
                                            color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                                            cursor: 'pointer',
                                            transition: 'all 0.12s ease',
                                            userSelect: 'none'
                                        }}
                                    >
                                        {isSelected ? <FolderOpen size={16} color="var(--primary)" /> : <Folder size={16} color="var(--accent-cyan)" />}
                                        <span style={{ fontSize: '13px', fontWeight: isSelected ? '700' : '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {folder.name}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button type="button" className="btn-secondary" style={{ flex: 1, padding: '10px' }} onClick={onClose}>
                        Cancel
                    </button>
                    <button 
                        type="button" 
                        className="btn-primary" 
                        style={{ flex: 1, padding: '10px' }} 
                        onClick={handleConfirm}
                        disabled={loading}
                    >
                        Select Folder
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FolderPickerModal;
