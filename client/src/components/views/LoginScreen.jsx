import React, { useState } from 'react';
import axios from 'axios';
import { 
    User, Lock, Eye, EyeOff, Database, Key 
} from 'lucide-react';

const API_BASE = '/api';

export default function LoginScreen({ handleLogin, appName = "NexaDisk" }) {
    const [mode, setMode] = useState('login'); // 'login', 'forgot_username', 'forgot_verify'
    const [forgotUsername, setForgotUsername] = useState('');
    const [securityQuestion, setSecurityQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Animation states
    const [loginSuccess, setLoginSuccess] = useState(null); // { username, userId, avatar }
    const [loginError, setLoginError] = useState(false);
    const [shake, setShake] = useState(false);

    const handleLocalSubmitLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const username = e.target.username.value;
        const password = e.target.password.value;
        try {
            const res = await axios.post(`${API_BASE}/login`, { username, password });
            
            // Set login success state to trigger animated transition screen
            setLoginSuccess({
                username: res.data.username,
                userId: res.data.id,
                avatar: res.data.avatar_path
            });
            
            // Save credentials
            const token = res.data.token;
            const role = res.data.role;
            localStorage.setItem('token', token);
            localStorage.setItem('username', res.data.username);
            localStorage.setItem('userRole', role);
            
            // Keep splash page visible for 2.5 seconds to showcase the animation
            setTimeout(() => {
                handleLogin(token, res.data.username, role);
            }, 2500);
            
        } catch (err) {
            setShake(true);
            setLoginError(true);
            const msg = err.response?.data?.error || err.response?.data?.message || 'Username or password is wrong';
            setError(msg);
            
            // Clear error animation after 3.5 seconds
            setTimeout(() => {
                setShake(false);
                setLoginError(false);
                setError('');
            }, 3500);
        } finally {
            setLoading(false);
        }
    };

    const handleFetchQuestion = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        if (!forgotUsername) return;
        setLoading(true);
        try {
            const res = await axios.get(`/api/auth/forgot-password/question?username=${encodeURIComponent(forgotUsername)}`);
            setSecurityQuestion(res.data.question);
            setMode('forgot_verify');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to fetch security question.');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPasswordSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        setLoading(true);
        try {
            const res = await axios.post('/api/auth/forgot-password/reset', {
                username: forgotUsername,
                answer,
                newPassword
            });
            setMessage(res.data.message || 'Password reset successfully.');
            setTimeout(() => {
                setMode('login');
                // clear forgot pass states
                setForgotUsername('');
                setSecurityQuestion('');
                setAnswer('');
                setNewPassword('');
                setConfirmPassword('');
                setError('');
                setMessage('');
            }, 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to reset password.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-screen">
            <div className={`login-auth-card ${shake ? 'card-shake' : ''}`}>
                {loginSuccess ? (
                    <div className="success-animation-container">
                        <div className="success-avatar-wrapper">
                            <div className="success-avatar-glow"></div>
                            {loginSuccess.avatar ? (
                                <img 
                                    src={`/api/v1/profile/avatar/${loginSuccess.userId}?t=${Date.now()}`} 
                                    alt="Profile" 
                                    className="success-avatar-img"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        const fallback = document.getElementById('avatar-fallback-initials');
                                        if (fallback) fallback.style.display = 'flex';
                                    }}
                                />
                            ) : null}
                            <div 
                                id="avatar-fallback-initials"
                                className="success-avatar-fallback"
                                style={{ display: loginSuccess.avatar ? 'none' : 'flex' }}
                            >
                                {loginSuccess.username.charAt(0)}
                            </div>
                        </div>
                        <h2 className="success-welcome-text">Hi, {loginSuccess.username} 👋</h2>
                        <p className="success-subtitle">Authentication successful. Opening vault...</p>
                        <div className="success-loader-bar">
                            <div className="success-loader-fill"></div>
                        </div>
                    </div>
                ) : loginError ? (
                    <div className="error-animation-container">
                        <div className="angry-emoji">😠</div>
                        <h3 className="error-text-title">ACCESS DENIED</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', lineHeight: '1.4', margin: '8px 0 0' }}>
                            {error || 'Username or password is wrong'}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="login-header">
                            <div className="logo-icon">
                                <Database size={28} color="#ffffff" />
                            </div>
                            <h1 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>{appName}</h1>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: '500' }}>Enterprise Storage & Fleet Console</p>
                        </div>

                        {mode === 'login' && (
                            <form onSubmit={handleLocalSubmitLogin}>
                                <div className="form-field">
                                    <label>Master ID</label>
                                    <div className="form-input-wrapper">
                                        <User size={18} className="form-input-icon" />
                                        <input name="username" placeholder="Enter username" required style={{ paddingLeft: '44px' }} />
                                    </div>
                                </div>
                                <div className="form-field">
                                    <label>Passkey</label>
                                    <div className="form-input-wrapper">
                                        <Lock size={18} className="form-input-icon" />
                                        <input 
                                            name="password" 
                                            type={showPassword ? "text" : "password"} 
                                            placeholder="Enter passkey" 
                                            required 
                                            style={{ paddingLeft: '44px', paddingRight: '44px' }} 
                                        />
                                        <button 
                                            type="button" 
                                            className="password-toggle-btn"
                                            onClick={() => setShowPassword(!showPassword)}
                                            tabIndex="-1"
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                                <button type="submit" className="auth-submit-btn">Authorize</button>

                                <div style={{ marginTop: '18px', textAlign: 'right' }}>
                                    <span 
                                        onClick={() => { setMode('forgot_username'); setError(''); setMessage(''); }}
                                        className="forgot-link-btn"
                                    >
                                        Forgot Passkey?
                                    </span>
                                </div>
                            </form>
                        )}

                        {mode === 'forgot_username' && (
                            <form onSubmit={handleFetchQuestion}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', textAlign: 'center', color: 'var(--text-primary)' }}>Reset Passkey</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px', lineHeight: '1.4' }}>
                                    Enter your Username to retrieve your registered security question.
                                </p>
                                
                                {error && <div style={{ color: '#f85149', fontSize: '13px', marginBottom: '16px', textAlign: 'left', background: 'rgba(248,81,73,0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(248,81,73,0.2)' }}>{error}</div>}

                                <div className="form-field">
                                    <label>Username</label>
                                    <div className="form-input-wrapper">
                                        <User size={18} className="form-input-icon" />
                                        <input 
                                            value={forgotUsername} 
                                            onChange={e => setForgotUsername(e.target.value)} 
                                            placeholder="Enter username" 
                                            required 
                                            style={{ paddingLeft: '44px' }}
                                        />
                                    </div>
                                </div>

                                <button type="submit" className="auth-submit-btn" disabled={loading}>
                                    {loading ? 'Verifying...' : 'Retrieve Security Question'}
                                </button>

                                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                                    <span 
                                        onClick={() => setMode('login')}
                                        className="forgot-link-btn"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        Back to Login
                                    </span>
                                </div>
                            </form>
                        )}

                        {mode === 'forgot_verify' && (
                            <form onSubmit={handleResetPasswordSubmit}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', textAlign: 'center', color: 'var(--text-primary)' }}>Identity Verification</h3>
                                
                                {error && <div style={{ color: '#f85149', fontSize: '13px', marginBottom: '16px', textAlign: 'left', background: 'rgba(248,81,73,0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(248,81,73,0.2)' }}>{error}</div>}
                                {message && <div style={{ color: '#3fb950', fontSize: '13px', marginBottom: '16px', textAlign: 'left', background: 'rgba(63,185,80,0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(63,185,80,0.2)' }}>{message}</div>}

                                <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-dim)', marginBottom: '20px', textAlign: 'left' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Security Question</div>
                                    <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '600', lineHeight: '1.4' }}>{securityQuestion}</div>
                                </div>

                                <div className="form-field">
                                    <label>Your Answer</label>
                                    <div className="form-input-wrapper">
                                        <Key size={18} className="form-input-icon" />
                                        <input 
                                            value={answer} 
                                            onChange={e => setAnswer(e.target.value)} 
                                            placeholder="Answer is case-insensitive" 
                                            required 
                                            style={{ paddingLeft: '44px' }}
                                        />
                                    </div>
                                </div>

                                <div className="form-field">
                                    <label>New Passkey</label>
                                    <div className="form-input-wrapper">
                                        <Lock size={18} className="form-input-icon" />
                                        <input 
                                            type="password"
                                            value={newPassword} 
                                            onChange={e => setNewPassword(e.target.value)} 
                                            placeholder="Enter new passkey" 
                                            required 
                                            style={{ paddingLeft: '44px' }}
                                        />
                                    </div>
                                </div>

                                <div className="form-field">
                                    <label>Confirm New Passkey</label>
                                    <div className="form-input-wrapper">
                                        <Lock size={18} className="form-input-icon" />
                                        <input 
                                            type="password"
                                            value={confirmPassword} 
                                            onChange={e => setConfirmPassword(e.target.value)} 
                                            placeholder="Confirm new passkey" 
                                            required 
                                            style={{ paddingLeft: '44px' }}
                                        />
                                    </div>
                                </div>

                                <button type="submit" className="auth-submit-btn" disabled={loading}>
                                    {loading ? 'Updating...' : 'Reset Passkey'}
                                </button>

                                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                                    <span 
                                        onClick={() => setMode('forgot_username')}
                                        className="forgot-link-btn"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        Back
                                    </span>
                                </div>
                            </form>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
