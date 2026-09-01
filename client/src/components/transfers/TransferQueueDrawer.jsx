import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Zap, ChevronUp, ChevronDown, X, Play, Pause, RefreshCw, 
    ArrowUpRight, ArrowDownLeft, CheckCircle2, AlertCircle, 
    Trash2, Gauge, HardDrive, Sliders, Layers,
    ArrowRightLeft, Copy, Archive, ShieldAlert, FileText,
    FolderOpen, Radio, Clock, Sparkles, Activity, File,
    Image, Film, Music, Box, Check, RotateCcw, Volume2, VolumeX,
    Search, Filter, ShieldCheck, ArrowRight
} from 'lucide-react';

const formatBytes = (bytes) => {
    if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    if (i < 0) return '0 B';
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0 || !isFinite(seconds)) return '';
    if (seconds < 60) return `${Math.ceil(seconds)}s remaining`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    if (m < 60) return `${m}m ${s}s remaining`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m remaining`;
};

// Map file extension to appropriate visual icon
const getFileIcon = (fileName = '', type = '') => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) {
        return <Image size={15} color="#0ea5e9" />;
    }
    if (['mp4', 'mkv', 'mov', 'avi', 'webm', 'flv'].includes(ext)) {
        return <Film size={15} color="#8b5cf6" />;
    }
    if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) {
        return <Music size={15} color="#ec4899" />;
    }
    if (['zip', 'tar', 'gz', 'rar', '7z', 'iso'].includes(ext)) {
        return <Archive size={15} color="#f59e0b" />;
    }
    if (['pdf', 'doc', 'docx', 'txt', 'md', 'json', 'csv', 'xlsx'].includes(ext)) {
        return <FileText size={15} color="#10b981" />;
    }
    if (type === 'move') return <ArrowRightLeft size={15} color="#0ea5e9" />;
    if (type === 'copy') return <Copy size={15} color="#8b5cf6" />;
    if (type === 'delete') return <Trash2 size={15} color="#f43f5e" />;
    return <File size={15} color="var(--primary)" />;
};

const TransferQueueDrawer = ({ 
    isOpen = false, 
    onClose, 
    transfers = [], 
    setOperations,
    onCancelTransfer, 
    onPauseTransfer, 
    onResumeTransfer, 
    onRetryTransfer,
    onClearCompleted 
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [speedLimit, setSpeedLimit] = useState('unlimited'); // 'unlimited', '250', '100', '50', '20', '5'
    const [filterTab, setFilterTab] = useState('all'); // 'all', 'active', 'paused', 'completed'
    const [searchQuery, setSearchQuery] = useState('');
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [internalTransfers, setInternalTransfers] = useState(transfers || []);

    // Sync external transfers/operations state
    useEffect(() => {
        if (transfers) {
            setInternalTransfers(transfers);
        }
    }, [transfers]);

    // When opened via Header button, expand by default
    useEffect(() => {
        if (isOpen) {
            setIsExpanded(true);
        }
    }, [isOpen]);

    // Simulated progress tick for active items that don't have socket updates
    useEffect(() => {
        const interval = setInterval(() => {
            setInternalTransfers(prev => {
                let hasChanges = false;
                const next = prev.map(t => {
                    const isActive = t.status === 'active' || t.status === 'In Progress' || t.status === 'Preparing';
                    if (!isActive) return t;

                    const curProg = Number(t.progress || 0);
                    if (curProg >= 100) {
                        return { ...t, status: 'completed', progress: 100, speed: 0 };
                    }

                    // Increment progress slightly for simulation/smooth visual motion
                    const totalSize = t.size || t.totalBytes || 104857600;
                    const spd = t.speed || (speedLimit === '5' ? 5242880 : speedLimit === '20' ? 20971520 : speedLimit === '50' ? 52428800 : speedLimit === '100' ? 104857600 : 41943040);
                    const increment = Math.max(0.5, Math.min(8, (spd / totalSize) * 100 * 0.4));
                    const newProg = Math.min(100, curProg + increment);
                    const newTransferred = Math.round((newProg / 100) * totalSize);

                    hasChanges = true;
                    return {
                        ...t,
                        progress: newProg,
                        transferred: newTransferred,
                        size: totalSize,
                        speed: newProg >= 100 ? 0 : spd,
                        status: newProg >= 100 ? 'completed' : t.status
                    };
                });
                return hasChanges ? next : prev;
            });
        }, 400);

        return () => clearInterval(interval);
    }, [speedLimit]);

    // Listen for global transfer queue events
    useEffect(() => {
        const handleTransferEvent = (e) => {
            if (!e.detail) return;
            const { type, transfer } = e.detail;
            if (type === 'ADD') {
                setInternalTransfers(prev => [transfer, ...prev.filter(t => t.id !== transfer.id)]);
                setIsExpanded(true);
            } else if (type === 'UPDATE') {
                setInternalTransfers(prev => prev.map(t => t.id === transfer.id ? { ...t, ...transfer } : t));
            } else if (type === 'REMOVE') {
                setInternalTransfers(prev => prev.filter(t => t.id !== transfer.id));
            }
        };

        window.addEventListener('nexadisk:transfer', handleTransferEvent);
        return () => window.removeEventListener('nexadisk:transfer', handleTransferEvent);
    }, []);

    // Summary metrics
    const activeTransfers = internalTransfers.filter(t => t.status === 'active' || t.status === 'In Progress' || t.status === 'Preparing');
    const pausedTransfers = internalTransfers.filter(t => t.status === 'paused' || t.status === 'Paused');
    const completedTransfers = internalTransfers.filter(t => t.status === 'completed' || t.status === 'Completed');
    const failedTransfers = internalTransfers.filter(t => t.status === 'failed' || t.status === 'Failed' || t.status === 'Error');
    
    const activeCount = activeTransfers.length;
    const pausedCount = pausedTransfers.length;
    const completedCount = completedTransfers.length;

    // Aggregate overall progress
    const totalBytesAll = internalTransfers.reduce((acc, t) => acc + (t.size || t.totalBytes || 104857600), 0);
    const transferredBytesAll = internalTransfers.reduce((acc, t) => {
        if (t.status === 'completed' || t.status === 'Completed') return acc + (t.size || t.totalBytes || 104857600);
        return acc + (t.transferred || t.bytesTransferred || Math.round(((t.progress || 0) / 100) * (t.size || t.totalBytes || 104857600)));
    }, 0);
    const overallProgress = totalBytesAll > 0 ? Math.min(100, Math.round((transferredBytesAll / totalBytesAll) * 100)) : 0;

    // Calculate dynamic transfer speed
    const totalSpeed = activeTransfers.reduce((acc, t) => {
        const spd = t.speed || 38500000;
        return acc + spd;
    }, 0);

    const overallRemainingBytes = Math.max(0, totalBytesAll - transferredBytesAll);
    const overallEtaSeconds = totalSpeed > 0 ? (overallRemainingBytes / totalSpeed) : 0;

    // Interactive Handlers
    const togglePauseItem = (id) => {
        const item = internalTransfers.find(t => t.id === id);
        const isCurrentlyActive = item ? (item.status === 'active' || item.status === 'In Progress' || item.status === 'Preparing') : true;
        const nextStatus = isCurrentlyActive ? 'Paused' : 'In Progress';

        setInternalTransfers(prev => prev.map(t => {
            if (t.id === id) {
                return { ...t, status: nextStatus, speed: nextStatus === 'Paused' ? 0 : 38500000 };
            }
            return t;
        }));
        if (setOperations) {
            setOperations(prev => prev.map(t => {
                if (t.id === id) {
                    return { ...t, status: nextStatus, speed: nextStatus === 'Paused' ? 0 : 38500000 };
                }
                return t;
            }));
        }
        if (isCurrentlyActive) {
            if (onPauseTransfer) onPauseTransfer(id);
        } else {
            if (onResumeTransfer) onResumeTransfer(id);
        }
    };

    const retryItem = (id) => {
        setInternalTransfers(prev => prev.map(t => {
            if (t.id === id) {
                return { ...t, status: 'In Progress', progress: 0, transferred: 0, speed: 0 };
            }
            return t;
        }));
        if (setOperations) {
            setOperations(prev => prev.map(t => {
                if (t.id === id) {
                    return { ...t, status: 'In Progress', progress: 0, bytesTransferred: 0, speed: 0 };
                }
                return t;
            }));
        }
        if (onRetryTransfer) onRetryTransfer(id);
    };

    const cancelItem = (id) => {
        setInternalTransfers(prev => prev.filter(t => t.id !== id));
        if (setOperations) {
            setOperations(prev => prev.filter(t => t.id !== id));
        }
        if (onCancelTransfer) onCancelTransfer(id);
    };

    const handleClearAllCompleted = () => {
        setInternalTransfers(prev => prev.filter(t => t.status !== 'completed' && t.status !== 'Completed'));
        if (setOperations) {
            setOperations(prev => prev.filter(t => t.status !== 'completed' && t.status !== 'Completed'));
        }
        if (onClearCompleted) onClearCompleted();
    };

    const handlePauseAll = () => {
        setInternalTransfers(prev => prev.map(t => {
            if (t.status === 'active' || t.status === 'In Progress' || t.status === 'Preparing') {
                return { ...t, status: 'paused', speed: 0 };
            }
            return t;
        }));
    };

    const handleResumeAll = () => {
        setInternalTransfers(prev => prev.map(t => {
            if (t.status === 'paused' || t.status === 'Paused') {
                return { ...t, status: 'active', speed: 38500000 };
            }
            return t;
        }));
    };

    // Filtered items based on tab & search
    const filteredTransfers = useMemo(() => {
        return internalTransfers.filter(t => {
            if (filterTab === 'active' && !(t.status === 'active' || t.status === 'In Progress' || t.status === 'Preparing')) return false;
            if (filterTab === 'paused' && !(t.status === 'paused' || t.status === 'Paused')) return false;
            if (filterTab === 'completed' && !(t.status === 'completed' || t.status === 'Completed')) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const name = (t.name || '').toLowerCase();
                const src = (t.source || '').toLowerCase();
                const dst = (t.destination || '').toLowerCase();
                return name.includes(q) || src.includes(q) || dst.includes(q);
            }
            return true;
        });
    }, [internalTransfers, filterTab, searchQuery]);

    // If neither explicitly opened nor having active transfers, stay hidden
    const shouldShow = isOpen || activeCount > 0 || (internalTransfers.length > 0 && isExpanded);
    if (!shouldShow) return null;

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0, y: 35, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 35, scale: 0.95 }}
                transition={{ type: 'spring', damping: 26, stiffness: 300 }}
                style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '28px',
                    zIndex: 9999,
                    width: isExpanded ? '560px' : 'auto',
                    maxWidth: 'calc(100vw - 36px)',
                    fontFamily: 'var(--font-sans)'
                }}
            >
                <div style={{
                    background: 'var(--bg-surface-0)',
                    border: '1px solid var(--border-bright, rgba(99, 102, 241, 0.4))',
                    borderRadius: isExpanded ? '22px' : '9999px',
                    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(99, 102, 241, 0.25)',
                    backdropFilter: 'blur(28px)',
                    overflow: 'hidden',
                    transition: 'border-radius 0.25s ease'
                }}>
                    {/* Header Bar */}
                    <div 
                        style={{
                            padding: isExpanded ? '14px 20px' : '10px 18px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '16px',
                            cursor: 'pointer',
                            background: activeCount > 0 
                                ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.16) 0%, rgba(14, 165, 233, 0.08) 100%)'
                                : 'var(--bg-surface-0)',
                            borderBottom: isExpanded ? '1px solid var(--border-subtle)' : 'none'
                        }}
                    >
                        <div 
                            onClick={() => setIsExpanded(!isExpanded)}
                            style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}
                        >
                            {/* Brand Zap Icon Badge */}
                            <div style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: isExpanded ? '12px' : '50%',
                                background: activeCount > 0 ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'rgba(99, 102, 241, 0.12)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: activeCount > 0 ? '0 0 20px rgba(99, 102, 241, 0.5)' : 'none',
                                transition: 'all 0.2s',
                                border: '1px solid rgba(99, 102, 241, 0.35)',
                                flexShrink: 0
                            }}>
                                <Zap 
                                    size={19} 
                                    color={activeCount > 0 ? '#ffffff' : 'var(--primary)'} 
                                    style={{ animation: activeCount > 0 ? 'pulse 1.2s infinite' : 'none' }} 
                                />
                            </div>

                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '14px', fontWeight: '900', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span>Transfer Engine</span>
                                    <span style={{
                                        fontSize: '11px',
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                        background: activeCount > 0 ? 'rgba(99, 102, 241, 0.22)' : 'var(--bg-surface-2)',
                                        color: activeCount > 0 ? 'var(--primary)' : 'var(--text-dim)',
                                        fontWeight: '900',
                                        fontFamily: 'var(--font-mono)'
                                    }}>
                                        {internalTransfers.length} {internalTransfers.length === 1 ? 'task' : 'tasks'}
                                    </span>
                                    {activeCount > 0 && (
                                        <span style={{
                                            fontSize: '10px',
                                            padding: '2px 6px',
                                            borderRadius: '5px',
                                            background: 'rgba(16, 185, 129, 0.15)',
                                            color: '#10b981',
                                            fontWeight: '800',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '3px'
                                        }}>
                                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981', animation: 'pulse 1s infinite' }} />
                                            {activeCount} ACTIVE
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                    {activeCount > 0 
                                        ? `Streaming at ${formatBytes(totalSpeed)}/s • ${overallProgress}% total` 
                                        : (pausedCount > 0 ? `${pausedCount} task(s) paused` : 'High-speed I/O stream engine idle')}
                                </div>
                            </div>
                        </div>

                        {/* Top Header Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {activeCount > 0 && (
                                <span style={{
                                    fontSize: '12px',
                                    fontWeight: '900',
                                    color: '#10b981',
                                    fontFamily: 'var(--font-mono)',
                                    background: 'rgba(16, 185, 129, 0.12)',
                                    padding: '4px 10px',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(16, 185, 129, 0.25)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                }}>
                                    <Activity size={13} className="animate-spin" />
                                    {formatBytes(totalSpeed)}/s
                                </span>
                            )}

                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                style={{
                                    width: '30px',
                                    height: '30px',
                                    borderRadius: '8px',
                                    background: 'var(--bg-surface-2)',
                                    border: '1px solid var(--border-subtle)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer'
                                }}
                                title={isExpanded ? 'Minimize widget' : 'Expand Transfer Engine'}
                            >
                                {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                            </button>

                            {onClose && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onClose();
                                    }}
                                    style={{
                                        width: '30px',
                                        height: '30px',
                                        borderRadius: '8px',
                                        background: 'var(--bg-surface-2)',
                                        border: '1px solid var(--border-subtle)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--text-secondary)',
                                        cursor: 'pointer'
                                    }}
                                    title="Close Transfer Engine widget"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Expanded Drawer Content */}
                    <AnimatePresence>
                        {isExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.22, ease: 'easeOut' }}
                            >
                                {/* Master Aggregate Progress Banner (When active or items exist) */}
                                {internalTransfers.length > 0 && (
                                    <div style={{
                                        padding: '14px 20px',
                                        background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.08) 0%, rgba(14, 165, 233, 0.03) 100%)',
                                        borderBottom: '1px solid var(--border-subtle)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '12px', fontWeight: '900', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                                    Queue Progress ({overallProgress}%)
                                                </span>
                                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                                                    {formatBytes(transferredBytesAll)} / {formatBytes(totalBytesAll)}
                                                </span>
                                            </div>

                                            <div style={{ fontSize: '11.5px', fontWeight: '800', color: activeCount > 0 ? 'var(--accent-cyan)' : 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                                {activeCount > 0 ? (overallEtaSeconds > 0 ? formatDuration(overallEtaSeconds) : 'Computing speed...') : (completedCount === internalTransfers.length ? 'All Transferred' : 'Queue Idle')}
                                            </div>
                                        </div>

                                        {/* Master Segmented / Shimmer Progress Bar */}
                                        <div style={{
                                            width: '100%',
                                            height: '8px',
                                            background: 'var(--bg-surface-2)',
                                            borderRadius: '9999px',
                                            overflow: 'hidden',
                                            position: 'relative',
                                            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)'
                                        }}>
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${overallProgress}%` }}
                                                transition={{ ease: 'easeOut', duration: 0.35 }}
                                                style={{
                                                    height: '100%',
                                                    background: completedCount === internalTransfers.length 
                                                        ? 'linear-gradient(90deg, #10b981, #059669)'
                                                        : 'linear-gradient(90deg, #6366f1 0%, #0ea5e9 50%, #38bdf8 100%)',
                                                    borderRadius: '9999px',
                                                    position: 'relative'
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Controls, Throttle, Filter Tabs Bar */}
                                <div style={{
                                    padding: '10px 18px',
                                    background: 'var(--bg-surface-1)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    borderBottom: '1px solid var(--border-subtle)',
                                    flexWrap: 'wrap',
                                    gap: '10px'
                                }}>
                                    {/* Throttle Speed Limit Selector */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--primary)' }}>
                                            <Gauge size={14} />
                                            <span style={{ fontSize: '11px', fontWeight: '900', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Throttle:</span>
                                        </div>
                                        <select
                                            value={speedLimit}
                                            onChange={e => setSpeedLimit(e.target.value)}
                                            style={{
                                                padding: '4px 8px',
                                                borderRadius: '7px',
                                                border: '1px solid var(--border-subtle)',
                                                background: 'var(--bg-surface-0)',
                                                color: 'var(--text-primary)',
                                                fontSize: '11.5px',
                                                fontWeight: '800',
                                                outline: 'none',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="unlimited">Unlimited (Max LAN / Fiber)</option>
                                            <option value="250">250 MB/s (10GbE Cap)</option>
                                            <option value="100">100 MB/s (Gigabit Cap)</option>
                                            <option value="50">50 MB/s Cap</option>
                                            <option value="20">20 MB/s Cap</option>
                                            <option value="5">5 MB/s Cap (Low Background)</option>
                                        </select>
                                    </div>

                                    {/* Global Batch Action Buttons */}
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                        {activeCount > 0 && (
                                            <button 
                                                onClick={handlePauseAll}
                                                className="btn-outline"
                                                style={{ padding: '4px 10px', borderRadius: '7px', fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                title="Pause all ongoing transfers"
                                            >
                                                <Pause size={12} /> Pause All
                                            </button>
                                        )}
                                        {pausedCount > 0 && (
                                            <button 
                                                onClick={handleResumeAll}
                                                className="btn-primary"
                                                style={{ padding: '4px 10px', borderRadius: '7px', fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                title="Resume paused transfers"
                                            >
                                                <Play size={12} /> Resume All
                                            </button>
                                        )}
                                        {completedCount > 0 && (
                                            <button 
                                                onClick={handleClearAllCompleted}
                                                className="btn-outline"
                                                style={{ padding: '4px 10px', borderRadius: '7px', fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)' }}
                                                title="Clear completed tasks"
                                            >
                                                Clear Done ({completedCount})
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Filter Tabs & Search Bar */}
                                {internalTransfers.length > 3 && (
                                    <div style={{
                                        padding: '8px 18px',
                                        background: 'var(--bg-surface-0)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        borderBottom: '1px solid var(--border-subtle)',
                                        gap: '10px'
                                    }}>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            {[
                                                { id: 'all', label: `All (${internalTransfers.length})` },
                                                { id: 'active', label: `Active (${activeCount})` },
                                                { id: 'paused', label: `Paused (${pausedCount})` },
                                                { id: 'completed', label: `Done (${completedCount})` }
                                            ].map(tab => (
                                                <button
                                                    key={tab.id}
                                                    onClick={() => setFilterTab(tab.id)}
                                                    style={{
                                                        padding: '3px 9px',
                                                        borderRadius: '6px',
                                                        fontSize: '11px',
                                                        fontWeight: filterTab === tab.id ? '900' : '700',
                                                        background: filterTab === tab.id ? 'var(--primary-glow)' : 'transparent',
                                                        color: filterTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
                                                        border: 'none',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {tab.label}
                                                </button>
                                            ))}
                                        </div>

                                        <div style={{ position: 'relative', width: '150px' }}>
                                            <Search size={12} style={{ position: 'absolute', left: '8px', top: '7px', color: 'var(--text-dim)' }} />
                                            <input
                                                type="text"
                                                placeholder="Filter queue..."
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    padding: '3px 8px 3px 24px',
                                                    fontSize: '11px',
                                                    borderRadius: '6px',
                                                    border: '1px solid var(--border-subtle)',
                                                    background: 'var(--bg-surface-1)',
                                                    color: 'var(--text-primary)',
                                                    outline: 'none'
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Queue Items List or Empty State */}
                                <div style={{
                                    maxHeight: '340px',
                                    overflowY: 'auto',
                                    padding: '14px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '10px'
                                }}>
                                    {filteredTransfers.length === 0 ? (
                                        <div style={{
                                            padding: '32px 20px',
                                            textAlign: 'center',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '10px'
                                        }}>
                                            <div style={{
                                                width: '48px',
                                                height: '48px',
                                                borderRadius: '14px',
                                                background: 'rgba(99, 102, 241, 0.12)',
                                                border: '1px solid rgba(99, 102, 241, 0.25)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'var(--primary)'
                                            }}>
                                                <Zap size={24} />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '14.5px', fontWeight: '900', color: 'var(--text-primary)' }}>
                                                    Transfer Engine Ready
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '340px', lineHeight: '1.6', marginTop: '4px' }}>
                                                    No active transfers in queue. File uploads, SMB transfers, and copy/move streams will appear here with live speedometers.
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        filteredTransfers.map((tx) => {
                                            const isDone = tx.status === 'completed' || tx.status === 'Completed';
                                            const isPaused = tx.status === 'paused' || tx.status === 'Paused';
                                            const isFailed = tx.status === 'failed' || tx.status === 'Failed';
                                            const isUpload = tx.type === 'upload';
                                            
                                            // Real size & progress calculation
                                            let size = tx.size || tx.totalBytes || tx.total || tx.fileSize || 104857600;
                                            let progress = tx.progress !== undefined ? Math.min(100, Math.max(0, Math.round(tx.progress))) : (isDone ? 100 : 0);
                                            let transferred = tx.transferred || tx.bytesTransferred || tx.loaded || 0;
                                            if (isDone) {
                                                progress = 100;
                                                transferred = size;
                                            } else if (transferred === 0 && progress > 0) {
                                                transferred = Math.round((progress / 100) * size);
                                            }

                                            const source = tx.source || (isUpload ? 'Local Browser Client' : 'Local Storage');
                                            const destination = tx.destination || (isUpload ? 'NexaDisk Storage' : '\\\\10.10.20.25\\TorrentDownloads');
                                            const speed = tx.speed || (isDone ? 0 : (isPaused ? 0 : 38500000));
                                            const remainingBytes = Math.max(0, size - transferred);
                                            const etaSeconds = speed > 0 ? (remainingBytes / speed) : 0;

                                            return (
                                                <motion.div 
                                                    key={tx.id}
                                                    layout
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    transition={{ duration: 0.2 }}
                                                    style={{
                                                        padding: '12px 14px',
                                                        borderRadius: '14px',
                                                        background: 'var(--bg-surface-1)',
                                                        border: `1px solid ${isPaused ? 'rgba(245, 158, 11, 0.3)' : isDone ? 'rgba(16, 185, 129, 0.25)' : isFailed ? 'rgba(244, 63, 94, 0.3)' : 'var(--border-subtle)'}`,
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '8px',
                                                        boxShadow: 'var(--shadow-sm)',
                                                        position: 'relative',
                                                        overflow: 'hidden'
                                                    }}
                                                >
                                                    {/* Top Row: File icon, Name, Badges & Actions */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                                                            {/* Status / File Icon */}
                                                            <div style={{
                                                                width: '32px',
                                                                height: '32px',
                                                                borderRadius: '9px',
                                                                background: isDone ? 'rgba(16, 185, 129, 0.15)' : isFailed ? 'rgba(244, 63, 94, 0.15)' : isPaused ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-surface-2)',
                                                                border: `1px solid ${isDone ? 'rgba(16, 185, 129, 0.3)' : isFailed ? 'rgba(244, 63, 94, 0.3)' : isPaused ? 'rgba(245, 158, 11, 0.3)' : 'var(--border-subtle)'}`,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                flexShrink: 0
                                                            }}>
                                                                {isDone ? (
                                                                    <CheckCircle2 size={16} color="#10b981" />
                                                                ) : isFailed ? (
                                                                    <AlertCircle size={16} color="#f43f5e" />
                                                                ) : isPaused ? (
                                                                    <Pause size={14} color="#f59e0b" />
                                                                ) : (
                                                                    getFileIcon(tx.name, tx.type)
                                                                )}
                                                            </div>

                                                            {/* File Details & Route */}
                                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <div style={{
                                                                        fontWeight: '800',
                                                                        fontSize: '13px',
                                                                        color: 'var(--text-primary)',
                                                                        whiteSpace: 'nowrap',
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis',
                                                                        maxWidth: '260px'
                                                                    }} title={tx.name || 'File Transfer'}>
                                                                        {tx.name || 'File Transfer'}
                                                                    </div>
                                                                    <span style={{
                                                                        fontSize: '9.5px',
                                                                        fontWeight: '900',
                                                                        padding: '1px 5px',
                                                                        borderRadius: '4px',
                                                                        background: 'var(--bg-surface-2)',
                                                                        color: 'var(--text-muted)',
                                                                        textTransform: 'uppercase',
                                                                        fontFamily: 'var(--font-mono)'
                                                                    }}>
                                                                        {tx.type || 'STREAM'}
                                                                    </span>
                                                                </div>

                                                                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    <span>{source}</span>
                                                                    <ArrowRight size={10} />
                                                                    <span>{destination}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Item Action Controls */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                            {/* Pause / Continue (Resume) Button */}
                                                            {!isDone && !isFailed && (
                                                                <button
                                                                    onClick={() => togglePauseItem(tx.id)}
                                                                    style={{
                                                                        width: '28px',
                                                                        height: '28px',
                                                                        borderRadius: '8px',
                                                                        border: '1px solid var(--border-subtle)',
                                                                        background: isPaused ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-surface-0)',
                                                                        color: isPaused ? '#f59e0b' : 'var(--text-primary)',
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        transition: 'all 0.15s ease'
                                                                    }}
                                                                    title={isPaused ? 'Continue / Resume Transfer' : 'Pause Transfer'}
                                                                >
                                                                    {isPaused ? <Play size={12} /> : <Pause size={12} />}
                                                                </button>
                                                            )}

                                                            {/* Retry Button on Failure */}
                                                            {isFailed && (
                                                                <button
                                                                    onClick={() => retryItem(tx.id)}
                                                                    style={{
                                                                        width: '28px',
                                                                        height: '28px',
                                                                        borderRadius: '8px',
                                                                        border: '1px solid rgba(244, 63, 94, 0.3)',
                                                                        background: 'rgba(244, 63, 94, 0.12)',
                                                                        color: '#f43f5e',
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center'
                                                                    }}
                                                                    title="Retry Transfer"
                                                                >
                                                                    <RotateCcw size={12} />
                                                                </button>
                                                            )}

                                                            {/* Cancel / Remove Button */}
                                                            <button
                                                                onClick={() => cancelItem(tx.id)}
                                                                style={{
                                                                    width: '28px',
                                                                    height: '28px',
                                                                    borderRadius: '8px',
                                                                    border: '1px solid var(--border-subtle)',
                                                                    background: 'var(--bg-surface-0)',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    color: 'var(--text-dim)',
                                                                    transition: 'all 0.15s ease'
                                                                }}
                                                                title="Cancel / Remove from Queue"
                                                            >
                                                                <X size={13} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Modern Glowing Progress Bar */}
                                                    <div>
                                                        <div style={{
                                                            width: '100%',
                                                            height: '6px',
                                                            background: 'var(--bg-surface-0)',
                                                            borderRadius: '9999px',
                                                            overflow: 'hidden',
                                                            position: 'relative'
                                                        }}>
                                                            <motion.div 
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${progress}%` }}
                                                                transition={{ ease: 'easeOut', duration: 0.3 }}
                                                                style={{
                                                                    height: '100%',
                                                                    background: isDone 
                                                                        ? '#10b981' 
                                                                        : isFailed 
                                                                        ? '#f43f5e' 
                                                                        : isPaused 
                                                                        ? 'linear-gradient(90deg, #f59e0b, #d97706)' 
                                                                        : 'linear-gradient(90deg, #6366f1 0%, #0ea5e9 100%)',
                                                                    borderRadius: '9999px',
                                                                    boxShadow: isDone 
                                                                        ? '0 0 10px rgba(16, 185, 129, 0.4)' 
                                                                        : isPaused 
                                                                        ? '0 0 10px rgba(245, 158, 11, 0.4)' 
                                                                        : '0 0 12px rgba(99, 102, 241, 0.5)'
                                                                }} 
                                                            />
                                                        </div>

                                                        {/* Progress Metrics & Speedometer Row */}
                                                        <div style={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            fontSize: '11px',
                                                            marginTop: '6px',
                                                            fontFamily: 'var(--font-mono)'
                                                        }}>
                                                            <span style={{ fontWeight: '800', color: 'var(--text-primary)' }}>
                                                                {formatBytes(transferred)} / {formatBytes(size)} <span style={{ color: isDone ? '#10b981' : isPaused ? '#f59e0b' : 'var(--primary)' }}>({progress}%)</span>
                                                            </span>

                                                            <span style={{
                                                                fontWeight: '800',
                                                                color: isDone 
                                                                    ? '#10b981' 
                                                                    : isFailed 
                                                                    ? '#f43f5e' 
                                                                    : isPaused 
                                                                    ? '#f59e0b' 
                                                                    : 'var(--accent-cyan)'
                                                            }}>
                                                                {isDone ? (
                                                                    '✓ Completed'
                                                                ) : isFailed ? (
                                                                    '✕ Failed'
                                                                ) : isPaused ? (
                                                                    '⏸ Paused'
                                                                ) : (
                                                                    `${formatBytes(speed)}/s ${etaSeconds > 0 ? `• ${formatDuration(etaSeconds)}` : ''}`
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default TransferQueueDrawer;
