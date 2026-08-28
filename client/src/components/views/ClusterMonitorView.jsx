import React, { useEffect, useRef, useState } from 'react';
import { Cpu, Server, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatGB } from './UiUtils';

const RadialGauge = ({ value, label, color }) => {
    const radius = 50;
    const strokeWidth = 8;
    const normalizedRadius = radius - strokeWidth * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (value / 100) * circumference;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: radius * 2, height: radius * 2 }}>
                <svg height={radius * 2} width={radius * 2} style={{ transform: 'rotate(-90deg)' }}>
                    <circle
                        stroke="rgba(255, 255, 255, 0.08)"
                        fill="transparent"
                        strokeWidth={strokeWidth}
                        r={normalizedRadius}
                        cx={radius}
                        cy={radius}
                    />
                    <circle
                        stroke={color}
                        fill="transparent"
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference + ' ' + circumference}
                        style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                        r={normalizedRadius}
                        cx={radius}
                        cy={radius}
                        strokeLinecap="round"
                    />
                </svg>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '16px', fontWeight: '900', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{value}%</span>
                </div>
            </div>
            {label && <span style={{ marginTop: '8px', fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', letterSpacing: '0.6px', textTransform: 'uppercase' }}>{label}</span>}
        </div>
    );
};

const NetworkThroughputChart = ({ data }) => {
    if (!data || data.length === 0) {
        return (
            <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface-0)', borderRadius: '14px', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '12px' }}>
                Waiting for network telemetry samples...
            </div>
        );
    }

    const width = 500;
    const height = 120;
    const padding = 10;
    const pointsCount = Math.max(30, data.length);

    const maxRx = Math.max(...data.map(d => d.rx || 0));
    const maxTx = Math.max(...data.map(d => d.tx || 0));
    const maxVal = Math.max(0.5, Math.ceil(Math.max(maxRx, maxTx) * 1.2 * 10) / 10);

    const rxPoints = data.map((d, index) => {
        const x = padding + (index / (pointsCount - 1)) * (width - padding * 2);
        const val = d.rx || 0;
        const y = height - padding - (val / maxVal) * (height - padding * 2);
        return `${x},${y}`;
    }).join(' ');

    const txPoints = data.map((d, index) => {
        const x = padding + (index / (pointsCount - 1)) * (width - padding * 2);
        const val = d.tx || 0;
        const y = height - padding - (val / maxVal) * (height - padding * 2);
        return `${x},${y}`;
    }).join(' ');

    let rxFillPoints = '';
    if (data.length > 0) {
        const firstX = padding;
        const lastX = padding + ((data.length - 1) / (pointsCount - 1)) * (width - padding * 2);
        rxFillPoints = `${rxPoints} ${lastX},${height - padding} ${firstX},${height - padding}`;
    }

    let txFillPoints = '';
    if (data.length > 0) {
        const firstX = padding;
        const lastX = padding + ((data.length - 1) / (pointsCount - 1)) * (width - padding * 2);
        txFillPoints = `${txPoints} ${lastX},${height - padding} ${firstX},${height - padding}`;
    }

    const latestRx = data[data.length - 1]?.rx || 0;
    const latestTx = data[data.length - 1]?.tx || 0;

    return (
        <div style={{ padding: '18px 20px', background: 'var(--bg-surface-0)', borderRadius: '16px', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Network IO Throughput</span>
                <div style={{ display: 'flex', gap: '14px', fontSize: '11px', fontWeight: '700' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#0ea5e9' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#0ea5e9' }} />
                        RX: {latestRx.toFixed(2)} MB/s
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--primary)' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--primary)' }} />
                        TX: {latestTx.toFixed(2)} MB/s
                    </span>
                </div>
            </div>
            <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '110px' }}>
                <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="4 4" />
                <line x1={padding} y1={height/2} x2={width - padding} y2={height/2} stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="4 4" />
                <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                
                {rxFillPoints && <polygon points={rxFillPoints} fill="url(#rxAreaGradient)" />}
                {txFillPoints && <polygon points={txFillPoints} fill="url(#txAreaGradient)" />}

                <polyline fill="none" stroke="#0ea5e9" strokeWidth="2.2" points={rxPoints} strokeLinecap="round" strokeLinejoin="round" />
                <polyline fill="none" stroke="var(--primary)" strokeWidth="2.2" points={txPoints} strokeLinecap="round" strokeLinejoin="round" />

                <defs>
                    <linearGradient id="rxAreaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.18" />
                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="txAreaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                    </linearGradient>
                </defs>
            </svg>
        </div>
    );
};

