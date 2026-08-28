import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
    Sparkles, Cpu, Terminal, Plus, Trash2, Play, ArrowRight, CheckCircle2, 
    XCircle, Loader, Folder, RefreshCw, FileText, ToggleLeft, ToggleRight, Eye, X, CornerDownRight
} from 'lucide-react';

const API_BASE = '/api';

const AIAutomator = ({ agents, showToast }) => {
    const [rules, setRules] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loadingRules, setLoadingRules] = useState(true);
    const [loadingLogs, setLoadingLogs] = useState(true);
    const [showRuleModal, setShowRuleModal] = useState(false);
    
    // Rule Creation State
    const [ruleName, setRuleName] = useState('');
    const [triggerFolder, setTriggerFolder] = useState('');
    const [aiInstruction, setAiInstruction] = useState('');
    const [actionType, setActionType] = useState('route');
    const [submittingRule, setSubmittingRule] = useState(false);

    // Copilot Console State
    const [copilotCommand, setCopilotCommand] = useState('');
    const [terminalLines, setTerminalLines] = useState([
        { text: 'NexaDisk AI Copilot v1.0.0 Online.', type: 'info' },
        { text: 'Enter a command above or configure folder trigger rules.', type: 'info' }
    ]);
    const [isThinking, setIsThinking] = useState(false);
    const [thinkingStep, setThinkingStep] = useState('');
    const terminalEndRef = useRef(null);

    // Expanded log state for Audit Center
    const [expandedLogId, setExpandedLogId] = useState(null);

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

    useEffect(() => {
        fetchRules();
        fetchLogs();
    }, []);

    useEffect(() => {
        if (terminalEndRef.current) {
            terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [terminalLines]);

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
                actionType
            }, { headers });

            showToast('Automation Rule registered successfully', 'success');
            setShowRuleModal(false);
            setRuleName('');
            setTriggerFolder('');
            setAiInstruction('');
            setActionType('route');
            fetchRules();
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
            await axios.post(`${API_BASE}/ai/rules/${id}/toggle`, { active: !currentActive }, { headers });
            showToast(`Rule ${!currentActive ? 'activated' : 'deactivated'}`, 'success');
            fetchRules();
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
        printToTerminal(`Executing Instruction: "${commandString}"`, 'command');
        printToTerminal(`Analyzing directory structure...`, 'scanning');

        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.post(`${API_BASE}/ai/copilot`, { command: commandString }, { headers });
            
            const { logs: flowLogs, filesAffected, status } = res.data;

            // Simulating real-time output stream of thinking logs
            let currentIdx = 0;
            const printNextLog = () => {
                if (currentIdx < flowLogs.length) {
                    const rawLine = flowLogs[currentIdx];
                    let lineType = 'info';
                    if (rawLine.includes('[SCANNING]')) lineType = 'scanning';
                    else if (rawLine.includes('[Failed]') || rawLine.includes('Error')) lineType = 'error';
                    else if (rawLine.includes('[Success]') || rawLine.includes('completed')) lineType = 'success';
                    
                    printToTerminal(rawLine, lineType);
                    currentIdx++;
                    setTimeout(printNextLog, 250);
                } else {
                    printToTerminal(`Process completed. Status: ${status}. ${filesAffected.length} file(s) affected.`, 'success');
                    setIsThinking(false);
                    fetchLogs();
                }
            };

            printNextLog();

        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message || 'Operation failed';
            printToTerminal(`[Error] Execution aborted: ${errorMsg}`, 'error');
            setIsThinking(false);
            fetchLogs();
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-dim)' }}>
                <div>
                    <h2 style={{ fontSize: '24px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Sparkles size={24} color="var(--accent-cyan)" style={{ filter: 'drop-shadow(0 0 8px var(--accent-cyan-glow))' }} />
                        AI Automation Center
                    </h2>
                    <p style={{ color: '#8b949e', fontSize: '13px', marginTop: '4px' }}>Configure folder triggers or execute natural language workflows across nodes.</p>
                </div>
                <button className="btn-primary" onClick={() => setShowRuleModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Plus size={16} />
                    <span>Create Auto Rule</span>
                </button>
            </div>

            {/* Core workspace grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
                
                {/* Left Panel: Copilot Console */}
                <div className="st-card shadow-premium" style={{ display: 'flex', flexDirection: 'column', height: '480px', padding: '20px', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <Terminal size={16} color="var(--accent-gold)" />
                            AI Copilot Console
                        </h3>
                        {isThinking && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)', fontSize: '12px', fontWeight: '700' }}>
                                <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                                <span>Agent thinking...</span>
                            </div>
                        )}
                    </div>

                    {/* Quick prompts toolbar */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                        <button 
                            disabled={isThinking}
                            onClick={() => triggerQuickPrompt("organize files in d:\\opt\\nexadisk\\mnt")} 
                            style={{ padding: '6px 12px', borderRadius: '20px', background: 'rgba(0, 242, 255, 0.05)', border: '1px solid rgba(0, 242, 255, 0.15)', color: 'var(--accent-cyan)', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                        >
                            ⚡ Organize mnt/
                        </button>
                        <button 
                            disabled={isThinking}
                            onClick={() => triggerQuickPrompt("clean temp files in d:\\opt\\nexadisk\\mnt")} 
                            style={{ padding: '6px 12px', borderRadius: '20px', background: 'rgba(242, 201, 76, 0.05)', border: '1px solid rgba(242, 201, 76, 0.15)', color: 'var(--accent-gold)', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                        >
                            🧹 Clean Junk in mnt/
                        </button>
                        <button 
                            disabled={isThinking}
                            onClick={() => triggerQuickPrompt("rename screenshots in d:\\opt\\nexadisk\\mnt")} 
                            style={{ padding: '6px 12px', borderRadius: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-dim)', color: '#fff', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                        >
                            📸 Rename Screenshots
                        </button>
                        <button 
                            disabled={isThinking}
                            onClick={() => triggerQuickPrompt("summarize folder d:\\opt\nexadisk\\mnt")} 
                            style={{ padding: '6px 12px', borderRadius: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-dim)', color: '#fff', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                        >
                            📊 Directory Report
                        </button>
                    </div>

                    {/* Console Output Screen */}
                    <div style={{ 
                        flex: 1, 
                        background: '#040711', 
                        border: '1px solid rgba(255, 255, 255, 0.05)', 
                        borderRadius: '12px', 
                        padding: '16px', 
                        fontFamily: 'monospace', 
                        fontSize: '12px', 
                        overflowY: 'auto', 
                        lineHeight: '1.6',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                    }}>
                        {terminalLines.map((line, idx) => {
                            let color = '#8b949e'; // default info
                            if (line.type === 'command') color = '#fff';
                            else if (line.type === 'scanning') color = 'var(--accent-cyan)';
                            else if (line.type === 'success') color = '#3fb950';
                            else if (line.type === 'error') color = '#f85149';

                            return (
                                <div key={idx} style={{ color }}>
                                    {line.type === 'command' && <span style={{ color: 'var(--accent-gold)', marginRight: '6px' }}>&gt;</span>}
                                    {line.text}
                                </div>
                            );
                        })}
                        <div ref={terminalEndRef} />
                    </div>

                    {/* Prompt input field */}
                    <form onSubmit={handleCopilotSubmit} style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                        <input 
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
                <div className="st-card shadow-premium" style={{ display: 'flex', flexDirection: 'column', height: '480px', padding: '20px' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <Folder size={16} color="var(--accent-cyan)" />
                        Automation Rules
                    </h3>

                    {loadingRules ? (
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flex: 1, gap: '10px' }}>
                            <Loader size={24} style={{ animation: 'spin 1.5s linear infinite' }} />
                            <span style={{ fontSize: '12px', color: '#8b949e' }}>Reading registered rules...</span>
                        </div>
                    ) : rules.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flex: 1, opacity: 0.4, textAlign: 'center', padding: '20px' }}>
                            <Cpu size={36} style={{ marginBottom: '12px' }} />
                            <p style={{ fontSize: '13px', fontWeight: '700' }}>No Active Upload Rules</p>
                            <p style={{ fontSize: '11px', marginTop: '4px' }}>Click "Create Auto Rule" to define folder-based triggers (e.g. automatically route docs/images).</p>
                        </div>
                    ) : (
                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {rules.map((rule) => (
                                <div key={rule.id} style={{ 
                                    background: 'rgba(255,255,255,0.02)', 
                                    border: '1px solid var(--border-dim)', 
                                    borderRadius: '12px', 
                                    padding: '12px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, marginRight: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontWeight: '700', fontSize: '13px' }}>{rule.name}</span>
                                            <span style={{ 
                                                fontSize: '10px', 
                                                padding: '2px 6px', 
                                                borderRadius: '4px', 
                                                background: rule.actionType === 'route' ? 'rgba(0,242,255,0.1)' : 'rgba(242, 201, 76, 0.1)', 
                                                color: rule.actionType === 'route' ? 'var(--accent-cyan)' : 'var(--accent-gold)',
                                                fontWeight: '800',
                                                textTransform: 'uppercase'
                                            }}>
                                                {rule.actionType}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#8b949e' }}>
                                            Folder: <code style={{ color: '#fff' }}>{rule.triggerFolder}</code>
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#8b949e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <CornerDownRight size={10} />
                                            <span>Instruction: {rule.aiInstruction}</span>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <button 
                                            onClick={() => handleToggleRule(rule.id, rule.active === 1)}
                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                                        >
                                            {rule.active === 1 ? (
                                                <ToggleRight size={28} color="var(--accent-cyan)" />
                                            ) : (
                                                <ToggleLeft size={28} color="#8b949e" />
                                            )}
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteRule(rule.id, rule.name)}
                                            style={{ 
                                                background: 'rgba(235, 87, 87, 0.1)', 
                                                border: 'none', 
                                                borderRadius: '6px', 
                                                padding: '6px',
                                                cursor: 'pointer',
                                                color: '#eb5757',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
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
            <div className="st-card-wide glass" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
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
                                    background: 'rgba(255, 255, 255, 0.01)', 
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
                                            <span style={{ fontWeight: '700', fontSize: '13px', color: '#fff' }}>
                                                {log.command}
                                            </span>
                                            <span style={{ fontSize: '11px', color: '#8b949e' }}>
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
                                                <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#8b949e', marginBottom: '8px' }}>Thinking Steps</div>
                                                <pre style={{ 
                                                    background: 'rgba(255,255,255,0.02)', 
                                                    padding: '12px', 
                                                    borderRadius: '8px', 
                                                    fontFamily: 'monospace', 
                                                    fontSize: '11px', 
                                                    color: '#c9d1d9',
                                                    whiteSpace: 'pre-wrap',
                                                    margin: 0
                                                }}>{log.logText || 'No logs recorded.'}</pre>
                                            </div>

                                            {/* Files affected */}
                                            {log.filesAffected && log.filesAffected.length > 0 && (
                                                <div>
                                                    <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#8b949e', marginBottom: '8px' }}>Files Impacted ({log.filesAffected.length})</div>
                                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                        {log.filesAffected.map((file, fIdx) => (
                                                            <span key={fIdx} style={{ 
                                                                fontSize: '11px', 
                                                                background: 'rgba(255,255,255,0.04)', 
                                                                border: '1px solid var(--border-dim)',
                                                                borderRadius: '4px',
                                                                padding: '2px 8px',
                                                                color: '#c9d1d9'
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
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#8b949e', marginBottom: '6px' }}>Rule Name *</label>
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
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#8b949e', marginBottom: '6px' }}>Trigger Folder Path *</label>
                                <input 
                                    className="m-input" 
                                    required 
                                    placeholder="e.g. d:\opt\nexadisk\mnt" 
                                    value={triggerFolder}
                                    onChange={e => setTriggerFolder(e.target.value)}
                                    style={{ width: '100%', outline: 'none' }}
                                />
                                <span style={{ fontSize: '10px', color: '#8b949e', display: 'block', marginTop: '4px' }}>
                                    Rule executes automatically when new files are uploaded into this folder.
                                </span>
                            </div>

                            {/* Action Type */}
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#8b949e', marginBottom: '6px' }}>Action Type</label>
                                <select 
                                    className="m-input"
                                    value={actionType}
                                    onChange={e => setActionType(e.target.value)}
                                    style={{ width: '100%', outline: 'none', background: 'var(--bg-panel)', color: '#fff' }}
                                >
                                    <option value="route">Route / Move files to target subdirectory</option>
                                    <option value="rename">Rename files dynamically</option>
                                </select>
                            </div>

                            {/* Natural Language AI Instruction */}
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#8b949e', marginBottom: '6px' }}>Natural Language Instruction *</label>
                                <textarea 
                                    className="m-input" 
                                    required 
                                    rows={3}
                                    placeholder="e.g. Move document files to d:\opt\nexadisk\mnt\Documents" 
                                    value={aiInstruction}
                                    onChange={e => setAiInstruction(e.target.value)}
                                    style={{ width: '100%', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                                />
                                <span style={{ fontSize: '10px', color: '#8b949e', display: 'block', marginTop: '4px' }}>
                                    Describe in plain text how matching files should be handled. Mention keywords like 'image', 'document', 'archive', 'code' to route files, and the target path where they should go.
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
        </div>
    );
};

export default AIAutomator;
