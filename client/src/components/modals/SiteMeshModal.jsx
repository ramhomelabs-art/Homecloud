import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Globe, Network, Plus, Trash2, Play, RefreshCw, X, Shield, Activity,
    HardDrive, CheckCircle2, ArrowRight, Radio, Server, Copy, Check, Info, 
    Cpu, Layers, Database, Gauge, Zap, ExternalLink, ChevronDown, ChevronUp,
    Sparkles, Lock, ArrowUpRight, Clock, FolderSync, Folder, File, ChevronRight,
    Link, ArrowLeftRight, Terminal, Laptop
} from 'lucide-react';

import ConfirmModal from './ConfirmModal';

const API_BASE = '/api';

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const SiteMeshModal = ({ show, onClose, showToast, onExploreSite }) => {
    const [masterInfo, setMasterInfo] = useState(null);
    const [sites, setSites] = useState([]);
    const [syncJobs, setSyncJobs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [provisioningDemo, setProvisioningDemo] = useState(false);
    const [viewTab, setViewTab] = useState('sites'); // 'sites', 'sync', 'pair'
    const [siteToUnpair, setSiteToUnpair] = useState(null);
    const [selectedSiteInspector, setSelectedSiteInspector] = useState(null);
    const [remoteExplorer, setRemoteExplorer] = useState(null); // { siteId, siteName, path, items, loading }
    const [expandedSites, setExpandedSites] = useState({});

    // Pairing Mode: 'primary' (Server 1 generates token) vs 'secondary' (Server 2 connects to Server 1)
    const [pairingRole, setPairingRole] = useState('primary'); 

    // Primary Mode state
    const [newSiteName, setNewSiteName] = useState('');
    const [newSiteLocation, setNewSiteLocation] = useState('');
    const [generatedToken, setGeneratedToken] = useState(null);
    const [joinCommand, setJoinCommand] = useState('');
    const [copied, setCopied] = useState(false);

    // Secondary Join Mode state (Connecting Server 2 to Server 1)
    const [hubUrl, setHubUrl] = useState('');
    const [joinToken, setJoinToken] = useState('');
    const [secondarySiteName, setSecondarySiteName] = useState('');
    const [secondaryLocation, setSecondaryLocation] = useState('');
    const [joiningHub, setJoiningHub] = useState(false);

    // Sync Job form state
    const [showNewJobModal, setShowNewJobModal] = useState(false);
    const [syncName, setSyncName] = useState('');
    const [sourceSiteId, setSourceSiteId] = useState('master-local');
    const [sourcePath, setSourcePath] = useState('/cluster/volumes/primary');
    const [targetSiteId, setTargetSiteId] = useState('');
    const [targetPath, setTargetPath] = useState('/mnt/pve/ceph-fast/backups');
    const [syncMode, setSyncMode] = useState('mirror');

    useEffect(() => {
        if (show) {
            fetchData(true);
            const liveInterval = setInterval(() => {
                fetchData(false);
            }, 3500);
            return () => clearInterval(liveInterval);
        }
    }, [show]);

    const fetchData = async (showLoadingState = false) => {
        if (showLoadingState) setLoading(true);
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
                if (!secondarySiteName && sitesRes.data.master.name) {
                    setSecondarySiteName(sitesRes.data.master.name);
                }
                if (!secondaryLocation && sitesRes.data.master.location) {
                    setSecondaryLocation(sitesRes.data.master.location);
                }
            } else if (Array.isArray(sitesRes.data)) {
                setSites(sitesRes.data);
            }

            setSyncJobs(jobsRes.data || []);
            if (sitesRes.data?.sites?.length > 0 && !targetSiteId) {
                setTargetSiteId(sitesRes.data.sites[0].id);
            }
        } catch (e) {
            console.error('Failed to load Site Mesh data', e);
        } finally {
            if (showLoadingState) setLoading(false);
        }
    };

    const handleProvisionDemoSite = async () => {
        setProvisioningDemo(true);
        const token = localStorage.getItem('token') || '';
        try {
            const res = await axios.post(`${API_BASE}/v1/sitemesh/demo-site`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (showToast) showToast('Proxmox VE Cluster-02 secondary site connected to mesh!', 'success');
            await fetchData();
            setViewTab('sites');
            if (res.data?.site?.id) {
                setExpandedSites(prev => ({ ...prev, [res.data.site.id]: true }));
            }
        } catch (e) {
            if (showToast) showToast('Failed to provision demo site: ' + (e.response?.data?.error || e.message), 'error');
        } finally {
            setProvisioningDemo(false);
        }
    };

    const handleGeneratePairingToken = async () => {
        const token = localStorage.getItem('token') || '';
        try {
            const res = await axios.post(`${API_BASE}/v1/sitemesh/token`, {
                siteName: newSiteName || 'Secondary-Node',
                location: newSiteLocation || 'Remote Datacenter'
            }, { headers: { Authorization: `Bearer ${token}` } });

            setGeneratedToken(res.data);
            const hostUrl = window.location.origin;
            const cmd = `curl -fsSL ${hostUrl}/api/v1/sitemesh/join-script?token=${res.data.pairingToken} | sudo bash`;
            setJoinCommand(cmd);
            if (showToast) showToast('Cluster join information generated!', 'success');
            fetchData();
        } catch (e) {
            if (showToast) showToast('Failed to generate token: ' + (e.response?.data?.error || e.message), 'error');
        }
    };

    const handleJoinPrimaryHub = async (e) => {
        e?.preventDefault();
        if (!hubUrl || !joinToken) {
            if (showToast) showToast('Please enter Primary Hub URL and Pairing Token', 'error');
            return;
        }
        setJoiningHub(true);
        const token = localStorage.getItem('token') || '';
        try {
            const res = await axios.post(`${API_BASE}/v1/sitemesh/join-hub`, {
                hubUrl,
                pairingToken: joinToken,
                siteName: secondarySiteName || masterInfo?.name || 'Secondary Node',
                location: secondaryLocation || masterInfo?.location || 'Primary Datacenter / On-Premise Host'
            }, { headers: { Authorization: `Bearer ${token}` } });

            if (showToast) showToast(res.data.message || 'Successfully joined Primary Cluster Hub!', 'success');
            await fetchData();
            setViewTab('sites');
        } catch (e) {
            if (showToast) showToast('Failed to join Primary Hub: ' + (e.response?.data?.error || e.message), 'error');
        } finally {
            setJoiningHub(false);
        }
    };

    const handleOpenRemoteExplorer = async (siteId, siteName, targetPath = '/') => {
        setRemoteExplorer({ siteId, siteName, path: targetPath, items: [], loading: true });
        const token = localStorage.getItem('token') || '';
        try {
            const res = await axios.get(`${API_BASE}/v1/sitemesh/sites/${siteId}/files?path=${encodeURIComponent(targetPath)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRemoteExplorer({
                siteId,
                siteName,
                path: res.data.currentPath || targetPath,
                items: res.data.items || [],
                storagePools: res.data.storagePools || [],
                loading: false
            });
        } catch (err) {
            if (showToast) showToast('Failed to load remote site files: ' + (err.response?.data?.error || err.message), 'error');
            setRemoteExplorer(null);
        }
    };

    const handleCreateSyncJob = async (e) => {
        e?.preventDefault();
        if (!syncName || !sourceSiteId || !targetSiteId) {
            if (showToast) showToast('Please provide job name, source and target sites', 'error');
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
            setShowNewJobModal(false);
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
            setTimeout(fetchData, 1400);
        } catch (e) {
            if (showToast) showToast('Failed to run sync: ' + (e.response?.data?.error || e.message), 'error');
        }
    };

    const confirmUnpairSite = async () => {
        if (!siteToUnpair) return;
        const siteId = siteToUnpair;
        setSiteToUnpair(null);
        const token = localStorage.getItem('token') || '';
        try {
            await axios.delete(`${API_BASE}/v1/sitemesh/sites/${siteId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (showToast) showToast('Site removed from cluster mesh', 'success');
            if (selectedSiteInspector?.id === siteId) setSelectedSiteInspector(null);
            fetchData();
        } catch (e) {
            if (showToast) showToast('Failed to remove site', 'error');
        }
    };

    const copyCmd = async () => {
        const { copyTextToClipboard } = await import('../../utils/clipboard');
        await copyTextToClipboard(joinCommand);
        setCopied(true);
        if (showToast) showToast('Join command copied to clipboard', 'success');
        setTimeout(() => setCopied(false), 2000);
    };


    const toggleSiteExpand = (id) => {
        setExpandedSites(prev => ({ ...prev, [id]: !prev[id] }));
    };

    if (!show) return null;

    // Aggregate Global Metrics
    const totalStorageBytes = (masterInfo?.storageTotalBytes || 0) + sites.reduce((acc, s) => acc + Number(s.storage_capacity_bytes || 0), 0);
    const totalUsedStorageBytes = (masterInfo?.storageUsedBytes || 0) + sites.reduce((acc, s) => acc + Number(s.storage_used_bytes || 0), 0);
    const totalAgentsCount = (masterInfo?.connectedAgents || 1) + sites.reduce((acc, s) => {
        const siteAgents = s.details?.agents || [];
        return acc + (siteAgents.length > 0 ? siteAgents.length : 1);
    }, 0);
    const storageUsagePercent = totalStorageBytes > 0 ? Math.round((totalUsedStorageBytes / totalStorageBytes) * 100) : 0;

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 99999 }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '94vw', maxWidth: '1200px', maxHeight: '92vh', background: 'var(--bg-surface-0)', borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-subtle)', boxShadow: '0 32px 90px rgba(0,0,0,0.65)' }}>
                {/* Header */}
                <div style={{ padding: '20px 28px', background: 'var(--bg-surface-1)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(14, 165, 233, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(14, 165, 233, 0.25)' }}>
                            <Globe size={24} color="var(--accent-cyan)" />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <h3 style={{ margin: 0, fontSize: '19px', fontWeight: '900', color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                                    Site-to-Site Multi-Cluster Mesh
                                </h3>
                                <span style={{ fontSize: '11px', fontWeight: '800', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                    DATACENTER FEDERATION
                                </span>
                            </div>
                            <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                                Zero-port-forwarding mTLS tunnels, multi-region cluster federation, storage pools & cross-site geo-replication
                            </p>
                        </div>
                    </div>
                    <button className="btn-icon" onClick={onClose}><X size={18} /></button>
                </div>

                {/* Global Cluster Mesh KPI Banner */}
                <div style={{ padding: '16px 28px', background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                            <Server size={20} />
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>CONNECTED SITES</div>
                            <div style={{ fontSize: '16px', fontWeight: '900', color: 'var(--text-primary)' }}>
                                {sites.length + 1} Datacenter{sites.length !== 0 ? 's' : ''}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(14, 165, 233, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)' }}>
                            <Database size={20} />
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>AGGREGATED POOL</div>
                            <div style={{ fontSize: '16px', fontWeight: '900', color: 'var(--text-primary)' }}>
                                {formatBytes(totalUsedStorageBytes)} / {formatBytes(totalStorageBytes)} ({storageUsagePercent}%)
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                            <Activity size={20} />
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>CLUSTER NODES / AGENTS</div>
                            <div style={{ fontSize: '16px', fontWeight: '900', color: '#10b981' }}>
                                {totalAgentsCount} Active Nodes
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-gold)' }}>
                            <Lock size={20} />
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>TUNNEL PROTOCOL</div>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                mTLS 1.3 / WireGuard Mesh
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sub-Navigation */}
                <div style={{ display: 'flex', gap: '8px', padding: '12px 28px', background: 'var(--bg-surface-0)', borderBottom: '1px solid var(--border-subtle)', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {[
                            { id: 'sites', label: `Connected Sites (${sites.length + 1})`, icon: Server },
                            { id: 'sync', label: `Replication Pipelines (${syncJobs.length})`, icon: Network },
                            { id: 'pair', label: 'Pair / Connect Sites', icon: Plus },
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
                                        fontWeight: '800',
                                        border: active ? '1px solid var(--accent-cyan)' : '1px solid transparent',
                                        background: active ? 'rgba(14, 165, 233, 0.12)' : 'transparent',
                                        color: active ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <Icon size={16} /> {t.label}
                                </button>
                            );
                        })}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {sites.length === 0 && (
                            <button
                                className="btn-primary"
                                onClick={handleProvisionDemoSite}
                                disabled={provisioningDemo}
                                style={{
                                    padding: '7px 14px',
                                    fontSize: '12.5px',
                                    fontWeight: '800',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
                                    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)'
                                }}
                            >
                                <Sparkles size={14} className={provisioningDemo ? 'animate-spin' : ''} />
                                {provisioningDemo ? 'Connecting Proxmox VE...' : '✨ Connect Demo Proxmox VE Site'}
                            </button>
                        )}
                        <button className="btn-outline" onClick={fetchData} style={{ padding: '7px 14px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh Mesh
                        </button>
                    </div>
                </div>

                {/* Body Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {viewTab === 'sites' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Master Primary Hub Site Card */}
                            <SiteCard
                                site={masterInfo}
                                isMaster={true}
                                isExpanded={expandedSites['master-local'] ?? true}
                                onToggleExpand={() => toggleSiteExpand('master-local')}
                                onInspect={() => setSelectedSiteInspector(masterInfo)}
                                onBrowseStorage={() => {
                                    if (onExploreSite) {
                                        onExploreSite('master-local', masterInfo?.name || 'Primary Hub');
                                    } else {
                                        handleOpenRemoteExplorer('master-local', masterInfo?.name || 'Primary Hub', '/');
                                    }
                                }}
                            />

                            {/* Secondary Remote Sites Section */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: 'var(--text-primary)' }}>
                                        Federated Secondary Sites & Proxmox Clusters ({sites.length})
                                    </h4>
                                </div>

                                {sites.length > 0 && (
                                    <button 
                                        className="btn-outline" 
                                        onClick={() => setViewTab('pair')}
                                        style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <Plus size={14} /> Pair / Connect Site
                                    </button>
                                )}
                            </div>

                            {sites.length === 0 ? (
                                <div style={{ padding: '48px 32px', background: 'var(--bg-surface-1)', borderRadius: '18px', border: '1px dashed var(--border-subtle)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(14, 165, 233, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)' }}>
                                        <Globe size={28} />
                                    </div>
                                    <div>
                                        <h4 style={{ margin: 0, fontSize: '17px', fontWeight: '900', color: 'var(--text-primary)' }}>
                                            No Secondary Datacenter Sites Connected Yet
                                        </h4>
                                        <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '560px', lineHeight: '1.6' }}>
                                            NexaDisk Site Mesh allows you to cluster multiple servers across different physical PCs, Proxmox VE nodes, and branch offices into a unified multi-site global storage namespace.
                                        </p>
                                    </div>

                                    <div style={{ display: 'flex', gap: '12px', marginTop: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                        <button 
                                            className="btn-primary" 
                                            onClick={handleProvisionDemoSite}
                                            disabled={provisioningDemo}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                padding: '11px 22px',
                                                fontSize: '13.5px',
                                                fontWeight: '900',
                                                background: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
                                                boxShadow: '0 6px 20px rgba(99, 102, 241, 0.4)'
                                            }}
                                        >
                                            <Sparkles size={16} className={provisioningDemo ? 'animate-spin' : ''} />
                                            {provisioningDemo ? 'Connecting Proxmox Cluster...' : '✨ Provision Demo Proxmox VE Site (Frankfurt)'}
                                        </button>
                                        <button 
                                            className="btn-outline" 
                                            onClick={() => setViewTab('pair')}
                                            style={{ padding: '11px 20px', fontSize: '13.5px', fontWeight: '800' }}
                                        >
                                            Pair / Connect Physical Server
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {sites.map(site => (
                                        <SiteCard
                                            key={site.id}
                                            site={site}
                                            isMaster={false}
                                            isExpanded={expandedSites[site.id] ?? true}
                                            onToggleExpand={() => toggleSiteExpand(site.id)}
                                            onInspect={() => setSelectedSiteInspector(site)}
                                            onBrowseStorage={() => {
                                                if (onExploreSite) {
                                                    onExploreSite(site.id, site.name);
                                                } else {
                                                    handleOpenRemoteExplorer(site.id, site.name, '/');
                                                }
                                            }}
                                            onUnpair={() => setSiteToUnpair(site.id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {viewTab === 'sync' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: 'var(--text-primary)' }}>
                                        Cross-Site Geo-Replication Pipelines
                                    </h4>
                                    <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                                        Continuous delta snapshotting and mirror synchronization between primary and secondary sites
                                    </p>
                                </div>
                                <button
                                    className="btn-primary"
                                    onClick={() => setShowNewJobModal(true)}
                                    style={{ padding: '8px 16px', fontSize: '12.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <Plus size={14} /> New Replication Job
                                </button>
                            </div>

                            {syncJobs.length === 0 ? (
                                <div style={{ padding: '40px 24px', background: 'var(--bg-surface-1)', borderRadius: '16px', border: '1px dashed var(--border-subtle)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                    No cross-site replication jobs configured yet. Click "New Replication Job" to create an automated snapshot pipeline.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {syncJobs.map(job => (
                                        <div key={job.id} style={{ padding: '18px 24px', borderRadius: '16px', background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', boxShadow: 'var(--shadow-sm)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                                                    <FolderSync size={22} />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>{job.name}</div>
                                                    <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontWeight: '700', color: 'var(--accent-cyan)' }}>{job.source_site_name || 'Primary Hub'}</span>
                                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', background: 'var(--bg-surface-2)', padding: '1px 6px', borderRadius: '4px' }}>{job.source_path}</span>
                                                        <ArrowRight size={13} color="var(--text-muted)" />
                                                        <span style={{ fontWeight: '700', color: '#10b981' }}>{job.target_site_name || 'Remote Site'}</span>
                                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', background: 'var(--bg-surface-2)', padding: '1px 6px', borderRadius: '4px' }}>{job.target_path}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>SCHEDULE / MODE</div>
                                                    <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                                        {job.sync_mode.toUpperCase()} • Every 6h
                                                    </div>
                                                </div>

                                                <span style={{ fontSize: '11px', fontWeight: '800', padding: '4px 10px', borderRadius: '6px', background: job.status === 'in_progress' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: job.status === 'in_progress' ? 'var(--accent-gold)' : '#10b981', border: `1px solid ${job.status === 'in_progress' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}` }}>
                                                    {job.status === 'in_progress' ? 'SYNCING DELTA...' : 'SYNCHRONIZED'}
                                                </span>

                                                <button className="btn-primary" onClick={() => handleRunSync(job.id)} disabled={job.status === 'in_progress'} style={{ padding: '7px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '800' }}>
                                                    <Play size={13} /> Sync Now
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {viewTab === 'pair' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '780px', margin: '0 auto', width: '100%' }}>
                            {/* Role Switcher Pill */}
                            <div style={{ background: 'var(--bg-surface-2)', padding: '6px', borderRadius: '14px', display: 'flex', gap: '6px', border: '1px solid var(--border-subtle)' }}>
                                <button
                                    onClick={() => setPairingRole('primary')}
                                    style={{
                                        flex: 1,
                                        padding: '10px 16px',
                                        borderRadius: '10px',
                                        border: 'none',
                                        background: pairingRole === 'primary' ? 'var(--primary)' : 'transparent',
                                        color: pairingRole === 'primary' ? '#fff' : 'var(--text-secondary)',
                                        fontSize: '13px',
                                        fontWeight: '800',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <Shield size={16} /> 1. This is the Primary Master Hub (Generate Join Key)
                                </button>

                                <button
                                    onClick={() => setPairingRole('secondary')}
                                    style={{
                                        flex: 1,
                                        padding: '10px 16px',
                                        borderRadius: '10px',
                                        border: 'none',
                                        background: pairingRole === 'secondary' ? 'var(--accent-cyan)' : 'transparent',
                                        color: pairingRole === 'secondary' ? '#fff' : 'var(--text-secondary)',
                                        fontSize: '13px',
                                        fontWeight: '800',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <Link size={16} /> 2. Join as a Secondary Server (Connect to Hub)
                                </button>
                            </div>

                            {/* ROLE 1: PRIMARY MASTER HUB (GENERATES KEYS) */}
                            {pairingRole === 'primary' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {/* Quick Demo Proxmox Card */}
                                    <div style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(14, 165, 233, 0.08))', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '18px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <Sparkles size={20} color="var(--primary)" />
                                            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: 'var(--text-primary)' }}>
                                                Instant Demo: Provision Proxmox VE Cluster-02
                                            </h4>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                            Instantly simulate a secondary Proxmox VE server in Frankfurt with 3 storage pools (37 TB), 2 worker agents, and live delta replication.
                                        </p>
                                        <div>
                                            <button
                                                className="btn-primary"
                                                onClick={handleProvisionDemoSite}
                                                disabled={provisioningDemo}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    padding: '10px 20px',
                                                    fontSize: '13px',
                                                    fontWeight: '800',
                                                    background: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
                                                    boxShadow: '0 4px 16px rgba(99, 102, 241, 0.35)'
                                                }}
                                            >
                                                <Sparkles size={15} className={provisioningDemo ? 'animate-spin' : ''} />
                                                {provisioningDemo ? 'Provisioning Demo Proxmox Site...' : '✨ Provision Demo Proxmox VE Cluster'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Primary Server Identity & Cluster Join Info Generator */}
                                    <div style={{ background: 'var(--bg-surface-1)', padding: '24px', borderRadius: '18px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: 'var(--text-primary)' }}>
                                                Primary Cluster Hub Information
                                            </h4>
                                            <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                                This machine is acting as your Primary Cluster Hub. Click below to generate the cryptographic cluster join token to connect any secondary server, PC, or Proxmox VE node.
                                            </p>
                                        </div>

                                        {/* Primary Server Specs Bar */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', padding: '14px', background: 'var(--bg-surface-0)', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
                                            <div>
                                                <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)' }}>PRIMARY HUB HOSTNAME</div>
                                                <div style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--text-primary)', marginTop: '2px' }}>
                                                    {masterInfo?.name || 'Local Master Host'}
                                                </div>
                                            </div>

                                            <div>
                                                <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)' }}>PRIMARY HUB URL / ENDPOINT</div>
                                                <div style={{ fontSize: '13px', fontWeight: '900', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                                                    {window.location.origin}
                                                </div>
                                            </div>

                                            <div>
                                                <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)' }}>DATACENTER FACILITY</div>
                                                <div style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--text-primary)', marginTop: '2px' }}>
                                                    {masterInfo?.location || 'Primary On-Premise Host'}
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            className="btn-primary"
                                            onClick={handleGeneratePairingToken}
                                            style={{
                                                padding: '12px 20px',
                                                fontSize: '13.5px',
                                                fontWeight: '900',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                background: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
                                                boxShadow: '0 4px 16px rgba(99, 102, 241, 0.35)'
                                            }}
                                        >
                                            <Sparkles size={16} /> ✨ Generate Cluster Join Token & Pairing Information
                                        </button>

                                        {generatedToken && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '18px', background: 'var(--bg-surface-0)', borderRadius: '16px', border: '1px solid rgba(99, 102, 241, 0.35)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)' }}>PRIMARY HUB URL:</span>
                                                    <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{window.location.origin}</span>
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)' }}>CLUSTER PAIRING TOKEN:</span>
                                                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#10b981', fontFamily: 'var(--font-mono)' }}>{generatedToken.pairingToken}</span>
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                                                    <label style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--text-muted)' }}>AUTOMATED 1-LINE BASH SCRIPT (FOR REMOTE LINUX / PROXMOX SHELL):</label>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <input
                                                            type="text"
                                                            readOnly
                                                            value={joinCommand}
                                                            style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', fontSize: '12px', fontFamily: 'var(--font-mono)', background: '#0a0f1d', border: '1px solid var(--border-subtle)', color: '#38bdf8' }}
                                                        />
                                                        <button className="btn-outline" onClick={copyCmd} style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '800' }}>
                                                            {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                                                    <a
                                                        href="/simulator.html"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{
                                                            width: '100%',
                                                            padding: '11px 16px',
                                                            borderRadius: '10px',
                                                            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(99, 102, 241, 0.2))',
                                                            border: '1px solid rgba(14, 165, 233, 0.4)',
                                                            color: '#38bdf8',
                                                            fontSize: '13px',
                                                            fontWeight: '800',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '8px',
                                                            textDecoration: 'none',
                                                            boxSizing: 'border-box'
                                                        }}
                                                    >
                                                        <ExternalLink size={15} /> 🧪 Open Secondary Server Simulator (Test Page)
                                                    </a>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ROLE 2: SECONDARY SERVER (CONNECTS TO PRIMARY HUB) */}
                            {pairingRole === 'secondary' && (
                                <div style={{ background: 'var(--bg-surface-1)', padding: '24px', borderRadius: '18px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div>
                                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: 'var(--text-primary)' }}>
                                            Connect this Server to a Primary Cluster Hub
                                        </h4>
                                        <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                            Enter the Primary Hub URL and Cluster Join Token from Server 1 to link this secondary server into the multi-site cluster mesh.
                                        </p>
                                    </div>

                                    <form onSubmit={handleJoinPrimaryHub} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)' }}>PRIMARY HUB URL</label>
                                            <input
                                                type="text"
                                                required
                                                className="form-control"
                                                placeholder="e.g. http://192.168.1.100:5000 or https://master.nexadisk.internal"
                                                value={hubUrl}
                                                onChange={(e) => setHubUrl(e.target.value)}
                                                style={{ padding: '11px 14px', borderRadius: '10px', fontSize: '13px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                                            />
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)' }}>CLUSTER PAIRING TOKEN</label>
                                            <input
                                                type="text"
                                                required
                                                className="form-control"
                                                placeholder="nms_..."
                                                value={joinToken}
                                                onChange={(e) => setJoinToken(e.target.value)}
                                                style={{ padding: '11px 14px', borderRadius: '10px', fontSize: '13px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                                            />
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)' }}>THIS SERVER NAME</label>
                                                    <span style={{ fontSize: '10px', color: '#10b981', fontWeight: '800' }}>✨ Auto-Detected</span>
                                                </div>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder={masterInfo?.name || "e.g. Local Server Host"}
                                                    value={secondarySiteName !== '' ? secondarySiteName : (masterInfo?.name || '')}
                                                    onChange={(e) => setSecondarySiteName(e.target.value)}
                                                    style={{ padding: '11px 14px', borderRadius: '10px', fontSize: '13px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                                                />
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)' }}>PHYSICAL LOCATION</label>
                                                    <span style={{ fontSize: '10px', color: '#10b981', fontWeight: '800' }}>✨ Auto-Detected</span>
                                                </div>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder={masterInfo?.location || "e.g. Primary Datacenter / On-Premise Host"}
                                                    value={secondaryLocation !== '' ? secondaryLocation : (masterInfo?.location || '')}
                                                    onChange={(e) => setSecondaryLocation(e.target.value)}
                                                    style={{ padding: '11px 14px', borderRadius: '10px', fontSize: '13px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                                                />
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            className="btn-primary"
                                            disabled={joiningHub}
                                            style={{
                                                padding: '12px 20px',
                                                fontSize: '13.5px',
                                                fontWeight: '900',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                                                boxShadow: '0 4px 16px rgba(14, 165, 233, 0.35)',
                                                marginTop: '6px'
                                            }}
                                        >
                                            <Link size={16} />
                                            {joiningHub ? 'Handshaking with Primary Hub...' : '🔗 Join Primary Cluster Hub'}
                                        </button>
                                    </form>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 28px', background: 'var(--bg-surface-1)', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        NexaDisk Global Mesh v2.4.0 • Zero-Port-Forwarding mTLS Tunnels
                    </span>
                    <button className="btn-outline" onClick={onClose} style={{ padding: '8px 20px', fontSize: '13px', fontWeight: '700' }}>
                        Close
                    </button>
                </div>
            </div>

            {/* Datacenter Inspector Modal */}
            {selectedSiteInspector && (
                <DatacenterInspectorModal
                    site={selectedSiteInspector}
                    onClose={() => setSelectedSiteInspector(null)}
                />
            )}

            {/* Remote Site File & Storage Explorer Modal */}
            {remoteExplorer && (
                <RemoteStorageExplorerModal
                    explorer={remoteExplorer}
                    onNavigate={(newPath) => handleOpenRemoteExplorer(remoteExplorer.siteId, remoteExplorer.siteName, newPath)}
                    onClose={() => setRemoteExplorer(null)}
                />
            )}

            {/* In-UI Confirmation: Unpair Site */}
            <ConfirmModal
                show={!!siteToUnpair}
                title="Unpair Cluster Site"
                message="Are you sure you want to disconnect and unpair this site from the cluster mesh topology? Its storage pools and agents will be detached."
                confirmText="Unpair Site"
                cancelText="Cancel"
                type="danger"
                onConfirm={confirmUnpairSite}
                onCancel={() => setSiteToUnpair(null)}
            />

            {/* New Replication Job Dialog */}
            {showNewJobModal && (
                <div className="modal-overlay" style={{ zIndex: 100000 }} onClick={() => setShowNewJobModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '540px', maxWidth: '92vw', background: 'var(--bg-surface-0)', borderRadius: '18px', padding: '24px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '900', color: 'var(--text-primary)' }}>
                                Create Cross-Site Replication Pipeline
                            </h3>
                            <button className="btn-icon" onClick={() => setShowNewJobModal(false)}><X size={18} /></button>
                        </div>

                        <form onSubmit={handleCreateSyncJob} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)' }}>PIPELINE NAME</label>
                                <input
                                    type="text"
                                    required
                                    className="form-control"
                                    placeholder="e.g. Master to Frankfurt Snapshot Backup"
                                    value={syncName}
                                    onChange={(e) => setSyncName(e.target.value)}
                                    style={{ padding: '10px 14px', borderRadius: '10px', fontSize: '13px', background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)' }}>SOURCE SITE</label>
                                    <select
                                        value={sourceSiteId}
                                        onChange={(e) => setSourceSiteId(e.target.value)}
                                        style={{ padding: '10px 14px', borderRadius: '10px', fontSize: '13px', background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                                    >
                                        <option value="master-local">{masterInfo?.name || 'Local Master Host'}</option>
                                        {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)' }}>TARGET SITE</label>
                                    <select
                                        value={targetSiteId}
                                        onChange={(e) => setTargetSiteId(e.target.value)}
                                        style={{ padding: '10px 14px', borderRadius: '10px', fontSize: '13px', background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                                    >
                                        <option value="">Select Target Site...</option>
                                        <option value="master-local">{masterInfo?.name || 'Local Master Host'}</option>
                                        {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)' }}>SOURCE PATH</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={sourcePath}
                                        onChange={(e) => setSourcePath(e.target.value)}
                                        style={{ padding: '10px 14px', borderRadius: '10px', fontSize: '13px', background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)' }}>TARGET PATH</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={targetPath}
                                        onChange={(e) => setTargetPath(e.target.value)}
                                        style={{ padding: '10px 14px', borderRadius: '10px', fontSize: '13px', background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                                <button type="button" className="btn-outline" onClick={() => setShowNewJobModal(false)} style={{ padding: '8px 16px', fontSize: '13px' }}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" style={{ padding: '8px 20px', fontSize: '13px', fontWeight: '800' }}>
                                    Create Pipeline
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── PROXMOX-STYLE SITE CARD COMPONENT ──────────────────────────────────────────────
const SiteCard = ({ site, isMaster, isExpanded, onToggleExpand, onInspect, onBrowseStorage, onUnpair }) => {
    if (!site) return null;

    const details = site.details || {};
    const storagePools = details.storagePools || [];
    const agents = details.agents || [];
    const storageCap = Number(site.storage_capacity_bytes || site.storageTotalBytes || 0);
    const storageUsed = Number(site.storage_used_bytes || site.storageUsedBytes || 0);
    const storagePct = storageCap > 0 ? Math.round((storageUsed / storageCap) * 100) : 0;
    const cpuVal = site.cpu || details.cpuUsage || 8.5;
    const memVal = site.memory || (details.ramTotalBytes ? Math.round((details.ramUsedBytes / details.ramTotalBytes) * 100) : 24);

    return (
        <div style={{
            borderRadius: '18px',
            background: 'var(--bg-surface-1)',
            border: isMaster ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid var(--border-subtle)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all 0.2s ease'
        }}>
            {/* Site Main Bar */}
            <div style={{
                padding: '20px 24px',
                background: isMaster ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(14, 165, 233, 0.05))' : 'var(--bg-surface-1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '14px',
                        background: isMaster ? 'rgba(99, 102, 241, 0.2)' : 'rgba(14, 165, 233, 0.15)',
                        border: `1px solid ${isMaster ? 'rgba(99, 102, 241, 0.35)' : 'rgba(14, 165, 233, 0.3)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isMaster ? 'var(--primary)' : 'var(--accent-cyan)'
                    }}>
                        {isMaster ? <Shield size={26} /> : <Server size={26} />}
                    </div>

                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '16.5px', fontWeight: '900', color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                                {site.name}
                            </span>
                            <span style={{
                                fontSize: '10px',
                                fontWeight: '900',
                                background: isMaster ? 'rgba(99, 102, 241, 0.2)' : 'rgba(14, 165, 233, 0.2)',
                                color: isMaster ? 'var(--primary)' : 'var(--accent-cyan)',
                                padding: '3px 9px',
                                borderRadius: '6px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                {isMaster ? 'CLUSTER MASTER HUB' : (details.hypervisor?.includes('Proxmox') ? 'PROXMOX PVE CLUSTER' : 'FEDERATED SITE')}
                            </span>
                            <span style={{
                                fontSize: '10px',
                                fontWeight: '900',
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: '#10b981',
                                padding: '3px 9px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                <Radio size={10} /> ONLINE
                            </span>
                        </div>

                        <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span>📍 <strong>{site.location || 'Local Host'}</strong></span>
                            <span>🌐 IP: <strong>{site.ip || details.ip || '127.0.0.1'}</strong></span>
                            <span>⚡ Latency: <strong style={{ color: '#10b981' }}>{site.latency_ms || site.latencyMs || 0.1}ms</strong></span>
                            {details.hypervisor && (
                                <span style={{ color: 'var(--text-muted)' }}>🖥️ {details.hypervisor}</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Telemetry Quick Meters & Action Buttons */}
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Storage Meter */}
                    <div style={{ textAlign: 'right', minWidth: '130px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '800' }}>STORAGE POOL</div>
                        <div style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--text-primary)' }}>
                            {formatBytes(storageUsed)} / {formatBytes(storageCap)}
                        </div>
                        <div style={{ width: '100%', height: '5px', background: 'var(--bg-surface-2)', borderRadius: '10px', overflow: 'hidden', marginTop: '4px' }}>
                            <div style={{ width: `${Math.min(100, storagePct)}%`, height: '100%', background: storagePct > 80 ? 'var(--accent-red)' : 'var(--primary)' }} />
                        </div>
                    </div>

                    {/* CPU Meter */}
                    <div style={{ textAlign: 'right', minWidth: '70px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '800' }}>CPU LOAD</div>
                        <div style={{ fontSize: '13.5px', fontWeight: '900', color: cpuVal > 70 ? 'var(--accent-gold)' : '#10b981' }}>
                            {cpuVal}%
                        </div>
                    </div>

                    {/* RAM Meter */}
                    <div style={{ textAlign: 'right', minWidth: '70px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '800' }}>RAM ALLOC</div>
                        <div style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--accent-cyan)' }}>
                            {memVal}%
                        </div>
                    </div>

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                            className="btn-primary"
                            onClick={onBrowseStorage}
                            style={{ padding: '7px 12px', fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--primary-gradient)' }}
                            title="Browse Storage & Files on this Site"
                        >
                            <Folder size={13} /> Browse Storage
                        </button>

                        <button
                            className="btn-outline"
                            onClick={onInspect}
                            style={{ padding: '7px 12px', fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '5px' }}
                            title="Inspect Datacenter Telemetry & Nodes"
                        >
                            <Layers size={13} /> Inspect
                        </button>

                        {!isMaster && onUnpair && (
                            <button
                                className="btn-outline"
                                onClick={onUnpair}
                                style={{ padding: '7px 10px', fontSize: '12px', color: 'var(--accent-red)', borderColor: 'rgba(244, 63, 94, 0.3)' }}
                                title="Unpair Site"
                            >
                                <Trash2 size={13} />
                            </button>
                        )}

                        <button
                            onClick={onToggleExpand}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center' }}
                        >
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Expandable Proxmox Datacenter Sub-Panels */}
            {isExpanded && (
                <div style={{ padding: '20px 24px', background: 'var(--bg-surface-0)', borderTop: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
                    {/* Storage Pools Breakdown */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '12.5px', fontWeight: '900', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Database size={14} color="var(--primary)" />
                                Discovered Storage Pools ({storagePools.length > 0 ? storagePools.length : 1})
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>ZFS / CEPH / NVME</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {(storagePools.length > 0 ? storagePools : [
                                {
                                    id: 'default_local',
                                    name: 'local-storage-pool',
                                    type: 'Host NVMe/SSD Storage',
                                    mountPoint: '/',
                                    totalBytes: storageCap,
                                    usedBytes: storageUsed,
                                    status: 'ONLINE',
                                    health: 'HEALTHY'
                                }
                            ]).map((pool, idx) => {
                                const pPct = pool.totalBytes > 0 ? Math.round((pool.usedBytes / pool.totalBytes) * 100) : 0;
                                return (
                                    <div key={idx} style={{ padding: '12px 14px', borderRadius: '12px', background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <HardDrive size={15} color="var(--accent-cyan)" />
                                                <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>{pool.name}</span>
                                                <span style={{ fontSize: '10px', background: 'var(--bg-surface-2)', padding: '1px 6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>{pool.type}</span>
                                            </div>
                                            <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#10b981' }}>{pool.health || 'ONLINE'}</span>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                                            <span>Mount: {pool.mountPoint || '/'}</span>
                                            <span>{formatBytes(pool.usedBytes)} / {formatBytes(pool.totalBytes)} ({pPct}%)</span>
                                        </div>

                                        <div style={{ width: '100%', height: '4px', background: 'var(--bg-surface-2)', borderRadius: '10px', overflow: 'hidden' }}>
                                            <div style={{ width: `${Math.min(100, pPct)}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #0ea5e9)' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Agent Nodes & Hardware Telemetry */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '12.5px', fontWeight: '900', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Cpu size={14} color="#10b981" />
                                Cluster Agent Worker Nodes ({agents.length})
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>mTLS TUNNEL</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {agents.length === 0 ? (
                                <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--bg-surface-1)', border: '1px dashed var(--border-subtle)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                                    No remote worker nodes attached. Use Provision Node to add worker agents.
                                </div>
                            ) : (
                                agents.map((ag, idx) => (
                                    <div key={idx} style={{ padding: '12px 14px', borderRadius: '12px', background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)' }} />
                                            <div>
                                                <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>{ag.name}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                                    {ag.role} • IP: {ag.ip} • Uptime: {ag.uptime}
                                                </div>
                                            </div>
                                        </div>
                                        <span style={{ fontSize: '10.5px', fontWeight: '800', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', padding: '2px 8px', borderRadius: '6px' }}>
                                            COMPLIANT v{ag.version || '2.4.0'}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── REMOTE STORAGE EXPLORER MODAL (EXPLORES SECONDARY SERVER FILES) ─────────────────
const RemoteStorageExplorerModal = ({ explorer, onNavigate, onClose }) => {
    if (!explorer) return null;

    const { siteName, path, items, loading, storagePools } = explorer;
    const pathParts = path.split('/').filter(Boolean);

    return (
        <div className="modal-overlay" style={{ zIndex: 100000 }} onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '860px', maxWidth: '94vw', maxHeight: '88vh', background: 'var(--bg-surface-0)', borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-subtle)', boxShadow: '0 32px 80px rgba(0,0,0,0.75)' }}>
                {/* Explorer Header */}
                <div style={{ padding: '18px 24px', background: 'var(--bg-surface-1)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(14, 165, 233, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)' }}>
                            <Folder size={22} />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '900', color: 'var(--text-primary)' }}>
                                    Remote Storage Explorer: {siteName}
                                </h3>
                                <span style={{ fontSize: '10.5px', fontWeight: '800', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 8px', borderRadius: '6px' }}>
                                    mTLS ENCRYPTED BRIDGE
                                </span>
                            </div>
                            {/* Breadcrumbs */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                <span onClick={() => onNavigate('/')} style={{ cursor: 'pointer', color: 'var(--accent-cyan)', fontWeight: '700' }}>
                                    {siteName} (Root)
                                </span>
                                {pathParts.map((part, idx) => {
                                    const subPath = '/' + pathParts.slice(0, idx + 1).join('/');
                                    return (
                                        <React.Fragment key={idx}>
                                            <ChevronRight size={12} color="var(--text-muted)" />
                                            <span onClick={() => onNavigate(subPath)} style={{ cursor: 'pointer', color: idx === pathParts.length - 1 ? 'var(--text-primary)' : 'var(--accent-cyan)', fontWeight: '700' }}>
                                                {part}
                                            </span>
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <button className="btn-icon" onClick={onClose}><X size={18} /></button>
                </div>

                {/* Explorer Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {loading ? (
                        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} color="var(--accent-cyan)" />
                            <div style={{ fontSize: '14px', fontWeight: '700' }}>Streaming remote filesystem over mTLS...</div>
                        </div>
                    ) : items.length === 0 ? (
                        <div style={{ padding: '50px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                            Empty directory on remote server.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {items.map((item, idx) => {
                                const isDir = item.type === 'directory';
                                const itemPath = path === '/' ? `/${item.name}` : `${path}/${item.name}`;
                                return (
                                    <div
                                        key={idx}
                                        onClick={() => isDir && onNavigate(itemPath)}
                                        style={{
                                            padding: '12px 16px',
                                            borderRadius: '12px',
                                            background: 'var(--bg-surface-1)',
                                            border: '1px solid var(--border-subtle)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            cursor: isDir ? 'pointer' : 'default',
                                            transition: 'all 0.15s ease'
                                        }}
                                        className={isDir ? 'hover-row' : ''}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            {item.isPool ? (
                                                <HardDrive size={18} color="var(--primary)" />
                                            ) : isDir ? (
                                                <Folder size={18} color="var(--accent-cyan)" />
                                            ) : (
                                                <File size={18} color="var(--text-secondary)" />
                                            )}
                                            <div>
                                                <div style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {item.name}
                                                    {item.fsType && (
                                                        <span style={{ fontSize: '10px', background: 'var(--bg-surface-2)', padding: '1px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                                                            {item.fsType}
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                    {item.modified ? new Date(item.modified).toLocaleString() : 'Live'}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                            <span style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--text-secondary)' }}>
                                                {formatBytes(item.size)}
                                            </span>
                                            {isDir && (
                                                <ChevronRight size={16} color="var(--text-muted)" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '14px 24px', background: 'var(--bg-surface-1)', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Connected to {siteName} via NexaDisk Secure Tunnel
                    </span>
                    <button className="btn-outline" onClick={onClose} style={{ padding: '7px 18px', fontSize: '12.5px' }}>
                        Close Explorer
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── DATACENTER INSPECTOR DRAWER COMPONENT ──────────────────────────────────────────
const DatacenterInspectorModal = ({ site, onClose }) => {
    if (!site) return null;
    const details = site.details || {};
    const storagePools = details.storagePools || [];
    const agents = details.agents || [];

    return (
        <div className="modal-overlay" style={{ zIndex: 100000 }} onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '800px', maxWidth: '94vw', maxHeight: '88vh', background: 'var(--bg-surface-0)', borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-subtle)', boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', background: 'var(--bg-surface-1)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(14, 165, 233, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)' }}>
                            <Layers size={22} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)' }}>
                                Datacenter Inspector: {site.name}
                            </h3>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                Real-time hardware telemetry, mounted storage pools, agent daemon telemetry, and tunnel ciphers
                            </p>
                        </div>
                    </div>
                    <button className="btn-icon" onClick={onClose}><X size={18} /></button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Hardware & Hypervisor Specs Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                        <div style={{ padding: '14px', background: 'var(--bg-surface-1)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '800' }}>HYPERVISOR / OS</div>
                            <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '4px' }}>
                                {details.hypervisor || 'Linux Host Node'}
                            </div>
                        </div>

                        <div style={{ padding: '14px', background: 'var(--bg-surface-1)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '800' }}>CPU PROCESSOR</div>
                            <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '4px' }}>
                                {details.cpuModel || 'Multi-Core Host Processor'}
                            </div>
                        </div>

                        <div style={{ padding: '14px', background: 'var(--bg-surface-1)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '800' }}>TUNNEL CIPHER SUITE</div>
                            <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--accent-cyan)', marginTop: '4px' }}>
                                {details.tunnelCipher || 'ChaCha20-Poly1305 / TLS 1.3'}
                            </div>
                        </div>

                        <div style={{ padding: '14px', background: 'var(--bg-surface-1)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '800' }}>DATACENTER FACILITY</div>
                            <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '4px' }}>
                                {details.datacenter || site.location || 'Local Cluster'}
                            </div>
                        </div>
                    </div>

                    {/* Storage Pools List */}
                    <div>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '900', color: 'var(--text-primary)' }}>
                            Active Storage Pools & Devices
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {storagePools.map((p, i) => (
                                <div key={i} style={{ padding: '14px 16px', background: 'var(--bg-surface-1)', borderRadius: '12px', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>{p.name} ({p.type})</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                            Mount: {p.mountPoint} • IOPS: {p.iops || 'High IOPS'} • Status: {p.status}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--text-primary)' }}>
                                            {formatBytes(p.usedBytes)} / {formatBytes(p.totalBytes)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Agent Nodes */}
                    <div>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '900', color: 'var(--text-primary)' }}>
                            Cluster Agent Worker Telemetry
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {agents.map((ag, i) => (
                                <div key={i} style={{ padding: '14px 16px', background: 'var(--bg-surface-1)', borderRadius: '12px', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)' }}>{ag.name}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                            Role: {ag.role} • Node IP: {ag.ip} • Load Avg: {ag.loadAverage || '0.24, 0.18, 0.15'}
                                        </div>
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: '800', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '3px 9px', borderRadius: '6px' }}>
                                        ONLINE ({ag.uptime})
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={{ padding: '14px 24px', background: 'var(--bg-surface-1)', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn-outline" onClick={onClose} style={{ padding: '7px 18px', fontSize: '12.5px' }}>
                        Close Inspector
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SiteMeshModal;
