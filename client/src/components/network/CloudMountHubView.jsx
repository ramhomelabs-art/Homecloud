import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Globe, HardDrive, Plus, Trash2, RefreshCw, CheckCircle2, 
    AlertCircle, Folder, FileText, Download, ArrowRight, 
    Layers, Lock, Server, Cpu, Database, Cloud, Terminal, 
    Key, ShieldCheck, Play, Radio
} from 'lucide-react';
import ConfirmModal from '../modals/ConfirmModal';

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const PROTOCOLS = [
    { id: 'GDRIVE', label: 'Google Drive', icon: <Cloud size={20} color="#0ea5e9" />, color: '#0ea5e9', desc: 'Connect personal Google Drive account & shared drives' },
    { id: 'ONEDRIVE', label: 'MS OneDrive', icon: <Cloud size={20} color="#0078d4" />, color: '#0078d4', desc: 'Connect Microsoft OneDrive & SharePoint libraries' },
    { id: 'SMB', label: 'Windows SMB / NAS', icon: <HardDrive size={20} color="var(--primary)" />, color: 'var(--primary)', desc: 'Connect Windows network shares & Synology/TrueNAS' },
    { id: 'S3', label: 'AWS S3 / Cloudflare R2', icon: <Database size={20} color="#f59e0b" />, color: '#f59e0b', desc: 'Connect S3-compatible cloud object buckets & MinIO' },
    { id: 'SFTP', label: 'SFTP over SSH', icon: <Terminal size={20} color="#10b981" />, color: '#10b981', desc: 'Mount remote Linux VPS filesystems securely over SSH' },
    { id: 'NFS', label: 'Linux NFS Share', icon: <Server size={20} color="#8b5cf6" />, color: '#8b5cf6', desc: 'Mount high-speed Network File System exports' }
];

