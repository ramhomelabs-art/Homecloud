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

    const handleRunAllActive = async () => {
        const activeTasks = tasks.filter(t => t.active);
        if (activeTasks.length === 0) {
            showToast('No active sync tasks enabled.', 'info');
            return;
        }
        showToast(`Triggering ${activeTasks.length} active sync tasks...`, 'info');
        for (const t of activeTasks) {
            handleTriggerTask(t.id, t.name);
        }
    };

    return (
        <div style={{ padding: '0 10px', height: '100%', overflowY: 'auto' }}>
            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                <div>
                    <h2 style={{ fontSize: '26px', fontWeight: '900', margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.4px' }}>
                        Automated Sync Center
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '4px', margin: 0, fontSize: '13.5px' }}>
                        Scheduled node replication, differential mirror tasks, and automated cluster backups
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                        className="btn-secondary" 
                        onClick={handleRunAllActive} 
                        disabled={runningTasksCount > 0 || tasks.length === 0}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '12px', padding: '10px 16px', fontWeight: '700', fontSize: '13px' }}
                    >
                        <RefreshCw size={15} style={{ animation: runningTasksCount > 0 ? 'spin 1.5s linear infinite' : 'none' }} /> Run All Active
                    </button>
                    <button 
                        className="btn-primary" 
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '12px', padding: '10px 20px', fontWeight: '800', fontSize: '13px', boxShadow: '0 4px 16px rgba(79, 70, 229, 0.35)' }} 
                        onClick={() => setShowWizard(true)}
                    >
                        <Plus size={16} /> New Sync Job
                    </button>
                </div>
            </div>

            {/* Metrics cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Total Schedules</span>
                        <Calendar size={18} color="var(--primary)" />
                    </div>
                    <span style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-primary)' }}>{tasks.length}</span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{activeTasksCount} active schedules enabled</span>
                </div>

                <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Running Now</span>
                        <Activity size={18} color={runningTasksCount ? "var(--primary)" : "var(--text-dim)"} style={{ animation: runningTasksCount ? 'spin 3s linear infinite' : 'none' }} />
                    </div>
                    <span style={{ fontSize: '28px', fontWeight: '900', color: runningTasksCount ? 'var(--primary)' : 'var(--text-primary)' }}>{runningTasksCount}</span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Background threads active</span>
                </div>

                <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Completed Tasks</span>
                        <CheckCircle2 size={18} color="#10b981" />
                    </div>
                    <span style={{ fontSize: '28px', fontWeight: '900', color: '#10b981' }}>{successTasksCount}</span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Clean runs last recorded</span>
                </div>

                <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Failed Tasks</span>
                        <XCircle size={18} color="#f43f5e" />
                    </div>
                    <span style={{ fontSize: '28px', fontWeight: '900', color: failedTasksCount ? '#f43f5e' : 'var(--text-primary)' }}>{failedTasksCount}</span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Jobs encountering errors</span>
                </div>
            </div>

            {/* Task list table */}
            <div className="glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)', boxShadow: 'var(--shadow-sm)' }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
                        <Loader size={32} style={{ animation: 'spin 1.5s linear infinite', marginRight: '12px' }} color="var(--primary)" />
                        <span style={{ fontWeight: '700' }}>Querying Synchronization Schedules...</span>
                    </div>
                ) : tasks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <Database size={32} color="var(--primary)" />
                        </div>
                        <h4 style={{ fontWeight: '800', fontSize: '17px', margin: '0 0 6px 0', color: 'var(--text-primary)' }}>No Synchronization Tasks Defined</h4>
                        <p style={{ fontSize: '13px', margin: 0, color: 'var(--text-secondary)' }}>Click "New Sync Job" above to create automated replication across your storage nodes.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)', fontSize: '11.5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                                    <th style={{ padding: '12px 14px' }}>Active</th>
                                    <th style={{ padding: '12px 14px' }}>Job Name</th>
                                    <th style={{ padding: '12px 14px' }}>Direction Mapping</th>
                                    <th style={{ padding: '12px 14px' }}>Sync Mode</th>
                                    <th style={{ padding: '12px 14px' }}>Interval</th>
                                    <th style={{ padding: '12px 14px' }}>Last Run</th>
                                    <th style={{ padding: '12px 14px' }}>Status</th>
                                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tasks.map((task) => {
                                    const isRunning = task.lastStatus === 'In Progress';
                                    const isSuccess = task.lastStatus === 'Success' || task.lastStatus === 'Partial Success';
                                    const isFailed = task.lastStatus === 'Failed';
                                    
                                    let statusColor = 'var(--text-dim)';
                                    let statusBg = 'var(--bg-surface-2)';
                                    if (isRunning) {
                                        statusColor = 'var(--primary)';
                                        statusBg = 'rgba(99, 102, 241, 0.12)';
                                    } else if (isSuccess) {
                                        statusColor = '#10b981';
                                        statusBg = 'rgba(16, 185, 129, 0.12)';
                                    } else if (isFailed) {
                                        statusColor = '#f43f5e';
                                        statusBg = 'rgba(244, 63, 94, 0.12)';
                                    }

                                    return (
                                        <tr key={task.id} style={{ borderBottom: '1px solid var(--border-subtle)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                            {/* Toggle switch */}
                                            <td style={{ padding: '16px 14px' }}>
                                                <button 
                                                    onClick={() => handleToggleTask(task.id, task.active)}
                                                    title={task.active ? "Active Schedule - Click to pause" : "Inactive Schedule - Click to activate"}
                                                    style={{
                                                        position: 'relative',
                                                        width: '40px',
                                                        height: '22px',
                                                        borderRadius: '999px',
                                                        background: task.active ? 'var(--primary)' : 'var(--border-dim)',
                                                        border: '1px solid ' + (task.active ? 'var(--primary-light)' : 'var(--border-subtle)'),
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        padding: '2px',
                                                        boxShadow: task.active ? '0 0 10px rgba(99, 102, 241, 0.4)' : 'none'
                                                    }}
                                                >
                                                    <div 
                                                        style={{
                                                            width: '16px',
                                                            height: '16px',
                                                            borderRadius: '50%',
                                                            background: '#ffffff',
                                                            transform: task.active ? 'translateX(18px)' : 'translateX(0)',
                                                            transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                                                            boxShadow: '0 1px 3px rgba(0,0,0,0.35)'
                                                        }}
                                                    />
                                                </button>
                                            </td>

                                            {/* Name */}
                                            <td style={{ padding: '16px 14px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                                {task.name}
                                            </td>

                                            {/* Mapping direction */}
                                            <td style={{ padding: '16px 14px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: '700' }}>FROM:</span>
                                                        <span style={{ fontWeight: '700', color: 'var(--text-primary)', background: 'var(--bg-surface-2)', padding: '2px 6px', borderRadius: '5px', fontSize: '11.5px' }}>{getNodeLabel(task.sourceNode)}</span>
                                                        <ArrowRight size={12} color="var(--text-dim)" />
                                                        <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: '700' }}>TO:</span>
                                                        <span style={{ fontWeight: '700', color: 'var(--text-primary)', background: 'var(--bg-surface-2)', padding: '2px 6px', borderRadius: '5px', fontSize: '11.5px' }}>{getNodeLabel(task.destNode)}</span>
                                                    </div>
                                                    {task.sanitizeMedia === 1 && (
                                                        <span style={{ 
                                                            padding: '2px 6px', 
                                                            borderRadius: '4px', 
                                                            fontSize: '9.5px', 
                                                            fontWeight: '800',
                                                            textTransform: 'uppercase',
                                                            backgroundColor: 'rgba(99, 102, 241, 0.12)',
                                                            color: 'var(--primary)',
                                                            border: '1px solid rgba(99, 102, 241, 0.25)',
                                                            marginTop: '2px',
                                                            alignSelf: 'flex-start'
                                                        }}>
                                                            Auto-Sanitized
                                                        </span>
                                                    )}
                                                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                                                        {task.sourcePath} → {task.destPath}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Mode badge */}
                                            <td style={{ padding: '16px 14px' }}>
                                                <span style={{ 
                                                    padding: '3px 9px', 
                                                    borderRadius: '6px', 
                                                    fontSize: '11px', 
                                                    fontWeight: '800',
                                                    textTransform: 'uppercase',
                                                    backgroundColor: task.syncMode === 'mirror' ? 'rgba(14, 165, 233, 0.12)' : 'rgba(139, 92, 246, 0.12)',
                                                    color: task.syncMode === 'mirror' ? '#0ea5e9' : '#8b5cf6',
                                                    border: `1px solid ${task.syncMode === 'mirror' ? 'rgba(14, 165, 233, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`
                                                }}>
                                                    {task.syncMode}
                                                </span>
                                            </td>

                                            {/* Interval */}
                                            <td style={{ padding: '16px 14px', textTransform: 'capitalize', color: 'var(--text-primary)', fontWeight: '700', fontSize: '12.5px' }}>
                                                {!isNaN(parseInt(task.scheduleInterval, 10)) ? `Every ${task.scheduleInterval}m` : task.scheduleInterval}
                                            </td>

                                            {/* Last run */}
                                            <td style={{ padding: '16px 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                {formatDate(task.lastRun)}
                                            </td>

                                            {/* Status Badge */}
                                            <td style={{ padding: '16px 14px' }}>
                                                <span style={{ 
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px', 
                                                    padding: '4px 10px', 
                                                    borderRadius: '12px', 
                                                    fontSize: '11.5px', 
                                                    fontWeight: '800',
                                                    backgroundColor: statusBg,
                                                    color: statusColor,
                                                    border: `1px solid ${statusColor}30`
                                                }}>
                                                    {isRunning && <Loader size={11} style={{ animation: 'spin 1.5s linear infinite' }} />}
                                                    {task.lastStatus || 'Idle'}
                                                </span>
                                            </td>

                                            {/* Actions */}
                                            <td style={{ padding: '16px 14px', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    <button 
                                                        className="btn-secondary" 
                                                        disabled={isRunning}
                                                        onClick={() => handleTriggerTask(task.id, task.name)}
                                                        title="Execute task now"
                                                        style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700' }}
                                                    >
                                                        <Play size={12} /> Run
                                                    </button>
                                                    <button 
                                                        className="btn-secondary" 
                                                        onClick={() => handleViewHistory(task)}
                                                        title="View run execution history logs"
                                                        style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700' }}
                                                    >
                                                        <History size={12} /> Logs
                                                    </button>
                                                    <button 
                                                        className="btn-danger" 
                                                        onClick={() => handleDeleteTask(task.id, task.name)}
                                                        title="Delete Task Schedule"
                                                        style={{ padding: '6px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <Trash2 size={13} />
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
                    <div className="modal-content glass" style={{ width: '500px', maxWidth: '94vw', padding: '28px', textAlign: 'left', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '24px', boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>Create Sync Task</h3>
                            <button className="inspector-close-btn" onClick={() => setShowWizard(false)}><X size={18} /></button>
                        </div>

                        <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Task name */}
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>Job Name *</label>
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
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>Source Node</label>
                                    <select 
                                        className="m-input"
                                        value={sourceNode}
                                        onChange={e => setSourceNode(e.target.value)}
                                        style={{ width: '100%', outline: 'none', background: 'var(--bg-panel)', color: 'var(--text-primary)' }}
                                    >
                                        <option value="local">Local Master</option>
                                        {(agents || []).filter(a => a.status === 'approved').map(a => (
                                            <option key={a.id} value={a.id}>{a.hostname}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>Source Path *</label>
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
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>Dest Node</label>
                                    <select 
                                        className="m-input"
                                        value={destNode}
                                        onChange={e => setDestNode(e.target.value)}
                                        style={{ width: '100%', outline: 'none', background: 'var(--bg-panel)', color: 'var(--text-primary)' }}
                                    >
                                        <option value="local">Local Master</option>
                                        {(agents || []).filter(a => a.status === 'approved').map(a => (
                                            <option key={a.id} value={a.id}>{a.hostname}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>Dest Path *</label>
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
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>Sync Mode</label>
                                    <select 
                                        className="m-input"
                                        value={syncMode}
                                        onChange={e => setSyncMode(e.target.value)}
                                        style={{ width: '100%', outline: 'none', background: 'var(--bg-panel)', color: 'var(--text-primary)' }}
                                    >
                                        <option value="backup">Incremental Backup</option>
                                        <option value="mirror">Mirror Replication</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>Interval Schedule</label>
                                    <select 
                                        className="m-input"
                                        value={scheduleInterval}
                                        onChange={e => setScheduleInterval(e.target.value)}
                                        style={{ width: '100%', outline: 'none', background: 'var(--bg-panel)', color: 'var(--text-primary)' }}
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
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>Repeat Interval (Minutes)</label>
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
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Convert torrent titles to "Title (Year)"</div>
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
                                <button type="button" className="auth-submit-btn" style={{ flex: 1, background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} onClick={() => setShowWizard(false)}>Cancel</button>
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
                                <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '12px' }}>Audit log for job: <strong>{historyTask.name}</strong></p>
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
                                                background: 'var(--bg-surface-2)',
                                                border: `1px solid ${isLogSuccess ? 'rgba(39, 174, 96, 0.15)' : 'rgba(235, 87, 87, 0.15)'}`
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
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
                                                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                    <div>Files Copied: <strong style={{ color: 'var(--text-primary)' }}>{log.filesCopied}</strong></div>
                                                    <div>Data Copied: <strong style={{ color: 'var(--text-primary)' }}>{formatSize(log.bytesTransferred)}</strong></div>
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
