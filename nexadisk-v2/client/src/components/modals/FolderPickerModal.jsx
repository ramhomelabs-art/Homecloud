import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Folder, FolderOpen, ArrowLeft, Loader, X, Server, Database } from 'lucide-react';

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
        // Reset path and list on node change, but preserve initialPath for initial node selection
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
        // Simple path split to go up one level
        if (!currentPath) return;
        const normalized = currentPath.replace(/\\/g, '/');
        const parts = normalized.split('/');
        parts.pop();
        // Handle empty path or Windows drive letter (e.g. "C:")
        let parentPath = parts.join('/');
        if (parentPath.endsWith(':')) parentPath += '/';
        fetchFolders(parentPath);
    };

    const handleConfirm = () => {
        onSelect(selectedFolderPath, selectedNode);
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
            <div className="modal-content glass" style={{ width: '480px', maxHeght: '80vh', display: 'flex', flexDirection: 'column', padding: '24px', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>Select Target Directory</h3>
                    <button className="inspector-close-btn" onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff' }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Node Selector */}
                <div style={{ marginBottom: '16px' }}>
                    <label className="m-label" style={{ display: 'block', marginBottom: '6px' }}>Target Storage Node</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-dim)', borderRadius: '10px', padding: '4px 10px' }}>
                        <Server size={14} color="var(--accent-gold)" />
                        <select
                            value={selectedNode}
                            onChange={e => setSelectedNode(e.target.value)}
                            disabled={lockNode}
                            style={{ 
                                background: 'transparent', 
                                border: 'none', 
                                color: '#fff', 
                                outline: 'none', 
                                width: '100%', 
                                fontSize: '13px', 
                                padding: '4px 0',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <button 
                        onClick={handleGoBack}
                        disabled={!currentPath || loading}
                        style={{
                            background: currentPath ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                            border: '1px solid var(--border-dim)',
                            borderRadius: '8px',
                            color: currentPath ? '#fff' : '#484f58',
                            padding: '6px 10px',
                            cursor: currentPath ? 'pointer' : 'default',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
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
                                fontSize: '11px',
                                color: '#fff',
                                fontFamily: 'monospace',
                                background: 'rgba(0,0,0,0.2)',
                                padding: '6px 10px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-dim)',
                                outline: 'none'
                            }}
                        />
                        <button
                            type="button"
                            onClick={handlePathInputSubmit}
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--border-dim)',
                                borderRadius: '8px',
                                color: '#fff',
                                padding: '6px 12px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                transition: '0.2s'
                            }}
                        >
                            Go
                        </button>
                    </div>
                </div>

                {/* Folder list */}
                <div style={{ flex: 1, minHeight: '200px', maxHeight: '300px', overflowY: 'auto', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-dim)', borderRadius: '12px', padding: '8px', marginBottom: '20px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', gap: '8px', color: '#8b949e', fontSize: '13px' }}>
                            <Loader size={16} style={{ animation: 'spin 1.5s linear infinite' }} />
                            <span>Loading directories...</span>
                        </div>
                    ) : folders.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', opacity: 0.4, gap: '8px' }}>
                            <Folder size={32} />
                            <span style={{ fontSize: '12px' }}>No subdirectories found</span>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '4px' }}>
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
                                            background: isSelected ? 'var(--accent-gold-glow)' : 'transparent',
                                            border: isSelected ? '1px solid var(--accent-gold)' : '1px solid transparent',
                                            color: isSelected ? 'var(--accent-gold)' : '#c9d1d9',
                                            cursor: 'pointer',
                                            transition: '0.2s',
                                            userSelect: 'none'
                                        }}
                                    >
                                        {isSelected ? <FolderOpen size={16} /> : <Folder size={16} color="var(--accent-cyan)" />}
                                        <span style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                    <button type="button" className="auth-submit-btn" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }} onClick={onClose}>
                        Cancel
                    </button>
                    <button 
                        type="button" 
                        className="auth-submit-btn" 
                        style={{ flex: 1, background: 'var(--accent-gold)', color: '#000', fontWeight: 'bold' }} 
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
