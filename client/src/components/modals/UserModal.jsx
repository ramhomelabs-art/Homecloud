import React from 'react';
import { Lock, User } from 'lucide-react';

const UserModal = ({ config, onClose, onCreate, onUpdate, onReset }) => {
    const isCreate = config.mode === 'create';
    const isEdit = config.mode === 'edit';
    const isReset = config.mode === 'reset';
    const user = config.user || {};

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        if (isEdit) data.id = user.id;
        if (isReset) data.id = user.id;

        if (isCreate) onCreate(data);
        else if (isEdit) onUpdate(data);
        else if (isReset) onReset(data);
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={onClose}>
            <div className="modal-content glass" style={{ width: '400px', padding: '30px' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
                    <div className="st-card-icon" style={{ padding: '12px', borderRadius: '12px', background: 'var(--accent-gold-glow)' }}>
                        {isReset ? <Lock size={24} color="var(--accent-gold)" /> : <User size={24} color="var(--accent-gold)" />}
                    </div>
                    <h2 style={{ margin: 0, fontSize: '20px' }}>
                        {isCreate ? 'Add New User' : isEdit ? 'Edit User Profile' : 'Reset User Password'}
                    </h2>
                </div>

                <form onSubmit={handleSubmit}>
                    {!isReset && (
                        <>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '12px', color: '#8b949e', marginBottom: '8px', fontWeight: 'bold' }}>USERNAME</label>
                                <input
                                    name="username"
                                    type="text"
                                    defaultValue={user.username || ''}
                                    required
                                    style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-dim)', borderRadius: '10px', color: '#fff', outline: 'none' }}
                                />
                            </div>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '12px', color: '#8b949e', marginBottom: '8px', fontWeight: 'bold' }}>ROLE</label>
                                <select
                                    name="role"
                                    defaultValue={user.role || 'User'}
                                    style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-dim)', borderRadius: '10px', color: '#fff', outline: 'none' }}
                                >
                                    <option value="User">Standard User</option>
                                    <option value="Administrator">Administrator</option>
                                </select>
                            </div>
                        </>
                    )}

                    {(isCreate || isReset) && (
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: '#8b949e', marginBottom: '8px', fontWeight: 'bold' }}>
                                {isReset ? 'NEW PASSWORD' : 'INITIAL PASSWORD'}
                            </label>
                            <input
                                name={isReset ? 'newPassword' : 'password'}
                                type="password"
                                required
                                style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-dim)', borderRadius: '10px', color: '#fff', outline: 'none' }}
                            />
                        </div>
                    )}

                    {isCreate && (
                        <>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '12px', color: '#8b949e', marginBottom: '8px', fontWeight: 'bold' }}>SECURITY QUESTION</label>
                                <select
                                    name="securityQuestion"
                                    required
                                    style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-dim)', borderRadius: '10px', color: '#fff', outline: 'none' }}
                                >
                                    <option value="What is your first pet's name?">What is your first pet's name?</option>
                                    <option value="What is the name of your childhood best friend?">What is the name of your childhood best friend?</option>
                                    <option value="In what city were you born?">In what city were you born?</option>
                                    <option value="What was your first car?">What was your first car?</option>
                                </select>
                            </div>
                            <div style={{ marginBottom: '30px' }}>
                                <label style={{ display: 'block', fontSize: '12px', color: '#8b949e', marginBottom: '8px', fontWeight: 'bold' }}>SECURITY ANSWER</label>
                                <input
                                    name="securityAnswer"
                                    type="text"
                                    required
                                    placeholder="Enter case-insensitive answer"
                                    style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-dim)', borderRadius: '10px', color: '#fff', outline: 'none' }}
                                />
                            </div>
                        </>
                    )}

                    <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                        <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                        <button type="submit" className="btn-primary" style={{ flex: 2 }}>
                            {isCreate ? 'Create Account' : isEdit ? 'Save Changes' : 'Update Password'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserModal;
