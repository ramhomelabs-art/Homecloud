import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Globe, Network, Plus, Trash2, Play, RefreshCw, X, Shield, Activity,
    HardDrive, CheckCircle2, ArrowRight, Radio, Server, Copy, Check, Info, Cpu, Layers
} from 'lucide-react';

const API_BASE = '/api';

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const SiteMeshModal = ({ show, onClose, showToast }) => {
    const [masterInfo, setMasterInfo] = useState(null);
    const [sites, setSites] = useState([]);
    const [syncJobs, setSyncJobs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [viewTab, setViewTab] = useState('sites'); // 'sites', 'sync', 'pair'

    // Pairing form state
    const [newSiteName, setNewSiteName] = useState('');
    const [newSiteLocation, setNewSiteLocation] = useState('');
    const [generatedToken, setGeneratedToken] = useState(null);
    const [joinCommand, setJoinCommand] = useState('');
    const [copied, setCopied] = useState(false);

    // Sync Job form state
    const [syncName, setSyncName] = useState('');
    const [sourceSiteId, setSourceSiteId] = useState('master-local');
    const [sourcePath, setSourcePath] = useState('/data');
    const [targetSiteId, setTargetSiteId] = useState('');
    const [targetPath, setTargetPath] = useState('/backup');
    const [syncMode, setSyncMode] = useState('mirror');

    useEffect(() => {
        if (show) {
            fetchData();
        }
    }, [show]);

    const fetchData = async () => {
        setLoading(true);
        const token = localStorage.getItem('token') || '';
        const headers = { Authorization: `Bearer ${token}` };
        try {
            const [sitesRes, jobsRes] = await Promise.all([
                axios.get(`${API_BASE}/v1/sitemesh/sites`, { headers }),
                axios.get(`${API_BASE}/v1/sitemesh/sync-jobs`, { headers })
            ]);

            if (sitesRes.data && sitesRes.data.master) {
                setMasterInfo(sitesRes.data.master);
                setSites(sitesRes.data.sites || []);
            } else if (Array.isArray(sitesRes.data)) {
                setSites(sitesRes.data);
            }

            setSyncJobs(jobsRes.data || []);
            if (sitesRes.data?.sites?.length > 0) {
                setTargetSiteId(sitesRes.data.sites[0].id);
            }
        } catch (e) {
            console.error('Failed to load Site Mesh data', e);
        } finally {
            setLoading(false);
        }
    };

    const handleGeneratePairingToken = async () => {
        if (!newSiteName) {
            if (showToast) showToast('Please enter a site name', 'error');
            return;
        }
        const token = localStorage.getItem('token') || '';
        try {
            const res = await axios.post(`${API_BASE}/v1/sitemesh/token`, {
                siteName: newSiteName,
                location: newSiteLocation || 'Remote Datacenter'
            }, { headers: { Authorization: `Bearer ${token}` } });

            setGeneratedToken(res.data);
            const cmd = `curl -fsSL ${window.location.origin}/api/v1/sitemesh/join-script?token=${res.data.pairingToken}&siteName=${encodeURIComponent(newSiteName)} | sudo bash`;
            setJoinCommand(cmd);
            if (showToast) showToast('Site pairing token generated!', 'success');
            fetchData();
        } catch (e) {
            if (showToast) showToast('Failed to generate token: ' + (e.response?.data?.error || e.message), 'error');
        }
    };

    const handleCreateSyncJob = async () => {
        if (!syncName || !sourceSiteId || !targetSiteId) {
            if (showToast) showToast('Please select both source and target sites', 'error');
            return;
        }
        const token = localStorage.getItem('token') || '';
        try {
            await axios.post(`${API_BASE}/v1/sitemesh/sync-jobs`, {
                name: syncName,
                sourceSiteId,
                sourcePath,
                targetSiteId,
                targetPath,
                syncMode
            }, { headers: { Authorization: `Bearer ${token}` } });

            if (showToast) showToast('Replication sync job created!', 'success');
            setSyncName('');
            fetchData();
            setViewTab('sync');
        } catch (e) {
            if (showToast) showToast('Failed to create job: ' + (e.response?.data?.error || e.message), 'error');
        }
    };

    const handleRunSync = async (jobId) => {
        const token = localStorage.getItem('token') || '';
        try {
            await axios.post(`${API_BASE}/v1/sitemesh/sync-jobs/${jobId}/run`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (showToast) showToast('Cross-site replication triggered!', 'success');
            setTimeout(fetchData, 1500);
        } catch (e) {
            if (showToast) showToast('Failed to run sync: ' + (e.response?.data?.error || e.message), 'error');
        }
    };

    const handleDeleteSite = async (siteId) => {
        if (!window.confirm('Are you sure you want to unpair this site from the mesh?')) return;
        const token = localStorage.getItem('token') || '';
        try {
            await axios.delete(`${API_BASE}/v1/sitemesh/sites/${siteId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (showToast) showToast('Site removed from cluster mesh', 'success');
            fetchData();
        } catch (e) {
            if (showToast) showToast('Failed to remove site', 'error');
        }
    };

    const copyCmd = () => {
        navigator.clipboard.writeText(joinCommand);
        setCopied(true);
        if (showToast) showToast('Join command copied to clipboard', 'success');
        setTimeout(() => setCopied(false), 2000);
    };

    if (!show) return null;

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 99999 }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '92vw', maxWidth: '1120px', maxHeight: '90vh', background: 'var(--bg-surface-0)', borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-subtle)', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', background: 'var(--bg-surface-1)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(14, 165, 233, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(14, 165, 233, 0.25)' }}>
                            <Globe size={22} color="var(--accent-cyan)" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                Site-to-Site Multi-Cluster Mesh
                            </h3>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                Zero-port-forwarding mTLS tunnels, multi-region cluster federation, and cross-site geo-replication
                            </p>
                        </div>
                    </div>
                    <button className="btn-icon" onClick={onClose}><X size={18} /></button>
                </div>

                {/* Sub-Navigation */}
                <div style={{ display: 'flex', gap: '8px', padding: '12px 24px', background: 'var(--bg-surface-0)', borderBottom: '1px solid var(--border-subtle)', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {[
                            { id: 'sites', label: `Connected Sites (${sites.length + 1})`, icon: Server },
                            { id: 'sync', label: `Replication Jobs (${syncJobs.length})`, icon: Network },
                            { id: 'pair', label: 'Pair New Secondary Site', icon: Plus },
                        ].map(t => {
                            const Icon = t.icon;
                            const active = viewTab === t.id;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => setViewTab(t.id)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '8px 16px',
                                        borderRadius: '10px',
                                        fontSize: '13px',
                                        fontWeight: '700',
                                        border: active ? '1px solid var(--accent-cyan)' : '1px solid transparent',
                                        background: active ? 'rgba(14, 165, 233, 0.12)' : 'transparent',
                                        color: active ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <Icon size={16} /> {t.label}
                                </button>
                            );
                        })}
                    </div>
                    <button className="btn-outline" onClick={fetchData} style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh Mesh
                    </button>
                </div>

                {/* Body Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {viewTab === 'sites' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Live Master Primary Node Card */}
                            <div style={{ padding: '18px 22px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(14, 165, 233, 0.04))', border: '1px solid rgba(99, 102, 241, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                                        <Shield size={24} color="var(--primary)" />
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                                {masterInfo?.name || 'Local Master Host (Primary Hub)'}
                                            </span>
                                            <span style={{ fontSize: '10px', fontWeight: '800', background: 'rgba(99, 102, 241, 0.18)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '6px' }}>CLUSTER HUB</span>
                                            <span style={{ fontSize: '10px', fontWeight: '800', background: 'rgba(16, 185, 129, 0.18)', color: '#10b981', padding: '2px 8px', borderRadius: '6px' }}>ONLINE</span>
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                                            IP: {masterInfo?.ip || '127.0.0.1'} • Platform: {masterInfo?.platform || 'Host'} • Agents Connected: {masterInfo?.connectedAgents || 0} • Latency: 0.1ms
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>STORAGE POOL</div>
                                        <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                            {formatBytes(masterInfo?.storageUsedBytes)} / {formatBytes(masterInfo?.storageTotalBytes)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Secondary Remote Sites Grid or Clean Empty State */}
                            {sites.length === 0 ? (
                                <div style={{ padding: '40px 24px', background: 'var(--bg-surface-1)', borderRadius: '16px', border: '1px dashed var(--border-subtle)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(14, 165, 233, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)' }}>
                                        <Globe size={24} />
                                    </div>
                                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                        No Secondary Sites Connected Yet
                                    </h4>
                                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '520px', lineHeight: '1.5' }}>
                                        NexaDisk Site Mesh allows you to cluster multiple servers across different physical locations, cloud providers, and branch offices into a single global namespace.
                                    </p>
                                    <button 
                                        className="btn-primary" 
                                        onClick={() => setViewTab('pair')}
                                        style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', fontSize: '13px', fontWeight: '800' }}
                                    >
                                        <Plus size={16} /> Pair Your First Remote Site
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                                    {sites.map(site => (
                                        <div key={site.id} style={{ padding: '18px', borderRadius: '16px', background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>{site.name}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{site.location}</div>
                                                </div>
                                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#10b981', background: 'rgba(16, 185, 129, 0.12)', padding: '3px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Radio size={10} /> {site.latency_ms}ms
                                                </span>
                                            </div>

                                            <div style={{ padding: '10px 12px', background: 'var(--bg-surface-0)', borderRadius: '10px', fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: 'var(--text-muted)' }}>Tunnel:</span>
                                                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>mTLS Reverse Tunnel</span>
                                            </div>

                                            <div style={{ padding: '10px 12px', background: 'var(--bg-surface-0)', borderRadius: '10px', fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: 'var(--text-muted)' }}>Storage Capacity:</span>
                                                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{formatBytes(site.storage_capacity_bytes)}</span>
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {site.id}</span>
                                                <button className="btn-outline" onClick={() => handleDeleteSite(site.id)} style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--accent-red)', borderColor: 'rgba(244, 63, 94, 0.3)' }}>
                                                    <Trash2 size={12} /> Unpair
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {viewTab === 'sync' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Create Sync Job Button */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                    Cross-Site Geo-Replication Pipelines
                                </h4>
                            </div>

                            {/* Sync Jobs Table or Empty State */}
                            {syncJobs.length === 0 ? (
                                <div style={{ padding: '36px 20px', background: 'var(--bg-surface-1)', borderRadius: '16px', border: '1px dashed var(--border-subtle)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                    No cross-site replication jobs configured. Pair remote sites first to establish continuous replication.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {syncJobs.map(job => (
                                        <div key={job.id} style={{ padding: '16px 20px', borderRadius: '14px', background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                            <div>
                                                <div style={{ fontSize: '14.5px', fontWeight: '800', color: 'var(--text-primary)' }}>{job.name}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span>{job.source_site_name || 'HQ Primary'} ({job.source_path})</span>
                                                    <ArrowRight size={12} />
                                                    <span>{job.target_site_name || 'Remote Target'} ({job.target_path})</span>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '6px', background: job.status === 'in_progress' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.12)', color: job.status === 'in_progress' ? 'var(--accent-gold)' : '#10b981' }}>
                                                    {job.status.toUpperCase()}
                                                </span>
                                                <button className="btn-primary" onClick={() => handleRunSync(job.id)} disabled={job.status === 'in_progress'} style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Play size={12} /> Sync Now
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {viewTab === 'pair' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '680px', margin: '0 auto', width: '100%' }}>
                            <div style={{ background: 'var(--bg-surface-1)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                    Pair a Secondary NexaDisk Server
                                </h4>
                                <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                    Generate a cryptographically signed one-time token. Run the join command on the remote server to establish a reverse mTLS tunnel back to this Master Hub.
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>REMOTE SITE NAME</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. Branch-London-01, AWS-EU-Central"
                                        value={newSiteName}
                                        onChange={(e) => setNewSiteName(e.target.value)}
                                        style={{ padding: '10px 14px', borderRadius: '10px', fontSize: '13px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                                    />
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>PHYSICAL / CLOUD LOCATION</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. London DC-2, Frankfurt, Edge Node"
                                        value={newSiteLocation}
                                        onChange={(e) => setNewSiteLocation(e.target.value)}
                                        style={{ padding: '10px 14px', borderRadius: '10px', fontSize: '13px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                                    />
                                </div>

                                <button className="btn-primary" onClick={handleGeneratePairingToken} style={{ padding: '10px 18px', fontSize: '13px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                    <Plus size={16} /> Generate Pairing Token & Join Script
                                </button>

                                {joinCommand && (
                                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-cyan)' }}>RUN THIS COMMAND ON REMOTE SERVER:</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                type="text"
                                                readOnly
                                                value={joinCommand}
                                                style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', fontSize: '12px', fontFamily: 'var(--font-mono)', background: '#0a0f1d', border: '1px solid var(--border-subtle)', color: '#38bdf8' }}
                                            />
                                            <button className="btn-outline" onClick={copyCmd} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                                                {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', background: 'var(--bg-surface-1)', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn-outline" onClick={onClose} style={{ padding: '8px 18px', fontSize: '12px' }}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SiteMeshModal;