const CloudMountHubView = ({ showToast, onExploreFiles }) => {
    const [mounts, setMounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedProtocol, setSelectedProtocol] = useState('GDRIVE');

    // Add Mount Form State
    const [formLabel, setFormLabel] = useState('');
    const [formPath, setFormPath] = useState('');
    const [formUsername, setFormUsername] = useState('');
    const [formPassword, setFormPassword] = useState('');
    const [formExtra, setFormExtra] = useState({
        bucket: '',
        region: 'us-east-1',
        endpoint: '',
        gdriveEmail: '',
        sftpHost: '',
        sftpPort: '22'
    });
    const [submitting, setSubmitting] = useState(false);

    // SMB Discovery State
    const [smbHost, setSmbHost] = useState('');
    const [discoveredShares, setDiscoveredShares] = useState(null);
    const [discovering, setDiscovering] = useState(false);
    const [discoveryError, setDiscoveryError] = useState('');

    // Remote File Explorer Modal State
    const [exploringMount, setExploringMount] = useState(null);
    const [remoteFiles, setRemoteFiles] = useState([]);
    const [remoteLoading, setRemoteLoading] = useState(false);
    const [importingFile, setImportingFile] = useState(null);

    // Ping Test State
    const [testingId, setTestingId] = useState(null);
    const [testResult, setTestResult] = useState({});

    const fetchMounts = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.get('/api/v1/cloud/mounts', { headers });
            setMounts(res.data.mounts || []);
        } catch (err) {
            console.error('Failed to fetch cloud mounts', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMounts();
    }, []);

    const handleDiscoverShares = async () => {
        if (!smbHost) {
            setDiscoveryError('Host address / IP is required to scan');
            return;
        }
        setDiscovering(true);
        setDiscoveryError('');
        setDiscoveredShares([]);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.post('/api/v1/network/discover-shares', {
                path: smbHost,
                username: formUsername,
                password: formPassword
            }, { headers });
            
            if (res.data && res.data.length > 0) {
                setDiscoveredShares(res.data);
                if (showToast) showToast(`Found ${res.data.length} available SMB shares!`, 'success');
            } else {
                setDiscoveredShares([]);
                setDiscoveryError('No shares found on host or anonymous access denied.');
            }
        } catch (err) {
            console.error('Failed to discover SMB shares:', err);
            setDiscoveryError(err.response?.data?.error || err.message || 'Failed to scan SMB shares');
            if (showToast) showToast('Scan failed. Check host and credentials.', 'error');
        } finally {
            setDiscovering(false);
        }
    };

    const handleCreateMount = async (e) => {
        e.preventDefault();
        if (!formLabel) return;
        setSubmitting(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post('/api/v1/cloud/mounts', {
                label: formLabel,
                type: selectedProtocol,
                path: formPath,
                username: formUsername,
                password: formPassword,
                extraConfig: formExtra
            }, { headers });

            if (showToast) showToast(`Successfully connected ${selectedProtocol} drive "${formLabel}"`, 'success');
            setShowAddModal(false);
            resetForm();
            fetchMounts();
        } catch (err) {
            if (showToast) showToast('Failed to create cloud mount', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleTestConnection = async (id) => {
        setTestingId(id);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.post(`/api/v1/cloud/mounts/${id}/test`, {}, { headers });
            setTestResult(prev => ({ ...prev, [id]: res.data }));
            if (showToast) showToast(res.data.message, 'success');
        } catch (err) {
            if (showToast) showToast('Connection test failed', 'error');
        } finally {
            setTestingId(null);
        }
    };

    const handleOpenExplorer = async (mount) => {
        if (onExploreFiles) {
            onExploreFiles(mount);
            return;
        }
        setExploringMount(mount);
        setRemoteLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.get(`/api/v1/cloud/mounts/${mount.id}/files`, { headers });
            setRemoteFiles(res.data.files || []);
        } catch (err) {
            if (showToast) showToast('Failed to list remote cloud files', 'error');
        } finally {
            setRemoteLoading(false);
        }
    };

    const handleImportFile = async (fileName) => {
        if (!exploringMount) return;
        setImportingFile(fileName);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.post(`/api/v1/cloud/mounts/${exploringMount.id}/import`, {
                fileName,
                targetFolder: '/'
            }, { headers });
            if (showToast) showToast(res.data.message || `Imported ${fileName} to NexaDisk!`, 'success');
        } catch (err) {
            if (showToast) showToast('Failed to import file', 'error');
        } finally {
            setImportingFile(null);
        }
    };

    const [mountToDisconnect, setMountToDisconnect] = useState(null);

    const confirmDisconnectMount = async () => {
        if (!mountToDisconnect) return;
        const { id, label } = mountToDisconnect;
        setMountToDisconnect(null);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.delete(`/api/v1/cloud/mounts/${id}`, { headers });
            if (showToast) showToast(`Mount "${label}" disconnected.`, 'info');
            fetchMounts();
        } catch (err) {
            if (showToast) showToast('Failed to disconnect mount', 'error');
        }
    };

    const handleDeleteMount = (id, label) => {
        setMountToDisconnect({ id, label });
    };

    const resetForm = () => {
        setFormLabel('');
        setFormPath('');
        setFormUsername('');
        setFormPassword('');
        setFormExtra({
            bucket: '',
            region: 'us-east-1',
            endpoint: '',
            gdriveEmail: '',
            sftpHost: '',
            sftpPort: '22'
        });
        setSmbHost('');
        setDiscoveredShares(null);
        setDiscovering(false);
        setDiscoveryError('');
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', padding: '10px 0' }}>
            {/* Header Title */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h2 style={{ fontSize: '26px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Globe size={28} color="var(--accent-cyan)" /> Cloud & Network Storage Hub
                    </h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Manage personal Google Drive, Windows SMB/NAS, AWS S3 / Cloudflare R2, Linux NFS, and SFTP remote server mounts
                    </p>
                </div>

                <button 
                    onClick={() => setShowAddModal(true)}
                    className="btn-primary shadow-premium"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: '800' }}
                >
                    <Plus size={16} /> Mount Cloud / Shared Drive
                </button>
            </div>

            {/* Top Multi-Cloud Topology Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Mounted Cloud Endpoints</span>
                        <Cloud size={18} color="#0ea5e9" />
                    </div>
                    <span style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-primary)' }}>{mounts.length} Active</span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Unified multi-protocol pool</span>
                </div>

                <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Supported Protocols</span>
                        <Layers size={18} color="var(--primary)" />
                    </div>
                    <span style={{ fontSize: '28px', fontWeight: '900', color: 'var(--primary)' }}>5 Engines</span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>GDrive • SMB • S3 • SFTP • NFS</span>
                </div>

                <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Encryption Shield</span>
                        <ShieldCheck size={18} color="#10b981" />
                    </div>
                    <span style={{ fontSize: '28px', fontWeight: '900', color: '#10b981' }}>AES-256 Vault</span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>All cloud tokens & keys encrypted</span>
                </div>
            </div>

            {/* Mount Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
                {mounts.map((m) => {
                    const proto = PROTOCOLS.find(p => p.id === m.type) || PROTOCOLS[1];
                    const test = testResult[m.id];

                    return (
                        <div 
                            key={m.id}
                            className="glass" 
                            style={{
                                padding: '24px',
                                borderRadius: '20px',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-surface-0)',
                                boxShadow: 'var(--shadow-sm)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between'
                            }}
                        >
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '12px',
                                            background: 'var(--bg-surface-2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: `1px solid ${proto.color}40`
                                        }}>
                                            {proto.icon}
                                        </div>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>{m.label}</h3>
                                            <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: '700' }}>{proto.label}</span>
                                        </div>
                                    </div>

                                    <span style={{
                                        fontSize: '10px',
                                        fontWeight: '800',
                                        padding: '3px 8px',
                                        borderRadius: '6px',
                                        background: 'rgba(16, 185, 129, 0.15)',
                                        color: '#10b981',
                                        border: '1px solid rgba(16, 185, 129, 0.3)'
                                    }}>
                                        🟢 ONLINE
                                    </span>
                                </div>

                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', wordBreak: 'break-all' }}>
                                    {m.type === 'GDRIVE' ? (
                                        <span>Account: <strong>{m.extraConfig?.gdriveEmail || 'Connected'}</strong></span>
                                    ) : m.type === 'S3' ? (
                                        <span>Bucket: <strong>{m.extraConfig?.bucket || 's3-bucket'}</strong> ({m.extraConfig?.region || 'us-east-1'})</span>
                                    ) : m.type === 'SFTP' ? (
                                        <span>Host: <strong>{m.extraConfig?.sftpHost || 'remote-server'}</strong> (Port {m.extraConfig?.sftpPort || '22'})</span>
                                    ) : (
                                        <span>Path: <strong>{m.path || '\\\\nas\\share'}</strong></span>
                                    )}
                                </div>

                                {test && (
                                    <div style={{
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        background: 'rgba(16, 185, 129, 0.08)',
                                        border: '1px solid rgba(16, 185, 129, 0.25)',
                                        fontSize: '11px',
                                        color: '#10b981',
                                        fontWeight: '700',
                                        marginBottom: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}>
                                        <CheckCircle2 size={13} /> {test.message}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)', gap: '8px' }}>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                        onClick={() => handleTestConnection(m.id)}
                                        disabled={testingId === m.id}
                                        className="btn-secondary"
                                        style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '11.5px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        <Radio size={12} className={testingId === m.id ? 'spin' : ''} /> Ping Test
                                    </button>
                                    <button
                                        onClick={() => handleOpenExplorer(m)}
                                        className="btn-secondary shadow-premium"
                                        style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '11.5px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        <Folder size={12} /> Explore Files
                                    </button>
                                </div>

                                <button
                                    onClick={() => handleDeleteMount(m.id, m.label)}
                                    className="btn-danger"
                                    style={{ padding: '6px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '700' }}
                                    title="Disconnect Mount"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    );
                })}

                {/* Empty State / Add Card */}
                {mounts.length === 0 && !loading && (
                    <div 
                        onClick={() => setShowAddModal(true)}
                        className="glass" 
                        style={{
                            padding: '40px',
                            borderRadius: '20px',
                            border: '2px dashed var(--border-subtle)',
                            background: 'var(--bg-surface-0)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            textAlign: 'center'
                        }}
                    >
                        <Cloud size={40} color="var(--text-dim)" style={{ marginBottom: '12px' }} />
                        <strong style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>No Cloud Drives Connected</strong>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>Click here to connect your Google Drive, SMB NAS, S3 bucket or SFTP server.</p>
                    </div>
                )}
            </div>

            {/* MODAL: ADD CLOUD MOUNT WIZARD */}
            {showAddModal && (
                <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setShowAddModal(false)}>
                    <div className="modal-content glass" style={{ width: '560px', padding: '28px', textAlign: 'left', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '24px', boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '19px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Globe size={22} color="var(--primary)" /> Mount Cloud & Network Storage
                        </h3>

                        {/* Protocol Selection Tabs */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px', marginBottom: '20px' }}>
                            {PROTOCOLS.map(p => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => setSelectedProtocol(p.id)}
                                    style={{
                                        padding: '10px 8px',
                                        borderRadius: '10px',
                                        border: `1px solid ${selectedProtocol === p.id ? p.color : 'var(--border-subtle)'}`,
                                        background: selectedProtocol === p.id ? `${p.color}15` : 'var(--bg-surface-2)',
                                        color: selectedProtocol === p.id ? p.color : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '11px',
                                        fontWeight: '800',
                                        transition: '0.2s'
                                    }}
                                >
                                    {p.icon}
                                    <span>{p.label}</span>
                                </button>
                            ))}
                        </div>

                        <form onSubmit={handleCreateMount} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px' }}>Drive Mount Label *</label>
                                <input 
                                    className="m-input"
                                    required
                                    placeholder="e.g. My Personal Google Drive or Synology Backup Pool"
                                    value={formLabel}
                                    onChange={e => setFormLabel(e.target.value)}
                                    style={{ width: '100%', outline: 'none' }}
                                />
                            </div>

                            {/* Dynamic Protocol Fields */}
                            {selectedProtocol === 'GDRIVE' && (
                                <>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px' }}>Google Account Email</label>
                                        <input 
                                            className="m-input"
                                            placeholder="e.g. user@gmail.com"
                                            value={formExtra.gdriveEmail}
                                            onChange={e => setFormExtra({ ...formExtra, gdriveEmail: e.target.value })}
                                            style={{ width: '100%', outline: 'none' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px' }}>OAuth2 Access Token / Service Account Key</label>
                                        <input 
                                            className="m-input"
                                            type="password"
                                            placeholder="Paste Google Cloud OAuth2 Access Token / Service Secret"
                                            value={formPassword}
                                            onChange={e => setFormPassword(e.target.value)}
                                            style={{ width: '100%', outline: 'none' }}
                                        />
                                    </div>
                                </>
                            )}

                            {selectedProtocol === 'ONEDRIVE' && (
                                <>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px' }}>Microsoft 365 / OneDrive Email</label>
                                        <input 
                                            className="m-input"
                                            placeholder="e.g. user@outlook.com or company.onmicrosoft.com"
                                            value={formExtra.gdriveEmail}
                                            onChange={e => setFormExtra({ ...formExtra, gdriveEmail: e.target.value })}
                                            style={{ width: '100%', outline: 'none' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px' }}>Microsoft Graph API Token / Client Secret</label>
                                        <input 
                                            className="m-input"
                                            type="password"
                                            placeholder="Paste MS Graph OAuth2 Access Token"
                                            value={formPassword}
                                            onChange={e => setFormPassword(e.target.value)}
                                            style={{ width: '100%', outline: 'none' }}
                                        />
                                    </div>
                                </>
                            )}

                            {selectedProtocol === 'SMB' && (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'end' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px' }}>SMB Server Host / IP *</label>
                                            <input 
                                                className="m-input"
                                                placeholder="e.g. 192.168.1.100 or nas.local"
                                                value={smbHost}
                                                onChange={e => setSmbHost(e.target.value)}
                                                style={{ width: '100%', outline: 'none' }}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleDiscoverShares}
                                            disabled={discovering || !smbHost}
                                            className="btn-primary"
                                            style={{
                                                padding: '12px 16px',
                                                borderRadius: '12px',
                                                fontSize: '13px',
                                                fontWeight: '800',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                cursor: 'pointer',
                                                height: '46px'
                                            }}
                                        >
                                            {discovering ? <RefreshCw size={14} className="spin" /> : <Globe size={14} />}
                                            {discovering ? 'Scanning...' : 'Scan Shares'}
                                        </button>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px' }}>Username</label>
                                            <input 
                                                className="m-input"
                                                placeholder="Username"
                                                value={formUsername}
                                                onChange={e => setFormUsername(e.target.value)}
                                                style={{ width: '100%', outline: 'none' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px' }}>Password</label>
                                            <input 
                                                className="m-input"
                                                type="password"
                                                placeholder="Password"
                                                value={formPassword}
                                                onChange={e => setFormPassword(e.target.value)}
                                                style={{ width: '100%', outline: 'none' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Scan Results Display */}
                                    {discoveryError && (
                                        <div style={{ color: '#f43f5e', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', background: '#f43f5e15', borderRadius: '12px', border: '1px solid #f43f5e30' }}>
                                            <AlertCircle size={14} /> {discoveryError}
                                        </div>
                                    )}

                                    {discoveredShares && discoveredShares.length > 0 && (
                                        <div>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '8px' }}>Select SMB Share to Connect *</label>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto', padding: '6px', border: '1px solid var(--border-subtle)', borderRadius: '12px', background: 'var(--bg-surface-1)' }}>
                                                {discoveredShares.map(share => {
                                                    const sharePathString = `\\\\${smbHost.replace(/\\/g, '/').replace(/^\/+/, '')}\\${share.name}`;
                                                    const isSelected = formPath === sharePathString;
                                                    return (
                                                        <div
                                                            key={share.name}
                                                            onClick={() => {
                                                                setFormPath(sharePathString);
                                                                if (!formLabel || formLabel.startsWith('SMB:')) {
                                                                    setFormLabel(`SMB: ${share.name}`);
                                                                }
                                                            }}
                                                            style={{
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center',
                                                                padding: '10px 14px',
                                                                borderRadius: '10px',
                                                                background: isSelected ? 'var(--primary-light)' : 'transparent',
                                                                border: `1px solid ${isSelected ? 'var(--primary)' : 'transparent'}`,
                                                                color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                                                                cursor: 'pointer',
                                                                fontWeight: isSelected ? '800' : '600',
                                                                fontSize: '13px',
                                                                transition: '0.15s'
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <Folder size={14} color={isSelected ? 'var(--primary)' : 'var(--text-dim)'} />
                                                                <span>{share.name}</span>
                                                            </div>
                                                            {share.comment && (
                                                                <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 'normal' }}>{share.comment}</span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Final mount path display */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px' }}>Final Connection Path (Auto-generated)</label>
                                        <input 
                                            className="m-input"
                                            required
                                            readOnly
                                            placeholder="Select a share above or enter host to list shares"
                                            value={formPath}
                                            style={{ width: '100%', outline: 'none', background: 'var(--bg-surface-2)', cursor: 'not-allowed', color: 'var(--text-secondary)' }}
                                        />
                                    </div>
                                </>
                            )}


                            {selectedProtocol === 'S3' && (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px' }}>S3 Bucket Name *</label>
                                            <input 
                                                className="m-input"
                                                required
                                                placeholder="e.g. nexadisk-cold-storage"
                                                value={formExtra.bucket}
                                                onChange={e => setFormExtra({ ...formExtra, bucket: e.target.value })}
                                                style={{ width: '100%', outline: 'none' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px' }}>Region</label>
                                            <input 
                                                className="m-input"
                                                placeholder="us-east-1"
                                                value={formExtra.region}
                                                onChange={e => setFormExtra({ ...formExtra, region: e.target.value })}
                                                style={{ width: '100%', outline: 'none' }}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px' }}>Access Key ID</label>
                                            <input 
                                                className="m-input"
                                                placeholder="AKIA..."
                                                value={formUsername}
                                                onChange={e => setFormUsername(e.target.value)}
                                                style={{ width: '100%', outline: 'none' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px' }}>Secret Access Key</label>
                                            <input 
                                                className="m-input"
                                                type="password"
                                                placeholder="Secret Key"
                                                value={formPassword}
                                                onChange={e => setFormPassword(e.target.value)}
                                                style={{ width: '100%', outline: 'none' }}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {selectedProtocol === 'SFTP' && (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '10px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px' }}>SSH Host / IP *</label>
                                            <input 
                                                className="m-input"
                                                required
                                                placeholder="e.g. 198.51.100.25 or vps.mydomain.com"
                                                value={formExtra.sftpHost}
                                                onChange={e => setFormExtra({ ...formExtra, sftpHost: e.target.value })}
                                                style={{ width: '100%', outline: 'none' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px' }}>Port</label>
                                            <input 
                                                className="m-input"
                                                placeholder="22"
                                                value={formExtra.sftpPort}
                                                onChange={e => setFormExtra({ ...formExtra, sftpPort: e.target.value })}
                                                style={{ width: '100%', outline: 'none' }}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px' }}>SSH Username</label>
                                            <input 
                                                className="m-input"
                                                placeholder="root or ubuntu"
                                                value={formUsername}
                                                onChange={e => setFormUsername(e.target.value)}
                                                style={{ width: '100%', outline: 'none' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px' }}>SSH Password / Key</label>
                                            <input 
                                                className="m-input"
                                                type="password"
                                                placeholder="Password or Private Key"
                                                value={formPassword}
                                                onChange={e => setFormPassword(e.target.value)}
                                                style={{ width: '100%', outline: 'none' }}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {selectedProtocol === 'NFS' && (
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px' }}>NFS Server & Export Path *</label>
                                    <input 
                                        className="m-input"
                                        required
                                        placeholder="e.g. 192.168.1.50:/mnt/nfs_pool"
                                        value={formPath}
                                        onChange={e => setFormPath(e.target.value)}
                                        style={{ width: '100%', outline: 'none' }}
                                    />
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                                <button type="button" className="btn-secondary" style={{ flex: 1, padding: '10px' }} onClick={() => setShowAddModal(false)}>Cancel</button>
                                <button type="submit" className="btn-primary" style={{ flex: 1, padding: '10px', fontWeight: '800' }} disabled={submitting}>
                                    {submitting ? 'Connecting...' : 'Connect Storage Drive'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: REMOTE CLOUD FILE EXPLORER */}
            {exploringMount && (
                <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setExploringMount(null)}>
                    <div className="modal-content glass" style={{ width: '680px', padding: '28px', textAlign: 'left', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '24px', boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Folder size={20} color="var(--primary)" /> {exploringMount.label}
                                </h3>
                                <span style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>Protocol: {exploringMount.type} Remote Storage</span>
                            </div>
                            <button className="btn-secondary" onClick={() => setExploringMount(null)} style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px' }}>Close</button>
                        </div>

                        {remoteLoading ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
                                <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px auto' }} />
                                Loading remote file hierarchy...
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
                                {remoteFiles.map((file) => (
                                    <div 
                                        key={file.name}
                                        style={{
                                            padding: '12px 16px',
                                            borderRadius: '10px',
                                            background: 'var(--bg-surface-2)',
                                            border: '1px solid var(--border-subtle)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            {file.isDirectory ? <Folder size={18} color="var(--primary)" /> : <FileText size={18} color="#0ea5e9" />}
                                            <div>
                                                <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{file.name}</strong>
                                                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                                    {file.isDirectory ? 'Directory' : formatBytes(file.size)} • Modified: {new Date(file.modifiedAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>

                                        {!file.isDirectory && (
                                            <button
                                                onClick={() => handleImportFile(file.name)}
                                                disabled={importingFile === file.name}
                                                className="btn-primary"
                                                style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '11.5px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}
                                            >
                                                <Download size={13} />
                                                {importingFile === file.name ? 'Importing...' : 'Copy to NexaDisk'}
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* In-UI Confirmation: Disconnect Mount */}
            <ConfirmModal
                show={!!mountToDisconnect}
                title="Disconnect Storage Mount"
                message={`Are you sure you want to disconnect cloud mount "${mountToDisconnect?.label}"? Remote files will no longer be mapped.`}
                confirmText="Disconnect Mount"
                cancelText="Cancel"
                type="danger"
                onConfirm={confirmDisconnectMount}
                onCancel={() => setMountToDisconnect(null)}
            />
        </div>
    );
};

export default CloudMountHubView;
