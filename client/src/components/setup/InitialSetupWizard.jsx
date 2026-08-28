import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Server, Shield, User, HardDrive, CheckCircle2, 
    ArrowRight, ArrowLeft, Sparkles, Lock, Globe, 
    Cpu, Activity, Check, Eye, EyeOff, Terminal, RefreshCw, AlertCircle
} from 'lucide-react';

const API_BASE = '/api/v1';

const InitialSetupWizard = ({ onSetupComplete, onRedirectToLogin, showToast, onCancel }) => {
    // Current step: 'welcome' | 'identity' | 'admin' | 'consent' | 'provisioning' | 'ready'
    const [step, setStep] = useState('welcome');
    
    // System detected info from backend
    const [systemInfo, setSystemInfo] = useState(null);
    const [loadingInfo, setLoadingInfo] = useState(true);

    // Form inputs
    const [serverName, setServerName] = useState('');
    const [siteName, setSiteName] = useState('');
    const [location, setLocation] = useState('');
    
    const [adminUsername, setAdminUsername] = useState('admin');
    const [adminDisplayName, setAdminDisplayName] = useState('Primary Administrator');
    const [adminEmail, setAdminEmail] = useState('admin@nexadisk.internal');
    const [adminPassword, setAdminPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [consentAgreed, setConsentAgreed] = useState(false);
    const [telemetryAgreed, setTelemetryAgreed] = useState(true);

    // Provisioning animation state
    const [provisionProgress, setProvisionProgress] = useState(0);
    const [currentProvisionTask, setCurrentProvisionTask] = useState('');
    const [completedTasks, setCompletedTasks] = useState([]);
    const [provisionLogs, setProvisionLogs] = useState([]);
    const [provisionResult, setProvisionResult] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchSystemStatus = async () => {
            try {
                const res = await axios.get(`${API_BASE}/auth/setup/status`);
                const sys = res.data.systemInfo || {};
                setSystemInfo(sys);
                setServerName(sys.hostname || 'NexaDisk-Primary-Host');
                setSiteName(`Site-${sys.hostname || 'Primary-DC'}`);
                setLocation(sys.detectedLocation || 'On-Premise Server Lab');
            } catch (err) {
                console.warn('Failed to fetch setup status, using local defaults', err);
                setServerName('NexaDisk-Primary-Host');
                setSiteName('Site-Primary-Datacenter');
                setLocation('Primary Datacenter / On-Premise Host');
            } finally {
                setLoadingInfo(false);
            }
        };
        fetchSystemStatus();
    }, []);

    const formatBytes = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const handleStartProvisioning = async () => {
        if (!adminPassword || adminPassword.length < 6) {
            showToast?.('Admin password must be at least 6 characters long', 'error');
            setStep('admin');
            return;
        }

        if (adminPassword !== confirmPassword) {
            showToast?.('Passwords do not match', 'error');
            setStep('admin');
            return;
        }

        if (!consentAgreed) {
            showToast?.('Please accept the enterprise agreement to proceed', 'error');
            return;
        }

        setStep('provisioning');
        setProvisionProgress(5);
        setProvisionLogs(['[INIT] Initiating NexaDisk Server setup sequence...']);

        const tasks = [
            { name: 'db', label: 'Configuring PostgreSQL relational storage schema & tables', pct: 25 },
            { name: 'tls', label: 'Generating Root CA certificate & TLS 1.3 cryptographic keyring', pct: 45 },
            { name: 'admin', label: 'Provisioning Super Administrator root credentials', pct: 65 },
            { name: 'storage', label: 'Mounting Primary Local Storage Pool & Volumes', pct: 85 },
            { name: 'sitemesh', label: 'Initializing Site Mesh Zero-Trust Network Gateway', pct: 95 },
            { name: 'final', label: 'Finalizing server services & starting cluster daemons', pct: 100 }
        ];

        let currentIdx = 0;
        const runTaskStep = () => {
            if (currentIdx < tasks.length) {
                const t = tasks[currentIdx];
                setCurrentProvisionTask(t.label);
                setProvisionProgress(t.pct);
                setProvisionLogs(prev => [
                    ...prev,
                    `[${new Date().toLocaleTimeString()}] ✅ ${t.label}...`
                ]);
                setCompletedTasks(prev => [...prev, t.name]);
                currentIdx++;
                setTimeout(runTaskStep, 600);
            } else {
                completeSetupCall();
            }
        };

        setTimeout(runTaskStep, 500);
    };

    const completeSetupCall = async () => {
        try {
            const payload = {
                adminUsername,
                adminPassword,
                adminDisplayName,
                adminEmail,
                serverName,
                siteName,
                location,
                consentAgreed: true
            };

            const res = await axios.post(`${API_BASE}/auth/setup/complete`, payload);
            setProvisionResult(res.data);
            setProvisionLogs(prev => [
                ...prev,
                `[${new Date().toLocaleTimeString()}] 🎉 NexaDisk Server initialized successfully!`,
                `[${new Date().toLocaleTimeString()}] 🚀 All daemons operational on port 5000.`
            ]);
            setTimeout(() => {
                setStep('ready');
            }, 800);
        } catch (err) {
            console.error('Setup failed', err);
            setProvisionLogs(prev => [
                ...prev,
                `[${new Date().toLocaleTimeString()}] ❌ Setup Error: ${err.response?.data?.error || err.message}`
            ]);
            showToast?.(err.response?.data?.error || 'Setup sequence failed', 'error');
        }
    };

    const handleFinalLaunch = () => {
        if (provisionResult && onSetupComplete) {
            onSetupComplete(provisionResult.token, provisionResult.username, provisionResult.role);
            showToast?.(`Welcome to NexaDisk, ${provisionResult.username}!`, 'success');
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: 'radial-gradient(ellipse at top, #111827 0%, #030712 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            overflowY: 'auto',
            fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)'
        }}>
            {/* Ambient background glowing orbs */}
            <div style={{ position: 'absolute', top: '10%', left: '15%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '15%', right: '15%', width: '450px', height: '450px', background: 'radial-gradient(circle, rgba(14, 165, 233, 0.15) 0%, transparent 70%)', filter: 'blur(70px)', pointerEvents: 'none' }} />

            <div style={{
                width: '100%',
                maxWidth: '780px',
                background: 'rgba(17, 24, 39, 0.85)',
                backdropFilter: 'blur(24px)',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 32px 80px rgba(0, 0, 0, 0.7), 0 0 1px 1px rgba(255, 255, 255, 0.05)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative'
            }}>
                {/* Header Progress Stepper */}
                {step !== 'provisioning' && step !== 'ready' && (
                    <div style={{
                        padding: '18px 32px',
                        background: 'rgba(0, 0, 0, 0.25)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                <HardDrive size={18} />
                            </div>
                            <span style={{ fontSize: '15px', fontWeight: '900', color: '#f8fafc', letterSpacing: '-0.3px' }}>
                                NexaDisk <span style={{ color: '#38bdf8', fontSize: '12px', fontWeight: '800', background: 'rgba(56, 189, 248, 0.15)', padding: '2px 8px', borderRadius: '6px', marginLeft: '4px' }}>v2.4 OOBE</span>
                            </span>
                        </div>

                        {/* Step indicators */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {[
                                { id: 'welcome', label: 'Welcome' },
                                { id: 'identity', label: 'Identity' },
                                { id: 'admin', label: 'Super Admin' },
                                { id: 'consent', label: 'License' }
                            ].map((s, idx) => {
                                const stepOrder = ['welcome', 'identity', 'admin', 'consent'];
                                const currIdx = stepOrder.indexOf(step);
                                const itemIdx = stepOrder.indexOf(s.id);
                                const isDone = itemIdx < currIdx;
                                const isCurr = itemIdx === currIdx;

                                return (
                                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '11px',
                                            fontWeight: '900',
                                            background: isDone ? '#10b981' : isCurr ? '#6366f1' : 'rgba(255, 255, 255, 0.08)',
                                            color: isDone || isCurr ? '#fff' : '#64748b'
                                        }}>
                                            {isDone ? <Check size={13} strokeWidth={3} /> : idx + 1}
                                        </div>
                                        {idx < 3 && <div style={{ width: '16px', height: '2px', background: isDone ? '#10b981' : 'rgba(255, 255, 255, 0.1)' }} />}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* STEP 1: WELCOME & DIAGNOSTICS */}
                {step === 'welcome' && (
                    <div style={{ padding: '40px 36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '68px',
                                height: '68px',
                                borderRadius: '20px',
                                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(14, 165, 233, 0.2))',
                                border: '1px solid rgba(99, 102, 241, 0.4)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#38bdf8',
                                boxShadow: '0 12px 32px rgba(99, 102, 241, 0.25)'
                            }}>
                                <Sparkles size={34} />
                            </div>
                            <h2 style={{ margin: 0, fontSize: '26px', fontWeight: '900', color: '#f8fafc', letterSpacing: '-0.5px' }}>
                                Welcome to NexaDisk Storage OS
                            </h2>
                            <p style={{ margin: 0, fontSize: '14.5px', color: '#94a3b8', maxWidth: '520px', lineHeight: '1.6' }}>
                                You are about to configure your primary enterprise cloud storage control plane. Let's initialize your server identity, administrator account, and zero-trust site mesh.
                            </p>
                        </div>

                        {/* System Pre-Flight Diagnostics Card */}
                        <div style={{ background: 'rgba(0, 0, 0, 0.3)', borderRadius: '18px', padding: '20px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '12px', fontWeight: '900', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Activity size={14} /> DETECTED HARDWARE & SYSTEM ENVIRONMENT
                                </span>
                                <span style={{ fontSize: '11px', fontWeight: '800', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '3px 8px', borderRadius: '6px' }}>
                                    PRE-FLIGHT READY
                                </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '800' }}>HOSTNAME</div>
                                    <div style={{ fontSize: '13.5px', color: '#f8fafc', fontWeight: '900', marginTop: '2px' }}>
                                        {systemInfo?.hostname || 'Localhost'}
                                    </div>
                                </div>

                                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '800' }}>CPU & CORES</div>
                                    <div style={{ fontSize: '13px', color: '#f8fafc', fontWeight: '900', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {systemInfo?.cpuCores || 4} Cores ({systemInfo?.cpuModel?.split(' ')[0] || 'Intel/AMD'})
                                    </div>
                                </div>

                                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '800' }}>SYSTEM MEMORY</div>
                                    <div style={{ fontSize: '13.5px', color: '#f8fafc', fontWeight: '900', marginTop: '2px' }}>
                                        {formatBytes(systemInfo?.totalMemory)} RAM
                                    </div>
                                </div>

                                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '800' }}>NETWORK IP</div>
                                    <div style={{ fontSize: '13px', color: '#38bdf8', fontWeight: '900', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                                        {systemInfo?.ip || '127.0.0.1'}:5000
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setStep('identity')}
                            style={{
                                padding: '14px 28px',
                                borderRadius: '14px',
                                background: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
                                color: '#ffffff',
                                border: 'none',
                                fontSize: '14.5px',
                                fontWeight: '900',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                cursor: 'pointer',
                                boxShadow: '0 8px 24px rgba(99, 102, 241, 0.35)',
                                marginTop: '8px'
                            }}
                        >
                            Get Started with Server Configuration <ArrowRight size={18} />
                        </button>
                    </div>
                )}

                {/* STEP 2: SERVER & DATACENTER IDENTITY */}
                {step === 'identity' && (
                    <div style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#f8fafc' }}>
                                Step 1: Server & Cluster Identity
                            </h3>
                            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                                Define how this server identifies itself inside your multi-node cluster topology.
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '800', color: '#94a3b8' }}>PRIMARY SERVER HOSTNAME</label>
                                    <span style={{ fontSize: '10.5px', color: '#10b981', fontWeight: '800' }}>✨ Auto-detected</span>
                                </div>
                                <input
                                    type="text"
                                    required
                                    value={serverName}
                                    onChange={(e) => setServerName(e.target.value)}
                                    placeholder="e.g. Master-Production-Host"
                                    style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', fontSize: '14px' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '800', color: '#94a3b8' }}>PRIMARY SITE NAME</label>
                                    <input
                                        type="text"
                                        required
                                        value={siteName}
                                        onChange={(e) => setSiteName(e.target.value)}
                                        placeholder="e.g. Site-Headquarters-DC1"
                                        style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', fontSize: '14px' }}
                                    />
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '800', color: '#94a3b8' }}>PHYSICAL FACILITY / LOCATION</label>
                                    <input
                                        type="text"
                                        required
                                        value={location}
                                        onChange={(e) => setLocation(e.target.value)}
                                        placeholder="e.g. Dallas Data Center, Server Rack 4"
                                        style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', fontSize: '14px' }}
                                    />
                                </div>
                            </div>

                            <div style={{ background: 'rgba(56, 189, 248, 0.08)', borderRadius: '12px', padding: '14px', border: '1px solid rgba(56, 189, 248, 0.2)', display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <Globe size={18} color="#38bdf8" />
                                <span style={{ fontSize: '12px', color: '#bae6fd', lineHeight: '1.4' }}>
                                    This node will act as your <strong>Primary Master Hub</strong>. Any secondary servers or Proxmox nodes you connect later will automatically register under this site identity.
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                            <button
                                onClick={() => setStep('welcome')}
                                style={{ padding: '12px 20px', borderRadius: '12px', background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255, 255, 255, 0.1)', fontSize: '13.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                            >
                                <ArrowLeft size={16} /> Back
                            </button>
                            <button
                                onClick={() => {
                                    if (!serverName.trim()) return showToast?.('Server hostname is required', 'error');
                                    setStep('admin');
                                }}
                                style={{ padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1, #0ea5e9)', color: '#fff', border: 'none', fontSize: '13.5px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(99, 102, 241, 0.35)' }}
                            >
                                Continue to Admin Account <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 3: SUPER ADMIN ACCOUNT CREATION */}
                {step === 'admin' && (
                    <div style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#f8fafc' }}>
                                Step 2: Create Super Administrator Account
                            </h3>
                            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                                Set up the primary root administrator credentials with full cluster control privileges.
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '800', color: '#94a3b8' }}>ADMIN USERNAME</label>
                                    <input
                                        type="text"
                                        required
                                        value={adminUsername}
                                        onChange={(e) => setAdminUsername(e.target.value)}
                                        placeholder="e.g. admin"
                                        style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', fontSize: '14px' }}
                                    />
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '800', color: '#94a3b8' }}>ADMIN DISPLAY NAME</label>
                                    <input
                                        type="text"
                                        value={adminDisplayName}
                                        onChange={(e) => setAdminDisplayName(e.target.value)}
                                        placeholder="e.g. Primary Administrator"
                                        style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', fontSize: '14px' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '800', color: '#94a3b8' }}>ADMIN EMAIL (FOR ALERTS & RECOVERY)</label>
                                <input
                                    type="email"
                                    value={adminEmail}
                                    onChange={(e) => setAdminEmail(e.target.value)}
                                    placeholder="admin@yourdomain.com"
                                    style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', fontSize: '14px' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '800', color: '#94a3b8' }}>MASTER PASSWORD</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            value={adminPassword}
                                            onChange={(e) => setAdminPassword(e.target.value)}
                                            placeholder="Min. 6 characters"
                                            style={{ width: '100%', padding: '12px 42px 12px 16px', borderRadius: '12px', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', fontSize: '14px', boxSizing: 'border-box' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '800', color: '#94a3b8' }}>CONFIRM PASSWORD</label>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Repeat master password"
                                        style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', fontSize: '14px', boxSizing: 'border-box' }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                            <button
                                onClick={() => setStep('identity')}
                                style={{ padding: '12px 20px', borderRadius: '12px', background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255, 255, 255, 0.1)', fontSize: '13.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                            >
                                <ArrowLeft size={16} /> Back
                            </button>
                            <button
                                onClick={() => {
                                    if (!adminPassword || adminPassword.length < 6) return showToast?.('Password must be at least 6 characters', 'error');
                                    if (adminPassword !== confirmPassword) return showToast?.('Passwords do not match', 'error');
                                    setStep('consent');
                                }}
                                style={{ padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1, #0ea5e9)', color: '#fff', border: 'none', fontSize: '13.5px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(99, 102, 241, 0.35)' }}
                            >
                                Continue to Agreement <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 4: LICENSE & CONSENT */}
                {step === 'consent' && (
                    <div style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#f8fafc' }}>
                                Step 3: Enterprise Agreement & Security Consent
                            </h3>
                            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                                Please review and confirm the local security parameters and license consent.
                            </p>
                        </div>

                        {/* License Terms Box */}
                        <div style={{ background: 'rgba(0, 0, 0, 0.4)', borderRadius: '14px', padding: '18px', border: '1px solid rgba(255, 255, 255, 0.08)', maxHeight: '180px', overflowY: 'auto', fontSize: '12.5px', color: '#94a3b8', lineHeight: '1.6' }}>
                            <strong style={{ color: '#f8fafc' }}>1. Local Data Sovereignty & Self-Hosted Operation</strong><br />
                            NexaDisk is 100% self-hosted. All files, storage pools, SQLite/PostgreSQL databases, and ZFS snapshot datasets reside strictly on your local infrastructure. No data is transmitted to external cloud providers without explicit manual configuration.<br /><br />
                            <strong style={{ color: '#f8fafc' }}>2. Cryptographic Key Management</strong><br />
                            Vault encryption uses military-grade AES-256-GCM and ChaCha20-Poly1305. Cryptographic master keys are derived locally and never exported.<br /><br />
                            <strong style={{ color: '#f8fafc' }}>3. Site Mesh Zero-Trust Telemetry</strong><br />
                            Multi-site clustering uses mutual TLS (mTLS 1.3) with ephemeral token handshakes. Heartbeat pings monitor node health in real-time.
                        </div>

                        {/* Consent Checkboxes */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#f8fafc', cursor: 'pointer', fontWeight: '700' }}>
                                <input
                                    type="checkbox"
                                    checked={consentAgreed}
                                    onChange={(e) => setConsentAgreed(e.target.checked)}
                                    style={{ width: '18px', height: '18px', accentColor: '#6366f1', cursor: 'pointer' }}
                                />
                                I agree to the NexaDisk Enterprise License Terms and accept the local security policies.
                            </label>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px', color: '#94a3b8', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={telemetryAgreed}
                                    onChange={(e) => setTelemetryAgreed(e.target.checked)}
                                    style={{ width: '18px', height: '18px', accentColor: '#6366f1', cursor: 'pointer' }}
                                />
                                Enable continuous internal health diagnostics and agent self-healing watchdog.
                            </label>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                            <button
                                onClick={() => setStep('admin')}
                                style={{ padding: '12px 20px', borderRadius: '12px', background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255, 255, 255, 0.1)', fontSize: '13.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                            >
                                <ArrowLeft size={16} /> Back
                            </button>
                            <button
                                onClick={handleStartProvisioning}
                                disabled={!consentAgreed}
                                style={{
                                    padding: '12px 28px',
                                    borderRadius: '12px',
                                    background: consentAgreed ? 'linear-gradient(135deg, #10b981, #0ea5e9)' : 'rgba(255, 255, 255, 0.1)',
                                    color: consentAgreed ? '#fff' : '#64748b',
                                    border: 'none',
                                    fontSize: '14px',
                                    fontWeight: '900',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: consentAgreed ? 'pointer' : 'not-allowed',
                                    boxShadow: consentAgreed ? '0 6px 20px rgba(16, 185, 129, 0.35)' : 'none'
                                }}
                            >
                                <Sparkles size={16} /> Finish & Start Server
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 5: ANIMATED PROVISIONING SCREEN */}
                {step === 'provisioning' && (
                    <div style={{ padding: '48px 36px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px', textAlign: 'center' }}>
                        {/* Glowing Rotating Loader */}
                        <div style={{ position: 'relative', width: '90px', height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                borderRadius: '50%',
                                border: '3px solid rgba(99, 102, 241, 0.2)',
                                borderTopColor: '#38bdf8',
                                borderRightColor: '#6366f1',
                                animation: 'spin 1s linear infinite'
                            }} />
                            <HardDrive size={38} color="#38bdf8" />
                        </div>

                        <div>
                            <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '900', color: '#f8fafc' }}>
                                Setting Up Your NexaDisk Server...
                            </h3>
                            <p style={{ margin: '6px 0 0', fontSize: '14px', color: '#38bdf8', fontWeight: '700' }}>
                                {currentProvisionTask || 'Initializing system daemons...'}
                            </p>
                        </div>

                        {/* Progress bar */}
                        <div style={{ width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '10px', overflow: 'hidden' }}>
                                <div style={{ width: `${provisionProgress}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #0ea5e9, #10b981)', transition: 'width 0.4s ease' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#64748b', fontWeight: '800' }}>
                                <span>PROVISIONING PROGRESS</span>
                                <span style={{ color: '#38bdf8' }}>{provisionProgress}%</span>
                            </div>
                        </div>

                        {/* Live Terminal Log Stream */}
                        <div style={{
                            width: '100%',
                            maxWidth: '620px',
                            background: '#070b14',
                            borderRadius: '14px',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            padding: '14px 18px',
                            textAlign: 'left',
                            fontFamily: 'var(--font-mono, monospace)',
                            fontSize: '12px',
                            color: '#38bdf8',
                            height: '130px',
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                        }}>
                            {provisionLogs.map((log, i) => (
                                <div key={i} style={{ color: log.includes('✅') ? '#10b981' : log.includes('🎉') ? '#fbbf24' : '#94a3b8' }}>
                                    {log}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* STEP 6: READY / LAUNCH */}
                {step === 'ready' && (
                    <div style={{ padding: '48px 36px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', textAlign: 'center' }}>
                        <div style={{
                            width: '76px',
                            height: '76px',
                            borderRadius: '50%',
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '2px solid rgba(16, 185, 129, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#10b981',
                            boxShadow: '0 12px 36px rgba(16, 185, 129, 0.3)'
                        }}>
                            <CheckCircle2 size={42} />
                        </div>

                        <div>
                            <h2 style={{ margin: 0, fontSize: '26px', fontWeight: '900', color: '#f8fafc' }}>
                                NexaDisk Server is Live & Ready!
                            </h2>
                            <p style={{ margin: '6px 0 0', fontSize: '14px', color: '#94a3b8', maxWidth: '480px', lineHeight: '1.5' }}>
                                Your primary cluster control plane has been provisioned and configured for high-performance enterprise storage.
                            </p>
                        </div>

                        {/* Summary Card */}
                        <div style={{ width: '100%', maxWidth: '480px', background: 'rgba(0, 0, 0, 0.35)', borderRadius: '16px', padding: '18px 22px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                <span style={{ color: '#64748b', fontWeight: '800' }}>SERVER HOSTNAME:</span>
                                <span style={{ color: '#f8fafc', fontWeight: '900' }}>{serverName}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                <span style={{ color: '#64748b', fontWeight: '800' }}>PRIMARY SITE:</span>
                                <span style={{ color: '#38bdf8', fontWeight: '900' }}>{siteName}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                <span style={{ color: '#64748b', fontWeight: '800' }}>ROOT ADMINISTRATOR:</span>
                                <span style={{ color: '#10b981', fontWeight: '900' }}>{adminUsername}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                <span style={{ color: '#64748b', fontWeight: '800' }}>SECURITY & ACCESS:</span>
                                <span style={{ color: '#a855f7', fontWeight: '900' }}>TLS 1.3 / ChaCha20-Poly1305</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '480px', marginTop: '6px' }}>
                            <button
                                onClick={handleFinalLaunch}
                                style={{
                                    width: '100%',
                                    padding: '15px 28px',
                                    borderRadius: '14px',
                                    background: 'linear-gradient(135deg, #10b981, #0ea5e9)',
                                    color: '#ffffff',
                                    border: 'none',
                                    fontSize: '15px',
                                    fontWeight: '900',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px',
                                    cursor: 'pointer',
                                    boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)'
                                }}
                            >
                                🚀 Launch NexaDisk Dashboard <ArrowRight size={18} />
                            </button>

                            <button
                                onClick={() => onRedirectToLogin ? onRedirectToLogin(adminUsername) : handleFinalLaunch()}
                                style={{
                                    width: '100%',
                                    padding: '12px 24px',
                                    borderRadius: '14px',
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    color: '#94a3b8',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    fontSize: '13.5px',
                                    fontWeight: '700',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    cursor: 'pointer',
                                    transition: '0.2s'
                                }}
                            >
                                <Lock size={15} /> Proceed to Login Screen
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default InitialSetupWizard;
