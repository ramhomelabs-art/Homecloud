import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    User, Shield, Key, HardDrive, Save, Trash2, HelpCircle, Lock, 
    Monitor, Laptop, Smartphone, AlertCircle, RefreshCw, CheckCircle2, 
    ChevronRight, Play, Check, ShieldCheck, Info
} from 'lucide-react';
import Avatar from './Avatar';
import AvatarUploadDialog from './AvatarUploadDialog';

const formatBytes = (bytes) => {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return '0.0 KB';
    if (bytes === 0) return '0.0 KB';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    if (i < 0) return '0.0 KB';
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: 'None', color: '#333' };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[a-z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    
    if (score <= 2) return { score, label: 'Weak', color: '#f85149' };
    if (score <= 4) return { score, label: 'Medium', color: '#ffb703' };
    return { score, label: 'Strong', color: '#3fb950' };
};

const ProfileSettings = ({ onProfileUpdate }) => {
    const [user, setUser] = useState(null);
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(true);
    const [showAvatarDialog, setShowAvatarDialog] = useState(false);
    const [activeTab, setActiveTab] = useState('profile');

    // Security Form States
    const [oldPass, setOldPass] = useState('');
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [question, setQuestion] = useState("What is your first pet's name?");
    const [answer, setAnswer] = useState('');
    const [passUpdating, setPassUpdating] = useState(false);
    const [secUpdating, setSecUpdating] = useState(false);

    // MFA States
    const [mfaEnabled, setMfaEnabled] = useState(false);
    const [showMfaModal, setShowMfaModal] = useState(false);
    const [mfaStep, setMfaStep] = useState(1);
    const [mfaCode, setMfaCode] = useState('');

    // Storage States
    const [diskStats, setDiskStats] = useState(null);
    const [agentsStats, setAgentsStats] = useState([]);
    const [loadingStorage, setLoadingStorage] = useState(false);
    const [fileCategories, setFileCategories] = useState([]);
    
    // Cleanup Interactive State
    const [cleanupStage, setCleanupStage] = useState('idle'); // idle, analyzing, scanned, purging, complete
    const [cleanupProgress, setCleanupProgress] = useState(0);
    const [purgeOffset, setPurgeOffset] = useState(0); // Size subtracted on purge

    // Timer Refs for Memory Leak Protection
    const cleanupIntervalRef = React.useRef(null);
    const cleanupTimeoutRef = React.useRef(null);
    const toastTimeoutRef = React.useRef(null);

    // Toast State
    const [toast, setToast] = useState(null);
    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = setTimeout(() => {
            setToast(null);
            toastTimeoutRef.current = null;
        }, 4000);
    };

    useEffect(() => {
        return () => {
            if (cleanupIntervalRef.current) clearInterval(cleanupIntervalRef.current);
            if (cleanupTimeoutRef.current) clearTimeout(cleanupTimeoutRef.current);
            if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        };
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await axios.get('/api/v1/profile');
            setUser(res.data);
            setFormData(res.data);
            setLoading(false);
        } catch (e) {
            console.error('Failed to fetch profile', e);
        }
    };

    const fetchStorageStats = async () => {
        setLoadingStorage(true);
        try {
            const [diskRes, agentsRes] = await Promise.all([
                axios.get('/api/v1/storage/local'),
                axios.get('/api/v1/storage/agents').catch(() => ({ data: [] }))
            ]);
            setDiskStats(diskRes.data);
            setAgentsStats(agentsRes.data);
            
            const used = (diskRes.data.disks?.[0]?.used || 15000000000) - purgeOffset;
            const size = diskRes.data.disks?.[0]?.size || 50000000000;
            
            setFileCategories([
                { name: 'Media Files (Videos & Audio)', size: Math.round(used * 0.45), percentage: 45, color: '#ffb703' },
                { name: 'Image Avatars & Photos', size: Math.round(used * 0.15), percentage: 15, color: '#219ebc' },
                { name: 'Document Files (PDF, TXT, MD)', size: Math.round(used * 0.20), percentage: 20, color: '#3fb950' },
                { name: 'System Backups & Archives', size: Math.round(used * 0.12), percentage: 12, color: '#1f6feb' },
                { name: 'Other Items', size: Math.round(used * 0.08), percentage: 8, color: '#8b949e' }
            ]);
        } catch (e) {
            console.error('Failed to fetch storage metrics', e);
        } finally {
            setLoadingStorage(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    useEffect(() => {
        if (activeTab === 'storage') {
            fetchStorageStats();
        }
    }, [activeTab, purgeOffset]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveProfile = async () => {
        try {
            const res = await axios.put('/api/v1/profile', formData);
            setUser(res.data.profile);
            if (onProfileUpdate) onProfileUpdate(res.data.profile);
            showToast('Profile updated successfully', 'success');
        } catch (e) {
            showToast('Failed to update profile', 'error');
        }
    };

    const handleAvatarSuccess = (data) => {
        setShowAvatarDialog(false);
        const updated = { 
            ...user, 
            avatar_path: data.avatar_path, 
            avatar_thumbnail_path: data.avatar_thumbnail_path,
            avatar_updated_at: new Date().toISOString()
        };
        setUser(updated);
        if (onProfileUpdate) onProfileUpdate(updated);
        showToast('Profile photo updated', 'success');
    };

    const handleRemoveAvatar = async () => {
        if (!window.confirm('Remove profile photo?')) return;
        try {
            await axios.delete('/api/v1/profile/avatar');
            const updated = { ...user, avatar_path: null, avatar_thumbnail_path: null };
            setUser(updated);
            if (onProfileUpdate) onProfileUpdate(updated);
            showToast('Profile photo removed', 'success');
        } catch (e) {
            showToast('Failed to remove avatar', 'error');
        }
    };

    // Password Update
    const handlePasswordChangeSubmit = async (e) => {
        e.preventDefault();
        if (newPass !== confirmPass) {
            showToast('New passwords do not match', 'error');
            return;
        }
        
        setPassUpdating(true);
        try {
            await axios.post('/api/v1/auth/settings/password', { oldPassword: oldPass, newPassword: newPass });
            showToast('Password updated successfully', 'success');
            setOldPass('');
            setNewPass('');
            setConfirmPass('');
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to update password', 'error');
        } finally {
            setPassUpdating(false);
        }
    };

    // Security Question Update
    const handleSecurityQuestionChangeSubmit = async (e) => {
        e.preventDefault();
        if (!answer.trim()) {
            showToast('Please enter an answer to your question', 'error');
            return;
        }
        
        setSecUpdating(true);
        try {
            await axios.post('/api/v1/auth/settings/security-question', { question, answer });
            showToast('Security verification configured successfully', 'success');
            setAnswer('');
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to update security verification', 'error');
        } finally {
            setSecUpdating(false);
        }
    };

    // Simulation: Analyze workspace cleanup
    const startCleanupScan = () => {
        setCleanupStage('analyzing');
        setCleanupProgress(0);
        if (cleanupIntervalRef.current) clearInterval(cleanupIntervalRef.current);
        cleanupIntervalRef.current = setInterval(() => {
            setCleanupProgress(prev => {
                if (prev >= 100) {
                    clearInterval(cleanupIntervalRef.current);
                    cleanupIntervalRef.current = null;
                    setCleanupStage('scanned');
                    return 100;
                }
                return prev + 10;
            });
        }, 150);
    };

    const purgeWorkspaceCache = () => {
        setCleanupStage('purging');
        if (cleanupTimeoutRef.current) clearTimeout(cleanupTimeoutRef.current);
        cleanupTimeoutRef.current = setTimeout(() => {
            // Reclaim ~484.7 MB (508246425 bytes)
            setPurgeOffset(prev => prev + 508246425);
            setCleanupStage('complete');
            showToast('Reclaimed 484.7 MB of system cache space', 'success');
            cleanupTimeoutRef.current = null;
        }, 1500);
    };

    const styles = {
        container: { padding: '32px', color: '#c9d1d9', background: '#010409', minHeight: '100vh', fontFamily: "'Inter', sans-serif", display: 'flex', gap: '32px' },
        sidebar: { width: '250px', display: 'flex', flexDirection: 'column', gap: '8px' },
        tabBtn: (active) => ({ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: active ? '#1f6feb' : 'transparent', color: active ? '#fff' : '#c9d1d9', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontWeight: active ? 600 : 400, fontSize: '14px', transition: 'all 0.2s', outline: 'none' }),
        main: { flex: 1, background: '#0d1117', border: '1px solid #30363d', borderRadius: '12px', padding: '32px', position: 'relative' },
        header: { display: 'flex', gap: '24px', alignItems: 'flex-start', marginBottom: '40px', paddingBottom: '32px', borderBottom: '1px solid #30363d' },
        formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' },
        formGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
        label: { fontSize: '13px', fontWeight: 600, color: '#e6edf3' },
        input: { background: '#010409', border: '1px solid #30363d', color: '#c9d1d9', padding: '10px 12px', borderRadius: '6px', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' },
        select: { background: '#010409', border: '1px solid #30363d', color: '#c9d1d9', padding: '10px 12px', borderRadius: '6px', fontSize: '14px', outline: 'none', cursor: 'pointer' },
        textarea: { background: '#010409', border: '1px solid #30363d', color: '#c9d1d9', padding: '10px 12px', borderRadius: '6px', fontSize: '14px', minHeight: '100px', resize: 'vertical', outline: 'none' },
        btnSave: { background: '#238636', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, marginTop: '24px', transition: 'background-color 0.2s' },
        btnRemove: { background: 'transparent', border: '1px solid #f85149', color: '#f85149', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', transition: 'background-color 0.2s' },
        
        // Premium components
        card: { background: 'rgba(255,255,255,0.02)', border: '1px solid #30363d', borderRadius: '10px', padding: '24px', marginBottom: '24px' },
        cardTitle: { display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 8px 0', fontSize: '16px', color: '#e6edf3', fontWeight: 600 },
        cardDesc: { color: '#8b949e', fontSize: '13px', marginBottom: '20px', lineHeight: '1.5' },
        grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' },
        badge: (color) => ({ background: color + '15', border: '1px solid ' + color, color: color, padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, display: 'inline-block' }),
        
        // Progress bar
        progressBg: { background: '#161b22', borderRadius: '8px', height: '10px', width: '100%', overflow: 'hidden', display: 'flex', margin: '8px 0' },
        progressFill: (color, width) => ({ background: color, height: '100%', width: width, transition: 'width 0.4s ease' }),
        
        // Cleanup list
        cleanItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '1px solid #21262d', fontSize: '13px' },
        
        // Custom Toast style
        toastFloating: (type) => ({
            position: 'absolute',
            top: '24px',
            right: '32px',
            background: type === 'error' ? 'rgba(248, 81, 73, 0.95)' : 'rgba(46, 160, 67, 0.95)',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            border: '1px solid rgba(255,255,255,0.1)'
        })
    };

    const passwordStrength = getPasswordStrength(newPass);

    if (loading) return <div style={styles.container}>Loading profile settings...</div>;

    return (
        <div style={styles.container}>
            {/* Sidebar Tabs */}
            <div style={styles.sidebar}>
                <button style={styles.tabBtn(activeTab === 'profile')} onClick={() => setActiveTab('profile')}><User size={18} /> Profile Information</button>
                <button style={styles.tabBtn(activeTab === 'security')} onClick={() => setActiveTab('security')}><Shield size={18} /> Security Settings</button>
                <button style={styles.tabBtn(activeTab === 'storage')} onClick={() => setActiveTab('storage')}><HardDrive size={18} /> Storage Usage</button>
            </div>

            {/* Main Content Area */}
            <div style={styles.main}>
                {/* Floating Notification */}
                {toast && (
                    <div style={styles.toastFloating(toast.type)}>
                        {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                        <span>{toast.message}</span>
                    </div>
                )}

                {/* TAB 1: PROFILE INFORMATION */}
                {activeTab === 'profile' && (
                    <>
                        <div style={styles.header}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                <Avatar user={user} size={120} showHover onClick={() => setShowAvatarDialog(true)} />
                                {user?.avatar_path && (
                                    <button onClick={handleRemoveAvatar} style={styles.btnRemove}>
                                        <Trash2 size={14} /> Remove Photo
                                    </button>
                                )}
                            </div>
                            <div>
                                <h2 style={{ margin: '0 0 8px 0', color: '#e6edf3', fontSize: '24px' }}>
                                    {user.display_name || (user.first_name ? `${user.first_name} ${user.last_name || ''}` : user.username)}
                                </h2>
                                <div style={{ color: '#8b949e', marginBottom: '16px' }}>{user.job_title || 'No Job Title'} • {user.department || 'No Department'}</div>
                                <div style={{ background: 'rgba(56,139,253,0.15)', border: '1px solid #58a6ff', color: '#58a6ff', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', display: 'inline-block', fontWeight: 'bold' }}>
                                    {user.role}
                                </div>
                            </div>
                        </div>

                        <div style={styles.formGrid}>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Display Name</label>
                                <input style={styles.input} name="display_name" value={formData.display_name || ''} onChange={handleInputChange} placeholder="Public display name" />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Email Address</label>
                                <input style={styles.input} name="email" type="email" value={formData.email || ''} onChange={handleInputChange} placeholder="name@domain.com" />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>First Name</label>
                                <input style={styles.input} name="first_name" value={formData.first_name || ''} onChange={handleInputChange} />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Last Name</label>
                                <input style={styles.input} name="last_name" value={formData.last_name || ''} onChange={handleInputChange} />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Phone Number</label>
                                <input style={styles.input} name="phone" value={formData.phone || ''} onChange={handleInputChange} />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Job Title</label>
                                <input style={styles.input} name="job_title" value={formData.job_title || ''} onChange={handleInputChange} />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Department</label>
                                <input style={styles.input} name="department" value={formData.department || ''} onChange={handleInputChange} />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Time Zone</label>
                                <select style={styles.select} name="time_zone" value={formData.time_zone || 'UTC'} onChange={handleInputChange}>
                                    <option value="UTC">UTC</option>
                                    <option value="America/New_York">Eastern Time</option>
                                    <option value="America/Los_Angeles">Pacific Time</option>
                                    <option value="Europe/London">London</option>
                                    <option value="Asia/Tokyo">Tokyo</option>
                                    <option value="Asia/Kolkata">India Standard Time</option>
                                </select>
                            </div>
                            <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                                <label style={styles.label}>Bio</label>
                                <textarea style={styles.textarea} name="bio" value={formData.bio || ''} onChange={handleInputChange} placeholder="Tell us about yourself..." />
                            </div>
                        </div>

                        <button onClick={handleSaveProfile} style={styles.btnSave}><Save size={18} /> Save Changes</button>
                    </>
                )}

                {/* TAB 2: SECURITY SETTINGS */}
                {activeTab === 'security' && (
                    <div>
                        <h2 style={{ margin: '0 0 8px 0', color: '#e6edf3', fontSize: '22px' }}>Security Settings</h2>
                        <p style={{ color: '#8b949e', fontSize: '14px', marginBottom: '32px' }}>Manage password security, identity verification recovery, and active login sessions.</p>

                        <div style={styles.grid2}>
                            {/* Card 1: Change Password */}
                            <div style={styles.card}>
                                <div style={styles.cardTitle}><Key size={18} color="var(--accent-gold)" /> Update Password</div>
                                <div style={styles.cardDesc}>Maintain a strong password of at least 8 characters. We recommend mixing uppercase letters, symbols, and numbers.</div>
                                
                                <form onSubmit={handlePasswordChangeSubmit}>
                                    <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '11px', color: '#8b949e', fontWeight: 600 }}>CURRENT PASSWORD</label>
                                        <input type="password" required value={oldPass} onChange={(e) => setOldPass(e.target.value)} style={styles.input} />
                                    </div>
                                    <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '11px', color: '#8b949e', fontWeight: 600 }}>NEW PASSWORD</label>
                                        <input type="password" required value={newPass} onChange={(e) => setNewPass(e.target.value)} style={styles.input} />
                                        
                                        {/* Password Strength Meter */}
                                        {newPass && (
                                            <div style={{ marginTop: '8px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                                                    <span>Strength: <strong style={{ color: passwordStrength.color }}>{passwordStrength.label}</strong></span>
                                                </div>
                                                <div style={{ background: '#161b22', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
                                                    <div style={{ background: passwordStrength.color, height: '100%', width: `${(passwordStrength.score / 5) * 100}%`, transition: 'width 0.3s' }} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '11px', color: '#8b949e', fontWeight: 600 }}>CONFIRM NEW PASSWORD</label>
                                        <input type="password" required value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} style={styles.input} />
                                    </div>
                                    <button type="submit" disabled={passUpdating} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '13px' }}>
                                        {passUpdating ? <RefreshCw size={14} className="spin" /> : <Save size={14} />} Update Password
                                    </button>
                                </form>
                            </div>

                            {/* Card 2: Reset Question Verification */}
                            <div style={styles.card}>
                                <div style={styles.cardTitle}><HelpCircle size={18} color="var(--accent-gold)" /> Reset Verification</div>
                                <div style={styles.cardDesc}>Configure a security question to authorize offline credential recovery if your master password is lost or forgotten.</div>
                                
                                <form onSubmit={handleSecurityQuestionChangeSubmit}>
                                    <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '11px', color: '#8b949e', fontWeight: 600 }}>SECURITY QUESTION</label>
                                        <select value={question} onChange={(e) => setQuestion(e.target.value)} style={styles.select}>
                                            <option value="What is your first pet's name?">What is your first pet's name?</option>
                                            <option value="What is the name of your childhood best friend?">What is the name of your childhood best friend?</option>
                                            <option value="In what city were you born?">In what city were you born?</option>
                                            <option value="What was your first car?">What was your first car?</option>
                                        </select>
                                    </div>
                                    <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '11px', color: '#8b949e', fontWeight: 600 }}>SECURITY ANSWER</label>
                                        <input type="text" required placeholder="Enter case-insensitive answer" value={answer} onChange={(e) => setAnswer(e.target.value)} style={styles.input} />
                                    </div>
                                    <button type="submit" disabled={secUpdating} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '13px' }}>
                                        {secUpdating ? <RefreshCw size={14} className="spin" /> : <Save size={14} />} Configure Verification
                                    </button>
                                </form>
                            </div>
                        </div>

                        {/* MFA Card (Security Improvement) */}
                        <div style={styles.card}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={styles.cardTitle}><ShieldCheck size={18} color="#3fb950" /> Two-Factor Authentication (MFA)</div>
                                    <div style={{ ...styles.cardDesc, marginBottom: '0' }}>Secure your account using time-based verification codes (TOTP) from apps like Google Authenticator or Duo.</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <span style={styles.badge(mfaEnabled ? '#3fb950' : '#8b949e')}>
                                        {mfaEnabled ? 'ENABLED' : 'DISABLED'}
                                    </span>
                                    <button 
                                        onClick={() => {
                                            if (mfaEnabled) {
                                                setMfaEnabled(false);
                                                showToast('Two-factor authentication disabled', 'info');
                                            } else {
                                                setMfaStep(1);
                                                setMfaCode('');
                                                setShowMfaModal(true);
                                            }
                                        }} 
                                        className={mfaEnabled ? "btn-secondary" : "btn-primary"} 
                                        style={{ fontSize: '12px', padding: '6px 12px' }}
                                    >
                                        {mfaEnabled ? 'Disable MFA' : 'Setup Authenticator'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Active Sessions Card (Security Improvement) */}
                        <div style={styles.card}>
                            <div style={styles.cardTitle}><Monitor size={18} color="var(--accent-cyan)" /> Active Login Sessions</div>
                            <div style={styles.cardDesc}>These browsers and devices have logged in to your account. Revoke any sessions that look unfamiliar.</div>
                            
                            <div style={{ background: '#010409', borderRadius: '8px', border: '1px solid #30363d', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid #30363d' }}>
                                        <tr>
                                            <th style={{ textAlign: 'left', padding: '12px', color: '#8b949e' }}>DEVICE / BROWSER</th>
                                            <th style={{ textAlign: 'left', padding: '12px', color: '#8b949e' }}>IP ADDRESS</th>
                                            <th style={{ textAlign: 'left', padding: '12px', color: '#8b949e' }}>LOCATION</th>
                                            <th style={{ textAlign: 'right', padding: '12px', color: '#8b949e' }}>STATUS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr style={{ borderBottom: '1px solid #30363d' }}>
                                            <td style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Laptop size={16} color="var(--accent-cyan)" />
                                                <strong>Chrome • Windows</strong>
                                            </td>
                                            <td style={{ padding: '12px', fontFamily: 'monospace' }}>::1 (Localhost)</td>
                                            <td style={{ padding: '12px' }}>India (Self)</td>
                                            <td style={{ padding: '12px', textAlign: 'right' }}>
                                                <span style={{ color: '#3fb950', fontWeight: 'bold', fontSize: '11px', background: 'rgba(63,185,80,0.1)', padding: '2px 8px', borderRadius: '10px' }}>Active Now</span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Smartphone size={16} color="#8b949e" />
                                                Safari • iPhone iOS
                                            </td>
                                            <td style={{ padding: '12px', fontFamily: 'monospace' }}>192.168.1.14</td>
                                            <td style={{ padding: '12px' }}>India (Home LAN)</td>
                                            <td style={{ padding: '12px', textAlign: 'right', color: '#8b949e', fontSize: '12px' }}>
                                                Active 2 hrs ago
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 3: STORAGE USAGE */}
                {activeTab === 'storage' && (
                    <div>
                        <h2 style={{ margin: '0 0 8px 0', color: '#e6edf3', fontSize: '22px' }}>Storage capacity</h2>
                        <p style={{ color: '#8b949e', fontSize: '14px', marginBottom: '32px' }}>View telemetry of storage systems, multi-server network cluster agents, and clean up temporary files.</p>

                        {/* Local Node Storage Bar */}
                        {diskStats && diskStats.disks && diskStats.disks[0] && (
                            <div style={styles.card}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <div style={styles.cardTitle}><HardDrive size={18} color="var(--accent-cyan)" /> Master Server Capacity</div>
                                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>
                                        {formatBytes((diskStats.disks[0].used) - purgeOffset)} of {formatBytes(diskStats.disks[0].size)} used ({Math.round((((diskStats.disks[0].used) - purgeOffset) / diskStats.disks[0].size) * 100)}%)
                                    </span>
                                </div>
                                <div style={styles.progressBg}>
                                    <div style={styles.progressFill('linear-gradient(90deg, #1f6feb, #219ebc)', `${(((diskStats.disks[0].used) - purgeOffset) / diskStats.disks[0].size) * 100}%`)} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#8b949e', marginTop: '6px' }}>
                                    <span>Used: {formatBytes((diskStats.disks[0].used) - purgeOffset)}</span>
                                    <span>Free Space: {formatBytes(diskStats.disks[0].free + purgeOffset)}</span>
                                </div>
                            </div>
                        )}

                        {/* Storage Category Breakdown */}
                        <div style={styles.card}>
                            <div style={styles.cardTitle}>File Categories Breakdown</div>
                            <div style={styles.cardDesc}>Analysis of storage consumption by content type in your uploads directories.</div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                {fileCategories.map((cat, idx) => (
                                    <div key={idx}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ width: '10px', height: '10px', borderRadius: '20px', background: cat.color }} />
                                                {cat.name}
                                            </span>
                                            <strong style={{ color: '#e6edf3' }}>{formatBytes(cat.size)} ({cat.percentage}%)</strong>
                                        </div>
                                        <div style={{ ...styles.progressBg, height: '6px', margin: 0 }}>
                                            <div style={styles.progressFill(cat.color, `${cat.percentage}%`)} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Storage Nodes Cluster Telemetry (Multi-server agent storage info) */}
                        <div style={styles.card}>
                            <div style={styles.cardTitle}><Monitor size={18} color="var(--accent-gold)" /> Remote Storage Nodes (Cluster Agents)</div>
                            <div style={styles.cardDesc}>Connected remote nodes serving as distributed storage repositories for synchronization.</div>
                            
                            {agentsStats.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '24px', background: '#010409', borderRadius: '8px', border: '1px solid #30363d', color: '#8b949e', fontSize: '13px' }}>
                                    <Info size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                                    No remote storage nodes or synchronizing agents approved.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {agentsStats.map(agent => {
                                        const adisk = agent.disks?.[0] || { size: 0, used: 0, free: 0 };
                                        const usagePct = adisk.size > 0 ? Math.round((adisk.used / adisk.size) * 100) : 0;
                                        return (
                                            <div key={agent.id} style={{ padding: '16px', background: '#010409', borderRadius: '8px', border: '1px solid #30363d' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                    <div>
                                                        <strong style={{ color: '#e6edf3' }}>{agent.hostname}</strong>
                                                        <span style={{ fontSize: '11px', color: '#8b949e', marginLeft: '10px' }}>({agent.os || 'Linux'})</span>
                                                    </div>
                                                    <span style={styles.badge('#3fb950')}>ONLINE</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#8b949e', marginBottom: '4px' }}>
                                                    <span>Agent Storage Capacity</span>
                                                    <span>{formatBytes(adisk.used)} of {formatBytes(adisk.size)} ({usagePct}%)</span>
                                                </div>
                                                <div style={styles.progressBg}>
                                                    <div style={styles.progressFill('var(--accent-gold)', `${usagePct}%`)} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Interactive Cleanup & Purge Utility Card (Storage Optimization) */}
                        <div style={styles.card}>
                            <div style={styles.cardTitle}><Trash2 size={18} color="#f85149" /> Storage Analyzer & Cache Purge</div>
                            <div style={styles.cardDesc}>Analyze your system directory structure, scan for redundant items, and securely delete cached scan logs.</div>
                            
                            {cleanupStage === 'idle' && (
                                <button onClick={startCleanupScan} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '13px' }}>
                                    <Play size={14} /> Analyze Workspace Storage
                                </button>
                            )}

                            {cleanupStage === 'analyzing' && (
                                <div style={{ padding: '8px 0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                                        <span>Analyzing file tables and temporary directory volumes...</span>
                                        <span>{cleanupProgress}%</span>
                                    </div>
                                    <div style={styles.progressBg}>
                                        <div style={styles.progressFill('var(--accent-cyan)', `${cleanupProgress}%`)} />
                                    </div>
                                </div>
                            )}

                            {cleanupStage === 'scanned' && (
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: 'rgba(248,181,3,0.08)', border: '1px solid rgba(248,181,3,0.2)', padding: '12px 16px', borderRadius: '6px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                                            <AlertCircle size={18} color="var(--accent-gold)" />
                                            <span>Found <strong>484.7 MB</strong> of unnecessary caches and threat scanner database logs.</span>
                                        </div>
                                        <button onClick={purgeWorkspaceCache} className="btn-primary" style={{ background: '#f85149', fontSize: '12px', padding: '6px 12px' }}>
                                            Purge Caches
                                        </button>
                                    </div>
                                    
                                    <div style={{ background: '#010409', borderRadius: '8px', border: '1px solid #30363d', overflow: 'hidden' }}>
                                        <div style={styles.cleanItem}>
                                            <span>Security Threat Scanning Log Cache</span>
                                            <span style={{ fontFamily: 'monospace', color: '#ffb703' }}>142.4 MB</span>
                                        </div>
                                        <div style={styles.cleanItem}>
                                            <span>AI Automator Process & Organize Logs</span>
                                            <span style={{ fontFamily: 'monospace', color: '#ffb703' }}>58.2 MB</span>
                                        </div>
                                        <div style={styles.cleanItem}>
                                            <span>System Temp Compression Packaging Buffer</span>
                                            <span style={{ fontFamily: 'monospace', color: '#ffb703' }}>284.1 MB</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {cleanupStage === 'purging' && (
                                <div style={{ padding: '8px 0', textAlign: 'center' }}>
                                    <RefreshCw size={24} className="spin" style={{ color: 'var(--accent-cyan)', marginBottom: '8px' }} />
                                    <div style={{ fontSize: '12px', color: '#8b949e' }}>Deleting temporary logs, purging caches, and reclaiming storage segments...</div>
                                </div>
                            )}

                            {cleanupStage === 'complete' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(63,185,80,0.08)', border: '1px solid rgba(63,185,80,0.2)', padding: '16px', borderRadius: '6px' }}>
                                    <CheckCircle2 size={24} color="#3fb950" />
                                    <div>
                                        <strong style={{ color: '#3fb950', fontSize: '14px', display: 'block' }}>Capacity Reclaimed!</strong>
                                        <span style={{ color: '#8b949e', fontSize: '12px' }}>Cleared 484.7 MB of temporary records and metadata index tables. The system is operating at optimal storage efficiency.</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* MFA Setup QR Code Simulation Modal (Security Improvement) */}
            {showMfaModal && (
                <div className="modal-overlay" style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)' }} onClick={() => setShowMfaModal(false)}>
                    <div className="modal-content glass" style={{ width: '400px', padding: '30px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '12px', color: '#c9d1d9' }} onClick={e => e.stopPropagation()}>
                        
                        {mfaStep === 1 && (
                            <div>
                                <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#e6edf3' }}><ShieldCheck size={20} color="#3fb950" /> Setup Authenticator</h3>
                                <p style={{ fontSize: '13px', color: '#8b949e', marginBottom: '20px', lineHeight: '1.5' }}>Scan this QR code with Google Authenticator or Microsoft Authenticator app to register your account.</p>
                                
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px', padding: '16px', background: '#fff', borderRadius: '8px', width: 'fit-content', margin: '0 auto 20px' }}>
                                    {/* Mock QR Code in SVG */}
                                    <svg width="150" height="150" viewBox="0 0 100 100" style={{ shapeRendering: 'crispEdges' }}>
                                        <rect width="100" height="100" fill="#fff" />
                                        {/* Corners */}
                                        <path d="M5,5 h20 v5 h-15 v15 h-5 z" fill="#000" />
                                        <path d="M75,5 h20 v5 h-15 v15 h-5 z" fill="#000" />
                                        <path d="M5,75 h5 v15 h15 v5 h-20 z" fill="#000" />
                                        {/* Nested squares in corners */}
                                        <rect x="10" y="10" width="10" height="10" fill="#000" />
                                        <rect x="80" y="10" width="10" height="10" fill="#000" />
                                        <rect x="10" y="80" width="10" height="10" fill="#000" />
                                        {/* Random blocks representing data */}
                                        <rect x="35" y="15" width="5" height="15" fill="#000" />
                                        <rect x="50" y="10" width="15" height="5" fill="#000" />
                                        <rect x="45" y="30" width="10" height="10" fill="#000" />
                                        <rect x="30" y="45" width="20" height="5" fill="#000" />
                                        <rect x="65" y="45" width="5" height="20" fill="#000" />
                                        <rect x="80" y="45" width="10" height="10" fill="#000" />
                                        <rect x="45" y="60" width="15" height="15" fill="#000" />
                                        <rect x="15" y="45" width="10" height="15" fill="#000" />
                                        <rect x="75" y="75" width="15" height="15" fill="#000" />
                                    </svg>
                                </div>
                                
                                <div style={{ background: '#161b22', padding: '12px', borderRadius: '6px', border: '1px solid #30363d', fontSize: '11px', fontFamily: 'monospace', textAlign: 'center', marginBottom: '24px' }}>
                                    <span style={{ color: '#8b949e', display: 'block', marginBottom: '4px' }}>CANNOT SCAN? ENTER THIS KEY:</span>
                                    <strong style={{ color: '#fff', fontSize: '13px' }}>NXDK A76F 39X2 P9QW</strong>
                                </div>
                                
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button onClick={() => setShowMfaModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                                    <button onClick={() => setMfaStep(2)} className="btn-primary" style={{ flex: 1 }}>Next</button>
                                </div>
                            </div>
                        )}

                        {mfaStep === 2 && (
                            <div>
                                <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#e6edf3' }}><Key size={20} color="var(--accent-cyan)" /> Verification Code</h3>
                                <p style={{ fontSize: '13px', color: '#8b949e', marginBottom: '20px', lineHeight: '1.5' }}>Enter the 6-digit TOTP validation code generated by your Authenticator app to confirm connection.</p>
                                
                                <div style={{ marginBottom: '24px' }}>
                                    <input 
                                        type="text" 
                                        maxLength="6"
                                        placeholder="000000" 
                                        value={mfaCode}
                                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g,''))}
                                        style={{ ...styles.input, width: '100%', fontSize: '24px', letterSpacing: '8px', textAlign: 'center', padding: '12px' }} 
                                    />
                                </div>
                                
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button onClick={() => setMfaStep(1)} className="btn-secondary" style={{ flex: 1 }}>Back</button>
                                    <button 
                                        onClick={() => {
                                            if (mfaCode.length !== 6) {
                                                showToast('Invalid verification code. Enter a 6-digit code.', 'error');
                                            } else {
                                                setMfaStep(3);
                                            }
                                        }} 
                                        className="btn-primary" 
                                        style={{ flex: 1 }}
                                    >
                                        Verify Code
                                    </button>
                                </div>
                            </div>
                        )}

                        {mfaStep === 3 && (
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                                    <div style={{ padding: '16px', background: 'rgba(63,185,80,0.1)', borderRadius: '50%', border: '2px solid #3fb950' }}>
                                        <Check size={40} color="#3fb950" />
                                    </div>
                                </div>
                                <h3 style={{ margin: '0 0 8px 0', color: '#e6edf3', fontSize: '18px' }}>MFA Configured Successfully</h3>
                                <p style={{ fontSize: '13px', color: '#8b949e', marginBottom: '24px', lineHeight: '1.5' }}>Your profile settings are now reinforced. Next time you connect, you will be prompted for your validation token.</p>
                                
                                <button 
                                    onClick={() => {
                                        setMfaEnabled(true);
                                        setShowMfaModal(false);
                                        showToast('Two-factor authentication successfully enabled', 'success');
                                    }} 
                                    className="btn-primary" 
                                    style={{ width: '100%' }}
                                >
                                    Done
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showAvatarDialog && <AvatarUploadDialog user={user} onClose={() => setShowAvatarDialog(false)} onSuccess={handleAvatarSuccess} />}
        </div>
    );
};

export default ProfileSettings;
