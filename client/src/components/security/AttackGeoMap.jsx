import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Globe, ShieldAlert, ShieldCheck, AlertOctagon, Trash2, 
    Plus, RefreshCw, Radio, Lock, Unlock, Eye, Filter, CheckCircle2, XCircle
} from 'lucide-react';

const API_BASE = '/api/v1/security';

// Client-side ISO 3166-1 alpha-2 -> country name/city lookup
// Used as a fallback when the backend has no country metadata stored
const COUNTRY_LOOKUP = {
    RU: { name: 'Russia', city: 'Moscow' },
    DE: { name: 'Germany', city: 'Frankfurt' },
    CN: { name: 'China', city: 'Beijing' },
    US: { name: 'United States', city: 'San Jose' },
    IN: { name: 'India', city: 'Bengaluru' },
    VN: { name: 'Vietnam', city: 'Hanoi' },
    NL: { name: 'Netherlands', city: 'Amsterdam' },
    KP: { name: 'North Korea', city: 'Pyongyang' },
    IR: { name: 'Iran', city: 'Tehran' },
    BR: { name: 'Brazil', city: 'Brasília' },
    NG: { name: 'Nigeria', city: 'Abuja' },
    UA: { name: 'Ukraine', city: 'Kyiv' },
    GB: { name: 'United Kingdom', city: 'London' },
    FR: { name: 'France', city: 'Paris' },
    TR: { name: 'Turkey', city: 'Istanbul' },
    PK: { name: 'Pakistan', city: 'Karachi' },
    BD: { name: 'Bangladesh', city: 'Dhaka' },
    ID: { name: 'Indonesia', city: 'Jakarta' },
    PH: { name: 'Philippines', city: 'Manila' },
    MY: { name: 'Malaysia', city: 'Kuala Lumpur' },
    SG: { name: 'Singapore', city: 'Singapore' },
    TH: { name: 'Thailand', city: 'Bangkok' },
    JP: { name: 'Japan', city: 'Tokyo' },
    KR: { name: 'South Korea', city: 'Seoul' },
    AU: { name: 'Australia', city: 'Sydney' },
    CA: { name: 'Canada', city: 'Toronto' },
    MX: { name: 'Mexico', city: 'Mexico City' },
    AR: { name: 'Argentina', city: 'Buenos Aires' },
    ZA: { name: 'South Africa', city: 'Johannesburg' },
    EG: { name: 'Egypt', city: 'Cairo' },
    SA: { name: 'Saudi Arabia', city: 'Riyadh' },
    AE: { name: 'UAE', city: 'Dubai' },
    IL: { name: 'Israel', city: 'Tel Aviv' },
    IT: { name: 'Italy', city: 'Rome' },
    ES: { name: 'Spain', city: 'Madrid' },
    PT: { name: 'Portugal', city: 'Lisbon' },
    PL: { name: 'Poland', city: 'Warsaw' },
    BE: { name: 'Belgium', city: 'Brussels' },
    CH: { name: 'Switzerland', city: 'Zurich' },
    AT: { name: 'Austria', city: 'Vienna' },
    SE: { name: 'Sweden', city: 'Stockholm' },
    NO: { name: 'Norway', city: 'Oslo' },
    FI: { name: 'Finland', city: 'Helsinki' },
    DK: { name: 'Denmark', city: 'Copenhagen' },
    RO: { name: 'Romania', city: 'Bucharest' },
    CZ: { name: 'Czech Republic', city: 'Prague' },
    HU: { name: 'Hungary', city: 'Budapest' },
    GR: { name: 'Greece', city: 'Athens' },
    XX: { name: 'Unknown Origin', city: 'Unknown' },
};

// Resolve display label for a threat point
const resolveThreatLabel = (threat) => {
    const code = threat.country || 'XX';
    const lookup = COUNTRY_LOOKUP[code] || COUNTRY_LOOKUP.XX;
    const city = (threat.city && threat.city !== 'Unknown') ? threat.city : lookup.city;
    const countryName = (threat.countryName && threat.countryName !== 'Unknown' && threat.countryName !== 'Unknown Origin') 
        ? threat.countryName 
        : lookup.name;
    return { city, countryName, code };
};

