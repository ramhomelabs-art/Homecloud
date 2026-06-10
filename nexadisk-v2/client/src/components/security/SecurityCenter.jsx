import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { 
    Shield, ShieldAlert, ShieldCheck, Activity, AlertTriangle, 
    Play, RefreshCw, XCircle, Folder, Settings, ScrollText, 
    Server, Cpu, CheckCircle2, Sliders, Info, Trash2
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import FolderPickerModal from '../modals/FolderPickerModal';

function SecurityCenter() {
    const [stats, setStats] = useState(null);
    const [quarantine, setQuarantine] = useState([]);
    const [agents, setAgents] = useState([]);
    const [policy, setPolicy] = useState({
        quarantineMode: 'quarantine',
        whitelistExts: '',
        maxScanSize: '100'
    });
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('dashboard');

    // Manual Scanner Form State
    const [scanPath, setScanPath] = useState('');
    const [scanNode, setScanNode] = useState('local');
    const [scanning, setScanning] = useState(false);
    const [scanResults, setScanResults] = useState(null);
    const [pickerOpen, setPickerOpen] = useState(false);

    // Policies Saving State
    const [savingPolicy, setSavingPolicy] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const [statsRes, qRes, policyRes, eventsRes, agentsRes] = await Promise.all([
                axios.get('/api/v1/security/stats', { headers }),
                axios.get('/api/v1/security/quarantine', { headers }),
                axios.get('/api/v1/security/policy', { headers }),
                axios.get('/api/v1/security/events', { headers }),
                axios.get('/api/v1/agents', { headers })
            ]);

            setStats(statsRes.data);
            setQuarantine(qRes.data);
            setPolicy(policyRes.data);
            setEvents(eventsRes.data || []);
            setAgents(agentsRes.data || []);
        } catch (e) {
            console.error('Failed to fetch security stats', e);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, []);

    const handleApprove = async (id) => {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post('/api/v1/security/quarantine/approve', { id }, { headers });
            fetchData();
        } catch (e) { alert('Failed to approve'); }
    };

    const handleReject = async (id) => {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post('/api/v1/security/quarantine/reject', { id }, { headers });
            fetchData();
        } catch (e) { alert('Failed to reject'); }
    };

    const handleRescan = async (filePath) => {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post('/api/v1/security/scan/file', { filePath }, { headers });
            fetchData();
        } catch (e) { alert('Failed to rescan file'); }
    };

    const handleQuarantineRescan = async (id) => {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post(`/api/v1/quarantine/${id}/scan`, {}, { headers });
            fetchData();
        } catch (e) { alert('Failed to rescan quarantined file'); }
    };

    const handleAllowScan = async (scanId) => {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post(`/api/v1/security/scans/${scanId}/allow`, {}, { headers });
            fetchData();
        } catch (e) { alert('Failed to allow threat'); }
    };

    const handleDeleteThreat = async (scanId) => {
        if (!window.confirm('Clear this threat record and delete the file permanently?')) return;
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.delete(`/api/v1/security/scans/${scanId}`, { headers });
            fetchData();
        } catch (e) { alert('Failed to delete threat record'); }
    };

    const handleSavePolicy = async (e) => {
        e.preventDefault();
        setSavingPolicy(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post('/api/v1/security/policy', policy, { headers });
            alert('Security policies updated successfully.');
            fetchData();
        } catch (err) {
            alert('Failed to save policies');
        } finally {
            setSavingPolicy(false);
        }
    };

    const handleManualScan = async (e) => {
        e.preventDefault();
        if (!scanPath) return;
        setScanning(true);
        setScanResults(null);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.post('/api/v1/security/scan/file', {
                filePath: scanPath,
                agentId: scanNode
            }, { headers });
            setScanResults(res.data);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.error || 'Manual scan failed');
        } finally {
            setScanning(false);
        }
    };

    if (!stats) {
        return (
            <div style={styles.loading}>
                {loading ? 'Initializing Security Engine...' : 'Failed to load security statistics. Please check server status.'}
            </div>
        );
    }

    const securityScore = Math.max(0, 100 - (stats.malicious * 5) - (stats.suspicious * 2));
    const scoreColor = securityScore > 80 ? '#2ea043' : securityScore > 50 ? '#f2c94c' : '#f85149';

    const pieData = [
        { name: 'Clean', value: stats.clean },
        { name: 'Suspicious', value: stats.suspicious },
        { name: 'Malicious', value: stats.malicious }
    ];
    const COLORS = ['#2ea043', '#f2c94c', '#f85149'];

    const getEventBadgeColor = (type) => {
        const t = (type || '').toUpperCase();
        switch (t) {
            case 'THREAT_DETECTED': return { bg: 'rgba(248,81,73,0.1)', text: '#f85149' };
            case 'FILE_QUARANTINED': return { bg: 'rgba(242,201,76,0.1)', text: '#f2c94c' };
            case 'QUARANTINE_APPROVED': return { bg: 'rgba(46,160,67,0.1)', text: '#2ea043' };
            case 'QUARANTINE_REJECTED': return { bg: 'rgba(255,255,255,0.05)', text: '#8b949e' };
            case 'POLICY_CHANGE': return { bg: 'rgba(88,166,255,0.1)', text: '#58a6ff' };
            case 'AVATAR_UPLOAD_BLOCKED': return { bg: 'rgba(248,81,73,0.1)', text: '#f85149' };
            case 'AVATAR_UPDATED': return { bg: 'rgba(46,160,67,0.1)', text: '#2ea043' };
            case 'AVATAR_REMOVED': return { bg: 'rgba(255,255,255,0.05)', text: '#8b949e' };
            default: return { bg: 'rgba(255,255,255,0.05)', text: '#c9d1d9' };
        }
    };

    const renderEventDescription = (eventType, details) => {
        const type = (eventType || '').toUpperCase();
        let parsed = details;
        if (typeof details === 'string') {
            try {
                parsed = JSON.parse(details);
            } catch (e) {
                return details;
            }
        }
        
        if (!parsed) return '';

        switch (type) {
            case 'THREAT_DETECTED':
                return `Threat detected: ${parsed.verdict?.toUpperCase() || 'UNKNOWN'} (Score: ${parsed.score || 0}) for file ${parsed.filePath || ''}`;
            case 'FILE_QUARANTINED':
                return `File "${parsed.originalName || ''}" was quarantined (Threat Score: ${parsed.score || 0})`;
            case 'QUARANTINE_APPROVED':
                return `Quarantined file "${parsed.originalName || ''}" approved and restored to: ${parsed.targetPath || ''}`;
            case 'QUARANTINE_REJECTED':
                return `Quarantined file "${parsed.originalName || ''}" deleted permanently by Admin`;
            case 'POLICY_CHANGE':
                return `Security policy configuration updated by user "${parsed.updatedBy || 'admin'}"`;
            case 'AVATAR_UPLOAD_BLOCKED':
                return `Avatar upload blocked (File: "${parsed.file || ''}", Threat Score: ${parsed.score || 0}, Reason: ${parsed.reason || 'Suspicious file'})`;
            case 'AVATAR_UPDATED':
                return `Avatar updated successfully (Path: "${parsed.path || ''}")`;
            case 'AVATAR_REMOVED':
                return `Avatar removed / reset to system default`;
            default:
                if (typeof parsed === 'object') {
                    return Object.entries(parsed)
                        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                        .join(' | ');
                }
                return String(parsed);
        }
    };

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>
                        <Shield style={{ marginRight: '10px', color: '#58a6ff' }} size={28} />
                        Security Operations Center
                    </h1>
                    <p style={styles.subtitle}>Zero Trust File Validation & Threat Analysis Dashboard</p>
                </div>
                <button onClick={fetchData} style={styles.refreshBtn}>
                    <RefreshCw size={16} /> Refresh Metrics
                </button>
            </div>

            {/* Tab navigation */}
            <div style={styles.tabsRow}>
                {[
                    { id: 'dashboard', label: 'SOC Dashboard', icon: <Activity size={16} /> },
                    { id: 'scanner', label: 'On-Demand Scanner', icon: <Play size={16} /> },
                    { id: 'policies', label: 'Zero-Trust Policies', icon: <Sliders size={16} /> },
                    { id: 'logs', label: 'SOC Audit Trail', icon: <ScrollText size={16} /> }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            ...styles.tabBtn,
                            color: activeTab === tab.id ? 'var(--accent-gold)' : '#8b949e',
                            background: activeTab === tab.id ? 'rgba(242, 201, 76, 0.08)' : 'transparent',
                            border: `1px solid ${activeTab === tab.id ? 'var(--accent-gold)' : 'transparent'}`
                        }}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* TAB CONTENT: DASHBOARD */}
            {activeTab === 'dashboard' && (
                <div>
                    <div style={styles.topRow}>
                        {/* Security Score Widget */}
                        <div style={styles.widget}>
                            <h3 style={styles.widgetTitle}>Global Security Score</h3>
                            <div style={styles.gaugeContainer}>
                                <svg viewBox="0 0 100 50" style={styles.gaugeSvg}>
                                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#30363d" strokeWidth="10" strokeLinecap="round" />
                                    <motion.path 
                                        d="M 10 50 A 40 40 0 0 1 90 50" 
                                        fill="none" 
                                        stroke={scoreColor} 
                                        strokeWidth="10" 
                                        strokeLinecap="round"
                                        strokeDasharray="125.6"
                                        initial={{ strokeDashoffset: 125.6 }}
                                        animate={{ strokeDashoffset: 125.6 - (125.6 * (securityScore / 100)) }}
                                        transition={{ duration: 1.5, ease: "easeOut" }}
                                    />
                                </svg>
                                <div style={{ ...styles.scoreValue, color: scoreColor }}>{securityScore}</div>
                            </div>
                        </div>

                        {/* Key Metrics */}
                        <div style={styles.metricsGrid}>
                            <div style={styles.metricCard}>
                                <div style={styles.metricHeader}>
                                    <Activity color="#8b949e" size={20} />
                                    <span>Total Scanned</span>
                                </div>
                                <div style={styles.metricValue}>{stats.totalScans}</div>
                            </div>
                            <div style={styles.metricCard}>
                                <div style={styles.metricHeader}>
                                    <ShieldCheck color="#2ea043" size={20} />
                                    <span>Clean Files</span>
                                </div>
                                <div style={styles.metricValue}>{stats.clean}</div>
                            </div>
                            <div style={styles.metricCard}>
                                <div style={styles.metricHeader}>
                                    <ShieldAlert color="#f85149" size={20} />
                                    <span>Threats Blocked</span>
                                </div>
                                <div style={styles.metricValue}>{stats.malicious}</div>
                            </div>
                            <div style={styles.metricCard}>
                                <div style={styles.metricHeader}>
                                    <AlertTriangle color="#f2c94c" size={20} />
                                    <span>In Quarantine</span>
                                </div>
                                <div style={styles.metricValue}>{stats.quarantined}</div>
                            </div>
                        </div>
                    </div>

                    {/* Cluster Node Map */}
                    <div style={{ ...styles.widget, marginBottom: '24px' }}>
                        <h3 style={styles.widgetTitle}>Cluster Storage Node Health Map</h3>
                        <div style={styles.nodeGrid}>
                            {/* Local Master */}
                            <div style={styles.nodeCard}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <Cpu size={28} color="var(--accent-gold)" />
                                    <span style={{
                                        padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold',
                                        background: 'rgba(46,160,67,0.15)', color: '#3fb950', border: '1px solid rgba(46,160,67,0.3)'
                                    }}>Online</span>
                                </div>
                                <div style={{ marginTop: '12px' }}>
                                    <div style={{ fontWeight: 'bold', color: '#fff' }}>Local Master Node</div>
                                    <div style={{ fontSize: '11px', color: '#8b949e', fontFamily: 'monospace', marginTop: '2px' }}>127.0.0.1 (Loopback)</div>
                                </div>
                                <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #21262d', paddingTop: '12px' }}>
                                    {stats.malicious > 0 ? (
                                        <>
                                            <ShieldAlert size={16} color="#f85149" />
                                            <span style={{ fontSize: '12px', color: '#f85149', fontWeight: 'bold' }}>{stats.malicious} Active Threats</span>
                                        </>
                                    ) : (
                                        <>
                                            <ShieldCheck size={16} color="#2ea043" />
                                            <span style={{ fontSize: '12px', color: '#2ea043', fontWeight: 'bold' }}>0 Active Threats</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Remote Agents */}
                            {agents.map(agent => (
                                <div key={agent.id} style={styles.nodeCard}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <Server size={28} color={agent.status === 'approved' ? 'var(--accent-cyan)' : '#8b949e'} />
                                        <span style={{
                                            padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold',
                                            background: agent.status === 'approved' ? 'rgba(88,166,255,0.15)' : 'rgba(248,81,73,0.15)',
                                            color: agent.status === 'approved' ? '#58a6ff' : '#f85149',
                                            border: `1px solid ${agent.status === 'approved' ? 'rgba(88,166,255,0.3)' : 'rgba(248,81,73,0.3)'}`
                                        }}>{agent.status === 'approved' ? 'Linked' : 'Pending'}</span>
                                    </div>
                                    <div style={{ marginTop: '12px' }}>
                                        <div style={{ fontWeight: 'bold', color: '#fff' }}>{agent.hostname}</div>
                                        <div style={{ fontSize: '11px', color: '#8b949e', fontFamily: 'monospace', marginTop: '2px' }}>{agent.url}</div>
                                    </div>
                                    <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #21262d', paddingTop: '12px' }}>
                                        <ShieldCheck size={16} color="#2ea043" />
                                        <span style={{ fontSize: '12px', color: '#2ea043', fontWeight: 'bold' }}>0 Active Threats</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={styles.chartsRow}>
                        <div style={styles.widgetLg}>
                            <h3 style={styles.widgetTitle}>Threat Timeline (Last 30 Days)</h3>
                            <div style={{ height: '300px', minWidth: 0, minHeight: 0 }}>
                                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                    <LineChart data={stats.timeline}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                                        <XAxis dataKey="date" stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 12}} />
                                        <YAxis stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 12}} />
                                        <Tooltip contentStyle={{ backgroundColor: '#0d1117', borderColor: '#30363d', color: '#c9d1d9' }} />
                                        <Line type="monotone" dataKey="total" stroke="#58a6ff" strokeWidth={2} name="Total Scans" />
                                        <Line type="monotone" dataKey="infected" stroke="#f85149" strokeWidth={2} name="Threats" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        
                        <div style={styles.widgetMd}>
                            <h3 style={styles.widgetTitle}>Verdict Breakdown</h3>
                            <div style={{ height: '300px', minWidth: 0, minHeight: 0 }}>
                                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                    <PieChart>
                                        <Pie data={pieData} innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ backgroundColor: '#0d1117', borderColor: '#30363d', color: '#c9d1d9' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={styles.legendRow}>
                                <div style={styles.legendItem}><span style={{...styles.dot, background: COLORS[0]}}></span> Clean</div>
                                <div style={styles.legendItem}><span style={{...styles.dot, background: COLORS[1]}}></span> Suspicious</div>
                                <div style={styles.legendItem}><span style={{...styles.dot, background: COLORS[2]}}></span> Malicious</div>
                            </div>
                        </div>
                    </div>

                    <div style={styles.bottomRow}>
                        <div style={{ ...styles.widget, flex: 1, overflowY: 'auto', maxHeight: '400px' }}>
                            <h3 style={styles.widgetTitle}>Active Quarantine Queue</h3>
                            {quarantine.length === 0 ? (
                                <div style={styles.emptyState}>No items in quarantine.</div>
                            ) : (
                                <table style={styles.table}>
                                    <thead>
                                        <tr>
                                            <th style={styles.th}>File Name</th>
                                            <th style={styles.th}>Score</th>
                                            <th style={styles.th}>Date</th>
                                            <th style={styles.th}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {quarantine.map(q => (
                                            <tr key={q.id} style={styles.tr}>
                                                <td style={styles.td}>
                                                    <div style={{ fontWeight: 500 }}>{q.original_name}</div>
                                                    <div style={{ fontSize: '12px', color: '#8b949e' }}>
                                                        {(() => {
                                                            if (!q.threats) return '';
                                                            if (Array.isArray(q.threats)) return q.threats.join(', ');
                                                            try {
                                                                const parsed = JSON.parse(q.threats);
                                                                if (Array.isArray(parsed)) return parsed.join(', ');
                                                                return String(parsed);
                                                            } catch (e) {
                                                                return String(q.threats);
                                                            }
                                                        })()}
                                                    </div>
                                                </td>
                                                <td style={styles.td}>
                                                    <span style={{...styles.scoreBadge, color: q.score > 50 ? '#f85149' : '#f2c94c'}}>{q.score}</span>
                                                </td>
                                                <td style={styles.td}>{new Date(q.uploaded_at).toLocaleString()}</td>
                                                <td style={styles.td}>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button onClick={() => handleApprove(q.id)} style={styles.actionBtnApprove}>Restore</button>
                                                        <button onClick={() => handleReject(q.id)} style={styles.actionBtnReject}>Delete</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        
                        <div style={{ ...styles.widget, flex: 1, overflowY: 'auto', maxHeight: '400px' }}>
                            <h3 style={styles.widgetTitle}>Recent Threats Detected</h3>
                            {stats.recentThreats.length === 0 ? (
                                <div style={styles.emptyState}>No recent threats detected.</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {stats.recentThreats.map((t, idx) => (
                                        <div key={idx} style={styles.threatCard}>
                                            <AlertTriangle color="#f85149" size={24} style={{ flexShrink: 0 }} />
                                            <div>
                                                <div style={{ fontWeight: 600, color: '#e6edf3' }}>{t.threat_name}</div>
                                                <div style={{ fontSize: '13px', color: '#8b949e', marginTop: '4px', wordBreak: 'break-all' }}>{t.file_path}</div>
                                                <div style={{ fontSize: '12px', color: '#8b949e', marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        {new Date(t.scan_date).toLocaleString()} • <span style={{ color: t.severity === 'critical' ? '#f85149' : '#f2c94c', textTransform: 'uppercase', fontSize: '11px', fontWeight: 'bold' }}>{t.severity}</span>
                                                        {!t.file_exists && <span style={{ color: '#8b949e', marginLeft: '6px', fontSize: '11px' }}>(File Missing)</span>}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        {t.quarantine_id && t.quarantine_status === 'pending' ? (
                                                            <>
                                                                <button onClick={() => handleApprove(t.quarantine_id)} style={styles.actionBtnApproveSm}>Allow</button>
                                                                <button onClick={() => handleQuarantineRescan(t.quarantine_id)} style={styles.actionBtnRescanSm}>Rescan</button>
                                                                <button onClick={() => handleDeleteThreat(t.scan_id)} style={styles.actionBtnRejectSm}>Delete</button>
                                                            </>
                                                        ) : t.quarantine_id && t.quarantine_status === 'approved' ? (
                                                            <span style={{ color: '#2ea043', fontSize: '12px', fontWeight: 500 }}>Allowed & Restored</span>
                                                        ) : t.quarantine_id && t.quarantine_status === 'rejected' ? (
                                                            <span style={{ color: '#f85149', fontSize: '12px', fontWeight: 500 }}>Deleted / Rejected</span>
                                                        ) : (
                                                            <>
                                                                <button 
                                                                    onClick={() => handleAllowScan(t.scan_id)} 
                                                                    style={{ ...styles.actionBtnApproveSm, marginRight: '4px' }}
                                                                >
                                                                    Allow
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleRescan(t.file_path)} 
                                                                    disabled={!t.file_exists} 
                                                                    className="btn-secondary" 
                                                                    style={{ 
                                                                        padding: '4px 10px', 
                                                                        fontSize: '11px', 
                                                                        borderRadius: '4px',
                                                                        opacity: t.file_exists ? 1 : 0.5,
                                                                        cursor: t.file_exists ? 'pointer' : 'not-allowed',
                                                                        marginRight: '4px'
                                                                    }}
                                                                >
                                                                    Rescan
                                                                </button>
                                                                <button onClick={() => handleDeleteThreat(t.scan_id)} className="btn-danger" style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '4px' }}>Delete</button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: MANUAL SCANNER */}
            {activeTab === 'scanner' && (
                <div style={styles.widget}>
                    <h3 style={styles.widgetTitle}>On-Demand System File Scanner</h3>
                    <p style={{ color: '#8b949e', fontSize: '13px', margin: '-10px 0 20px 0' }}>Initiate manual zero-trust file checks directly on any local or remote storage directory path.</p>

                    <form onSubmit={handleManualScan} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                            <div>
                                <label style={styles.inputLabel}>Scan Storage Node</label>
                                <select 
                                    value={scanNode}
                                    onChange={e => setScanNode(e.target.value)}
                                    style={styles.selectInput}
                                >
                                    <option value="local">Local Master Node</option>
                                    {agents.filter(a => a.status === 'approved').map(a => (
                                        <option key={a.id} value={a.id}>{a.hostname} (Remote)</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={styles.inputLabel}>Directory or File Path *</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input 
                                        type="text"
                                        required
                                        placeholder="e.g. C:\Users\Admin\Downloads or /var/log"
                                        value={scanPath}
                                        onChange={e => setScanPath(e.target.value)}
                                        style={styles.textInput}
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setPickerOpen(true)}
                                        style={styles.browseBtn}
                                    >
                                        <Folder size={16} /> Browse
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={scanning || !scanPath}
                            style={{ 
                                ...styles.submitBtn,
                                opacity: scanning || !scanPath ? 0.6 : 1,
                                cursor: scanning || !scanPath ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {scanning ? 'Running Verification Scan...' : 'Trigger Security Scan'}
                        </button>
                    </form>

                    {scanResults && (
                        <div style={styles.resultsBox}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#fff', borderBottom: '1px solid #30363d', paddingBottom: '8px' }}>Scan Results</h4>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
                                <div style={{
                                    padding: '4px 12px', borderRadius: '12px', fontWeight: 'bold', fontSize: '12px',
                                    background: scanResults.result.verdict === 'clean' ? 'rgba(46,160,67,0.15)' : 'rgba(248,81,73,0.15)',
                                    color: scanResults.result.verdict === 'clean' ? '#3fb950' : '#f85149'
                                }}>
                                    Verdict: {scanResults.result.verdict.toUpperCase()}
                                </div>
                                <div style={{ fontSize: '13px', color: '#8b949e' }}>
                                    Score: <strong style={{ color: '#fff' }}>{scanResults.result.score}/100</strong>
                                </div>
                            </div>

                            {scanResults.result.threats && scanResults.result.threats.length > 0 ? (
                                <div>
                                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#f85149', marginBottom: '6px' }}>Threats Detected:</div>
                                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#c9d1d9' }}>
                                        {scanResults.result.threats.map((t, i) => (
                                            <li key={i} style={{ marginBottom: '4px' }}>{t}</li>
                                        ))}
                                    </ul>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#3fb950', fontSize: '13px' }}>
                                    <CheckCircle2 size={16} /> No threat signatures or indicators detected. File is clean.
                                </div>
                            )}

                            {scanResults.quarantined && (
                                <div style={{ marginTop: '12px', padding: '8px 12px', borderRadius: '6px', background: 'rgba(242,201,76,0.05)', border: '1px solid rgba(242,201,76,0.2)', fontSize: '12px', color: '#f2c94c' }}>
                                    🛡️ <strong>Zero-Trust Quarantine:</strong> This file has been automatically relocated to the secure quarantine repository pending administrative review.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* TAB CONTENT: POLICIES */}
            {activeTab === 'policies' && (
                <div style={styles.widget}>
                    <h3 style={styles.widgetTitle}>Zero-Trust Scanning Policies</h3>
                    <p style={{ color: '#8b949e', fontSize: '13px', margin: '-10px 0 25px 0' }}>Configure automated scanner reactions, whitelisted file categories, and resource limit controls.</p>

                    <form onSubmit={handleSavePolicy} style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px' }}>
                        {/* Auto-Quarantine Toggle */}
                        <div style={styles.settingCard}>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '14px', color: '#fff' }}>Automated Quarantine Verdict</h4>
                                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#8b949e' }}>Relocate files to secure staging repository immediately when suspicious or malicious threats are scanned.</p>
                            </div>
                            <select
                                value={policy.quarantineMode}
                                onChange={e => setPolicy({ ...policy, quarantineMode: e.target.value })}
                                style={styles.selectInputInline}
                            >
                                <option value="quarantine">Block & Quarantine</option>
                                <option value="alert_only">Alert Only</option>
                            </select>
                        </div>

                        {/* Max Scan Size */}
                        <div style={styles.settingCard}>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '14px', color: '#fff' }}>Max Scanned File Size Limit</h4>
                                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#8b949e' }}>Skip deep validation scanning on files larger than this threshold to prevent CPU locks or latency issues.</p>
                            </div>
                            <select
                                value={policy.maxScanSize}
                                onChange={e => setPolicy({ ...policy, maxScanSize: e.target.value })}
                                style={styles.selectInputInline}
                            >
                                <option value="10">10 MB</option>
                                <option value="50">50 MB</option>
                                <option value="100">100 MB (Default)</option>
                                <option value="500">500 MB</option>
                                <option value="0">Unlimited (Danger)</option>
                            </select>
                        </div>

                        {/* Extensions Whitelist */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <h4 style={{ margin: 0, fontSize: '14px', color: '#fff' }}>Allowed Extensions Whitelist</h4>
                            <p style={{ margin: 0, fontSize: '12px', color: '#8b949e', marginBottom: '6px' }}>Exempt these file types or filenames from signature scans completely. (Comma-separated, e.g. `.log, .csv, .txt`).</p>
                            <input 
                                type="text"
                                placeholder="e.g. .log, .csv, .txt"
                                value={policy.whitelistExts}
                                onChange={e => setPolicy({ ...policy, whitelistExts: e.target.value })}
                                style={styles.textInput}
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={savingPolicy}
                            style={{ 
                                ...styles.submitBtn,
                                marginTop: '10px',
                                opacity: savingPolicy ? 0.6 : 1,
                                cursor: savingPolicy ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {savingPolicy ? 'Updating Security Policy...' : 'Save Policies'}
                        </button>
                    </form>
                </div>
            )}

            {/* TAB CONTENT: AUDIT TRAIL */}
            {activeTab === 'logs' && (
                <div style={styles.widget}>
                    <h3 style={styles.widgetTitle}>Security Events Audit Log</h3>
                    <p style={{ color: '#8b949e', fontSize: '13px', margin: '-10px 0 20px 0' }}>A chronological audit log tracking system logins, signature detections, quarantine reviews, and policy updates.</p>

                    {events.length === 0 ? (
                        <div style={styles.emptyState}>No security audit events recorded.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {events.map((e) => {
                                const badge = getEventBadgeColor(e.eventType);
                                return (
                                    <div key={e.id} style={styles.eventRow}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifySpaceBetween: 'space-between', width: '100%' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <span style={{
                                                    fontSize: '10px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '4px',
                                                    background: badge.bg, color: badge.text, textTransform: 'uppercase', fontFamily: 'monospace'
                                                }}>{e.eventType}</span>
                                                
                                                <span style={{ fontSize: '13px', color: '#e6edf3' }}>
                                                    {renderEventDescription(e.eventType, e.details)}
                                                </span>
                                            </div>
                                            <span style={{ fontSize: '11px', color: '#8b949e', fontFamily: 'monospace', flexShrink: 0 }}>
                                                {new Date(e.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Folder Picker Modal for Manual Scan */}
            {pickerOpen && (
                <FolderPickerModal
                    agents={agents}
                    initialNode={scanNode}
                    initialPath={scanPath}
                    lockNode={true}
                    onClose={() => setPickerOpen(false)}
                    onSelect={(folderPath, node) => {
                        setScanPath(folderPath);
                        setScanNode(node);
                        setPickerOpen(false);
                    }}
                    showToast={(msg, type) => console.log(msg, type)}
                />
            )}
        </div>
    );
}

const styles = {
    container: { padding: '32px', color: '#c9d1d9', background: '#010409', minHeight: '100vh', fontFamily: "'Inter', sans-serif" },
    loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#8b949e', fontSize: '18px' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
    title: { margin: 0, fontSize: '24px', color: '#e6edf3', display: 'flex', alignItems: 'center', fontWeight: '800' },
    subtitle: { margin: '4px 0 0', color: '#8b949e', fontSize: '13px' },
    refreshBtn: { background: 'rgba(255, 255, 255, 0.02)', border: '1px solid #30363d', padding: '8px 16px', borderRadius: '10px', color: '#c9d1d9', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold', transition: '0.2s' },
    tabsRow: { display: 'flex', gap: '10px', borderBottom: '1px solid #21262d', paddingBottom: '12px', marginBottom: '24px' },
    tabBtn: { border: '1px solid transparent', padding: '8px 16px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', transition: '0.3s' },
    topRow: { display: 'flex', gap: '24px', marginBottom: '24px' },
    widget: { background: '#0d1117', border: '1px solid #30363d', borderRadius: '16px', padding: '24px', flex: 1, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' },
    widgetLg: { background: '#0d1117', border: '1px solid #30363d', borderRadius: '16px', padding: '24px', flex: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', minWidth: 0 },
    widgetMd: { background: '#0d1117', border: '1px solid #30363d', borderRadius: '16px', padding: '24px', flex: 1, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', minWidth: 0 },
    widgetTitle: { margin: '0 0 20px 0', fontSize: '15px', color: '#e6edf3', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' },
    gaugeContainer: { position: 'relative', width: '180px', margin: '0 auto', textAlign: 'center' },
    gaugeSvg: { width: '100%', height: '90px', overflow: 'visible' },
    scoreValue: { position: 'absolute', bottom: '0', left: '0', right: '0', fontSize: '32px', fontWeight: '800' },
    metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', flex: 2 },
    metricCard: { background: 'rgba(255, 255, 255, 0.015)', border: '1px solid #30363d', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
    metricHeader: { display: 'flex', alignItems: 'center', gap: '8px', color: '#8b949e', fontSize: '12px', marginBottom: '8px', fontWeight: '700', textTransform: 'uppercase' },
    metricValue: { fontSize: '28px', color: '#e6edf3', fontWeight: '800' },
    nodeGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' },
    nodeCard: { background: 'rgba(255, 255, 255, 0.01)', border: '1px solid #21262d', borderRadius: '14px', padding: '20px', transition: '0.2s' },
    chartsRow: { display: 'flex', gap: '24px', marginBottom: '24px' },
    legendRow: { display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '16px' },
    legendItem: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#8b949e', fontWeight: '600' },
    dot: { width: '8px', height: '8px', borderRadius: '50%' },
    bottomRow: { display: 'flex', gap: '24px' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { textAlign: 'left', padding: '12px', borderBottom: '1px solid #30363d', color: '#8b949e', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' },
    tr: { borderBottom: '1px solid #21262d' },
    td: { padding: '12px', fontSize: '13px', color: '#c9d1d9' },
    scoreBadge: { background: 'rgba(248,81,73,0.1)', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' },
    actionBtnApprove: { background: 'rgba(46,160,67,0.1)', color: '#3fb950', border: '1px solid rgba(46,160,67,0.4)', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' },
    actionBtnReject: { background: 'rgba(248,81,73,0.1)', color: '#f85149', border: '1px solid rgba(248,81,73,0.4)', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' },
    actionBtnApproveSm: { background: 'rgba(46,160,67,0.1)', color: '#3fb950', border: '1px solid rgba(46,160,67,0.4)', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', transition: '0.2s' },
    actionBtnRejectSm: { background: 'rgba(248,81,73,0.1)', color: '#f85149', border: '1px solid rgba(248,81,73,0.4)', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', transition: '0.2s' },
    actionBtnRescanSm: { background: 'rgba(88,166,255,0.1)', color: '#58a6ff', border: '1px solid rgba(88,166,255,0.4)', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', transition: '0.2s' },
    emptyState: { textAlign: 'center', color: '#8b949e', padding: '40px 0', fontSize: '13px' },
    threatCard: { display: 'flex', gap: '16px', background: 'rgba(248,81,73,0.05)', border: '1px solid rgba(248,81,73,0.2)', padding: '16px', borderRadius: '12px' },
    inputLabel: { display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#8b949e', marginBottom: '6px' },
    selectInput: { width: '100%', outline: 'none', background: 'var(--bg-panel)', color: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #30363d', fontSize: '13px' },
    selectInputInline: { outline: 'none', background: 'var(--bg-panel)', color: '#fff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #30363d', fontSize: '13px' },
    textInput: { flex: 1, outline: 'none', background: 'var(--bg-panel)', color: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #30363d', fontSize: '13px', fontFamily: 'monospace' },
    browseBtn: { background: 'rgba(255, 255, 255, 0.02)', border: '1px solid #30363d', borderRadius: '8px', padding: '0 16px', color: '#fff', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' },
    submitBtn: { width: '100%', padding: '12px', background: 'var(--accent-gold)', border: 'none', borderRadius: '10px', color: '#000', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', transition: '0.2s' },
    resultsBox: { marginTop: '24px', background: 'rgba(255,255,255,0.01)', border: '1px solid #21262d', padding: '20px', borderRadius: '12px' },
    settingCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', border: '1px solid #21262d', padding: '16px 20px', borderRadius: '12px', gap: '20px' },
    eventRow: { padding: '12px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.01)', border: '1px solid #21262d', display: 'flex', alignItems: 'center' }
};

export default SecurityCenter;
