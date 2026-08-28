import React, { useState } from 'react';
import { 
    Cpu, Server, Plus, ShieldCheck, ShieldAlert, AlertTriangle, RefreshCw, 
    Check, X, HardDrive, Lock, Shield, Eye, FileText, CheckCircle2, 
    Activity, Globe, Terminal, Layers, ArrowUpRight, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const NodeCard = ({ 
    id, 
    hostname, 
    ip, 
    disks = [], 
    isLocal, 
    status, 
    complianceStatus = 'compliant',
    complianceScore = 100,
    complianceReport,
    lastAudit,
    cpu = 0,
    memory = 0,
    online = true,
    onApprove, 
    onDisconnect,
    onRunAudit,
    onViewReport,
    isAuditing = false,
    showToast
}) => {
    const isCompliant = complianceStatus === 'compliant';
    const isQuarantined = complianceStatus === 'quarantined';
    const isPending = status === 'pending';

    const badgeColor = isCompliant ? '#10b981' : isQuarantined ? '#f43f5e' : '#f59e0b';
    const badgeBg = isCompliant ? 'rgba(16, 185, 129, 0.12)' : isQuarantined ? 'rgba(244, 63, 94, 0.12)' : 'rgba(245, 158, 11, 0.12)';
    const badgeText = isCompliant ? `SAFE (${complianceScore}%)` : isQuarantined ? `QUARANTINED (${complianceScore}%)` : 'AUDIT PENDING';

    const copyIp = (e) => {
        e.stopPropagation();
        if (ip) {
            navigator.clipboard.writeText(ip);
            if (showToast) showToast(`IP ${ip} copied to clipboard`, 'success');
        }
    };

    return (
        <motion.div 
            className="st-card shadow-premium glass" 
            whileHover={{ y: -3, boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12)' }}
            transition={{ duration: 0.2 }}
            style={{ 
                padding: '20px', 
                borderRadius: '16px', 
                border: '1px solid var(--border-subtle)', 
                background: 'var(--bg-surface-2)', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {/* Top Accent Glow Bar */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: isLocal 
                    ? 'var(--primary-gradient)' 
                    : isCompliant ? 'linear-gradient(90deg, #10b981, #06b6d4)' : 'linear-gradient(90deg, #f43f5e, #f59e0b)'
            }} />

            <div>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ 
                            width: '42px', 
                            height: '42px', 
                            borderRadius: '12px', 
                            background: isLocal ? 'rgba(99, 102, 241, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: `1px solid ${isLocal ? 'rgba(99, 102, 241, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
                            position: 'relative'
                        }}>
                            {isLocal ? <Server size={22} color="var(--primary)" /> : <Cpu size={22} color="#10b981" />}
                            {/* Online status indicator */}
                            <span style={{
                                position: 'absolute',
                                bottom: '-2px',
                                right: '-2px',
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                background: online ? '#10b981' : '#f43f5e',
                                border: '2px solid var(--bg-surface-2)',
                                boxShadow: online ? '0 0 6px #10b981' : 'none'
                            }} />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>{hostname}</h3>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: '600' }}>
                                    {isLocal ? 'Master Control Hub' : 'Cluster Storage Daemon'}
                                </span>
                                {ip && (
                                    <button 
                                        onClick={copyIp}
                                        style={{ 
                                            background: 'var(--bg-surface-0)', 
                                            border: '1px solid var(--border-subtle)', 
                                            borderRadius: '4px', 
                                            padding: '1px 6px', 
                                            fontSize: '10px', 
                                            fontFamily: 'monospace', 
                                            color: 'var(--primary)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '3px'
                                        }}
                                        title="Click to copy IP"
                                    >
                                        {ip}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Role & Compliance Badges */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                        <span style={{ 
                            fontSize: '10px', 
                            background: isLocal ? 'var(--primary-gradient)' : 'var(--bg-surface-0)', 
                            color: isLocal ? '#ffffff' : 'var(--text-secondary)', 
                            border: '1px solid var(--border-subtle)',
                            padding: '2px 8px', 
                            borderRadius: '6px', 
                            fontWeight: '800',
                            letterSpacing: '0.5px'
                        }}>
                            {isLocal ? 'MASTER' : 'AGENT'}
                        </span>
                        
                        {!isLocal && (
                            <span 
                                onClick={onViewReport}
                                style={{ 
                                    fontSize: '10px', 
                                    background: badgeBg, 
                                    color: badgeColor, 
                                    border: `1px solid ${badgeColor}40`, 
                                    padding: '2px 7px', 
                                    borderRadius: '6px', 
                                    fontWeight: '800', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '4px',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                                title="Click to view security compliance report"
                            >
                                {isCompliant ? <ShieldCheck size={12} /> : isQuarantined ? <ShieldAlert size={12} /> : <AlertTriangle size={12} />}
                                {badgeText}
                            </span>
                        )}
                    </div>
                </div>

                {/* Storage Volumes Breakdown */}
                {isPending ? (
                    <div style={{ padding: '16px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '12px', textAlign: 'center', marginBottom: '14px' }}>
                        <AlertTriangle size={22} color="#f59e0b" style={{ margin: '0 auto 6px' }} />
                        <p style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 4px' }}>Node Awaiting Authorization</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>This agent requested connection and requires admin approval.</p>
                    </div>
                ) : (
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <HardDrive size={13} color="var(--primary)" /> Bound Storage Volumes
                            </span>
                            <span style={{ background: 'var(--bg-surface-0)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                                {disks.length} Mount{disks.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: disks.length > 2 ? '1fr 1fr' : '1fr', gap: '8px', maxHeight: '160px', overflowY: 'auto', paddingRight: '4px' }}>
                            {disks.length > 0 ? (
                                disks.map((d, i) => {
                                    const pct = d.percentage || 0;
                                    const isHigh = pct > 85;
                                    return (
                                        <div key={i} style={{ padding: '8px 10px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '4px' }}>
                                                <span style={{ fontFamily: 'monospace', fontWeight: '700', color: 'var(--text-primary)' }}>{d.mount}</span>
                                                <span style={{ fontWeight: '800', color: isHigh ? '#f43f5e' : 'var(--text-secondary)' }}>{pct}%</span>
                                            </div>
                                            <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                                                <div style={{ 
                                                    width: `${pct}%`, 
                                                    height: '100%', 
                                                    background: isHigh ? '#f43f5e' : isLocal ? 'var(--primary-gradient)' : '#10b981',
                                                    borderRadius: '2px',
                                                    transition: 'width 0.4s ease'
                                                }} />
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div style={{ padding: '12px', textAlign: 'center', background: 'var(--bg-surface-0)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                                    <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: 0 }}>No active storage disks reported.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Actions Bar */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                {isPending ? (
                    <>
                        <button 
                            className="btn-primary" 
                            style={{ flex: 1, height: '34px', fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} 
                            onClick={onApprove}
                        >
                            <Check size={14} /> Approve Node
                        </button>
                        <button 
                            style={{ flex: 1, height: '34px', fontSize: '12px', fontWeight: '800', background: 'transparent', border: '1px solid #f43f5e', color: '#f43f5e', borderRadius: '8px', cursor: 'pointer' }} 
                            onClick={onDisconnect}
                        >
                            Reject
                        </button>
                    </>
                ) : (
                    <>
                        {!isLocal ? (
                            <>
                                <button
                                    onClick={onRunAudit}
                                    disabled={isAuditing}
                                    style={{
                                        flex: 1,
                                        height: '34px',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        background: 'var(--bg-surface-0)',
                                        border: '1px solid var(--border-subtle)',
                                        color: 'var(--text-primary)',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        transition: 'all 0.15s ease'
                                    }}
                                    title="Run Zero-Trust Security Compliance Handshake"
                                >
                                    <RefreshCw size={13} className={isAuditing ? 'spin-anim' : ''} color={isAuditing ? 'var(--primary)' : 'inherit'} />
                                    {isAuditing ? 'Scanning...' : 'Security Audit'}
                                </button>

                                <button
                                    onClick={onDisconnect}
                                    style={{
                                        height: '34px',
                                        padding: '0 14px',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        background: 'rgba(244, 63, 94, 0.08)',
                                        border: '1px solid rgba(244, 63, 94, 0.2)',
                                        color: '#f43f5e',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    Disconnect
                                </button>
                            </>
                        ) : (
                            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-dim)' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <ShieldCheck size={14} color="#10b981" /> Primary Control Node Active
                                </span>
                                <span style={{ fontWeight: '700', color: 'var(--primary)' }}>Port 5000</span>
                            </div>
                        )}
                    </>
                )}
            </div>
        </motion.div>
    );
};

export default function MachinesView({
    filteredNodes = [],
    handleApproveAgent,
    handleDisconnectAgent,
    setShowProvisionModal,
    setShowSiteMeshModal,
    setShowDeployModal,
    setShowUpdateModal,
    showToast,
    onRefreshFleet
}) {
    const [auditingNodeId, setAuditingNodeId] = useState(null);
    const [selectedReportNode, setSelectedReportNode] = useState(null);

    const totalNodes = filteredNodes.length;
    const onlineNodes = filteredNodes.filter(n => n.online !== false).length;
    const compliantCount = filteredNodes.filter(n => (n.complianceStatus || 'compliant') === 'compliant').length;
    const totalMounts = filteredNodes.reduce((acc, n) => acc + (n.disks?.length || 0), 0);

    const handleRunAudit = async (nodeId) => {
        setAuditingNodeId(nodeId);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.post(`/api/v1/agents/audit/${nodeId}`, {}, { headers });
            
            if (showToast) {
                const score = res.data?.report?.score || 0;
                showToast(`Security Audit completed for ${nodeId} (Score: ${score}%)`, score >= 75 ? 'success' : 'error');
            }
            if (onRefreshFleet) onRefreshFleet();
        } catch (err) {
            if (showToast) showToast(`Audit scan failed: ${err.message}`, 'error');
        } finally {
            setAuditingNodeId(null);
        }
    };

    return (
        <motion.div key="mc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ paddingBottom: '32px' }}>
            {/* Top Header & Provision Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h2 style={{ fontSize: '26px', fontWeight: '900', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '-0.5px' }}>
                        <Server size={28} color="var(--primary)" /> Distributed Fleet Management
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '13px' }}>
                        Zero-Trust cluster topology, real-time node telemetry, and automated security compliance audits
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {onRefreshFleet && (
                        <button
                            onClick={onRefreshFleet}
                            style={{
                                background: 'var(--bg-surface-2)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '10px',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                padding: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            title="Refresh Fleet"
                        >
                            <RefreshCw size={15} />
                        </button>
                    )}
                    {setShowSiteMeshModal && (
                        <button
                            className="btn-outline"
                            onClick={() => setShowSiteMeshModal(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '10px', fontWeight: '700', fontSize: '12.5px', color: 'var(--accent-cyan)' }}
                        >
                            <Globe size={15} /> Site Mesh
                        </button>
                    )}
                    {setShowUpdateModal && (
                        <button
                            className="btn-outline"
                            onClick={() => setShowUpdateModal(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '10px', fontWeight: '700', fontSize: '12.5px', color: '#10b981' }}
                        >
                            <Sparkles size={15} /> OTA Updates
                        </button>
                    )}
                    <button 
                        className="btn-primary" 
                        onClick={() => setShowProvisionModal(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px', fontWeight: '800', fontSize: '13px' }}
                    >
                        <Plus size={16} /> Provision Node
                    </button>
                </div>
            </div>

            {/* Quick Fleet Health Stats Banner */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '14px', 
                marginBottom: '24px' 
            }}>
                <div className="st-card shadow-premium glass" style={{ padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-2)', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.12)' }}>
                        <Server size={20} color="var(--primary)" />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: '800', textTransform: 'uppercase' }}>Total Nodes</div>
                        <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)' }}>{totalNodes}</div>
                    </div>
                </div>

                <div className="st-card shadow-premium glass" style={{ padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-2)', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)' }}>
                        <Activity size={20} color="#10b981" />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: '800', textTransform: 'uppercase' }}>Online Nodes</div>
                        <div style={{ fontSize: '20px', fontWeight: '900', color: '#10b981' }}>{onlineNodes} / {totalNodes}</div>
                    </div>
                </div>

                <div className="st-card shadow-premium glass" style={{ padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-2)', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(6, 182, 212, 0.12)' }}>
                        <ShieldCheck size={20} color="#06b6d4" />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: '800', textTransform: 'uppercase' }}>Zero-Trust Compliance</div>
                        <div style={{ fontSize: '20px', fontWeight: '900', color: '#06b6d4' }}>
                            {totalNodes > 0 ? Math.round((compliantCount / totalNodes) * 100) : 100}%
                        </div>
                    </div>
                </div>

                <div className="st-card shadow-premium glass" style={{ padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-2)', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.12)' }}>
                        <HardDrive size={20} color="#f59e0b" />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: '800', textTransform: 'uppercase' }}>Mounted Partitions</div>
                        <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)' }}>{totalMounts} Disks</div>
                    </div>
                </div>
            </div>

            {/* Node Grid (Clean & Structured - No bottom placeholder card) */}
            <div className="node-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
                {filteredNodes.map((node, i) => (
                    <NodeCard
                        key={node.id || i}
                        id={node.id}
                        hostname={node.hostname}
                        ip={node.ip}
                        disks={node.disks || []}
                        isLocal={node.type === 'Master'}
                        status={node.status}
                        complianceStatus={node.complianceStatus}
                        complianceScore={node.complianceScore}
                        complianceReport={node.complianceReport}
                        lastAudit={node.lastAudit}
                        online={node.online !== false}
                        cpu={node.cpu}
                        memory={node.memory}
                        onApprove={() => handleApproveAgent(node.id)}
                        onDisconnect={() => handleDisconnectAgent(node.id)}
                        onRunAudit={() => handleRunAudit(node.id)}
                        onViewReport={() => setSelectedReportNode(node)}
                        isAuditing={auditingNodeId === node.id}
                        showToast={showToast}
                    />
                ))}
            </div>

            {/* Compliance Report Modal (Compact & Sleek) */}
            <AnimatePresence>
                {selectedReportNode && (
                    <div className="modal-overlay" style={{ zIndex: 1200 }}>
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }} 
                            animate={{ scale: 1, opacity: 1 }} 
                            exit={{ scale: 0.95, opacity: 0 }} 
                            className="modal-content glass shadow-premium" 
                            style={{ width: '480px', maxWidth: '92vw', padding: '24px', borderRadius: '16px' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                                    <ShieldCheck size={20} color="var(--primary)" /> Zero-Trust Audit: {selectedReportNode.hostname}
                                </h3>
                                <button onClick={() => setSelectedReportNode(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}><X size={18} /></button>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', marginBottom: '14px' }}>
                                    <div>
                                        <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: '800', textTransform: 'uppercase' }}>COMPLIANCE RATING</span>
                                        <div style={{ fontSize: '18px', fontWeight: '900', color: (selectedReportNode.complianceScore || 100) >= 75 ? '#10b981' : '#f43f5e' }}>
                                            {(selectedReportNode.complianceScore || 100)}% VERIFIED
                                        </div>
                                    </div>
                                    <span style={{
                                        fontSize: '10.5px',
                                        fontWeight: '800',
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        background: (selectedReportNode.complianceStatus || 'compliant') === 'compliant' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                                        color: (selectedReportNode.complianceStatus || 'compliant') === 'compliant' ? '#10b981' : '#f43f5e',
                                        border: `1px solid ${(selectedReportNode.complianceStatus || 'compliant') === 'compliant' ? '#10b98140' : '#f43f5e40'}`
                                    }}>
                                        {(selectedReportNode.complianceStatus || 'compliant').toUpperCase()}
                                    </span>
                                </div>

                                {/* 4 Checkpoints */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {selectedReportNode.complianceReport?.checks ? (
                                        Object.entries(selectedReportNode.complianceReport.checks).map(([k, v]) => (
                                            <div key={k} style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderLeft: `3px solid ${v.passed ? '#10b981' : '#f43f5e'}` }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                                                    <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>{v.name}</span>
                                                    <span style={{ fontSize: '9.5px', fontWeight: '800', color: v.passed ? '#10b981' : '#f43f5e' }}>{v.passed ? 'PASSED' : 'FLAGGED'}</span>
                                                </div>
                                                <p style={{ margin: 0, fontSize: '10.5px', color: 'var(--text-secondary)' }}>{v.details || 'Verified'}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                                            <p>No audit report generated yet. Click "Run Security Audit" to perform a deep scan.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button 
                                className="btn-primary" 
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', fontWeight: '800', fontSize: '12.5px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
                                onClick={() => {
                                    handleRunAudit(selectedReportNode.id);
                                    setSelectedReportNode(null);
                                }}
                            >
                                <RefreshCw size={14} /> Run Fresh Audit Scan
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
