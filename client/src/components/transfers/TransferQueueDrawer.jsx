import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ChevronUp, ChevronDown, X, Play, Pause, RefreshCw, 
    ArrowUpRight, ArrowDownLeft, CheckCircle2, AlertCircle, 
    Trash2, Gauge, HardDrive, Zap, Sliders, Layers,
    ArrowRightLeft, Copy, Archive, ShieldAlert, FileText
} from 'lucide-react';

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const TransferQueueDrawer = ({ transfers = [], onCancelTransfer, onPauseTransfer, onResumeTransfer, onClearCompleted }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [speedLimit, setSpeedLimit] = useState('unlimited'); // 'unlimited', '50', '20', '5', '1'
    const [internalTransfers, setInternalTransfers] = useState(transfers || []);

    useEffect(() => {
        if (transfers && transfers.length > 0) {
            setInternalTransfers(transfers);
        }
    }, [transfers]);

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

    const activeCount = internalTransfers.filter(t => t.status === 'active').length;
    const totalSpeed = internalTransfers
        .filter(t => t.status === 'active')
        .reduce((acc, t) => acc + (t.speed || 0), 0);

    const togglePauseItem = (id) => {
        setInternalTransfers(prev => prev.map(t => {
            if (t.id === id) {
                const nextStatus = t.status === 'active' ? 'paused' : 'active';
                return { ...t, status: nextStatus, speed: nextStatus === 'paused' ? 0 : 15000000 };
            }
            return t;
        }));
    };

    const cancelItem = (id) => {
        setInternalTransfers(prev => prev.filter(t => t.id !== id));
        if (onCancelTransfer) onCancelTransfer(id);
    };

    const handleClearAllCompleted = () => {
        setInternalTransfers(prev => prev.filter(t => t.status !== 'completed'));
        if (onClearCompleted) onClearCompleted();
    };

    const handlePauseAll = () => {
        setInternalTransfers(prev => prev.map(t => ({ ...t, status: 'paused', speed: 0 })));
    };

    const handleResumeAll = () => {
        setInternalTransfers(prev => prev.map(t => t.status === 'paused' ? ({ ...t, status: 'active', speed: 18500000 }) : t));
    };

    if (internalTransfers.length === 0) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '24px',
            zIndex: 9999,
            width: isExpanded ? '520px' : 'auto',
            maxWidth: 'calc(100vw - 48px)',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            fontFamily: 'var(--font-sans)'
        }}>
            <div style={{
                background: 'var(--bg-surface-0)',
                border: '1px solid var(--border-subtle)',
                borderRadius: isExpanded ? '20px' : '30px',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.35)',
                backdropFilter: 'blur(16px)',
                overflow: 'hidden'
            }}>
                {/* Collapsed Pill Header */}
                <div 
                    onClick={() => setIsExpanded(!isExpanded)}
                    style={{
                        padding: '12px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        cursor: 'pointer',
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), transparent)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '10px',
                            background: activeCount > 0 ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-surface-2)',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Zap size={16} color="var(--primary)" style={{ animation: activeCount > 0 ? 'pulse 1s infinite' : 'none' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                Transfer Engine 
                                <span style={{
                                    fontSize: '10.5px',
                                    padding: '2px 6px',
                                    borderRadius: '5px',
                                    background: activeCount > 0 ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-surface-2)',
                                    color: activeCount > 0 ? 'var(--primary)' : 'var(--text-dim)',
                                    fontWeight: '800'
                                }}>
                                    {internalTransfers.length}
                                </span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '1px' }}>
                                {activeCount > 0 ? `${formatBytes(totalSpeed)}/s throughput` : 'All transfers idle / completed'}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {activeCount > 0 && (
                            <span style={{
                                fontSize: '11.5px',
                                fontWeight: '800',
                                color: '#10b981',
                                fontFamily: 'var(--font-mono)'
                            }}>
                                {formatBytes(totalSpeed)}/s
                            </span>
                        )}
                        <div style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '8px',
                            background: 'var(--bg-surface-2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-secondary)'
                        }}>
                            {isExpanded ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                        </div>
                    </div>
                </div>

                {/* Expanded Queue Drawer */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            style={{ borderTop: '1px solid var(--border-subtle)' }}
                        >
                            {/* Bandwidth Limiter & Actions Bar */}
                            <div style={{
                                padding: '12px 18px',
                                background: 'var(--bg-surface-2)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderBottom: '1px solid var(--border-subtle)',
                                flexWrap: 'wrap',
                                gap: '8px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Gauge size={14} color="var(--text-dim)" />
                                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Throttle Cap:</span>
                                    <select
                                        value={speedLimit}
                                        onChange={e => setSpeedLimit(e.target.value)}
                                        style={{
                                            padding: '4px 8px',
                                            borderRadius: '6px',
                                            border: '1px solid var(--border-subtle)',
                                            background: 'var(--bg-surface-0)',
                                            color: 'var(--text-primary)',
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            outline: 'none'
                                        }}
                                    >
                                        <option value="unlimited">Unlimited (Max LAN)</option>
                                        <option value="50">Limit to 50 MB/s</option>
                                        <option value="20">Limit to 20 MB/s</option>
                                        <option value="5">Limit to 5 MB/s</option>
                                        <option value="1">Limit to 1 MB/s</option>
                                    </select>
                                </div>

                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <button 
                                        onClick={handlePauseAll}
                                        className="btn-secondary"
                                        style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}
                                    >
                                        Pause All
                                    </button>
                                    <button 
                                        onClick={handleResumeAll}
                                        className="btn-secondary"
                                        style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}
                                    >
                                        Resume All
                                    </button>
                                    <button 
                                        onClick={handleClearAllCompleted}
                                        className="btn-secondary"
                                        style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}
                                    >
                                        Clear Done
                                    </button>
                                </div>
                            </div>

                            {/* Queue Item List */}
                            <div style={{ maxHeight: '260px', overflowY: 'auto', padding: '12px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {internalTransfers.map((tx) => {
                                        const isUpload = tx.type === 'upload';
                                        const isDone = tx.status === 'completed' || tx.status === 'Completed';
                                        const isPaused = tx.status === 'paused';
                                        const isFailed = tx.status === 'failed' || tx.status === 'Failed';
                                        
                                        const size = tx.size || tx.totalBytes || tx.total || 0;
                                        const transferred = tx.transferred || tx.bytesTransferred || tx.loaded || 0;
                                        const progress = tx.progress !== undefined ? Math.min(100, Math.max(0, Math.round(tx.progress))) : (size > 0 ? Math.min(100, Math.round((transferred * 100) / size)) : 0);
                                        const source = tx.source || (isUpload ? 'Local Client' : 'Source Node');
                                        const destination = tx.destination || (isUpload ? 'NexaDisk Storage' : 'Target Volume');
                                        const speed = tx.speed || 0;

                                        return (
                                            <div 
                                                key={tx.id}
                                                style={{
                                                    padding: '12px',
                                                    borderRadius: '12px',
                                                    background: 'var(--bg-surface-2)',
                                                    border: '1px solid var(--border-subtle)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '8px'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                                        <div style={{
                                                            width: '28px',
                                                            height: '28px',
                                                            borderRadius: '8px',
                                                            background: isDone ? 'rgba(16, 185, 129, 0.15)' : isFailed ? 'rgba(244, 63, 94, 0.15)' : tx.type === 'move' ? 'rgba(14, 165, 233, 0.15)' : tx.type === 'copy' ? 'rgba(139, 92, 246, 0.15)' : tx.type === 'delete' ? 'rgba(244, 63, 94, 0.15)' : isUpload ? 'rgba(99, 102, 241, 0.15)' : 'rgba(14, 165, 233, 0.15)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            flexShrink: 0
                                                        }}>
                                                            {isDone ? (
                                                                <CheckCircle2 size={15} color="#10b981" />
                                                            ) : isFailed ? (
                                                                <AlertCircle size={15} color="#f43f5e" />
                                                            ) : tx.type === 'move' ? (
                                                                <ArrowRightLeft size={15} color="#0ea5e9" />
                                                            ) : tx.type === 'copy' ? (
                                                                <Copy size={15} color="#8b5cf6" />
                                                            ) : tx.type === 'delete' ? (
                                                                <Trash2 size={15} color="#f43f5e" />
                                                            ) : (tx.type === 'compress' || tx.type === 'extract') ? (
                                                                <Archive size={15} color="#d97706" />
                                                            ) : isUpload ? (
                                                                <ArrowUpRight size={15} color="var(--primary)" />
                                                            ) : (
                                                                <ArrowDownLeft size={15} color="#0ea5e9" />
                                                            )}
                                                        </div>
                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{
                                                                fontWeight: '800',
                                                                fontSize: '12.5px',
                                                                color: 'var(--text-primary)',
                                                                whiteSpace: 'nowrap',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                maxWidth: '260px'
                                                            }}>
                                                                {tx.name || 'File Transfer'}
                                                            </div>
                                                            <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', marginTop: '2px' }}>
                                                                {source} ➔ {destination}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        {!isDone && !isFailed && (
                                                            <button
                                                                onClick={() => togglePauseItem(tx.id)}
                                                                style={{
                                                                    width: '26px',
                                                                    height: '26px',
                                                                    borderRadius: '6px',
                                                                    border: '1px solid var(--border-subtle)',
                                                                    background: 'var(--bg-surface-0)',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    color: 'var(--text-primary)'
                                                                }}
                                                                title={isPaused ? 'Resume' : 'Pause'}
                                                            >
                                                                {isPaused ? <Play size={11} /> : <Pause size={11} />}
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => cancelItem(tx.id)}
                                                            style={{
                                                                width: '26px',
                                                                height: '26px',
                                                                borderRadius: '6px',
                                                                border: '1px solid var(--border-subtle)',
                                                                background: 'var(--bg-surface-0)',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                color: 'var(--text-dim)'
                                                            }}
                                                            title="Remove"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Progress bar */}
                                                <div>
                                                    <div style={{
                                                        width: '100%',
                                                        height: '5px',
                                                        background: 'var(--bg-surface-0)',
                                                        borderRadius: '10px',
                                                        overflow: 'hidden'
                                                    }}>
                                                        <div style={{
                                                            width: `${progress}%`,
                                                            height: '100%',
                                                            background: isDone ? '#10b981' : isFailed ? '#f43f5e' : isPaused ? 'var(--text-dim)' : 'linear-gradient(90deg, var(--primary), #0ea5e9)',
                                                            borderRadius: '10px',
                                                            transition: 'width 0.3s'
                                                        }} />
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--text-dim)', marginTop: '4px' }}>
                                                        <span>{formatBytes(transferred)} of {formatBytes(size)} ({progress}%)</span>
                                                        <span>{isDone ? 'Completed' : isFailed ? 'Failed' : isPaused ? 'Paused' : `${formatBytes(speed)}/s`}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default TransferQueueDrawer;
