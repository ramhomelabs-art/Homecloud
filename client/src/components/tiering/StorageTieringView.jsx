import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Layers, Flame, Database, Snowflake, Trash2, 
    Play, Plus, RotateCcw, Camera, HardDrive, 
    Clock, CheckCircle2, AlertCircle, ArrowRight, 
    Sparkles, ShieldCheck, RefreshCw, Sliders, X, FileText,
    Copy, Zap, FolderOpen, Folder, Eye, Search
} from 'lucide-react';
import FolderPickerModal from '../modals/FolderPickerModal';
import ConfirmModal from '../modals/ConfirmModal';

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const StorageTieringView = ({ showToast }) => {
    const [stats, setStats] = useState(null);
    const [policies, setPolicies] = useState([]);
    const [snapshots, setSnapshots] = useState([]);
    const [dedup, setDedup] = useState(null);
    const [targets, setTargets] = useState([]);
    const [selectedTarget, setSelectedTarget] = useState(() => localStorage.getItem('nexadisk_tiering_selected_target') || 'master_root');
    const [customPath, setCustomPath] = useState(() => localStorage.getItem('nexadisk_tiering_custom_path') || '');
    const [savedCustomPaths, setSavedCustomPaths] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('nexadisk_tiering_saved_custom_paths')) || [];
        } catch (e) {
            return [];
        }
    });
    const [showFolderPicker, setShowFolderPicker] = useState(false);
    const [activeTab, setActiveTab] = useState('policies'); // 'policies', 'dedup', 'snapshots', 'history'
    const [loading, setLoading] = useState(true);
    const [runningSweep, setRunningSweep] = useState(false);
    const [scanningDedup, setScanningDedup] = useState(false);
    const [showAddPolicy, setShowAddPolicy] = useState(false);
    const [showAddSnapshot, setShowAddSnapshot] = useState(false);
    const [inspectingSnapshot, setInspectingSnapshot] = useState(null);
    const [manifestSearch, setManifestSearch] = useState('');

    // Form state for new policy
    const [formName, setFormName] = useState('');
    const [formPattern, setFormPattern] = useState('*.log,*.tmp');
    const [formSource, setFormSource] = useState('HOT');
    const [formTarget, setFormTarget] = useState('WARM');
    const [formDays, setFormDays] = useState(30);
    const [formAction, setFormAction] = useState('MIGRATE');
    const [formDesc, setFormDesc] = useState('');

    // Snapshot form
    const [snapLabel, setSnapLabel] = useState('');

    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    const persistCustomPath = (pathVal) => {
        if (!pathVal || !pathVal.trim()) return;
        const clean = pathVal.trim();
        localStorage.setItem('nexadisk_tiering_selected_target', 'custom');
        localStorage.setItem('nexadisk_tiering_custom_path', clean);
        setSavedCustomPaths(prev => {
            const next = Array.from(new Set([clean, ...prev])).slice(0, 15);
            localStorage.setItem('nexadisk_tiering_saved_custom_paths', JSON.stringify(next));
            return next;
        });
    };

    const loadAll = async (targetId = selectedTarget, pathVal = customPath) => {
        setLoading(true);
        try {
            const [targetsRes, statsRes, polRes, snapRes] = await Promise.all([
                axios.get('/api/v1/tiering/targets', { headers: getHeaders() }),
                axios.get(`/api/v1/tiering/stats?targetId=${encodeURIComponent(targetId)}&path=${encodeURIComponent(pathVal || '')}`, { headers: getHeaders() }),
                axios.get('/api/v1/tiering/policies', { headers: getHeaders() }),
                axios.get('/api/v1/tiering/snapshots', { headers: getHeaders() })
            ]);
            setTargets(targetsRes.data.targets || []);
            setStats(statsRes.data);
            setPolicies(polRes.data.policies || []);
            setSnapshots(snapRes.data.snapshots || []);
        } catch (e) {
            if (showToast) showToast('Failed to load storage tiering data', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAll(selectedTarget, customPath);
    }, []);

    const handleTargetChange = (newTargetId) => {
        if (newTargetId.startsWith('saved:')) {
            const pathVal = newTargetId.substring(6);
            setSelectedTarget('custom');
            setCustomPath(pathVal);
            persistCustomPath(pathVal);
            loadAll('custom', pathVal);
            return;
        }

        setSelectedTarget(newTargetId);
        localStorage.setItem('nexadisk_tiering_selected_target', newTargetId);
        if (newTargetId !== 'custom') {
            setCustomPath('');
            localStorage.removeItem('nexadisk_tiering_custom_path');
            loadAll(newTargetId, '');
        }
    };

    const handleApplyCustomPath = (e) => {
        if (e) e.preventDefault();
        if (!customPath.trim()) return;
        const clean = customPath.trim();
        setSelectedTarget('custom');
        persistCustomPath(clean);
        loadAll('custom', clean);
        if (showToast) showToast(`Path saved & active: ${clean}`, 'success');
    };

    const handleRunSweep = async () => {
        setRunningSweep(true);
        try {
            const res = await axios.post('/api/v1/tiering/run', { 
                targetId: selectedTarget, 
                path: customPath 
            }, { headers: getHeaders() });
            if (showToast) showToast(`Tiering sweep completed on ${res.data.targetNode || 'target'}! Evaluated ${res.data.processed} files.`, 'success');
            loadAll(selectedTarget, customPath);
        } catch (e) {
            if (showToast) showToast('Sweep failed: ' + (e.response?.data?.error || e.message), 'error');
        } finally {
            setRunningSweep(false);
        }
    };

    const handleScanDedup = async () => {
        setScanningDedup(true);
        try {
            const res = await axios.get(`/api/v1/tiering/dedup?targetId=${encodeURIComponent(selectedTarget)}&path=${encodeURIComponent(customPath || '')}`, { headers: getHeaders() });
            setDedup(res.data);
            if (showToast) showToast(`Deduplication scan complete on ${res.data.targetNode || 'storage'}: ${res.data.totalDuplicateSets} duplicate sets detected`, 'success');
        } catch (e) {
            if (showToast) showToast('Deduplication scan failed: ' + (e.response?.data?.error || e.message), 'error');
        } finally {
            setScanningDedup(false);
        }
    };

    const handleCreatePolicy = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/v1/tiering/policies', {
                name: formName,
                pattern: formPattern,
                sourceTier: formSource,
                targetTier: formTarget,
                daysThreshold: formDays,
                action: formAction,
                description: formDesc
            }, { headers: getHeaders() });
            if (showToast) showToast('Lifecycle rule created successfully', 'success');
            setShowAddPolicy(false);
            setFormName('');
            setFormDesc('');
            loadAll();
        } catch (e) {
            if (showToast) showToast(e.response?.data?.error || 'Failed to create rule', 'error');
        }
    };

    // In-UI Confirmation Modal State
    const [confirmAction, setConfirmAction] = useState(null);

    const handleDeletePolicy = (id) => {
        setConfirmAction({
            title: 'Delete Tiering Policy',
            message: 'Are you sure you want to permanently delete this automated tiering policy?',
            confirmText: 'Delete Policy',
            type: 'danger',
            onConfirm: async () => {
                try {
                    await axios.delete(`/api/v1/tiering/policies/${id}`, { headers: getHeaders() });
                    if (showToast) showToast('Rule deleted', 'success');
                    loadAll();
                } catch (e) {
                    if (showToast) showToast(e.response?.data?.error || 'Failed to delete rule', 'error');
                }
            }
        });
    };

    const handleTogglePolicy = async (policy) => {
        try {
            await axios.put(`/api/v1/tiering/policies/${policy.id}`, { enabled: !policy.enabled }, { headers: getHeaders() });
            loadAll();
        } catch (e) {
            if (showToast) showToast(e.response?.data?.error || 'Failed to update rule', 'error');
        }
    };

    const handleCreateSnapshot = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/v1/tiering/snapshots', { 
                label: snapLabel,
                targetId: selectedTarget,
                path: customPath
            }, { headers: getHeaders() });
            if (showToast) showToast('Point-in-time snapshot created!', 'success');
            setShowAddSnapshot(false);
            setSnapLabel('');
            loadAll(selectedTarget, customPath);
        } catch (e) {
            if (showToast) showToast(e.response?.data?.error || 'Snapshot creation failed', 'error');
        }
    };

    const handleDeleteSnapshot = (id, label) => {
        setConfirmAction({
            title: 'Delete Snapshot',
            message: `Are you sure you want to permanently delete snapshot "${label}"?`,
            confirmText: 'Delete Snapshot',
            type: 'danger',
            onConfirm: async () => {
                try {
                    await axios.delete(`/api/v1/tiering/snapshots/${id}`, { headers: getHeaders() });
                    if (showToast) showToast(`Snapshot "${label}" deleted successfully`, 'success');
                    loadAll(selectedTarget, customPath);
                } catch (e) {
                    if (showToast) showToast(e.response?.data?.error || 'Failed to delete snapshot', 'error');
                }
            }
        });
    };

    const handleViewSnapshotManifest = async (snap) => {
        try {
            const res = await axios.get(`/api/v1/tiering/snapshots/${snap.id}/manifest`, { headers: getHeaders() });
            setInspectingSnapshot(res.data);
            setManifestSearch('');
        } catch (e) {
            setInspectingSnapshot(snap);
            setManifestSearch('');
        }
    };

    const handleRestoreSnapshot = (id) => {
        setConfirmAction({
            title: 'Restore Cluster State',
            message: 'Are you sure you want to restore cluster files and database state to this point-in-time snapshot?',
            confirmText: 'Restore Snapshot',
            type: 'primary',
            onConfirm: async () => {
                try {
                    const res = await axios.post(`/api/v1/tiering/snapshots/${id}/restore`, {}, { headers: getHeaders() });
                    if (showToast) showToast(res.data.message || 'Snapshot restored', 'success');
                    loadAll(selectedTarget, customPath);
                } catch (e) {
                    if (showToast) showToast(e.response?.data?.error || 'Restore failed', 'error');
                }
            }
        });
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', padding: '10px 0' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h2 style={{ fontSize: '26px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Layers size={28} color="var(--primary)" /> Automated Storage Tiering & Lifecycle
                    </h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Intelligent multi-tier migration (Hot NVMe ➔ Warm Fleet ➔ Cold Cloud) & deduplication engine
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={handleRunSweep}
                        disabled={runningSweep}
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: '800', borderRadius: '10px' }}
                    >
                        <Zap size={16} />
                        {runningSweep ? 'Sweeping Tiers...' : 'Run Tiering Sweep'}
                    </button>
                    <button
                        onClick={() => setShowAddPolicy(true)}
                        className="btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', fontWeight: '800', borderRadius: '10px' }}
                    >
                        <Plus size={16} /> Add Rule
                    </button>
                </div>
            </div>

            {/* Target Storage / Device / Shared Drive Selector Bar */}
            <div className="glass" style={{
                padding: '16px 20px',
                borderRadius: '16px',
                background: 'var(--bg-surface-0)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            padding: '6px 10px',
                            borderRadius: '8px',
                            background: 'rgba(99, 102, 241, 0.15)',
                            color: 'var(--primary)',
                            fontSize: '11px',
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            TARGET STORAGE SELECTOR
                        </div>
                        <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                            Choose which local disk, fleet machine node, or cloud share to analyze & tier:
                        </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <select
                            value={selectedTarget}
                            onChange={(e) => handleTargetChange(e.target.value)}
                            style={{
                                padding: '8px 14px',
                                borderRadius: '10px',
                                background: 'var(--bg-surface-2)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-primary)',
                                fontSize: '13px',
                                fontWeight: '700',
                                outline: 'none',
                                cursor: 'pointer',
                                minWidth: '280px'
                            }}
                        >
                            <option value="master_root">💻 Master Server (Primary NVMe/SSD Uploads)</option>
                            {targets.filter(t => t.id !== 'master_root').map(t => (
                                <option key={t.id} value={t.id}>
                                    {t.type === 'DISK' ? '💽 ' : t.type === 'AGENT' ? '🌐 ' : t.type === 'CLOUD' ? '☁️ ' : '📁 '}
                                    {t.label}
                                </option>
                            ))}
                            {savedCustomPaths.length > 0 && (
                                <optgroup label="⭐ Saved Custom Paths">
                                    {savedCustomPaths.map((p, idx) => (
                                        <option key={`saved_${idx}`} value={`saved:${p}`}>
                                            📁 {p}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                            <option value="custom">📁 Custom System Directory Path...</option>
                        </select>

                        <button
                            type="button"
                            onClick={() => setShowFolderPicker(true)}
                            className="btn-secondary"
                            style={{ padding: '8px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '800', border: '1px solid rgba(99, 102, 241, 0.4)' }}
                            title="Interactively browse and select Windows drives or Linux folders"
                        >
                            <FolderOpen size={15} color="var(--primary)" /> Browse Folder
                        </button>

                        <button
                            onClick={() => loadAll(selectedTarget, customPath)}
                            className="btn-secondary"
                            style={{ padding: '8px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '800' }}
                            title="Refresh scan for selected target"
                        >
                            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
                        </button>
                    </div>
                </div>

                {/* Custom Path Input Field (visible when custom is active) */}
                {selectedTarget === 'custom' && (
                    <form onSubmit={handleApplyCustomPath} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px' }}>
                        <input
                            type="text"
                            placeholder="Enter absolute directory path (e.g. D:\MyData or /mnt/storage)..."
                            value={customPath}
                            onChange={(e) => setCustomPath(e.target.value)}
                            style={{
                                flex: 1,
                                padding: '9px 14px',
                                borderRadius: '10px',
                                background: 'var(--bg-surface-2)',
                                border: '1px solid var(--primary)',
                                color: 'var(--text-primary)',
                                fontSize: '13px',
                                outline: 'none'
                            }}
                        />
                        <button
                            type="submit"
                            className="btn-primary"
                            style={{ padding: '9px 18px', borderRadius: '10px', fontWeight: '800', fontSize: '13px' }}
                        >
                            Save & Target Path
                        </button>
                        {savedCustomPaths.length > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSavedCustomPaths([]);
                                    localStorage.removeItem('nexadisk_tiering_saved_custom_paths');
                                    if (showToast) showToast('Saved path history cleared', 'info');
                                }}
                                className="btn-secondary"
                                style={{ padding: '9px 12px', borderRadius: '10px', fontSize: '12px', color: 'var(--text-dim)' }}
                                title="Clear saved custom path history"
                            >
                                Clear History
                            </button>
                        )}
                    </form>
                )}
            </div>

            {/* Storage Tiers Pipeline Banner */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                {/* Hot Tier */}
                <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(245, 158, 11, 0.3)', background: 'var(--bg-surface-0)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.08 }}>
                        <Flame size={90} color="#f59e0b" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                            <Flame size={20} />
                        </div>
                        <div>
                            <span style={{ fontSize: '11px', fontWeight: '800', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>HOT TIER</span>
                            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>NVMe Flash / SSD</h4>
                        </div>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', marginTop: '8px' }}>
                        {formatBytes(stats?.tiers?.HOT?.bytes || 0)}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Primary Active Storage (Age &lt; 14 Days)
                    </div>
                </div>

                {/* Warm Tier */}
                <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(99, 102, 241, 0.3)', background: 'var(--bg-surface-0)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.08 }}>
                        <Database size={90} color="var(--primary)" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)' }}>
                            <Database size={20} />
                        </div>
                        <div>
                            <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>WARM TIER</span>
                            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>Fleet Nodes & NAS</h4>
                        </div>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', marginTop: '8px' }}>
                        {formatBytes(stats?.tiers?.WARM?.bytes || 0)}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Secondary Capacity (Age 14 - 60 Days)
                    </div>
                </div>

                {/* Cold Tier */}
                <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(14, 165, 233, 0.3)', background: 'var(--bg-surface-0)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.08 }}>
                        <Snowflake size={90} color="#0ea5e9" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9' }}>
                            <Snowflake size={20} />
                        </div>
                        <div>
                            <span style={{ fontSize: '11px', fontWeight: '800', color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '0.5px' }}>COLD TIER</span>
                            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>Cloud Glacier / R2</h4>
                        </div>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', marginTop: '8px' }}>
                        {formatBytes(stats?.tiers?.COLD?.bytes || 0)}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Long-Term Archive (Age &gt; 60 Days)
                    </div>
                </div>
            </div>

            {/* Storage Infrastructure & Physical Routing Strip */}
            <div className="glass" style={{
                padding: '16px 20px',
                borderRadius: '14px',
                background: 'var(--bg-surface-0)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: 'rgba(99, 102, 241, 0.12)',
                        border: '1px solid rgba(99, 102, 241, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary)'
                    }}>
                        <HardDrive size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            MANAGED STORAGE ROOT & TARGET NODE
                        </div>
                        <div style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                            <span>{stats?.activeNode || 'Master Server Node (Host Machine)'}</span>
                            <span style={{ color: 'var(--text-dim)' }}>•</span>
                            <code style={{ background: 'var(--bg-surface-2)', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', color: 'var(--primary)' }}>
                                {stats?.storageRoot || 'D:\\opt\\nexadisk\\nexadisk-v2\\uploads'}
                            </code>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <span style={{ color: '#f59e0b', fontWeight: '800' }}>🔥 Hot: </span> 
                        <span>Local NVMe/SSD</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <span style={{ color: 'var(--primary)', fontWeight: '800' }}>⚡ Warm: </span> 
                        <span>Fleet Agent Dev-01 (HDDs)</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <span style={{ color: '#0ea5e9', fontWeight: '800' }}>❄️ Cold: </span> 
                        <span>S3 Glacier Cloud Vault</span>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                {[
                    { id: 'policies', label: 'Lifecycle Rules Matrix', icon: <Sliders size={16} /> },
                    { id: 'dedup', label: 'Deduplication Analyzer', icon: <Copy size={16} /> },
                    { id: 'snapshots', label: 'Point-in-Time Snapshots', icon: <Camera size={16} /> },
                    { id: 'history', label: 'Migration Audit History', icon: <Clock size={16} /> }
                ].map(tab => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id);
                                if (tab.id === 'dedup' && !dedup) handleScanDedup();
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '9px 16px',
                                borderRadius: '10px',
                                border: `1px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
                                background: isActive ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                                fontWeight: isActive ? '800' : '600',
                                fontSize: '13px',
                                cursor: 'pointer',
                                transition: '0.2s'
                            }}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* TAB CONTENT */}
            {activeTab === 'policies' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                        {policies.map(p => (
                            <div key={p.id} className="glass" style={{ padding: '20px', borderRadius: '16px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: '800', padding: '3px 8px', borderRadius: '6px', background: p.enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: p.enabled ? '#10b981' : '#ef4444' }}>
                                            {p.enabled ? '🟢 ACTIVE' : '⚪ PAUSED'}
                                        </span>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button 
                                                onClick={() => handleTogglePolicy(p)}
                                                style={{ padding: '4px 8px', borderRadius: '6px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', fontSize: '11px', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: '700' }}
                                            >
                                                {p.enabled ? 'Pause' : 'Resume'}
                                            </button>
                                            <button 
                                                onClick={() => handleDeletePolicy(p.id)}
                                                style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                    <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>{p.name}</h3>
                                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 14px 0' }}>{p.description}</p>
                                </div>

                                <div style={{ background: 'var(--bg-surface-2)', padding: '12px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', border: '1px solid var(--border-subtle)' }}>
                                    <div>
                                        <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Pattern & Age</span>
                                        <strong style={{ color: 'var(--text-primary)' }}>{p.pattern} &gt; {p.daysThreshold}d</strong>
                                    </div>
                                    <ArrowRight size={16} color="var(--primary)" />
                                    <div>
                                        <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Target Tier</span>
                                        <strong style={{ color: p.targetTier === 'COLD' ? '#0ea5e9' : p.targetTier === 'PURGE' ? '#ef4444' : 'var(--primary)' }}>{p.targetTier}</strong>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 2: DEDUPLICATION */}
            {activeTab === 'dedup' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="glass" style={{ padding: '20px', borderRadius: '16px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3 style={{ margin: '0 0 4px 0', fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Copy size={18} color="var(--primary)" /> Cluster Deduplication Analyzer
                            </h3>
                            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                                Detect redundant copies across node disks with SHA-256 hash comparison
                            </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block' }}>Reclaimable Space</span>
                                <strong style={{ fontSize: '18px', color: '#10b981' }}>{formatBytes(dedup?.reclaimableBytes || dedup?.totalWastedBytes || 0)}</strong>
                            </div>
                            <button
                                onClick={handleScanDedup}
                                disabled={scanningDedup}
                                className="btn-primary"
                                style={{ padding: '8px 16px', fontWeight: '800', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                <RefreshCw size={14} className={scanningDedup ? 'spin-anim' : ''} />
                                {scanningDedup ? 'Scanning...' : 'Re-Scan Storage'}
                            </button>
                        </div>
                    </div>

                    {((dedup?.duplicateGroups || dedup?.groups || []).length === 0) ? (
                        <div className="glass" style={{ padding: '60px', textAlign: 'center', borderRadius: '16px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                            <ShieldCheck size={48} color="#10b981" style={{ margin: '0 auto 12px' }} />
                            <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', color: 'var(--text-primary)' }}>Storage Fully Optimized</h4>
                            <p style={{ margin: 0, fontSize: '12.5px' }}>Zero duplicate file blocks detected in targeted storage partition.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {(dedup?.duplicateGroups || dedup?.groups || []).map((group, idx) => {
                                const filesList = group.files || group.copies || [];
                                return (
                                    <div key={idx} className="glass" style={{ padding: '16px', borderRadius: '12px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', background: 'var(--bg-surface-2)', padding: '2px 8px', borderRadius: '4px', color: 'var(--primary)' }}>
                                                    SHA-256: {group.hash}...
                                                </span>
                                                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                                                    {group.duplicateCount || filesList.length} redundant copies ({formatBytes(group.wastedBytes || group.reclaimableBytes || 0)} wasted)
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            {filesList.map((f, fi) => (
                                                <span key={fi} style={{ fontSize: '11px', background: 'var(--bg-surface-2)', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                                                    📄 {f.name || f.relativePath} ({formatBytes(f.size)})
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: SNAPSHOTS */}
            {activeTab === 'snapshots' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="glass" style={{ padding: '20px', borderRadius: '16px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3 style={{ margin: '0 0 4px 0', fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Camera size={18} color="var(--primary)" /> Point-in-Time Volume Snapshots
                            </h3>
                            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                                Capture immutable snapshots for instant disaster recovery and time-machine rollback
                            </p>
                        </div>
                        <button
                            onClick={() => setShowAddSnapshot(true)}
                            className="btn-primary"
                            style={{ padding: '8px 16px', fontWeight: '800', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            <Camera size={14} /> Create Snapshot Now
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                        {snapshots.length === 0 ? (
                            <div className="glass" style={{ gridColumn: '1 / -1', padding: '50px', textAlign: 'center', borderRadius: '16px', color: 'var(--text-secondary)' }}>
                                <Camera size={40} color="var(--text-dim)" style={{ margin: '0 auto 10px' }} />
                                <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)' }}>No Snapshots Recorded</h4>
                                <p style={{ margin: 0, fontSize: '13px' }}>Click "Create Snapshot Now" above to capture an immutable freeze-state of your selected storage.</p>
                            </div>
                        ) : (
                            snapshots.map(snap => (
                                <div key={snap.id} className="glass" style={{ padding: '20px', borderRadius: '16px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                            <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                                                READY & IMMUTABLE
                                            </span>
                                            <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                                {new Date(snap.createdAt).toLocaleDateString()} {new Date(snap.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>{snap.label}</h4>
                                        
                                        {/* Target Path Display */}
                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-surface-2)', padding: '6px 10px', borderRadius: '8px', marginBottom: '10px', wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span>📍</span>
                                            <span><strong>{snap.targetNode || 'Master Server'}:</strong> {snap.targetPath || 'uploads'}</span>
                                        </div>

                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                            📦 Indexed <strong>{snap.totalFiles} files</strong> ({formatBytes(snap.totalSize)})
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            <button
                                                onClick={() => handleViewSnapshotManifest(snap)}
                                                className="btn-secondary"
                                                style={{ padding: '8px', fontSize: '12px', fontWeight: '800', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px' }}
                                                title="View all files captured in this snapshot"
                                            >
                                                <Eye size={13} color="var(--primary)" /> View Files
                                            </button>
                                            <button
                                                onClick={() => handleRestoreSnapshot(snap.id)}
                                                className="btn-secondary"
                                                style={{ padding: '8px', fontSize: '12px', fontWeight: '800', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px' }}
                                                title="Verify / rollback cluster state"
                                            >
                                                <RotateCcw size={13} /> Rollback
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => handleDeleteSnapshot(snap.id, snap.label)}
                                            style={{
                                                padding: '7px',
                                                fontSize: '11.5px',
                                                fontWeight: '700',
                                                borderRadius: '8px',
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                                color: '#ef4444',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                gap: '5px'
                                            }}
                                        >
                                            <Trash2 size={12} /> Delete Snapshot
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* TAB 4: MIGRATION HISTORY */}
            {activeTab === 'history' && (
                <div className="glass" style={{ padding: '20px', borderRadius: '16px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)' }}>Tiering Migration Stream</h3>
                    {(!stats?.history || stats.history.length === 0) ? (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>No tiering migrations executed yet. Run a sweep to migrate stale files.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {stats.history.map((h, i) => (
                                <div key={i} style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{h.fileName}</strong>
                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                            Policy: {h.policyName} ({formatBytes(h.size)})
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>{h.fromTier}</span>
                                        <ArrowRight size={14} color="var(--text-dim)" />
                                        <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px', background: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9' }}>{h.toTier}</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginLeft: '10px', fontFamily: 'var(--font-mono)' }}>
                                            {new Date(h.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* CREATE POLICY MODAL */}
            {showAddPolicy && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div className="glass" style={{ width: '100%', maxWidth: '520px', background: 'var(--bg-surface-0)', borderRadius: '20px', border: '1px solid var(--border-subtle)', padding: '28px', boxShadow: 'var(--shadow-lg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Sliders size={20} color="var(--primary)" /> Add Storage Tiering Rule
                            </h3>
                            <button onClick={() => setShowAddPolicy(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><X size={18} /></button>
                        </div>

                        <form onSubmit={handleCreatePolicy} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rule Name *</label>
                                <input className="m-input" required placeholder="e.g. Move Video Vault to Cold S3" value={formName} onChange={e => setFormName(e.target.value)} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>File Extension Pattern</label>
                                <input className="m-input" required placeholder="*.mp4,*.mkv,*.zip" value={formPattern} onChange={e => setFormPattern(e.target.value)} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Source Tier</label>
                                    <select className="m-input" value={formSource} onChange={e => setFormSource(e.target.value)}>
                                        <option value="HOT">🔥 Hot (NVMe)</option>
                                        <option value="WARM">💾 Warm (Fleet HDDs)</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Target Destination</label>
                                    <select className="m-input" value={formTarget} onChange={e => setFormTarget(e.target.value)}>
                                        <option value="WARM">💾 Warm (Fleet HDDs)</option>
                                        <option value="COLD">🧊 Cold (S3 Glacier)</option>
                                        <option value="PURGE">🗑️ Auto-Purge / Shred</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Age Threshold (Days)</label>
                                <input className="m-input" type="number" min="1" max="3650" value={formDays} onChange={e => setFormDays(e.target.value)} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rule Description</label>
                                <input className="m-input" placeholder="Optional rationale for this policy" value={formDesc} onChange={e => setFormDesc(e.target.value)} />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                                <button type="button" onClick={() => setShowAddPolicy(false)} className="btn-secondary" style={{ padding: '9px 18px', borderRadius: '10px', fontWeight: '700' }}>Cancel</button>
                                <button type="submit" className="btn-primary" style={{ padding: '9px 20px', borderRadius: '10px', fontWeight: '800' }}>Save Tiering Rule</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CREATE SNAPSHOT MODAL */}
            {showAddSnapshot && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div className="glass" style={{ width: '100%', maxWidth: '440px', background: 'var(--bg-surface-0)', borderRadius: '20px', border: '1px solid var(--border-subtle)', padding: '24px', boxShadow: 'var(--shadow-lg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Camera size={18} color="var(--primary)" /> Generate Cluster Snapshot
                            </h3>
                            <button onClick={() => setShowAddSnapshot(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleCreateSnapshot} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Snapshot Label *</label>
                                <input className="m-input" required placeholder="e.g. Pre-Deployment v2.4 State" value={snapLabel} onChange={e => setSnapLabel(e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                                <button type="button" onClick={() => setShowAddSnapshot(false)} className="btn-secondary" style={{ padding: '8px 16px', borderRadius: '10px', fontWeight: '700' }}>Cancel</button>
                                <button type="submit" className="btn-primary" style={{ padding: '8px 18px', borderRadius: '10px', fontWeight: '800' }}>Create Snapshot</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* SNAPSHOT FILE MANIFEST INSPECTOR MODAL */}
            {inspectingSnapshot && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div className="glass" style={{ width: '100%', maxWidth: '700px', maxHeight: '85vh', background: 'var(--bg-surface-0)', borderRadius: '20px', border: '1px solid var(--border-subtle)', padding: '24px', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div>
                                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Camera size={20} color="var(--primary)" /> {inspectingSnapshot.label}
                                </h3>
                                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    Target: <strong>{inspectingSnapshot.targetNode || 'Master'}</strong> ➔ {inspectingSnapshot.targetPath || 'uploads'} ({inspectingSnapshot.totalFiles} files, {formatBytes(inspectingSnapshot.totalSize)})
                                </p>
                            </div>
                            <button onClick={() => setInspectingSnapshot(null)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><X size={18} /></button>
                        </div>

                        {/* Search in Manifest */}
                        <div style={{ marginBottom: '14px', position: 'relative' }}>
                            <Search size={15} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                            <input
                                type="text"
                                placeholder="Search files in this snapshot..."
                                value={manifestSearch}
                                onChange={(e) => setManifestSearch(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '9px 12px 9px 36px',
                                    borderRadius: '10px',
                                    background: 'var(--bg-surface-2)',
                                    border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-primary)',
                                    fontSize: '13px',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        {/* File Manifest List */}
                        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '12px', background: 'var(--bg-surface-1)' }}>
                            {(!inspectingSnapshot.manifest || inspectingSnapshot.manifest.length === 0) ? (
                                <p style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
                                    No file records in this manifest.
                                </p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    {inspectingSnapshot.manifest
                                        .filter(f => !manifestSearch || (f.name || '').toLowerCase().includes(manifestSearch.toLowerCase()) || (f.relativePath || '').toLowerCase().includes(manifestSearch.toLowerCase()))
                                        .map((f, fi) => (
                                            <div key={fi} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', fontSize: '12.5px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                                    <FileText size={15} color="var(--primary)" style={{ flexShrink: 0 }} />
                                                    <span style={{ color: 'var(--text-primary)', fontWeight: '600', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                        {f.relativePath || f.name}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '11.5px', fontFamily: 'var(--font-mono)' }}>
                                                        {formatBytes(f.size)}
                                                    </span>
                                                    {f.mtime && (
                                                        <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                                                            {new Date(f.mtime).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                            <button
                                onClick={() => setInspectingSnapshot(null)}
                                className="btn-primary"
                                style={{ padding: '8px 20px', borderRadius: '10px', fontWeight: '800' }}
                            >
                                Close Manifest
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Interactive Windows & Linux Folder Explorer Modal */}
            {showFolderPicker && (
                <FolderPickerModal
                    agents={targets.filter(t => t.type === 'AGENT')}
                    initialPath={customPath || ''}
                    initialNode={selectedTarget.startsWith('agent_') ? selectedTarget.replace('agent_', '') : 'local'}
                    onClose={() => setShowFolderPicker(false)}
                    showToast={showToast}
                    onSelect={(pickedPath, node) => {
                        setShowFolderPicker(false);
                        setCustomPath(pickedPath);
                        setSelectedTarget('custom');
                        persistCustomPath(pickedPath);
                        loadAll('custom', pickedPath);
                        if (showToast) showToast(`Saved & Targeting folder: ${pickedPath}`, 'success');
                    }}
                />
            )}

            {/* In-UI Confirmation Modal */}
            <ConfirmModal
                show={!!confirmAction}
                title={confirmAction?.title || 'Confirm Action'}
                message={confirmAction?.message || ''}
                confirmText={confirmAction?.confirmText || 'Confirm'}
                cancelText="Cancel"
                type={confirmAction?.type || 'danger'}
                onConfirm={() => {
                    if (confirmAction?.onConfirm) confirmAction.onConfirm();
                    setConfirmAction(null);
                }}
                onCancel={() => setConfirmAction(null)}
            />
        </div>
    );
};

export default StorageTieringView;
