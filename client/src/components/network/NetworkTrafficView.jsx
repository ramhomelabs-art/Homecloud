import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Activity, Radio, ShieldAlert, ShieldCheck, Users, 
    Wifi, Globe, Lock, Unlock, XCircle, RefreshCw, 
    Server, Cpu, ArrowUpRight, ArrowDownLeft, Terminal,
    Laptop, Smartphone, Bot, Eye, Trash2, BarChart2,
    TrendingUp, Zap, Clock, Search, ExternalLink, Copy, Check,
    Filter, Layers, Flame, ArrowRight, CornerDownRight, X
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
    const [telemetry, setTelemetry] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('stream'); // 'stream' | 'sessions'
    const [graphMode, setGraphMode] = useState('endpoints'); // 'endpoints' | 'velocity' | 'methods'
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [filterMethod, setFilterMethod] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | '2xx' | '4xx/5xx'

    // Selected Modal States
    const [selectedEndpoint, setSelectedEndpoint] = useState(null);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [copiedKey, setCopiedKey] = useState(null);
    const [ipToBan, setIpToBan] = useState(null);

    const fetchTrafficData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const [telRes, sessRes] = await Promise.all([
                axios.get('/api/v1/traffic/live', { headers }),
                axios.get('/api/v1/traffic/sessions', { headers })
            ]);

            setTelemetry(telRes.data);
            setSessions(sessRes.data.sessions || []);
        } catch (err) {
            console.error('Failed to fetch traffic data', err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchTrafficData();
        let interval = null;
        if (autoRefresh) {
            interval = setInterval(() => fetchTrafficData(true), 2500); // 2.5s poll for real-time smoothness
        }
        return () => clearInterval(interval);
    }, [autoRefresh]);

    const handleKillSession = async (sessionId, username) => {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post('/api/v1/traffic/kill-session', { sessionId }, { headers });
            if (showToast) showToast(`Session for ${username} has been disconnected.`, 'info');
            fetchTrafficData(true);
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
            fetchTrafficData(true);
        } catch (err) {
            if (showToast) showToast('Failed to ban client IP', 'error');
        }
    };

    const handleClearBuffer = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post('/api/v1/traffic/clear-buffer', {}, { headers });
            if (showToast) showToast('Traffic stream buffer cleared.', 'info');
            fetchTrafficData(true);
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

    // Filter requests
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

    // Maximum requests across time series for graph scaling
    const maxTimeSeriesReq = useMemo(() => {
        if (!timeSeries.length) return 10;
        const max = Math.max(...timeSeries.map(p => p.requests || 0));
        return max > 0 ? max : 10;
    }, [timeSeries]);

    // Maximum endpoint count for bar scaling
    const maxEndpointCount = useMemo(() => {
        if (!topEndpoints.length) return 1;
        const max = Math.max(...topEndpoints.map(e => e.count || 0));
        return max > 0 ? max : 1;
    }, [topEndpoints]);

    const totalMethodCount = useMemo(() => {
        return Object.values(methodDistribution).reduce((a, b) => a + b, 0) || 1;
    }, [methodDistribution]);

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', padding: '10px 0' }}>
            {/* Header Title */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h2 style={{ fontSize: '26px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Wifi size={28} color="var(--primary)" /> Network Traffic & API Analytics
                    </h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Real-time HTTP packet inspector, API endpoint traffic graphs, latency telemetry, and client session controls
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button 
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={autoRefresh ? 'btn-primary' : 'btn-secondary'}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '800' }}
                    >
                        <Radio size={14} style={{ animation: autoRefresh ? 'pulse 1s infinite' : 'none' }} />
                        {autoRefresh ? 'Live Stream Active' : 'Stream Paused'}
                    </button>
                    <button 
                        onClick={() => fetchTrafficData()}
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
                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Total Inbound Requests</span>
                        <Activity size={18} color="var(--primary)" />
                    </div>
                    <span style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-primary)' }}>{telemetry?.totalRequests || 0}</span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Captured cluster requests</span>
                </div>

                <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Active Connected Sessions</span>
                        <Users size={18} color="#10b981" />
                    </div>
                    <span style={{ fontSize: '28px', fontWeight: '900', color: '#10b981' }}>{sessions.length} Online</span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Authenticated + Guest tokens</span>
                </div>

                <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Data Ingest / Outflow</span>
                        <ArrowUpRight size={18} color="var(--accent-cyan)" />
                    </div>
                    <span style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)' }}>
                        {formatBytes(telemetry?.bytesIn)} <span style={{ fontSize: '14px', color: 'var(--text-dim)' }}>/ {formatBytes(telemetry?.bytesOut)}</span>
                    </span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Inbound payload / Outbound data</span>
                </div>

                <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Error & Block Rate</span>
                        <ShieldAlert size={18} color={telemetry?.errorRate > 5 ? '#f43f5e' : '#10b981'} />
                    </div>
                    <span style={{ fontSize: '28px', fontWeight: '900', color: telemetry?.errorRate > 5 ? '#f43f5e' : '#10b981' }}>
                        {telemetry?.errorRate || '0.0'}%
                    </span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>4xx client & 5xx server errors</span>
                </div>
            </div>

            {/* 🌟 NEW: INTERACTIVE API ANALYTICS & GRAPH SECTION */}
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
                            onClick={() => setGraphMode('endpoints')}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '7px',
                                fontSize: '12px',
                                fontWeight: '800',
                                border: 'none',
                                background: graphMode === 'endpoints' ? 'var(--primary)' : 'transparent',
                                color: graphMode === 'endpoints' ? '#ffffff' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.15s'
                            }}
                        >
                            <Flame size={13} /> Top Endpoints ({topEndpoints.length})
                        </button>
                        <button
                            onClick={() => setGraphMode('velocity')}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '7px',
                                fontSize: '12px',
                                fontWeight: '800',
                                border: 'none',
                                background: graphMode === 'velocity' ? 'var(--primary)' : 'transparent',
                                color: graphMode === 'velocity' ? '#ffffff' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.15s'
                            }}
                        >
                            <TrendingUp size={13} /> Live Velocity Graph
                        </button>
                        <button
                            onClick={() => setGraphMode('methods')}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '7px',
                                fontSize: '12px',
                                fontWeight: '800',
                                border: 'none',
                                background: graphMode === 'methods' ? 'var(--primary)' : 'transparent',
                                color: graphMode === 'methods' ? '#ffffff' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.15s'
                            }}
                        >
                            <Layers size={13} /> Method Breakdown
                        </button>
                    </div>
                </div>

                {/* GRAPH VIEW 1: TOP API ENDPOINTS RANK LIST */}
                {graphMode === 'endpoints' && (
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
                                            overflow: 'hidden',
                                            transition: 'all 0.15s ease'
                                        }}
                                        className="hover-card"
                                    >
                                        {/* Background Progress Bar Fill */}
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

                                        {/* Left Endpoint Info */}
                                        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                                            <span style={{
                                                fontSize: '11px',
                                                fontWeight: '900',
                                                color: 'var(--text-dim)',
                                                width: '20px',
                                                textAlign: 'center'
                                            }}>
                                                #{idx + 1}
                                            </span>

                                            <span style={{
                                                fontSize: '10px',
                                                fontWeight: '900',
                                                padding: '2px 7px',
                                                borderRadius: '4px',
                                                background: 'var(--bg-surface-0)',
                                                border: `1px solid ${methodColor}`,
                                                color: methodColor,
                                                fontFamily: 'var(--font-mono)'
                                            }}>
                                                {ep.primaryMethod}
                                            </span>

                                            <span style={{
                                                fontSize: '13px',
                                                fontWeight: '700',
                                                color: 'var(--text-primary)',
                                                fontFamily: 'var(--font-mono)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {ep.path}
                                            </span>
                                        </div>

                                        {/* Right Analytics Metrics */}
                                        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px' }}>
                                            {/* Hit Count & Share */}
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontWeight: '900', color: 'var(--text-primary)' }}>
                                                    {ep.count.toLocaleString()} <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>reqs</span>
                                                </div>
                                                <div style={{ fontSize: '10.5px', color: 'var(--primary)', fontWeight: '700' }}>
                                                    {ep.percentage}% share
                                                </div>
                                            </div>

                                            {/* Latency Badge */}
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '3px 8px',
                                                borderRadius: '6px',
                                                background: 'var(--bg-surface-0)',
                                                border: '1px solid var(--border-subtle)',
                                                fontSize: '11px',
                                                fontWeight: '700',
                                                color: ep.avgDuration > 50 ? 'var(--accent-gold)' : 'var(--text-secondary)'
                                            }}>
                                                <Clock size={12} />
                                                <span>{ep.avgDuration}ms</span>
                                            </div>

                                            {/* Error Rate */}
                                            <div style={{
                                                fontSize: '11px',
                                                fontWeight: '800',
                                                color: ep.errorRate > 0 ? '#f43f5e' : '#10b981',
                                                padding: '3px 8px',
                                                borderRadius: '6px',
                                                background: ep.errorRate > 0 ? 'rgba(244, 63, 94, 0.1)' : 'rgba(16, 185, 129, 0.1)'
                                            }}>
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

                {/* GRAPH VIEW 2: REAL-TIME VELOCITY SVG AREA CHART */}
                {graphMode === 'velocity' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ height: '180px', width: '100%', position: 'relative' }}>
                            <svg style={{ width: '100%', height: '100%', overflow: 'visible' }}>
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

                                {/* Grid Lines */}
                                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                                    <line
                                        key={i}
                                        x1="0"
                                        y1={`${ratio * 150 + 10}`}
                                        x2="100%"
                                        y2={`${ratio * 150 + 10}`}
                                        stroke="var(--border-subtle)"
                                        strokeDasharray="4 4"
                                    />
                                ))}

                                {/* Area Path & Line */}
                                {timeSeries.length > 1 && (() => {
                                    const width = 100 / (timeSeries.length - 1);
                                    const points = timeSeries.map((p, i) => {
                                        const x = i * width;
                                        const y = 160 - Math.min(150, ((p.requests || 0) / maxTimeSeriesReq) * 140);
                                        return `${x}%,${y}`;
                                    });

                                    const linePath = `M ${points[0]} ` + points.slice(1).map(p => `L ${p}`).join(' ');
                                    const areaPath = `${linePath} L 100%,160 L 0%,160 Z`;

                                    return (
                                        <>
                                            <path d={areaPath} fill="url(#trafficGradient)" />
                                            <path d={linePath} fill="none" stroke="url(#lineGradient)" strokeWidth="2.5" strokeLinecap="round" />
                                            {timeSeries.map((p, i) => {
                                                const x = `${i * width}%`;
                                                const y = 160 - Math.min(150, ((p.requests || 0) / maxTimeSeriesReq) * 140);
                                                return (
                                                    <circle
                                                        key={i}
                                                        cx={x}
                                                        cy={y}
                                                        r={p.requests > 0 ? "4" : "2"}
                                                        fill="var(--primary)"
                                                        stroke="#ffffff"
                                                        strokeWidth="1.5"
                                                    />
                                                );
                                            })}
                                        </>
                                    );
                                })()}
                            </svg>
                        </div>

                        {/* X-Axis Timeline Labels */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                            <span>{timeSeries[0]?.time || '00:00:00'}</span>
                            <span>Live Cluster Traffic Throughput (Rolling 5s Window)</span>
                            <span>{timeSeries[timeSeries.length - 1]?.time || 'Now'}</span>
                        </div>
                    </div>
                )}

                {/* GRAPH VIEW 3: HTTP METHODS BREAKDOWN */}
                {graphMode === 'methods' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Multi-segment Bar */}
                        <div style={{ display: 'flex', height: '24px', borderRadius: '8px', overflow: 'hidden', width: '100%', background: 'var(--bg-surface-2)' }}>
                            {Object.entries(methodDistribution).map(([method, count]) => {
                                const pct = (count / totalMethodCount) * 100;
                                if (pct <= 0) return null;
                                const color = method === 'GET' ? 'var(--accent-cyan)' : method === 'POST' ? 'var(--primary)' : method === 'DELETE' ? '#f43f5e' : method === 'PUT' ? '#f59e0b' : '#8b5cf6';
                                return (
                                    <div
                                        key={method}
                                        style={{
                                            width: `${pct}%`,
                                            background: color,
                                            transition: 'width 0.4s ease'
                                        }}
                                        title={`${method}: ${count} (${pct.toFixed(1)}%)`}
                                    />
                                );
                            })}
                        </div>

                        {/* Method Legend Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                            {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((m) => {
                                const count = methodDistribution[m] || 0;
                                const pct = ((count / totalMethodCount) * 100).toFixed(1);
                                const color = m === 'GET' ? 'var(--accent-cyan)' : m === 'POST' ? 'var(--primary)' : m === 'DELETE' ? '#f43f5e' : m === 'PUT' ? '#f59e0b' : '#8b5cf6';

                                return (
                                    <div
                                        key={m}
                                        style={{
                                            padding: '12px 14px',
                                            borderRadius: '10px',
                                            background: 'var(--bg-surface-2)',
                                            border: '1px solid var(--border-subtle)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '4px'
                                        }}
                                    >
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

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                <button
                    onClick={() => setActiveTab('stream')}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '10px',
                        background: activeTab === 'stream' ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                        border: `1px solid ${activeTab === 'stream' ? 'var(--primary)' : 'transparent'}`,
                        color: activeTab === 'stream' ? 'var(--primary)' : 'var(--text-secondary)',
                        fontWeight: '800',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <Terminal size={15} /> Live Request Feed ({filteredRequests.length})
                </button>
                <button
                    onClick={() => setActiveTab('sessions')}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '10px',
                        background: activeTab === 'sessions' ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                        border: `1px solid ${activeTab === 'sessions' ? 'var(--primary)' : 'transparent'}`,
                        color: activeTab === 'sessions' ? 'var(--primary)' : 'var(--text-secondary)',
                        fontWeight: '800',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <Users size={15} /> Active Connected Clients ({sessions.length})
                </button>
            </div>

            {/* TAB 1: LIVE REQUEST FEED */}
            {activeTab === 'stream' && (
                <div className="glass" style={{ padding: '20px', borderRadius: '18px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)', boxShadow: 'var(--shadow-md)' }}>
                    {/* Method Filter & Search Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px', maxWidth: '400px' }}>
                            <div style={{ position: 'relative', width: '100%' }}>
                                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                                <input
                                    type="text"
                                    placeholder="Filter by route, IP, user, status..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '7px 12px 7px 32px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-subtle)',
                                        background: 'var(--bg-surface-2)',
                                        color: 'var(--text-primary)',
                                        fontSize: '12px',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {/* Status Filter */}
                            <div style={{ display: 'flex', gap: '4px' }}>
                                {[
                                    { label: 'All Status', val: 'ALL' },
                                    { label: '2xx OK', val: '2xx' },
                                    { label: '4xx/5xx Err', val: '4xx/5xx' }
                                ].map(s => (
                                    <button
                                        key={s.val}
                                        onClick={() => setStatusFilter(s.val)}
                                        style={{
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            fontSize: '11px',
                                            fontWeight: '800',
                                            border: '1px solid var(--border-subtle)',
                                            background: statusFilter === s.val ? 'var(--primary)' : 'var(--bg-surface-2)',
                                            color: statusFilter === s.val ? '#ffffff' : 'var(--text-secondary)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>

                            {/* Verb Filters */}
                            <div style={{ display: 'flex', gap: '4px' }}>
                                {['ALL', 'GET', 'POST', 'PUT', 'DELETE'].map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setFilterMethod(m)}
                                        style={{
                                            padding: '4px 9px',
                                            borderRadius: '6px',
                                            fontSize: '11px',
                                            fontWeight: '800',
                                            border: '1px solid var(--border-subtle)',
                                            background: filterMethod === m ? 'var(--accent-cyan)' : 'var(--bg-surface-2)',
                                            color: filterMethod === m ? '#000000' : 'var(--text-primary)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>

                            {/* Clear Buffer */}
                            <button
                                onClick={handleClearBuffer}
                                className="btn-secondary"
                                style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}
                                title="Clear current stream feed"
                            >
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
                                const isServerErr = r.statusCode >= 500;

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
                                            cursor: 'pointer',
                                            transition: 'all 0.12s ease'
                                        }}
                                        className="hover-card"
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                                            {/* HTTP Method Badge */}
                                            <span style={{
                                                fontSize: '10px',
                                                fontWeight: '900',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                background: 'var(--bg-surface-0)',
                                                border: `1px solid ${methodColor}`,
                                                color: methodColor,
                                                fontFamily: 'var(--font-mono)'
                                            }}>
                                                {r.method}
                                            </span>

                                            {/* Status Code */}
                                            <span style={{
                                                fontSize: '11px',
                                                fontWeight: '800',
                                                color: statusColor,
                                                fontFamily: 'var(--font-mono)'
                                            }}>
                                                {r.statusCode}
                                            </span>

                                            {/* Route Path */}
                                            <span style={{
                                                fontSize: '12.5px',
                                                fontWeight: '700',
                                                color: 'var(--text-primary)',
                                                fontFamily: 'var(--font-mono)',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                maxWidth: '320px'
                                            }}>
                                                {r.path}
                                            </span>
                                        </div>

                                        {/* Client & Latency */}
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
            )}

            {/* TAB 2: ACTIVE SESSIONS & CONNECTED USERS */}
            {activeTab === 'sessions' && (
                <div className="glass" style={{ padding: '20px', borderRadius: '18px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)', boxShadow: 'var(--shadow-md)' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Users size={18} color="#10b981" /> Currently Active User & Guest Sessions ({sessions.length})
                    </h3>

                    {sessions.length === 0 ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
                            No active sessions detected.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {sessions.map((s) => (
                                <div
                                    key={s.id}
                                    style={{
                                        padding: '14px 18px',
                                        borderRadius: '12px',
                                        background: 'var(--bg-surface-2)',
                                        border: '1px solid var(--border-subtle)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        flexWrap: 'wrap',
                                        gap: '12px'
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{s.username}</strong>
                                            <span style={{
                                                fontSize: '10px',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                background: s.role?.toLowerCase() === 'admin' ? 'rgba(99, 102, 241, 0.15)' : s.role === 'Agent' ? 'rgba(14, 165, 233, 0.15)' : 'var(--bg-surface-0)',
                                                color: s.role?.toLowerCase() === 'admin' ? 'var(--primary)' : s.role === 'Agent' ? '#0ea5e9' : 'var(--text-secondary)',
                                                fontWeight: '800',
                                                textTransform: 'uppercase'
                                            }}>
                                                {s.role === 'Agent' ? '🤖 Cluster Agent' : s.role}
                                            </span>
                                            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                                                IP: {s.ip}
                                            </span>
                                        </div>

                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span>Device: {s.client?.browser} on {s.client?.os}</span>
                                            <span>•</span>
                                            <span>Last Action: <code style={{ color: 'var(--primary)' }}>{s.currentAction}</code></span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={() => handleKillSession(s.id, s.username)}
                                            className="btn-secondary"
                                            style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', color: '#f43f5e' }}
                                        >
                                            Disconnect
                                        </button>
                                        <button
                                            onClick={() => setIpToBan(s.ip)}
                                            className="btn-danger"
                                            style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '800' }}
                                        >
                                            Ban IP
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 🌟 ANIMATED MODAL 1: ENDPOINT DEEP-DIVE INSPECTOR */}
            <AnimatePresence>
                {selectedEndpoint && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
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
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                        <span style={{
                                            fontSize: '11px',
                                            fontWeight: '900',
                                            padding: '2px 8px',
                                            borderRadius: '5px',
                                            background: 'var(--primary)',
                                            color: '#ffffff',
                                            fontFamily: 'var(--font-mono)'
                                        }}>
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

                                <button
                                    onClick={() => setSelectedEndpoint(null)}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Metrics Grid */}
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

                            {/* Data Bandwidth & Verbs */}
                            <div style={{ padding: '14px', borderRadius: '14px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '12px' }}>
                                    <span style={{ fontWeight: '700', color: 'var(--text-secondary)' }}>HTTP Verbs Supported:</span>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--text-primary)' }}>
                                        {Object.entries(selectedEndpoint.methods).map(([m, c]) => `${m} (${c})`).join(', ')}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '12px' }}>
                                    <span style={{ fontWeight: '700', color: 'var(--text-secondary)' }}>Payload Transferred:</span>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--text-primary)' }}>
                                        {formatBytes(selectedEndpoint.bytesIn)} In / {formatBytes(selectedEndpoint.bytesOut)} Out
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                    <span style={{ fontWeight: '700', color: 'var(--text-secondary)' }}>Unique Client IP Sources:</span>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--text-primary)' }}>
                                        {selectedEndpoint.uniqueClients} Active Hosts
                                    </span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => {
                                        setSearchQuery(selectedEndpoint.path);
                                        setActiveTab('stream');
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

            {/* 🌟 ANIMATED MODAL 2: PACKET / REQUEST DETAILS INSPECTOR */}
            <AnimatePresence>
                {selectedRequest && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
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
                                        <span style={{
                                            fontSize: '11px',
                                            fontWeight: '900',
                                            padding: '2px 8px',
                                            borderRadius: '5px',
                                            background: 'var(--primary)',
                                            color: '#ffffff',
                                            fontFamily: 'var(--font-mono)'
                                        }}>
                                            {selectedRequest.method}
                                        </span>
                                        <span style={{
                                            fontSize: '12px',
                                            fontWeight: '800',
                                            color: selectedRequest.statusCode < 400 ? '#10b981' : '#f43f5e',
                                            fontFamily: 'var(--font-mono)'
                                        }}>
                                            {selectedRequest.statusCode}
                                        </span>
                                    </div>
                                    <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                                        {selectedRequest.path}
                                    </h3>
                                </div>

                                <button
                                    onClick={() => setSelectedRequest(null)}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Details Table */}
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
                                    <span style={{ color: 'var(--text-secondary)' }}>Client Fingerprint:</span>
                                    <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                                        {selectedRequest.client?.browser} on {selectedRequest.client?.os} ({selectedRequest.client?.type})
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Payload Transferred:</span>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--text-primary)' }}>
                                        {formatBytes(selectedRequest.sizeIn)} in / {formatBytes(selectedRequest.sizeOut)} out
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Captured At:</span>
                                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                                        {new Date(selectedRequest.timestamp).toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* Modal Actions */}
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
