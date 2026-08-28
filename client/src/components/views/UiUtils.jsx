import React, { useState, useEffect } from 'react';
import { Timer, X } from 'lucide-react';

export const formatBytes = (bytes) => {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return '0.0 KB';
    if (bytes === 0) return '0.0 KB';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    if (i < 0) return '0.0 KB';
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const formatGB = (gbVal) => {
    if (gbVal === undefined || gbVal === null || isNaN(gbVal)) return '0.0 GB';
    if (gbVal >= 999.9) {
        return `${(gbVal / 1024).toFixed(1)} TB`;
    }
    return `${gbVal.toFixed(1)} GB`;
};

export const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05,
            delayChildren: 0.1
        }
    }
};

export const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: {
        opacity: 1,
        y: 0,
        transition: {
            type: 'spring',
            stiffness: 120,
            damping: 18
        }
    }
};

export const CountdownTimer = ({ expiry }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        if (!expiry) { setTimeLeft('—'); return; }
        const calculateTime = () => {
            const exp = new Date(expiry).getTime();
            if (isNaN(exp)) return '—';
            const now = new Date().getTime();
            const diff = exp - now;

            if (diff <= 0) return 'EXPIRED';

            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);

            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        };

        setTimeLeft(calculateTime());
        const timer = setInterval(() => setTimeLeft(calculateTime()), 1000);
        return () => clearInterval(timer);
    }, [expiry]);

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-gold)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em' }}>Auto-Destruct</span>
                <span style={{ fontFamily: 'monospace', fontSize: '15px', fontWeight: '800', letterSpacing: '0.02em' }}>{timeLeft}</span>
            </div>
            <Timer size={20} style={{ opacity: 0.8 }} />
        </div>
    );
};

export const Toast = ({ message, type, onClose }) => {
    return (
        <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: type === 'error' ? 'rgba(248, 81, 73, 0.9)' : (type === 'success' ? 'rgba(46, 160, 67, 0.9)' : 'rgba(31, 111, 235, 0.9)'),
            color: 'var(--text-primary)',
            padding: '12px 24px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border-subtle)',
            animation: 'fadeIn 0.3s ease',
            pointerEvents: 'auto'
        }}>
            <span>{typeof message === 'object' ? (message.message || message.error || JSON.stringify(message)) : message}</span>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex' }}>
                <X size={16} />
            </button>
        </div>
    );
};
