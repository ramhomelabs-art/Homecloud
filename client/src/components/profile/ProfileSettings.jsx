import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    User, Shield, Key, HardDrive, Save, Trash2, HelpCircle, Lock, 
    Monitor, Laptop, Smartphone, AlertCircle, RefreshCw, CheckCircle2, 
    ChevronRight, Play, Check, ShieldCheck, Info, LogOut, X, ShieldAlert
} from 'lucide-react';
import Avatar from './Avatar';
import AvatarUploadDialog from './AvatarUploadDialog';
import ConfirmModal from '../modals/ConfirmModal';

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
    const [mfaSecret, setMfaSecret] = useState('');
    const [mfaQrCode, setMfaQrCode] = useState(null);
    const [showMfaModal, setShowMfaModal] = useState(false);
    const [mfaStep, setMfaStep] = useState(1);
    const [mfaCode, setMfaCode] = useState('');
    const [showDisableMfaModal, setShowDisableMfaModal] = useState(false);
    const [disableMfaInput, setDisableMfaInput] = useState('');
    const [disablingMfa, setDisablingMfa] = useState(false);

    // Session States
    const [sessions, setSessions] = useState([]);
    const [loadingSessions, setLoadingSessions] = useState(false);

    // Storage States
    const [diskStats, setDiskStats] = useState(null);
    const [agentsStats, setAgentsStats] = useState([]);
    const [loadingStorage, setLoadingStorage] = useState(false);
    const [fileCategories, setFileCategories] = useState([]);
    const [reclaimableStats, setReclaimableStats] = useState({ trashSize: 0, tempSize: 0, logSize: 0, totalReclaimable: 0 });
    
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
            setMfaEnabled(!!res.data.mfa_enabled);
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
            
            const raw = diskRes.data.categories || { media: 0, images: 0, documents: 0, archives: 0, other: 0 };
            const isEstimated = !!raw._estimated;

            // Filter out the internal flag before computing totals
            const categoriesData = {
                media: raw.media || 0,
                images: raw.images || 0,
                documents: raw.documents || 0,
                archives: raw.archives || 0,
                other: raw.other || 0
            };
            const totalCategoriesSize = Object.values(categoriesData).reduce((a, b) => a + b, 0);

            const getPercentage = (val) => {
                if (totalCategoriesSize === 0) return 0;
                return Math.round((val / totalCategoriesSize) * 100);
            };

            setFileCategories([
                { name: 'Media Files (Videos & Audio)', size: categoriesData.media, percentage: getPercentage(categoriesData.media), color: '#ffb703', estimated: isEstimated },
                { name: 'Image Avatars & Photos', size: categoriesData.images, percentage: getPercentage(categoriesData.images), color: '#219ebc', estimated: isEstimated },
                { name: 'Document Files (PDF, TXT, MD)', size: categoriesData.documents, percentage: getPercentage(categoriesData.documents), color: '#3fb950', estimated: isEstimated },
                { name: 'System Backups & Archives', size: categoriesData.archives, percentage: getPercentage(categoriesData.archives), color: '#1f6feb', estimated: isEstimated },
                { name: 'Other Items', size: categoriesData.other, percentage: getPercentage(categoriesData.other), color: 'var(--text-secondary)', estimated: isEstimated }
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
        if (activeTab === 'security') {
            fetchSessions();
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

    // In-UI Confirmation Modal State
    const [confirmAction, setConfirmAction] = useState(null);

    const handleRemoveAvatar = () => {
        setConfirmAction({
            title: 'Remove Profile Photo',
            message: 'Are you sure you want to remove your profile photo and reset to default initials?',
            confirmText: 'Remove Photo',
            type: 'warning',
            onConfirm: async () => {
                try {
                    await axios.delete('/api/v1/profile/avatar');
                    const updated = { ...user, avatar_path: null, avatar_thumbnail_path: null };
                    setUser(updated);
                    if (onProfileUpdate) onProfileUpdate(updated);
                    showToast('Profile photo removed', 'success');
                } catch (e) {
                    showToast('Failed to remove avatar', 'error');
                }
            }
        });
    };

    const fetchSessions = async () => {
        setLoadingSessions(true);
        try {
            const res = await axios.get('/api/v1/auth/sessions');
            setSessions(res.data || []);
        } catch (e) {
            console.error('Failed to fetch sessions', e);
        } finally {
            setLoadingSessions(false);
        }
    };

    const handleRevokeSession = (sessionId) => {
        if (!sessionId) return;
        setConfirmAction({
            title: 'Revoke Device Session',
            message: 'Are you sure you want to revoke this session? That device will be disconnected immediately.',
            confirmText: 'Revoke Session',
            type: 'danger',
            onConfirm: async () => {
                try {
                    await axios.delete(`/api/v1/auth/sessions/${sessionId}`);
                    showToast('Session revoked successfully', 'success');
                    fetchSessions();
                } catch (e) {
                    showToast('Failed to revoke session', 'error');
                }
            }
        });
    };

    const handleRevokeOtherSessions = () => {
        setConfirmAction({
            title: 'Revoke All Other Sessions',
            message: 'Are you sure you want to log out from all other devices and keep only this current session active?',
            confirmText: 'Log Out Others',
            type: 'warning',
            onConfirm: async () => {
                try {
                    await axios.post('/api/v1/auth/sessions/revoke-others');
                    showToast('All other sessions revoked successfully', 'success');
                    fetchSessions();
                } catch (e) {
                    showToast('Failed to revoke other sessions', 'error');
                }
            }
        });
    };

    const handleConfirmDisableMfa = async (e) => {
        e.preventDefault();
        if (!disableMfaInput) return;
        setDisablingMfa(true);
        try {
            await axios.post('/api/v1/auth/mfa/disable', { 
                password: disableMfaInput,
                code: disableMfaInput
            });
            setMfaEnabled(false);
            setShowDisableMfaModal(false);
            setDisableMfaInput('');
            showToast('Two-factor authentication disabled', 'info');
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to disable MFA. Incorrect password or code.', 'error');
        } finally {
            setDisablingMfa(false);
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

    // Analyze workspace cleanup
    const startCleanupScan = async () => {
        setCleanupStage('analyzing');
        setCleanupProgress(0);
        
        let progress = 0;
        if (cleanupIntervalRef.current) clearInterval(cleanupIntervalRef.current);
        cleanupIntervalRef.current = setInterval(() => {
            progress += 10;
            setCleanupProgress(Math.min(progress, 90)); // cap at 90
        }, 100);

        try {
            const res = await axios.get('/api/v1/storage/analyze');
            setReclaimableStats(res.data);
            clearInterval(cleanupIntervalRef.current);
            cleanupIntervalRef.current = null;
            setCleanupProgress(100);
            setTimeout(() => {
                setCleanupStage('scanned');
            }, 300);
        } catch (err) {
            clearInterval(cleanupIntervalRef.current);
            cleanupIntervalRef.current = null;
            setCleanupStage('idle');
            showToast(err.response?.data?.error || 'Failed to analyze storage', 'error');
        }
    };

    const purgeWorkspaceCache = async () => {
        setCleanupStage('purging');
        try {
            await axios.post('/api/v1/storage/clean');
            setCleanupStage('complete');
            showToast('Storage optimized successfully', 'success');
            fetchStorageStats();
        } catch (err) {
            setCleanupStage('scanned');
            showToast(err.response?.data?.error || 'Failed to purge storage', 'error');
        }
    };

    const styles = {
        container: { padding: '32px', color: 'var(--text-secondary)', background: 'var(--bg-surface-0)', minHeight: '100vh', fontFamily: "'Inter', sans-serif", display: 'flex', gap: '32px' },
        sidebar: { width: '250px', display: 'flex', flexDirection: 'column', gap: '8px' },
        tabBtn: (active) => ({ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: active ? 'linear-gradient(135deg, var(--primary-light), var(--primary))' : 'transparent', color: active ? '#ffffff' : 'var(--text-secondary)', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontWeight: active ? 600 : 400, fontSize: '14px', transition: 'all 0.2s', outline: 'none' }),
        main: { flex: 1, background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '32px', position: 'relative' },
        header: { display: 'flex', gap: '24px', alignItems: 'flex-start', marginBottom: '40px', paddingBottom: '32px', borderBottom: '1px solid var(--border-subtle)' },
        formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' },
        formGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
        label: { fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' },
        input: { background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '10px 12px', borderRadius: '6px', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' },
        select: { background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '10px 12px', borderRadius: '6px', fontSize: '14px', outline: 'none', cursor: 'pointer' },
        textarea: { background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '10px 12px', borderRadius: '6px', fontSize: '14px', minHeight: '100px', resize: 'vertical', outline: 'none' },
        btnSave: { background: '#238636', border: 'none', color: 'var(--text-primary)', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, marginTop: '24px', transition: 'background-color 0.2s' },
        btnRemove: { background: 'transparent', border: '1px solid #f85149', color: '#f85149', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', transition: 'background-color 0.2s' },
        
        // Premium components
        card: { background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '24px', marginBottom: '24px' },
        cardTitle: { display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 8px 0', fontSize: '16px', color: 'var(--text-primary)', fontWeight: 600 },
        cardDesc: { color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px', lineHeight: '1.5' },
        grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' },
        badge: (color) => ({ background: color + '15', border: '1px solid ' + color, color: color, padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, display: 'inline-block' }),
        
        // Progress bar
        progressBg: { background: 'var(--bg-surface-1)', borderRadius: '8px', height: '10px', width: '100%', overflow: 'hidden', display: 'flex', margin: '8px 0' },
        progressFill: (color, width) => ({ background: color, height: '100%', width: width, transition: 'width 0.4s ease' }),
        
        // Cleanup list
        cleanItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '1px solid var(--border-subtle)', fontSize: '13px' },
        
        // Custom Toast style
        toastFloating: (type) => ({
            position: 'absolute',
            top: '24px',
            right: '32px',
            background: type === 'error' ? 'rgba(248, 81, 73, 0.95)' : 'rgba(46, 160, 67, 0.95)',
            color: 'var(--text-primary)',
            padding: '10px 20px',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            border: '1px solid var(--border-subtle)'
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
                                <h2 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)', fontSize: '24px' }}>
                                    {user.display_name || (user.first_name ? `${user.first_name} ${user.last_name || ''}` : user.username)}
                                </h2>
                                <div style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>{user.job_title || 'No Job Title'} • {user.department || 'No Department'}</div>
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
                        <h2 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)', fontSize: '22px' }}>Security Settings</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>Manage password security, identity verification recovery, and active login sessions.</p>

                        <div style={styles.grid2}>
                            {/* Card 1: Change Password */}
                            <div style={styles.card}>
                                <div style={styles.cardTitle}><Key size={18} color="var(--accent-gold)" /> Update Password</div>
                                <div style={styles.cardDesc}>Maintain a strong password of at least 8 characters. We recommend mixing uppercase letters, symbols, and numbers.</div>
                                
                                <form onSubmit={handlePasswordChangeSubmit}>
                                    <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>CURRENT PASSWORD</label>
                                        <input type="password" required value={oldPass} onChange={(e) => setOldPass(e.target.value)} style={styles.input} />
                                    </div>
                                    <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>NEW PASSWORD</label>
                                        <input type="password" required value={newPass} onChange={(e) => setNewPass(e.target.value)} style={styles.input} />
                                        
                                        {/* Password Strength Meter */}
                                        {newPass && (
                                            <div style={{ marginTop: '8px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                                                    <span>Strength: <strong style={{ color: passwordStrength.color }}>{passwordStrength.label}</strong></span>
                                                </div>
                                                <div style={{ background: 'var(--bg-surface-1)', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
                                                    <div style={{ background: passwordStrength.color, height: '100%', width: `${(passwordStrength.score / 5) * 100}%`, transition: 'width 0.3s' }} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>CONFIRM NEW PASSWORD</label>
                                        <input type="password" required value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} style={styles.input} />
                                    </div>
                                    <button type="submit" disabled={passUpdating} className="btn-primary" style={{  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '13px' , color: '#ffffff' }}>
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
                                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>SECURITY QUESTION</label>
                                        <select value={question} onChange={(e) => setQuestion(e.target.value)} style={styles.select}>
                                            <option value="What is your first pet's name?">What is your first pet's name?</option>
                                            <option value="What is the name of your childhood best friend?">What is the name of your childhood best friend?</option>
                                            <option value="In what city were you born?">In what city were you born?</option>
                                            <option value="What was your first car?">What was your first car?</option>
                                        </select>
                                    </div>
                                    <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>SECURITY ANSWER</label>
                                        <input type="text" required placeholder="Enter case-insensitive answer" value={answer} onChange={(e) => setAnswer(e.target.value)} style={styles.input} />
                                    </div>
                                    <button type="submit" disabled={secUpdating} className="btn-primary" style={{  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '13px' , color: '#ffffff' }}>
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
                                                setDisableMfaInput('');
                                                setShowDisableMfaModal(true);
                                            } else {
                                                setMfaStep(1);
                                                setMfaCode('');
                                                setMfaSecret('');
                                                setMfaQrCode(null);
                                                axios.post('/api/v1/auth/mfa/setup')
                                                    .then(res => {
                                                        setMfaSecret(res.data.secret);
                                                        setMfaQrCode(res.data.qrCode || null);
                                                        setShowMfaModal(true);
                                                    })
                                                    .catch(err => {
                                                        showToast('Failed to initialize MFA setup', 'error');
                                                    });
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

                        {/* Active Sessions Card */}
                        <div style={styles.card}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
                                <div style={styles.cardTitle}><Monitor size={18} color="var(--accent-cyan)" /> Active Login Sessions</div>
                                {sessions.length > 1 && (
                                    <button 
                                        onClick={handleRevokeOtherSessions}
                                        className="btn-secondary"
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px', color: '#f43f5e', borderColor: 'rgba(244, 63, 94, 0.3)', fontWeight: '700', borderRadius: '8px' }}
                                    >
                                        <LogOut size={14} /> Log Out All Other Devices
                                    </button>
                                )}
                            </div>
                            <div style={styles.cardDesc}>These browsers and devices have logged in to your account. Revoke any sessions that look unfamiliar.</div>
                            
                            <div style={{ background: 'var(--bg-surface-0)', borderRadius: '12px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                                {loadingSessions ? (
                                    <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>Loading active sessions...</div>
                                ) : sessions.length === 0 ? (
                                    <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>No active login sessions found.</div>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                        <thead style={{ background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--border-subtle)' }}>
                                            <tr>
                                                <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px' }}>DEVICE / BROWSER</th>
                                                <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px' }}>IP ADDRESS</th>
                                                <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px' }}>LOCATION</th>
                                                <th style={{ textAlign: 'center', padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px' }}>STATUS</th>
                                                <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px' }}>ACTION</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sessions.map((s, idx) => (
                                                <tr key={s.id || idx} style={{ borderBottom: idx < sessions.length - 1 ? '1px solid var(--border-subtle)' : 'none', background: s.isActive ? 'rgba(16, 185, 129, 0.03)' : 'transparent' }}>
                                                    <td style={{ padding: '14px 16px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <div style={{ 
                                                                width: '32px', 
                                                                height: '32px', 
                                                                borderRadius: '8px', 
                                                                background: s.isActive ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-surface-2)', 
                                                                display: 'flex', 
                                                                alignItems: 'center', 
                                                                justifyContent: 'center' 
                                                            }}>
                                                                {s.icon === 'smartphone' ? <Smartphone size={16} color={s.isActive ? '#10b981' : '#8b949e'} /> : s.icon === 'laptop' ? <Laptop size={16} color={s.isActive ? '#10b981' : '#8b949e'} /> : <Monitor size={16} color={s.isActive ? '#10b981' : '#8b949e'} />}
                                                            </div>
                                                            <div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <span style={{ fontWeight: s.isActive ? 700 : 500, color: 'var(--text-primary)' }}>{s.device}</span>
                                                                    {s.isActive && (
                                                                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.18)', color: '#10b981', fontWeight: '800' }}>
                                                                            THIS DEVICE
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>{s.ip}</td>
                                                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '12px' }}>{s.location}</td>
                                                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                                        {s.isActive ? (
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: '700', fontSize: '11px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '3px 8px', borderRadius: '12px' }}>
                                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
                                                                Active Now
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>{s.status}</span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                                        {s.isActive ? (
                                                            <span style={{ color: 'var(--text-dim)', fontSize: '11px', fontWeight: '600' }}>Current Session</span>
                                                        ) : (
                                                            <button 
                                                                onClick={() => handleRevokeSession(s.id)}
                                                                className="btn-secondary"
                                                                style={{ padding: '4px 10px', fontSize: '11px', color: '#f43f5e', borderColor: 'rgba(244,63,94,0.3)', borderRadius: '6px', fontWeight: '700' }}
                                                            >
                                                                Revoke
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 3: STORAGE USAGE */}
                {activeTab === 'storage' && (
                    <div>
                        <h2 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)', fontSize: '22px' }}>Storage capacity</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>View telemetry of storage systems, multi-server network cluster agents, and clean up temporary files.</p>

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
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                                    <span>Used: {formatBytes((diskStats.disks[0].used) - purgeOffset)}</span>
                                    <span>Free Space: {formatBytes(diskStats.disks[0].free + purgeOffset)}</span>
                                </div>
                            </div>
                        )}

                        {/* Storage Category Breakdown */}
                        <div style={styles.card}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <div style={styles.cardTitle}>File Categories Breakdown</div>
                                {fileCategories.length > 0 && fileCategories[0]?.estimated && (
                                    <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-secondary)', background: 'var(--bg-surface-2)', padding: '3px 8px', borderRadius: '20px', border: '1px solid var(--border-subtle)' }}>
                                        ~ ESTIMATED
                                    </span>
                                )}
                            </div>
                            <div style={styles.cardDesc}>
                                {fileCategories.length > 0 && fileCategories[0]?.estimated
                                    ? 'Proportional estimate based on total disk usage. Upload files to NexaDisk to see actual breakdown.'
                                    : 'Analysis of storage consumption by content type in your uploads directories.'
                                }
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                {fileCategories.map((cat, idx) => (
                                    <div key={idx}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ width: '10px', height: '10px', borderRadius: '20px', background: cat.color }} />
                                                {cat.name}
                                            </span>
                                            <strong style={{ color: 'var(--text-primary)' }}>{formatBytes(cat.size)} ({cat.percentage}%)</strong>
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
                                <div style={{ textAlign: 'center', padding: '24px', background: 'var(--bg-surface-0)', borderRadius: '8px', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                    <Info size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                                    No remote storage nodes or synchronizing agents approved.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {agentsStats.map(agent => {
                                        const adisk = agent.disks?.[0] || { size: 0, used: 0, free: 0 };
                                        const usagePct = adisk.size > 0 ? Math.round((adisk.used / adisk.size) * 100) : 0;
                                        return (
                                            <div key={agent.id} style={{ padding: '16px', background: 'var(--bg-surface-0)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                    <div>
                                                        <strong style={{ color: 'var(--text-primary)' }}>{agent.hostname}</strong>
                                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '10px' }}>({agent.os || 'Linux'})</span>
                                                    </div>
                                                    <span style={styles.badge('#3fb950')}>ONLINE</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
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
                                <button onClick={startCleanupScan} className="btn-primary" style={{  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '13px' , color: '#ffffff' }}>
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
                                            <span>Found <strong>{formatBytes(reclaimableStats.totalReclaimable)}</strong> of redundant caches and system logs.</span>
                                        </div>
                                        <button onClick={purgeWorkspaceCache} className="btn-primary" style={{  background: '#f85149', fontSize: '12px', padding: '6px 12px' , color: '#ffffff' }}>
                                            Purge Caches
                                        </button>
                                    </div>
                                    
                                    <div style={{ background: 'var(--bg-surface-0)', borderRadius: '8px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                                        <div style={styles.cleanItem}>
                                            <span>Trash Bin Storage Capacity</span>
                                            <span style={{ fontFamily: 'monospace', color: '#ffb703' }}>{formatBytes(reclaimableStats.trashSize)}</span>
                                        </div>
                                        <div style={styles.cleanItem}>
                                            <span>Temporary Multipart & Package Buffers</span>
                                            <span style={{ fontFamily: 'monospace', color: '#ffb703' }}>{formatBytes(reclaimableStats.tempSize)}</span>
                                        </div>
                                        <div style={styles.cleanItem}>
                                            <span>System Alert & Activity database logs</span>
                                            <span style={{ fontFamily: 'monospace', color: '#ffb703' }}>{formatBytes(reclaimableStats.logSize)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {cleanupStage === 'purging' && (
                                <div style={{ padding: '8px 0', textAlign: 'center' }}>
                                    <RefreshCw size={24} className="spin" style={{ color: 'var(--accent-cyan)', marginBottom: '8px' }} />
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Deleting temporary logs, purging caches, and reclaiming storage segments...</div>
                                </div>
                            )}

                            {cleanupStage === 'complete' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(63,185,80,0.08)', border: '1px solid rgba(63,185,80,0.2)', padding: '16px', borderRadius: '6px' }}>
                                    <CheckCircle2 size={24} color="#3fb950" />
                                    <div>
                                        <strong style={{ color: '#3fb950', fontSize: '14px', display: 'block' }}>Capacity Reclaimed!</strong>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Cleared temporary records and metadata index tables. The system is operating at optimal storage efficiency.</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* MFA Setup QR Code simulation and validation (Security Improvement) */}
            {showMfaModal && (
                <div className="modal-overlay" style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)' }} onClick={() => setShowMfaModal(false)}>
                    <div className="modal-content glass" style={{ width: '400px', padding: '30px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '12px', color: 'var(--text-secondary)' }} onClick={e => e.stopPropagation()}>
                        
                        {mfaStep === 1 && (
                            <div>
                                <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}><ShieldCheck size={20} color="#3fb950" /> Setup Authenticator</h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>Scan this QR code with Google Authenticator or Microsoft Authenticator app to register your account.</p>
                                
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px', padding: '16px', background: '#fff', borderRadius: '8px', width: 'fit-content', margin: '0 auto 20px' }}>
                                    {mfaQrCode ? (
                                        <img 
                                            src={mfaQrCode}
                                            alt="MFA QR Code"
                                            style={{ width: '150px', height: '150px', display: 'block' }}
                                        />
                                    ) : (
                                        <div style={{ width: '150px', height: '150px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa', border: '1px dashed #ced4da', color: '#495057', fontSize: '11px', textAlign: 'center', padding: '10px', boxSizing: 'border-box', borderRadius: '4px' }}>
                                            <span style={{ fontWeight: 'bold', marginBottom: '6px', color: '#212529' }}>QR Code Offline</span>
                                            <span>Please use the manual secret key below to configure your authenticator app.</span>
                                        </div>
                                    )}
                                </div>
                                
                                <div style={{ background: 'var(--bg-surface-1)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', fontSize: '11px', fontFamily: 'monospace', textAlign: 'center', marginBottom: '24px' }}>
                                    <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>CANNOT SCAN? ENTER THIS KEY:</span>
                                    <strong style={{ color: 'var(--text-primary)', fontSize: '13px', letterSpacing: '1px' }}>{mfaSecret ? mfaSecret.match(/.{1,4}/g).join(' ') : ''}</strong>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(mfaSecret).then(() => {
                                                showToast('Secret key copied to clipboard', 'success');
                                            }).catch(() => {
                                                showToast('Could not copy — please copy the key manually', 'error');
                                            });
                                        }}
                                        style={{ display: 'block', margin: '10px auto 0', background: 'rgba(31,111,235,0.15)', border: '1px solid #1f6feb', color: '#58a6ff', padding: '4px 14px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' }}
                                    >
                                        Copy Key
                                    </button>
                                </div>
                                
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button onClick={() => setShowMfaModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                                    <button onClick={() => setMfaStep(2)} className="btn-primary" style={{  flex: 1 , color: '#ffffff' }}>Next</button>
                                </div>
                            </div>
                        )}

                        {mfaStep === 2 && (
                            <div>
                                <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}><Key size={20} color="var(--accent-cyan)" /> Verification Code</h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>Enter the 6-digit TOTP validation code generated by your Authenticator app to confirm connection.</p>
                                
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
                                                axios.post('/api/v1/auth/mfa/verify', { secret: mfaSecret, code: mfaCode })
                                                    .then(() => {
                                                        setMfaStep(3);
                                                    })
                                                    .catch(err => {
                                                        showToast(err.response?.data?.error || 'Verification failed. Try again.', 'error');
                                                    });
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
                                <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)', fontSize: '18px' }}>MFA Configured Successfully</h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>Your profile settings are now reinforced. Next time you connect, you will be prompted for your validation token.</p>
                                
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

            {/* IN-APP DISABLE MFA MODAL (Replaces window.prompt) */}
            {showDisableMfaModal && (
                <div 
                    className="modal-overlay" 
                    style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)' }} 
                    onClick={() => setShowDisableMfaModal(false)}
                >
                    <div 
                        className="modal-content glass" 
                        style={{ width: '100%', maxWidth: '440px', padding: '28px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '18px', boxShadow: 'var(--shadow-lg)' }} 
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Lock size={20} color="#f43f5e" /> Disable Two-Factor Authentication
                            </h3>
                            <button onClick={() => setShowDisableMfaModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><X size={18} /></button>
                        </div>

                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>
                            Please enter your <strong>Account Password</strong> or current <strong>6-digit Authenticator Code</strong> to verify and disable MFA.
                        </p>

                        <form onSubmit={handleConfirmDisableMfa} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Password or 6-Digit TOTP Code *
                                </label>
                                <input 
                                    type="password"
                                    className="m-input"
                                    autoFocus
                                    required
                                    placeholder="Enter account password or 6-digit code (e.g. 718542)"
                                    value={disableMfaInput}
                                    onChange={e => setDisableMfaInput(e.target.value)}
                                    style={{ fontSize: '14px', padding: '12px 14px' }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                                <button 
                                    type="button" 
                                    onClick={() => setShowDisableMfaModal(false)} 
                                    className="btn-secondary" 
                                    style={{ padding: '8px 18px', borderRadius: '10px', fontWeight: '700' }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={disablingMfa || !disableMfaInput.trim()} 
                                    style={{ 
                                        padding: '8px 20px', 
                                        borderRadius: '10px', 
                                        fontWeight: '800',
                                        background: '#f43f5e',
                                        color: '#ffffff',
                                        border: 'none',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    {disablingMfa ? <RefreshCw size={14} className="spin" /> : <ShieldAlert size={15} />}
                                    {disablingMfa ? 'Disabling...' : 'Confirm & Disable MFA'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showAvatarDialog && <AvatarUploadDialog user={user} onClose={() => setShowAvatarDialog(false)} onSuccess={handleAvatarSuccess} />}

            {/* In-UI Confirmation Modal */}
            <ConfirmModal
                show={!!confirmAction}
                title={confirmAction?.title || 'Confirm Action'}
                message={confirmAction?.message || ''}
                confirmText={confirmAction?.confirmText || 'Confirm'}
                cancelText="Cancel"
                type={confirmAction?.type || 'danger'}
                onConfirm={() => {
                    if (confirmAction?.onConfirm) confirmAction.onConfirm();
                    setConfirmAction(null);
                }}
                onCancel={() => setConfirmAction(null)}
            />
        </div>
    );
};

export default ProfileSettings;
