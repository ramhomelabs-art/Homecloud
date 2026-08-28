import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    MessageSquare, Send, Trash2, Pin, User, Clock, 
    X, RefreshCw, FileText, Check
} from 'lucide-react';

const FileCommentsModal = ({ file, onClose, showToast }) => {
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newComment, setNewComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchComments = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.get('/api/v1/files/comments', {
                params: { path: file.path },
                headers
            });
            setComments(res.data || []);
        } catch (err) {
            if (showToast) showToast('Failed to load comments: ' + (err.response?.data?.error || err.message), 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (file?.path) fetchComments();
    }, [file]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newComment.trim() || submitting) return;

        setSubmitting(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post('/api/v1/files/comments', {
                path: file.path,
                comment: newComment.trim()
            }, { headers });

            setNewComment('');
            if (showToast) showToast('Comment posted', 'success');
            fetchComments();
        } catch (err) {
            if (showToast) showToast('Failed to post comment: ' + (err.response?.data?.error || err.message), 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.delete(`/api/v1/files/comments/${id}`, { headers });
            if (showToast) showToast('Comment deleted', 'info');
            fetchComments();
        } catch (err) {
            if (showToast) showToast('Failed to delete comment', 'error');
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(10px)',
            zIndex: 3000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                style={{
                    width: '100%',
                    maxWidth: '620px',
                    height: '75vh',
                    background: 'var(--bg-surface-0)',
                    borderRadius: '18px',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.6)'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '16px 20px',
                    background: 'var(--bg-surface-1)',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexShrink: 0
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: 'rgba(6, 182, 212, 0.15)',
                            color: 'var(--accent-cyan)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <MessageSquare size={18} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                Team Discussion & File Notes
                            </h3>
                            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                                {file?.name}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        style={{ padding: '6px', borderRadius: '6px', background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Comments List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>
                            <RefreshCw size={20} className="spin-anim" />
                        </div>
                    ) : comments.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
                            <MessageSquare size={36} style={{ opacity: 0.4, marginBottom: '10px' }} />
                            <div style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-secondary)' }}>No comments yet</div>
                            <div style={{ fontSize: '11.5px', marginTop: '4px' }}>Start a discussion or leave a note for this file below.</div>
                        </div>
                    ) : (
                        comments.map((c) => (
                            <div
                                key={c.id}
                                style={{
                                    padding: '12px 14px',
                                    borderRadius: '12px',
                                    background: 'var(--bg-surface-1)',
                                    border: '1px solid var(--border-subtle)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', fontSize: '10.5px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {c.username?.[0]?.toUpperCase() || 'U'}
                                        </div>
                                        <span style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--text-primary)' }}>
                                            {c.username}
                                        </span>
                                        <span style={{ fontSize: '10.5px', color: 'var(--text-dim)', marginLeft: '4px' }}>
                                            {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    <button
                                        onClick={() => handleDelete(c.id)}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '2px' }}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>

                                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.4', paddingLeft: '28px' }}>
                                    {c.comment}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Input Footer */}
                <form onSubmit={handleSubmit} style={{
                    padding: '12px 16px',
                    background: 'var(--bg-surface-1)',
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <input
                        type="text"
                        placeholder="Write a comment or note..."
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        style={{
                            flex: 1,
                            padding: '10px 14px',
                            borderRadius: '8px',
                            background: 'var(--bg-surface-2)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            fontSize: '12.5px',
                            outline: 'none'
                        }}
                    />
                    <button
                        type="submit"
                        disabled={submitting || !newComment.trim()}
                        className="btn-primary"
                        style={{ padding: '10px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700' }}
                    >
                        <Send size={13} /> Send
                    </button>
                </form>
            </motion.div>
        </div>
    );
};

export default FileCommentsModal;