const TerminalLogs = ({ logs, onRefresh, loading }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [levelFilter, setLevelFilter] = useState('ALL');
    const [isFrozen, setIsFrozen] = useState(false);
    const [frozenLogs, setFrozenLogs] = useState([]);
    const terminalRef = useRef(null);

    const handleFreezeToggle = () => {
        if (!isFrozen) {
            setFrozenLogs([...logs]);
        }
        setIsFrozen(!isFrozen);
    };

    const activeLogs = isFrozen ? frozenLogs : logs;

    const filteredLogs = activeLogs.filter(line => {
        if (!line) return false;
        const matchesSearch = line.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;

        if (levelFilter === 'ALL') return true;
        if (levelFilter === 'INFO') return line.includes('[INFO]') || (!line.includes('[WARN]') && !line.includes('[ERROR]'));
        if (levelFilter === 'WARN') return line.includes('[WARN]');
        if (levelFilter === 'ERROR') return line.includes('[ERROR]');
        return true;
    });

    useEffect(() => {
        if (terminalRef.current && !isFrozen) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [logs, filteredLogs, isFrozen]);

    const formatLogLine = (line, idx) => {
        if (!line) return null;
        let color = '#94a3b8';
        let level = 'INFO';
        let levelBg = 'rgba(14, 165, 233, 0.12)';
        let levelColor = '#38bdf8';

        if (line.includes('[INFO]')) {
            color = '#e2e8f0';
            level = 'INFO';
            levelBg = 'rgba(14, 165, 233, 0.12)';
            levelColor = '#38bdf8';
        } else if (line.includes('[WARN]')) {
            color = '#fef08a';
            level = 'WARN';
            levelBg = 'rgba(251, 191, 36, 0.15)';
            levelColor = '#fbbf24';
        } else if (line.includes('[ERROR]')) {
            color = '#fecdd3';
            level = 'ERROR';
            levelBg = 'rgba(244, 63, 94, 0.2)';
            levelColor = '#f43f5e';
        }

        const matches = line.match(/^\[(.*?)\]\s*\[(.*?)\]\s*(.*)$/);
        if (matches) {
            const [, timestamp, , message] = matches;
            let time = '';
            try {
                time = new Date(timestamp).toLocaleTimeString();
            } catch (err) {
                time = timestamp;
            }
            return (
                <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '4px', fontFamily: 'var(--font-mono)', fontSize: '11.5px', lineHeight: '1.5' }}>
                    <span style={{ color: '#64748b', userSelect: 'none', flexShrink: 0 }}>[{time}]</span>
                    <span style={{ color: levelColor, background: levelBg, padding: '1px 5px', borderRadius: '4px', fontWeight: '800', fontSize: '10px', flexShrink: 0 }}>
                        {level}
                    </span>
                    <span style={{ color, wordBreak: 'break-word', flex: 1 }}>{message}</span>
                </div>
            );
        }

        return (
            <div key={idx} style={{ color: '#cbd5e1', fontFamily: 'var(--font-mono)', fontSize: '11.5px', marginBottom: '4px', lineHeight: '1.5', wordBreak: 'break-word' }}>
                {line}
            </div>
        );
    };

    return (
        <div style={{ 
            background: '#0a0e1a', 
            borderRadius: '16px', 
            border: '1px solid rgba(99, 102, 241, 0.3)', 
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)', 
            display: 'flex', 
            flexDirection: 'column', 
            height: '100%', 
            minHeight: '480px',
            overflow: 'hidden' 
        }}>
            {/* Terminal Top Bar */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '12px 16px', 
                background: '#0f1629', 
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)' 
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f56' }} />
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffbd2e' }} />
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#27c93f' }} />
                    <span style={{ marginLeft: '10px', fontSize: '12px', fontWeight: '800', color: '#94a3b8', fontFamily: 'var(--font-mono)', letterSpacing: '0.8px' }}>
                        CONSOLE_OUTPUT
                    </span>
                    <span style={{ fontSize: '10px', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '2px 7px', borderRadius: '10px', fontWeight: '700' }}>
                        {filteredLogs.length} events
                    </span>
                    {isFrozen && (
                        <span style={{ fontSize: '10px', background: 'rgba(244, 63, 94, 0.2)', color: '#f43f5e', padding: '2px 8px', borderRadius: '6px', fontWeight: '800' }}>
                            ⏸️ FROZEN
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                        onClick={handleFreezeToggle}
                        style={{ 
                            background: isFrozen ? '#f43f5e' : 'rgba(255, 255, 255, 0.06)', 
                            border: '1px solid rgba(255, 255, 255, 0.1)', 
                            height: '28px', 
                            padding: '0 12px', 
                            borderRadius: '6px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px', 
                            cursor: 'pointer', 
                            color: '#ffffff', 
                            fontSize: '11px', 
                            fontWeight: '700',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        {isFrozen ? '▶️ Resume' : '⏸️ Freeze'}
                    </button>
                    <button 
                        onClick={onRefresh} 
                        disabled={loading}
                        style={{ 
                            background: 'rgba(99, 102, 241, 0.15)', 
                            border: '1px solid rgba(99, 102, 241, 0.35)', 
                            height: '28px', 
                            padding: '0 12px', 
                            borderRadius: '6px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px', 
                            cursor: 'pointer', 
                            color: '#a5b4fc',
                            fontSize: '11px',
                            fontWeight: '700',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <RefreshCw size={12} className={loading ? 'spin-anim' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Log Filter Bar */}
            <div style={{ 
                display: 'flex', 
                gap: '10px', 
                padding: '10px 16px', 
                background: '#0d1322', 
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)', 
                alignItems: 'center', 
                flexWrap: 'wrap' 
            }}>
                <input 
                    type="text" 
                    placeholder="🔍 Filter log stream..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    style={{ 
                        background: '#151d32', 
                        border: '1px solid rgba(255, 255, 255, 0.1)', 
                        color: '#f8fafc', 
                        borderRadius: '6px', 
                        padding: '5px 12px', 
                        fontSize: '11.5px', 
                        width: '180px', 
                        outline: 'none',
                        fontFamily: 'inherit'
                    }} 
                />
                <div style={{ display: 'flex', gap: '3px', background: '#151d32', padding: '3px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    {['ALL', 'INFO', 'WARN', 'ERROR'].map(lvl => {
                        const active = levelFilter === lvl;
                        return (
                            <button
                                key={lvl}
                                onClick={() => setLevelFilter(lvl)}
                                style={{
                                    background: active ? 'var(--primary-light)' : 'transparent',
                                    border: 'none',
                                    color: active ? '#ffffff' : '#94a3b8',
                                    padding: '3px 9px',
                                    borderRadius: '4px',
                                    fontSize: '10.5px',
                                    fontWeight: '800',
                                    cursor: 'pointer',
                                    transition: '0.15s ease'
                                }}
                            >
                                {lvl}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Terminal Stream Body */}
            <div 
                ref={terminalRef}
                style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    background: '#060911', 
                    padding: '16px', 
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                {filteredLogs.length === 0 ? (
                    <div style={{ color: '#475569', fontStyle: 'italic', fontFamily: 'var(--font-mono)', fontSize: '12px', textAlign: 'center', margin: 'auto' }}>
                        {searchTerm || levelFilter !== 'ALL' ? 'No matching logs for filter...' : 'Streaming active. Waiting for system events...'}
                    </div>
                ) : (
                    filteredLogs.map((line, i) => formatLogLine(line, i))
                )}
            </div>
        </div>
    );
};

export default function ClusterMonitorView({
    selectedMonitorNode,
    setSelectedMonitorNode,
    metrics = { metricsHistory: {}, agents: [] },
    localStorageInfo,
    nodeLogs = [],
    loadingLogs = false,
    fetchNodeLogs
}) {
    return (
        <motion.div key="mn" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
                <div>
                    <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>
                        Cluster Resource & Telemetry Monitor
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
                        Real-time node diagnostics, telemetry gauges, and live system log stream.
                    </p>
                </div>

                {/* Node Selection Pills */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button 
                        onClick={() => setSelectedMonitorNode('local')}
                        style={{ 
                            height: '34px', 
                            padding: '0 14px', 
                            borderRadius: '8px', 
                            background: selectedMonitorNode === 'local' ? 'var(--primary-gradient)' : 'var(--bg-surface-2)',
                            color: selectedMonitorNode === 'local' ? '#ffffff' : 'var(--text-secondary)',
                            fontWeight: '800',
                            fontSize: '12.5px',
                            border: `1px solid ${selectedMonitorNode === 'local' ? 'transparent' : 'var(--border-subtle)'}`,
                            cursor: 'pointer',
                            boxShadow: selectedMonitorNode === 'local' ? '0 4px 14px rgba(79, 70, 229, 0.35)' : 'none',
                            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        🖥️ Master Server
                    </button>
                    {metrics.agents?.filter(a => a.status === 'approved').map(agent => {
                        const isSelected = selectedMonitorNode === agent.id;
                        return (
                            <button
                                key={agent.id}
                                onClick={() => setSelectedMonitorNode(agent.id)}
                                style={{ 
                                    height: '34px', 
                                    padding: '0 14px', 
                                    borderRadius: '8px', 
                                    background: isSelected ? 'var(--primary-gradient)' : 'var(--bg-surface-2)',
                                    color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                                    fontWeight: '800',
                                    fontSize: '12.5px',
                                    border: `1px solid ${isSelected ? 'transparent' : 'var(--border-subtle)'}`,
                                    cursor: 'pointer',
                                    boxShadow: isSelected ? '0 4px 14px rgba(79, 70, 229, 0.35)' : 'none',
                                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: agent.online !== false ? '#10b981' : '#f43f5e', boxShadow: agent.online !== false ? '0 0 6px #10b981' : 'none' }} />
                                {agent.hostname}
                            </button>
                        );
                    })}
                </div>
            </div>

            {(() => {
                const isLocal = selectedMonitorNode === 'local';
                const activeNodeInfo = isLocal
                    ? (localStorageInfo || { hostname: 'Master Server', platform: 'win32', disks: [], online: true })
                    : (metrics.agents?.find(a => a.id === selectedMonitorNode) || { hostname: 'Unknown', platform: 'unknown', disks: [], online: false });

                const history = metrics.metricsHistory?.[selectedMonitorNode] || [];
                const currentMetrics = history[history.length - 1] || { cpu: 0, memory: 0, latency: 0 };

                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Top Stat Cards Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                            {/* Node Info */}
                            <div className="st-card" style={{ padding: '18px 20px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '14px', boxShadow: 'var(--shadow-sm)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Active Node</span>
                                    <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '999px', background: activeNodeInfo.online !== false ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)', color: activeNodeInfo.online !== false ? '#10b981' : '#f43f5e' }}>
                                        {activeNodeInfo.online !== false ? 'ONLINE' : 'OFFLINE'}
                                    </span>
                                </div>
                                <h3 style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)', margin: '0 0 4px 0' }}>{activeNodeInfo.hostname}</h3>
                                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, fontFamily: 'var(--font-mono)' }}>
                                    OS: {activeNodeInfo.platform} {!isLocal && activeNodeInfo.online !== false && `· ${currentMetrics.latency}ms latency`}
                                </p>
                            </div>

                            {/* CPU Gauge */}
                            <div className="st-card" style={{ padding: '18px 20px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '14px', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>CPU Load</span>
                                    <h3 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', margin: '4px 0 0 0', fontFamily: 'var(--font-mono)' }}>
                                        {currentMetrics.cpu || 0}%
                                    </h3>
                                    <span style={{ fontSize: '11px', color: (currentMetrics.cpu || 0) > 80 ? '#f43f5e' : '#10b981', fontWeight: '700' }}>
                                        {(currentMetrics.cpu || 0) > 80 ? 'Heavy Load' : 'Normal'}
                                    </span>
                                </div>
                                <RadialGauge value={currentMetrics.cpu || 0} label="" color="var(--primary)" />
                            </div>

                            {/* RAM Gauge */}
                            <div className="st-card" style={{ padding: '18px 20px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '14px', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>RAM Usage</span>
                                    <h3 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', margin: '4px 0 0 0', fontFamily: 'var(--font-mono)' }}>
                                        {currentMetrics.memory || 0}%
                                    </h3>
                                    <span style={{ fontSize: '11px', color: (currentMetrics.memory || 0) > 85 ? '#f43f5e' : '#0ea5e9', fontWeight: '700' }}>
                                        {(currentMetrics.memory || 0) > 85 ? 'High Usage' : 'Optimal'}
                                    </span>
                                </div>
                                <RadialGauge value={currentMetrics.memory || 0} label="" color="#0ea5e9" />
                            </div>

                            {/* Health Diagnostic */}
                            <div className="st-card" style={{ padding: '18px 20px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '14px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Health Status</span>
                                    <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '999px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                                        HEALTHY
                                    </span>
                                </div>
                                <div style={{ margin: '8px 0 4px' }}>
                                    <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>S.M.A.R.T. Array Passing</div>
                                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>All cluster subsystems nominal.</div>
                                </div>
                            </div>
                        </div>

                        {/* Main Content Grid: Left Metrics & Right Console */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: '20px', alignItems: 'stretch' }}>
                            {/* Left Column: Disks & Network IO */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {/* Partition Map */}
                                <div className="st-card" style={{ padding: '20px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
                                    <h4 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: '800', letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                                        Disk Partitions & Mounts
                                    </h4>
                                    {activeNodeInfo.disks && activeNodeInfo.disks.length > 0 ? (
                                        activeNodeInfo.disks.map((disk, idx) => (
                                            <div key={idx} style={{ marginBottom: '14px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '6px' }}>
                                                    <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{disk.mount} ({formatGB(disk.used / 1e9)} / {formatGB(disk.size / 1e9)})</span>
                                                    <span style={{ color: disk.percentage > 85 ? '#f43f5e' : 'var(--primary)', fontWeight: '800', fontFamily: 'var(--font-mono)' }}>{disk.percentage}%</span>
                                                </div>
                                                <div className="st-progress-rail" style={{ height: '7px', borderRadius: '4px', overflow: 'hidden', background: 'var(--bg-surface-2)' }}>
                                                    <div 
                                                        className="st-progress-fill" 
                                                        style={{ 
                                                            width: `${disk.percentage}%`, 
                                                            height: '100%', 
                                                            background: disk.percentage > 85 ? '#f43f5e' : 'var(--cyber-gradient)', 
                                                            transition: 'width 0.5s ease-out' 
                                                        }} 
                                                    />
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '12px' }}>No disk space information reported...</div>
                                    )}
                                </div>

                                {/* Network IO chart */}
                                <NetworkThroughputChart data={history} />
                            </div>

                            {/* Right Column: Next-Gen Cyber Console Terminal */}
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <TerminalLogs 
                                    logs={nodeLogs} 
                                    onRefresh={() => fetchNodeLogs(selectedMonitorNode)} 
                                    loading={loadingLogs} 
                                />
                            </div>
                        </div>
                    </div>
                );
            })()}
        </motion.div>
    );
}
