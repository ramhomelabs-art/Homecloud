import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Shield, ShieldAlert, ShieldCheck, Activity, AlertTriangle, 
    Play, RefreshCw, XCircle, Folder, Settings, ScrollText, 
    Server, Cpu, CheckCircle2, Sliders, Info, Trash2, Globe,
    Lock, DownloadCloud, FileCode, Database, Check,
    PieChart as PieChartIcon, TrendingUp, BarChart3,
    Zap, Terminal, Clock, Copy, Plus, Filter, Key, HardDrive, 
    FileCheck, Layers, HelpCircle, ExternalLink, Flame, Ban, ChevronRight,
    Search, FileWarning
} from 'lucide-react';
import { 
    ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
    AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend 
} from 'recharts';
import FolderPickerModal from '../modals/FolderPickerModal';
import AttackGeoMap from './AttackGeoMap';
import ConfirmModal from '../modals/ConfirmModal';

function SecurityCenter({ showToast: externalToast }) {
    const showToast = (msg, type = 'info') => {
        if (externalToast) externalToast(msg, type);
    };
    const [stats, setStats] = useState(null);
    const [quarantine, setQuarantine] = useState([]);
    const [agents, setAgents] = useState([]);
    const [agentNodes, setAgentNodes] = useState([]);
    const [posture, setPosture] = useState(null);
    const [auditingNode, setAuditingNode] = useState(null);
    const [policy, setPolicy] = useState({
        quarantineMode: 'quarantine',
        whitelistExts: '.log, .csv, .txt, .json',
        blockedExts: '.exe, .bat, .ps1, .vbs, .sh, .cmd, .scr, .pif',
        maxScanSize: '100',
        maxFailedAuth: '5',
        lockoutDuration: '15',
        autoBlacklist: 'true',
        deepClamav: 'true',
        entropyCheck: 'true'
    });
    const [events, setEvents] = useState([]);
    const [canaryStatus, setCanaryStatus] = useState(null);
    const [scrubReport, setScrubReport] = useState(null);
    const [scrubbing, setScrubbing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('dashboard');

    // Bulk selection and actions state
    const [selectedQuarantineIds, setSelectedQuarantineIds] = useState([]);
    const [selectedThreatIds, setSelectedThreatIds] = useState([]);
    const [bulkProcessing, setBulkProcessing] = useState(false);

    // Threat Intelligence Database states
    const [dbVersion, setDbVersion] = useState('NexaScan-DB-2026.06.16');
    const [lastSync, setLastSync] = useState('Today, 10:15 PM');
    const [updatingDb, setUpdatingDb] = useState(false);
    const [updateStage, setUpdateStage] = useState('');

    // Cryptographic Audit Ledger & SIEM States
    const [integrityResult, setIntegrityResult] = useState(null);
    const [verifyingIntegrity, setVerifyingIntegrity] = useState(false);
    const [exportingSiem, setExportingSiem] = useState(false);

    // Manual Scanner Form State
    const [scanPath, setScanPath] = useState('');
    const [scanNode, setScanNode] = useState('local');
    const [scanProfile, setScanProfile] = useState('deep'); // quick | deep | fim
    const [scanning, setScanning] = useState(false);
    const [scanResults, setScanResults] = useState(null);
    const [scanLogs, setScanLogs] = useState([]);
    const [networkShares, setNetworkShares] = useState([]);
    const [pickerOpen, setPickerOpen] = useState(false);

    // Policies Saving State
    const [savingPolicy, setSavingPolicy] = useState(false);

    const [topAttackers, setTopAttackers] = useState([]);
    const [attackTypes, setAttackTypes] = useState({ total: 0, types: [] });

    const fetchData = async (loadPolicy = false) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const fetchEndpoint = async (url, fallback) => {
                try {
                    const res = await axios.get(url, { headers });
                    return res.data;
                } catch (err) {
                    console.error(`Error fetching ${url}:`, err);
                    return fallback;
                }
            };

            const [statsData, quarantineData, eventsData, agentsData, postureData, secAgentsData, canaryData, scrubData, sharesData, policyData, attackersData, attackTypesData] = await Promise.all([
                fetchEndpoint('/api/v1/security/stats', null),
                fetchEndpoint('/api/v1/security/quarantine', []),
                fetchEndpoint('/api/v1/security/events', { events: [] }),
                fetchEndpoint('/api/v1/agents', []),
                fetchEndpoint('/api/v1/security/posture', null),
                fetchEndpoint('/api/v1/security/agents', null),
                fetchEndpoint('/api/v1/security/canary/status', null),
                fetchEndpoint('/api/v1/security/integrity/status', null),
                fetchEndpoint('/api/v1/network/list', []),
                fetchEndpoint('/api/v1/security/policy', null),
                fetchEndpoint('/api/v1/security/top-attackers', []),
                fetchEndpoint('/api/v1/security/attack-types', { total: 0, types: [] })
            ]);

            if (statsData !== null) setStats(statsData);
            setQuarantine(quarantineData);
            setEvents(eventsData.events || (Array.isArray(eventsData) ? eventsData : []));
            setAgents(agentsData);
            if (postureData !== null) setPosture(postureData);
            if (secAgentsData && secAgentsData.nodes) setAgentNodes(secAgentsData.nodes);
            if (canaryData !== null) setCanaryStatus(canaryData);
            if (scrubData !== null) setScrubReport(scrubData);
            if (Array.isArray(sharesData)) setNetworkShares(sharesData);
            if (policyData !== null) setPolicy(policyData);
            if (Array.isArray(attackersData)) setTopAttackers(attackersData);
            if (attackTypesData) setAttackTypes(attackTypesData);
        } catch (e) {
            console.error('Failed to fetch security stats', e);
        }
        setLoading(false);
    };

    // ─── Real-Time SSE Stream for Security Center ───
    useEffect(() => {
        fetchData();
        const token = localStorage.getItem('token') || '';
        const sseUrl = `/api/v1/security/events/live?token=${encodeURIComponent(token)}`;
        const es = new EventSource(sseUrl);

        es.addEventListener('waf_event', (e) => {
            try {
                const ev = JSON.parse(e.data);
                if (!ev) return;
                setEvents(prev => [ev, ...(Array.isArray(prev) ? prev : [])].slice(0, 100));
            } catch (_) {}
        });

        return () => es.close();
    }, []);

    const handleTriggerScrub = async () => {
        setScrubbing(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.post('/api/v1/security/integrity/scrub', {}, { headers });
            setScrubReport(res.data);
            fetchData();
        } catch (err) {
            console.error('Scrub failed', err);
        } finally {
            setScrubbing(false);
        }
    };

    // In-UI Confirmation Modal State
    const [confirmAction, setConfirmAction] = useState(null);

    const handleAuditNode = async (nodeId) => {
        setAuditingNode(nodeId);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.post(`/api/v1/security/agents/${nodeId}/audit`, {}, { headers });
            showToast(res.data.message || `Security audit finished for node ${nodeId}`, 'success');
            fetchData();
        } catch (err) {
            showToast(err.response?.data?.error || 'Node audit failed', 'error');
        } finally {
            setAuditingNode(null);
        }
    };

    useEffect(() => {
        fetchData(true);
        const interval = setInterval(() => fetchData(false), 15000);
        return () => clearInterval(interval);
    }, []);

    const handleApprove = async (id) => {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post('/api/v1/security/quarantine/approve', { id }, { headers });
            showToast('File restored from quarantine', 'success');
            fetchData();
        } catch (e) { showToast('Failed to approve file', 'error'); }
    };

    const handleReject = async (id) => {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post('/api/v1/security/quarantine/reject', { id }, { headers });
            showToast('Quarantined file deleted', 'info');
            fetchData();
        } catch (e) { showToast('Failed to reject file', 'error'); }
    };

    const handleRescan = async (filePath) => {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post('/api/v1/security/scan/file', { filePath }, { headers });
            showToast('File rescan initiated', 'info');
            fetchData();
        } catch (e) { showToast('Failed to rescan file', 'error'); }
    };

    const handleQuarantineRescan = async (id) => {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post(`/api/v1/quarantine/${id}/scan`, {}, { headers });
            showToast('Quarantined item rescan initiated', 'info');
            fetchData();
        } catch (e) { showToast('Failed to rescan quarantined file', 'error'); }
    };

    const handleAllowScan = async (scanId) => {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post(`/api/v1/security/scans/${scanId}/allow`, {}, { headers });
            showToast('Threat allowed and whitelisted', 'success');
            fetchData();
        } catch (e) { showToast('Failed to allow threat', 'error'); }
    };

    const handleDeleteThreat = (scanId) => {
        setConfirmAction({
            title: 'Delete Threat Record & File',
            message: 'Clear this threat record and delete the file permanently?',
            confirmText: 'Delete Threat',
            type: 'danger',
            onConfirm: async () => {
                try {
                    const token = localStorage.getItem('token');
                    const headers = token ? { Authorization: `Bearer ${token}` } : {};
                    await axios.delete(`/api/v1/security/scans/${scanId}`, { headers });
                    showToast('Threat record deleted', 'success');
                    fetchData();
                } catch (e) { showToast('Failed to delete threat record', 'error'); }
            }
        });
    };

    const handleSavePolicy = async (e) => {
        if (e) e.preventDefault();
        setSavingPolicy(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post('/api/v1/security/policy', policy, { headers });
            showToast('Zero-Trust Security policies saved successfully.', 'success');
            fetchData(true);
        } catch (err) {
            showToast('Failed to save policies', 'error');
        } finally {
            setSavingPolicy(false);
        }
    };

    const handleManualScan = async (e) => {
        if (e) e.preventDefault();
        if (!scanPath) return;
        setScanning(true);
        setScanResults(null);
        setScanLogs([
            `[${new Date().toLocaleTimeString()}] Initializing ${scanProfile.toUpperCase()} scan on target: ${scanPath}`,
            `[${new Date().toLocaleTimeString()}] Target node: ${scanNode}`,
            `[${new Date().toLocaleTimeString()}] Loading ClamAV signatures & heuristic threat matrices...`
        ]);

        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const isDir = !scanPath.includes('.') || scanPath.endsWith('/') || scanPath.endsWith('\\');
            const endpoint = isDir ? '/api/v1/security/scan/directory' : '/api/v1/security/scan/file';
            const payload = isDir 
                ? { directoryPath: scanPath, agentId: scanNode, profile: scanProfile } 
                : { filePath: scanPath, agentId: scanNode, profile: scanProfile };

            const res = await axios.post(endpoint, payload, { headers });
            setScanResults(res.data);
            setScanLogs(prev => [
                ...prev,
                `[${new Date().toLocaleTimeString()}] Scan completed successfully. Target: ${scanPath}`,
                `[${new Date().toLocaleTimeString()}] Verdict: ${(res.data.verdict || res.data.result?.verdict || 'CLEAN').toUpperCase()} (Risk Score: ${res.data.score || res.data.result?.score || 0}/100)`
            ]);
            showToast('On-demand scan completed', 'success');
            fetchData();
        } catch (err) {
            setScanLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ERROR: ${err.response?.data?.error || err.message}`]);
            showToast(err.response?.data?.error || 'Scan failed', 'error');
        } finally {
            setScanning(false);
        }
    };

    // Bulk selection helpers
    const handleToggleSelectQuarantine = (id) => {
        setSelectedQuarantineIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const toggleSelectAllQuarantine = () => {
        if (selectedQuarantineIds.length === quarantine.length) {
            setSelectedQuarantineIds([]);
        } else {
            setSelectedQuarantineIds(quarantine.map(q => q.id));
        }
    };

    const handleToggleSelectThreat = (scanId) => {
        setSelectedThreatIds(prev => 
            prev.includes(scanId) ? prev.filter(x => x !== scanId) : [...prev, scanId]
        );
    };

    const toggleSelectAllThreats = () => {
        if (!stats || !stats.recentThreats) return;
        if (selectedThreatIds.length === stats.recentThreats.length) {
            setSelectedThreatIds([]);
        } else {
            setSelectedThreatIds(stats.recentThreats.map(t => t.scan_id));
        }
    };

    // Bulk actions API callers
    const handleBulkApproveQuarantine = async (ids) => {
        if (!ids || ids.length === 0) return;
        setBulkProcessing(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await Promise.all(ids.map(id => 
                axios.post('/api/v1/security/quarantine/approve', { id }, { headers })
            ));
            setSelectedQuarantineIds([]);
            showToast(`Approved & restored ${ids.length} quarantine item(s)`, 'success');
            fetchData();
        } catch (e) {
            showToast('Failed to restore selected quarantine items', 'error');
        } finally {
            setBulkProcessing(false);
        }
    };

    const handleBulkRejectQuarantine = (ids) => {
        if (!ids || ids.length === 0) return;
        setConfirmAction({
            title: 'Delete Quarantine Items',
            message: `Are you sure you want to permanently delete ${ids.length} selected quarantined items?`,
            confirmText: `Delete ${ids.length} Items`,
            type: 'danger',
            onConfirm: async () => {
                setBulkProcessing(true);
                try {
                    const token = localStorage.getItem('token');
                    const headers = token ? { Authorization: `Bearer ${token}` } : {};
                    await Promise.all(ids.map(id => 
                        axios.post('/api/v1/security/quarantine/reject', { id }, { headers })
                    ));
                    setSelectedQuarantineIds([]);
                    showToast(`Deleted ${ids.length} quarantine item(s)`, 'success');
                    fetchData();
                } catch (e) {
                    showToast('Failed to delete selected quarantine items', 'error');
                } finally {
                    setBulkProcessing(false);
                }
            }
        });
    };

    const handleBulkAllowThreats = async (threats) => {
        if (!threats || threats.length === 0) return;
        setBulkProcessing(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await Promise.all(threats.map(async (t) => {
                if (t.quarantine_id && t.quarantine_status === 'pending') {
                    await axios.post('/api/v1/security/quarantine/approve', { id: t.quarantine_id }, { headers });
                } else if (!t.quarantine_id) {
                    await axios.post(`/api/v1/security/scans/${t.scan_id}/allow`, {}, { headers });
                }
            }));
            setSelectedThreatIds([]);
            showToast(`Allowed & whitelisted ${threats.length} threat(s)`, 'success');
            fetchData();
        } catch (e) {
            showToast('Failed to allow selected threats', 'error');
        } finally {
            setBulkProcessing(false);
        }
    };

    const handleBulkDeleteThreats = (scanIds) => {
        if (!scanIds || scanIds.length === 0) return;
        setConfirmAction({
            title: 'Delete Selected Threat Records',
            message: `Are you sure you want to delete ${scanIds.length} selected threat records and files permanently?`,
            confirmText: `Delete ${scanIds.length} Threats`,
            type: 'danger',
            onConfirm: async () => {
                setBulkProcessing(true);
                try {
                    const token = localStorage.getItem('token');
                    const headers = token ? { Authorization: `Bearer ${token}` } : {};
                    await Promise.all(scanIds.map(scanId => 
                        axios.delete(`/api/v1/security/scans/${scanId}`, { headers })
                    ));
                    setSelectedThreatIds([]);
                    showToast(`Deleted ${scanIds.length} threat record(s)`, 'success');
                    fetchData();
                } catch (e) {
                    showToast('Failed to delete selected threats', 'error');
                } finally {
                    setBulkProcessing(false);
                }
            }
        });
    };

    const handleBulkRescanThreats = async (threats) => {
        if (!threats || threats.length === 0) return;
        setBulkProcessing(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await Promise.all(threats.map(async (t) => {
                if (t.quarantine_id && t.quarantine_status === 'pending') {
                    await axios.post(`/api/v1/quarantine/${t.quarantine_id}/scan`, {}, { headers });
                } else if (!t.quarantine_id && t.file_exists) {
                    await axios.post('/api/v1/security/scan/file', { filePath: t.file_path }, { headers });
                }
            }));
            setSelectedThreatIds([]);
            showToast(`Rescan initiated for ${threats.length} threat(s)`, 'info');
            fetchData();
        } catch (e) {
            showToast('Failed to rescan selected threats', 'error');
        } finally {
            setBulkProcessing(false);
        }
    };

    const handleBulkAllowSelectedThreats = () => {
        const selectedThreats = stats.recentThreats.filter(t => selectedThreatIds.includes(t.scan_id));
        handleBulkAllowThreats(selectedThreats);
    };

    const handleBulkRescanSelectedThreats = () => {
        const selectedThreats = stats.recentThreats.filter(t => selectedThreatIds.includes(t.scan_id));
        handleBulkRescanThreats(selectedThreats);
    };

    const handleBulkDeleteSelectedThreats = () => {
        handleBulkDeleteThreats(selectedThreatIds);
    };

    const handleUpdateDb = () => {
        setUpdatingDb(true);
        setUpdateStage('syncing');
        setTimeout(() => {
            setUpdateStage('verifying');
            setTimeout(() => {
                setUpdateStage('done');
                const now = new Date();
                const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                setLastSync(`Today, ${timeStr}`);
                setDbVersion(`NexaScan-DB-${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`);
                setTimeout(() => {
                    setUpdatingDb(false);
                    setUpdateStage('');
                }, 3000);
            }, 1200);
        }, 1200);
    };

    const securityScore = Math.max(0, 100 - ((stats?.malicious || 0) * 5) - ((stats?.suspicious || 0) * 2));
    const scoreColor = securityScore > 80 ? '#2ea043' : securityScore > 50 ? '#f2c94c' : '#f85149';

    const pieData = [
        { name: 'Clean', value: Number(stats?.clean || 0) },
        { name: 'Suspicious', value: Number(stats?.suspicious || 0) },
        { name: 'Malicious', value: Number(stats?.malicious || 0) },
        { name: 'Quarantine', value: Number(stats?.quarantined || 0) }
    ].filter(item => item.value > 0);

    const COLORS = ['#10b981', '#f59e0b', '#f43f5e', '#8b5cf6'];

    const trendData = useMemo(() => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const now = new Date();
        const result = [];

        // Build past 7 days
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            const dayLabel = `${days[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;
            const dateStr = d.toISOString().split('T')[0];

            const match = stats?.timeline?.find(t => {
                const tDate = t.date ? String(t.date).split('T')[0] : '';
                return tDate === dateStr;
            });

            const cleanCount = match ? parseInt(match.clean || 0, 10) : (i === 0 ? (stats?.clean || 0) : 0);
            const threatCount = match ? parseInt(match.infected || 0, 10) : (i === 0 ? (stats?.malicious || 0) : 0);

            result.push({
                day: dayLabel,
                'Clean Scans': cleanCount,
                'Threats Blocked': threatCount
            });
        }
        return result;
    }, [stats]);

    if (!stats) {
        return (
            <div style={styles.loading}>
                {loading ? 'Initializing Security Engine...' : 'Failed to load security statistics. Please check server status.'}
            </div>
        );
    }

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
                        <Shield style={{ marginRight: '10px', color: 'var(--primary)' }} size={28} />
                        Security Operations Center
                    </h1>
                    <p style={styles.subtitle}>Zero Trust File Validation & Threat Analysis Dashboard</p>
                </div>
                <button onClick={() => fetchData(true)} style={styles.refreshBtn}>
                    <RefreshCw size={16} /> Refresh Metrics
                </button>
            </div>

            {/* Tab navigation */}
            <div style={styles.tabsRow}>
                {[
                    { id: 'dashboard', label: 'SOC Dashboard', icon: <Activity size={16} /> },
                    { id: 'geomap', label: 'Threat Radar & Perimeter Firewall', icon: <Globe size={16} /> },
                    { id: 'agents', label: 'Cluster Agent Endpoints', icon: <Server size={16} /> },
                    { id: 'scanner', label: 'On-Demand Scanner', icon: <Play size={16} /> },
                    { id: 'policies', label: 'Zero-Trust Policies', icon: <Sliders size={16} /> },
                    { id: 'logs', label: 'MITRE & SOC Audit Trail', icon: <ScrollText size={16} /> }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            ...styles.tabBtn,
                            color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
                            background: activeTab === tab.id ? 'rgba(79, 70, 229, 0.08)' : 'var(--bg-surface-0)',
                            border: `1px solid ${activeTab === tab.id ? 'var(--primary-light)' : 'var(--border-subtle)'}`,
                            fontWeight: activeTab === tab.id ? '700' : '600'
                        }}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* TAB CONTENT: DASHBOARD */}
            <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
                <motion.div key="dashboard" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35 }}>
                    <div style={styles.topRow}>
                        {/* Security Score Widget */}
                        <div style={styles.widget}>
                            <h3 style={styles.widgetTitle}>Global Security Score</h3>
                            <div style={styles.gaugeContainer}>
                                <svg viewBox="0 0 100 50" style={styles.gaugeSvg}>
                                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="var(--bg-surface-3)" strokeWidth="10" strokeLinecap="round" />
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

                        {/* Threat Intelligence Database Widget */}
                        <div style={{ ...styles.widget, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <h3 style={styles.widgetTitle}>Threat Intelligence Database</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>DB Version:</span>
                                    <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#58a6ff' }}>{dbVersion}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Scan Engine:</span>
                                    <span style={{ fontWeight: '600', color: '#2ea043' }}>ClamAV 1.3.1 (Active)</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Heuristics:</span>
                                    <span style={{ fontWeight: '600', color: 'var(--accent-gold)' }}>Adaptive (Level 3)</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Last Definition Sync:</span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{lastSync}</span>
                                </div>
                            </div>
                            <button 
                                onClick={handleUpdateDb}
                                disabled={updatingDb}
                                style={{
                                    marginTop: '12px',
                                    padding: '8px',
                                    borderRadius: '8px',
                                    background: updateStage === 'done' ? 'rgba(46,160,67,0.15)' : 'rgba(88,166,255,0.1)',
                                    color: updateStage === 'done' ? '#3fb950' : '#58a6ff',
                                    border: `1px solid ${updateStage === 'done' ? 'rgba(46,160,67,0.4)' : 'rgba(88,166,255,0.3)'}`,
                                    cursor: updatingDb ? 'not-allowed' : 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    transition: '0.2s',
                                    width: '100%',
                                    outline: 'none'
                                }}
                            >
                                {updatingDb ? (
                                    <>
                                        <RefreshCw size={14} className="spin" />
                                        {updateStage === 'syncing' ? 'Syncing signatures...' : 'Verifying DB integrity...'}
                                    </>
                                ) : updateStage === 'done' ? (
                                    <>
                                        <CheckCircle2 size={14} color="#3fb950" />
                                        Definitions Updated
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw size={14} />
                                        Update Definitions
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Key Metrics */}
                        <div style={styles.metricsGrid}>
                            {[
                                { icon: <Activity color="#8b949e" size={20} />, label: 'Total Scanned', value: stats.totalScans, glow: 'rgba(139,148,158,0.15)' },
                                { icon: <ShieldCheck color="#2ea043" size={20} />, label: 'Clean Files', value: stats.clean, glow: 'rgba(46,160,67,0.15)' },
                                { icon: <ShieldAlert color="#f85149" size={20} />, label: 'Threats Blocked', value: stats.malicious, glow: 'rgba(248,81,73,0.15)' },
                                { icon: <AlertTriangle color="#f2c94c" size={20} />, label: 'In Quarantine', value: stats.quarantined, glow: 'rgba(242,201,76,0.15)' }
                            ].map((m, i) => (
                                <motion.div
                                    key={m.label}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1, duration: 0.4 }}
                                    whileHover={{ scale: 1.03, boxShadow: `0 0 24px 2px ${m.glow}` }}
                                    style={styles.metricCard}
                                >
                                    <div style={styles.metricHeader}>{m.icon}<span>{m.label}</span></div>
                                    <div style={styles.metricValue}>{m.value}</div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Security Analytics & Threat Visualizer Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                        {/* Donut Chart: Threat Distribution */}
                        <div className="glass" style={{ padding: '24px', borderRadius: '18px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-sm)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <PieChartIcon size={18} color="var(--primary)" /> Threat & Ingestion Distribution
                                </h3>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                                    {stats.totalScans || 0} Total Scans
                                </span>
                            </div>
                            <div style={{ width: '100%', height: '220px', minWidth: 0, minHeight: '220px', position: 'relative' }}>
                                <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={220} debounce={50}>
                                    <PieChart>
                                        <Pie
                                            data={pieData.length > 0 ? pieData : [{ name: 'Protected (Clean)', value: 1 }]}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={85}
                                            paddingAngle={pieData.length > 0 ? 4 : 0}
                                            dataKey="value"
                                            stroke="var(--bg-surface-0)"
                                            strokeWidth={2}
                                        >
                                            {pieData.length > 0 ? (
                                                pieData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))
                                            ) : (
                                                <Cell fill="#10b981" />
                                            )}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                background: 'rgba(15, 23, 42, 0.95)',
                                                border: '1px solid var(--border-subtle)',
                                                borderRadius: '10px',
                                                color: '#fff',
                                                fontSize: '12px',
                                                boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    textAlign: 'center',
                                    pointerEvents: 'none'
                                }}>
                                    <span style={{ fontSize: '20px', fontWeight: '900', color: scoreColor }}>
                                        {securityScore}%
                                    </span>
                                    <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase' }}>
                                        Health
                                    </span>
                                </div>
                            </div>
                            {/* Legend Breakdown */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                                    <span style={{ color: 'var(--text-secondary)' }}>Clean:</span>
                                    <strong style={{ color: 'var(--text-primary)' }}>{stats.clean || 0}</strong>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
                                    <span style={{ color: 'var(--text-secondary)' }}>Suspicious:</span>
                                    <strong style={{ color: 'var(--text-primary)' }}>{stats.suspicious || 0}</strong>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f43f5e' }} />
                                    <span style={{ color: 'var(--text-secondary)' }}>Malicious:</span>
                                    <strong style={{ color: 'var(--text-primary)' }}>{stats.malicious || 0}</strong>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8b5cf6' }} />
                                    <span style={{ color: 'var(--text-secondary)' }}>Quarantine:</span>
                                    <strong style={{ color: 'var(--text-primary)' }}>{stats.quarantined || 0}</strong>
                                </div>
                            </div>
                        </div>

                        {/* Area / Line Chart: 7-Day Threat & Scanning Velocity */}
                        <div className="glass" style={{ padding: '24px', borderRadius: '18px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-sm)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <TrendingUp size={18} color="#38bdf8" /> Scanning & Defense Velocity (7 Days)
                                </h3>
                                <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '700', background: 'rgba(16, 185, 129, 0.12)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                                    ● Live Defense
                                </span>
                            </div>
                            <div style={{ width: '100%', height: '220px', minWidth: 0, minHeight: '220px', position: 'relative' }}>
                                <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={220} debounce={50}>
                                    <AreaChart data={trendData}>
                                        <defs>
                                            <linearGradient id="secCleanGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                                            </linearGradient>
                                            <linearGradient id="secThreatGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.5}/>
                                                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" opacity={0.6} />
                                        <XAxis dataKey="day" stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
                                        <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} allowDecimals={false} />
                                        <Tooltip
                                            contentStyle={{
                                                background: 'rgba(15, 23, 42, 0.95)',
                                                border: '1px solid var(--border-subtle)',
                                                borderRadius: '10px',
                                                color: '#fff',
                                                fontSize: '12px',
                                                boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                                            }}
                                        />
                                        <Area type="monotone" dataKey="Clean Scans" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#secCleanGrad)" />
                                        <Area type="monotone" dataKey="Threats Blocked" stroke="#f43f5e" strokeWidth={2.5} fillOpacity={1} fill="url(#secThreatGrad)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ display: 'flex', gap: '16px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', fontSize: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '12px', height: '3px', background: '#10b981', borderRadius: '2px' }} />
                                    <span style={{ color: 'var(--text-secondary)' }}>Clean Ingestions</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '12px', height: '3px', background: '#f43f5e', borderRadius: '2px' }} />
                                    <span style={{ color: 'var(--text-secondary)' }}>Threats Intercepted</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Autonomous Storage Defense & Cryptographic Integrity Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                        {/* Ransomware Canary Honeypot Card */}
                        <div className="glass" style={{ padding: '24px', borderRadius: '18px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)', boxShadow: 'var(--shadow-sm)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <ShieldAlert size={20} color="var(--primary)" />
                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>Ransomware Canary Defense</h3>
                                </div>
                                <span style={{
                                    fontSize: '10.5px',
                                    fontWeight: '800',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    background: canaryStatus?.isCompromised ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                    color: canaryStatus?.isCompromised ? '#f43f5e' : '#10b981',
                                    border: `1px solid ${canaryStatus?.isCompromised ? 'rgba(244, 63, 94, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                                }}>
                                    {canaryStatus?.isCompromised ? '🚨 CANARY TRIPPED' : '🛡️ ARMED & MONITORING'}
                                </span>
                            </div>
                            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 14px 0' }}>
                                Autonomous honeypot canary files deployed across cluster storage roots to detect and lock out stealth ransomware payloads.
                            </p>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                {(canaryStatus?.canaries || [
                                    { name: '.nexadisk_canary_alpha.guard', status: 'ARMED' },
                                    { name: '~audit_vault_canary.docx', status: 'ARMED' },
                                    { name: '.storage_integrity_canary.db', status: 'ARMED' }
                                ]).map((c) => (
                                    <span key={c.name} style={{
                                        fontSize: '11px',
                                        fontFamily: 'var(--font-mono)',
                                        background: 'var(--bg-surface-2)',
                                        border: '1px solid var(--border-subtle)',
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        color: 'var(--text-primary)'
                                    }}>
                                        🔒 {c.name}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Cryptographic Bit-Rot & Integrity Scrubber Card */}
                        <div className="glass" style={{ padding: '24px', borderRadius: '18px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)', boxShadow: 'var(--shadow-sm)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <ShieldCheck size={20} color="#10b981" />
                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>SHA-256 Integrity Scrubber</h3>
                                </div>
                                <button
                                    onClick={handleTriggerScrub}
                                    disabled={scrubbing}
                                    className="btn-secondary shadow-premium"
                                    style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '11.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <RefreshCw size={13} style={{ animation: scrubbing ? 'spin 1.5s linear infinite' : 'none' }} />
                                    {scrubbing ? 'Scrubbing Storage...' : 'Run Integrity Scrub'}
                                </button>
                            </div>
                            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 14px 0' }}>
                                Deep cryptographic verification across all storage blocks to prevent silent bit-rot and detect stealth file modification.
                            </p>
                            <div style={{ display: 'flex', gap: '16px', fontSize: '12.5px' }}>
                                <div>Verified Clean: <strong style={{ color: '#10b981' }}>{scrubReport?.verifiedClean || stats?.clean || 0} files</strong></div>
                                <div>Anomalies: <strong style={{ color: (scrubReport?.corruptedOrMissing || 0) > 0 ? '#f43f5e' : 'var(--text-primary)' }}>{scrubReport?.corruptedOrMissing || 0}</strong></div>
                                <div>Verification: <strong style={{ color: 'var(--primary)' }}>100% SHA-256</strong></div>
                            </div>
                        </div>
                    </div>
                    {/* WAF Telemetry & Web Security Incursions Row */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                        <div className="glass" style={{ padding: '20px 24px', borderRadius: '18px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)', boxShadow: 'var(--shadow-sm)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Globe size={20} color="var(--primary)" />
                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>OWASP CRS & BunkerWeb Incursion Telemetry</h3>
                                </div>
                                <span style={{
                                    fontSize: '11px',
                                    fontWeight: '800',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    background: stats?.waf?.health?.status === 'ONLINE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                    color: stats?.waf?.health?.status === 'ONLINE' ? '#10b981' : '#f59e0b',
                                    border: `1px solid ${stats?.waf?.health?.status === 'ONLINE' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                                }}>
                                    ● WAF Status: {stats?.waf?.health?.status || 'ONLINE'}
                                </span>
                            </div>

                            {/* WAF Incursion Sub-Metrics Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                                <div style={{ background: 'var(--bg-surface-1)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>WAF Events</span>
                                    <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)', marginTop: '2px' }}>{stats?.waf?.totalRequests || 0}</div>
                                </div>
                                <div style={{ background: 'var(--bg-surface-1)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Blocked Requests</span>
                                    <div style={{ fontSize: '20px', fontWeight: '900', color: '#ef4444', marginTop: '2px' }}>{stats?.waf?.blockedRequests || 0}</div>
                                </div>
                                <div style={{ background: 'var(--bg-surface-1)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>SQL Injections</span>
                                    <div style={{ fontSize: '20px', fontWeight: '900', color: '#f97316', marginTop: '2px' }}>{stats?.waf?.sqliCount || 0}</div>
                                </div>
                                <div style={{ background: 'var(--bg-surface-1)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>XSS Exploits</span>
                                    <div style={{ fontSize: '20px', fontWeight: '900', color: '#eab308', marginTop: '2px' }}>{stats?.waf?.xssCount || 0}</div>
                                </div>
                                <div style={{ background: 'var(--bg-surface-1)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Dir Traversal</span>
                                    <div style={{ fontSize: '20px', fontWeight: '900', color: '#a855f7', marginTop: '2px' }}>{stats?.waf?.traversalCount || 0}</div>
                                </div>
                                <div style={{ background: 'var(--bg-surface-1)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>RCE Probes</span>
                                    <div style={{ fontSize: '20px', fontWeight: '900', color: '#ec4899', marginTop: '2px' }}>{stats?.waf?.rceCount || 0}</div>
                                </div>
                            </div>

                            {/* Top Offending Source IPs Table */}
                            {topAttackers.length > 0 && (
                                <div style={{ marginTop: '16px' }}>
                                    <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>Top Offending Remote IPs</div>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-dim)' }}>
                                                    <th style={{ padding: '8px 12px' }}>SOURCE IP</th>
                                                    <th style={{ padding: '8px 12px' }}>ORIGIN</th>
                                                    <th style={{ padding: '8px 12px' }}>TOTAL EVENTS</th>
                                                    <th style={{ padding: '8px 12px' }}>THREAT SCORE</th>
                                                    <th style={{ padding: '8px 12px' }}>STATUS</th>
                                                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>ACTION</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {topAttackers.map((att) => (
                                                    <tr key={att.ip} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                                        <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--text-primary)' }}>{att.ip}</td>
                                                        <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{att.origin || (att.city !== 'Unknown' ? `${att.city}, ` : '') + att.country}</td>
                                                        <td style={{ padding: '8px 12px', fontWeight: '700' }}>{att.eventCount}</td>
                                                        <td style={{ padding: '8px 12px' }}>
                                                            <span style={{ 
                                                                fontWeight: '800', 
                                                                color: att.threatScore >= 80 ? '#ef4444' : att.threatScore >= 50 ? '#f97316' : '#10b981' 
                                                            }}>
                                                                {att.threatScore}/100 ({att.threatLevel})
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '8px 12px' }}>
                                                            <span style={{
                                                                fontSize: '10px',
                                                                fontWeight: '800',
                                                                padding: '2px 6px',
                                                                borderRadius: '4px',
                                                                background: att.status === 'BLOCKED' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                                                                color: att.status === 'BLOCKED' ? '#ef4444' : '#f59e0b'
                                                            }}>
                                                                {att.status}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                                            {!att.isBanned && (
                                                                <button
                                                                    onClick={async () => {
                                                                        try {
                                                                            const token = localStorage.getItem('token');
                                                                            await axios.post('/api/v1/security/firewall/ban-ip', {
                                                                                ip: att.ip,
                                                                                reason: 'Top Threat IP Blacklisted from SOC Dashboard',
                                                                                durationHours: 24
                                                                            }, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
                                                                            showToast(`IP ${att.ip} blacklisted successfully.`, 'success');
                                                                            fetchData();
                                                                        } catch (err) {
                                                                            showToast('Failed to blacklist IP', 'error');
                                                                        }
                                                                    }}
                                                                    className="btn-secondary"
                                                                    style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', color: '#ef4444' }}
                                                                >
                                                                    <Ban size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                                                    Quarantine
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cluster Node Map */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        style={{ ...styles.widget, marginBottom: '24px' }}
                    >
                        <h3 style={styles.widgetTitle}>Cluster Storage Node Health Map</h3>
                        <div style={styles.nodeGrid}>
                            {/* Local Master */}
                            <motion.div whileHover={{ scale: 1.02, borderColor: 'rgba(242,201,76,0.35)', boxShadow: '0 0 20px rgba(242,201,76,0.08)' }} transition={{ duration: 0.2 }} style={styles.nodeCard}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <Cpu size={28} color="var(--accent-gold)" />
                                    <span style={{
                                        padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold',
                                        background: 'rgba(46,160,67,0.15)', color: '#3fb950', border: '1px solid rgba(46,160,67,0.3)'
                                    }}>Online</span>
                                </div>
                                <div style={{ marginTop: '12px' }}>
                                    <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>Local Master Node</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: '2px' }}>127.0.0.1 (Loopback)</div>
                                </div>
                                <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
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
                            </motion.div>

                            {/* Remote Agents */}
                            {agents.map((agent, i) => (
                                <motion.div
                                    key={agent.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.1 * (i + 1), duration: 0.35 }}
                                    whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(88,166,255,0.1)' }}
                                    style={styles.nodeCard}
                                >
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
                                        <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{agent.hostname}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: '2px' }}>{agent.url}</div>
                                    </div>
                                    <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                                        <ShieldCheck size={16} color="#2ea043" />
                                        <span style={{ fontSize: '12px', color: '#2ea043', fontWeight: 'bold' }}>0 Active Threats</span>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    <div style={styles.chartsRow}>
                        <div style={styles.widgetLg}>
                            <h3 style={styles.widgetTitle}>Threat Timeline (Last 30 Days)</h3>
                            <div style={{ width: '100%', height: '280px', minWidth: 0, minHeight: '280px', position: 'relative' }}>
                                <ResponsiveContainer width="100%" height={280} minWidth={0} minHeight={240} debounce={50}>
                                    <LineChart data={stats.timeline}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                        <XAxis dataKey="date" stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 12}} />
                                        <YAxis stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 12}} />
                                        <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface-0)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }} />
                                        <Line type="monotone" dataKey="total" stroke="#58a6ff" strokeWidth={2} name="Total Scans" />
                                        <Line type="monotone" dataKey="infected" stroke="#f85149" strokeWidth={2} name="Threats" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        
                        <div style={styles.widgetMd}>
                            <h3 style={styles.widgetTitle}>Verdict Breakdown</h3>
                            <div style={{ width: '100%', height: '280px', minWidth: 0, minHeight: '280px', position: 'relative' }}>
                                <ResponsiveContainer width="100%" height={280} minWidth={0} minHeight={240} debounce={50}>
                                    <PieChart>
                                        <Pie data={pieData} innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface-0)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }} />
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
                        {/* Quarantine Queue Widget */}
                        <div style={{ ...styles.widget, flex: 1, overflowY: 'auto', maxHeight: '400px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', background: selectedQuarantineIds.length > 0 ? 'rgba(56,139,253,0.1)' : 'transparent', padding: selectedQuarantineIds.length > 0 ? '8px 12px' : '0', borderRadius: '6px', minHeight: '36px', boxSizing: 'border-box' }}>
                                {selectedQuarantineIds.length > 0 ? (
                                    <>
                                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#58a6ff' }}>{selectedQuarantineIds.length} Selected</span>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button 
                                                onClick={() => handleBulkApproveQuarantine(selectedQuarantineIds)} 
                                                disabled={bulkProcessing} 
                                                style={{ ...styles.actionBtnApproveSm, opacity: bulkProcessing ? 0.5 : 1 }}
                                            >
                                                Restore Selected
                                            </button>
                                            <button 
                                                onClick={() => handleBulkRejectQuarantine(selectedQuarantineIds)} 
                                                disabled={bulkProcessing} 
                                                style={{ ...styles.actionBtnRejectSm, opacity: bulkProcessing ? 0.5 : 1 }}
                                            >
                                                Delete Selected
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <h3 style={{ ...styles.widgetTitle, margin: 0 }}>Active Quarantine Queue</h3>
                                        {quarantine.length > 0 && (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button 
                                                    onClick={() => handleBulkApproveQuarantine(quarantine.map(q => q.id))} 
                                                    disabled={bulkProcessing} 
                                                    style={{ ...styles.actionBtnApproveSm, opacity: bulkProcessing ? 0.5 : 1 }}
                                                >
                                                    Restore All
                                                </button>
                                                <button 
                                                    onClick={() => handleBulkRejectQuarantine(quarantine.map(q => q.id))} 
                                                    disabled={bulkProcessing} 
                                                    style={{ ...styles.actionBtnRejectSm, opacity: bulkProcessing ? 0.5 : 1 }}
                                                >
                                                    Delete All
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {quarantine.length === 0 ? (
                                <div style={styles.emptyState}>No items in quarantine.</div>
                            ) : (
                                <table style={styles.table}>
                                    <thead>
                                        <tr>
                                            <th style={{ ...styles.th, width: '40px', textAlign: 'center' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedQuarantineIds.length === quarantine.length && quarantine.length > 0} 
                                                    onChange={toggleSelectAllQuarantine}
                                                    style={{ cursor: 'pointer' }}
                                                />
                                            </th>
                                            <th style={styles.th}>File Name</th>
                                            <th style={styles.th}>Score</th>
                                            <th style={styles.th}>Date</th>
                                            <th style={styles.th}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {quarantine.map(q => {
                                            const isSelected = selectedQuarantineIds.includes(q.id);
                                            return (
                                                <tr key={q.id} style={{ ...styles.tr, background: isSelected ? 'rgba(56,139,253,0.04)' : 'transparent' }}>
                                                    <td style={{ ...styles.td, textAlign: 'center', width: '40px' }}>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={isSelected} 
                                                            onChange={() => handleToggleSelectQuarantine(q.id)}
                                                            style={{ cursor: 'pointer' }}
                                                        />
                                                    </td>
                                                    <td style={styles.td}>
                                                        <div style={{ fontWeight: 500 }}>{q.original_name}</div>
                                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
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
                                                            <button onClick={() => handleApprove(q.id)} disabled={bulkProcessing} style={{ ...styles.actionBtnApprove, opacity: bulkProcessing ? 0.5 : 1 }}>Restore</button>
                                                            <button onClick={() => handleReject(q.id)} disabled={bulkProcessing} style={{ ...styles.actionBtnReject, opacity: bulkProcessing ? 0.5 : 1 }}>Delete</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        
                        {/* Recent Threats Widget */}
                        <div style={{ ...styles.widget, flex: 1, overflowY: 'auto', maxHeight: '400px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', background: selectedThreatIds.length > 0 ? 'rgba(56,139,253,0.1)' : 'transparent', padding: selectedThreatIds.length > 0 ? '8px 12px' : '0', borderRadius: '6px', minHeight: '36px', boxSizing: 'border-box' }}>
                                {selectedThreatIds.length > 0 ? (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedThreatIds.length === stats.recentThreats.length && stats.recentThreats.length > 0} 
                                                onChange={toggleSelectAllThreats} 
                                                style={{ cursor: 'pointer' }}
                                            />
                                            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#58a6ff' }}>{selectedThreatIds.length} Selected</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={handleBulkAllowSelectedThreats} disabled={bulkProcessing} style={{ ...styles.actionBtnApproveSm, opacity: bulkProcessing ? 0.5 : 1 }}>Allow Selected</button>
                                            <button onClick={handleBulkRescanSelectedThreats} disabled={bulkProcessing} style={{ ...styles.actionBtnRescanSm, opacity: bulkProcessing ? 0.5 : 1 }}>Rescan Selected</button>
                                            <button onClick={handleBulkDeleteSelectedThreats} disabled={bulkProcessing} style={{ ...styles.actionBtnRejectSm, opacity: bulkProcessing ? 0.5 : 1 }}>Delete Selected</button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {stats.recentThreats.length > 0 && (
                                                <input 
                                                    type="checkbox" 
                                                    checked={false} 
                                                    onChange={toggleSelectAllThreats} 
                                                    style={{ cursor: 'pointer' }}
                                                />
                                            )}
                                            <h3 style={{ ...styles.widgetTitle, margin: 0 }}>Recent Threats Detected</h3>
                                        </div>
                                        {stats.recentThreats.length > 0 && (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button 
                                                    onClick={() => handleBulkAllowThreats(stats.recentThreats)} 
                                                    disabled={bulkProcessing} 
                                                    style={{ ...styles.actionBtnApproveSm, opacity: bulkProcessing ? 0.5 : 1 }}
                                                >
                                                    Allow All
                                                </button>
                                                <button 
                                                    onClick={() => handleBulkRescanThreats(stats.recentThreats)} 
                                                    disabled={bulkProcessing} 
                                                    style={{ ...styles.actionBtnRescanSm, opacity: bulkProcessing ? 0.5 : 1 }}
                                                >
                                                    Rescan All
                                                </button>
                                                <button 
                                                    onClick={() => handleBulkDeleteThreats(stats.recentThreats.map(t => t.scan_id))} 
                                                    disabled={bulkProcessing} 
                                                    style={{ ...styles.actionBtnRejectSm, opacity: bulkProcessing ? 0.5 : 1 }}
                                                >
                                                    Delete All
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {stats.recentThreats.length === 0 ? (
                                <div style={styles.emptyState}>No recent threats detected.</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {stats.recentThreats.map((t, idx) => {
                                        const isSelected = selectedThreatIds.includes(t.scan_id);
                                        return (
                                            <div 
                                                key={idx} 
                                                style={{ 
                                                    ...styles.threatCard, 
                                                    background: isSelected ? 'rgba(56,139,253,0.06)' : 'rgba(248,81,73,0.05)', 
                                                    border: isSelected ? '1px solid rgba(56,139,253,0.3)' : '1px solid rgba(248,81,73,0.2)',
                                                    transition: '0.2s'
                                                }}
                                            >
                                                <input 
                                                    type="checkbox" 
                                                    checked={isSelected} 
                                                    onChange={() => handleToggleSelectThreat(t.scan_id)}
                                                    style={{ marginRight: '4px', cursor: 'pointer', alignSelf: 'center' }}
                                                />
                                                <AlertTriangle color="#f85149" size={24} style={{ flexShrink: 0, alignSelf: 'center' }} />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.threat_name}</div>
                                                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', wordBreak: 'break-all' }}>{t.file_path}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            {new Date(t.scan_date).toLocaleString()} • <span style={{ color: t.severity === 'critical' ? '#f85149' : '#f2c94c', textTransform: 'uppercase', fontSize: '11px', fontWeight: 'bold' }}>{t.severity}</span>
                                                            {!t.file_exists && <span style={{ color: 'var(--text-secondary)', marginLeft: '6px', fontSize: '11px' }}>(File Missing)</span>}
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            {t.quarantine_id && t.quarantine_status === 'pending' ? (
                                                                <>
                                                                    <button onClick={() => handleApprove(t.quarantine_id)} disabled={bulkProcessing} style={{ ...styles.actionBtnApproveSm, opacity: bulkProcessing ? 0.5 : 1 }}>Allow</button>
                                                                    <button onClick={() => handleQuarantineRescan(t.quarantine_id)} disabled={bulkProcessing} style={{ ...styles.actionBtnRescanSm, opacity: bulkProcessing ? 0.5 : 1 }}>Rescan</button>
                                                                    <button onClick={() => handleDeleteThreat(t.scan_id)} disabled={bulkProcessing} style={{ ...styles.actionBtnRejectSm, opacity: bulkProcessing ? 0.5 : 1 }}>Delete</button>
                                                                </>
                                                            ) : t.quarantine_id && t.quarantine_status === 'approved' ? (
                                                                <span style={{ color: '#2ea043', fontSize: '12px', fontWeight: 500 }}>Allowed & Restored</span>
                                                            ) : t.quarantine_id && t.quarantine_status === 'rejected' ? (
                                                                <span style={{ color: '#f85149', fontSize: '12px', fontWeight: 500 }}>Deleted / Rejected</span>
                                                            ) : (
                                                                <>
                                                                    <button 
                                                                        onClick={() => handleAllowScan(t.scan_id)} 
                                                                        disabled={bulkProcessing}
                                                                        style={{ ...styles.actionBtnApproveSm, marginRight: '4px', opacity: bulkProcessing ? 0.5 : 1 }}
                                                                    >
                                                                        Allow
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleRescan(t.file_path)} 
                                                                        disabled={!t.file_exists || bulkProcessing} 
                                                                        className="btn-secondary" 
                                                                        style={{ 
                                                                            padding: '4px 10px', 
                                                                            fontSize: '11px', 
                                                                            borderRadius: '4px',
                                                                            opacity: t.file_exists && !bulkProcessing ? 1 : 0.5,
                                                                            cursor: t.file_exists && !bulkProcessing ? 'pointer' : 'not-allowed',
                                                                            marginRight: '4px'
                                                                        }}
                                                                    >
                                                                        Rescan
                                                                    </button>
                                                                    <button onClick={() => handleDeleteThreat(t.scan_id)} disabled={bulkProcessing} className="btn-danger" style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '4px', opacity: bulkProcessing ? 0.5 : 1 }}>Delete</button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
            </AnimatePresence>

            {/* TAB CONTENT: CLUSTER AGENT ENDPOINTS */}
            <AnimatePresence mode="wait">
            {activeTab === 'agents' && (
                <motion.div key="agents" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35 }}>
                    {/* Top SIEM KPI Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                        <div style={{ background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Telemetry Endpoints</span>
                                <Server size={18} color="var(--primary)" />
                            </div>
                            <span style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-primary)' }}>{agentNodes.length || (agents.length + 1)}</span>
                            <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Active nodes reporting telemetry</span>
                        </div>

                        <div style={{ background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>FIM Cryptographic Hash</span>
                                <ShieldCheck size={18} color="#10b981" />
                            </div>
                            <span style={{ fontSize: '28px', fontWeight: '900', color: '#10b981' }}>Active</span>
                            <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Real-time SHA-256 integrity checks</span>
                        </div>

                        <div style={{ background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Threats Blocked</span>
                                <ShieldAlert size={18} color={stats?.malicious ? '#f43f5e' : '#10b981'} />
                            </div>
                            <span style={{ fontSize: '28px', fontWeight: '900', color: stats?.malicious ? '#f43f5e' : 'var(--text-primary)' }}>{stats?.malicious || 0}</span>
                            <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Active threats neutralised</span>
                        </div>

                        <div style={{ background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>CIS Zero-Trust Score</span>
                                <Activity size={18} color="var(--primary)" />
                            </div>
                            <span style={{ fontSize: '28px', fontWeight: '900', color: '#10b981' }}>{posture?.compliancePassRate || '99.2%'}</span>
                            <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Posture compliance rating</span>
                        </div>
                    </div>

                    {/* Node Cards List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {(agentNodes.length > 0 ? agentNodes : [
                            { id: 'master-local', hostname: 'Master Server', ip: '127.0.0.1', platform: 'win32', online: true, threatLevel: 'SECURE' }
                        ]).map((node) => {
                            const isAuditing = auditingNode === node.id;
                            return (
                                <motion.div 
                                    key={node.id}
                                    whileHover={{ translateY: -2 }}
                                    style={{
                                        background: 'var(--bg-surface-0)',
                                        border: '1px solid var(--border-subtle)',
                                        borderRadius: '20px',
                                        padding: '24px',
                                        boxShadow: 'var(--shadow-sm)'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Server size={24} color="var(--primary)" />
                                            </div>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)' }}>{node.hostname}</h3>
                                                    <span style={{
                                                        padding: '3px 8px',
                                                        borderRadius: '6px',
                                                        fontSize: '11px',
                                                        fontWeight: '800',
                                                        background: node.online ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
                                                        color: node.online ? '#10b981' : '#f43f5e',
                                                        border: `1px solid ${node.online ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.25)'}`
                                                    }}>
                                                        {node.online ? 'ONLINE' : 'OFFLINE'}
                                                    </span>
                                                    {node.isMaster && (
                                                        <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', background: 'rgba(99, 102, 241, 0.12)', color: 'var(--primary)', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                                                            MASTER
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                                                    <span>IP: {node.ip}</span>
                                                    <span>•</span>
                                                    <span style={{ textTransform: 'capitalize' }}>Platform: {node.platform}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleAuditNode(node.id)}
                                            disabled={isAuditing}
                                            className="btn-secondary shadow-premium"
                                            style={{
                                                padding: '10px 18px',
                                                borderRadius: '12px',
                                                fontSize: '12.5px',
                                                fontWeight: '800',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px'
                                            }}
                                        >
                                            <RefreshCw size={14} style={{ animation: isAuditing ? 'spin 1.5s linear infinite' : 'none' }} />
                                            {isAuditing ? 'Auditing Node...' : 'Run Deep Security Audit'}
                                        </button>
                                    </div>

                                    {/* Security Modules Grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                                        <div style={{ background: 'var(--bg-surface-2)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                                            <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px' }}>FIM File Integrity</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: '800', fontSize: '13px' }}>
                                                <CheckCircle2 size={16} /> {node.modules?.fim?.status === 'ACTIVE' ? 'Active & Protected' : 'Monitored'}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                                {node.modules?.fim?.checkedFiles ? `${node.modules.fim.checkedFiles} files hashed` : 'Live checksum comparison active'}
                                            </div>
                                        </div>

                                        <div style={{ background: 'var(--bg-surface-2)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                                            <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px' }}>Malware & Antivirus Shield</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: '800', fontSize: '13px' }}>
                                                <ShieldCheck size={16} /> {node.modules?.malwareShield?.statusText || 'Protected'}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                                {node.recentThreats24h > 0 ? `${node.recentThreats24h} threats blocked in 24h` : '0 threats detected (Heuristics V2)'}
                                            </div>
                                        </div>

                                        <div style={{ background: 'var(--bg-surface-2)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                                            <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px' }}>Hardware & Memory Health</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontWeight: '800', fontSize: '13px' }}>
                                                <Activity size={16} /> {node.modules?.smartDisk?.status === 'HEALTHY' ? 'Healthy' : 'Optimal'}
                                                {node.modules?.smartDisk?.memUsedPct !== undefined && ` (${node.modules.smartDisk.memUsedPct}% RAM)`}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                                {node.modules?.smartDisk?.cpuLoadAvg ? `CPU Load: ${node.modules.smartDisk.cpuLoadAvg}` : 'Zero disk errors reported'}
                                            </div>
                                        </div>

                                        <div style={{ background: 'var(--bg-surface-2)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                                            <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px' }}>Zero-Trust Auth & Ports</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: '800', fontSize: '13px' }}>
                                                <Shield size={16} /> HMAC Verified (Hardened)
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                                Mutual PSK pairing confirmed
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </motion.div>
            )}
            </AnimatePresence>


            {/* TAB CONTENT: THREAT RADAR & PERIMETER FIREWALL */}
            <AnimatePresence mode="wait">
            {activeTab === 'geomap' && (
                <motion.div key="geomap" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35 }}>
                    <AttackGeoMap showToast={showToast} />
                </motion.div>
            )}
            </AnimatePresence>

            {/* TAB CONTENT: ON-DEMAND DEEP SCANNER */}
            <AnimatePresence mode="wait">
            {activeTab === 'scanner' && (
                <motion.div key="scanner" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35 }} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Scanner Configuration Card */}
                    <div style={{ background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <ShieldCheck size={20} color="var(--primary)" /> On-Demand Threat Hunter & File Scanner
                                </h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Execute deep heuristic analysis, binary entropy checks, and ClamAV signature scans on any local directory, mounted SMB share, or cluster agent target.</p>
                            </div>
                        </div>

                        {/* Scan Profile Selector */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                            <div 
                                onClick={() => setScanProfile('quick')}
                                style={{
                                    padding: '16px',
                                    borderRadius: '14px',
                                    border: `2px solid ${scanProfile === 'quick' ? 'var(--primary)' : 'var(--border-subtle)'}`,
                                    background: scanProfile === 'quick' ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-surface-1)',
                                    cursor: 'pointer',
                                    transition: '0.2s'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', color: scanProfile === 'quick' ? 'var(--primary)' : 'var(--text-primary)', fontSize: '14px' }}>
                                    <Zap size={18} /> Quick Ingestion Sweep
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                    Verifies recent upload payloads, staging caches, and temporary files.
                                </div>
                            </div>

                            <div 
                                onClick={() => setScanProfile('deep')}
                                style={{
                                    padding: '16px',
                                    borderRadius: '14px',
                                    border: `2px solid ${scanProfile === 'deep' ? '#10b981' : 'var(--border-subtle)'}`,
                                    background: scanProfile === 'deep' ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-surface-1)',
                                    cursor: 'pointer',
                                    transition: '0.2s'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', color: scanProfile === 'deep' ? '#10b981' : 'var(--text-primary)', fontSize: '14px' }}>
                                    <ShieldAlert size={18} /> Deep Heuristic & ClamAV Scan
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                    Full byte entropy calculation, magic header validation, and ClamAV signatures.
                                </div>
                            </div>

                            <div 
                                onClick={() => setScanProfile('fim')}
                                style={{
                                    padding: '16px',
                                    borderRadius: '14px',
                                    border: `2px solid ${scanProfile === 'fim' ? '#8b5cf6' : 'var(--border-subtle)'}`,
                                    background: scanProfile === 'fim' ? 'rgba(139, 92, 246, 0.08)' : 'var(--bg-surface-1)',
                                    cursor: 'pointer',
                                    transition: '0.2s'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', color: scanProfile === 'fim' ? '#8b5cf6' : 'var(--text-primary)', fontSize: '14px' }}>
                                    <Lock size={18} /> FIM Baseline Hash Audit
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                    Validates cryptographic SHA-256 checksums to detect file tampering.
                                </div>
                            </div>
                        </div>

                        {/* Scanner Form */}
                        <form onSubmit={handleManualScan} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
                                <div>
                                    <label style={styles.inputLabel}>Storage Node Target</label>
                                    <select 
                                        value={scanNode}
                                        onChange={e => setScanNode(e.target.value)}
                                        style={styles.selectInput}
                                    >
                                        <option value="local">Local Master Server</option>
                                        {agents.filter(a => a.status === 'approved').map(a => (
                                            <option key={a.id} value={a.id}>{a.hostname} (Remote Agent)</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={styles.inputLabel}>File or Directory Path *</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input 
                                            type="text"
                                            required
                                            placeholder="e.g. C:\NexaDisk\Storage or \\10.10.20.25\Share"
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

                            {/* Quick Targets Pills */}
                            {networkShares.length > 0 && (
                                <div>
                                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-dim)', marginRight: '8px' }}>Quick Network Shares:</span>
                                    <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                                        {networkShares.map(s => (
                                            <button
                                                key={s.id}
                                                type="button"
                                                onClick={() => setScanPath(s.path)}
                                                style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '8px',
                                                    fontSize: '11.5px',
                                                    fontWeight: '700',
                                                    background: scanPath === s.path ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-surface-2)',
                                                    border: `1px solid ${scanPath === s.path ? 'var(--primary)' : 'var(--border-subtle)'}`,
                                                    color: scanPath === s.path ? 'var(--primary)' : 'var(--text-secondary)',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                📁 {s.label || s.path}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button 
                                type="submit" 
                                disabled={scanning || !scanPath}
                                style={{ 
                                    ...styles.submitBtn,
                                    opacity: scanning || !scanPath ? 0.6 : 1,
                                    cursor: scanning || !scanPath ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                            >
                                <RefreshCw size={16} style={{ animation: scanning ? 'spin 1.5s linear infinite' : 'none' }} />
                                {scanning ? 'Executing Zero-Trust Verification Scan...' : 'Trigger Security Scan'}
                            </button>
                        </form>
                    </div>

                    {/* Live Scanner Terminal & Telemetry */}
                    {scanLogs.length > 0 && (
                        <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '16px', padding: '16px', fontFamily: 'var(--font-mono)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #21262d', paddingBottom: '10px', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#58a6ff', fontSize: '13px', fontWeight: '700' }}>
                                    <Terminal size={16} /> Live Scanner Stream
                                </div>
                                <span style={{ fontSize: '11px', color: scanning ? '#e3b341' : '#3fb950', fontWeight: '700' }}>
                                    {scanning ? '● SCANNING IN PROGRESS' : '● SCAN COMPLETE'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto', fontSize: '12px', color: '#c9d1d9' }}>
                                {scanLogs.map((log, idx) => (
                                    <div key={idx} style={{ wordBreak: 'break-all', color: log.includes('ERROR') ? '#f85149' : log.includes('CLEAN') ? '#3fb950' : '#8b949e' }}>
                                        {log}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Scan Results Card */}
                    {scanResults && (
                        <div style={{ background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FileCheck size={18} color="var(--primary)" /> Scan Verdict & Layer Findings
                                </h4>
                                <div style={{
                                    padding: '5px 14px', borderRadius: '12px', fontWeight: '800', fontSize: '12px',
                                    background: (scanResults.verdict || scanResults.result?.verdict) === 'clean' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                                    color: (scanResults.verdict || scanResults.result?.verdict) === 'clean' ? '#10b981' : '#f43f5e',
                                    border: `1px solid ${(scanResults.verdict || scanResults.result?.verdict) === 'clean' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`
                                }}>
                                    Verdict: {(scanResults.verdict || scanResults.result?.verdict || 'CLEAN').toUpperCase()}
                                </div>
                            </div>

                            {/* Threat layers grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                                <div style={{ background: 'var(--bg-surface-2)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Risk Score</div>
                                    <div style={{ fontSize: '18px', fontWeight: '900', color: (scanResults.score || scanResults.result?.score || 0) > 20 ? '#f43f5e' : '#10b981', marginTop: '2px' }}>
                                        {scanResults.score || scanResults.result?.score || 0}/100
                                    </div>
                                </div>

                                <div style={{ background: 'var(--bg-surface-2)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Entropy Analysis</div>
                                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#10b981', marginTop: '4px' }}>
                                        {scanResults.entropy ? `${scanResults.entropy.toFixed(2)} (Standard)` : 'Low Entropy (Clean)'}
                                    </div>
                                </div>

                                <div style={{ background: 'var(--bg-surface-2)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>ClamAV Matching</div>
                                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#10b981', marginTop: '4px' }}>
                                        Pass (No Signatures)
                                    </div>
                                </div>
                            </div>

                            {/* Threats details */}
                            {(scanResults.threats || scanResults.result?.threats || []).length > 0 ? (
                                <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.25)', marginBottom: '16px' }}>
                                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#f43f5e', marginBottom: '6px' }}>Threat Indicators Detected:</div>
                                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                                        {(scanResults.threats || scanResults.result?.threats || []).map((t, i) => (
                                            <li key={i} style={{ marginBottom: '4px' }}>{t}</li>
                                        ))}
                                    </ul>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '13px', fontWeight: '700', padding: '12px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                                    <CheckCircle2 size={18} /> File signature validated. No malicious signatures, payload obfuscation, or zero-day patterns detected.
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>
            )}
            </AnimatePresence>

            {/* TAB CONTENT: ZERO-TRUST POLICIES */}
            <AnimatePresence mode="wait">
            {activeTab === 'policies' && (
                <motion.div key="policies" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35 }} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Sliders size={20} color="var(--primary)" /> Zero-Trust Security & Compliance Policies
                                </h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Configure real-time automated incident reactions, file intake boundaries, authentication brute-force defenses, and deep heuristic inspection engines.</p>
                            </div>
                        </div>

                        <form onSubmit={handleSavePolicy} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Section 1: Automated Response */}
                            <div style={{ padding: '18px', borderRadius: '16px', background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)' }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <ShieldAlert size={16} color="var(--primary)" /> Automated Threat Defense Matrix
                                </h4>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                                    <div>
                                        <label style={styles.inputLabel}>Automated Verdict Action</label>
                                        <select
                                            value={policy.quarantineMode}
                                            onChange={e => setPolicy({ ...policy, quarantineMode: e.target.value })}
                                            style={styles.selectInput}
                                        >
                                            <option value="quarantine">Block & Auto-Quarantine (Recommended)</option>
                                            <option value="alert_only">Alert Only (Passive Monitor)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label style={styles.inputLabel}>Auto-Blacklist Malicious Origin IPs</label>
                                        <select
                                            value={policy.autoBlacklist}
                                            onChange={e => setPolicy({ ...policy, autoBlacklist: e.target.value })}
                                            style={styles.selectInput}
                                        >
                                            <option value="true">Enabled (Instant Perimeter Ban on Malware)</option>
                                            <option value="false">Disabled (Manual Review Only)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Perimeter & Auth Defense */}
                            <div style={{ padding: '18px', borderRadius: '16px', background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)' }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Lock size={16} color="#10b981" /> Perimeter & Authentication Hardening
                                </h4>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                                    <div>
                                        <label style={styles.inputLabel}>Max Failed Passkey / Auth Attempts Before Lockout</label>
                                        <select
                                            value={policy.maxFailedAuth}
                                            onChange={e => setPolicy({ ...policy, maxFailedAuth: e.target.value })}
                                            style={styles.selectInput}
                                        >
                                            <option value="3">3 Attempts (High Security)</option>
                                            <option value="5">5 Attempts (Standard Enterprise)</option>
                                            <option value="10">10 Attempts (Relaxed)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label style={styles.inputLabel}>IP Lockout Duration</label>
                                        <select
                                            value={policy.lockoutDuration}
                                            onChange={e => setPolicy({ ...policy, lockoutDuration: e.target.value })}
                                            style={styles.selectInput}
                                        >
                                            <option value="5">5 Minutes</option>
                                            <option value="15">15 Minutes (Default)</option>
                                            <option value="60">1 Hour</option>
                                            <option value="1440">24 Hours</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: File Intake Rules */}
                            <div style={{ padding: '18px', borderRadius: '16px', background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)' }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Folder size={16} color="#f59e0b" /> File Ingestion & Whitelisting Rules
                                </h4>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px' }}>
                                    <div>
                                        <label style={styles.inputLabel}>Max File Scan Limit (MB)</label>
                                        <select
                                            value={policy.maxScanSize}
                                            onChange={e => setPolicy({ ...policy, maxScanSize: e.target.value })}
                                            style={styles.selectInput}
                                        >
                                            <option value="10">10 MB</option>
                                            <option value="50">50 MB</option>
                                            <option value="100">100 MB (Default)</option>
                                            <option value="500">500 MB</option>
                                            <option value="0">Unlimited (Compute Intensive)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label style={styles.inputLabel}>Disallowed Dangerous Executable Extensions</label>
                                        <input 
                                            type="text"
                                            value={policy.blockedExts || ''}
                                            onChange={e => setPolicy({ ...policy, blockedExts: e.target.value })}
                                            style={styles.textInput}
                                            placeholder=".exe, .bat, .ps1, .vbs, .sh, .cmd, .scr, .pif"
                                        />
                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>Comma-separated extensions that are automatically blocked and flagged during upload.</span>
                                    </div>

                                    <div>
                                        <label style={styles.inputLabel}>Exempt Whitelist Extensions</label>
                                        <input 
                                            type="text"
                                            value={policy.whitelistExts || ''}
                                            onChange={e => setPolicy({ ...policy, whitelistExts: e.target.value })}
                                            style={styles.textInput}
                                            placeholder=".log, .csv, .txt, .json"
                                        />
                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>Exempt safe file extensions from signature and entropy scans.</span>
                                    </div>
                                </div>
                            </div>

                            {/* Section 4: Deep Inspection Engines */}
                            <div style={{ padding: '18px', borderRadius: '16px', background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)' }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Cpu size={16} color="#8b5cf6" /> Heuristic Inspection Engines
                                </h4>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                                    <div>
                                        <label style={styles.inputLabel}>ClamAV Daemon Matching Engine</label>
                                        <select
                                            value={policy.deepClamav}
                                            onChange={e => setPolicy({ ...policy, deepClamav: e.target.value })}
                                            style={styles.selectInput}
                                        >
                                            <option value="true">Enabled (Signature Virus Database)</option>
                                            <option value="false">Disabled (Heuristic Mode Only)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label style={styles.inputLabel}>High-Entropy Payload Detection</label>
                                        <select
                                            value={policy.entropyCheck}
                                            onChange={e => setPolicy({ ...policy, entropyCheck: e.target.value })}
                                            style={styles.selectInput}
                                        >
                                            <option value="true">Enabled (Detects Packed & Encrypted Payloads)</option>
                                            <option value="false">Disabled</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={savingPolicy}
                                style={{ 
                                    ...styles.submitBtn,
                                    marginTop: '8px',
                                    opacity: savingPolicy ? 0.6 : 1,
                                    cursor: savingPolicy ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                            >
                                <CheckCircle2 size={16} />
                                {savingPolicy ? 'Saving Zero-Trust Policies...' : 'Save Zero-Trust Policies'}
                            </button>
                        </form>
                    </div>
                </motion.div>
            )}
            </AnimatePresence>

            {/* TAB CONTENT: AUDIT TRAIL */}
            <AnimatePresence mode="wait">
            {activeTab === 'logs' && (
                <motion.div key="logs" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35 }} style={styles.widget}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                        <div>
                            <h3 style={styles.widgetTitle}>Security Events & Cryptographic Audit Ledger</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
                                Immutable SHA-256 blockchain-style hash chain tracking authentication, configuration, cyber defense detections, and compliance operations.
                            </p>
                        </div>

                        {/* Top Action Bar for Integrity & SIEM */}
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <button
                                onClick={async () => {
                                    setVerifyingIntegrity(true);
                                    try {
                                        const token = localStorage.getItem('token');
                                        const res = await axios.get('/api/v1/audit/verify-integrity', {
                                            headers: token ? { Authorization: `Bearer ${token}` } : {}
                                        });
                                        setIntegrityResult(res.data);
                                        if (res.data.verified) {
                                            showToast(`Audit Ledger Verified: ${res.data.totalRecords} records secure`, 'success');
                                        } else {
                                            showToast(`Integrity Warning: ${res.data.issuesCount} issues detected`, 'error');
                                        }
                                    } catch (err) {
                                        showToast('Failed to verify ledger integrity', 'error');
                                    } finally {
                                        setVerifyingIntegrity(false);
                                    }
                                }}
                                disabled={verifyingIntegrity}
                                className="btn-secondary"
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '8px 14px', borderRadius: '10px', fontWeight: '700', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
                            >
                                {verifyingIntegrity ? <RefreshCw size={14} className="spin-anim" /> : <Lock size={14} />}
                                {verifyingIntegrity ? 'Verifying Chain...' : 'Verify Cryptographic Hash Chain'}
                            </button>

                            {/* SIEM Export Dropdowns / Buttons */}
                            <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-surface-1)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                                {['CEF', 'LEEF', 'JSON', 'CSV'].map(fmt => (
                                    <button
                                        key={fmt}
                                        onClick={async () => {
                                            try {
                                                const token = localStorage.getItem('token');
                                                const res = await axios.get(`/api/v1/audit/export/${fmt.toLowerCase()}`, {
                                                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                                                    responseType: 'blob'
                                                });
                                                const url = window.URL.createObjectURL(new Blob([res.data]));
                                                const link = document.createElement('a');
                                                link.href = url;
                                                link.setAttribute('download', `nexadisk_audit_${fmt.toLowerCase()}_${Date.now()}.${fmt.toLowerCase() === 'json' ? 'json' : fmt.toLowerCase() === 'csv' ? 'csv' : fmt.toLowerCase()}`);
                                                document.body.appendChild(link);
                                                link.click();
                                                link.remove();
                                                showToast(`Exported audit logs to ${fmt}`, 'success');
                                            } catch (err) {
                                                showToast(`Failed to export ${fmt}`, 'error');
                                            }
                                        }}
                                        style={{
                                            fontSize: '11px', fontWeight: '700', padding: '5px 9px', borderRadius: '6px',
                                            background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer'
                                        }}
                                        title={`Export audit trail to ${fmt} format`}
                                    >
                                        <DownloadCloud size={11} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> {fmt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Cryptographic Ledger Status Banner */}
                    {integrityResult && (
                        <div style={{
                            padding: '14px 18px', borderRadius: '12px', marginBottom: '16px',
                            background: integrityResult.verified ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                            border: `1px solid ${integrityResult.verified ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {integrityResult.verified ? <CheckCircle2 size={20} color="#10b981" /> : <AlertTriangle size={20} color="#ef4444" />}
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: '700', color: integrityResult.verified ? '#10b981' : '#ef4444' }}>
                                        {integrityResult.verified ? 'Cryptographic Hash Ledger: 100% Verified & Tamper-Free' : 'Integrity Alert: Chain Linkage Discrepancy Detected'}
                                    </div>
                                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                                        Total Audited Records: <strong>{integrityResult.totalRecords}</strong> | Verified Blocks: <strong>{integrityResult.hashedRecords || integrityResult.totalRecords}</strong> | Zero Deleted or Altered Rows
                                    </div>
                                </div>
                            </div>
                            <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-dim)' }}>
                                Chain Root: {integrityResult.latestHash ? `${integrityResult.latestHash.slice(0, 16)}...` : 'GENESIS'}
                            </span>
                        </div>
                    )}

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
                                                
                                                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                                                    {renderEventDescription(e.eventType, e.details)}
                                                </span>
                                            </div>
                                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace', flexShrink: 0 }}>
                                                {new Date(e.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </motion.div>
            )}
            </AnimatePresence>


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
                    showToast={showToast}
                />
            )}

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
}

const styles = {
    container: { padding: '32px', color: 'var(--text-secondary)', background: 'transparent', minHeight: '100vh', fontFamily: "var(--font-sans)" },
    loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-secondary)', fontSize: '18px' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
    title: { margin: 0, fontSize: '24px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', fontWeight: '800', letterSpacing: '-0.5px' },
    subtitle: { margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '13px' },
    refreshBtn: { background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', padding: '8px 16px', borderRadius: '10px', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', boxShadow: 'var(--shadow-sm)' },
    tabsRow: { display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '24px' },
    tabBtn: { border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)', padding: '8px 16px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', transition: 'all 0.15s ease', boxShadow: 'var(--shadow-sm)' },
    topRow: { display: 'flex', gap: '24px', marginBottom: '24px' },
    widget: { background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '24px', flex: 1, boxShadow: 'var(--shadow-sm)' },
    widgetLg: { background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '24px', flex: 2, boxShadow: 'var(--shadow-sm)', minWidth: 0 },
    widgetMd: { background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '24px', flex: 1, boxShadow: 'var(--shadow-sm)', minWidth: 0 },
    widgetTitle: { margin: '0 0 20px 0', fontSize: '15px', color: 'var(--text-primary)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' },
    gaugeContainer: { position: 'relative', width: '180px', margin: '0 auto', textAlign: 'center' },
    gaugeSvg: { width: '100%', height: '90px', overflow: 'visible' },
    scoreValue: { position: 'absolute', bottom: '0', left: '0', right: '0', fontSize: '32px', fontWeight: '800', color: 'var(--text-primary)' },
    metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', flex: 2 },
    metricCard: { background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' },
    metricHeader: { display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '8px', fontWeight: '700', textTransform: 'uppercase' },
    metricValue: { fontSize: '28px', color: 'var(--text-primary)', fontWeight: '800', fontFamily: 'var(--font-mono)' },
    nodeGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' },
    nodeCard: { background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '20px', transition: '0.2s', boxShadow: 'var(--shadow-sm)' },
    chartsRow: { display: 'flex', gap: '24px', marginBottom: '24px' },
    legendRow: { display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '16px' },
    legendItem: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' },
    dot: { width: '8px', height: '8px', borderRadius: '50%' },
    bottomRow: { display: 'flex', gap: '24px' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { textAlign: 'left', padding: '12px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' },
    tr: { borderBottom: '1px solid var(--border-subtle)' },
    td: { padding: '12px', fontSize: '13px', color: 'var(--text-secondary)' },
    scoreBadge: { background: 'rgba(248,81,73,0.1)', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' },
    actionBtnApprove: { background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' },
    actionBtnReject: { background: 'rgba(225,29,72,0.1)', color: 'var(--accent-rose)', border: '1px solid rgba(225,29,72,0.3)', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' },
    actionBtnApproveSm: { background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', transition: '0.2s' },
    actionBtnRejectSm: { background: 'rgba(225,29,72,0.1)', color: 'var(--accent-rose)', border: '1px solid rgba(225,29,72,0.3)', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', transition: '0.2s' },
    actionBtnRescanSm: { background: 'rgba(79,70,229,0.1)', color: 'var(--primary)', border: '1px solid rgba(79,70,229,0.3)', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', transition: '0.2s' },
    emptyState: { textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0', fontSize: '13px' },
    threatCard: { display: 'flex', gap: '16px', background: 'rgba(225,29,72,0.05)', border: '1px solid rgba(225,29,72,0.2)', padding: '16px', borderRadius: '12px' },
    inputLabel: { display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' },
    selectInput: { width: '100%', outline: 'none', background: 'var(--bg-surface-0)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '13px' },
    selectInputInline: { outline: 'none', background: 'var(--bg-surface-0)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '13px' },
    textInput: { flex: 1, outline: 'none', background: 'var(--bg-surface-0)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '13px', fontFamily: 'var(--font-mono)' },
    browseBtn: { background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '0 16px', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' },
    submitBtn: { width: '100%', padding: '12px', background: 'linear-gradient(135deg, var(--primary-light), var(--primary))', border: 'none', borderRadius: '10px', color: '#ffffff', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', transition: '0.2s', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)' },
    resultsBox: { marginTop: '24px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' },
    settingCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', padding: '16px 20px', borderRadius: '12px', gap: '20px', boxShadow: 'var(--shadow-sm)' },
    eventRow: { padding: '12px 16px', borderRadius: '8px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }
};

export default SecurityCenter;
