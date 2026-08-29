import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, HardDrive, RefreshCw, Server, Globe, Database, 
    Layers, Disc, CheckCircle2, AlertTriangle, ArrowUpRight,
    PieChart, ExternalLink, Activity
} from 'lucide-react';

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export default function ClusterStorageModal({
    isOpen,
    onClose,
    mounts = [],
    localStorageInfo,
    agentStorage = [],
    networkShares = [],
    onRefresh,
    navigateTo,
    onOpenHeatmap
}) {
    const [filter, setFilter] = useState('all'); // 'all', 'local', 'agent', 'network'
    const [isRefreshing, setIsRefreshing] = useState(false);

    if (!isOpen) return null;

    const grandTotalCapacity = mounts.reduce((sum, m) => sum + (m.size || 0), 0);
    const grandTotalUsed = mounts.reduce((sum, m) => sum + (m.used || 0), 0);
    const grandTotalFree = Math.max(0, grandTotalCapacity - grandTotalUsed);
    const totalPercentage = grandTotalCapacity > 0 ? Math.round((grandTotalUsed / grandTotalCapacity) * 100) : 0;

    const handleSync = async () => {
        setIsRefreshing(true);
        if (onRefresh) await onRefresh();
        setTimeout(() => setIsRefreshing(false), 500);
    };

    const filteredMounts = mounts.filter(m => {
        if (filter === 'local') return m.type?.toLowerCase().includes('local') || m.id?.startsWith('local');
        if (filter === 'agent') return m.type?.toLowerCase().includes('agent') || m.id?.startsWith('agent');
        if (filter === 'network') return m.type?.toLowerCase().includes('network') || m.type?.toLowerCase().includes('cloud') || m.id?.startsWith('net');
        return true;
    });

    const localCount = mounts.filter(m => m.id?.startsWith('local')).length;
    const agentCount = mounts.filter(m => m.id?.startsWith('agent')).length;
    const networkCount = mounts.filter(m => m.id?.startsWith('net')).length;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(10px)',
            zIndex: 3500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            <div 
                style={{ position: 'absolute', inset: 0 }} 
                onClick={onClose} 
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ type: 'spring', damping: 25, stiffness: 280 }}
                style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '860px',
                    maxHeight: '90vh',
                    background: 'var(--bg-surface-0, #1e222b)',
                    border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                    borderRadius: '20px',
                    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    zIndex: 2
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '20px 24px',
                    borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                    background: 'var(--bg-surface-1, rgba(255,255,255,0.02))'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 6px 16px rgba(245, 158, 11, 0.3)'
                        }}>
                            <HardDrive size={22} color="#ffffff" />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '850', color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                                    Cluster Storage & Disks Pool
                                </h3>
                                <span style={{
                                    fontSize: '10px',
                                    fontWeight: '800',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    background: 'rgba(245, 158, 11, 0.15)',
                                    color: '#f59e0b',
                                    border: '1px solid rgba(245, 158, 11, 0.3)'
                                }}>
                                    {mounts.length} VOLUMES
                                </span>
                            </div>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                Real-time partition telemetry, agent storage nodes, and cloud network shares
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                            onClick={handleSync}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'var(--bg-surface-2, rgba(255,255,255,0.06))',
                                border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                                color: 'var(--text-primary)',
                                padding: '7px 14px',
                                borderRadius: '9px',
                                fontSize: '12px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                            title="Synchronize live storage pools"
                        >
                            <RefreshCw size={14} className={isRefreshing ? 'spin-anim' : ''} color="var(--accent-gold, #f59e0b)" />
                            <span>{isRefreshing ? 'Updating...' : 'Sync Now'}</span>
                        </button>
                        <button
                            onClick={onClose}
                            style={{
                                background: 'var(--bg-surface-2, rgba(255,255,255,0.06))',
                                border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                                color: 'var(--text-secondary)',
                                width: '32px',
                                height: '32px',
                                borderRadius: '9px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                            }}
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Storage Overview Strip */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.04), rgba(6, 182, 212, 0.04))'
                }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                        <div style={{
                            background: 'var(--bg-surface-1, rgba(255,255,255,0.03))',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            border: '1px solid var(--border-subtle)'
                        }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase' }}>Total Capacity</span>
                            <div style={{ fontSize: '20px', fontWeight: '850', color: 'var(--text-primary)', marginTop: '2px' }}>
                                {formatBytes(grandTotalCapacity)}
                            </div>
                        </div>

                        <div style={{
                            background: 'var(--bg-surface-1, rgba(255,255,255,0.03))',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            border: '1px solid var(--border-subtle)'
                        }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase' }}>Allocated / Used</span>
                            <div style={{ fontSize: '20px', fontWeight: '850', color: '#f59e0b', marginTop: '2px' }}>
                                {formatBytes(grandTotalUsed)}
                            </div>
                        </div>

                        <div style={{
                            background: 'var(--bg-surface-1, rgba(255,255,255,0.03))',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            border: '1px solid var(--border-subtle)'
                        }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase' }}>Available Free</span>
                            <div style={{ fontSize: '20px', fontWeight: '850', color: '#10b981', marginTop: '2px' }}>
                                {formatBytes(grandTotalFree)}
                            </div>
                        </div>

                        <div style={{
                            background: 'var(--bg-surface-1, rgba(255,255,255,0.03))',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            border: '1px solid var(--border-subtle)'
                        }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase' }}>Cluster Utilization</span>
                            <div style={{ fontSize: '20px', fontWeight: '850', color: totalPercentage > 85 ? '#ef4444' : 'var(--text-primary)', marginTop: '2px' }}>
                                {totalPercentage}%
                            </div>
                        </div>
                    </div>

                    {/* Master Bar */}
                    <div style={{
                        height: '10px',
                        borderRadius: '5px',
                        background: 'rgba(255,255,255,0.08)',
                        overflow: 'hidden',
                        display: 'flex'
                    }}>
                        <div 
                            style={{
                                width: `${totalPercentage}%`,
                                background: totalPercentage > 85 
                                    ? 'linear-gradient(90deg, #f59e0b, #ef4444)' 
                                    : 'linear-gradient(90deg, #10b981, #f59e0b)',
                                transition: 'width 0.6s ease'
                            }}
                        />
                    </div>
                </div>

                {/* Filter Tabs Strip */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 24px',
                    borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
                    background: 'var(--bg-surface-1, rgba(0,0,0,0.02))'
                }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {[
                            { id: 'all', label: `All Drives (${mounts.length})` },
                            { id: 'local', label: `Master Disks (${localCount})` },
                            { id: 'agent', label: `Remote Agents (${agentCount})` },
                            { id: 'network', label: `Network / Cloud (${networkCount})` }
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setFilter(t.id)}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    fontSize: '11.5px',
                                    fontWeight: '750',
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: filter === t.id ? 'var(--accent-gold, #f59e0b)' : 'transparent',
                                    color: filter === t.id ? '#000000' : 'var(--text-secondary)',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {onOpenHeatmap && (
                        <button
                            onClick={() => {
                                onClose();
                                onOpenHeatmap();
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'transparent',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-secondary)',
                                padding: '5px 10px',
                                borderRadius: '8px',
                                fontSize: '11px',
                                fontWeight: '700',
                                cursor: 'pointer'
                            }}
                        >
                            <PieChart size={13} color="var(--accent-cyan, #06b6d4)" />
                            <span>Storage Treemap</span>
                        </button>
                    )}
                </div>

                {/* Volumes Scroll List */}
                <div style={{
                    padding: '16px 24px',
                    overflowY: 'auto',
                    maxHeight: '420px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                }}>
                    {filteredMounts.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.6 }}>
                            <HardDrive size={36} color="var(--text-secondary)" />
                            <p style={{ fontSize: '13px', marginTop: '10px', color: 'var(--text-secondary)' }}>
                                No storage volumes found for this category.
                            </p>
                        </div>
                    ) : (
                        filteredMounts.map((m, idx) => {
                            const isNet = m.id?.startsWith('net') || m.type?.toLowerCase().includes('network') || m.type?.toLowerCase().includes('cloud');
                            const isAgent = m.id?.startsWith('agent');
                            const iconColor = isNet ? '#10b981' : isAgent ? '#f59e0b' : '#0ea5e9';
                            const iconBg = isNet ? 'rgba(16, 185, 129, 0.12)' : isAgent ? 'rgba(245, 158, 11, 0.12)' : 'rgba(14, 165, 233, 0.12)';
                            const pct = Math.min(100, Math.max(0, m.percentage || 0));

                            return (
                                <motion.div
                                    key={m.id || idx}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2, delay: idx * 0.02 }}
                                    style={{
                                        background: 'var(--bg-surface-1, rgba(255,255,255,0.02))',
                                        border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
                                        borderRadius: '14px',
                                        padding: '14px 18px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '10px',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '10px',
                                                background: iconBg,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                {isNet ? <Globe size={18} color={iconColor} /> : isAgent ? <Server size={18} color={iconColor} /> : <HardDrive size={18} color={iconColor} />}
                                            </div>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                                        {m.label || m.name}
                                                    </span>
                                                    <span style={{
                                                        fontSize: '9.5px',
                                                        fontWeight: '800',
                                                        padding: '1px 6px',
                                                        borderRadius: '5px',
                                                        background: iconBg,
                                                        color: iconColor,
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        {m.type}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', fontFamily: 'monospace' }}>
                                                    {m.name} {m.nodeName ? `• ${m.nodeName}` : ''}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '14px', fontWeight: '850', color: 'var(--text-primary)' }}>
                                                {pct}%
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                                                {formatBytes(m.used)} / {formatBytes(m.size)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Progress Rail */}
                                    <div style={{
                                        height: '6px',
                                        borderRadius: '3px',
                                        background: 'rgba(255,255,255,0.06)',
                                        overflow: 'hidden',
                                        display: 'flex'
                                    }}>
                                        <div 
                                            style={{
                                                width: `${pct}%`,
                                                background: pct > 90 ? '#ef4444' : (pct > 75 ? '#f59e0b' : iconColor),
                                                transition: 'width 0.4s ease'
                                            }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                        <span>Available: <strong style={{ color: '#10b981' }}>{formatBytes(m.free)}</strong></span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: m.online !== false ? '#10b981' : '#ef4444' }} />
                                            <span>{m.online !== false ? 'Mounted & Online' : 'Offline / Unreachable'}</span>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '14px 24px',
                    borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                    background: 'var(--bg-surface-1, rgba(255,255,255,0.02))',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                        Connected Volumes: <strong style={{ color: 'var(--text-primary)' }}>{mounts.filter(m => m.online !== false).length}</strong> of {mounts.length} Active
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'var(--accent-gold, #f59e0b)',
                            border: 'none',
                            color: '#000000',
                            padding: '8px 18px',
                            borderRadius: '10px',
                            fontSize: '12px',
                            fontWeight: '800',
                            cursor: 'pointer'
                        }}
                    >
                        Done
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
