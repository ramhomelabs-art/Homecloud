import React, { useState } from 'react';
import { 
    Cpu, Server, HardDrive, Globe, Activity, RefreshCw, 
    ShieldCheck, Zap, Radio, ArrowUpRight, ArrowDownRight, 
    Layers, Disc, CheckCircle2, AlertTriangle, Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Formatting helpers
const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatGB = (gbVal) => {
    if (gbVal === undefined || gbVal === null || isNaN(gbVal)) return '0.0 GB';
    if (gbVal >= 999.9) return `${(gbVal / 1024).toFixed(1)} TB`;
    return `${gbVal.toFixed(1)} GB`;
};

// Cyber Circular Radial Gauge Component
const CyberRadialGauge = ({ 
    label, 
    sublabel, 
    value, 
    unit = '%', 
    colorGradient = ['#00f2ff', '#0072ff'], 
    glowColor = 'rgba(0, 242, 255, 0.25)', 
    statusText,
    icon: Icon 
}) => {
    const clamped = Math.min(100, Math.max(0, value || 0));
    const radius = 38;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (circumference * (clamped / 100));
    const gradientId = `grad-${label.replace(/\s+/g, '-').toLowerCase()}`;

    return (
        <motion.div 
            className="st-card shadow-premium" 
            whileHover={{ scale: 1.02, y: -2, boxShadow: `0 8px 30px ${glowColor}` }} 
            transition={{ duration: 0.25 }}
            style={{ 
                background: 'var(--bg-surface-1)', 
                backdropFilter: 'blur(24px)',
                border: '1px solid var(--border-subtle)', 
                borderRadius: '16px', 
                padding: '18px 20px', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {/* Top Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {Icon && (
                        <div style={{ 
                            width: '28px', 
                            height: '28px', 
                            borderRadius: '8px', 
                            background: `linear-gradient(135deg, ${colorGradient[0]}22, ${colorGradient[1]}11)`, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            border: `1px solid ${colorGradient[0]}33`
                        }}>
                            <Icon size={14} color={colorGradient[0]} />
                        </div>
                    )}
                    <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-secondary)' }}>
                        {label}
                    </span>
                </div>
                {statusText && (
                    <span style={{ 
                        fontSize: '9.5px', 
                        fontWeight: '800', 
                        padding: '2px 7px', 
                        borderRadius: '6px', 
                        background: clamped > 85 ? 'rgba(248, 81, 73, 0.15)' : `${colorGradient[0]}18`, 
                        color: clamped > 85 ? '#f85149' : colorGradient[0],
                        border: `1px solid ${clamped > 85 ? '#f8514933' : colorGradient[0] + '33'}`
                    }}>
                        {statusText}
                    </span>
                )}
            </div>

            {/* Gauge Dial */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', margin: '6px 0' }}>
                <svg width="104" height="104" viewBox="0 0 104 104" style={{ transform: 'rotate(-90deg)' }}>
                    <defs>
                        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor={colorGradient[0]} />
                            <stop offset="100%" stopColor={colorGradient[1]} />
                        </linearGradient>
                        <filter id={`glow-${gradientId}`}>
                            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                            <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                    </defs>
                    
                    {/* Background Track */}
                    <circle 
                        cx="52" 
                        cy="52" 
                        r={radius} 
                        fill="transparent" 
                        stroke="rgba(255, 255, 255, 0.05)" 
                        strokeWidth="7" 
                    />
                    
                    {/* Progress Track */}
                    <motion.circle 
                        cx="52" 
                        cy="52" 
                        r={radius} 
                        fill="transparent" 
                        stroke={`url(#${gradientId})`} 
                        strokeWidth="7" 
                        strokeDasharray={circumference}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                        strokeLinecap="round"
                        filter={`url(#glow-${gradientId})`}
                    />
                </svg>

                {/* Inner Centered Value */}
                <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                    <span style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                        {clamped}
                        <span style={{ fontSize: '11px', fontWeight: '700', color: colorGradient[0], marginLeft: '1px' }}>{unit}</span>
                    </span>
                </div>
            </div>

            {/* Bottom Subtitle */}
            <div style={{ textAlign: 'center', fontSize: '10.5px', fontWeight: '600', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {sublabel}
            </div>
        </motion.div>
    );
};

export default function ClusterCockpitView({
    filteredNodes = [],
    stats = { total: 0, used: 0 },
    nodeFilter = 'all',
    setNodeFilter,
    filterText,
    setFilterText,
    activeOps = [],
    activityHistory = [],
    activities = [],
    setActivityHistory,
    localStorageInfo,
    agentStorage = [],
    networkShares = [],
    metrics = {},
    fetchAllData,
    showToast,
    navigateTo
}) {
    const [chartMode, setChartMode] = useState('network'); // 'network' or 'disk'
    const [hoveredDataPoint, setHoveredDataPoint] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Calculate cluster averages
    const onlineApprovedNodes = filteredNodes.filter(n => n.online && n.status === 'approved');
    const avgCpu = onlineApprovedNodes.length > 0
        ? Math.round(onlineApprovedNodes.reduce((sum, n) => sum + (n.cpu || 0), 0) / onlineApprovedNodes.length)
        : 0;
    const avgMemory = onlineApprovedNodes.length > 0
        ? Math.round(onlineApprovedNodes.reduce((sum, n) => sum + (n.memory || 0), 0) / onlineApprovedNodes.length)
        : 0;

    const totalPercentage = stats.total > 0 ? Math.round((stats.used / stats.total) * 100) : 0;

    // Refresh Telemetry
    const handleRefresh = async () => {
        setIsRefreshing(true);
        if (fetchAllData) await fetchAllData();
        setIsRefreshing(false);
        if (showToast) showToast('Telemetry metrics updated in real-time', 'success');
    };

    // Telemetry Wave History Data
    const localHistory = metrics.metricsHistory?.local || [];
    const netHistory = localHistory.length > 0
        ? localHistory.map(entry => ({ rx: entry.rx || 0.0, tx: entry.tx || 0.0, timestamp: entry.timestamp }))
        : Array.from({ length: 30 }, (_, i) => ({ rx: 0.0, tx: 0.0, timestamp: Date.now() - (29 - i) * 2000 }));

    const rawNetMax = Math.max(...netHistory.map(d => Math.max(d.rx, d.tx)), 1.0);
    const netMaxVal = rawNetMax > 20 ? Math.ceil(rawNetMax / 10) * 10 : (rawNetMax > 5 ? Math.ceil(rawNetMax / 5) * 5 : 5);

    const svgWidth = 600;
    const svgHeight = 130;
    const padTop = 15;
    const padBot = 15;
    const chartHeight = svgHeight - padTop - padBot;
    const divisor = Math.max(1, netHistory.length - 1);

    // SVG Points
    const rxPoints = netHistory.map((d, i) => {
        const x = (i / divisor) * svgWidth;
        const y = svgHeight - padBot - ((d.rx || 0) / netMaxVal) * chartHeight;
        return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : svgHeight - padBot, val: d.rx, d };
    });

    const txPoints = netHistory.map((d, i) => {
        const x = (i / divisor) * svgWidth;
        const y = svgHeight - padBot - ((d.tx || 0) / netMaxVal) * chartHeight;
        return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : svgHeight - padBot, val: d.tx, d };
    });

    // Smooth Bezier Curve Path Generator
    const createSmoothPath = (pts) => {
        if (pts.length === 0) return '';
        let path = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i];
            const p1 = pts[i + 1];
            const mx = (p0.x + p1.x) / 2;
            path += ` C ${mx.toFixed(1)},${p0.y.toFixed(1)} ${mx.toFixed(1)},${p1.y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
        }
        return path;
    };

    const rxLine = createSmoothPath(rxPoints);
    const rxArea = `${rxLine} L ${svgWidth},${svgHeight - padBot} L 0,${svgHeight - padBot} Z`;
    
    const txLine = createSmoothPath(txPoints);
    const txArea = `${txLine} L ${svgWidth},${svgHeight - padBot} L 0,${svgHeight - padBot} Z`;

    // Compile all mounted volumes
    const mounts = [];
    if (localStorageInfo && localStorageInfo.disks) {
        localStorageInfo.disks.forEach(d => {
            mounts.push({
                id: `local-${d.mount}`,
                name: d.mount,
                label: d.mount === 'C:\\' || d.mount === '/' ? 'System Root (/)' : (d.label || `Storage (${d.mount})`),
                nodeName: 'Debian Primary Host',
                type: 'Local Partition',
                size: d.size || 0,
                used: d.used || 0,
                free: d.free || Math.max(0, (d.size || 0) - (d.used || 0)),
                percentage: d.percentage || (d.size > 0 ? Math.round((d.used / d.size) * 100) : 0),
                online: true,
                themeColor: '#00f2ff'
            });
        });
    }

    agentStorage.forEach(agent => {
        if (agent.disks && agent.online) {
            agent.disks.forEach(d => {
                mounts.push({
                    id: `agent-${agent.id}-${d.mount}`,
                    name: d.mount,
                    label: `Agent Disk: ${d.mount}`,
                    nodeName: agent.hostname || 'Remote Node',
                    type: 'Fleet Remote Agent',
                    size: d.size || (d.used + d.free) || 0,
                    used: d.used || 0,
                    free: d.free || Math.max(0, (d.size || 0) - (d.used || 0)),
                    percentage: d.percentage || (d.size > 0 ? Math.round((d.used / d.size) * 100) : 0),
                    online: agent.online,
                    themeColor: '#f2c94c'
                });
            });
        }
    });

    networkShares.forEach(ns => {
        mounts.push({
            id: `net-${ns.id || ns.label}`,
            name: ns.path,
            label: ns.label,
            nodeName: `${ns.type || 'SMB'} Network Share`,
            type: 'Cloud / Network Mount',
            size: ns.size || 0,
            used: ns.used || 0,
            free: Math.max(0, (ns.size || 0) - (ns.used || 0)),
            percentage: ns.size > 0 ? Math.round((ns.used / ns.size) * 100) : 0,
            online: ns.online !== false,
            themeColor: '#10b981'
        });
    });

    const grandTotalCapacity = mounts.reduce((sum, m) => sum + m.size, 0);
    const grandTotalUsed = mounts.reduce((sum, m) => sum + m.used, 0);
    const grandTotalFree = Math.max(0, grandTotalCapacity - grandTotalUsed);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
        >
            {/* Cockpit Top Header & Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '900', letterSpacing: '-0.6px', color: 'var(--text-primary)' }}>
                            Cluster Resource & Telemetry Cockpit
                        </h2>
                        <span style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '5px', 
                            fontSize: '10.5px', 
                            fontWeight: '800', 
                            background: 'rgba(16, 185, 129, 0.12)', 
                            color: '#10b981', 
                            padding: '3px 9px', 
                            borderRadius: '12px',
                            border: '1px solid rgba(16, 185, 129, 0.25)'
                        }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                            LIVE TELEMETRY
                        </span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                        Real-time hardware metrics, distributed storage pools, and autonomous node mesh
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Node Filter Tabs */}
                    <div style={{ display: 'flex', background: 'var(--bg-surface-1)', borderRadius: '10px', padding: '3px', border: '1px solid var(--border-subtle)' }}>
                        {['all', 'master', 'agent'].map(type => (
                            <button
                                key={type}
                                onClick={() => setNodeFilter && setNodeFilter(type)}
                                style={{
                                    padding: '6px 14px',
                                    fontSize: '11px',
                                    borderRadius: '7px',
                                    background: nodeFilter === type ? 'linear-gradient(135deg, var(--accent-gold), #e0a82e)' : 'transparent',
                                    color: nodeFilter === type ? '#000' : 'var(--text-secondary)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: '800',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {type}
                            </button>
                        ))}
                    </div>

                    {/* Refresh Telemetry Button */}
                    <button
                        onClick={handleRefresh}
                        style={{
                            background: 'var(--bg-surface-1)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '10px',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            padding: '8px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '12px',
                            fontWeight: '700',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <RefreshCw size={14} className={isRefreshing ? 'spin-anim' : ''} color="var(--accent-gold)" />
                        <span>Sync</span>
                    </button>
                </div>
            </div>

            {/* Quick Status Telemetry Banner */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '14px',
                background: 'linear-gradient(135deg, rgba(0, 242, 255, 0.03), rgba(242, 201, 76, 0.03))',
                borderRadius: '14px',
                padding: '14px 18px',
                border: '1px solid var(--border-subtle)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ShieldCheck size={18} color="#10b981" />
                    <div>
                        <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Zero-Trust Mesh</span>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>AES-256 GCM Active</div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Radio size={18} color="var(--accent-cyan)" />
                    <div>
                        <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Cluster Latency</span>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>&lt; 1.8 ms Average</div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Database size={18} color="var(--accent-gold)" />
                    <div>
                        <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Fleet Allocations</span>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>{mounts.length} Active Mounts</div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Zap size={18} color="#a855f7" />
                    <div>
                        <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Node Integrity</span>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: '#10b981' }}>
                            {filteredNodes.filter(n => n.online).length}/{filteredNodes.length} Online
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Cockpit Telemetry Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* 4 Cyber Ring Gauges */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                        <CyberRadialGauge
                            label="Storage Pool"
                            value={totalPercentage}
                            sublabel={`${formatGB(stats.used / 1e9)} / ${formatGB(stats.total / 1e9)}`}
                            colorGradient={['#f2c94c', '#ff8c00']}
                            glowColor="rgba(242, 201, 76, 0.2)"
                            statusText={totalPercentage > 85 ? 'High' : 'Normal'}
                            icon={HardDrive}
                        />
                        <CyberRadialGauge
                            label="Cluster CPU"
                            value={avgCpu}
                            sublabel={`${onlineApprovedNodes.length} Active Node(s)`}
                            colorGradient={['#00f2ff', '#0072ff']}
                            glowColor="rgba(0, 242, 255, 0.2)"
                            statusText={avgCpu > 80 ? 'Heavy' : 'Optimal'}
                            icon={Cpu}
                        />
                        <CyberRadialGauge
                            label="Cluster RAM"
                            value={avgMemory}
                            sublabel="Telemetry Buffered"
                            colorGradient={['#a855f7', '#6366f1']}
                            glowColor="rgba(168, 85, 247, 0.2)"
                            statusText={avgMemory > 85 ? 'Warning' : 'Normal'}
                            icon={Layers}
                        />
                        <CyberRadialGauge
                            label="Node Mesh"
                            value={filteredNodes.length > 0 ? Math.round((filteredNodes.filter(n => n.online).length / filteredNodes.length) * 100) : 100}
                            sublabel={`${filteredNodes.filter(n => n.online).length} / ${filteredNodes.length} Online`}
                            colorGradient={['#10b981', '#059669']}
                            glowColor="rgba(16, 185, 129, 0.2)"
                            statusText="Connected"
                            icon={Server}
                        />
                    </div>

                    {/* Waveform Telemetry Chart */}
                    <div 
                        className="st-card shadow-premium"
                        style={{
                            background: 'var(--bg-surface-1)',
                            backdropFilter: 'blur(24px)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '16px',
                            padding: '20px 24px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '14px',
                            position: 'relative'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ 
                                    width: '32px', 
                                    height: '32px', 
                                    borderRadius: '8px', 
                                    background: 'rgba(0, 242, 255, 0.1)', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    border: '1px solid rgba(0, 242, 255, 0.25)'
                                }}>
                                    <Activity size={16} color="var(--accent-cyan)" />
                                </div>
                                <div>
                                    <span style={{ fontSize: '15px', fontWeight: '850', color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                                        Real-Time I/O & Network Throughput
                                    </span>
                                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>Live cluster socket bandwidth and DMA throughput stream</p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: '700' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-cyan)', boxShadow: '0 0 8px var(--accent-cyan)' }} />
                                    <span style={{ color: 'var(--text-secondary)' }}>Down:</span>
                                    <strong style={{ color: 'var(--text-primary)' }}>{(netHistory[netHistory.length - 1]?.rx || 0.0).toFixed(1)} MB/s</strong>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: '700' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-gold)', boxShadow: '0 0 8px var(--accent-gold)' }} />
                                    <span style={{ color: 'var(--text-secondary)' }}>Up:</span>
                                    <strong style={{ color: 'var(--text-primary)' }}>{(netHistory[netHistory.length - 1]?.tx || 0.0).toFixed(1)} MB/s</strong>
                                </div>
                            </div>
                        </div>

                        {/* Interactive Wave SVG Canvas */}
                        <div 
                            style={{ 
                                position: 'relative', 
                                width: '100%', 
                                height: `${svgHeight + 10}px`, 
                                background: 'var(--bg-surface-2)', 
                                borderRadius: '12px', 
                                overflow: 'hidden', 
                                border: '1px solid var(--border-subtle)' 
                            }}
                            onMouseMove={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const mouseX = e.clientX - rect.left;
                                const index = Math.round((mouseX / rect.width) * (netHistory.length - 1));
                                const clampedIndex = Math.min(netHistory.length - 1, Math.max(0, index));
                                setHoveredDataPoint(netHistory[clampedIndex]);
                            }}
                            onMouseLeave={() => setHoveredDataPoint(null)}
                        >
                            <svg viewBox={`0 0 ${svgWidth} ${svgHeight + 10}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
                                <defs>
                                    <linearGradient id="cyberRxGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#00f2ff" stopOpacity="0.35" />
                                        <stop offset="100%" stopColor="#00f2ff" stopOpacity="0.02" />
                                    </linearGradient>
                                    <linearGradient id="cyberTxGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#f2c94c" stopOpacity="0.35" />
                                        <stop offset="100%" stopColor="#f2c94c" stopOpacity="0.02" />
                                    </linearGradient>
                                </defs>

                                {/* Y-Axis Grid Lines & Measurement Scale Labels */}
                                <line x1="0" y1={svgHeight + 10 - padBot} x2={svgWidth} y2={svgHeight + 10 - padBot} stroke="var(--border-subtle)" strokeWidth="1" />
                                <text x="12" y={svgHeight + 10 - padBot - 4} fill="var(--text-secondary)" fontSize="9.5" fontWeight="700" fontFamily="monospace">0.0 MB/s</text>

                                <line x1="0" y1={(svgHeight + 10) / 2} x2={svgWidth} y2={(svgHeight + 10) / 2} stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray="4,4" opacity="0.6" />
                                <text x="12" y={((svgHeight + 10) / 2) - 4} fill="var(--text-secondary)" fontSize="9.5" fontWeight="700" fontFamily="monospace">{(netMaxVal / 2).toFixed(1)} MB/s</text>

                                <line x1="0" y1={padTop} x2={svgWidth} y2={padTop} stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray="4,4" opacity="0.6" />
                                <text x="12" y={padTop + 10} fill="var(--text-secondary)" fontSize="9.5" fontWeight="700" fontFamily="monospace">{netMaxVal.toFixed(1)} MB/s</text>

                                {/* Area Fills */}
                                <motion.path d={rxArea} fill="url(#cyberRxGrad)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} />
                                <motion.path d={txArea} fill="url(#cyberTxGrad)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} />

                                {/* Bezier Curves */}
                                <motion.path d={rxLine} fill="none" stroke="#00f2ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                <motion.path d={txLine} fill="none" stroke="#f2c94c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>

                            {/* Scrubber Tooltip */}
                            {hoveredDataPoint && (
                                <div style={{
                                    position: 'absolute',
                                    top: '10px',
                                    right: '14px',
                                    background: 'var(--bg-surface-0)',
                                    backdropFilter: 'blur(12px)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '8px',
                                    padding: '6px 12px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    display: 'flex',
                                    gap: '12px',
                                    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                                    pointerEvents: 'none'
                                }}>
                                    <span style={{ color: 'var(--accent-cyan)' }}>↓ {hoveredDataPoint.rx.toFixed(2)} MB/s</span>
                                    <span style={{ color: 'var(--accent-gold)' }}>↑ {hoveredDataPoint.tx.toFixed(2)} MB/s</span>
                                </div>
                            )}
                        </div>

                        {/* Measurement Metric & Calculation Legend */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '10.5px', color: 'var(--text-secondary)', padding: '2px 4px 0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: '800', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Calculation:</span>
                                <span>Throughput (MB/s) = (Δ Bytes ÷ 2.0s Interval) ÷ 1,048,576</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '700' }}>
                                <span>Rolling Buffer: 30 Samples (60s)</span>
                                <span>Peak: ↓ {Math.max(...netHistory.map(d => d.rx), 0).toFixed(1)} MB/s | ↑ {Math.max(...netHistory.map(d => d.tx), 0).toFixed(1)} MB/s</span>
                            </div>
                        </div>
                    </div>

                    {/* Mounted Storage Allocations Section */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '850', color: 'var(--text-primary)', letterSpacing: '-0.4px' }}>
                                    Mounted Storage Pools
                                </h3>
                                <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                                    Debian partitions, remote agent physical drives, and cluster network volumes
                                </p>
                            </div>
                            <span style={{ 
                                fontSize: '11px', 
                                fontWeight: '800', 
                                background: 'rgba(242, 201, 76, 0.1)', 
                                color: 'var(--accent-gold)', 
                                padding: '4px 12px', 
                                borderRadius: '20px',
                                border: '1px solid rgba(242, 201, 76, 0.25)'
                            }}>
                                {mounts.length} Allocations
                            </span>
                        </div>

                        {/* Storage Pool Bar */}
                        {grandTotalCapacity > 0 && (
                            <div className="st-card shadow-premium" style={{ 
                                padding: '16px 20px', 
                                background: 'var(--bg-surface-1)', 
                                border: '1px solid var(--border-subtle)', 
                                borderRadius: '14px',
                                marginBottom: '16px' 
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Cluster Storage Distribution
                                    </span>
                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700' }}>
                                        {formatBytes(grandTotalFree)} Free / {formatBytes(grandTotalCapacity)} Total
                                    </span>
                                </div>
                                <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden', background: 'rgba(255,255,255,0.06)', marginBottom: '12px' }}>
                                    {mounts.map((m, i) => {
                                        const widthPct = grandTotalCapacity > 0 ? (m.used / grandTotalCapacity) * 100 : 0;
                                        if (widthPct <= 0) return null;
                                        return (
                                            <motion.div 
                                                key={m.id}
                                                initial={{ width: 0 }} 
                                                animate={{ width: `${widthPct}%` }} 
                                                transition={{ duration: 0.6, delay: i * 0.05 }} 
                                                style={{ background: m.themeColor, height: '100%' }} 
                                                title={`${m.label}: ${formatBytes(m.used)}`}
                                            />
                                        );
                                    })}
                                </div>
                                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '11px', fontWeight: '700' }}>
                                    {mounts.slice(0, 4).map((m) => (
                                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: m.themeColor }} />
                                            <span style={{ color: 'var(--text-secondary)' }}>{m.name}:</span>
                                            <strong style={{ color: 'var(--text-primary)' }}>{m.percentage}%</strong>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Mount Cards Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
                            {mounts.map((m, idx) => {
                                let IconComp = HardDrive;
                                if (m.type.includes('Agent')) IconComp = Server;
                                else if (m.type.includes('Network')) IconComp = Globe;

                                return (
                                    <motion.div
                                        key={m.id}
                                        className="st-card shadow-premium"
                                        whileHover={{ scale: 1.02, y: -2, boxShadow: `0 6px 24px ${m.themeColor}22` }}
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3, delay: idx * 0.03 }}
                                        style={{
                                            background: 'var(--bg-surface-1)',
                                            backdropFilter: 'blur(20px)',
                                            border: '1px solid var(--border-subtle)',
                                            borderRadius: '14px',
                                            padding: '16px 18px',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => {
                                            if (navigateTo) {
                                                navigateTo(m.name, 'files');
                                            }
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ 
                                                    width: '34px', 
                                                    height: '34px', 
                                                    borderRadius: '8px', 
                                                    background: `${m.themeColor}18`, 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center',
                                                    border: `1px solid ${m.themeColor}33`
                                                }}>
                                                    <IconComp size={16} color={m.themeColor} />
                                                </div>
                                                <div>
                                                    <span style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)', display: 'block' }}>
                                                        {m.label}
                                                    </span>
                                                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                                                        {m.nodeName}
                                                    </span>
                                                </div>
                                            </div>
                                            <span style={{ 
                                                fontSize: '10px', 
                                                fontWeight: '800', 
                                                color: m.themeColor,
                                                background: `${m.themeColor}18`,
                                                padding: '2px 6px',
                                                borderRadius: '6px'
                                            }}>
                                                {m.percentage}%
                                            </span>
                                        </div>

                                        <div className="st-progress-rail" style={{ height: '5px', margin: '8px 0', background: 'rgba(255,255,255,0.06)' }}>
                                            <motion.div 
                                                className="st-progress-fill" 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${m.percentage}%` }}
                                                transition={{ duration: 0.8 }}
                                                style={{ background: m.percentage > 90 ? '#f85149' : m.themeColor }}
                                            />
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                                            <span>{formatBytes(m.used)} Used</span>
                                            <span>{formatBytes(m.free)} Free</span>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right Column: Live Event Stream & Audit Log */}
                <div 
                    className="st-card shadow-premium" 
                    style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        height: '100%',
                        minHeight: '750px',
                        background: 'var(--bg-surface-1)',
                        backdropFilter: 'blur(24px)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '18px',
                        padding: '22px',
                        boxSizing: 'border-box'
                    }} 
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Activity size={18} color="var(--accent-gold)" />
                            <h3 style={{ fontSize: '17px', fontWeight: '850', margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                                Fleet Event Stream & Audits
                            </h3>
                        </div>
                        <button 
                            onClick={() => setActivityHistory && setActivityHistory([])} 
                            style={{ 
                                background: 'rgba(255,255,255,0.05)', 
                                border: '1px solid var(--border-subtle)', 
                                color: 'var(--text-secondary)', 
                                cursor: 'pointer', 
                                fontSize: '11px',
                                fontWeight: '700',
                                padding: '4px 10px',
                                borderRadius: '6px'
                            }}
                        >
                            Clear
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '6px', minHeight: 0 }}>
                        {(() => {
                            const combinedActivities = [
                                ...activityHistory,
                                ...activities.map(a => ({
                                    id: a.id,
                                    name: a.name,
                                    type: a.error === 'error' ? 'Security / Node' : a.error === 'warning' ? 'Alert' : 'System Event',
                                    status: a.error === 'error' ? 'Error' : a.error === 'warning' ? 'Alert' : 'Completed',
                                    timestamp: a.timestamp,
                                    error: typeof a.status === 'string' && a.status.length < 80 ? a.status : null
                                }))
                            ].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)).slice(0, 30);

                            if (combinedActivities.length === 0) {
                                return (
                                    <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.4 }}>
                                        <Activity size={36} color="var(--text-secondary)" />
                                        <p style={{ fontSize: '13px', marginTop: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                                            No recent fleet events recorded
                                        </p>
                                    </div>
                                );
                            }

                            return combinedActivities.map((act, i) => {
                                const isSuccess = act.status === 'Completed';
                                const isAlert = act.status === 'Alert' || act.status === 'Warning';
                                const badgeBg = isSuccess 
                                    ? 'rgba(16, 185, 129, 0.12)' 
                                    : isAlert 
                                    ? 'rgba(242, 201, 76, 0.12)' 
                                    : 'rgba(248, 81, 73, 0.12)';
                                const badgeColor = isSuccess ? '#10b981' : isAlert ? 'var(--accent-gold)' : '#f85149';

                                return (
                                    <motion.div 
                                        key={act.id || i} 
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.2, delay: i * 0.02 }}
                                        style={{ 
                                            marginBottom: '10px', 
                                            padding: '12px 14px', 
                                            background: 'rgba(255, 255, 255, 0.02)', 
                                            borderRadius: '10px', 
                                            border: '1px solid var(--border-subtle)' 
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <p style={{ fontSize: '12.5px', margin: 0, fontWeight: '700', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {act.name}
                                                </p>
                                                <p style={{ fontSize: '10px', color: 'var(--text-secondary)', margin: '3px 0 0 0', fontWeight: '500' }}>
                                                    {act.type || 'Event'} • {act.timestamp ? new Date(act.timestamp).toLocaleTimeString() : 'Just now'}
                                                </p>
                                            </div>
                                            <span style={{
                                                fontSize: '9px',
                                                padding: '2px 7px',
                                                borderRadius: '5px',
                                                fontWeight: '800',
                                                background: badgeBg,
                                                color: badgeColor,
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {(act.status || 'DONE').toUpperCase()}
                                            </span>
                                        </div>
                                        {act.error && (
                                            <p style={{ fontSize: '10.5px', color: badgeColor, margin: '6px 0 0', opacity: 0.9 }}>
                                                {act.error}
                                            </p>
                                        )}
                                    </motion.div>
                                );
                            });
                        })()}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
