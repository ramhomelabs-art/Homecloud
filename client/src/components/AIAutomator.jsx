import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
    Sparkles, Cpu, Terminal, Plus, Trash2, Play, ArrowRight, CheckCircle2, 
    XCircle, Loader, Folder, RefreshCw, FileText, ToggleLeft, ToggleRight, Eye, X, CornerDownRight,
    Search, Archive, Tags, Layers
} from 'lucide-react';
import FolderPickerModal from './modals/FolderPickerModal';

const API_BASE = '/api';

const AIAutomator = ({ agents, showToast }) => {
    const [rules, setRules] = useState([]);
    const [logs, setLogs] = useState([]);
    const [stats, setStats] = useState({
        totalRules: 0,
        activeRules: 0,
        totalRuns: 0,
        totalFiles: 0
    });
    const [loadingRules, setLoadingRules] = useState(true);
    const [loadingLogs, setLoadingLogs] = useState(true);
    const [showRuleModal, setShowRuleModal] = useState(false);
    
    // Rule Creation State
    const [ruleName, setRuleName] = useState('');
    const [triggerFolder, setTriggerFolder] = useState('');
    const [aiInstruction, setAiInstruction] = useState('');
    const [actionType, setActionType] = useState('organize');
    const [schedule, setSchedule] = useState('on_upload');
    const [submittingRule, setSubmittingRule] = useState(false);

    // Dry Run Toggle
    const [dryRun, setDryRun] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [pickerContext, setPickerContext] = useState('targetPath'); // 'targetPath' | 'triggerFolder'
    
    // Command Palette target path
    const [targetPath, setTargetPath] = useState('d:\\opt\\nexadisk\\mnt');

    // Copilot Console State
    const [copilotCommand, setCopilotCommand] = useState('');
    const [terminalLines, setTerminalLines] = useState([
        { text: 'NexaDisk AI Copilot v1.1.0 Online.', type: 'info', timestamp: new Date().toLocaleTimeString() },
        { text: 'Dry-run preview is available. Toggle to test commands safely.', type: 'info', timestamp: new Date().toLocaleTimeString() }
    ]);
    const [isThinking, setIsThinking] = useState(false);
    const terminalEndRef = useRef(null);

    // Expanded log state for Audit Center
    const [expandedLogId, setExpandedLogId] = useState(null);

    const QUICK_PROMPTS = [
        { label: 'Organize Files', query: 'organize files in', color: 'var(--accent-cyan)', icon: Folder, desc: 'Sort files into category folders' },
        { label: 'Deduplicate', query: 'deduplicate files in', color: 'var(--accent-gold)', icon: Cpu, desc: 'Find and delete exact file duplicates' },
        { label: 'Compress Old', query: 'compress files in', color: '#8250df', icon: Archive, desc: 'Zip files older than 30 days' },
        { label: 'Tag & Label', query: 'tag files in', color: '#ff7b72', icon: Tags, desc: 'Prefix files with type tags' },
        { label: 'Flatten Folder', query: 'flatten folder', color: '#3fb950', icon: Layers, desc: 'Collapse subfolders to root' },
        { label: 'Find Large', query: 'find large files in', color: '#bc8cff', icon: Search, desc: 'List files exceeding 50 MB' },
        { label: 'Gen Report', query: 'report files in', color: '#58a6ff', icon: FileText, desc: 'Create Markdown inventory file' },
        { label: 'Clean Junk', query: 'clean files in', color: '#f2c94c', icon: Trash2, desc: 'Delete logs, cache and temp files' },
        { label: 'Rename Shots', query: 'rename screenshots in', color: '#ff7b72', icon: Sparkles, desc: 'Rename screenshots by date' },
        { label: 'Custom Request', query: '', color: 'var(--text-secondary)', icon: Terminal, desc: 'Run custom natural language command' }
    ];

    const fetchRules = async () => {
        setLoadingRules(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.get(`${API_BASE}/ai/rules`, { headers });
            setRules(res.data || []);
        } catch (err) {
            console.error('Failed to fetch AI rules', err);
            showToast('Failed to fetch AI rules', 'error');
        } finally {
            setLoadingRules(false);
        }
    };

    const fetchLogs = async () => {
        setLoadingLogs(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.get(`${API_BASE}/ai/logs`, { headers });
            setLogs(res.data || []);
        } catch (err) {
            console.error('Failed to fetch AI logs', err);
            showToast('Failed to fetch AI logs', 'error');
        } finally {
            setLoadingLogs(false);
        }
    };

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.get(`${API_BASE}/ai/stats`, { headers });
            setStats(res.data || { totalRules: 0, activeRules: 0, totalRuns: 0, totalFiles: 0 });
        } catch (err) {
            console.error('Failed to fetch AI stats', err);
        }
    };

    useEffect(() => {
        fetchRules();
        fetchLogs();
        fetchStats();
    }, []);

    useEffect(() => {
        if (terminalEndRef.current) {
            terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [terminalLines]);

    // Update rule modal instruction suggestion based on action type & path
    useEffect(() => {
        if (!triggerFolder) return;
        let suggestion = '';
        switch(actionType) {
            case 'organize':
                suggestion = `organize files in ${triggerFolder}`;
                break;
            case 'clean':
                suggestion = `clean temp files in ${triggerFolder}`;
                break;
            case 'deduplicate':
                suggestion = `deduplicate files in ${triggerFolder}`;
                break;
            case 'compress':
                suggestion = `compress files in ${triggerFolder}`;
                break;
            case 'tag':
                suggestion = `tag files in ${triggerFolder}`;
                break;
            case 'flatten':
                suggestion = `flatten folder ${triggerFolder}`;
                break;
            case 'find_large':
                suggestion = `find large files in ${triggerFolder}`;
                break;
            case 'report':
                suggestion = `report files in ${triggerFolder}`;
                break;
            case 'rename':
                suggestion = `rename screenshots in ${triggerFolder}`;
                break;
            default:
                suggestion = `organize files in ${triggerFolder}`;
        }
        setAiInstruction(suggestion);
    }, [actionType, triggerFolder]);

    const handleCreateRule = async (e) => {
        e.preventDefault();
        if (!ruleName || !triggerFolder || !aiInstruction) {
            showToast('Please fill all required fields', 'error');
            return;
        }

        setSubmittingRule(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post(`${API_BASE}/ai/rules`, {
                name: ruleName,
                triggerFolder,
                aiInstruction,
                actionType,
                schedule
            }, { headers });

            showToast('Automation Rule registered successfully', 'success');
            setShowRuleModal(false);
            setRuleName('');
            setTriggerFolder('');
            setAiInstruction('');
            setActionType('organize');
            setSchedule('on_upload');
            fetchRules();
            fetchStats();
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to create AI rule', 'error');
        } finally {
            setSubmittingRule(false);
        }
    };

    const handleToggleRule = async (id, currentActive) => {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post(`${API_BASE}/ai/rules/${id}/toggle`, {}, { headers });
            showToast(`Rule ${!currentActive ? 'activated' : 'deactivated'}`, 'success');
            fetchRules();
            fetchStats();
        } catch (err) {
            showToast('Failed to toggle automation rule status', 'error');
        }
    };

    const handleDeleteRule = async (id, name) => {
        if (!window.confirm(`Permanently delete automation rule "${name}"?`)) return;
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.delete(`${API_BASE}/ai/rules/${id}`, { headers });
            showToast(`Deleted rule "${name}"`, 'success');
            fetchRules();
            fetchStats();
        } catch (err) {
            showToast('Failed to delete rule', 'error');
        }
    };

    const printToTerminal = (text, type = 'info') => {
        setTerminalLines(prev => [...prev, { text, type, timestamp: new Date().toLocaleTimeString() }]);
    };

    const runCopilotCommand = async (commandString) => {
        if (!commandString.trim()) return;
        setIsThinking(true);
        setTerminalLines([]);
        printToTerminal(`Executing Instruction: "${commandString}"${dryRun ? ' [DRY-RUN]' : ''}`, 'command');
        printToTerminal(`Analyzing directory structure...`, 'scanning');

        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.post(`${API_BASE}/ai/copilot`, { 
                command: commandString,
                dryRun: dryRun
            }, { headers });
            
            const { logs: flowLogs, filesAffected, status } = res.data;

            // Simulating real-time output stream of thinking logs
            let currentIdx = 0;
            const printNextLog = () => {
                if (currentIdx < flowLogs.length) {
                    const rawLine = flowLogs[currentIdx];
                    let lineType = 'info';
                    if (rawLine.includes('[SCAN]') || rawLine.includes('[PROCESS]')) lineType = 'scanning';
                    else if (rawLine.includes('[ERROR]') || rawLine.includes('[Failed]') || rawLine.includes('Error')) lineType = 'error';
                    else if (rawLine.includes('[MOVE]') || rawLine.includes('[DELETE]') || rawLine.includes('[RENAME]') || rawLine.includes('[CREATE]') || rawLine.includes('[COMPLETED]')) lineType = 'success';
                    
                    printToTerminal(rawLine, lineType);
                    currentIdx++;
                    setTimeout(printNextLog, 150);
                } else {
                    printToTerminal(`Process completed. Status: ${status}. ${filesAffected.length} file(s) affected.`, 'success');
                    setIsThinking(false);
                    fetchLogs();
                    fetchStats();
                }
            };

            printNextLog();

        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message || 'Operation failed';
            printToTerminal(`[Error] Execution aborted: ${errorMsg}`, 'error');
            setIsThinking(false);
            fetchLogs();
            fetchStats();
        }
    };

    const handleRunRuleNow = async (id, name) => {
        setIsThinking(true);
        setTerminalLines([]);
        printToTerminal(`Manually triggering rule: "${name}"`, 'command');
        printToTerminal(`Connecting to automation engine...`, 'scanning');

        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.post(`${API_BASE}/ai/rules/${id}/run`, {}, { headers });
            
            const { logs: flowLogs, filesAffected, status } = res.data;

            let currentIdx = 0;
            const printNextLog = () => {
                if (currentIdx < flowLogs.length) {
                    const rawLine = flowLogs[currentIdx];
                    let lineType = 'info';
                    if (rawLine.includes('[SCAN]') || rawLine.includes('[PROCESS]')) lineType = 'scanning';
                    else if (rawLine.includes('[ERROR]') || rawLine.includes('[Failed]') || rawLine.includes('Error')) lineType = 'error';
                    else if (rawLine.includes('[MOVE]') || rawLine.includes('[DELETE]') || rawLine.includes('[RENAME]') || rawLine.includes('[CREATE]') || rawLine.includes('[COMPLETED]')) lineType = 'success';
                    
                    printToTerminal(rawLine, lineType);
                    currentIdx++;
                    setTimeout(printNextLog, 150);
                } else {
                    printToTerminal(`Rule run completed. Status: ${status}. ${filesAffected.length} file(s) affected.`, 'success');
                    setIsThinking(false);
                    fetchLogs();
                    fetchStats();
                }
            };

            printNextLog();

        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message || 'Operation failed';
            printToTerminal(`[Error] Execution aborted: ${errorMsg}`, 'error');
            setIsThinking(false);
            fetchLogs();
            fetchStats();
        }
    };

    const handleCopilotSubmit = (e) => {
        e.preventDefault();
        if (!copilotCommand.trim() || isThinking) return;
        const cmd = copilotCommand;
        setCopilotCommand('');
        runCopilotCommand(cmd);
    };

    const triggerQuickPrompt = (prompt) => {
        if (isThinking) return;
        runCopilotCommand(prompt);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'Never';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'Never';
        return d.toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface-2)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-dim)' }}>
                <div>
                    <h2 style={{ fontSize: '24px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Sparkles size={24} color="var(--accent-cyan)" style={{ filter: 'drop-shadow(0 0 8px var(--accent-cyan-glow))' }} />
                        AI Automation Center
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>Configure folder triggers or execute natural language workflows across nodes.</p>
                </div>
                <button className="btn-primary" onClick={() => setShowRuleModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Plus size={16} />
                    <span>Create Auto Rule</span>
                </button>
            </div>

            {/* Stats bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                {[
                    { label: 'Active Rules', value: stats.activeRules, total: stats.totalRules, icon: Cpu, color: 'var(--accent-cyan)' },
                    { label: 'Total Runs', value: stats.totalRuns, icon: RefreshCw, color: 'var(--accent-gold)' },
                    { label: 'Files Impacted', value: stats.totalFiles, icon: FileText, color: '#3fb950' },
                    { label: 'Engine Status', value: 'Active', icon: Sparkles, color: 'var(--accent-cyan)', sub: 'All Systems Online' }
                ].map((item, idx) => {
                    const IconComponent = item.icon;
                    return (
                        <div key={idx} className="st-card shadow-premium" style={{
                            padding: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            background: 'var(--bg-surface-2)',
                            border: '1px solid var(--border-dim)',
                            borderRadius: '12px'
                        }}>
                            <div style={{
                                padding: '10px',
                                borderRadius: '10px',
                                background: `rgba(${idx === 1 ? '242, 201, 76' : idx === 2 ? '63, 185, 80' : '0, 242, 255'}, 0.05)`,
                                color: item.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <IconComponent size={20} />
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                                    {item.label}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
                                    <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                        {item.value}
                                    </span>
                                    {item.total !== undefined && (
                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                            / {item.total}
                                        </span>
                                    )}
                                    {item.sub && (
                                        <span style={{ fontSize: '11px', color: '#3fb950', fontWeight: '700', marginLeft: '4px' }}>
                                            {item.sub}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Core workspace grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
                
                {/* Left Panel: Copilot Console */}
                <div className="st-card shadow-premium" style={{ display: 'flex', flexDirection: 'column', height: '620px', padding: '20px', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <Terminal size={16} color="var(--accent-gold)" />
                            AI Copilot Console
                        </h3>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            {isThinking && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)', fontSize: '12px', fontWeight: '700' }}>
                                    <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                                    <span>Thinking...</span>
                                </div>
                            )}

                            {/* Dry Run Toggle */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }} onClick={() => setDryRun(!dryRun)}>
                                <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: dryRun ? 'var(--accent-gold)' : '#8b949e' }}>
                                    Dry-Run Preview
                                </span>
                                {dryRun ? (
                                    <ToggleRight size={24} color="var(--accent-gold)" />
                                ) : (
                                    <ToggleLeft size={24} color="#8b949e" />
                                )}
                            </div>

                            {/* Clear Terminal */}
                            <button 
                                onClick={() => setTerminalLines([])}
                                style={{
                                    background: 'var(--bg-surface-2)',
                                    border: '1px solid var(--border-dim)',
                                    borderRadius: '6px',
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                                onMouseLeave={e => e.currentTarget.style.color = '#8b949e'}
                            >
                                Clear
                            </button>
                        </div>
                    </div>

                    {/* Target Path Bar for Quick Commands */}
                    <div style={{
                        background: 'var(--bg-surface-2)',
                        border: '1px solid var(--border-dim)',
                        borderRadius: '12px',
                        padding: '12px',
                        marginBottom: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Folder size={12} color="var(--accent-cyan)" />
                                Target Directory for Command Palette
                            </label>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Click prompt grid to run</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input 
                                className="m-input" 
                                value={targetPath}
                                onChange={e => setTargetPath(e.target.value)}
                                placeholder="e.g. d:\opt\nexadisk\mnt"
                                style={{ flex: 1, outline: 'none', height: '32px', fontSize: '12px' }}
                            />
                            <button
                                className="btn-secondary"
                                style={{ height: '32px', padding: '0 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', borderRadius: '8px', cursor: 'pointer' }}
                                onClick={() => {
                                    setPickerContext('targetPath');
                                    setShowPicker(true);
                                }}
                            >
                                <Folder size={12} /> Browse
                            </button>
                        </div>
                    </div>

                    {/* Grid of 10 Quick Prompts */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                        gap: '8px',
                        marginBottom: '16px'
                    }}>
                        {QUICK_PROMPTS.map((p, idx) => {
                            const IconComponent = p.icon;
                            return (
                                <button
                                    key={idx}
                                    disabled={isThinking}
                                    onClick={() => {
                                        if (p.label === 'Custom Request') {
                                            const consoleInput = document.getElementById('copilot-console-input');
                                            if (consoleInput) consoleInput.focus();
                                        } else {
                                            triggerQuickPrompt(`${p.query} ${targetPath}`);
                                        }
                                    }}
                                    style={{
                                        background: 'var(--bg-surface-2)',
                                        border: '1px solid var(--border-dim)',
                                        borderRadius: '8px',
                                        padding: '6px 10px',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s',
                                        outline: 'none',
                                        height: '38px',
                                        boxSizing: 'border-box'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                        e.currentTarget.style.borderColor = p.color;
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                                        e.currentTarget.style.borderColor = 'var(--border-dim)';
                                        e.currentTarget.style.transform = 'none';
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', color: p.color }}>
                                        <IconComponent size={14} />
                                    </div>
                                    <span style={{ fontWeight: '600', fontSize: '11px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Console Output Screen */}
                    <div style={{ 
                        flex: 1, 
                        background: '#040711', 
                        border: '1px solid var(--border-subtle)', 
                        borderRadius: '12px', 
                        padding: '16px', 
                        fontFamily: 'monospace', 
                        fontSize: '11px', 
                        overflowY: 'auto', 
                        lineHeight: '1.6',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                    }}>
                        {terminalLines.map((line, idx) => {
                            let color = '#8b949e'; // default info
                            if (line.type === 'command') {
                                color = '#fff';
                            } else if (line.type === 'scanning') {
                                color = 'var(--accent-cyan)';
                            } else if (line.type === 'success') {
                                color = '#3fb950';
                            } else if (line.type === 'error') {
                                color = '#f85149';
                            }

                            // Check content prefix overrides
                            const t = line.text;
                            if (t.includes('[SCAN]') || t.includes('[PROCESS]') || t.includes('[TARGET]')) {
                                color = 'var(--accent-cyan)';
                            } else if (t.includes('[MOVE]') || t.includes('[RENAME]') || t.includes('[CREATE]') || t.includes('[KEEP]') || t.includes('[REPORT]') || t.includes('[COMPLETED]')) {
                                color = '#3fb950';
                            } else if (t.includes('[DELETE]') || t.includes('[ERROR]')) {
                                color = '#f85149';
                            } else if (t.includes('[SKIP]') || t.includes('[INFO]') || t.includes('[WARN]') || t.includes('[WOULD')) {
                                color = 'var(--accent-gold)';
                            }

                            const isDryRunOutput = t.includes('[DRY-RUN]') || t.includes('[WOULD') || dryRun;
                            if (isDryRunOutput && line.type !== 'error' && line.type !== 'command') {
                                color = 'var(--accent-gold)'; // amber
                            }

                            return (
                                <div key={idx} style={{ color, display: 'flex', gap: '8px' }}>
                                    <span style={{ color: '#484f58', userSelect: 'none' }}>[{line.timestamp || new Date().toLocaleTimeString()}]</span>
                                    <div style={{ flex: 1 }}>
                                        {line.type === 'command' && <span style={{ color: 'var(--accent-gold)', marginRight: '6px' }}>&gt;</span>}
                                        {line.text}
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={terminalEndRef} />
                    </div>

                    {/* Prompt input field */}
                    <form onSubmit={handleCopilotSubmit} style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                        <input 
                            id="copilot-console-input"
                            className="m-input" 
                            disabled={isThinking}
                            placeholder={isThinking ? "Executing workflow instruction..." : "Type command, e.g. Organize C:\\downloads"} 
                            value={copilotCommand}
                            onChange={e => setCopilotCommand(e.target.value)}
                            style={{ flex: 1, outline: 'none' }}
                        />
                        <button type="submit" className="btn-primary" disabled={isThinking || !copilotCommand.trim()} style={{ height: '38px', width: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ArrowRight size={16} />
                        </button>
                    </form>
                </div>

                {/* Right Panel: Auto Rules Trigger List */}
                <div className="st-card shadow-premium" style={{ display: 'flex', flexDirection: 'column', height: '620px', padding: '20px' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <Folder size={16} color="var(--accent-cyan)" />
                        Automation Rules
                    </h3>

                    {loadingRules ? (
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flex: 1, gap: '10px' }}>
                            <Loader size={24} style={{ animation: 'spin 1.5s linear infinite' }} />
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Reading registered rules...</span>
                        </div>
                    ) : rules.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flex: 1, opacity: 0.4, textAlign: 'center', padding: '20px' }}>
                            <Cpu size={36} style={{ marginBottom: '12px' }} />
                            <p style={{ fontSize: '13px', fontWeight: '700' }}>No Active Trigger Rules</p>
                            <p style={{ fontSize: '11px', marginTop: '4px' }}>Click "Create Auto Rule" to define folder-based triggers (e.g. automatically route docs/images).</p>
                        </div>
                    ) : (
                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {rules.map((rule) => (
                                <div key={rule.id} style={{ 
                                    background: 'var(--bg-surface-2)', 
                                    border: '1px solid var(--border-dim)', 
                                    borderRadius: '12px', 
                                    padding: '14px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0, 242, 255, 0.2)'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-dim)'}
                                >
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, marginRight: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                            <span style={{ fontWeight: '700', fontSize: '13px' }}>{rule.name}</span>
                                            <span style={{ 
                                                fontSize: '9px', 
                                                padding: '1px 6px', 
                                                borderRadius: '4px', 
                                                background: rule.actionType === 'route' ? 'rgba(0,242,255,0.1)' : 'rgba(242, 201, 76, 0.1)', 
                                                color: rule.actionType === 'route' ? 'var(--accent-cyan)' : 'var(--accent-gold)',
                                                fontWeight: '800',
                                                textTransform: 'uppercase'
                                            }}>
                                                {rule.actionType}
                                            </span>
                                            <span style={{ 
                                                fontSize: '9px', 
                                                padding: '1px 6px', 
                                                borderRadius: '4px', 
                                                background: 'var(--bg-surface-2)', 
                                                color: 'var(--text-secondary)',
                                                fontWeight: '700',
                                                textTransform: 'uppercase'
                                            }}>
                                                {rule.schedule === 'on_upload' ? '⚡ upload' : `⏰ ${rule.schedule}`}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                            Folder: <code style={{ color: 'var(--text-primary)' }}>{rule.triggerFolder}</code>
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <CornerDownRight size={10} />
                                            <span>Instruction: {rule.aiInstruction}</span>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        {/* Run Now Button */}
                                        <button 
                                            disabled={isThinking}
                                            onClick={() => handleRunRuleNow(rule.id, rule.name)}
                                            style={{ 
                                                background: 'rgba(0, 242, 255, 0.08)', 
                                                border: '1px solid rgba(0, 242, 255, 0.2)', 
                                                borderRadius: '6px', 
                                                padding: '5px 8px',
                                                cursor: 'pointer',
                                                color: 'var(--accent-cyan)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                fontSize: '11px',
                                                fontWeight: '700',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.background = 'rgba(0, 242, 255, 0.15)';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.background = 'rgba(0, 242, 255, 0.08)';
                                            }}
                                        >
                                            <Play size={10} fill="var(--accent-cyan)" />
                                            <span>Run</span>
                                        </button>

                                        {/* Toggle Active switch */}
                                        <button 
                                            onClick={() => handleToggleRule(rule.id, !!rule.active)}
                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                                        >
                                            {!!rule.active ? (
                                                <ToggleRight size={28} color="var(--accent-cyan)" />
                                            ) : (
                                                <ToggleLeft size={28} color="#8b949e" />
                                            )}
                                        </button>

                                        {/* Delete Button */}
                                        <button 
                                            onClick={() => handleDeleteRule(rule.id, rule.name)}
                                            style={{ 
                                                background: 'rgba(235, 87, 87, 0.08)', 
                                                border: '1px solid rgba(235, 87, 87, 0.2)', 
                                                borderRadius: '6px', 
                                                padding: '6px',
                                                cursor: 'pointer',
                                                color: '#eb5757',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(235, 87, 87, 0.15)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(235, 87, 87, 0.08)'}
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Audit Center & History logs */}
            <div className="st-card shadow-premium" style={{ padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <RefreshCw size={16} color="var(--accent-gold)" />
                    Workflow Audit Center
                </h3>

                {loadingLogs ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
                        <Loader size={24} style={{ animation: 'spin 1.5s linear infinite', marginRight: '10px' }} />
                        <span>Fetching audit logs...</span>
                    </div>
                ) : logs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', opacity: 0.4 }}>
                        <FileText size={36} style={{ marginBottom: '12px' }} />
                        <p style={{ fontWeight: '700', fontSize: '13px' }}>No execution logs recorded yet</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {logs.map((log) => {
                            const isExpanded = expandedLogId === log.id;
                            const isSuccess = log.status === 'Success';
                            
                            return (
                                <div key={log.id} style={{ 
                                    background: 'var(--bg-surface-2)', 
                                    border: '1px solid var(--border-dim)', 
                                    borderRadius: '12px', 
                                    overflow: 'hidden'
                                }}>
                                    {/* Collapsible header */}
                                    <div 
                                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                        style={{ 
                                            padding: '14px 16px', 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                            userSelect: 'none'
                                        }}
                                    >
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>
                                                {log.command}
                                            </span>
                                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                Triggered: {formatDate(log.created_at)}
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <span style={{ 
                                                fontSize: '11px', 
                                                padding: '2px 8px', 
                                                borderRadius: '4px', 
                                                background: isSuccess ? 'rgba(63, 185, 80, 0.15)' : 'rgba(248, 81, 73, 0.15)',
                                                color: isSuccess ? '#3fb950' : '#f85149',
                                                fontWeight: '800'
                                            }}>
                                                {log.status}
                                            </span>
                                            <Eye size={16} color="#8b949e" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                                        </div>
                                    </div>

                                    {/* Expanded log details */}
                                    {isExpanded && (
                                        <div style={{ 
                                            padding: '16px', 
                                            borderTop: '1px solid var(--border-dim)', 
                                            background: '#020409',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '12px'
                                        }}>
                                            {/* Thinking logs text */}
                                            <div>
                                                <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>Thinking Steps</div>
                                                <pre style={{ 
                                                    background: 'var(--bg-surface-2)', 
                                                    padding: '12px', 
                                                    borderRadius: '8px', 
                                                    fontFamily: 'monospace', 
                                                    fontSize: '11px', 
                                                    color: 'var(--text-secondary)',
                                                    whiteSpace: 'pre-wrap',
                                                    margin: 0
                                                }}>{log.logText || 'No logs recorded.'}</pre>
                                            </div>

                                            {/* Files affected */}
                                            {log.filesAffected && log.filesAffected.length > 0 && (
                                                <div>
                                                    <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>Files Impacted ({log.filesAffected.length})</div>
                                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                        {log.filesAffected.map((file, fIdx) => (
                                                            <span key={fIdx} style={{ 
                                                                fontSize: '11px', 
                                                                background: 'var(--bg-surface-2)', 
                                                                border: '1px solid var(--border-dim)',
                                                                borderRadius: '4px',
                                                                padding: '2px 8px',
                                                                color: 'var(--text-secondary)'
                                                            }}>
                                                                {file}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Rule Configuration Modal Wizard */}
            {showRuleModal && (
                <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setShowRuleModal(false)}>
                    <div className="modal-content glass" style={{ width: '480px', padding: '28px', textAlign: 'left' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Cpu size={20} color="var(--accent-cyan)" />
                                Create Automation Rule
                            </h3>
                            <button className="inspector-close-btn" onClick={() => setShowRuleModal(false)}><X size={18} /></button>
                        </div>

                        <form onSubmit={handleCreateRule} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Rule Name */}
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>Rule Name *</label>
                                <input 
                                    className="m-input" 
                                    required 
                                    placeholder="e.g. Document Automove Rule" 
                                    value={ruleName}
                                    onChange={e => setRuleName(e.target.value)}
                                    style={{ width: '100%', outline: 'none' }}
                                />
                            </div>

                            {/* Trigger Path */}
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>Trigger Folder Path *</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input 
                                        className="m-input" 
                                        required 
                                        placeholder="e.g. d:\opt\nexadisk\mnt" 
                                        value={triggerFolder}
                                        onChange={e => setTriggerFolder(e.target.value)}
                                        style={{ flex: 1, outline: 'none' }}
                                    />
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        style={{ padding: '0 14px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', borderRadius: '8px', cursor: 'pointer' }}
                                        onClick={() => {
                                            setPickerContext('triggerFolder');
                                            setShowPicker(true);
                                        }}
                                    >
                                        <Folder size={14} /> Browse
                                    </button>
                                </div>
                            </div>

                            {/* Row for Action Type and Schedule */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                {/* Action Type */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>Action Type</label>
                                    <select 
                                        className="m-input"
                                        value={actionType}
                                        onChange={e => setActionType(e.target.value)}
                                        style={{ width: '100%', outline: 'none', background: 'var(--bg-panel)', color: 'var(--text-primary)' }}
                                    >
                                        <option value="organize">Organize / Sort</option>
                                        <option value="clean">Clean Junk</option>
                                        <option value="deduplicate">Deduplicate</option>
                                        <option value="compress">Compress Old Files</option>
                                        <option value="tag">Tag/Label Files</option>
                                        <option value="flatten">Flatten Subfolders</option>
                                        <option value="find_large">Find Large Files</option>
                                        <option value="report">Generate Inventory</option>
                                        <option value="rename">Rename Screenshots</option>
                                    </select>
                                </div>

                                {/* Schedule */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>Schedule Interval</label>
                                    <select 
                                        className="m-input"
                                        value={schedule}
                                        onChange={e => setSchedule(e.target.value)}
                                        style={{ width: '100%', outline: 'none', background: 'var(--bg-panel)', color: 'var(--text-primary)' }}
                                    >
                                        <option value="on_upload">⚡ On File Upload</option>
                                        <option value="hourly">⏰ Hourly</option>
                                        <option value="daily">⏰ Daily</option>
                                        <option value="weekly">⏰ Weekly</option>
                                    </select>
                                </div>
                            </div>

                            {/* Natural Language AI Instruction */}
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>Natural Language Instruction *</label>
                                <textarea 
                                    className="m-input" 
                                    required 
                                    rows={3}
                                    placeholder="e.g. Move document files to d:\opt\nexadisk\mnt\Documents" 
                                    value={aiInstruction}
                                    onChange={e => setAiInstruction(e.target.value)}
                                    style={{ width: '100%', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                                />
                                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                                    Confirm the target folder and instructions match your automation goals.
                                </span>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: '12px', marginTop: '12px', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn-secondary" onClick={() => setShowRuleModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" disabled={submittingRule}>
                                    {submittingRule ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                                            <span>Saving Rule...</span>
                                        </div>
                                    ) : 'Create Rule'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showPicker && (
                <FolderPickerModal
                    agents={agents}
                    onClose={() => setShowPicker(false)}
                    onSelect={(folderPath) => {
                        if (pickerContext === 'targetPath') {
                            setTargetPath(folderPath);
                        } else if (pickerContext === 'triggerFolder') {
                            setTriggerFolder(folderPath);
                        }
                        setShowPicker(false);
                    }}
                    showToast={showToast}
                />
            )}
        </div>
    );
};

export default AIAutomator;
