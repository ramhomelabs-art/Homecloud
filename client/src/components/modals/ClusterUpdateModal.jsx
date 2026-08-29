import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Sparkles, ShieldCheck, RefreshCw, AlertTriangle, CheckCircle2, RotateCcw,
    X, Server, Check, ArrowUpRight, Terminal, Cpu, Clock, Layers
} from 'lucide-react';

import ConfirmModal from './ConfirmModal';

const API_BASE = '/api';

const ClusterUpdateModal = ({ show, onClose, showToast }) => {
    const [manifest, setManifest] = useState(null);
    const [matrix, setMatrix] = useState([]);
    const [channel, setChannel] = useState('stable'); // 'stable', 'beta'
    const [loading, setLoading] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [logs, setLogs] = useState([]);
    const [updateSuccess, setUpdateSuccess] = useState(false);

    // In-UI Confirmation Modal States
    const [confirmDeployShow, setConfirmDeployShow] = useState(false);
    const [confirmRollbackShow, setConfirmRollbackShow] = useState(false);

    useEffect(() => {
        if (show) {
            fetchUpdateData();
        }
    }, [show, channel]);

    const fetchUpdateData = async () => {
        setLoading(true);
        const token = localStorage.getItem('token') || '';
        const headers = { Authorization: `Bearer ${token}` };

        try {
            const [checkRes, matrixRes] = await Promise.all([
                axios.get(`${API_BASE}/v1/updates/check?channel=${channel}`, { headers }),
                axios.get(`${API_BASE}/v1/updates/cluster-matrix`, { headers })
            ]);
            setManifest(checkRes.data);
            setMatrix(matrixRes.data || []);
        } catch (e) {
            console.error('Failed to fetch update data', e);
        } finally {
            setLoading(false);
        }
    };

    const handleDeployUpdate = async (force = false) => {
        setConfirmDeployShow(false);
        setUpdating(true);
        setLogs([`[${new Date().toISOString()}] Initializing cluster update process...`]);
        setUpdateSuccess(false);

        const token = localStorage.getItem('token') || '';
        const headers = { Authorization: `Bearer ${token}` };

        // Poll logs in real time while updating
        const pollInterval = setInterval(async () => {
            try {
                const statusRes = await axios.get(`${API_BASE}/v1/updates/status`, { headers });
                if (statusRes.data?.logs && statusRes.data.logs.length > 0) {
                    setLogs(statusRes.data.logs);
                }
            } catch (_) {}
        }, 1000);

        try {
            const res = await axios.post(`${API_BASE}/v1/updates/deploy`, {
                targetVersion: manifest?.latestVersion || '2.4.0',
                nodes: ['all'],
                force
            }, { headers });

            clearInterval(pollInterval);
            setLogs(res.data.logs || []);
            setUpdateSuccess(true);
            if (showToast) showToast('Cluster rolling update successfully completed!', 'success');
            fetchUpdateData();
        } catch (e) {
            clearInterval(pollInterval);
            const errMsg = e.response?.data?.error || e.message;
            if (showToast) showToast(`Update notice: ${errMsg}`, 'error');
            // Fetch final status logs
            try {
                const statusRes = await axios.get(`${API_BASE}/v1/updates/status`, { headers });
                if (statusRes.data?.logs) setLogs(statusRes.data.logs);
            } catch (_) {}
            fetchUpdateData();
        } finally {
            clearInterval(pollInterval);
            setUpdating(false);
        }
    };

    const handleRollback = async () => {
        setConfirmRollbackShow(false);
        const token = localStorage.getItem('token') || '';
        try {
            await axios.post(`${API_BASE}/v1/updates/rollback`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (showToast) showToast('Rollback executed successfully from snapshot', 'success');
            fetchUpdateData();
        } catch (e) {
            if (showToast) showToast('Rollback notice: ' + (e.response?.data?.error || e.message), 'error');
        }
    };

    if (!show) return null;

    const isUpdateAvailable = Boolean(manifest?.updateAvailable);
    const canDeploy = isUpdateAvailable && !loading && !updating;

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 99999 }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '92vw', maxWidth: '1080px', maxHeight: '90vh', background: 'var(--bg-surface-0)', borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-subtle)', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', background: 'var(--bg-surface-1)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                            <Sparkles size={22} color="#10b981" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                Centralized OTA Update Management
                            </h3>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                Zero-downtime rolling upgrades, cryptographic package verification, and cluster-wide version orchestration
                            </p>
                        </div>
                    </div>
                    <button className="btn-icon" onClick={onClose}><X size={18} /></button>
                </div>

                {/* Sub-Header / Release Banner */}
                <div style={{ padding: '16px 24px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(99, 102, 241, 0.04))', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>CURRENT RUNNING VERSION</div>
                            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>v{manifest?.currentVersion || '2.4.2'}</div>
                        </div>
                        <div style={{ width: '1px', height: '32px', background: 'var(--border-subtle)' }} />
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>LATEST AVAILABLE RELEASE</div>
                            <div style={{ fontSize: '16px', fontWeight: '800', color: isUpdateAvailable ? '#38bdf8' : '#10b981', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                v{manifest?.latestVersion || manifest?.currentVersion || '2.4.2'} ({channel.toUpperCase()})
                                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: isUpdateAvailable ? 'rgba(56, 189, 248, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: isUpdateAvailable ? '#38bdf8' : '#10b981', fontWeight: '800' }}>
                                    {loading ? 'CHECKING...' : (isUpdateAvailable ? 'UPDATE AVAILABLE' : 'UP TO DATE')}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <select value={channel} onChange={(e) => setChannel(e.target.value)} disabled={loading || updating} style={{ padding: '6px 12px', borderRadius: '8px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: '700' }}>
                            <option value="stable">Channel: Stable</option>
                            <option value="beta">Channel: Beta / RC</option>
                        </select>
                        <button className="btn-outline" onClick={fetchUpdateData} disabled={loading || updating} style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> {loading ? 'Checking...' : 'Check for Updates'}
                        </button>
                    </div>
                </div>

                {/* Content Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Changelog & Release Notes */}
                    <div style={{ padding: '18px 22px', borderRadius: '16px', background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                    {manifest?.releaseTitle || `What's New in v${manifest?.latestVersion || '2.4.0'}`}
                                </h4>
                                {manifest?.releaseUrl && (
                                    <a href={manifest.releaseUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: 'var(--accent-cyan)', display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'none', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                                        GitHub Release <ArrowUpRight size={11} />
                                    </a>
                                )}
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                Repo: <code style={{ color: 'var(--text-secondary)' }}>{manifest?.repository || 'ramhomelabs-art/Homecloud'}</code> • Released: {manifest?.releaseDate} • {manifest?.packageSizeMB} MB
                            </span>
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {manifest?.changelog?.map((note, idx) => (
                                <li key={idx}>{note}</li>
                            ))}
                        </ul>
                    </div>

                    {/* Cluster Node Version Matrix */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: '800', color: 'var(--text-primary)' }}>
                            Cluster Node Version Matrix ({matrix.length} Nodes)
                        </h4>
                        <div style={{ borderRadius: '14px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: '10px 14px' }}>Node / Target</th>
                                        <th style={{ padding: '10px 14px' }}>Type</th>
                                        <th style={{ padding: '10px 14px' }}>Installed Version</th>
                                        <th style={{ padding: '10px 14px' }}>Target Version</th>
                                        <th style={{ padding: '10px 14px' }}>Runtime / OS</th>
                                        <th style={{ padding: '10px 14px' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {matrix.map(node => (
                                        <tr key={node.id} style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)' }}>
                                            <td style={{ padding: '12px 14px', fontWeight: '700', color: 'var(--text-primary)' }}>{node.name}</td>
                                            <td style={{ padding: '12px 14px', textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-secondary)' }}>{node.type}</td>
                                            <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>v{node.installedVersion}</td>
                                            <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: isUpdateAvailable ? '#38bdf8' : '#10b981' }}>v{node.latestVersion}</td>
                                            <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: '11.5px' }}>{node.os}</td>
                                            <td style={{ padding: '12px 14px' }}>
                                                <span style={{ fontSize: '11px', fontWeight: '700', color: isUpdateAvailable ? '#38bdf8' : '#10b981', background: isUpdateAvailable ? 'rgba(56, 189, 248, 0.12)' : 'rgba(16, 185, 129, 0.12)', padding: '2px 6px', borderRadius: '4px' }}>
                                                    {isUpdateAvailable ? 'UPDATE READY' : 'UP TO DATE'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Live Progress Logs */}
                    {(updating || logs.length > 0) && (
                        <div style={{ background: '#0a0f1d', borderRadius: '14px', border: '1px solid var(--border-subtle)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '12.5px', fontWeight: '700', color: updating ? 'var(--accent-gold)' : (updateSuccess ? '#10b981' : '#38bdf8'), display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Terminal size={14} /> {updating ? 'Deploying Rolling Cluster Update...' : (updateSuccess ? 'Update Completed Successfully' : 'Update Execution Log')}
                                </span>
                                {updating && <RefreshCw size={14} className="animate-spin" color="var(--accent-gold)" />}
                            </div>
                            <div style={{ maxHeight: '180px', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: '#38bdf8', lineHeight: '1.6' }}>
                                {logs.map((log, idx) => (
                                    <div key={idx}>{log}</div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div style={{ padding: '16px 24px', background: 'var(--bg-surface-1)', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button className="btn-outline" onClick={() => setConfirmRollbackShow(true)} disabled={updating} style={{ padding: '8px 16px', fontSize: '12px', color: 'var(--accent-red)', borderColor: 'rgba(244, 63, 94, 0.3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <RotateCcw size={14} /> Rollback to Snapshot
                        </button>
                        {!isUpdateAvailable && !loading && (
                            <button 
                                onClick={() => setConfirmDeployShow(true)}
                                disabled={updating}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '11px', textDecoration: 'underline', cursor: updating ? 'not-allowed' : 'pointer', padding: 0 }}
                            >
                                Force Re-deploy (v{manifest?.currentVersion || '2.4.2'})
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="btn-outline" onClick={onClose} style={{ padding: '8px 16px', fontSize: '12px' }}>
                            Close
                        </button>
                        <button 
                            className={canDeploy ? "btn-primary" : "btn-secondary"} 
                            onClick={() => setConfirmDeployShow(true)} 
                            disabled={!canDeploy} 
                            style={{ 
                                padding: '8px 20px', 
                                fontSize: '12px', 
                                fontWeight: '800', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '6px',
                                opacity: canDeploy ? 1 : 0.5,
                                cursor: canDeploy ? 'pointer' : 'not-allowed',
                                background: canDeploy ? undefined : 'var(--bg-surface-2)',
                                color: canDeploy ? undefined : 'var(--text-muted)',
                                borderColor: canDeploy ? undefined : 'var(--border-subtle)'
                            }}
                        >
                            {updating ? (
                                <>
                                    <RefreshCw size={14} className="animate-spin" /> Deploying...
                                </>
                            ) : loading ? (
                                <>
                                    <RefreshCw size={14} className="animate-spin" /> Checking Updates...
                                </>
                            ) : isUpdateAvailable ? (
                                <>
                                    <Sparkles size={14} /> Deploy v{manifest?.latestVersion} to Cluster
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={14} color="#10b981" /> System Up to Date (v{manifest?.currentVersion || '2.4.2'})
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* In-UI Confirmation: Deploy Cluster Update */}
            <ConfirmModal
                show={confirmDeployShow}
                title={isUpdateAvailable ? "Deploy Cluster Update" : "Force Re-Deploy Current Version"}
                message={
                    isUpdateAvailable
                        ? `Are you sure you want to deploy NexaDisk v${manifest?.latestVersion} across all master and agent nodes? A pre-flight backup snapshot will be automatically created before extracting files.`
                        : `NexaDisk v${manifest?.currentVersion || '2.4.2'} is currently up to date. Do you want to run a forced integrity re-deployment and package synchronization?`
                }
                confirmText={isUpdateAvailable ? `Deploy v${manifest?.latestVersion}` : `Re-Deploy v${manifest?.currentVersion || '2.4.2'}`}
                cancelText="Cancel"
                type="primary"
                onConfirm={() => handleDeployUpdate(!isUpdateAvailable)}
                onCancel={() => setConfirmDeployShow(false)}
            />

            {/* In-UI Confirmation: Rollback Update */}
            <ConfirmModal
                show={confirmRollbackShow}
                title="Rollback to Previous Snapshot"
                message="Are you sure you want to rollback cluster binaries to the previous pre-update backup snapshot? Any modified runtime files will be reverted."
                confirmText="Restore Snapshot"
                cancelText="Cancel"
                type="rollback"
                onConfirm={handleRollback}
                onCancel={() => setConfirmRollbackShow(false)}
            />

            {/* In-UI Confirmation: Rollback Update */}
            <ConfirmModal
                show={confirmRollbackShow}
                title="Rollback to Previous Snapshot"
                message="Are you sure you want to rollback cluster binaries to the previous pre-update backup snapshot? Any modified runtime files will be reverted."
                confirmText="Restore Snapshot"
                cancelText="Cancel"
                type="rollback"
                onConfirm={handleRollback}
                onCancel={() => setConfirmRollbackShow(false)}
            />
        </div>
    );
};

export default ClusterUpdateModal;
