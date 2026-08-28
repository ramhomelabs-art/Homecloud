import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Folder, File } from 'lucide-react';

const API_BASE = '/api';

const PropRow = ({ label, value }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', maxWidth: '200px', textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
);

const PropertiesModal = ({ data, onClose, agentId }) => {
    const [stats, setStats] = useState(data);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (data?.path) {
            const fetchDetailed = async () => {
                try {
                    const resp = await axios.get(`${API_BASE}/files/metadata?path=${encodeURIComponent(data.path)}${agentId ? `&agentId=${agentId}` : ''}`);
                    if (resp.data) setStats(resp.data);
                } catch (e) {
                    console.error('Failed to fetch node metadata', e);
                } finally {
                    setLoading(false);
                }
            };
            fetchDetailed();
        }
    }, [data?.path, agentId]);

    const isDir = data?.isDirectory;

    const formatSize = (bytes) => {
        if (bytes === undefined || bytes === null || isNaN(bytes)) return '0.0 KB';
        if (bytes === 0) return '0.0 KB';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
        if (i < 0) return '0.0 KB';
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    if (!data) return null;
    const displayStats = stats || data;

    return (
        <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={onClose}>
            <div className="modal-content glass" style={{ textAlign: 'left', width: '380px', padding: '24px' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '24px' }}>
                    <div className="st-card-icon" style={{ padding: '16px', borderRadius: '14px', background: isDir ? 'var(--accent-gold-glow)' : 'rgba(255,255,255,0.03)' }}>
                        {isDir ? <Folder size={40} color="var(--accent-gold)" /> : <File size={40} color="#8b949e" />}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                        <h3 style={{ margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{data.name}</h3>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{isDir ? 'System Folder' : 'Binary Fragment'}</p>
                    </div>
                </div>

                <div className="prop-grid" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <PropRow label="Location" value={data.path} />
                    <PropRow label="Size" value={loading ? 'Calculating...' : formatSize(displayStats?.size)} />
                    <PropRow label="Modified" value={new Date(displayStats?.modified || data.modified).toLocaleString()} />
                    <PropRow label="Permissions" value={displayStats?.permissions ? `${displayStats.permissions} (Owner/Read)` : '644 (Read/Write)'} />
                </div>

                <div style={{ marginTop: '32px', display: 'flex', gap: '12px' }}>
                    <button className="auth-submit-btn" style={{ flex: 1 }} onClick={onClose}>Close Analysis</button>
                </div>
            </div>
        </div>
    );
};

export default PropertiesModal;
