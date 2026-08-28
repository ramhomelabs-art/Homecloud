import React from 'react';
import { Plus, Globe } from 'lucide-react';
import { motion } from 'framer-motion';

export default function NetworkSharesView({
    networkShares = [],
    setShowMountModal,
    unmountDrive
}) {
    return (
        <motion.div key="net" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h2 style={{ fontSize: '28px', fontWeight: '800' }}>Network Shares</h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Connect SMB, NFS, and Cloud storage endpoints</p>
                </div>
                <button className="btn-sm" onClick={() => setShowMountModal(true)}>
                    <Plus size={16} /> Add Share
                </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                {networkShares.map(ns => (
                    <div key={ns.id} className="st-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <Globe size={24} color="var(--accent-cyan)" />
                            <span style={{ fontSize: '10px', background: 'var(--accent-gold-glow)', color: 'var(--accent-gold)', padding: '4px 8px', borderRadius: '4px', fontWeight: '800' }}>{ns.type}</span>
                        </div>
                        <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>{ns.label}</h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '20px', wordBreak: 'break-all' }}>{ns.path}</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#484f58' }}>User: {ns.username}</span>
                            <button 
                                onClick={() => unmountDrive(ns.id)} 
                                style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#f85149', fontSize: '11px', cursor: 'pointer' }}
                            >
                                Disconnect
                            </button>
                        </div>
                    </div>
                ))}

                {networkShares.length === 0 && (
                    <div 
                        className="st-card" 
                        style={{ borderStyle: 'dashed', borderColor: 'var(--border-subtle)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gridColumn: '1/-1', padding: '60px' }}
                    >
                        <Globe size={48} color="#30363d" />
                        <p style={{ color: '#484f58', marginTop: '20px' }}>No network endpoints connected</p>
                        <button 
                            className="auth-submit-btn" 
                            style={{ width: 'auto', padding: '12px 24px', marginTop: '20px' }} 
                            onClick={() => setShowMountModal(true)}
                        >
                            Mount First Drive
                        </button>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
