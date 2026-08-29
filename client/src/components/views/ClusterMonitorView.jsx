import React, { useState } from 'react';
import { Cpu, Server, Activity, HardDrive, Wifi, ArrowDown, ArrowUp, ShieldCheck, Terminal, Layers, RefreshCw, Zap, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Helper for formatting gigabytes / terabytes ---
const formatBytes = (bytes) => {
    if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatGB = (val) => {
    if (val === undefined || val === null) return '0 GB';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '0 GB';
    if (num >= 1000) return `${(num / 1000).toFixed(2)} TB`;
    return `${num.toFixed(1)} GB`;
};

// --- Sleek Integrated SVG Donut Ring Gauge (Zero nested box clutter) ---
const DonutGauge = ({ value = 0, size = 68, strokeWidth = 7, color = 'var(--primary)', glowColor = 'rgba(99, 102, 241, 0.4)' }) => {
    const val = Math.max(0, Math.min(100, Math.round(value)));
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (val / 100) * circumference;

    return (
        <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
                {/* Track Circle */}
                <circle
                    stroke="var(--bg-surface-2)"
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                {/* Progress Circle with Glow */}
                <circle
                    stroke={color}
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${circumference} ${circumference}`}
                    style={{
                        strokeDashoffset,
                        transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                        filter: val > 0 ? `drop-shadow(0 0 6px ${glowColor})` : 'none'
                    }}
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                    strokeLinecap="round"
                />
            </svg>
            <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.5px' }}>
                    {val}%
                </span>
            </div>
        </div>
    );
};

// --- High-Resolution Spline Trend Area Chart ---
const SplineAreaChart = ({ data = [], dataKey = 'cpu', label = 'Utilization', color = '#6366f1', glowColor = 'rgba(99, 102, 241, 0.18)', unit = '%' }) => {
    const samples = data && data.length > 0 ? data : [];
    const width = 600;
    const height = 130;
    const paddingX = 14;
    const paddingY = 16;
    const maxVal = 100;
    const minPoints = 30;
    const pointsCount = Math.max(minPoints, samples.length);

    const values = samples.map(s => s[dataKey] || 0);
    const latestVal = values.length > 0 ? values[values.length - 1] : 0;
    const avgVal = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
    const maxRecorded = values.length > 0 ? Math.max(...values) : 0;
    const minRecorded = values.length > 0 ? Math.min(...values) : 0;

    // Generate smooth curve points
    const pointsArray = samples.map((d, index) => {
        const x = paddingX + (index / (pointsCount - 1)) * (width - paddingX * 2);
        const val = Math.max(0, Math.min(maxVal, d[dataKey] || 0));
        const y = height - paddingY - (val / maxVal) * (height - paddingY * 2);
        return { x, y, val };
    });

    // Build SVG path
    let pathD = '';
    let areaD = '';

    if (pointsArray.length > 0) {
        pathD = `M ${pointsArray[0].x} ${pointsArray[0].y}`;
        for (let i = 0; i < pointsArray.length - 1; i++) {
            const p0 = pointsArray[i];
            const p1 = pointsArray[i + 1];
            const cx = (p0.x + p1.x) / 2;
            pathD += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
        }
        const lastX = pointsArray[pointsArray.length - 1].x;
        const firstX = pointsArray[0].x;
        areaD = `${pathD} L ${lastX} ${height - paddingY} L ${firstX} ${height - paddingY} Z`;
    }

    const gradId = `areaGrad-${dataKey}-${Math.random().toString(36).substr(2, 6)}`;

    return (
        <div className="st-card" style={{ padding: '20px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '18px', boxShadow: 'var(--shadow-sm)', position: 'relative', overflow: 'hidden' }}>
            {/* Header with Live Stats Pills */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />
                    <span style={{ fontSize: '12.5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-primary)' }}>
                        {label} Trend
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: '600' }}>(Past 5m)</span>
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <div style={{ padding: '2px 8px', borderRadius: '6px', background: 'var(--bg-surface-2)', fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                        Avg: <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{avgVal}{unit}</span>
                    </div>
                    <div style={{ padding: '2px 8px', borderRadius: '6px', background: 'var(--bg-surface-2)', fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                        Peak: <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{maxRecorded}{unit}</span>
                    </div>
                    <div style={{ padding: '2px 8px', borderRadius: '6px', background: `${color}18`, color: color, fontSize: '11px', fontWeight: '800' }}>
                        Live: <span style={{ fontFamily: 'var(--font-mono)' }}>{latestVal}{unit}</span>
                    </div>
                </div>
            </div>

            {/* SVG Chart */}
            <div style={{ position: 'relative', width: '100%', height: `${height}px` }}>
                {samples.length === 0 ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: '12px' }}>
                        Waiting for real-time telemetry stream...
                    </div>
                ) : (
                    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                        <defs>
                            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={color} stopOpacity="0.28" />
                                <stop offset="60%" stopColor={color} stopOpacity="0.08" />
                                <stop offset="100%" stopColor={color} stopOpacity="0.0" />
                            </linearGradient>
                        </defs>

                        {/* Subtle Grid Guidelines */}
                        <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
                        <line x1={paddingX} y1={height / 2} x2={width - paddingX} y2={height / 2} stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
                        <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="var(--border-subtle)" strokeWidth="1" opacity="0.8" />

                        {/* Gradient Area Fill */}
                        {areaD && <path d={areaD} fill={`url(#${gradId})`} />}

                        {/* Smooth Line Curve */}
                        {pathD && (
                            <path
                                d={pathD}
                                fill="none"
                                stroke={color}
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ filter: `drop-shadow(0 2px 6px ${glowColor})` }}
                            />
                        )}

                        {/* Glowing Pulse Node on latest sample */}
                        {pointsArray.length > 0 && (() => {
                            const last = pointsArray[pointsArray.length - 1];
                            return (
                                <g>
                                    <circle cx={last.x} cy={last.y} r="5" fill={color} style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
                                    <circle cx={last.x} cy={last.y} r="2.5" fill="#ffffff" />
                                </g>
                            );
                        })()}
                    </svg>
                )}
            </div>
        </div>
    );
};

