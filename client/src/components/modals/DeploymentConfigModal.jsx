import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Server, Download, Copy, Check, Terminal, Shield, RefreshCw, X, Cpu, HardDrive,
    Layers, CheckCircle2, AlertCircle, FileText
} from 'lucide-react';

const API_BASE = '/api';

const DeploymentConfigModal = ({ show, onClose, showToast }) => {
    const [tab, setTab] = useState('docker'); // 'docker', 'systemd', 'env', 'nginx', 'preflight'
    const [preflight, setPreflight] = useState(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    // Customizer form state
    const [port, setPort] = useState(5000);
    const [storagePath, setStoragePath] = useState('/var/lib/nexadisk/storage');
    const [domain, setDomain] = useState('storage.example.com');
    const [dbHost, setDbHost] = useState('127.0.0.1');

    const [generatedCode, setGeneratedCode] = useState('');

    useEffect(() => {
        if (show) {
            fetchPreflight();
            generateConfig('docker');
        }
    }, [show, port, storagePath, domain, dbHost]);

    const fetchPreflight = async () => {
        try {
            const token = localStorage.getItem('token') || '';
            const res = await axios.get(`${API_BASE}/v1/deployment/preflight`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPreflight(res.data);
        } catch (e) {
            console.error('Failed to fetch preflight diagnostics', e);
        }
    };

    const generateConfig = async (selectedTab) => {
        setLoading(true);
        const token = localStorage.getItem('token') || '';
        const headers = { Authorization: `Bearer ${token}` };

        try {
            if (selectedTab === 'docker') {
                setGeneratedCode(`version: '3.8'

services:
  nexadisk-master:
    image: nexadisk/server:2.4.0
    container_name: nexadisk-master
    restart: always
    ports:
      - "${port}:5000"
    environment:
      - NODE_ENV=production
      - PORT=5000
      - STORAGE_ROOT=/var/lib/nexadisk/storage
      - DATABASE_URL=postgres://nexadisk:nexadisk_secret@postgres:5432/nexadisk_db
    volumes:
      - nexadisk-data:/var/lib/nexadisk/storage
    depends_on:
      - postgres
    networks:
      - nexadisk-net

  postgres:
    image: postgres:16-alpine
    container_name: nexadisk-postgres
    restart: always
    environment:
      - POSTGRES_DB=nexadisk_db
      - POSTGRES_USER=nexadisk
      - POSTGRES_PASSWORD=nexadisk_secret
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - nexadisk-net

volumes:
  nexadisk-data:
  postgres-data:

networks:
  nexadisk-net:
    driver: bridge`);
            } else if (selectedTab === 'env') {
                const res = await axios.post(`${API_BASE}/v1/deployment/generate-env`, {
                    port, storagePath, dbHost
                }, { headers });
                setGeneratedCode(res.data.content);
            } else if (selectedTab === 'systemd') {
                const res = await axios.post(`${API_BASE}/v1/deployment/generate-systemd`, {
                    installDir: '/opt/nexadisk', user: 'nexadisk'
                }, { headers });
                setGeneratedCode(res.data.content);
            } else if (selectedTab === 'nginx') {
                const res = await axios.post(`${API_BASE}/v1/deployment/generate-nginx`, {
                    domain, backendPort: port
                }, { headers });
                setGeneratedCode(res.data.content);
            }
        } catch (e) {
            console.error('Failed to generate configuration', e);
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (newTab) => {
        setTab(newTab);
        if (newTab !== 'preflight') {
            generateConfig(newTab);
        }
    };

    const copyToClipboard = async () => {
        const { copyTextToClipboard } = await import('../../utils/clipboard');
        await copyTextToClipboard(generatedCode);
        setCopied(true);
        if (showToast) showToast('Configuration copied to clipboard!', 'success');
        setTimeout(() => setCopied(false), 2000);
    };


    const downloadFile = () => {
        const filename = tab === 'docker' ? 'docker-compose.yml' : tab === 'env' ? '.env.production' : tab === 'systemd' ? 'nexadisk.service' : 'nginx.conf';
        const blob = new Blob([generatedCode], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        if (showToast) showToast(`Downloaded ${filename}`, 'success');
    };

    if (!show) return null;

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 99999 }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '92vw', maxWidth: '1080px', maxHeight: '90vh', background: 'var(--bg-surface-0)', borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-subtle)', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', background: 'var(--bg-surface-1)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                            <Server size={22} color="var(--primary)" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                Deployment & Server Configuration
                            </h3>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                Production setup templates, automated installers, container manifests, and system diagnostics
                            </p>
                        </div>
                    </div>
                    <button className="btn-icon" onClick={onClose}><X size={18} /></button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '8px', padding: '12px 24px', background: 'var(--bg-surface-0)', borderBottom: '1px solid var(--border-subtle)' }}>
                    {[
                        { id: 'docker', label: 'Docker Compose', icon: Layers },
                        { id: 'systemd', label: 'Linux Systemd', icon: Terminal },
                        { id: 'env', label: 'Production .env', icon: Shield },
                        { id: 'nginx', label: 'Nginx SSL Proxy', icon: FileText },
                        { id: 'preflight', label: 'System Preflight', icon: Cpu },
                    ].map(t => {
                        const Icon = t.icon;
                        const active = tab === t.id;
                        return (
                            <button
                                key={t.id}
                                onClick={() => handleTabChange(t.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 16px',
                                    borderRadius: '10px',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    border: active ? '1px solid var(--primary)' : '1px solid transparent',
                                    background: active ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                                    color: active ? 'var(--primary)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <Icon size={16} /> {t.label}
                            </button>
                        );
                    })}
                </div>

                {/* Content Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {tab === 'preflight' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                                <div style={{ padding: '16px', borderRadius: '14px', background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>HOST PLATFORM</div>
                                    <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '4px' }}>{preflight?.platform?.toUpperCase()} ({preflight?.arch})</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{preflight?.hostname}</div>
                                </div>
                                <div style={{ padding: '16px', borderRadius: '14px', background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>NODE.JS RUNTIME</div>
                                    <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--accent-cyan)', marginTop: '4px' }}>{preflight?.nodeVersion}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Process RSS: {preflight?.processMemoryMB} MB</div>
                                </div>
                                <div style={{ padding: '16px', borderRadius: '14px', background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>SYSTEM MEMORY</div>
                                    <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--accent-gold)', marginTop: '4px' }}>{preflight?.freeMemoryGB} GB Free</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Total: {preflight?.totalMemoryGB} GB ({preflight?.cpuCount} vCPUs)</div>
                                </div>
                                <div style={{ padding: '16px', borderRadius: '14px', background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>UPTIME & STATUS</div>
                                    <div style={{ fontSize: '16px', fontWeight: '800', color: '#10b981', marginTop: '4px' }}>{preflight?.uptimeHours} Hours</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{preflight?.status}</div>
                                </div>
                            </div>

                            <div style={{ padding: '20px', borderRadius: '14px', background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>One-Click Native Setup Scripts</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ padding: '12px', background: '#0f172a', borderRadius: '10px', fontFamily: 'var(--font-mono)', fontSize: '12.5px', color: '#38bdf8' }}>
                                        # Linux (Ubuntu / Debian / RHEL / Alpine):<br />
                                        curl -fsSL https://raw.githubusercontent.com/nexadisk/install/main/install.sh | sudo bash
                                    </div>
                                    <div style={{ padding: '12px', background: '#0f172a', borderRadius: '10px', fontFamily: 'var(--font-mono)', fontSize: '12.5px', color: '#a78bfa' }}>
                                        # Windows Server (PowerShell Admin):<br />
                                        iwr -useb https://raw.githubusercontent.com/nexadisk/install/main/install.ps1 | iex
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
                            {/* Parameters Bar */}
                            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '14px 18px', background: 'var(--bg-surface-1)', borderRadius: '14px', border: '1px solid var(--border-subtle)', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>Port:</label>
                                    <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} style={{ width: '90px', padding: '6px 10px', borderRadius: '8px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '12px' }} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>Storage Root:</label>
                                    <input type="text" value={storagePath} onChange={(e) => setStoragePath(e.target.value)} style={{ width: '220px', padding: '6px 10px', borderRadius: '8px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '12px' }} />
                                </div>
                                {tab === 'nginx' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>Domain:</label>
                                        <input type="text" value={domain} onChange={(e) => setDomain(e.target.value)} style={{ width: '200px', padding: '6px 10px', borderRadius: '8px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '12px' }} />
                                    </div>
                                )}
                            </div>

                            {/* Code Viewer */}
                            <div style={{ flex: 1, minHeight: '340px', background: '#0a0f1d', borderRadius: '14px', border: '1px solid var(--border-subtle)', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                                <div style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                                        {tab === 'docker' ? 'docker-compose.yml' : tab === 'env' ? '.env.production' : tab === 'systemd' ? 'nexadisk.service' : 'nginx.conf'}
                                    </span>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button className="btn-outline" onClick={copyToClipboard} style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
                                        </button>
                                        <button className="btn-primary" onClick={downloadFile} style={{ padding: '4px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Download size={12} /> Download
                                        </button>
                                    </div>
                                </div>
                                <pre style={{ flex: 1, margin: 0, padding: '16px', overflow: 'auto', fontFamily: 'var(--font-mono)', fontSize: '12.5px', lineHeight: '1.6', color: '#e2e8f0' }}>
                                    {generatedCode}
                                </pre>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DeploymentConfigModal;
