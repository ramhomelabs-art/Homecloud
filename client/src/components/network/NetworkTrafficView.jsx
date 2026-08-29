import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Activity, Radio, ShieldAlert, ShieldCheck, Users, 
    Wifi, Globe, Lock, Unlock, XCircle, RefreshCw, 
    Server, Cpu, ArrowUpRight, ArrowDownLeft, Terminal,
    Laptop, Smartphone, Bot, Eye, Trash2, BarChart2,
    TrendingUp, Zap, Clock, Search, ExternalLink, Copy, Check,
    Filter, Layers, Flame, ArrowRight, CornerDownRight, X,
    Network, HardDrive, Download, Upload, FileText, Database,
    Share2, AlertTriangle, Shield, CheckCircle2, Binary, Sliders
} from 'lucide-react';
import ConfirmModal from '../modals/ConfirmModal';

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const NetworkTrafficView = ({ showToast }) => {
    // Top Level View Switcher: 'api' (API Dashboard) vs 'network' (Network Dashboard - ntopng style)
    const [viewMode, setViewMode] = useState('api'); // 'api' | 'network'

    // Telemetry Data States
    const [telemetry, setTelemetry] = useState(null);
    const [networkData, setNetworkData] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(true);

    // API Dashboard States
    const [apiGraphMode, setApiGraphMode] = useState('endpoints'); // 'endpoints' | 'velocity' | 'methods'
    const [filterMethod, setFilterMethod] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | '2xx' | '4xx/5xx'

    // Network Dashboard States
    const [networkSubTab, setNetworkSubTab] = useState('flows'); // 'flows' | 'hosts' | 'transfers' | 'agents'
    const [flowFilter, setFlowFilter] = useState('');
    const [hostSearch, setHostSearch] = useState('');

    // Modal Inspection States
    const [selectedEndpoint, setSelectedEndpoint] = useState(null);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [selectedFlow, setSelectedFlow] = useState(null); // Wireshark Packet Modal
    const [selectedHost, setSelectedHost] = useState(null); // Host Inspector Modal
    const [copiedKey, setCopiedKey] = useState(null);
    const [ipToBan, setIpToBan] = useState(null);

    const fetchAllTrafficData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const [telRes, netRes, sessRes] = await Promise.all([
                axios.get('/api/v1/traffic/live', { headers }),
                axios.get('/api/v1/traffic/network-dashboard', { headers }),
                axios.get('/api/v1/traffic/sessions', { headers })
            ]);

            setTelemetry(telRes.data);
            setNetworkData(netRes.data);
            setSessions(sessRes.data.sessions || []);
        } catch (err) {
            console.error('Failed to fetch network traffic data', err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllTrafficData();
        let interval = null;
        if (autoRefresh) {
            interval = setInterval(() => fetchAllTrafficData(true), 2500); // 2.5s poll for real-time smoothness
        }
        return () => clearInterval(interval);
    }, [autoRefresh]);

    const handleKillSession = async (sessionId, username) => {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post('/api/v1/traffic/kill-session', { sessionId }, { headers });
            if (showToast) showToast(`Session for ${username} has been disconnected.`, 'info');
            fetchAllTrafficData(true);
        } catch (err) {
            if (showToast) showToast('Failed to revoke session', 'error');
        }
    };

    const confirmBanIp = async () => {
        if (!ipToBan) return;
        const ip = ipToBan;
        setIpToBan(null);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post('/api/v1/traffic/ban-client', { ip, reason: 'Banned from Live Traffic Inspector' }, { headers });
            if (showToast) showToast(`IP ${ip} has been blacklisted and disconnected.`, 'success');
            fetchAllTrafficData(true);
        } catch (err) {
            if (showToast) showToast('Failed to ban client IP', 'error');
        }
    };

    const handleClearBuffer = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post('/api/v1/traffic/clear-buffer', {}, { headers });
            if (showToast) showToast('Traffic stream and flow buffers cleared.', 'info');
            fetchAllTrafficData(true);
        } catch (err) {
            if (showToast) showToast('Failed to clear buffer', 'error');
        }
    };

    const copyToClipboard = (text, key) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
        if (showToast) showToast('Copied to clipboard', 'success');
    };

    const requests = telemetry?.recentRequests || [];
    const topEndpoints = telemetry?.topEndpoints || [];
    const timeSeries = telemetry?.timeSeries || [];
    const methodDistribution = telemetry?.methodDistribution || { GET: 0, POST: 0, PUT: 0, DELETE: 0, PATCH: 0 };

    const topTalkers = networkData?.topTalkers || [];
    const networkFlows = networkData?.networkFlows || [];
    const fileTransfers = networkData?.fileTransfers || [];
    const protocols = networkData?.protocols || [];
    const agents = networkData?.agents || [];

    // Filter requests in API view
    const filteredRequests = useMemo(() => {
        return requests.filter(r => {
            if (filterMethod !== 'ALL' && r.method !== filterMethod) return false;
            if (statusFilter === '2xx' && (r.statusCode < 200 || r.statusCode >= 300)) return false;
            if (statusFilter === '4xx/5xx' && r.statusCode < 400) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchesPath = r.path?.toLowerCase().includes(q);
                const matchesIp = r.ip?.toLowerCase().includes(q);
                const matchesUser = r.username?.toLowerCase().includes(q);
                const matchesCode = String(r.statusCode).includes(q);
                if (!matchesPath && !matchesIp && !matchesUser && !matchesCode) return false;
            }
            return true;
        });
    }, [requests, filterMethod, statusFilter, searchQuery]);

    // Filter flows in Network view
    const filteredFlows = useMemo(() => {
        if (!flowFilter.trim()) return networkFlows;
        const q = flowFilter.toLowerCase();
        return networkFlows.filter(f => 
            f.srcIp?.toLowerCase().includes(q) ||
            f.action?.toLowerCase().includes(q) ||
            f.l7Application?.toLowerCase().includes(q) ||
            f.username?.toLowerCase().includes(q) ||
            String(f.statusCode).includes(q)
        );
    }, [networkFlows, flowFilter]);

    // Filter hosts in Network view
    const filteredHosts = useMemo(() => {
        if (!hostSearch.trim()) return topTalkers;
        const q = hostSearch.toLowerCase();
        return topTalkers.filter(h => 
            h.ip?.toLowerCase().includes(q) ||
            h.hostname?.toLowerCase().includes(q) ||
            h.countryName?.toLowerCase().includes(q) ||
            h.client?.os?.toLowerCase().includes(q)
        );
    }, [topTalkers, hostSearch]);

    // Max metrics for graph scaling
    const maxTimeSeriesReq = useMemo(() => {
        if (!timeSeries.length) return 10;
        const max = Math.max(...timeSeries.map(p => p.requests || 0));
        return max > 0 ? max : 10;
    }, [timeSeries]);

    const maxEndpointCount = useMemo(() => {
        if (!topEndpoints.length) return 1;
        const max = Math.max(...topEndpoints.map(e => e.count || 0));
        return max > 0 ? max : 1;
    }, [topEndpoints]);

    const totalMethodCount = useMemo(() => {
        return Object.values(methodDistribution).reduce((a, b) => a + b, 0) || 1;
    }, [methodDistribution]);

    const maxHostBandwidth = useMemo(() => {
        if (!topTalkers.length) return 1;
        const max = Math.max(...topTalkers.map(h => h.totalBytes || 0));
        return max > 0 ? max : 1;
    }, [topTalkers]);

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', padding: '10px 0' }}>
            {/* Header Title & Top-Level Dashboard Mode Switcher */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h2 style={{ fontSize: '26px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {viewMode === 'api' ? <Wifi size={28} color="var(--primary)" /> : <Network size={28} color="var(--accent-cyan)" />}
                        {viewMode === 'api' ? 'Network Traffic & API Analytics' : 'ntopng Network & Deep Packet Flow Inspector'}
                    </h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {viewMode === 'api' 
                            ? 'Real-time HTTP packet inspector, API endpoint traffic graphs, latency telemetry, and client session controls' 
                            : 'Layer-4/7 flow analysis, host bandwidth matrices, packet captures, file sync traffic, and Wireshark inspection'}
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Primary Mode Toggle: API Dashboard vs Network Dashboard */}
                    <div style={{ display: 'flex', background: 'var(--bg-surface-2)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                        <button
                            onClick={() => setViewMode('api')}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '9px',
                                fontSize: '12.5px',
                                fontWeight: '800',
                                border: 'none',
                                background: viewMode === 'api' ? 'var(--primary)' : 'transparent',
                                color: viewMode === 'api' ? '#ffffff' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '7px',
                                transition: 'all 0.15s'
                            }}
                        >
                            <BarChart2 size={15} /> API Dashboard
                        </button>
                        <button
                            onClick={() => setViewMode('network')}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '9px',
                                fontSize: '12.5px',
                                fontWeight: '800',
                                border: 'none',
                                background: viewMode === 'network' ? 'var(--accent-cyan)' : 'transparent',
                                color: viewMode === 'network' ? '#000000' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '7px',
                                transition: 'all 0.15s'
                            }}
                        >
                            <Network size={15} /> Network Dashboard (ntopng)
                        </button>
                    </div>

                    <button 
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={autoRefresh ? 'btn-primary' : 'btn-secondary'}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '800' }}
                    >
                        <Radio size={14} style={{ animation: autoRefresh ? 'pulse 1s infinite' : 'none' }} />
                        {autoRefresh ? 'Live' : 'Paused'}
                    </button>
                    <button 
                        onClick={() => fetchAllTrafficData()}
                        className="btn-secondary"
                        style={{ padding: '8px 12px', borderRadius: '10px' }}
                        title="Refresh Telemetry"
                    >
                        <RefreshCw size={14} className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Top Telemetry Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                            {viewMode === 'api' ? 'Total Requests' : 'Total Network Ingress / Egress'}
                        </span>
                        <Activity size={18} color="var(--primary)" />
                    </div>
                    <span style={{ fontSize: '26px', fontWeight: '900', color: 'var(--text-primary)' }}>
                        {viewMode === 'api' ? telemetry?.totalRequests || 0 : formatBytes(networkData?.totalBytesIn + networkData?.totalBytesOut)}
                    </span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {viewMode === 'api' ? 'Captured cluster requests' : `${networkData?.totalPacketsIn + networkData?.totalPacketsOut || 0} Total Packets Transmitted`}
                    </span>
                </div>

                <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                            {viewMode === 'api' ? 'Active Connected Sessions' : 'Active Network Hosts (ntopng)'}
                        </span>
                        <Users size={18} color="#10b981" />
                    </div>
                    <span style={{ fontSize: '26px', fontWeight: '900', color: '#10b981' }}>
                        {viewMode === 'api' ? `${sessions.length} Online` : `${networkData?.activeHostCount || topTalkers.length} Talkers`}
                    </span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {viewMode === 'api' ? 'Authenticated + Guest tokens' : `${networkData?.totalFlowCount || 0} Active L4/L7 Flows Tracked`}
                    </span>
                </div>

                <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Data Ingest / Outflow</span>
                        <ArrowUpRight size={18} color="var(--accent-cyan)" />
                    </div>
                    <span style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)' }}>
                        <span style={{ color: '#10b981' }}>↓ {formatBytes(telemetry?.bytesIn || networkData?.totalBytesIn)}</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-dim)', margin: '0 6px' }}>/</span>
                        <span style={{ color: 'var(--accent-cyan)' }}>↑ {formatBytes(telemetry?.bytesOut || networkData?.totalBytesOut)}</span>
                    </span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Inbound payload / Outbound data
                    </span>
                </div>

                <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                            {viewMode === 'api' ? 'Error & Block Rate' : 'Cluster Mesh Nodes'}
                        </span>
                        <ShieldAlert size={18} color={telemetry?.errorRate > 5 ? '#f43f5e' : '#10b981'} />
                    </div>
                    <span style={{ fontSize: '26px', fontWeight: '900', color: telemetry?.errorRate > 5 ? '#f43f5e' : '#10b981' }}>
                        {viewMode === 'api' ? `${telemetry?.errorRate || '0.0'}%` : `${agents.length} Fleet Nodes`}
                    </span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {viewMode === 'api' ? '4xx client & 5xx server errors' : 'Zero packet loss in peer mesh'}
                    </span>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* VIEW MODE 1: API DASHBOARD                                               */}
            {/* ========================================================================= */}
            {viewMode === 'api' && (
                <>
                    {/* API Analytics & Graphs */}
                    <div className="glass" style={{ padding: '22px', borderRadius: '20px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)', boxShadow: 'var(--shadow-md)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <BarChart2 size={20} color="var(--primary)" /> API Traffic Analytics & High-Frequency Routes
                                </h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    Real-time distribution of highest accessed API endpoints, execution velocity, and HTTP verb ratio
                                </p>
                            </div>

                            <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-surface-2)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                                <button
                                    onClick={() => setApiGraphMode('endpoints')}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '7px',
                                        fontSize: '12px',
                                        fontWeight: '800',
                                        border: 'none',
                                        background: apiGraphMode === 'endpoints' ? 'var(--primary)' : 'transparent',
                                        color: apiGraphMode === 'endpoints' ? '#ffffff' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <Flame size={13} /> Top Endpoints ({topEndpoints.length})
                                </button>
                                <button
                                    onClick={() => setApiGraphMode('velocity')}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '7px',
                                        fontSize: '12px',
                                        fontWeight: '800',
                                        border: 'none',
                                        background: apiGraphMode === 'velocity' ? 'var(--primary)' : 'transparent',
                                        color: apiGraphMode === 'velocity' ? '#ffffff' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <TrendingUp size={13} /> Live Velocity Graph
                                </button>
                                <button
                                    onClick={() => setApiGraphMode('methods')}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '7px',
                                        fontSize: '12px',
                                        fontWeight: '800',
                                        border: 'none',
                                        background: apiGraphMode === 'methods' ? 'var(--primary)' : 'transparent',
                                        color: apiGraphMode === 'methods' ? '#ffffff' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <Layers size={13} /> Method Breakdown
                                </button>
                            </div>
                        </div>

                        {/* Top Endpoints */}
                        {apiGraphMode === 'endpoints' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {topEndpoints.length === 0 ? (
                                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
                                        Awaiting inbound cluster requests to aggregate endpoint statistics...
                                    </div>
                                ) : (
                                    topEndpoints.map((ep, idx) => {
                                        const fillPercentage = Math.max(8, (ep.count / maxEndpointCount) * 100);
                                        const methodColor = ep.primaryMethod === 'GET' ? 'var(--accent-cyan)' : ep.primaryMethod === 'POST' ? 'var(--primary)' : ep.primaryMethod === 'DELETE' ? '#f43f5e' : '#f59e0b';

                                        return (
                                            <div
                                                key={ep.path}
                                                onClick={() => setSelectedEndpoint(ep)}
                                                style={{
                                                    position: 'relative',
                                                    padding: '12px 16px',
                                                    borderRadius: '12px',
                                                    background: 'var(--bg-surface-2)',
                                                    border: '1px solid var(--border-subtle)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: '14px',
                                                    cursor: 'pointer',
                                                    overflow: 'hidden'
                                                }}
                                                className="hover-card"
                                            >
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${fillPercentage}%` }}
                                                    transition={{ duration: 0.6, ease: 'easeOut' }}
                                                    style={{
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: 0,
                                                        bottom: 0,
                                                        background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.08) 0%, rgba(99, 102, 241, 0.18) 100%)',
                                                        zIndex: 0,
                                                        borderRadius: '12px'
                                                    }}
                                                />
                                                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                                                    <span style={{ fontSize: '11px', fontWeight: '900', color: 'var(--text-dim)', width: '20px', textAlign: 'center' }}>
                                                        #{idx + 1}
                                                    </span>
                                                    <span style={{ fontSize: '10px', fontWeight: '900', padding: '2px 7px', borderRadius: '4px', background: 'var(--bg-surface-0)', border: `1px solid ${methodColor}`, color: methodColor, fontFamily: 'var(--font-mono)' }}>
                                                        {ep.primaryMethod}
                                                    </span>
                                                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {ep.path}
                                                    </span>
                                                </div>
                                                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px' }}>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontWeight: '900', color: 'var(--text-primary)' }}>
                                                            {ep.count.toLocaleString()} <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>reqs</span>
                                                        </div>
                                                        <div style={{ fontSize: '10.5px', color: 'var(--primary)', fontWeight: '700' }}>
                                                            {ep.percentage}% share
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', fontSize: '11px', fontWeight: '700', color: ep.avgDuration > 50 ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>
                                                        <Clock size={12} />
                                                        <span>{ep.avgDuration}ms</span>
                                                    </div>
                                                    <div style={{ fontSize: '11px', fontWeight: '800', color: ep.errorRate > 0 ? '#f43f5e' : '#10b981', padding: '3px 8px', borderRadius: '6px', background: ep.errorRate > 0 ? 'rgba(244, 63, 94, 0.1)' : 'rgba(16, 185, 129, 0.1)' }}>
                                                        {ep.errorRate > 0 ? `${ep.errorRate}% Err` : '100% OK'}
                                                    </div>
                                                    <Eye size={15} color="var(--text-dim)" />
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {/* Velocity SVG Graph */}
                        {apiGraphMode === 'velocity' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ height: '180px', width: '100%', position: 'relative' }}>
                                    <svg viewBox="0 0 1000 160" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                                        <defs>
                                            <linearGradient id="trafficGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.45" />
                                                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                                            </linearGradient>
                                            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                                <stop offset="0%" stopColor="var(--accent-cyan)" />
                                                <stop offset="100%" stopColor="var(--primary)" />
                                            </linearGradient>
                                        </defs>
                                        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                                            <line key={i} x1="0" y1={`${ratio * 140 + 10}`} x2="1000" y2={`${ratio * 140 + 10}`} stroke="var(--border-subtle)" strokeDasharray="4 4" />
                                        ))}
                                        {timeSeries.length > 1 && (() => {
                                            const width = 1000 / (timeSeries.length - 1);
                                            const coords = timeSeries.map((p, i) => {
                                                const x = (i * width).toFixed(1);
                                                const y = (150 - Math.min(135, ((p.requests || 0) / maxTimeSeriesReq) * 125)).toFixed(1);
                                                return { x, y, requests: p.requests || 0, time: p.time };
                                            });
                                            const linePath = `M ${coords[0].x} ${coords[0].y} ` + coords.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
                                            const areaPath = `${linePath} L 1000 160 L 0 160 Z`;
                                            return (
                                                <>
                                                    <path d={areaPath} fill="url(#trafficGradient)" />
                                                    <path d={linePath} fill="none" stroke="url(#lineGradient)" strokeWidth="2.5" strokeLinecap="round" />
                                                    {coords.map((p, i) => (
                                                        <circle key={i} cx={p.x} cy={p.y} r={p.requests > 0 ? "4.5" : "2"} fill="var(--primary)" stroke="#ffffff" strokeWidth="1.5">
                                                            <title>{`${p.time}: ${p.requests} reqs`}</title>
                                                        </circle>
                                                    ))}
                                                </>
                                            );
                                        })()}
                                    </svg>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                    <span>{timeSeries[0]?.time || '00:00:00'}</span>
                                    <span>Live Cluster Traffic Throughput (Rolling 5s Window)</span>
                                    <span>{timeSeries[timeSeries.length - 1]?.time || 'Now'}</span>
                                </div>
                            </div>
                        )}

                        {/* Methods */}
                        {apiGraphMode === 'methods' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', height: '24px', borderRadius: '8px', overflow: 'hidden', width: '100%', background: 'var(--bg-surface-2)' }}>
                                    {Object.entries(methodDistribution).map(([method, count]) => {
                                        const pct = (count / totalMethodCount) * 100;
                                        if (pct <= 0) return null;
                                        const color = method === 'GET' ? 'var(--accent-cyan)' : method === 'POST' ? 'var(--primary)' : method === 'DELETE' ? '#f43f5e' : method === 'PUT' ? '#f59e0b' : '#8b5cf6';
                                        return <div key={method} style={{ width: `${pct}%`, background: color }} title={`${method}: ${count} (${pct.toFixed(1)}%)`} />;
                                    })}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                                    {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((m) => {
                                        const count = methodDistribution[m] || 0;
                                        const pct = ((count / totalMethodCount) * 100).toFixed(1);
                                        const color = m === 'GET' ? 'var(--accent-cyan)' : m === 'POST' ? 'var(--primary)' : m === 'DELETE' ? '#f43f5e' : m === 'PUT' ? '#f59e0b' : '#8b5cf6';
                                        return (
                                            <div key={m} style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span style={{ fontSize: '11px', fontWeight: '900', color: color, fontFamily: 'var(--font-mono)' }}>{m}</span>
                                                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)' }}>{pct}%</span>
                                                </div>
                                                <span style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)' }}>{count}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Live Request Feed */}
                    <div className="glass" style={{ padding: '20px', borderRadius: '18px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)', boxShadow: 'var(--shadow-md)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px', maxWidth: '400px' }}>
                                <div style={{ position: 'relative', width: '100%' }}>
                                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                                    <input
                                        type="text"
                                        placeholder="Filter by route, IP, user, status..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        style={{ width: '100%', padding: '7px 12px 7px 32px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)', fontSize: '12px', boxSizing: 'border-box' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    {[{ label: 'All Status', val: 'ALL' }, { label: '2xx OK', val: '2xx' }, { label: '4xx/5xx Err', val: '4xx/5xx' }].map(s => (
                                        <button key={s.val} onClick={() => setStatusFilter(s.val)} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', border: '1px solid var(--border-subtle)', background: statusFilter === s.val ? 'var(--primary)' : 'var(--bg-surface-2)', color: statusFilter === s.val ? '#ffffff' : 'var(--text-secondary)', cursor: 'pointer' }}>
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    {['ALL', 'GET', 'POST', 'PUT', 'DELETE'].map(m => (
                                        <button key={m} onClick={() => setFilterMethod(m)} style={{ padding: '4px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', border: '1px solid var(--border-subtle)', background: filterMethod === m ? 'var(--accent-cyan)' : 'var(--bg-surface-2)', color: filterMethod === m ? '#000000' : 'var(--text-primary)', cursor: 'pointer' }}>
                                            {m}
                                        </button>
                                    ))}
                                </div>
                                <button onClick={handleClearBuffer} className="btn-secondary" style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }} title="Clear stream buffer">
                                    <Trash2 size={12} /> Clear
                                </button>
                            </div>
                        </div>

                        {filteredRequests.length === 0 ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
                                No requests matching filter in stream buffer.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '520px', overflowY: 'auto' }}>
                                {filteredRequests.map((r) => {
                                    const isSuccess = r.statusCode >= 200 && r.statusCode < 300;
                                    const isRedirect = r.statusCode >= 300 && r.statusCode < 400;
                                    const isClientErr = r.statusCode >= 400 && r.statusCode < 500;
                                    const statusColor = isSuccess ? '#10b981' : isRedirect ? '#0ea5e9' : isClientErr ? '#f59e0b' : '#f43f5e';
                                    const methodColor = r.method === 'GET' ? 'var(--accent-cyan)' : r.method === 'POST' ? 'var(--primary)' : r.method === 'DELETE' ? '#f43f5e' : '#f59e0b';

                                    return (
                                        <div
                                            key={r.id}
                                            onClick={() => setSelectedRequest(r)}
                                            style={{
                                                padding: '10px 14px',
                                                borderRadius: '10px',
                                                background: 'var(--bg-surface-2)',
                                                border: '1px solid var(--border-subtle)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                flexWrap: 'wrap',
                                                gap: '12px',
                                                cursor: 'pointer'
                                            }}
                                            className="hover-card"
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                                                <span style={{ fontSize: '10px', fontWeight: '900', padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-surface-0)', border: `1px solid ${methodColor}`, color: methodColor, fontFamily: 'var(--font-mono)' }}>
                                                    {r.method}
                                                </span>
                                                <span style={{ fontSize: '11px', fontWeight: '800', color: statusColor, fontFamily: 'var(--font-mono)' }}>
                                                    {r.statusCode}
                                                </span>
                                                <span style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '320px' }}>
                                                    {r.path}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                                                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--text-primary)' }}>
                                                    {r.ip}
                                                </span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    {r.client?.type === 'Mobile' ? <Smartphone size={13} /> : r.client?.type === 'Bot / API' ? <Bot size={13} /> : <Laptop size={13} />}
                                                    {r.client?.browser} ({r.client?.os})
                                                </span>
                                                <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                                    {r.durationMs}ms
                                                </span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIpToBan(r.ip);
                                                    }}
                                                    className="btn-danger"
                                                    title="Block IP in Perimeter Firewall"
                                                    style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '800' }}
                                                >
                                                    Ban IP
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ========================================================================= */}
            {/* VIEW MODE 2: NETWORK DASHBOARD (ntopng & Wireshark DPI Inspector)          */}
            {/* ========================================================================= */}
            {viewMode === 'network' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Top Protocol Breakdown & Ingress/Egress Bandwidth Dual Area */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                        {/* Protocol Hierarchy Breakdown */}
                        <div className="glass" style={{ padding: '22px', borderRadius: '20px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Layers size={18} color="var(--accent-cyan)" /> Application Protocols & L7 Distribution
                                </h3>
                                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)' }}>ntopng DPI Engine</span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {protocols.map(p => (
                                    <div key={p.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                            <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{p.name}</span>
                                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: p.color }}>
                                                {formatBytes(p.bytes)} ({p.percentage}%)
                                            </span>
                                        </div>
                                        <div style={{ width: '100%', height: '7px', borderRadius: '4px', background: 'var(--bg-surface-2)', overflow: 'hidden' }}>
                                            <div style={{ width: `${Math.max(4, p.percentage)}%`, height: '100%', background: p.color, borderRadius: '4px' }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Dual Bandwidth Ingress / Egress Real-Time Graph */}
                        <div className="glass" style={{ padding: '22px', borderRadius: '20px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <TrendingUp size={18} color="#10b981" /> Live Ingress / Egress Dual Flow
                                </h3>
                                <div style={{ display: 'flex', gap: '10px', fontSize: '11px', fontWeight: '800' }}>
                                    <span style={{ color: '#10b981' }}>● Inbound (Ingress)</span>
                                    <span style={{ color: 'var(--accent-cyan)' }}>● Outbound (Egress)</span>
                                </div>
                            </div>

                            <div style={{ height: '140px', width: '100%', position: 'relative' }}>
                                <svg viewBox="0 0 1000 140" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                                    <defs>
                                        <linearGradient id="ingressGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                                        </linearGradient>
                                        <linearGradient id="egressGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                            <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.35" />
                                            <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.0" />
                                        </linearGradient>
                                    </defs>
                                    {[0, 0.5, 1].map((r, i) => (
                                        <line key={i} x1="0" y1={`${r * 120 + 10}`} x2="1000" y2={`${r * 120 + 10}`} stroke="var(--border-subtle)" strokeDasharray="3 3" />
                                    ))}
                                    {timeSeries.length > 1 && (() => {
                                        const width = 1000 / (timeSeries.length - 1);
                                        const maxBytes = Math.max(1024, ...timeSeries.map(p => Math.max(p.bytesIn || 0, p.bytesOut || 0)));
                                        const inPoints = timeSeries.map((p, i) => `${(i * width).toFixed(1)},${(130 - Math.min(120, ((p.bytesIn || 0) / maxBytes) * 110)).toFixed(1)}`);
                                        const outPoints = timeSeries.map((p, i) => `${(i * width).toFixed(1)},${(130 - Math.min(120, ((p.bytesOut || 0) / maxBytes) * 110)).toFixed(1)}`);

                                        return (
                                            <>
                                                <path d={`M ${inPoints[0]} ` + inPoints.slice(1).map(p => `L ${p}`).join(' ') + ` L 1000 140 L 0 140 Z`} fill="url(#ingressGrad)" />
                                                <path d={`M ${inPoints[0]} ` + inPoints.slice(1).map(p => `L ${p}`).join(' ')} fill="none" stroke="#10b981" strokeWidth="2" />
                                                <path d={`M ${outPoints[0]} ` + outPoints.slice(1).map(p => `L ${p}`).join(' ') + ` L 1000 140 L 0 140 Z`} fill="url(#egressGrad)" />
                                                <path d={`M ${outPoints[0]} ` + outPoints.slice(1).map(p => `L ${p}`).join(' ')} fill="none" stroke="var(--accent-cyan)" strokeWidth="2" strokeDasharray="4 2" />
                                            </>
                                        );
                                    })()}
                                </svg>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: '8px' }}>
                                <span>Throughput Speedometer</span>
                                <span>Packets: {networkData?.totalPacketsIn + networkData?.totalPacketsOut || 0} Total</span>
                                <span>Peak: {formatBytes(networkData?.totalBytesIn + networkData?.totalBytesOut)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Network Tabs: Flows | Top Hosts (ntopng) | File Transfers | Remote Agents */}
                    <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                        <button
                            onClick={() => setNetworkSubTab('flows')}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '10px',
                                background: networkSubTab === 'flows' ? 'rgba(14, 165, 233, 0.15)' : 'transparent',
                                border: `1px solid ${networkSubTab === 'flows' ? 'var(--accent-cyan)' : 'transparent'}`,
                                color: networkSubTab === 'flows' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                fontWeight: '800',
                                fontSize: '13px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <Terminal size={15} /> Live Network Flows & Wireshark DPI ({networkFlows.length})
                        </button>
                        <button
                            onClick={() => setNetworkSubTab('hosts')}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '10px',
                                background: networkSubTab === 'hosts' ? 'rgba(14, 165, 233, 0.15)' : 'transparent',
                                border: `1px solid ${networkSubTab === 'hosts' ? 'var(--accent-cyan)' : 'transparent'}`,
                                color: networkSubTab === 'hosts' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                fontWeight: '800',
                                fontSize: '13px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <Globe size={15} /> Top Talkers & Host Matrix ({topTalkers.length})
                        </button>
                        <button
                            onClick={() => setNetworkSubTab('transfers')}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '10px',
                                background: networkSubTab === 'transfers' ? 'rgba(14, 165, 233, 0.15)' : 'transparent',
                                border: `1px solid ${networkSubTab === 'transfers' ? 'var(--accent-cyan)' : 'transparent'}`,
                                color: networkSubTab === 'transfers' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                fontWeight: '800',
                                fontSize: '13px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <FileText size={15} /> File Transfers Stream ({fileTransfers.length})
                        </button>
                        <button
                            onClick={() => setNetworkSubTab('agents')}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '10px',
                                background: networkSubTab === 'agents' ? 'rgba(14, 165, 233, 0.15)' : 'transparent',
                                border: `1px solid ${networkSubTab === 'agents' ? 'var(--accent-cyan)' : 'transparent'}`,
                                color: networkSubTab === 'agents' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                fontWeight: '800',
                                fontSize: '13px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <Bot size={15} /> Remote Fleet Nodes ({agents.length})
                        </button>
                    </div>

                    {/* NETWORK SUB-TAB 1: LIVE FLOWS (Wireshark Packet Inspector Table) */}
                    {networkSubTab === 'flows' && (
                        <div className="glass" style={{ padding: '20px', borderRadius: '18px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)', boxShadow: 'var(--shadow-md)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                                <div style={{ position: 'relative', minWidth: '260px', maxWidth: '400px' }}>
                                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                                    <input
                                        type="text"
                                        placeholder="Search flows by IP, verb, action, app..."
                                        value={flowFilter}
                                        onChange={(e) => setFlowFilter(e.target.value)}
                                        style={{ width: '100%', padding: '7px 12px 7px 32px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)', fontSize: '12px', boxSizing: 'border-box' }}
                                    />
                                </div>
                                <button onClick={handleClearBuffer} className="btn-secondary" style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Trash2 size={12} /> Clear Flow Buffer
                                </button>
                            </div>

                            {filteredFlows.length === 0 ? (
                                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
                                    No network flows captured yet.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '560px', overflowY: 'auto' }}>
                                    {filteredFlows.map(flow => (
                                        <div
                                            key={flow.id}
                                            onClick={() => setSelectedFlow(flow)}
                                            style={{
                                                padding: '12px 16px',
                                                borderRadius: '12px',
                                                background: 'var(--bg-surface-2)',
                                                border: '1px solid var(--border-subtle)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                flexWrap: 'wrap',
                                                gap: '14px',
                                                cursor: 'pointer'
                                            }}
                                            className="hover-card"
                                        >
                                            {/* Source -> Destination */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                                                <span style={{ fontSize: '10px', fontWeight: '900', padding: '2px 7px', borderRadius: '4px', background: 'rgba(14, 165, 233, 0.15)', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                                                    {flow.l7Application}
                                                </span>
                                                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', fontSize: '12.5px', color: 'var(--text-primary)' }}>
                                                    {flow.srcIp}:{flow.srcPort} <span style={{ color: 'var(--text-dim)' }}>→</span> {flow.destIp}:{flow.destPort}
                                                </span>
                                                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                                                    {flow.action}
                                                </span>
                                            </div>

                                            {/* Packets & Hex Inspection Trigger */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11.5px' }}>
                                                <span style={{ color: '#10b981', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>
                                                    ↓ {formatBytes(flow.bytesIn)} / ↑ {formatBytes(flow.bytesOut)}
                                                </span>
                                                <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                                    {flow.durationMs}ms
                                                </span>
                                                <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', color: 'var(--text-dim)' }}>
                                                    {flow.tcpFlags.join('/')}
                                                </span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedFlow(flow);
                                                    }}
                                                    className="btn-secondary"
                                                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', color: 'var(--accent-cyan)' }}
                                                >
                                                    <Binary size={13} /> Wireshark DPI
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* NETWORK SUB-TAB 2: TOP TALKERS & HOST MATRIX (ntopng) */}
                    {networkSubTab === 'hosts' && (
                        <div className="glass" style={{ padding: '20px', borderRadius: '18px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)', boxShadow: 'var(--shadow-md)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Globe size={18} color="var(--accent-cyan)" /> Connected Host Bandwidth & Talkers Matrix
                                </h3>
                                <div style={{ position: 'relative', minWidth: '240px' }}>
                                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                                    <input
                                        type="text"
                                        placeholder="Search by IP, hostname, country..."
                                        value={hostSearch}
                                        onChange={(e) => setHostSearch(e.target.value)}
                                        style={{ width: '100%', padding: '6px 12px 6px 30px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)', fontSize: '12px', boxSizing: 'border-box' }}
                                    />
                                </div>
                            </div>

                            {filteredHosts.length === 0 ? (
                                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
                                    No host records found.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {filteredHosts.map(host => {
                                        const sharePct = host.bandwidthShare || 0;
                                        return (
                                            <div
                                                key={host.ip}
                                                onClick={() => setSelectedHost(host)}
                                                style={{
                                                    position: 'relative',
                                                    padding: '14px 18px',
                                                    borderRadius: '12px',
                                                    background: 'var(--bg-surface-2)',
                                                    border: '1px solid var(--border-subtle)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    flexWrap: 'wrap',
                                                    gap: '14px',
                                                    cursor: 'pointer',
                                                    overflow: 'hidden'
                                                }}
                                                className="hover-card"
                                            >
                                                {/* Background Bandwidth Share Bar */}
                                                <div style={{
                                                    position: 'absolute',
                                                    top: 0, left: 0, bottom: 0,
                                                    width: `${Math.max(4, sharePct)}%`,
                                                    background: 'linear-gradient(90deg, rgba(14, 165, 233, 0.08) 0%, rgba(14, 165, 233, 0.2) 100%)',
                                                    zIndex: 0,
                                                    borderRadius: '12px'
                                                }} />

                                                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                                                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Globe size={18} color="var(--accent-cyan)" />
                                                    </div>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <strong style={{ fontSize: '13.5px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{host.ip}</strong>
                                                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>({host.hostname})</span>
                                                        </div>
                                                        <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '2px' }}>
                                                            <span>{host.countryName}</span> • <span>{host.client?.os || 'Linux'} ({host.client?.browser || 'Agent'})</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '20px', fontSize: '12px' }}>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontWeight: '900', color: 'var(--text-primary)' }}>
                                                            {formatBytes(host.totalBytes)} <span style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}>({sharePct}%)</span>
                                                        </div>
                                                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                                            ↓ {formatBytes(host.bytesIn)} / ↑ {formatBytes(host.bytesOut)}
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setIpToBan(host.ip);
                                                        }}
                                                        className="btn-danger"
                                                        style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800' }}
                                                    >
                                                        Ban Host
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* NETWORK SUB-TAB 3: FILE TRANSFERS STREAM */}
                    {networkSubTab === 'transfers' && (
                        <div className="glass" style={{ padding: '20px', borderRadius: '18px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)', boxShadow: 'var(--shadow-md)' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: '800', margin: '0 0 16px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileText size={18} color="var(--accent-gold)" /> Storage Payload & Real-Time File Transfers
                            </h3>

                            {fileTransfers.length === 0 ? (
                                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
                                    No active or recent file transfers detected.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '560px', overflowY: 'auto' }}>
                                    {fileTransfers.map(ft => (
                                        <div
                                            key={ft.id}
                                            style={{
                                                padding: '12px 16px',
                                                borderRadius: '12px',
                                                background: 'var(--bg-surface-2)',
                                                border: '1px solid var(--border-subtle)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                flexWrap: 'wrap',
                                                gap: '12px'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                                                <div style={{ padding: '6px', borderRadius: '8px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)' }}>
                                                    <HardDrive size={16} color="var(--accent-gold)" />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: '800', fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                                                        {ft.filename}
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                                        <span>{ft.fileType}</span> • <span>Host: {ft.clientIp} ({ft.username})</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px' }}>
                                                <span style={{ fontWeight: '800', color: ft.direction.includes('Ingress') ? '#10b981' : 'var(--accent-cyan)' }}>
                                                    {ft.direction}
                                                </span>
                                                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--text-primary)' }}>
                                                    {formatBytes(ft.size)}
                                                </span>
                                                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                                    {ft.speed}
                                                </span>
                                                <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                                                    {ft.status}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* NETWORK SUB-TAB 4: REMOTE FLEET AGENTS */}
                    {networkSubTab === 'agents' && (
                        <div className="glass" style={{ padding: '20px', borderRadius: '18px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)', boxShadow: 'var(--shadow-md)' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: '800', margin: '0 0 16px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Bot size={18} color="var(--primary)" /> Cluster Agent Mesh & Replication Telemetry
                            </h3>

                            {agents.length === 0 ? (
                                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
                                    No remote cluster agent nodes currently streaming telemetry.
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                                    {agents.map(ag => (
                                        <div key={ag.id} style={{ padding: '16px', borderRadius: '14px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontWeight: '800', fontSize: '14px', color: 'var(--text-primary)' }}>{ag.name}</span>
                                                <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>{ag.status}</span>
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div>Node IP: <code style={{ color: 'var(--primary)' }}>{ag.ip}</code></div>
                                                <div>Heartbeat Latency: <span style={{ color: '#10b981', fontWeight: '700' }}>{ag.latencyMs} ms</span></div>
                                                <div>Platform: {ag.client?.os} ({ag.client?.type})</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ========================================================================= */}
            {/* 🌟 ANIMATED MODAL: WIRESHARK DEEP PACKET INSPECTION (DPI) & HEXDUMP        */}
            {/* ========================================================================= */}
            <AnimatePresence>
                {selectedFlow && (
                    <div style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(10px)',
                        zIndex: 2600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px'
                    }}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.92, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="glass custom-scrollbar"
                            style={{
                                width: '100%',
                                maxWidth: '780px',
                                maxHeight: '92vh',
                                overflowY: 'auto',
                                borderRadius: '24px',
                                border: '1px solid var(--border-bright)',
                                background: 'var(--bg-surface-0)',
                                boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
                                padding: '28px'
                            }}
                        >
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: '900', padding: '3px 8px', borderRadius: '5px', background: 'var(--accent-cyan)', color: '#000000', fontFamily: 'var(--font-mono)' }}>
                                            WIRESHARK DPI
                                        </span>
                                        <span style={{ fontSize: '12px', fontWeight: '800', color: selectedFlow.statusCode < 400 ? '#10b981' : '#f43f5e', fontFamily: 'var(--font-mono)' }}>
                                            {selectedFlow.protocol} • Status {selectedFlow.statusCode}
                                        </span>
                                    </div>
                                    <h3 style={{ fontSize: '17px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                                        {selectedFlow.srcIp}:{selectedFlow.srcPort} → {selectedFlow.destIp}:{selectedFlow.destPort}
                                    </h3>
                                </div>
                                <button onClick={() => setSelectedFlow(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}>
                                    <X size={22} />
                                </button>
                            </div>

                            {/* Wireshark Protocol Tree Breakdown */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                                {/* Layer 2/3 */}
                                <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                                    <div style={{ fontWeight: '800', color: 'var(--accent-cyan)', marginBottom: '4px' }}>▶ Frame & Internet Protocol Version 4 (IPv4)</div>
                                    <div style={{ color: 'var(--text-secondary)', paddingLeft: '14px' }}>
                                        Source: {selectedFlow.srcIp} | Destination: {selectedFlow.destIp} | Header Length: 20 bytes | Protocol: TCP (6) | TTL: 64
                                    </div>
                                </div>

                                {/* Layer 4 */}
                                <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                                    <div style={{ fontWeight: '800', color: '#10b981', marginBottom: '4px' }}>▶ Transmission Control Protocol (TCP) & TLS 1.3</div>
                                    <div style={{ color: 'var(--text-secondary)', paddingLeft: '14px' }}>
                                        Src Port: {selectedFlow.srcPort} | Dst Port: {selectedFlow.destPort} | Flags: [{selectedFlow.tcpFlags.join(', ')}] | Cipher: {selectedFlow.tlsCipher}
                                    </div>
                                </div>

                                {/* Layer 7 */}
                                <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                                    <div style={{ fontWeight: '800', color: 'var(--primary)', marginBottom: '4px' }}>▶ Application Layer: {selectedFlow.l7Application}</div>
                                    <div style={{ color: 'var(--text-secondary)', paddingLeft: '14px' }}>
                                        Action: <code style={{ color: 'var(--primary)' }}>{selectedFlow.action}</code> | User: {selectedFlow.username} | In: {formatBytes(selectedFlow.bytesIn)} | Out: {formatBytes(selectedFlow.bytesOut)}
                                    </div>
                                </div>
                            </div>

                            {/* Raw Packet Hex & ASCII Dump (Wireshark Bottom Pane) */}
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                                        Raw Packet Hex & ASCII Hexdump
                                    </span>
                                    <button
                                        onClick={() => copyToClipboard(selectedFlow.hexdump, 'hex')}
                                        className="btn-secondary"
                                        style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        {copiedKey === 'hex' ? <Check size={12} /> : <Copy size={12} />} Copy Hex
                                    </button>
                                </div>
                                <div style={{
                                    background: '#090d16',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '12px',
                                    padding: '14px',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '11px',
                                    color: '#38bdf8',
                                    overflowX: 'auto',
                                    whiteSpace: 'pre',
                                    lineHeight: '1.6'
                                }}>
                                    {selectedFlow.hexdump}
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button
                                    onClick={() => {
                                        setIpToBan(selectedFlow.srcIp);
                                        setSelectedFlow(null);
                                    }}
                                    className="btn-danger"
                                    style={{ padding: '9px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: '800' }}
                                >
                                    Ban Source IP ({selectedFlow.srcIp})
                                </button>
                                <button
                                    onClick={() => setSelectedFlow(null)}
                                    className="btn-secondary"
                                    style={{ padding: '9px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: '800' }}
                                >
                                    Close Inspector
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* 🌟 ANIMATED MODAL: ENDPOINT DEEP-DIVE INSPECTOR */}
            <AnimatePresence>
                {selectedEndpoint && (
                    <div style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0, 0, 0, 0.65)',
                        backdropFilter: 'blur(8px)',
                        zIndex: 2500,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px'
                    }}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.92, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="glass"
                            style={{
                                width: '100%',
                                maxWidth: '640px',
                                maxHeight: '90vh',
                                overflowY: 'auto',
                                borderRadius: '24px',
                                border: '1px solid var(--border-bright)',
                                background: 'var(--bg-surface-0)',
                                boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
                                padding: '28px'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: '900', padding: '2px 8px', borderRadius: '5px', background: 'var(--primary)', color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                                            {selectedEndpoint.primaryMethod}
                                        </span>
                                        <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                                            {selectedEndpoint.path}
                                        </h3>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                                        Endpoint Performance & Cluster Invocations Profile
                                    </p>
                                </div>
                                <button onClick={() => setSelectedEndpoint(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                                <div style={{ padding: '12px', borderRadius: '12px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Total Hits</div>
                                    <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)', marginTop: '2px' }}>{selectedEndpoint.count}</div>
                                    <div style={{ fontSize: '10.5px', color: 'var(--primary)', fontWeight: '700' }}>{selectedEndpoint.percentage}% of traffic</div>
                                </div>
                                <div style={{ padding: '12px', borderRadius: '12px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Avg Latency</div>
                                    <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)', marginTop: '2px' }}>{selectedEndpoint.avgDuration}ms</div>
                                    <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>Min: {selectedEndpoint.minDuration}ms / Max: {selectedEndpoint.maxDuration}ms</div>
                                </div>
                                <div style={{ padding: '12px', borderRadius: '12px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Success Rate</div>
                                    <div style={{ fontSize: '20px', fontWeight: '900', color: selectedEndpoint.errorRate > 0 ? '#f43f5e' : '#10b981', marginTop: '2px' }}>
                                        {(100 - selectedEndpoint.errorRate).toFixed(1)}%
                                    </div>
                                    <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>{selectedEndpoint.errorRate}% error rate</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => {
                                        setSearchQuery(selectedEndpoint.path);
                                        setViewMode('api');
                                        setSelectedEndpoint(null);
                                    }}
                                    className="btn-secondary"
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: '800' }}
                                >
                                    <Filter size={14} /> Filter Live Feed
                                </button>
                                <button
                                    onClick={() => copyToClipboard(selectedEndpoint.path, 'ep_path')}
                                    className="btn-primary"
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: '800' }}
                                >
                                    {copiedKey === 'ep_path' ? <Check size={14} /> : <Copy size={14} />} Copy Endpoint
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* 🌟 ANIMATED MODAL: REQUEST DETAILS INSPECTOR */}
            <AnimatePresence>
                {selectedRequest && (
                    <div style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0, 0, 0, 0.65)',
                        backdropFilter: 'blur(8px)',
                        zIndex: 2500,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px'
                    }}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.92, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="glass"
                            style={{
                                width: '100%',
                                maxWidth: '600px',
                                maxHeight: '90vh',
                                overflowY: 'auto',
                                borderRadius: '24px',
                                border: '1px solid var(--border-bright)',
                                background: 'var(--bg-surface-0)',
                                boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
                                padding: '28px'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: '900', padding: '2px 8px', borderRadius: '5px', background: 'var(--primary)', color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                                            {selectedRequest.method}
                                        </span>
                                        <span style={{ fontSize: '12px', fontWeight: '800', color: selectedRequest.statusCode < 400 ? '#10b981' : '#f43f5e', fontFamily: 'var(--font-mono)' }}>
                                            {selectedRequest.statusCode}
                                        </span>
                                    </div>
                                    <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                                        {selectedRequest.path}
                                    </h3>
                                </div>
                                <button onClick={() => setSelectedRequest(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-surface-2)', padding: '16px', borderRadius: '14px', border: '1px solid var(--border-subtle)', marginBottom: '20px', fontSize: '12.5px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Client IP:</span>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--text-primary)' }}>{selectedRequest.ip}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>User / Identity:</span>
                                    <span style={{ fontWeight: '800', color: 'var(--primary)' }}>{selectedRequest.username}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Execution Duration:</span>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--text-primary)' }}>{selectedRequest.durationMs} ms</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Payload Transferred:</span>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--text-primary)' }}>{formatBytes(selectedRequest.sizeIn)} in / {formatBytes(selectedRequest.sizeOut)} out</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => {
                                        setIpToBan(selectedRequest.ip);
                                        setSelectedRequest(null);
                                    }}
                                    className="btn-danger"
                                    style={{ padding: '9px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: '800' }}
                                >
                                    Ban IP ({selectedRequest.ip})
                                </button>
                                <button
                                    onClick={() => copyToClipboard(`curl -X ${selectedRequest.method} "http://localhost:5000${selectedRequest.path}"`, 'curl')}
                                    className="btn-primary"
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: '800' }}
                                >
                                    {copiedKey === 'curl' ? <Check size={14} /> : <Copy size={14} />} Copy cURL
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* In-UI Confirmation: Ban IP */}
            <ConfirmModal
                show={!!ipToBan}
                title="Blacklist & Ban Client IP"
                message={`Are you sure you want to drop all traffic and immediately terminate active connections from IP ${ipToBan}?`}
                confirmText="Ban Client IP"
                cancelText="Cancel"
                type="danger"
                onConfirm={confirmBanIp}
                onCancel={() => setIpToBan(null)}
            />
        </div>
    );
};

export default NetworkTrafficView;