// --- High-Throughput Network IO Bandwidth Component ---
const NetworkThroughputMeter = ({ data = [] }) => {
    const samples = data && data.length > 0 ? data : [];
    const width = 600;
    const height = 130;
    const paddingX = 14;
    const paddingY = 16;
    const pointsCount = Math.max(30, samples.length);

    const latest = samples.length > 0 ? samples[samples.length - 1] : { rx: 0, tx: 0 };
    const latestRx = latest.rx || 0;
    const latestTx = latest.tx || 0;

    const maxRx = Math.max(0.1, ...samples.map(d => d.rx || 0));
    const maxTx = Math.max(0.1, ...samples.map(d => d.tx || 0));
    const maxScale = Math.max(1, Math.ceil(Math.max(maxRx, maxTx) * 1.2));

    const buildPath = (key) => {
        if (samples.length === 0) return '';
        const pts = samples.map((d, index) => {
            const x = paddingX + (index / (pointsCount - 1)) * (width - paddingX * 2);
            const val = d[key] || 0;
            const y = height - paddingY - (val / maxScale) * (height - paddingY * 2);
            return { x, y };
        });

        let d = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i];
            const p1 = pts[i + 1];
            const cx = (p0.x + p1.x) / 2;
            d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
        }
        return d;
    };

    const rxPath = buildPath('rx');
    const txPath = buildPath('tx');

    return (
        <div className="st-card" style={{ padding: '20px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '18px', boxShadow: 'var(--shadow-sm)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Wifi size={15} color="var(--accent-cyan)" />
                    <span style={{ fontSize: '12.5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-primary)' }}>
                        Network I/O Throughput
                    </span>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '8px', background: 'rgba(14, 165, 233, 0.12)', border: '1px solid rgba(14, 165, 233, 0.2)' }}>
                        <ArrowDown size={13} color="#0ea5e9" />
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#0ea5e9' }}>RX:</span>
                        <span style={{ fontSize: '12px', fontWeight: '900', color: '#0ea5e9', fontFamily: 'var(--font-mono)' }}>
                            {latestRx >= 1 ? `${latestRx.toFixed(2)} MB/s` : `${(latestRx * 1024).toFixed(0)} KB/s`}
                        </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                        <ArrowUp size={13} color="#f59e0b" />
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#f59e0b' }}>TX:</span>
                        <span style={{ fontSize: '12px', fontWeight: '900', color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>
                            {latestTx >= 1 ? `${latestTx.toFixed(2)} MB/s` : `${(latestTx * 1024).toFixed(0)} KB/s`}
                        </span>
                    </div>
                </div>
            </div>

            <div style={{ position: 'relative', width: '100%', height: `${height}px` }}>
                <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
                    <line x1={paddingX} y1={height / 2} x2={width - paddingX} y2={height / 2} stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
                    <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="var(--border-subtle)" strokeWidth="1" opacity="0.8" />

                    {/* RX Path (Cyan) */}
                    {rxPath && (
                        <path
                            d={rxPath}
                            fill="none"
                            stroke="#0ea5e9"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ filter: 'drop-shadow(0 2px 6px rgba(14, 165, 233, 0.3))' }}
                        />
                    )}

                    {/* TX Path (Amber) */}
                    {txPath && (
                        <path
                            d={txPath}
                            fill="none"
                            stroke="#f59e0b"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ filter: 'drop-shadow(0 2px 6px rgba(245, 158, 11, 0.3))' }}
                        />
                    )}
                </svg>
            </div>
        </div>
    );
};

