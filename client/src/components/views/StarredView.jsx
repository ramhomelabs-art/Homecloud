import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Star, Folder, File, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function StarredView({ onNavigate, showToast, starredItems = [], setStarredItems, fetchStarredItems }) {
    const [loading, setLoading] = useState(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    const fetchStarred = async () => {
        setLoading(true);
        try {
            if (fetchStarredItems) {
                await fetchStarredItems();
            }
        } catch (e) {
            console.error('Failed to fetch starred', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchStarred(); }, []);

    const handleUnstar = async (item) => {
        try {
            await axios.delete(`/api/v1/social/star?path=${encodeURIComponent(item.path)}`, { headers });
            if (setStarredItems) {
                setStarredItems(prev => prev.filter(i => i.id !== item.id));
            }
            showToast && showToast(`Removed "${item.name}" from starred`, 'success');
        } catch (e) {
            showToast && showToast('Failed to unstar', 'error');
        }
    };

    const handleClick = (item) => {
        if (onNavigate) onNavigate(item.path, item.is_directory);
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px', overflowY: 'auto' }}>
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px', margin: 0, marginBottom: '6px' }}>
                    <Star size={22} color="#f2c94c" fill="#f2c94c" /> Starred Items
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Your bookmarked files and folders for quick access</p>
            </div>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: '60px', borderRadius: '10px' }} />)}
                </div>
            ) : starredItems.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
                    <Star size={48} style={{ marginBottom: '16px' }} />
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>No starred items yet</h3>
                    <p style={{ margin: 0, fontSize: '13px' }}>Right-click any file or folder and select "Add to Starred"</p>
                </div>
            ) : (
                <AnimatePresence>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {starredItems.map((item, idx) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                transition={{ delay: idx * 0.04 }}
                                style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s' }}
                                onClick={() => handleClick(item)}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                            >
                                <Star size={16} color="#f2c94c" fill="#f2c94c" style={{ flexShrink: 0 }} />
                                {item.is_directory ? <Folder size={20} color="#f2c94c" style={{ flexShrink: 0 }} /> : <File size={20} color="#8b949e" style={{ flexShrink: 0 }} />}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>{item.path}</div>
                                </div>
                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{formatDate(item.starred_at)}</div>
                                <button
                                    onClick={e => { e.stopPropagation(); handleUnstar(item); }}
                                    title="Remove from Starred"
                                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#f85149', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}
                                >
                                    <X size={11} /> Unstar
                                </button>
                            </motion.div>
                        ))}
                    </div>
                </AnimatePresence>
            )}
        </motion.div>
    );
}
