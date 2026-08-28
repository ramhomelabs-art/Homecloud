import React from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

const OverlapConfirmModal = ({ context, onClose, onConfirm }) => {
    if (!context) return null;
    const fileName = context.source.split(/[\\/]/).pop();
    return (
        <div className="modal-overlay">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="modal-content glass" style={{ width: '400px', textAlign: 'center' }}>
                <div style={{ padding: '20px' }}>
                    <div style={{ width: '60px', height: '60px', background: 'rgba(242, 201, 76, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                        <RefreshCw size={30} color="var(--accent-gold)" />
                    </div>
                    <h3 style={{ margin: '0 0 10px' }}>Overwrite Item?</h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        An item named <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>"{fileName}"</span> already exists in this folder. Do you want to replace it?
                    </p>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '30px' }}>
                        <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>Skip</button>
                        <button className="btn-primary" style={{  flex: 1, background: 'var(--accent-gold)', borderColor: 'var(--accent-gold-glow)' , color: '#ffffff' }} onClick={() => onConfirm(context)}>Overwrite</button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default OverlapConfirmModal;
