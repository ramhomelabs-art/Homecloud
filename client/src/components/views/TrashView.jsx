import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, Trash, AlertTriangle, Cpu, Folder, File } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { containerVariants, itemVariants, formatBytes } from './UiUtils';

export default function TrashView({ token, showToast, trashItems = [], setTrashItems, fetchTrashItems }) {
    const [loading, setLoading] = useState(true);
    const [confirmEmpty, setConfirmEmpty] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [actionLoading, setActionLoading] = useState(null); // stores id of item being restored/deleted

    const fetchTrash = async () => {
        setLoading(true);
        try {
            if (fetchTrashItems) {
                await fetchTrashItems();
            }
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to load trash bin.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchTrash();
        }
    }, [token]);

    const handleRestore = async (id) => {
        setActionLoading(id);
        try {
            const res = await axios.post(`/api/v1/trash/restore/${id}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showToast(res.data.message || 'Item restored successfully.', 'success');
            setTrashItems(prev => prev.filter(item => item.id !== id));
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to restore item.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handlePermanentDelete = async (id) => {
        setActionLoading(id);
        try {
            const res = await axios.delete(`/api/v1/trash/permanent/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showToast(res.data.message || 'Item permanently deleted.', 'success');
            setTrashItems(prev => prev.filter(item => item.id !== id));
            setConfirmDeleteId(null);
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to delete item.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleEmptyTrash = async () => {
        setLoading(true);
        try {
            const res = await axios.delete('/api/v1/trash/empty', {
                headers: { Authorization: `Bearer ${token}` }
            });
            showToast(res.data.message || 'Trash bin emptied.', 'success');
            setTrashItems([]);
            setConfirmEmpty(false);
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to empty trash.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div key="trash" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Header Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div style={{ textAlign: 'left' }}>
                    <h2 style={{ fontSize: '28px', fontWeight: '800', margin: 0 }}>Trash Bin</h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>Review and restore deleted files or purge them permanently.</p>
                </div>
                {trashItems.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="glass" 
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '10px', 
                                padding: '8px 16px', 
                                borderRadius: '12px', 
                                border: '1px solid var(--border-subtle)', 
                                background: 'var(--bg-surface-2)',
                                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)'
                            }}
                        >
                            <Trash2 size={16} color="var(--accent-gold)" style={{ filter: 'drop-shadow(0 0 4px var(--accent-gold))' }} />
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Size</div>
                                <motion.div 
                                    key={trashItems.reduce((acc, item) => acc + parseInt(item.size || 0, 10), 0)}
                                    initial={{ y: -10, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    style={{ fontSize: '14px', fontWeight: '850', color: 'var(--accent-cyan)' }}
                                >
                                    {formatBytes(trashItems.reduce((acc, item) => acc + parseInt(item.size || 0, 10), 0))}
                                </motion.div>
                            </div>
                        </motion.div>
                        <button 
                            className="btn-danger shadow-premium" 
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '12px', padding: '10px 20px', fontWeight: '800', background: 'rgba(248, 81, 73, 0.1)', color: '#f85149', border: '1px solid rgba(248, 81, 73, 0.2)', cursor: 'pointer', height: '44px' }} 
                            onClick={() => setConfirmEmpty(true)}
                        >
                            <Trash size={16} /> Empty Trash
                        </button>
                    </div>
                )}
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '100px 0' }}>
                    <div className="spinner"></div>
                </div>
            ) : trashItems.length === 0 ? (
                <div className="st-card" style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '80px', height: '80px', background: 'var(--bg-surface-2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                        <Trash2 size={40} color="#8b949e" style={{ opacity: 0.5 }} />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-secondary)' }}>Trash is empty</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '8px', maxWidth: '300px' }}>Files you delete will appear here before being permanently removed.</p>
                </div>
            ) : (
                <div className="st-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface-2)' }}>
                                    <th style={{ padding: '16px 20px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: '800' }}>Name</th>
                                    <th style={{ padding: '16px 20px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: '800' }}>Original Path</th>
                                    <th style={{ padding: '16px 20px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: '800' }}>Size</th>
                                    <th style={{ padding: '16px 20px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: '800' }}>Deleted At</th>
                                    <th style={{ padding: '16px 20px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: '800', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence>
                                    {trashItems.map((item, idx) => (
                                        <motion.tr 
                                            key={item.id}
                                            variants={itemVariants}
                                            initial="hidden"
                                            animate="show"
                                            exit={{ opacity: 0, x: -50 }}
                                            style={{ 
                                                borderBottom: idx === trashItems.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.04)',
                                                background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.005)'
                                            }}
                                        >
                                            {/* File/Folder Name */}
                                            <td style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                {item.is_directory ? (
                                                    <Folder size={18} color="var(--accent-gold)" />
                                                ) : (
                                                    <File size={18} color="var(--accent-cyan)" />
                                                )}
                                                <div style={{ textAlign: 'left' }}>
                                                    <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-secondary)' }}>{item.original_name}</span>
                                                    {item.agent_id && (
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '9px', background: 'rgba(56, 139, 253, 0.15)', color: 'var(--accent-cyan)', padding: '1px 6px', borderRadius: '4px', marginLeft: '8px', fontWeight: 'bold' }}>
                                                            <Cpu size={10} /> Agent Node
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Original Location */}
                                            <td style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: '13px', fontFamily: 'monospace', textAlign: 'left' }}>
                                                {item.original_path}
                                            </td>

                                            {/* Size */}
                                            <td style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                                {formatBytes(parseInt(item.size, 10))}
                                            </td>

                                            {/* Deleted Time */}
                                            <td style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'left' }}>
                                                {new Date(item.deleted_at).toLocaleString()}
                                            </td>

                                            {/* Actions */}
                                            <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                                                <div style={{ display: 'inline-flex', gap: '8px' }}>
                                                    <button 
                                                        className="btn-sm" 
                                                        disabled={actionLoading === item.id}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(74, 222, 128, 0.1)', color: '#4ade80', border: '1px solid rgba(74, 222, 128, 0.2)', cursor: 'pointer' }}
                                                        onClick={() => handleRestore(item.id)}
                                                    >
                                                        <RotateCcw size={14} /> Restore
                                                    </button>
                                                    <button 
                                                        className="btn-sm" 
                                                        disabled={actionLoading === item.id}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(248, 81, 73, 0.1)', color: '#f85149', border: '1px solid rgba(248, 81, 73, 0.2)', cursor: 'pointer' }}
                                                        onClick={() => setConfirmDeleteId(item.id)}
                                                    >
                                                        <Trash2 size={14} /> Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Empty Trash Modal */}
            {confirmEmpty && (
                <div className="modal-overlay" style={{ zIndex: 100000 }}>
                    <div className="modal-card" style={{ maxWidth: '400px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                            <div style={{ width: '60px', height: '60px', background: 'rgba(248,81,73,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <AlertTriangle size={30} color="#f85149" />
                            </div>
                        </div>
                        <h3 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#f85149' }}>Empty Trash Bin?</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '12px', lineHeight: '1.6' }}>
                            This action will permanently purge all items from the trash bin. This action is irreversible.
                        </p>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                            <button className="btn-sm btn-danger" style={{ flex: 1, height: '38px', borderRadius: '8px', background: '#f85149', color: 'var(--text-primary)', border: 'none', fontWeight: 'bold', cursor: 'pointer' }} onClick={handleEmptyTrash}>
                                Empty Trash
                            </button>
                            <button className="btn-sm" style={{ flex: 1, height: '38px', borderRadius: '8px', background: 'var(--bg-surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', cursor: 'pointer' }} onClick={() => setConfirmEmpty(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Permanent Delete Confirmation Modal */}
            {confirmDeleteId && (
                <div className="modal-overlay" style={{ zIndex: 100000 }}>
                    <div className="modal-card" style={{ maxWidth: '400px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                            <div style={{ width: '60px', height: '60px', background: 'rgba(248,81,73,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <AlertTriangle size={30} color="#f85149" />
                            </div>
                        </div>
                        <h3 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#f85149' }}>Permanently Delete Item?</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '12px', lineHeight: '1.6' }}>
                            Are you sure you want to permanently delete this item? You cannot recover this file once deleted.
                        </p>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                            <button 
                                className="btn-sm btn-danger" 
                                style={{ flex: 1, height: '38px', borderRadius: '8px', background: '#f85149', color: 'var(--text-primary)', border: 'none', fontWeight: 'bold', cursor: 'pointer' }} 
                                onClick={() => handlePermanentDelete(confirmDeleteId)}
                            >
                                Delete Permanently
                            </button>
                            <button className="btn-sm" style={{ flex: 1, height: '38px', borderRadius: '8px', background: 'var(--bg-surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', cursor: 'pointer' }} onClick={() => setConfirmDeleteId(null)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
