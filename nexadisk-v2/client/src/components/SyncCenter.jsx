import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Play, Trash2, Calendar, ToggleLeft, ToggleRight, CheckCircle2, 
    XCircle, Clock, Plus, Loader, History, Folder, Server, ArrowRight,
    RefreshCw, ChevronRight, Activity, Database, AlertCircle, Check, Info, X
} from 'lucide-react';
import FolderPickerModal from './modals/FolderPickerModal';

const API_BASE = '/api/v1';

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
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Never';
    return d.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
};

const SyncCenter = ({ agents, showToast }) => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showWizard, setShowWizard] = useState(false);
    const [historyTask, setHistoryTask] = useState(null);
    const [historyLogs, setHistoryLogs] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Wizard Form State
    const [taskName, setTaskName] = useState('');
    const [sourceNode, setSourceNode] = useState('local');
    const [sourcePath, setSourcePath] = useState('');
    const [destNode, setDestNode] = useState('local');
    const [destPath, setDestPath] = useState('');
    const [syncMode, setSyncMode] = useState('backup');
    const [scheduleInterval, setScheduleInterval] = useState('manual');
    const [customMinutes, setCustomMinutes] = useState('30');
    const [sanitizeMedia, setSanitizeMedia] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [pickerConfig, setPickerConfig] = useState(null);

    const openPickerFor = (type) => {
        if (type === 'source') {
            setPickerConfig({
                type: 'source',
                initialPath: sourcePath,
                initialNode: sourceNode
            });
        } else {
            setPickerConfig({
                type: 'dest',
                initialPath: destPath,
                initialNode: destNode
            });
        }
    };

    const fetchTasks = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.get(`${API_BASE}/sync/tasks`, { headers });
            setTasks(res.data || []);
        } catch (err) {
            console.error('Failed to fetch sync tasks', err);
            showToast('Failed to fetch sync tasks', 'error');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
        const interval = setInterval(() => fetchTasks(true), 5000);
        return () => clearInterval(interval);
    }, []);

    const handleCreateTask = async (e) => {
        e.preventDefault();
        if (!taskName || !sourcePath || !destPath) {
            showToast('Please fill all required fields', 'error');
            return;
        }

        setSubmitting(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            
            const intervalVal = scheduleInterval === 'custom' ? customMinutes : scheduleInterval;
            
            await axios.post(`${API_BASE}/sync/tasks`, {
                name: taskName,
                sourceNode,
                sourcePath,
                destNode,
                destPath,
                syncMode,
                scheduleInterval: intervalVal,
                sanitizeMedia
            }, { headers });

            showToast('Sync task created successfully', 'success');
            setShowWizard(false);
            // Reset fields
            setTaskName('');
            setSourcePath('');
            setDestPath('');
            setSourceNode('local');
            setDestNode('local');
            setSyncMode('backup');
            setScheduleInterval('manual');
            setSanitizeMedia(false);
            
            fetchTasks();
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to create sync task', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleTriggerTask = async (id, name) => {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post(`${API_BASE}/sync/tasks/${id}/run`, {}, { headers });
            showToast(`Started sync task "${name}" in background`, 'info');
            fetchTasks(true);
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to run task', 'error');
        }
    };

    const handleToggleTask = async (id, currentActive) => {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post(`${API_BASE}/sync/tasks/${id}/toggle`, { active: !currentActive }, { headers });
            showToast(`Task schedule ${!currentActive ? 'enabled' : 'disabled'}`, 'success');
            fetchTasks(true);
        } catch (err) {
            showToast('Failed to toggle task schedule', 'error');
        }
    };

    const handleDeleteTask = async (id, name) => {
        if (!window.confirm(`Permanently delete sync task "${name}"?`)) return;
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.delete(`${API_BASE}/sync/tasks/${id}`, { headers });
            showToast(`Deleted sync task "${name}"`, 'success');
            fetchTasks();
        } catch (err) {
            showToast('Failed to delete sync task', 'error');
        }
    };

    const handleViewHistory = async (task) => {
        setHistoryTask(task);
        setLoadingHistory(true);
        setHistoryLogs([]);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.get(`${API_BASE}/sync/tasks/${task.id}/history`, { headers });
            setHistoryLogs(res.data || []);
        } catch (err) {
            showToast('Failed to fetch task history logs', 'error');
        } finally {
            setLoadingHistory(false);
        }
    };

    // Calculate metrics
    const activeTasksCount = tasks.filter(t => t.active).length;
    const runningTasksCount = tasks.filter(t => t.lastStatus === 'In Progress').length;
    const successTasksCount = tasks.filter(t => t.lastStatus === 'Success').length;
    const failedTasksCount = tasks.filter(t => t.lastStatus === 'Failed').length;

    const getNodeLabel = (nodeId) => {
        if (nodeId === 'local') return 'Master Node';
        const ag = (agents || []).find(a => a.id === nodeId);
        return ag ? `${ag.hostname} (Remote)` : nodeId;
    };

    return (
        <div style={{ padding: '0 10px', height: '100%', overflowY: 'auto' }}>
            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h2 style={{ fontSize: '28px', fontWeight: '800', margin: 0 }}>Automated Sync Center</h2>
                    <p style={{ color: '#8b949e', marginTop: '4px', margin: 0 }}>Create scheduled replication and mirror tasks across cluster nodes</p>
                </div>
                <button className="btn-primary shadow-premium" style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '12px', padding: '10px 20px', fontWeight: '800' }} onClick={() => setShowWizard(true)}>
                    <Plus size={16} /> New Sync Job
                </button>
            </div>

            {/* Metrics cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                <div className="st-card shadow-premium" style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Total Schedules</span>
                        <Calendar size={18} color="var(--accent-gold)" />
                    </div>
                    <span style={{ fontSize: '28px', fontWeight: '800', color: '#fff' }}>{tasks.length}</span>
                    <span style={{ display: 'block', fontSize: '11px', color: '#8b949e', marginTop: '4px' }}>{activeTasksCount} active schedules enabled</span>
                </div>

                <div className="st-card shadow-premium" style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Running Now</span>
                        <Activity size={18} color="var(--accent-cyan)" style={{ animation: runningTasksCount ? 'spin 3s linear infinite' : 'none' }} />
                    </div>
                    <span style={{ fontSize: '28px', fontWeight: '800', color: runningTasksCount ? 'var(--accent-cyan)' : '#fff' }}>{runningTasksCount}</span>
                    <span style={{ display: 'block', fontSize: '11px', color: '#8b949e', marginTop: '4px' }}>Background threads active</span>
                </div>

                <div className="st-card shadow-premium" style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Completed Tasks</span>
                        <CheckCircle2 size={18} color="#27ae60" />
                    </div>
                    <span style={{ fontSize: '28px', fontWeight: '800', color: '#27ae60' }}>{successTasksCount}</span>
                    <span style={{ display: 'block', fontSize: '11px', color: '#8b949e', marginTop: '4px' }}>Clean runs last recorded</span>
                </div>

                <div className="st-card shadow-premium" style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Failed Tasks</span>
                        <XCircle size={18} color="#eb5757" />
                    </div>
                    <span style={{ fontSize: '28px', fontWeight: '800', color: failedTasksCount ? '#eb5757' : '#fff' }}>{failedTasksCount}</span>
                    <span style={{ display: 'block', fontSize: '11px', color: '#8b949e', marginTop: '4px' }}>Jobs encountering errors</span>
                </div>
            </div>

            {/* Task list table */}
            <div className="st-card-wide glass" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px' }}>
                        <Loader size={32} style={{ animation: 'spin 1.5s linear infinite', marginRight: '10px' }} />
                        <span>Querying Synchronization Schedules...</span>
                    </div>
                ) : tasks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', opacity: 0.4 }}>
                        <Database size={48} style={{ marginBottom: '16px' }} />
                        <p style={{ fontWeight: '700', fontSize: '16px', margin: '0 0 8px 0' }}>No synchronization tasks defined yet</p>
                        <p style={{ fontSize: '12px', margin: 0 }}>Click the "New Sync Job" button above to get started.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase' }}>
                                    <th style={{ padding: '12px' }}>Active</th>
                                    <th style={{ padding: '12px' }}>Job Name</th>
                                    <th style={{ padding: '12px' }}>Direction Mapping</th>
                                    <th style={{ padding: '12px' }}>Sync Mode</th>
                                    <th style={{ padding: '12px' }}>Interval</th>
                                    <th style={{ padding: '12px' }}>Last Run</th>
                                    <th style={{ padding: '12px' }}>Status</th>
                                    <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tasks.map((task) => {
                                    const isRunning = task.lastStatus === 'In Progress';
                                    const isSuccess = task.lastStatus === 'Success' || task.lastStatus === 'Partial Success';
                                    const isFailed = task.lastStatus === 'Failed';
                                    
                                    let statusColor = '#8b949e';
                                    let statusBg = 'rgba(255,255,255,0.05)';
                                    if (isRunning) {
                                        statusColor = 'var(--accent-gold)';
                                        statusBg = 'var(--accent-gold-glow)';
                                    } else if (isSuccess) {
                                        statusColor = '#27ae60';
                                        statusBg = 'rgba(39, 174, 96, 0.1)';
                                    } else if (isFailed) {
                                        statusColor = '#eb5757';
                                        statusBg = 'rgba(235, 87, 87, 0.1)';
                                    }

                                    return (
                                        <tr key={task.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '13px', color: '#c9d1d9' }}>
                                            {/* Toggle switch */}
                                            <td style={{ padding: '16px 12px' }}>
                                                <button 
                                                    onClick={() => handleToggleTask(task.id, task.active)}
                                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                                                >
                                                    {task.active ? (
                                                        <ToggleRight size={24} color="var(--accent-gold)" />
                                                    ) : (
                                                        <ToggleLeft size={24} color="rgba(255,255,255,0.2)" />
                                                    )}
                                                </button>
                                            </td>

                                            {/* Name */}
                                            <td style={{ padding: '16px 12px', fontWeight: '700', color: '#fff' }}>
                                                {task.name}
                                            </td>

                                            {/* Mapping direction */}
                                            <td style={{ padding: '16px 12px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ fontSize: '11px', color: '#8b949e' }}>From:</span>
                                                        <span style={{ fontWeight: '500' }}>{getNodeLabel(task.sourceNode)}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ fontSize: '11px', color: '#8b949e' }}>To:</span>
                                                        <span style={{ fontWeight: '500' }}>{getNodeLabel(task.destNode)}</span>
                                                    </div>
                                                    {task.sanitizeMedia === 1 && (
                                                        <span style={{ 
                                                            padding: '2px 6px', 
                                                            borderRadius: '4px', 
                                                            fontSize: '9px', 
                                                            fontWeight: '800',
                                                            textTransform: 'uppercase',
                                                            backgroundColor: 'rgba(242, 201, 76, 0.1)',
                                                            color: 'var(--accent-gold)',
                                                            border: '1px solid rgba(242, 201, 76, 0.2)',
                                                            marginTop: '4px',
                                                            alignSelf: 'flex-start'
                                                        }}>
                                                            Sanitized
                                                        </span>
                                                    )}
                                                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                                        {task.sourcePath} → {task.destPath}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Mode badge */}
                                            <td style={{ padding: '16px 12px' }}>
                                                <span style={{ 
                                                    padding: '2px 8px', 
                                                    borderRadius: '4px', 
                                                    fontSize: '11px', 
                                                    fontWeight: '700',
                                                    textTransform: 'uppercase',
                                                    backgroundColor: task.syncMode === 'mirror' ? 'rgba(45, 156, 219, 0.1)' : 'rgba(155, 81, 224, 0.1)',
                                                    color: task.syncMode === 'mirror' ? '#2d9cdb' : '#9b51e0',
                                                    border: `1px solid ${task.syncMode === 'mirror' ? '#2d9cdb30' : '#9b51e030'}`
                                                }}>
                                                    {task.syncMode}
                                                </span>
                                            </td>

                                            {/* Interval */}
                                            <td style={{ padding: '16px 12px', textTransform: 'capitalize', color: task.scheduleInterval === 'manual' ? '#8b949e' : '#fff' }}>
                                                {!isNaN(parseInt(task.scheduleInterval, 10)) ? `Every ${task.scheduleInterval}m` : task.scheduleInterval}
                                            </td>

                                            {/* Last run */}
                                            <td style={{ padding: '16px 12px', fontSize: '12px' }}>
                                                {formatDate(task.lastRun)}
                                            </td>

                                            {/* Status Badge */}
                                            <td style={{ padding: '16px 12px' }}>
                                                <span style={{ 
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '4px 10px', 
                                                    borderRadius: '12px', 
                                                    fontSize: '11px', 
                                                    fontWeight: '700',
                                                    backgroundColor: statusBg,
                                                    color: statusColor,
                                                    border: `1px solid ${statusColor}30`
                                                }}>
                                                    {isRunning && <Loader size={11} style={{ animation: 'spin 1.5s linear infinite' }} />}
                                                    {task.lastStatus}
                                                </span>
                                            </td>

                                            {/* Actions */}
                                            <td style={{ padding: '16px 12px', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    <button 
                                                        className="btn-secondary" 
                                                        disabled={isRunning}
                                                        onClick={() => handleTriggerTask(task.id, task.name)}
                                                        title="Execute task now"
                                                        style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                    >
                                                        <Play size={12} /> Run
                                                    </button>
                                                    <button 
                                                        className="btn-secondary" 
                                                        onClick={() => handleViewHistory(task)}
                                                        title="View run execution history logs"
                                                        style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                    >
                                                        <History size={12} /> Logs
                                                    </button>
                                                    <button 
                                                        className="btn-danger" 
                                                        onClick={() => handleDeleteTask(task.id, task.name)}
                                                        title="Delete Task Schedule"
                                                        style={{ padding: '6px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Sync Creation Wizard Modal */}
            {showWizard && (
                <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setShowWizard(false)}>
                    <div className="modal-content glass" style={{ width: '480px', padding: '28px', textAlign: 'left' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>Create Sync Task</h3>
                            <button className="inspector-close-btn" onClick={() => setShowWizard(false)}><X size={18} /></button>
                        </div>

                        <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Task name */}
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#8b949e', marginBottom: '6px' }}>Job Name *</label>
                                <input 
                                    className="m-input" 
                                    required 
                                    placeholder="e.g. Code backups to Agent" 
                                    value={taskName}
                                    onChange={e => setTaskName(e.target.value)}
                                    style={{ width: '100%', outline: 'none' }}
                                />
                            </div>

                            {/* Source config */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#8b949e', marginBottom: '6px' }}>Source Node</label>
                                    <select 
                                        className="m-input"
                                        value={sourceNode}
                                        onChange={e => setSourceNode(e.target.value)}
                                        style={{ width: '100%', outline: 'none', background: 'var(--bg-panel)', color: '#fff' }}
                                    >
                                        <option value="local">Local Master</option>
                                        {(agents || []).filter(a => a.status === 'approved').map(a => (
                                            <option key={a.id} value={a.id}>{a.hostname}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#8b949e', marginBottom: '6px' }}>Source Path *</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input 
                                            className="m-input" 
                                            required 
                                            placeholder="e.g. d:\opt\nexadisk\server" 
                                            value={sourcePath}
                                            onChange={e => setSourcePath(e.target.value)}
                                            style={{ flex: 1, outline: 'none' }}
                                        />
                                        <button
                                            type="button"
                                            className="btn-secondary shadow-premium"
                                            onClick={() => openPickerFor('source')}
                                            title="Browse source path"
                                            style={{ padding: '0 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <Folder size={16} color="var(--accent-gold)" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Destination config */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#8b949e', marginBottom: '6px' }}>Dest Node</label>
                                    <select 
                                        className="m-input"
                                        value={destNode}
                                        onChange={e => setDestNode(e.target.value)}
                                        style={{ width: '100%', outline: 'none', background: 'var(--bg-panel)', color: '#fff' }}
                                    >
                                        <option value="local">Local Master</option>
                                        {(agents || []).filter(a => a.status === 'approved').map(a => (
                                            <option key={a.id} value={a.id}>{a.hostname}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#8b949e', marginBottom: '6px' }}>Dest Path *</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input 
                                            className="m-input" 
                                            required 
                                            placeholder="e.g. C:\backup_dest" 
                                            value={destPath}
                                            onChange={e => setDestPath(e.target.value)}
                                            style={{ flex: 1, outline: 'none' }}
                                        />
                                        <button
                                            type="button"
                                            className="btn-secondary shadow-premium"
                                            onClick={() => openPickerFor('dest')}
                                            title="Browse destination path"
                                            style={{ padding: '0 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <Folder size={16} color="var(--accent-gold)" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Sync mode & scheduler */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#8b949e', marginBottom: '6px' }}>Sync Mode</label>
                                    <select 
                                        className="m-input"
                                        value={syncMode}
                                        onChange={e => setSyncMode(e.target.value)}
                                        style={{ width: '100%', outline: 'none', background: 'var(--bg-panel)', color: '#fff' }}
                                    >
                                        <option value="backup">Incremental Backup</option>
                                        <option value="mirror">Mirror Replication</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#8b949e', marginBottom: '6px' }}>Interval Schedule</label>
                                    <select 
                                        className="m-input"
                                        value={scheduleInterval}
                                        onChange={e => setScheduleInterval(e.target.value)}
                                        style={{ width: '100%', outline: 'none', background: 'var(--bg-panel)', color: '#fff' }}
                                    >
                                        <option value="manual">Manual (On-Demand)</option>
                                        <option value="1">Every 1 Minute (Test)</option>
                                        <option value="5">Every 5 Minutes</option>
                                        <option value="hourly">Hourly</option>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="custom">Custom Minutes...</option>
                                    </select>
                                </div>
                            </div>

                            {/* Custom minutes scheduler input */}
                            {scheduleInterval === 'custom' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#8b949e', marginBottom: '6px' }}>Repeat Interval (Minutes)</label>
                                    <input 
                                        type="number"
                                        className="m-input"
                                        min="1"
                                        value={customMinutes}
                                        onChange={e => setCustomMinutes(e.target.value)}
                                        style={{ width: '100%', outline: 'none' }}
                                    />
                                </div>
                            )}

                            {/* Sanitize Media Names toggle */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '12px 16px', borderRadius: '10px', marginTop: '8px' }}>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 'bold' }}>Sanitize Media Names</div>
                                    <div style={{ fontSize: '11px', color: '#8b949e' }}>Convert torrent titles to "Title (Year)"</div>
                                </div>
                                <div
                                    onClick={() => setSanitizeMedia(!sanitizeMedia)}
                                    style={{ width: '40px', height: '20px', background: sanitizeMedia ? 'var(--accent-gold)' : '#333', borderRadius: '20px', position: 'relative', cursor: 'pointer', transition: '0.3s' }}
                                >
                                    <div style={{ width: '16px', height: '16px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', left: sanitizeMedia ? '22px' : '2px', transition: '0.3s' }} />
                                </div>
                            </div>

                            {/* Submit */}
                            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                <button type="button" className="auth-submit-btn" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }} onClick={() => setShowWizard(false)}>Cancel</button>
                                <button type="submit" className="auth-submit-btn" style={{ flex: 1 }} disabled={submitting}>
                                    {submitting ? (
                                        <Loader size={16} style={{ animation: 'spin 1.5s linear infinite' }} />
                                    ) : (
                                        'Create Task'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Sync History log modal */}
            {historyTask && (
                <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setHistoryTask(null)}>
                    <div className="modal-content glass" style={{ width: '600px', maxHeight: '500px', display: 'flex', flexDirection: 'column', padding: '28px', textAlign: 'left' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexShrink: 0 }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>Sync Execution History</h3>
                                <p style={{ margin: '4px 0 0 0', color: '#8b949e', fontSize: '12px' }}>Audit log for job: <strong>{historyTask.name}</strong></p>
                            </div>
                            <button className="inspector-close-btn" onClick={() => setHistoryTask(null)}><X size={18} /></button>
                        </div>

                        {/* Logs list */}
                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                            {loadingHistory ? (
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
                                    <Loader size={24} style={{ animation: 'spin 1.5s linear infinite', marginRight: '8px' }} />
                                    <span>Retrieving audit history log...</span>
                                </div>
                            ) : historyLogs.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', opacity: 0.4 }}>
                                    <Info size={32} style={{ marginBottom: '12px' }} />
                                    <p style={{ margin: 0, fontSize: '13px' }}>No logs recorded for this sync task yet</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {historyLogs.map(log => {
                                        const isLogSuccess = log.status === 'Success' || log.status === 'Partial Success';
                                        return (
                                            <div key={log.id} style={{ 
                                                padding: '12px 16px', 
                                                borderRadius: '8px', 
                                                background: 'rgba(255,255,255,0.015)',
                                                border: `1px solid ${isLogSuccess ? 'rgba(39, 174, 96, 0.15)' : 'rgba(235, 87, 87, 0.15)'}`
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                    <span style={{ fontSize: '11px', color: '#8b949e', fontFamily: 'monospace' }}>
                                                        {new Date(log.runTime).toLocaleString()}
                                                    </span>
                                                    <span style={{ 
                                                        fontSize: '10px', 
                                                        fontWeight: '800', 
                                                        textTransform: 'uppercase',
                                                        color: isLogSuccess ? '#27ae60' : '#eb5757',
                                                        backgroundColor: isLogSuccess ? 'rgba(39, 174, 96, 0.1)' : 'rgba(235, 87, 87, 0.1)',
                                                        padding: '2px 6px',
                                                        borderRadius: '4px'
                                                    }}>
                                                        {log.status}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#8b949e' }}>
                                                    <div>Files Copied: <strong style={{ color: '#fff' }}>{log.filesCopied}</strong></div>
                                                    <div>Data Copied: <strong style={{ color: '#fff' }}>{formatSize(log.bytesTransferred)}</strong></div>
                                                </div>
                                                {log.errors && (
                                                    <div style={{ 
                                                        marginTop: '8px', 
                                                        padding: '8px 12px', 
                                                        borderRadius: '6px', 
                                                        background: 'rgba(235, 87, 87, 0.05)', 
                                                        border: '1px solid rgba(235, 87, 87, 0.1)',
                                                        fontSize: '11px',
                                                        color: '#ff7b72',
                                                        fontFamily: 'monospace',
                                                        whiteSpace: 'pre-wrap',
                                                        wordBreak: 'break-all'
                                                    }}>
                                                        {log.errors}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {pickerConfig && (
                <FolderPickerModal
                    agents={agents}
                    initialNode={pickerConfig.initialNode}
                    initialPath={pickerConfig.initialPath}
                    lockNode={true}
                    onClose={() => setPickerConfig(null)}
                    onSelect={(folderPath, node) => {
                        if (pickerConfig.type === 'source') {
                            setSourcePath(folderPath);
                            setSourceNode(node);
                        } else {
                            setDestPath(folderPath);
                            setDestNode(node);
                        }
                        setPickerConfig(null);
                    }}
                    showToast={showToast}
                />
            )}
        </div>
    );
};

export default SyncCenter;
