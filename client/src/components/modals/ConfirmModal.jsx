import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, AlertCircle, Trash2, HelpCircle, Check, X, ShieldAlert, Sparkles, RotateCcw } from 'lucide-react';

const ConfirmModal = ({
    show,
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    type = 'danger', // 'danger', 'warning', 'primary', 'info'
    onConfirm,
    onCancel,
    loading = false
}) => {
    if (!show) return null;

    const getIcon = () => {
        switch (type) {
            case 'danger':
                return <Trash2 size={24} color="#f43f5e" />;
            case 'warning':
                return <AlertTriangle size={24} color="#f59e0b" />;
            case 'info':
                return <Sparkles size={24} color="#38bdf8" />;
            case 'rollback':
                return <RotateCcw size={24} color="#f43f5e" />;
            case 'primary':
            default:
                return <ShieldAlert size={24} color="#6366f1" />;
        }
    };

    const getConfirmBtnStyle = () => {
        if (type === 'danger' || type === 'rollback') {
            return {
                background: 'linear-gradient(135deg, #ef4444, #e11d48)',
                color: '#fff',
                border: 'none',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)'
            };
        }
        if (type === 'warning') {
            return {
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#fff',
                border: 'none',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)'
            };
        }
        return {
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            color: '#fff',
            border: 'none',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)'
        };
    };

    return (
        <AnimatePresence>
            <div 
                className="modal-overlay" 
                onClick={onCancel}
                style={{ 
                    position: 'fixed', 
                    top: 0, 
                    left: 0, 
                    right: 0, 
                    bottom: 0, 
                    background: 'rgba(5, 10, 20, 0.75)', 
                    backdropFilter: 'blur(8px)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    zIndex: 999999,
                    padding: '20px'
                }}
            >
                <motion.div 
                    className="glass"
                    onClick={(e) => e.stopPropagation()}
                    initial={{ opacity: 0, scale: 0.92, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 15 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                    style={{ 
                        width: '100%', 
                        maxWidth: '440px', 
                        background: 'var(--bg-surface-0)', 
                        borderRadius: '20px', 
                        border: '1px solid var(--border-subtle)', 
                        padding: '26px', 
                        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '18px'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                        <div style={{ 
                            width: '46px', 
                            height: '46px', 
                            borderRadius: '14px', 
                            background: type === 'danger' || type === 'rollback' ? 'rgba(244, 63, 94, 0.12)' : type === 'warning' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(99, 102, 241, 0.12)', 
                            border: `1px solid ${type === 'danger' || type === 'rollback' ? 'rgba(244, 63, 94, 0.25)' : type === 'warning' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(99, 102, 241, 0.25)'}`,
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            {getIcon()}
                        </div>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                                {title}
                            </h3>
                            <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                {message}
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={loading}
                            className="btn-secondary"
                            style={{ padding: '9px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                        >
                            {cancelText}
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={loading}
                            style={{
                                padding: '9px 20px',
                                borderRadius: '10px',
                                fontSize: '13px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                ...getConfirmBtnStyle()
                            }}
                        >
                            {loading ? 'Processing...' : confirmText}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ConfirmModal;
