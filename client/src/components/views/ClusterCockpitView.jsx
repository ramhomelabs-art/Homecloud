import React, { useState, useMemo, useEffect } from 'react';
import { 
    Cpu, Server, HardDrive, Globe, Activity, RefreshCw, 
    ShieldCheck, Zap, Radio, ArrowUpRight, ArrowDownRight, 
    Layers, Disc, CheckCircle2, AlertTriangle, Database,
    Maximize2, Search, Trash2, FileText, Copy, Download,
    Upload, ShieldAlert, Sparkles, PieChart, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ClusterStorageModal from '../modals/ClusterStorageModal';
import FleetEventsModal from '../modals/FleetEventsModal';
import axios from 'axios';

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

// Liquid Wave Metric Card Component
const LiquidWaveGaugeCard = ({
    title,
    sublabel,
    value,
    statusText,
    theme = 'amber', // 'amber' | 'blue' | 'purple' | 'emerald'
    icon: Icon,
    onClick,
    badgeHint
}) => {
    const clamped = Math.min(100, Math.max(0, value || 0));

    const themeConfig = {
        amber: {
            iconBg: '#fef3c7',
            iconColor: '#f59e0b',
            badgeBg: '#fef3c7',
            badgeColor: '#d97706',
            waveFront: 'rgba(253, 224, 71, 0.55)',
            waveBack: 'rgba(254, 240, 138, 0.45)',
            waveGradStart: '#fef08a',
            waveGradEnd: '#fde047',
            stroke: '#eab308'
        },
        blue: {
            iconBg: '#e0f2fe',
            iconColor: '#0284c7',
            badgeBg: '#e0f2fe',
            badgeColor: '#0284c7',
            waveFront: 'rgba(56, 189, 248, 0.55)',
            waveBack: 'rgba(186, 230, 253, 0.45)',
            waveGradStart: '#bae6fd',
            waveGradEnd: '#38bdf8',
            stroke: '#0284c7'
        },
        purple: {
            iconBg: '#f3e8ff',
            iconColor: '#9333ea',
            badgeBg: '#f3e8ff',
            badgeColor: '#7e22ce',
            waveFront: 'rgba(192, 132, 252, 0.55)',
            waveBack: 'rgba(233, 213, 255, 0.45)',
            waveGradStart: '#e9d5ff',
            waveGradEnd: '#c084fc',
            stroke: '#9333ea'
        },
        emerald: {
            iconBg: '#d1fae5',
            iconColor: '#059669',
            badgeBg: '#fee2e2',
            badgeColor: '#ef4444',
            waveFront: 'rgba(52, 211, 153, 0.55)',
            waveBack: 'rgba(167, 243, 208, 0.45)',
            waveGradStart: '#a7f3d0',
            waveGradEnd: '#34d399',
            stroke: '#10b981'
        }
    };

    const cfg = themeConfig[theme] || themeConfig.blue;
    const waveHeightPercent = Math.max(14, Math.min(100, clamped));

    return (
        <motion.div
            className="st-card shadow-premium"
            whileHover={{ scale: 1.02, y: -2 }}
            transition={{ duration: 0.2 }}
            onClick={onClick}
            style={{
                background: 'var(--bg-surface-0, #ffffff)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '20px',
                padding: '18px 18px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden',
                height: '190px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
                cursor: onClick ? 'pointer' : 'default'
            }}
            title={onClick ? `${title} (Click to inspect details)` : undefined}
        >
            {/* Top Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', position: 'relative', zIndex: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                    {Icon && (
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '9px',
                            background: cfg.iconBg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            <Icon size={16} color={cfg.iconColor} />
                        </div>
                    )}
                    <span style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-primary)' }}>
                        {title}
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {badgeHint && (
                        <span style={{
                            fontSize: '9px',
                            fontWeight: '800',
                            padding: '2px 6px',
                            borderRadius: '5px',
                            background: 'rgba(0,0,0,0.06)',
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase'
                        }}>
                            {badgeHint}
                        </span>
                    )}
                    {statusText && (
                        <span style={{
                            fontSize: '10px',
                            fontWeight: '700',
                            padding: '3px 8px',
                            borderRadius: '7px',
                            background: cfg.badgeBg,
                            color: cfg.badgeColor,
                            letterSpacing: '0.2px',
                            flexShrink: 0
                        }}>
                            {statusText}
                        </span>
                    )}
                </div>
            </div>

            {/* Centered Large Metric */}
            <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', margin: '4px 0 0' }}>
                <span style={{ fontSize: '32px', fontWeight: '850', color: 'var(--text-primary)', letterSpacing: '-0.8px' }}>
                    {clamped}
                    <span style={{ fontSize: '18px', fontWeight: '700', marginLeft: '2px' }}>%</span>
                </span>
            </div>

            {/* Bottom Subtitle text on top of wave */}
            <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                {sublabel}
            </div>

            {/* Animated Flowing Liquid Wave Container filling dynamically with % */}
            <motion.div 
                initial={{ height: '14%' }}
                animate={{ height: `${waveHeightPercent}%` }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    overflow: 'hidden',
                    pointerEvents: 'none',
                    zIndex: 1
                }}
            >
                <svg
                    viewBox="0 0 400 120"
                    preserveAspectRatio="none"
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        width: '200%',
                        height: '100%'
                    }}
                >
                    <defs>
                        <linearGradient id={`waveGrad-${theme}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={cfg.waveGradStart} stopOpacity="0.85" />
                            <stop offset="100%" stopColor={cfg.waveGradEnd} stopOpacity="0.45" />
                        </linearGradient>
                    </defs>

                    {/* Back Wave Layer */}
                    <motion.path
                        d="M 0,40 Q 50,15 100,40 T 200,40 T 300,40 T 400,40 L 400,120 L 0,120 Z"
                        fill={cfg.waveBack}
                        animate={{ x: [0, -200] }}
                        transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
                    />

                    {/* Front Wave Layer */}
                    <motion.path
                        d="M 0,30 Q 50,55 100,30 T 200,30 T 300,30 T 400,30 L 400,120 L 0,120 Z"
                        fill={`url(#waveGrad-${theme})`}
                        stroke={cfg.stroke}
                        strokeWidth="1.2"
                        strokeOpacity="0.5"
                        animate={{ x: [-200, 0] }}
                        transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                    />
                </svg>
            </motion.div>
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
    navigateTo,
    onOpenHeatmap
}) {
    const [chartMode, setChartMode] = useState('network'); // 'network' or 'disk'
    const [hoveredDataPoint, setHoveredDataPoint] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [clearedAt, setClearedAt] = useState(0);

    // Modal state for storage breakdown & full fleet events
    const [showStorageModal, setShowStorageModal] = useState(false);
    const [showFleetEventsModal, setShowFleetEventsModal] = useState(false);

    // Inline event stream filters
    const [streamCategory, setStreamCategory] = useState('all'); // 'all', 'transfers', 'alerts'
    const [streamSearch, setStreamSearch] = useState('');

    const handleClearActivities = async () => {
        setClearedAt(Date.now());
        if (setActivityHistory) setActivityHistory([]);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post('/api/v1/files/activities/clear', {}, { headers });
        } catch (e) {
            console.warn('Failed to clear activities on server', e);
        }
        if (showToast) showToast('Fleet event stream & audit log cleared', 'info');
    };

    // Calculate cluster averages
    const onlineApprovedNodes = filteredNodes.filter(n => n.online && n.status === 'approved');
    const avgCpu = onlineApprovedNodes.length > 0
        ? Math.round(onlineApprovedNodes.reduce((sum, n) => sum + (n.cpu || 0), 0) / onlineApprovedNodes.length)
        : 0;
    const avgMemory = onlineApprovedNodes.length > 0
        ? Math.round(onlineApprovedNodes.reduce((sum, n) => sum + (n.memory || 0), 0) / onlineApprovedNodes.length)
        : 0;

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

    // Compile all mounted volumes
    const mounts = [];
    if (localStorageInfo && localStorageInfo.disks) {
        localStorageInfo.disks.forEach(d => {
            mounts.push({
                id: `local-${d.mount}`,
                name: d.mount,
                label: d.mount === 'C:\\' || d.mount === '/' ? 'System Root (/)' : (d.label || `Storage (${d.mount})`),
                nodeName: 'Primary Host',
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

    const grandTotalCapacity = mounts.reduce((sum, m) => sum + (m.size || 0), 0);
    const grandTotalUsed = mounts.reduce((sum, m) => sum + (m.used || 0), 0);
    const grandTotalFree = Math.max(0, grandTotalCapacity - grandTotalUsed);

    // Active storage capacity based on node filter
    const activeCapacity = nodeFilter === 'all'
        ? (grandTotalCapacity > 0 ? grandTotalCapacity : stats.total)
        : (nodeFilter === 'master'
            ? (localStorageInfo?.disks || []).reduce((s, d) => s + (d.size || 0), 0)
            : agentStorage.reduce((s, a) => s + (a.disks || []).reduce((ds, d) => ds + (d.size || 0), 0), 0));

    const activeUsed = nodeFilter === 'all'
        ? (grandTotalUsed > 0 ? grandTotalUsed : stats.used)
        : (nodeFilter === 'master'
            ? (localStorageInfo?.disks || []).reduce((s, d) => s + (d.used || 0), 0)
            : agentStorage.reduce((s, a) => s + (a.disks || []).reduce((ds, d) => ds + (d.used || 0), 0), 0));

    const totalPercentage = activeCapacity > 0 ? Math.round((activeUsed / activeCapacity) * 100) : 0;

    // Real-time ping telemetry measurement
    const [liveApiPing, setLiveApiPing] = useState(null);

    useEffect(() => {
        let isMounted = true;
        const measurePing = async () => {
            const t0 = performance.now();
            try {
                await axios.get('/api/v1/health', { timeout: 3000 });
                const rtt = Math.max(1, Math.round(performance.now() - t0));
                if (isMounted) setLiveApiPing(rtt);
            } catch {
                try {
                    await axios.get('/health', { timeout: 3000 });
                    const rtt = Math.max(1, Math.round(performance.now() - t0));
                    if (isMounted) setLiveApiPing(rtt);
                } catch {}
            }
        };

        measurePing();
        const interval = setInterval(measurePing, 5000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    // Dynamically calculate live cluster latency from telemetry polling
    const dynamicLatency = useMemo(() => {
        const latencies = [];
        if (metrics?.metricsHistory) {
            Object.values(metrics.metricsHistory).forEach(arr => {
                if (Array.isArray(arr) && arr.length > 0) {
                    const latest = arr[arr.length - 1];
                    if (latest && typeof latest.latency === 'number' && latest.latency > 0) {
                        latencies.push(latest.latency);
                    }
                }
            });
        }
        if (latencies.length > 0) {
            const avg = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1);
            return `${avg} ms (Agent Mesh)`;
        }
        if (liveApiPing !== null) {
            return `${liveApiPing} ms (Live RTT)`;
        }
        return '< 1.0 ms (Loopback)';
    }, [metrics, liveApiPing]);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
        >
            {/* Storage Modal & Full Audit Modal */}
            <ClusterStorageModal
                isOpen={showStorageModal}
                onClose={() => setShowStorageModal(false)}
                mounts={mounts}
                localStorageInfo={localStorageInfo}
                agentStorage={agentStorage}
                networkShares={networkShares}
                onRefresh={fetchAllData}
                navigateTo={navigateTo}
                onOpenHeatmap={onOpenHeatmap}
            />

            <FleetEventsModal
                isOpen={showFleetEventsModal}
                onClose={() => setShowFleetEventsModal(false)}
                activities={activities}
                activityHistory={activityHistory}
                onClear={handleClearActivities}
                showToast={showToast}
            />

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
                        <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>{dynamicLatency}</div>
                    </div>
                </div>

                <div 
                    onClick={() => setShowStorageModal(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                    title="Click to view all storage pool allocations"
                >
                    <Database size={18} color="var(--accent-gold)" />
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Fleet Allocations</span>
                            <ArrowUpRight size={11} color="var(--accent-gold)" />
                        </div>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(0, 1.05fr)', gap: '24px', width: '100%', minWidth: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0, overflow: 'hidden' }}>
                    
                    {/* 4 Liquid Wave Fluid Metric Cards matching User Reference */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
                        <LiquidWaveGaugeCard
                            title="STORAGE"
                            value={totalPercentage}
                            sublabel={`${formatBytes(activeUsed)} / ${formatBytes(activeCapacity)}`}
                            statusText={totalPercentage > 85 ? 'High' : 'Normal'}
                            theme="amber"
                            icon={HardDrive}
                            onClick={() => setShowStorageModal(true)}
                            badgeHint="Inspect"
                        />
                        <LiquidWaveGaugeCard
                            title="CPU"
                            value={avgCpu}
                            sublabel={`${onlineApprovedNodes.length} Active Node(s)`}
                            statusText={avgCpu > 80 ? 'Heavy' : 'Optimal'}
                            theme="blue"
                            icon={Cpu}
                        />
                        <LiquidWaveGaugeCard
                            title="RAM"
                            value={avgMemory}
                            sublabel="Telemetry Buffered"
                            statusText={avgMemory > 85 ? 'Warning' : 'Normal'}
                            theme="purple"
                            icon={Layers}
                        />
                        <LiquidWaveGaugeCard
                            title="MESH"
                            value={filteredNodes.length > 0 ? Math.round((filteredNodes.filter(n => n.online).length / filteredNodes.length) * 100) : 100}
                            sublabel={`${filteredNodes.filter(n => n.online).length} / ${filteredNodes.length} Online`}
                            statusText="Connected"
                            theme="emerald"
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
                    {/* Single Combined Real-Time Area Chart */}
                    {(() => {
                        const maxRaw = Math.max(...netHistory.map(d => Math.max(d.rx || 0, d.tx || 0)), 0.2);
                        let maxScale = 5;
                        if (maxRaw <= 0.5) maxScale = 0.5;
                        else if (maxRaw <= 1) maxScale = 1;
                        else if (maxRaw <= 2) maxScale = 2;
                        else if (maxRaw <= 5) maxScale = 5;
                        else if (maxRaw <= 10) maxScale = 10;
                        else if (maxRaw <= 25) maxScale = 25;
                        else if (maxRaw <= 50) maxScale = 50;
                        else if (maxRaw <= 100) maxScale = 100;
                        else if (maxRaw <= 200) maxScale = 200;
                        else maxScale = Math.ceil(maxRaw / 50) * 50;

                        const width = 680;
                        const height = 180;
                        const padL = 65;
                        const padR = 15;
                        const padT = 15;
                        const padB = 26;
                        const plotW = width - padL - padR;
                        const plotH = height - padT - padB;
                        const baseZeroY = padT + plotH;

                        const numPoints = netHistory.length;
                        const divisor = Math.max(1, numPoints - 1);

                        // Generate plotting coordinates
                        const rxPlotPts = netHistory.map((d, i) => {
                            const x = padL + (i / divisor) * plotW;
                            const y = padT + plotH - ((d.rx || 0) / maxScale) * plotH;
                            return { x, y, val: d.rx, d, i };
                        });

                        const txPlotPts = netHistory.map((d, i) => {
                            const x = padL + (i / divisor) * plotW;
                            const y = padT + plotH - ((d.tx || 0) / maxScale) * plotH;
                            return { x, y, val: d.tx, d, i };
                        });

                        // Smooth Catmull-Rom to Cubic Bezier curve path
                        const buildSmoothCurve = (pts) => {
                            if (!pts || pts.length === 0) return '';
                            if (pts.length === 1) return `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
                            let p = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
                            for (let i = 0; i < pts.length - 1; i++) {
                                const p0 = i > 0 ? pts[i - 1] : pts[i];
                                const p1 = pts[i];
                                const p2 = pts[i + 1];
                                const p3 = i < pts.length - 2 ? pts[i + 2] : p2;

                                const cp1x = p1.x + (p2.x - p0.x) / 6;
                                const cp1y = p1.y + (p2.y - p0.y) / 6;
                                const cp2x = p2.x - (p3.x - p1.x) / 6;
                                const cp2y = p2.y - (p3.y - p1.y) / 6;

                                p += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
                            }
                            return p;
                        };

                        const rxCurve = buildSmoothCurve(rxPlotPts);
                        const rxFilledArea = rxPlotPts.length > 0
                            ? `${rxCurve} L ${rxPlotPts[rxPlotPts.length - 1].x.toFixed(1)},${baseZeroY} L ${padL},${baseZeroY} Z`
                            : '';

                        const txCurve = buildSmoothCurve(txPlotPts);
                        const txFilledArea = txPlotPts.length > 0
                            ? `${txCurve} L ${txPlotPts[txPlotPts.length - 1].x.toFixed(1)},${baseZeroY} L ${padL},${baseZeroY} Z`
                            : '';

                        // Y-axis grid ticks (4 levels)
                        const yTicks = [
                            { label: `${maxScale >= 1 ? maxScale.toFixed(0) : maxScale.toFixed(1)} MB/s`, y: padT },
                            { label: `${(maxScale * 0.75) >= 1 ? (maxScale * 0.75).toFixed(0) : (maxScale * 0.75).toFixed(1)} MB/s`, y: padT + plotH * 0.25 },
                            { label: `${(maxScale * 0.5) >= 1 ? (maxScale * 0.5).toFixed(0) : (maxScale * 0.5).toFixed(1)} MB/s`, y: padT + plotH * 0.5 },
                            { label: `${(maxScale * 0.25) >= 1 ? (maxScale * 0.25).toFixed(0) : (maxScale * 0.25).toFixed(1)} MB/s`, y: padT + plotH * 0.75 },
                            { label: `0 MB/s`, y: baseZeroY }
                        ];

                        // X-axis time ticks
                        const timeIntervalCount = 6;
                        const xTicks = Array.from({ length: timeIntervalCount + 1 }, (_, idx) => {
                            const sampleIdx = Math.round((idx / timeIntervalCount) * (numPoints - 1));
                            const pt = rxPlotPts[sampleIdx] || { x: padL + (idx / timeIntervalCount) * plotW };
                            const ts = netHistory[sampleIdx]?.timestamp || (Date.now() - (numPoints - 1 - sampleIdx) * 2000);
                            const timeStr = new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                            return { x: pt.x, label: timeStr };
                        });

                        const curRx = netHistory[netHistory.length - 1]?.rx || 0.0;
                        const curTx = netHistory[netHistory.length - 1]?.tx || 0.0;

                        return (
                            <div 
                                className="st-card shadow-premium"
                                style={{
                                    background: 'var(--bg-surface-0, #ffffff)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '16px',
                                    padding: '20px 24px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px',
                                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)'
                                }}
                            >
                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ 
                                            width: '36px', 
                                            height: '36px', 
                                            borderRadius: '10px', 
                                            background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            boxShadow: '0 4px 12px rgba(14, 165, 233, 0.25)'
                                        }}>
                                            <Activity size={18} color="#ffffff" />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>
                                                Network I/O Throughput
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                                Live network traffic (Download / Upload)
                                            </div>
                                        </div>
                                    </div>

                                    {/* Legends with Live Speeds */}
                                    <div style={{ display: 'flex', gap: '18px', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', fontWeight: '700' }}>
                                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0ea5e9', display: 'inline-block' }} />
                                            <span style={{ color: 'var(--text-secondary)' }}>Download:</span>
                                            <span style={{ color: 'var(--text-primary)', fontWeight: '800' }}>{curRx.toFixed(1)} MB/s</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', fontWeight: '700' }}>
                                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                                            <span style={{ color: 'var(--text-secondary)' }}>Upload:</span>
                                            <span style={{ color: 'var(--text-primary)', fontWeight: '800' }}>{curTx.toFixed(1)} MB/s</span>
                                        </div>
                                    </div>
                                </div>

                                {/* SVG Chart Canvas */}
                                <div 
                                    style={{ 
                                        position: 'relative', 
                                        width: '100%', 
                                        height: `${height}px`,
                                        margin: '4px 0'
                                    }}
                                    onMouseMove={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const mouseX = e.clientX - rect.left;
                                        const relativeX = Math.max(0, Math.min(plotW, (mouseX / rect.width) * width - padL));
                                        const idx = Math.round((relativeX / plotW) * (numPoints - 1));
                                        const clamped = Math.min(numPoints - 1, Math.max(0, idx));
                                        setHoveredDataPoint({ ...netHistory[clamped], index: clamped, plotX: rxPlotPts[clamped]?.x || mouseX });
                                    }}
                                    onMouseLeave={() => setHoveredDataPoint(null)}
                                >
                                    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
                                        <defs>
                                            <linearGradient id="areaGradDownload" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.45" />
                                                <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.08" />
                                            </linearGradient>
                                            
                                            <linearGradient id="areaGradUpload" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.65" />
                                                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.15" />
                                            </linearGradient>
                                        </defs>

                                        {/* Horizontal Gridlines & Y-Axis Labels */}
                                        {yTicks.map((tick, i) => (
                                            <g key={`y-${i}`}>
                                                <line 
                                                    x1={padL} 
                                                    y1={tick.y} 
                                                    x2={padL + plotW} 
                                                    y2={tick.y} 
                                                    stroke="var(--border-subtle, rgba(0,0,0,0.06))" 
                                                    strokeWidth={i === yTicks.length - 1 ? "1.5" : "1"} 
                                                    opacity={i === yTicks.length - 1 ? 1 : 0.6}
                                                />
                                                <text 
                                                    x={padL - 10} 
                                                    y={tick.y + 3.5} 
                                                    textAnchor="end" 
                                                    fill="var(--text-secondary, #64748b)" 
                                                    fontSize="10.5" 
                                                    fontWeight="600" 
                                                    fontFamily="system-ui, -apple-system, sans-serif"
                                                >
                                                    {tick.label}
                                                </text>
                                            </g>
                                        ))}

                                        {/* Y-Axis Vertical Line */}
                                        <line 
                                            x1={padL} 
                                            y1={padT} 
                                            x2={padL} 
                                            y2={baseZeroY} 
                                            stroke="var(--border-subtle, rgba(0,0,0,0.12))" 
                                            strokeWidth="1.2" 
                                        />

                                        {/* Vertical Time Gridlines & X-Axis Labels */}
                                        {xTicks.map((xt, i) => (
                                            <g key={`x-${i}`}>
                                                <line 
                                                    x1={xt.x} 
                                                    y1={padT} 
                                                    x2={xt.x} 
                                                    y2={baseZeroY} 
                                                    stroke="var(--border-subtle, rgba(0,0,0,0.04))" 
                                                    strokeWidth="1" 
                                                    opacity="0.5"
                                                />
                                                <line 
                                                    x1={xt.x} 
                                                    y1={baseZeroY} 
                                                    x2={xt.x} 
                                                    y2={baseZeroY + 4} 
                                                    stroke="var(--border-subtle, rgba(0,0,0,0.2))" 
                                                    strokeWidth="1" 
                                                />
                                                <text 
                                                    x={xt.x} 
                                                    y={height - 8} 
                                                    textAnchor={i === 0 ? "start" : (i === xTicks.length - 1 ? "end" : "middle")} 
                                                    fill="var(--text-secondary, #64748b)" 
                                                    fontSize="10" 
                                                    fontWeight="600" 
                                                    fontFamily="system-ui, -apple-system, sans-serif"
                                                >
                                                    {xt.label}
                                                </text>
                                            </g>
                                        ))}

                                        {/* Series 1: Download Filled Area & Curve */}
                                        {rxFilledArea && (
                                            <motion.path 
                                                d={rxFilledArea} 
                                                fill="url(#areaGradDownload)" 
                                                initial={{ opacity: 0 }} 
                                                animate={{ opacity: 1 }} 
                                                transition={{ duration: 0.4 }} 
                                            />
                                        )}
                                        {rxCurve && (
                                            <motion.path 
                                                d={rxCurve} 
                                                fill="none" 
                                                stroke="#0ea5e9" 
                                                strokeWidth="2.8" 
                                                strokeLinecap="round" 
                                                strokeLinejoin="round" 
                                            />
                                        )}

                                        {/* Series 2: Upload Filled Area & Curve */}
                                        {txFilledArea && (
                                            <motion.path 
                                                d={txFilledArea} 
                                                fill="url(#areaGradUpload)" 
                                                initial={{ opacity: 0 }} 
                                                animate={{ opacity: 1 }} 
                                                transition={{ duration: 0.4 }} 
                                            />
                                        )}
                                        {txCurve && (
                                            <motion.path 
                                                d={txCurve} 
                                                fill="none" 
                                                stroke="#f59e0b" 
                                                strokeWidth="2.8" 
                                                strokeLinecap="round" 
                                                strokeLinejoin="round" 
                                            />
                                        )}

                                        {/* Vertical Hover Crosshair */}
                                        {hoveredDataPoint && (
                                            <line 
                                                x1={hoveredDataPoint.plotX || (padL + (hoveredDataPoint.index / divisor) * plotW)} 
                                                y1={padT} 
                                                x2={hoveredDataPoint.plotX || (padL + (hoveredDataPoint.index / divisor) * plotW)} 
                                                y2={baseZeroY} 
                                                stroke="#64748b" 
                                                strokeWidth="1.5" 
                                                strokeDasharray="3,3" 
                                            />
                                        )}
                                    </svg>

                                    {/* Clean Hover Tooltip */}
                                    {hoveredDataPoint && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '12px',
                                            right: '16px',
                                            background: 'var(--bg-surface-0, #ffffff)',
                                            border: '1px solid var(--border-subtle)',
                                            borderRadius: '8px',
                                            padding: '8px 14px',
                                            fontSize: '11px',
                                            boxShadow: '0 6px 16px rgba(0, 0, 0, 0.12)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '3px',
                                            pointerEvents: 'none',
                                            zIndex: 10
                                        }}>
                                            <div style={{ fontWeight: '750', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                                                Time: {new Date(hoveredDataPoint.timestamp || Date.now()).toLocaleTimeString()}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0ea5e9', fontWeight: '800' }}>
                                                <span>● Download:</span>
                                                <span>{(hoveredDataPoint.rx || 0).toFixed(1)} MB/s</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontWeight: '800' }}>
                                                <span>● Upload:</span>
                                                <span>{(hoveredDataPoint.tx || 0).toFixed(1)} MB/s</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })()}
                    </div>

                    {/* Mounted Storage Allocations Section */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '850', color: 'var(--text-primary)', letterSpacing: '-0.4px' }}>
                                    Mounted Storage Pools
                                </h3>
                                <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                                    Partitions, remote agent physical drives, and cluster network volumes
                                </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                    onClick={() => setShowStorageModal(true)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        fontSize: '11px',
                                        fontWeight: '800',
                                        background: 'rgba(242, 201, 76, 0.1)',
                                        color: 'var(--accent-gold)',
                                        padding: '4px 12px',
                                        borderRadius: '20px',
                                        border: '1px solid rgba(242, 201, 76, 0.25)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <span>Inspect {mounts.length} Pools</span>
                                    <Maximize2 size={12} />
                                </button>
                            </div>
                        </div>

                        {/* Storage Pool Bar */}
                        {grandTotalCapacity > 0 && (
                            <div 
                                className="st-card shadow-premium" 
                                onClick={() => setShowStorageModal(true)}
                                style={{ 
                                    padding: '16px 20px', 
                                    background: 'var(--bg-surface-1)', 
                                    border: '1px solid var(--border-subtle)', 
                                    borderRadius: '14px',
                                    marginBottom: '16px',
                                    cursor: 'pointer'
                                }}
                                title="Click to view detailed storage breakdown"
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Cluster Storage Distribution
                                        </span>
                                        <ArrowUpRight size={13} color="var(--accent-gold)" />
                                    </div>
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
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' }}>
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

                {/* Right Column: Fleet Event Stream & Audit Log */}
                <div 
                    className="st-card shadow-premium" 
                    style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        height: 'fit-content',
                        minWidth: 0,
                        width: '100%',
                        overflow: 'hidden',
                        background: 'var(--bg-surface-0, #ffffff)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '18px',
                        padding: '18px 20px',
                        boxSizing: 'border-box',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)'
                    }} 
                >
                    {/* Header with Live Pulse Badge & Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexShrink: 0, minWidth: 0, gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '9px',
                                background: 'rgba(245, 158, 11, 0.12)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <Activity size={17} color="var(--accent-gold, #f59e0b)" />
                            </div>
                            <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                <h3 style={{ fontSize: '15.5px', fontWeight: '850', margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    Fleet Event Stream
                                </h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '1px' }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block', flexShrink: 0 }} />
                                    <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: '600', whiteSpace: 'nowrap' }}>Live Cluster Telemetry</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            <button
                                onClick={() => setShowFleetEventsModal(true)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    background: 'var(--bg-surface-2, rgba(0,0,0,0.04))',
                                    border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-secondary)',
                                    padding: '5px 9px',
                                    borderRadius: '7px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                }}
                                title="Expand Full Audit Log Modal"
                            >
                                <Maximize2 size={12} />
                                <span>Audit Log</span>
                            </button>
                            <button 
                                onClick={handleClearActivities} 
                                style={{ 
                                    background: 'var(--bg-surface-2, rgba(0,0,0,0.04))', 
                                    border: '1px solid var(--border-subtle)', 
                                    color: 'var(--text-secondary)', 
                                    cursor: 'pointer', 
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    padding: '5px 9px',
                                    borderRadius: '7px',
                                    transition: 'all 0.2s ease',
                                    whiteSpace: 'nowrap'
                                }}
                                title="Clear fleet activity stream"
                            >
                                Clear
                            </button>
                        </div>
                    </div>

                    {/* Inline Filter Pills and Search */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '14px', flexWrap: 'wrap', minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: '5px', background: 'var(--bg-surface-1, rgba(0,0,0,0.03))', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                            {[
                                { id: 'all', label: 'All' },
                                { id: 'transfers', label: 'Transfers' },
                                { id: 'alerts', label: 'Alerts' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setStreamCategory(tab.id)}
                                    style={{
                                        padding: '4px 10px',
                                        fontSize: '11px',
                                        fontWeight: '750',
                                        borderRadius: '6px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: streamCategory === tab.id ? 'var(--accent-gold, #f59e0b)' : 'transparent',
                                        color: streamCategory === tab.id ? '#000000' : 'var(--text-secondary)',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div style={{ position: 'relative', minWidth: '120px', flex: '1 1 120px' }}>
                            <Search size={12} color="var(--text-secondary)" style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type="text"
                                placeholder="Filter stream..."
                                value={streamSearch}
                                onChange={(e) => setStreamSearch(e.target.value)}
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    background: 'var(--bg-surface-1, rgba(0,0,0,0.02))',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '7px',
                                    padding: '4px 8px 4px 26px',
                                    fontSize: '11px',
                                    color: 'var(--text-primary)',
                                    outline: 'none'
                                }}
                            />
                        </div>
                    </div>

                    {/* Event Rows Scroll Container */}
                    <div style={{ 
                        overflowY: 'auto', 
                        overflowX: 'hidden',
                        maxHeight: '480px', 
                        paddingRight: '4px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        minWidth: 0,
                        width: '100%'
                    }}>
                        {(() => {
                            const rawList = [
                                ...activityHistory,
                                ...activities.map(a => ({
                                    id: a.id,
                                    name: a.name,
                                    type: a.error === 'error' ? 'Security / Node' : a.error === 'warning' ? 'Alert' : 'System Event',
                                    status: a.error === 'error' ? 'Error' : a.error === 'warning' ? 'Alert' : 'Completed',
                                    timestamp: a.timestamp,
                                    error: typeof a.status === 'string' && a.status.length < 80 ? a.status : null
                                }))
                            ].filter(a => !clearedAt || (new Date(a.timestamp || 0).getTime() > clearedAt));

                            const filteredList = rawList.filter(act => {
                                const nameLow = (act.name || '').toLowerCase();
                                const typeLow = (act.type || '').toLowerCase();
                                const statusLow = (act.status || '').toLowerCase();

                                if (streamSearch) {
                                    const match = nameLow.includes(streamSearch.toLowerCase()) || 
                                                  typeLow.includes(streamSearch.toLowerCase()) ||
                                                  statusLow.includes(streamSearch.toLowerCase());
                                    if (!match) return false;
                                }

                                if (streamCategory === 'transfers') {
                                    return typeLow.includes('file') || typeLow.includes('copy') || typeLow.includes('transfer') ||
                                           nameLow.includes('copy') || nameLow.includes('.mkv') || nameLow.includes('.mp4') || nameLow.includes('.zip');
                                }
                                if (streamCategory === 'alerts') {
                                    return statusLow === 'error' || statusLow === 'alert' || statusLow === 'warning' ||
                                           typeLow.includes('security') || typeLow.includes('node') || nameLow.includes('offline');
                                }
                                return true;
                            })
                            .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
                            .slice(0, 30);

                            if (filteredList.length === 0) {
                                return (
                                    <div style={{ textAlign: 'center', padding: '50px 0', opacity: 0.5 }}>
                                        <Activity size={32} color="var(--text-secondary)" />
                                        <p style={{ fontSize: '12.5px', marginTop: '10px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                                            No fleet events matching filter
                                        </p>
                                    </div>
                                );
                            }

                            return filteredList.map((act, i) => {
                                const isSuccess = act.status === 'Completed' || act.status === 'Done';
                                const isAlert = act.status === 'Alert' || act.status === 'Warning';
                                const isError = act.status === 'Error' || act.status === 'Failed';
                                const badgeBg = isSuccess 
                                    ? 'rgba(16, 185, 129, 0.12)' 
                                    : isAlert 
                                    ? 'rgba(242, 201, 76, 0.12)' 
                                    : 'rgba(248, 81, 73, 0.12)';
                                const badgeColor = isSuccess ? '#10b981' : isAlert ? 'var(--accent-gold)' : '#f85149';

                                const nameLower = (act.name || '').toLowerCase();
                                const isCopy = nameLower.includes('copy');
                                const isOffline = nameLower.includes('offline');

                                return (
                                    <motion.div 
                                        key={act.id || i} 
                                        initial={{ opacity: 0, x: 8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.2, delay: i * 0.015 }}
                                        style={{ 
                                            padding: '11px 13px', 
                                            background: 'var(--bg-surface-1, rgba(255, 255, 255, 0.02))', 
                                            borderRadius: '10px', 
                                            border: '1px solid var(--border-subtle)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '4px',
                                            minWidth: 0,
                                            width: '100%',
                                            boxSizing: 'border-box',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', minWidth: 0, width: '100%' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                                                <div style={{
                                                    width: '28px',
                                                    height: '28px',
                                                    borderRadius: '7px',
                                                    background: badgeBg,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0
                                                }}>
                                                    {isError || isOffline ? (
                                                        <AlertTriangle size={14} color="#f85149" />
                                                    ) : isCopy ? (
                                                        <Copy size={14} color="#0ea5e9" />
                                                    ) : (
                                                        <Activity size={14} color="#10b981" />
                                                    )}
                                                </div>
                                                <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                                                    <p 
                                                        style={{ 
                                                            fontSize: '12.5px', 
                                                            margin: 0, 
                                                            fontWeight: '750', 
                                                            color: 'var(--text-primary)', 
                                                            overflow: 'hidden', 
                                                            textOverflow: 'ellipsis', 
                                                            whiteSpace: 'nowrap',
                                                            lineHeight: 1.35
                                                        }}
                                                        title={act.name}
                                                    >
                                                        {act.name}
                                                    </p>
                                                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '3px 0 0 0', fontWeight: '500', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {act.type || 'Event'} • {act.timestamp ? new Date(act.timestamp).toLocaleTimeString() : 'Just now'}
                                                    </p>
                                                </div>
                                            </div>
                                            <span style={{
                                                fontSize: '10px',
                                                padding: '3px 8px',
                                                borderRadius: '6px',
                                                fontWeight: '800',
                                                background: badgeBg,
                                                color: badgeColor,
                                                whiteSpace: 'nowrap',
                                                flexShrink: 0,
                                                letterSpacing: '0.3px'
                                            }}>
                                                {(act.status || 'DONE').toUpperCase()}
                                            </span>
                                        </div>
                                        {act.error && (
                                            <p style={{ fontSize: '10.5px', color: badgeColor, margin: '4px 0 0 38px', opacity: 0.9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.35 }}>
                                                {act.error}
                                            </p>
                                        )}
                                    </motion.div>
                                );
                            });
                        })()}
                    </div>

                    {/* Footer view all link */}
                    <div style={{ marginTop: '10px', textAlign: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                        <button
                            onClick={() => setShowFleetEventsModal(true)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--accent-gold, #f59e0b)',
                                fontSize: '11px',
                                fontWeight: '750',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            <span>Open Detailed Audit Log ({activities.length + activityHistory.length} events)</span>
                            <ArrowUpRight size={12} />
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
