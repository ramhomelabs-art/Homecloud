import React from 'react';
import { 
    Filter, Cpu, Server, Activity, Clock, Plus 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { containerVariants, itemVariants } from './UiUtils';

const ActivityItem = ({ act }) => {
    const isFailed = act.status === 'Failed';
    const isDone = act.status === 'Completed';
    const statusColor = isFailed ? '#f85149' : (isDone ? 'var(--accent-cyan)' : 'var(--accent-gold)');

    return (
        <div className="activity-item-compact" style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ fontWeight: '600', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>{act.name}</span>
                <span style={{ color: statusColor, fontSize: '10px', fontWeight: '800' }}>{act.progress}%</span>
            </div>
            <div className="st-progress-rail" style={{ height: '4px' }}>
                <div className="st-progress-fill" style={{
                    width: `${act.progress}%`,
                    background: statusColor,
                    transition: 'width 0.4s ease'
                }}></div>
            </div>
        </div>
    );
};

export default function DashboardView({
    filteredNodes = [],
    stats = { total: 0, used: 0 },
    nodeFilter = 'all',
    setNodeFilter,
    filterText,
    setFilterText,
    activeOps = [],
    activityHistory = [],
    activities = [],
    setActivityHistory
}) {
    const totalPercentage = stats.total > 0 ? Math.round((stats.used / stats.total) * 100) : 0;

    // Calculate aggregate cluster CPU and memory averages of all online approved nodes
    const onlineApprovedNodes = filteredNodes.filter(n => n.online && n.status === 'approved');
    const avgCpu = onlineApprovedNodes.length > 0
        ? Math.round(onlineApprovedNodes.reduce((sum, n) => sum + (n.cpu || 0), 0) / onlineApprovedNodes.length)
        : 0;
    const avgMemory = onlineApprovedNodes.length > 0
        ? Math.round(onlineApprovedNodes.reduce((sum, n) => sum + (n.memory || 0), 0) / onlineApprovedNodes.length)
        : 0;

    const formatGB = (gbVal) => {
        if (gbVal === undefined || gbVal === null || isNaN(gbVal)) return '0.0 GB';
        if (gbVal >= 999.9) {
            return `${(gbVal / 1024).toFixed(1)} TB`;
        }
        return `${gbVal.toFixed(1)} GB`;
    };

    return (
        <motion.div
            key="db"
            variants={containerVariants}
            initial="hidden"
            animate="show"
            exit="hidden"
        >
            <motion.div variants={itemVariants} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h2>System Intelligence</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Real-time telemetry and active operations</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div className="filter-group" style={{ display: 'flex', background: 'var(--bg-surface-2)', borderRadius: '8px', padding: '4px', border: '1px solid var(--border-dim)' }}>
                        {['all', 'master', 'agent'].map(type => (
                            <button
                                key={type}
                                onClick={() => setNodeFilter(type)}
                                style={{
                                    padding: '6px 12px',
                                    fontSize: '11px',
                                    borderRadius: '6px',
                                    background: nodeFilter === type ? 'var(--accent-gold)' : 'transparent',
                                    color: nodeFilter === type ? '#000' : '#8b949e',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: '700',
                                    textTransform: 'uppercase'
                                }}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                    <div className="filter-badge" style={{ position: 'relative' }}>
                        <Filter size={14} />
                        <input
                            value={filterText}
                            onChange={e => setFilterText(e.target.value)}
                            placeholder="Search nodes..."
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', marginLeft: '8px', width: '120px' }}
                        />
                    </div>
                </div>
            </motion.div>
            
            <div className="dashboard-main-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px' }}>
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                        <motion.div className="st-card shadow-premium" variants={itemVariants} tabIndex={0}>
                            <p className="nav-group-label" style={{ margin: 0 }}>Network Capacity</p>
                            <p style={{ fontSize: '32px', fontWeight: '900', margin: '8px 0' }}>
                                {formatGB(stats.total / 1e9)}
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                <span>{formatGB(stats.used / 1e9)} USED</span>
                                <span>{totalPercentage}%</span>
                            </div>
                            <div className="st-progress-rail">
                                <div className="st-progress-fill" style={{ width: `${totalPercentage}%`, background: totalPercentage > 90 ? '#f85149' : 'var(--accent-gold)' }}></div>
                            </div>
                        </motion.div>

                        <motion.div className="st-card shadow-premium" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', minHeight: '140px' }} variants={itemVariants} tabIndex={0}>
                            <p className="nav-group-label" style={{ margin: 0, alignSelf: 'flex-start' }}>Cluster CPU Avg</p>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', width: '100px', height: '50px', marginTop: '12px' }}>
                                <svg viewBox="0 0 100 50" style={{ width: '100px', height: '50px' }}>
                                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" strokeLinecap="round" />
                                    <motion.path 
                                        d="M 10 50 A 40 40 0 0 1 90 50" 
                                        fill="none" 
                                        stroke={avgCpu > 80 ? '#f85149' : avgCpu > 50 ? 'var(--accent-gold)' : 'var(--accent-cyan)'} 
                                        strokeWidth="8" 
                                        strokeLinecap="round"
                                        strokeDasharray="125.6"
                                        initial={{ strokeDashoffset: 125.6 }}
                                        animate={{ strokeDashoffset: 125.6 - (125.6 * (avgCpu / 100)) }}
                                        transition={{ duration: 1, ease: "easeOut" }}
                                    />
                                </svg>
                                <div style={{ position: 'absolute', bottom: '0', textAlign: 'center' }}>
                                    <span style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)' }}>{avgCpu}%</span>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div className="st-card shadow-premium" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', minHeight: '140px' }} variants={itemVariants} tabIndex={0}>
                            <p className="nav-group-label" style={{ margin: 0, alignSelf: 'flex-start' }}>Cluster RAM Avg</p>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', width: '100px', height: '50px', marginTop: '12px' }}>
                                <svg viewBox="0 0 100 50" style={{ width: '100px', height: '50px' }}>
                                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" strokeLinecap="round" />
                                    <motion.path 
                                        d="M 10 50 A 40 40 0 0 1 90 50" 
                                        fill="none" 
                                        stroke={avgMemory > 80 ? '#f85149' : avgMemory > 50 ? 'var(--accent-gold)' : 'var(--accent-cyan)'} 
                                        strokeWidth="8" 
                                        strokeLinecap="round"
                                        strokeDasharray="125.6"
                                        initial={{ strokeDashoffset: 125.6 }}
                                        animate={{ strokeDashoffset: 125.6 - (125.6 * (avgMemory / 100)) }}
                                        transition={{ duration: 1, ease: "easeOut" }}
                                    />
                                </svg>
                                <div style={{ position: 'absolute', bottom: '0', textAlign: 'center' }}>
                                    <span style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)' }}>{avgMemory}%</span>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div className="st-card shadow-premium" variants={itemVariants} tabIndex={0}>
                            <p className="nav-group-label" style={{ margin: 0 }}>Active Nodes</p>
                            <p style={{ fontSize: '32px', fontWeight: '900', margin: '8px 0' }}>{filteredNodes.length}</p>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                {filteredNodes.map((n, i) => (
                                    <div key={i} className="online-dot" style={{ background: n.online ? '#3fb950' : '#f85149', boxShadow: n.online ? '0 0 6px #3fb950' : 'none' }}></div>
                                ))}
                            </div>
                        </motion.div>
                    </div>

                    <div style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {filteredNodes.map((node, nIdx) => {
                            const isOnline = node.online;
                            const isMaster = node.type === 'Master';
                            return (
                                <motion.div 
                                    key={node.hostname || nIdx} 
                                    className="st-card shadow-premium" 
                                    variants={itemVariants} 
                                    style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border-dim)', borderRadius: '12px', padding: '16px 20px', outline: 'none' }}
                                >
                                    {/* Node Header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            {isMaster ? <Cpu size={18} color="var(--accent-gold)" /> : <Server size={18} color="var(--accent-cyan)" />}
                                            <div>
                                                <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>{node.hostname}</span>
                                                <span style={{ fontSize: '9px', color: 'var(--text-secondary)', marginLeft: '8px', textTransform: 'uppercase', background: 'var(--bg-surface-2)', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                                                    {node.type}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                background: isOnline ? '#3fb950' : '#f85149',
                                                boxShadow: isOnline ? '0 0 8px #3fb950' : 'none'
                                            }} className={isOnline ? 'pulse-dot' : ''}></span>
                                            <span style={{ fontSize: '11px', color: isOnline ? '#3fb950' : '#f85149', fontWeight: 'bold' }}>
                                                {isOnline ? 'ONLINE' : 'OFFLINE'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Info and Platform details */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '11px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '12px' }}>
                                        <div>
                                            <span style={{ display: 'block', fontSize: '9px', textTransform: 'uppercase', color: '#484f58', fontWeight: '800', marginBottom: '2px' }}>PLATFORM / OS</span>
                                            <strong style={{ color: 'var(--text-secondary)' }}>{node.platform || 'Linux'}</strong>
                                        </div>
                                        <div>
                                            <span style={{ display: 'block', fontSize: '9px', textTransform: 'uppercase', color: '#484f58', fontWeight: '800', marginBottom: '2px' }}>ADDRESS</span>
                                            <strong style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                                {node.ip
                                                    ? `${node.ip}${isMaster ? ' (Local)' : ''}`
                                                    : isMaster
                                                        ? 'Local'
                                                        : (node.url || '').replace(/^https?:\/\//, '')}
                                            </strong>
                                        </div>
                                    </div>

                                    {/* Live CPU & RAM utilization if online */}
                                    {isOnline && (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '14px' }}>
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                                                    <span>CPU LOAD</span>
                                                    <strong style={{ color: 'var(--text-primary)' }}>{node.cpu || 0}%</strong>
                                                </div>
                                                <div className="st-progress-rail" style={{ height: '4px' }}>
                                                    <div className="st-progress-fill" style={{ width: `${node.cpu || 0}%`, background: (node.cpu || 0) > 80 ? '#f85149' : 'var(--accent-gold)' }}></div>
                                                </div>
                                            </div>
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                                                    <span>RAM USAGE</span>
                                                    <strong style={{ color: 'var(--text-primary)' }}>{node.memory || 0}%</strong>
                                                </div>
                                                <div className="st-progress-rail" style={{ height: '4px' }}>
                                                    <div className="st-progress-fill" style={{ width: `${node.memory || 0}%`, background: (node.memory || 0) > 80 ? '#f85149' : 'var(--accent-cyan)' }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Storage Disks attached to the node */}
                                    <div>
                                        <span style={{ display: 'block', fontSize: '9px', textTransform: 'uppercase', color: '#484f58', fontWeight: '800', marginBottom: '6px' }}>MOUNTED VOLUMES</span>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {(node.disks || []).map((d, dIdx) => (
                                                <div key={dIdx} style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', padding: '8px 12px', borderRadius: '6px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                                                        <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{d.mount}</span>
                                                        <span style={{ color: 'var(--text-secondary)' }}>
                                                            {formatGB(d.used / 1e9)} / {formatGB(d.size / 1e9)}
                                                        </span>
                                                    </div>
                                                    <div className="st-progress-rail" style={{ margin: '6px 0 0', height: '4px' }}>
                                                        <div className="st-progress-fill" style={{ width: `${d.percentage || 0}%`, background: (d.percentage || 0) > 90 ? '#f85149' : 'var(--accent-cyan)' }}></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                <motion.div 
                    className="st-card shadow-premium" 
                    style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        height: '750px',
                        maxHeight: '750px',
                        overflow: 'hidden',
                        background: 'var(--bg-surface-0)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '18px',
                        padding: '20px',
                        boxSizing: 'border-box'
                    }} 
                    variants={itemVariants} 
                    tabIndex={0}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Activity size={18} color="var(--accent-gold)" />
                            <h3 style={{ fontSize: '18px' }}>Active & Recent</h3>
                        </div>
                        <button onClick={() => setActivityHistory([])} style={{ background: 'transparent', border: 'none', color: '#484f58', cursor: 'pointer', fontSize: '11px' }}>Clear</button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '12px', minHeight: 0 }}>
                        {activeOps.length > 0 && (
                            <div style={{ marginBottom: '24px' }}>
                                <p style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '800', marginBottom: '12px', letterSpacing: '1px' }}>IN PROGRESS</p>
                                {activeOps.map(act => <ActivityItem key={act.id} act={act} />)}
                            </div>
                        )}

                        <div>
                            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '800', marginBottom: '12px', letterSpacing: '1px' }}>ACTIVITY STREAM & AUDIT LOGS</p>
                            {(() => {
                                const combinedActivities = [
                                    ...activityHistory,
                                    ...activities.map(a => ({
                                        id: a.id,
                                        name: a.name,
                                        type: a.error === 'error' ? 'Security / Node' : a.error === 'warning' ? 'Warning' : 'System Action',
                                        status: a.error === 'error' ? 'Error' : a.error === 'warning' ? 'Alert' : 'Completed',
                                        timestamp: a.timestamp,
                                        error: typeof a.status === 'string' && a.status.length < 80 ? a.status : null
                                    }))
                                ].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)).slice(0, 25);

                                if (combinedActivities.length === 0) {
                                    return (
                                        <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.4 }}>
                                            <Clock size={32} />
                                            <p style={{ fontSize: '12px', marginTop: '12px' }}>No recent activity logged</p>
                                        </div>
                                    );
                                }

                                return combinedActivities.map((act, i) => {
                                    const isSuccess = act.status === 'Completed';
                                    const isAlert = act.status === 'Alert' || act.status === 'Warning';
                                    const badgeBg = isSuccess 
                                        ? 'rgba(63, 185, 80, 0.12)' 
                                        : isAlert 
                                        ? 'rgba(242, 201, 76, 0.12)' 
                                        : 'rgba(248, 81, 73, 0.12)';
                                    const badgeColor = isSuccess ? '#3fb950' : isAlert ? 'var(--accent-gold)' : '#f85149';

                                    return (
                                        <div key={act.id || i} className="history-item" style={{ marginBottom: '12px', padding: '12px 14px', background: 'var(--bg-surface-2)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <p style={{ fontSize: '13px', margin: 0, fontWeight: '700', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {act.name}
                                                    </p>
                                                    <p style={{ fontSize: '10.5px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                                                        {act.type || 'Event'} • {act.timestamp ? new Date(act.timestamp).toLocaleTimeString() : 'Just now'}
                                                    </p>
                                                </div>
                                                <span style={{
                                                    fontSize: '9px',
                                                    padding: '3px 8px',
                                                    borderRadius: '6px',
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
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}