const AttackGeoMap = ({ showToast }) => {
    const [threatMapData, setThreatMapData] = useState(null);
    const [bannedIps, setBannedIps] = useState([]);
    const [geofence, setGeofence] = useState({ mode: 'whitelist_all', blockedCountries: [] });
    const [loading, setLoading] = useState(true);
    const [selectedThreat, setSelectedThreat] = useState(null);

    // Manual Ban Form
    const [manualIp, setManualIp] = useState('');
    const [manualReason, setManualReason] = useState('');
    const [manualCountry, setManualCountry] = useState('US');
    const [banning, setBanning] = useState(false);
    const [showBanModal, setShowBanModal] = useState(false);

    const fetchThreatData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const [mapRes, banRes] = await Promise.all([
                axios.get(`${API_BASE}/threat-map`, { headers }),
                axios.get(`${API_BASE}/firewall/banned-ips`, { headers })
            ]);

            setThreatMapData(mapRes.data);
            setBannedIps(banRes.data.bannedIps || []);
            setGeofence(banRes.data.geofence || { mode: 'whitelist_all', blockedCountries: [] });
        } catch (err) {
            console.error('Failed to fetch threat map data', err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchThreatData();
        const interval = setInterval(() => fetchThreatData(true), 6000);
        return () => clearInterval(interval);
    }, []);

    const handleBanIp = async (e) => {
        e.preventDefault();
        if (!manualIp) return;
        setBanning(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post(`${API_BASE}/firewall/ban-ip`, {
                ip: manualIp,
                reason: manualReason || 'Manual Admin Blacklist',
                country: manualCountry
            }, { headers });
            
            if (showToast) showToast(`IP ${manualIp} has been blacklisted.`, 'success');
            setManualIp('');
            setManualReason('');
            setShowBanModal(false);
            fetchThreatData(true);
        } catch (err) {
            if (showToast) showToast('Failed to ban IP address', 'error');
        } finally {
            setBanning(false);
        }
    };

    // Ban a threat point directly from the selected threat inspector
    const handleBanSelectedThreat = async (threat) => {
        if (!threat?.ip) return;
        setBanning(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const { city, countryName, code } = resolveThreatLabel(threat);
            await axios.post(`${API_BASE}/firewall/ban-ip`, {
                ip: threat.ip,
                reason: threat.tactic || 'Threat Radar – Admin Blacklist',
                country: code,
                countryName
            }, { headers });
            if (showToast) showToast(`IP ${threat.ip} (${countryName}) blacklisted.`, 'success');
            setSelectedThreat(null);
            fetchThreatData(true);
        } catch (err) {
            if (showToast) showToast(`Failed to blacklist IP: ${err?.response?.data?.error || err.message}`, 'error');
        } finally {
            setBanning(false);
        }
    };

    const handleUnbanIp = async (ip) => {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post(`${API_BASE}/firewall/unban-ip`, { ip }, { headers });
            if (showToast) showToast(`IP ${ip} released from blacklist.`, 'info');
            fetchThreatData(true);
        } catch (err) {
            if (showToast) showToast('Failed to unban IP', 'error');
        }
    };

    const handleToggleGeofenceCountry = async (countryCode) => {
        const currentList = geofence.blockedCountries || [];
        const updatedList = currentList.includes(countryCode)
            ? currentList.filter(c => c !== countryCode)
            : [...currentList, countryCode];

        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post(`${API_BASE}/firewall/geofence`, {
                mode: geofence.mode,
                blockedCountries: updatedList
            }, { headers });
            setGeofence(prev => ({ ...prev, blockedCountries: updatedList }));
            if (showToast) showToast(`Updated geofencing policy for ${countryCode}.`, 'success');
        } catch (err) {
            if (showToast) showToast('Failed to update geofence policy', 'error');
        }
    };

    // Convert lat/lng to SVG percentage coordinates (Equirectangular projection)
    const projectCoordinates = (lat, lng) => {
        const x = ((lng + 180) / 360) * 100;
        const y = ((90 - lat) / 180) * 100;
        return { x: `${x}%`, y: `${y}%` };
    };

    const threats = threatMapData?.activeThreats || [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Top Threat Intel Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Active Intrusion Vectors</span>
                        <Radio size={18} color="var(--accent-rose)" style={{ animation: 'pulse 1.5s infinite' }} />
                    </div>
                    <span style={{ fontSize: '28px', fontWeight: '900', color: 'var(--accent-rose)' }}>{threats.filter(t => t.severity !== 'clean').length}</span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Real-time origin coordinates tracked</span>
                </div>

                <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Perimeter IP Blacklist</span>
                        <Lock size={18} color="var(--primary)" />
                    </div>
                    <span style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-primary)' }}>{bannedIps.length}</span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Active firewall drop rules</span>
                </div>

                <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Geofence Shield</span>
                        <Globe size={18} color="#10b981" />
                    </div>
                    <span style={{ fontSize: '28px', fontWeight: '900', color: '#10b981' }}>{(geofence.blockedCountries || []).length} Blocked</span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>High-risk nation-state filter active</span>
                </div>
            </div>

            {/* Holographic World Attack Radar */}
            <div className="glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)', boxShadow: 'var(--shadow-md)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Globe size={20} color="var(--primary)" /> Holographic Global Intrusion Radar
                        </h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                            Real-time origin mapping of brute-force attempts, MITRE ATT&CK vectors, and trusted cluster nodes
                        </p>
                    </div>
                    <button 
                        className="btn-primary" 
                        onClick={() => setShowBanModal(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', fontSize: '12.5px', fontWeight: '800' }}
                    >
                        <Plus size={15} /> Ban Malicious IP
                    </button>
                </div>

                {/* World Map Container */}
                <div style={{ position: 'relative', width: '100%', height: '420px', borderRadius: '16px', background: 'radial-gradient(ellipse at center, #0a0f1d 0%, #030712 100%)', border: '1px solid rgba(99, 102, 241, 0.25)', overflow: 'hidden', boxShadow: 'inset 0 0 40px rgba(0,0,0,0.8)' }}>
                    
                    {/* High-Resolution SVG World Map with Real Continents */}
                    <svg viewBox="0 0 1000 500" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                        <defs>
                            {/* Grid Pattern */}
                            <pattern id="radar-grid" width="50" height="50" patternUnits="userSpaceOnUse">
                                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(99, 102, 241, 0.08)" strokeWidth="0.5" />
                            </pattern>
                            {/* Radar Sweep Gradient */}
                            <linearGradient id="sweep-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="rgba(99, 102, 241, 0)" />
                                <stop offset="85%" stopColor="rgba(99, 102, 241, 0.08)" />
                                <stop offset="100%" stopColor="rgba(99, 102, 241, 0.35)" />
                            </linearGradient>
                            {/* Continent Glow */}
                            <filter id="continent-glow" x="-10%" y="-10%" width="120%" height="120%">
                                <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="rgba(99, 102, 241, 0.3)" />
                            </filter>
                        </defs>

                        {/* Background Graticule Grid */}
                        <rect width="1000" height="500" fill="url(#radar-grid)" />

                        {/* Equator and Meridian Guide Lines */}
                        <line x1="0" y1="250" x2="1000" y2="250" stroke="rgba(99, 102, 241, 0.2)" strokeWidth="1" strokeDasharray="4 4" />
                        <line x1="500" y1="0" x2="500" y2="500" stroke="rgba(99, 102, 241, 0.2)" strokeWidth="1" strokeDasharray="4 4" />
                        <line x1="0" y1="125" x2="1000" y2="125" stroke="rgba(99, 102, 241, 0.1)" strokeWidth="0.5" strokeDasharray="2 6" />
                        <line x1="0" y1="375" x2="1000" y2="375" stroke="rgba(99, 102, 241, 0.1)" strokeWidth="0.5" strokeDasharray="2 6" />

                        {/* Real World Continents Geo-Paths */}
                        <g fill="rgba(30, 41, 59, 0.75)" stroke="rgba(99, 102, 241, 0.45)" strokeWidth="1" strokeLinejoin="round" filter="url(#continent-glow)">
                            {/* North America */}
                            <path d="M 80,60 L 110,50 L 160,45 L 210,55 L 250,50 L 290,65 L 280,100 L 240,110 L 220,95 L 205,115 L 225,140 L 245,145 L 235,175 L 215,195 L 200,230 L 180,245 L 160,205 L 140,195 L 110,185 L 85,150 L 60,115 L 65,85 Z" />
                            {/* Greenland */}
                            <path d="M 330,35 L 390,30 L 410,60 L 370,85 L 340,75 Z" />
                            {/* Central America & Caribbean */}
                            <path d="M 180,245 L 205,260 L 235,275 L 225,285 L 200,270 L 175,250 Z" />
                            <circle cx="230" cy="235" r="3" />
                            <circle cx="245" cy="240" r="3" />
                            <circle cx="260" cy="245" r="2" />

                            {/* South America */}
                            <path d="M 235,280 L 275,275 L 320,295 L 350,325 L 360,360 L 330,410 L 300,455 L 280,480 L 270,470 L 275,420 L 260,370 L 240,320 L 225,290 Z" />

                            {/* Europe & Scandinavia */}
                            <path d="M 460,165 L 485,145 L 475,120 L 490,90 L 515,75 L 530,95 L 520,130 L 550,135 L 565,115 L 585,130 L 560,165 L 535,170 L 510,195 L 485,195 L 465,185 Z" />
                            {/* United Kingdom & Ireland */}
                            <path d="M 460,110 L 475,100 L 480,125 L 465,140 Z" />
                            <path d="M 445,120 L 455,115 L 455,130 L 445,135 Z" />

                            {/* Africa */}
                            <path d="M 470,195 L 540,190 L 580,215 L 635,265 L 605,310 L 590,360 L 565,420 L 535,445 L 515,430 L 500,370 L 470,300 L 450,250 L 455,210 Z" />
                            {/* Madagascar */}
                            <path d="M 625,370 L 640,365 L 635,410 L 620,415 Z" />

                            {/* Asia */}
                            <path d="M 565,115 L 620,95 L 690,75 L 770,70 L 860,85 L 890,120 L 855,150 L 870,185 L 830,205 L 800,265 L 750,270 L 730,240 L 690,245 L 665,225 L 620,240 L 585,215 L 575,165 L 560,135 Z" />
                            {/* India */}
                            <path d="M 680,240 L 730,240 L 715,295 L 695,305 L 680,270 Z" />
                            {/* Japan */}
                            <path d="M 875,150 L 895,140 L 890,185 L 870,195 Z" />
                            {/* Southeast Asia & Indonesia */}
                            <path d="M 750,270 L 780,275 L 775,320 L 755,315 Z" />
                            <path d="M 770,340 L 820,335 L 840,350 L 780,360 Z" />
                            <path d="M 825,315 L 860,310 L 850,335 Z" />
                            <circle cx="830" cy="275" r="4" />

                            {/* Australia & New Zealand */}
                            <path d="M 790,370 L 845,360 L 890,380 L 895,430 L 865,455 L 815,450 L 780,410 Z" />
                            <path d="M 915,420 L 930,415 L 920,455 L 905,450 Z" />
                        </g>

                        {/* Animated Holographic Radar Sweep Beam */}
                        <g>
                            <rect x="0" y="0" width="120" height="500" fill="url(#sweep-grad)">
                                <animate attributeName="x" from="-120" to="1000" dur="5s" repeatCount="indefinite" />
                            </rect>
                            <line x1="120" y1="0" x2="120" y2="500" stroke="rgba(99, 102, 241, 0.8)" strokeWidth="1.5">
                                <animate attributeName="x1" from="0" to="1120" dur="5s" repeatCount="indefinite" />
                                <animate attributeName="x2" from="0" to="1120" dur="5s" repeatCount="indefinite" />
                            </line>
                        </g>

                        {/* Latitude / Longitude Labels */}
                        <text x="10" y="245" fill="rgba(99, 102, 241, 0.4)" fontSize="10" fontFamily="monospace">EQUATOR 0°</text>
                        <text x="490" y="18" fill="rgba(99, 102, 241, 0.4)" fontSize="10" fontFamily="monospace" textAnchor="end">PRIME MERIDIAN 0°</text>
                        <text x="10" y="120" fill="rgba(99, 102, 241, 0.3)" fontSize="9" fontFamily="monospace">TROPIC OF CANCER 23.5°N</text>
                        <text x="10" y="370" fill="rgba(99, 102, 241, 0.3)" fontSize="9" fontFamily="monospace">TROPIC OF CAPRICORN 23.5°S</text>
                    </svg>

                    {/* Attack and Node Beacon Points */}
                    {threats.map((t) => {
                        const { x, y } = projectCoordinates(t.lat, t.lng);
                        const isCrit = t.severity === 'critical';
                        const isSafe = t.severity === 'clean';
                        
                        const color = isSafe ? '#10b981' : isCrit ? '#f43f5e' : '#f59e0b';
                        const isSelected = selectedThreat?.id === t.id;
                        const { city, countryName, code } = resolveThreatLabel(t);

                        return (
                            <div 
                                key={t.id}
                                onClick={() => setSelectedThreat(t)}
                                style={{
                                    position: 'absolute',
                                    left: x,
                                    top: y,
                                    transform: 'translate(-50%, -50%)',
                                    cursor: 'pointer',
                                    zIndex: isSelected ? 40 : 20,
                                    transition: 'transform 0.2s ease'
                                }}
                            >
                                {/* Ripple Animation */}
                                <div style={{
                                    position: 'absolute',
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '50%',
                                    background: color,
                                    opacity: 0.35,
                                    transform: 'translate(-50%, -50%)',
                                    top: '50%',
                                    left: '50%',
                                    animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite'
                                }} />
                                {/* Outer Ring */}
                                <div style={{
                                    position: 'absolute',
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    border: `1.5px solid ${color}`,
                                    transform: 'translate(-50%, -50%)',
                                    top: '50%',
                                    left: '50%',
                                    opacity: 0.8
                                }} />
                                {/* Center Glowing Dot */}
                                <div style={{
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    background: color,
                                    boxShadow: `0 0 14px ${color}, 0 0 4px #ffffff`,
                                    border: '2px solid #ffffff'
                                }} />

                                {/* Interactive Mini Tag */}
                                <div style={{
                                    position: 'absolute',
                                    bottom: '18px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    whiteSpace: 'nowrap',
                                    background: 'rgba(3, 7, 18, 0.92)',
                                    border: `1px solid ${color}`,
                                    borderRadius: '6px',
                                    padding: '2px 8px',
                                    fontSize: '10.5px',
                                    fontWeight: '800',
                                    color: '#ffffff',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                    pointerEvents: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
                                    {city} {code !== 'XX' && code !== 'LOCAL' ? `(${code})` : ''}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Selected Threat Inspector */}
                {selectedThreat && (() => {
                    const { city, countryName, code } = resolveThreatLabel(selectedThreat);
                    const sevColor = selectedThreat.severity === 'clean' ? '#10b981' : selectedThreat.severity === 'critical' ? '#f43f5e' : '#f59e0b';
                    return (
                        <div style={{ marginTop: '16px', padding: '16px', borderRadius: '12px', background: 'var(--bg-surface-2)', border: `1px solid ${sevColor}33`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '800', color: sevColor, textTransform: 'uppercase' }}>
                                        {selectedThreat.severity.toUpperCase()} ORIGIN:
                                    </span>
                                    <strong style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
                                        {selectedThreat.ip}
                                        <span style={{ fontWeight: '400', color: 'var(--text-secondary)', marginLeft: '6px' }}>
                                            ({city}, {countryName}{code !== 'XX' ? ` · ${code}` : ''})
                                        </span>
                                    </strong>
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                    Tactic: <code>{selectedThreat.tactic}</code> • Detected: {new Date(selectedThreat.timestamp).toLocaleTimeString()}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button 
                                    className="btn-danger" 
                                    onClick={() => handleBanSelectedThreat(selectedThreat)}
                                    disabled={banning}
                                    style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', opacity: banning ? 0.6 : 1 }}
                                >
                                    {banning ? 'Banning...' : 'Blacklist IP'}
                                </button>
                                <button 
                                    className="btn-secondary" 
                                    onClick={() => setSelectedThreat(null)}
                                    style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px' }}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* Perimeter Firewall Blacklist & Geofence Matrix */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
                {/* Banned IPs Table */}
                <div className="glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Lock size={16} color="var(--primary)" /> Active Firewall Blacklist ({bannedIps.length})
                        </h4>
                    </div>

                    {bannedIps.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dim)', fontSize: '13px' }}>
                            No IP addresses currently blacklisted.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {bannedIps.map((b) => (
                                <div key={b.ip} style={{ padding: '12px 14px', borderRadius: '12px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--text-primary)', fontSize: '13px' }}>{b.ip}</span>
                                            <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(244, 63, 94, 0.12)', color: '#f43f5e', fontWeight: '800' }}>{b.country}</span>
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                                            {b.reason} • {b.attempts} attempts
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleUnbanIp(b.ip)}
                                        className="btn-secondary shadow-premium"
                                        title="Release from blacklist"
                                        style={{ padding: '6px 10px', borderRadius: '8px', fontSize: '11.5px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        <Unlock size={12} /> Unban
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Country Geofencing Controls */}
                <div className="glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)', boxShadow: 'var(--shadow-sm)' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Globe size={16} color="#10b981" /> High-Risk Nation-State Geofencing
                    </h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
                        Toggle automatic inbound dropping for specific geographic country zones.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                        {[
                            { code: 'RU', name: 'Russia' },
                            { code: 'CN', name: 'China' },
                            { code: 'KP', name: 'North Korea' },
                            { code: 'IR', name: 'Iran' },
                            { code: 'VN', name: 'Vietnam' },
                            { code: 'BR', name: 'Brazil' }
                        ].map((c) => {
                            const isBlocked = (geofence.blockedCountries || []).includes(c.code);
                            return (
                                <div 
                                    key={c.code}
                                    onClick={() => handleToggleGeofenceCountry(c.code)}
                                    style={{
                                        padding: '12px',
                                        borderRadius: '12px',
                                        background: isBlocked ? 'rgba(244, 63, 94, 0.08)' : 'var(--bg-surface-2)',
                                        border: `1px solid ${isBlocked ? 'rgba(244, 63, 94, 0.3)' : 'var(--border-subtle)'}`,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        transition: '0.2s'
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: '800', color: isBlocked ? '#f43f5e' : 'var(--text-primary)', fontSize: '12.5px' }}>{c.name}</div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>ISO: {c.code}</div>
                                    </div>
                                    <span style={{
                                        fontSize: '10px',
                                        fontWeight: '800',
                                        padding: '3px 6px',
                                        borderRadius: '4px',
                                        background: isBlocked ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                        color: isBlocked ? '#f43f5e' : '#10b981'
                                    }}>
                                        {isBlocked ? 'BLOCKED' : 'ALLOWED'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Manual Ban Modal */}
            {showBanModal && (
                <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setShowBanModal(false)}>
                    <div className="modal-content glass" style={{ width: '460px', padding: '28px', textAlign: 'left', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '24px', boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>Blacklist IP Address</h3>
                        <form onSubmit={handleBanIp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px' }}>IP Address / CIDR *</label>
                                <input 
                                    className="m-input"
                                    required
                                    placeholder="e.g. 192.0.2.1 or 198.51.100.0/24"
                                    value={manualIp}
                                    onChange={e => setManualIp(e.target.value)}
                                    style={{ width: '100%', outline: 'none' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px' }}>Ban Reason</label>
                                <input 
                                    className="m-input"
                                    placeholder="e.g. Suspicious brute force probe"
                                    value={manualReason}
                                    onChange={e => setManualReason(e.target.value)}
                                    style={{ width: '100%', outline: 'none' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button type="button" className="btn-secondary" style={{ flex: 1, padding: '10px' }} onClick={() => setShowBanModal(false)}>Cancel</button>
                                <button type="submit" className="btn-danger" style={{ flex: 1, padding: '10px', fontWeight: '800' }} disabled={banning}>
                                    {banning ? 'Blacklisting...' : 'Drop Traffic (Ban)'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttackGeoMap;