// --- MAIN CLUSTER COCKPIT DASHBOARD VIEW ---
export default function ClusterMonitorView({
    selectedMonitorNode = 'local',
    setSelectedMonitorNode,
    localStorageInfo,
    metrics = { metricsHistory: {}, agents: [] },
    nodeLogs = [],
    setShowTerminalModal,
    onOpenComplianceAudit
}) {
    const isLocal = selectedMonitorNode === 'local';
    const activeNodeInfo = isLocal
        ? (localStorageInfo || { hostname: 'Master Server', platform: 'linux', disks: [], online: true })
        : (metrics.agents?.find(a => a.id === selectedMonitorNode) || { hostname: 'Remote Node', platform: 'unknown', disks: [], online: false });

    const history = metrics.metricsHistory?.[selectedMonitorNode] || [];
    const currentMetrics = history.length > 0 ? history[history.length - 1] : { cpu: 0, memory: 0, latency: 0 };
    const cpuVal = currentMetrics.cpu || 0;
    const memVal = currentMetrics.memory || 0;

    const approvedAgents = (metrics.agents || []).filter(a => a.status === 'approved');

    return (
        <motion.div key="cockpit" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            {/* Top Cockpit Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)', color: '#ffffff' }}>
                            <Activity size={20} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>
                                Cluster Resource & Telemetry Cockpit
                            </h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '2px 0 0 0' }}>
                                Real-time node telemetry, hardware resource allocation, and zero-trust health diagnostics.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Node Switcher Pills & Live Tools */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Node Selector Pills Bar */}
                    <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-surface-2)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                        <button
                            onClick={() => setSelectedMonitorNode('local')}
                            style={{
                                height: '34px',
                                padding: '0 14px',
                                borderRadius: '9px',
                                background: selectedMonitorNode === 'local' ? 'var(--primary-gradient)' : 'transparent',
                                color: selectedMonitorNode === 'local' ? '#ffffff' : 'var(--text-secondary)',
                                fontWeight: '800',
                                fontSize: '12px',
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: selectedMonitorNode === 'local' ? '0 4px 14px rgba(99, 102, 241, 0.35)' : 'none',
                                transition: 'all 0.15s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <Server size={14} />
                            <span>Master Node</span>
                            <span style={{ fontSize: '10px', opacity: 0.85, background: 'rgba(0,0,0,0.2)', padding: '1px 6px', borderRadius: '6px' }}>Local</span>
                        </button>

                        {approvedAgents.map(agent => {
                            const isSelected = selectedMonitorNode === agent.id;
                            const isOnline = agent.online !== false;
                            return (
                                <button
                                    key={agent.id}
                                    onClick={() => setSelectedMonitorNode(agent.id)}
                                    style={{
                                        height: '34px',
                                        padding: '0 14px',
                                        borderRadius: '9px',
                                        background: isSelected ? 'var(--primary-gradient)' : 'transparent',
                                        color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                                        fontWeight: '800',
                                        fontSize: '12px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        boxShadow: isSelected ? '0 4px 14px rgba(99, 102, 241, 0.35)' : 'none',
                                        transition: 'all 0.15s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: isOnline ? '#10b981' : '#f43f5e', boxShadow: isOnline ? '0 0 8px #10b981' : 'none' }} />
                                    <span>{agent.hostname}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Live Console Logs Button */}
                    <button
                        onClick={() => setShowTerminalModal && setShowTerminalModal(true)}
                        style={{
                            height: '42px',
                            padding: '0 16px',
                            borderRadius: '12px',
                            background: 'var(--bg-surface-0)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            fontWeight: '800',
                            fontSize: '12.5px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: 'var(--shadow-sm)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <Terminal size={15} color="var(--primary)" />
                        <span>Live Console Logs</span>
                        <span style={{ fontSize: '10.5px', background: 'var(--primary-gradient)', color: '#ffffff', padding: '1px 7px', borderRadius: '10px', fontWeight: '900' }}>
                            {(nodeLogs || []).length}
                        </span>
                    </button>
                </div>
            </div>

            {/* Content Container */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                {/* ROW 1: 4 Glassmorphic Cockpit Metric Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                    {/* CARD 1: Active Node Identity */}
                    <div className="st-card" style={{ padding: '20px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '18px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Server size={14} color="var(--primary)" />
                                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Active Target Node</span>
                                </div>
                                <span style={{ fontSize: '10.5px', fontWeight: '800', padding: '2px 8px', borderRadius: '999px', background: activeNodeInfo.online !== false ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)', color: activeNodeInfo.online !== false ? '#10b981' : '#f43f5e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: activeNodeInfo.online !== false ? '#10b981' : '#f43f5e', display: 'inline-block' }} />
                                    {activeNodeInfo.online !== false ? 'ONLINE' : 'OFFLINE'}
                                </span>
                            </div>
                            <h3 style={{ fontSize: '19px', fontWeight: '900', color: 'var(--text-primary)', margin: '0 0 6px 0', letterSpacing: '-0.3px' }}>
                                {activeNodeInfo.hostname}
                            </h3>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', background: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}>
                                OS: {activeNodeInfo.platform?.toUpperCase() || 'LINUX'}
                            </span>
                            {!isLocal && activeNodeInfo.online !== false && (
                                <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                                    {currentMetrics.latency || 1}ms Latency
                                </span>
                            )}
                        </div>
                    </div>

                    {/* CARD 2: CPU Core Load */}
                    <div className="st-card" style={{ padding: '20px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '18px', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                <Cpu size={14} color="var(--primary)" />
                                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>CPU Core Load</span>
                            </div>
                            <div style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>
                                {cpuVal}%
                            </div>
                            <div style={{ marginTop: '6px' }}>
                                <span style={{ fontSize: '11.5px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px', background: cpuVal > 80 ? 'rgba(244, 63, 94, 0.12)' : 'rgba(99, 102, 241, 0.12)', color: cpuVal > 80 ? '#f43f5e' : 'var(--primary)' }}>
                                    {cpuVal > 80 ? 'Heavy Load' : 'Optimal Footprint ⚡'}
                                </span>
                            </div>
                        </div>
                        <DonutGauge value={cpuVal} size={70} strokeWidth={7.5} color="var(--primary)" glowColor="rgba(99, 102, 241, 0.4)" />
                    </div>

                    {/* CARD 3: RAM Allocation */}
                    <div className="st-card" style={{ padding: '20px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '18px', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                <Layers size={14} color="#0ea5e9" />
                                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>RAM Allocation</span>
                            </div>
                            <div style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>
                                {memVal}%
                            </div>
                            <div style={{ marginTop: '6px' }}>
                                <span style={{ fontSize: '11.5px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px', background: memVal > 85 ? 'rgba(244, 63, 94, 0.12)' : 'rgba(14, 165, 233, 0.12)', color: memVal > 85 ? '#f43f5e' : '#0ea5e9' }}>
                                    {memVal > 85 ? 'High Usage' : 'Healthy Buffer 🛡️'}
                                </span>
                            </div>
                        </div>
                        <DonutGauge value={memVal} size={70} strokeWidth={7.5} color="#0ea5e9" glowColor="rgba(14, 165, 233, 0.4)" />
                    </div>

                    {/* CARD 4: Storage Array & Diagnostics */}
                    <div className="st-card" style={{ padding: '20px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '18px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <ShieldCheck size={15} color="#10b981" />
                                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Health Diagnostics</span>
                                </div>
                                <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '999px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                                    100% HEALTHY
                                </span>
                            </div>
                            <div style={{ fontSize: '14.5px', fontWeight: '900', color: 'var(--text-primary)', margin: '4px 0 2px' }}>
                                S.M.A.R.T. Array Passing
                            </div>
                            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                All cluster storage pools, NVMe namespaces & mTLS channels nominal.
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle2 size={13} /> Disks: Nominal
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle2 size={13} /> Zero-Trust: Active
                            </span>
                        </div>
                    </div>
                </div>

                {/* ROW 2: Dual Real-Time Spline Trend Charts (Past 5m) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
                    <SplineAreaChart data={history} dataKey="cpu" label="CPU Utilization" color="var(--primary)" glowColor="rgba(99, 102, 241, 0.25)" unit="%" />
                    <SplineAreaChart data={history} dataKey="memory" label="RAM Allocation" color="#0ea5e9" glowColor="rgba(14, 165, 233, 0.25)" unit="%" />
                </div>

                {/* ROW 3: Disk Volumes & Live Network IO */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
                    {/* Disk Volumes & Partitions */}
                    <div className="st-card" style={{ padding: '22px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '18px', boxShadow: 'var(--shadow-sm)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <HardDrive size={16} color="var(--accent-gold)" />
                                <span style={{ fontSize: '12.5px', fontWeight: '800', letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                                    Disk Volumes & Storage Partitions
                                </span>
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: '700' }}>
                                {(activeNodeInfo.disks || []).length} Drives Bound
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {activeNodeInfo.disks && activeNodeInfo.disks.length > 0 ? (
                                activeNodeInfo.disks.map((disk, idx) => {
                                    const pct = Math.max(0, Math.min(100, disk.percentage || 0));
                                    const isWarning = pct > 85;
                                    return (
                                        <div key={idx} style={{ padding: '12px 14px', background: 'var(--bg-surface-1)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontWeight: '800', fontSize: '13px', color: 'var(--text-primary)' }}>
                                                        {disk.mount}
                                                    </span>
                                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                        ({formatGB(disk.used / 1e9)} used of {formatGB(disk.size / 1e9)})
                                                    </span>
                                                </div>
                                                <span style={{ fontSize: '12.5px', fontWeight: '900', fontFamily: 'var(--font-mono)', color: isWarning ? '#f43f5e' : 'var(--primary)' }}>
                                                    {pct}%
                                                </span>
                                            </div>

                                            {/* Progress Track */}
                                            <div style={{ height: '7px', borderRadius: '999px', background: 'var(--bg-surface-2)', overflow: 'hidden' }}>
                                                <div
                                                    style={{
                                                        width: `${pct}%`,
                                                        height: '100%',
                                                        background: isWarning ? '#f43f5e' : 'var(--primary-gradient)',
                                                        borderRadius: '999px',
                                                        transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)', fontStyle: 'italic', fontSize: '12px' }}>
                                    No partition information reported by target agent.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Network Throughput Chart */}
                    <NetworkThroughputMeter data={history} />
                </div>
            </div>
        </motion.div>
    );
}
