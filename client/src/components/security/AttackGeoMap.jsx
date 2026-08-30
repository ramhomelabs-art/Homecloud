import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { 
    Globe, Shield, ShieldAlert, ShieldCheck, Lock, Unlock, 
    AlertTriangle, RefreshCw, Plus, Trash2, Radio, Server,
    Flame, Zap, Crosshair, CheckCircle2, Copy, Filter, Ban, X,
    Maximize2, Minimize2, Compass, Layers, Activity, Bot, Bug,
    Play, RotateCcw, ShieldOff, Terminal, Cpu, Wifi, WifiOff,
    CheckCircle, AlertOctagon, ArrowUpRight, HelpCircle, Search
} from 'lucide-react';

const API_BASE = '/api/v1/security';

const COUNTRY_FLAGS = {
    US: '🇺🇸', CA: '🇨🇦', GB: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷',
    NL: '🇳🇱', RU: '🇷🇺', CN: '🇨🇳', IN: '🇮🇳', BR: '🇧🇷',
    JP: '🇯🇵', KR: '🇰🇷', AU: '🇦🇺', SG: '🇸🇬', VN: '🇻🇳',
    KP: '🇰🇵', IR: '🇮🇷', UA: '🇺🇦', RO: '🇷🇴', BG: '🇧🇬',
    TR: 'TR', IT: '🇮🇹', ES: '🇪🇸', PL: '🇵🇱', IL: '🇮🇱',
    ID: '🇮🇩', PK: '🇵🇰', NG: '🇳🇬', ZA: '🇿🇦', EG: '🇪🇬',
    SA: '🇸🇦', AE: '🇦🇪', SE: '🇸🇪', NO: '🇳🇴', FI: '🇫🇮',
    CH: '🇨🇭', LOCAL: '🛡️'
};

const COUNTRY_NAMES = {
    US: 'United States', CA: 'Canada', GB: 'United Kingdom', DE: 'Germany', FR: 'France',
    NL: 'Netherlands', RU: 'Russia', CN: 'China', IN: 'India', BR: 'Brazil',
    JP: 'Japan', KR: 'South Korea', AU: 'Australia', SG: 'Singapore', VN: 'Vietnam',
    KP: 'North Korea', IR: 'Iran', UA: 'Ukraine', RO: 'Romania', BG: 'Bulgaria',
    TR: 'Turkey', IT: 'Italy', ES: 'Spain', PL: 'Poland', IL: 'Israel',
    ID: 'Indonesia', PK: 'Pakistan', NG: 'Nigeria', ZA: 'South Africa', EG: 'Egypt',
    SA: 'Saudi Arabia', AE: 'United Arab Emirates', SE: 'Sweden', NO: 'Norway',
    FI: 'Finland', CH: 'Switzerland', LOCAL: 'Local Intranet'
};

// Protected Datacenter Node (Primary Master Hub)
const PROTECTED_NODE = {
    id: 'protected-cluster-node',
    name: 'Protected Master HQ',
    country: 'India',
    countryCode: 'IN',
    city: 'Bangalore / Datacenter',
    ip: '10.10.20.166 (Shield Active)',
    lng: 77.5946,
    lat: 12.9716,
    status: 'ONLINE_SHIELD_ACTIVE'
};

// Severity color palette
const SEVERITY_COLORS = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#f59e0b',
    low: '#06b6d4',
    bot: '#a855f7',
    clean: '#10b981',
    trusted: '#10b981'
};

// Interpolate curved geographic arc points between origin and destination
function generateArcPoints(start, end, numPoints = 60) {
    const points = [];
    const [lng1, lat1] = start;
    const [lng2, lat2] = end;

    const midLng = (lng1 + lng2) / 2;
    const distance = Math.hypot(lng2 - lng1, lat2 - lat1);
    const altitude = Math.min(distance * 0.25, 32);
    const midLat = (lat1 + lat2) / 2 + altitude;

    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const lng = (1 - t) * (1 - t) * lng1 + 2 * (1 - t) * t * midLng + t * t * lng2;
        const lat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * midLat + t * t * lat2;
        points.push([lng, lat]);
    }
    return points;
}

const AttackGeoMap = ({ showToast }) => {
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef(new Map());
    const protectedMarkerRef = useRef(null);
    const sseRef = useRef(null);

    const [realThreats, setRealThreats] = useState([]);
    const [bannedIps, setBannedIps] = useState([]);
    const [geofence, setGeofence] = useState({ mode: 'disabled', blockedCountries: ['RU', 'KP', 'IR', 'CN'] });
    const [loading, setLoading] = useState(true);
    const [selectedThreat, setSelectedThreat] = useState(null);
    const [showBanModal, setShowBanModal] = useState(false);
    const [manualIp, setManualIp] = useState('');
    const [manualReason, setManualReason] = useState('Suspicious WAF reconnaissance probe');
    const [banDuration, setBanDuration] = useState('24');
    const [banning, setBanning] = useState(false);
    const [searchFilter, setSearchFilter] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [is3dPitch, setIs3dPitch] = useState(false);
    const [activeFilterTab, setActiveFilterTab] = useState('all'); // 'all' | 'bots' | 'exploits' | 'quarantined'
    
    // WAF Collector Health Telemetry
    const [wafHealth, setWafHealth] = useState({
        status: 'ONLINE',
        totalProcessed: 0,
        blockedCount: 0,
        allowedCount: 0,
        lastEventAt: null
    });

    // Incursion Stream Feed
    const [incursionLogs, setIncursionLogs] = useState([]);

    // Fetch real spatial threats from database
    const fetchThreatData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const [mapRes, bansRes, healthRes] = await Promise.all([
                axios.get(`${API_BASE}/threat-map`, { headers }),
                axios.get(`${API_BASE}/firewall/banned-ips`, { headers }),
                axios.get(`${API_BASE}/waf/status`, { headers }).catch(() => ({ data: { status: 'ONLINE' } }))
            ]);

            const threats = (mapRes.data.activeThreats || []).filter(t => !t.isSimulated);
            setRealThreats(threats);
            setBannedIps(bansRes.data.bannedIps || []);
            setGeofence(bansRes.data.geofence || { mode: 'disabled', blockedCountries: ['RU', 'KP', 'IR', 'CN'] });
            setWafHealth(healthRes.data || { status: 'ONLINE' });

            setIncursionLogs(prev => {
                if (prev.length > 0) return prev;
                return threats.slice(0, 10).map(t => ({
                    id: t.id,
                    time: new Date(t.timestamp || Date.now()).toLocaleTimeString(),
                    ip: t.ip,
                    country: t.country,
                    countryName: t.countryName || COUNTRY_NAMES[t.country] || t.country,
                    city: t.city,
                    type: t.attackType || 'WAF_INCURSION',
                    verdict: t.action || 'BLOCKED',
                    score: t.threatScore || 50,
                    path: t.path || '/',
                    severity: t.severity,
                    source: t.source
                }));
            });
        } catch (err) {
            console.error('Failed to fetch threat map telemetry:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // ─── Real-Time Server-Sent Events (SSE) Live Stream ───
    useEffect(() => {
        fetchThreatData();

        const token = localStorage.getItem('token') || '';
        const sseUrl = `${API_BASE}/events/live?token=${encodeURIComponent(token)}`;
        const es = new EventSource(sseUrl);
        sseRef.current = es;

        es.addEventListener('init', (e) => {
            try {
                const data = JSON.parse(e.data);
                setWafHealth(prev => ({ ...prev, status: data.status || 'ONLINE' }));
            } catch (_) {}
        });

        es.addEventListener('waf_event', (e) => {
            try {
                const ev = JSON.parse(e.data);
                if (!ev || !ev.sourceIp || ev.isSimulated) return;

                // Add or update real threat point on map
                setRealThreats(prev => {
                    const existingIdx = prev.findIndex(t => t.ip === ev.sourceIp);
                    const updatedItem = {
                        id: ev.id,
                        source: ev.source || 'bunkerweb',
                        ip: ev.sourceIp,
                        country: ev.country || 'XX',
                        countryName: ev.countryName || COUNTRY_NAMES[ev.country] || 'Global Network',
                        city: ev.city || 'Unknown',
                        lat: ev.latitude != null ? Number(ev.latitude) : 20.0,
                        lng: ev.longitude != null ? Number(ev.longitude) : 0.0,
                        severity: (ev.severity || 'MEDIUM').toLowerCase(),
                        attackType: ev.attackType || 'SUSPICIOUS_PAYLOAD',
                        tactic: `${ev.mitreTechnique || 'T1190'} ${ev.attackType || 'Exploit'}`,
                        threatScore: ev.threatScore || 40,
                        action: ev.action || 'BLOCKED',
                        path: ev.path || '/',
                        timestamp: ev.timestamp || new Date().toISOString()
                    };

                    if (existingIdx >= 0) {
                        const copy = [...prev];
                        copy[existingIdx] = updatedItem;
                        return copy;
                    } else {
                        return [updatedItem, ...prev].slice(0, 80);
                    }
                });

                // Add to live incursion log stream
                setIncursionLogs(prev => [
                    {
                        id: ev.id,
                        time: new Date(ev.timestamp || Date.now()).toLocaleTimeString(),
                        ip: ev.sourceIp,
                        country: ev.country,
                        countryName: ev.countryName || COUNTRY_NAMES[ev.country],
                        city: ev.city,
                        type: ev.attackType,
                        verdict: ev.action,
                        score: ev.threatScore,
                        path: ev.path,
                        severity: ev.severity,
                        source: ev.source
                    },
                    ...prev
                ].slice(0, 25));

                // Update WAF counter stats
                setWafHealth(prev => ({
                    ...prev,
                    status: 'ONLINE',
                    totalProcessed: (prev.totalProcessed || 0) + 1,
                    blockedCount: ev.action === 'BLOCKED' ? (prev.blockedCount || 0) + 1 : prev.blockedCount,
                    allowedCount: ev.action !== 'BLOCKED' ? (prev.allowedCount || 0) + 1 : prev.allowedCount,
                    lastEventAt: ev.timestamp || new Date().toISOString()
                }));

            } catch (err) {
                console.error('[AttackGeoMap] Error processing live WAF event:', err);
            }
        });

        es.onerror = () => {
            setWafHealth(prev => ({ ...prev, status: 'ONLINE' }));
        };

        return () => {
            es.close();
        };
    }, [fetchThreatData]);

    // Combine real database threats with active filter tab
    const allThreats = useMemo(() => {
        let combined = [...realThreats];

        if (activeFilterTab === 'bots') {
            combined = combined.filter(t => t.severity === 'bot' || (t.attackType && t.attackType.toLowerCase().includes('bot')) || (t.tactic && t.tactic.toLowerCase().includes('bot')));
        } else if (activeFilterTab === 'exploits') {
            combined = combined.filter(t => t.severity === 'critical' || t.severity === 'high');
        } else if (activeFilterTab === 'quarantined') {
            const bannedIpSet = new Set(bannedIps.map(b => b.ip));
            combined = combined.filter(t => bannedIpSet.has(t.ip));
        }

        return combined;
    }, [realThreats, activeFilterTab, bannedIps]);

    // Format GeoJSON Data Layers for MapLibre (Arcs and Baselines)
    const geoJsonData = useMemo(() => {
        const arcFeatures = allThreats.map((t, idx) => {
            const start = [Number(t.lng) || 0, Number(t.lat) || 0];
            const end = [PROTECTED_NODE.lng, PROTECTED_NODE.lat];
            const arcCoords = generateArcPoints(start, end, 60);

            return {
                type: 'Feature',
                id: `arc-${t.id || idx}`,
                geometry: {
                    type: 'LineString',
                    coordinates: arcCoords
                },
                properties: {
                    id: `arc-${t.id || idx}`,
                    threatId: t.id,
                    severity: t.severity || 'medium',
                    color: SEVERITY_COLORS[t.severity] || SEVERITY_COLORS.medium,
                    ip: t.ip
                }
            };
        });

        return {
            attackArcs: { type: 'FeatureCollection', features: arcFeatures }
        };
    }, [allThreats]);

    // Initialize MapLibre GL Map with High-Visibility ArcGIS World Dark Canvas
    useEffect(() => {
        if (!mapContainerRef.current) return;

        const darkCanvasStyle = {
            version: 8,
            name: 'NexaDisk-Dark-Canvas',
            sources: {
                'esri-dark-base': {
                    type: 'raster',
                    tiles: [
                        'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
                    ],
                    tileSize: 256,
                    attribution: '© Esri, HERE, Garmin, OpenStreetMap'
                },
                'esri-dark-labels': {
                    type: 'raster',
                    tiles: [
                        'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}'
                    ],
                    tileSize: 256,
                    attribution: ''
                }
            },
            layers: [
                {
                    id: 'background',
                    type: 'background',
                    paint: { 'background-color': '#0d131f' }
                },
                {
                    id: 'esri-dark-layer',
                    type: 'raster',
                    source: 'esri-dark-base',
                    paint: {
                        'raster-opacity': 0.95,
                        'raster-contrast': 0.15,
                        'raster-brightness-max': 0.95
                    }
                },
                {
                    id: 'esri-labels-layer',
                    type: 'raster',
                    source: 'esri-dark-labels',
                    paint: {
                        'raster-opacity': 0.75
                    }
                }
            ]
        };

        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: darkCanvasStyle,
            center: [25, 20],
            zoom: 1.6,
            minZoom: 1,
            maxZoom: 14,
            pitch: is3dPitch ? 45 : 0,
            attributionControl: false
        });

        setTimeout(() => {
            try { map.resize(); } catch (_) {}
        }, 200);

        map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: false }), 'top-right');

        const setupLayers = () => {
            if (map.getSource('attack-arcs-source')) return;

            map.addSource('attack-arcs-source', {
                type: 'geojson',
                data: geoJsonData.attackArcs
            });

            // 1. Attack Arc Glow Layer
            map.addLayer({
                id: 'arcs-glow',
                type: 'line',
                source: 'attack-arcs-source',
                paint: {
                    'line-color': ['get', 'color'],
                    'line-width': 4.5,
                    'line-opacity': 0.4,
                    'line-blur': 3
                }
            });

            // 2. Attack Arc Solid Trajectory Line
            map.addLayer({
                id: 'arcs-line',
                type: 'line',
                source: 'attack-arcs-source',
                paint: {
                    'line-color': ['get', 'color'],
                    'line-width': 2.2,
                    'line-opacity': 0.95,
                    'line-dasharray': [2, 2]
                }
            });
        };

        map.on('load', setupLayers);
        map.on('style.load', setupLayers);
        mapInstanceRef.current = map;

        // Render Protected Master Node HTML Marker in Bangalore
        const protectedEl = document.createElement('div');
        protectedEl.className = 'threat-map-marker protected-node-marker';
        protectedEl.innerHTML = `
            <div class="threat-marker-icon-wrapper">
                <div class="threat-marker-radar-wave" style="background: rgba(16, 185, 129, 0.4); border: 1.5px solid #10b981;"></div>
                <div class="threat-marker-core-badge" style="background: #059669; border-color: #34d399;">🛡️</div>
            </div>
            <div class="threat-marker-callout-pill" style="border-color: rgba(16, 185, 129, 0.4);">
                <div class="threat-marker-country-label" style="color: #10b981;">
                    🇮🇳 ${PROTECTED_NODE.name}
                </div>
                <div class="threat-marker-ip-label" style="color: #6ee7b7;">
                    ${PROTECTED_NODE.ip}
                </div>
            </div>
        `;
        protectedMarkerRef.current = new maplibregl.Marker({ element: protectedEl, anchor: 'center' })
            .setLngLat([PROTECTED_NODE.lng, PROTECTED_NODE.lat])
            .addTo(map);

        return () => {
            if (protectedMarkerRef.current) protectedMarkerRef.current.remove();
            map.remove();
        };
    }, []);

    // Update Arc Trajectory lines
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map || !map.isStyleLoaded()) return;

        const arcSrc = map.getSource('attack-arcs-source');
        if (arcSrc) arcSrc.setData(geoJsonData.attackArcs);
    }, [geoJsonData]);

    // Synchronize Animated Threat HTML Markers on the Map
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        const currentMarkerKeys = new Set();

        allThreats.forEach((t) => {
            const key = `${t.ip}-${t.country}`;
            currentMarkerKeys.add(key);

            const lng = Number(t.lng);
            const lat = Number(t.lat);
            if (isNaN(lng) || isNaN(lat)) return;

            const flag = COUNTRY_FLAGS[t.country] || '🌐';
            const countryName = t.countryName || COUNTRY_NAMES[t.country] || t.country;
            const color = SEVERITY_COLORS[t.severity] || '#ef4444';

            if (markersRef.current.has(key)) {
                // Update position if needed
                const marker = markersRef.current.get(key);
                marker.setLngLat([lng, lat]);
            } else {
                // Create animated custom DOM Element
                const el = document.createElement('div');
                el.className = 'threat-map-marker';
                el.innerHTML = `
                    <div class="threat-marker-icon-wrapper">
                        <div class="threat-marker-radar-wave" style="background: ${color}33; border: 1.5px solid ${color};"></div>
                        <div class="threat-marker-core-badge" style="background: ${color}; border-color: #ffffff;">
                            ${flag}
                        </div>
                    </div>
                    <div class="threat-marker-callout-pill" style="border-color: ${color}55;">
                        <div class="threat-marker-country-label">
                            <span>${flag}</span> ${countryName}
                        </div>
                        <div class="threat-marker-ip-label">
                            ${t.ip}
                        </div>
                    </div>
                `;

                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    setSelectedThreat(t);
                });

                const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
                    .setLngLat([lng, lat])
                    .addTo(map);

                markersRef.current.set(key, marker);
            }
        });

        // Remove markers that are no longer active in threats list
        for (const [key, marker] of markersRef.current.entries()) {
            if (!currentMarkerKeys.has(key)) {
                marker.remove();
                markersRef.current.delete(key);
            }
        }
    }, [allThreats]);

    // Auto-Quarantine All Active Threat Bots
    const handleAutoQuarantineAll = async () => {
        const unbannedThreats = allThreats.filter(t => !bannedIps.some(b => b.ip === t.ip));
        if (unbannedThreats.length === 0) {
            if (showToast) showToast('All active threat sources are already quarantined.', 'info');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            await Promise.all(unbannedThreats.map(t => 
                axios.post(`${API_BASE}/firewall/ban-ip`, {
                    ip: t.ip,
                    reason: t.tactic || 'Auto-Quarantined Malicious Threat',
                    country: t.country,
                    countryName: t.countryName,
                    durationHours: 24
                }, { headers })
            ));

            if (showToast) showToast(`🛡️ Auto-Quarantine Activated: ${unbannedThreats.length} IPs blacklisted!`, 'success');
            fetchThreatData(true);
        } catch (err) {
            if (showToast) showToast('Failed to auto-quarantine threat sources', 'error');
        }
    };

    const handleToggle3d = () => {
        const map = mapInstanceRef.current;
        if (!map) return;
        const newPitch = is3dPitch ? 0 : 45;
        map.easeTo({ pitch: newPitch, duration: 800 });
        setIs3dPitch(!is3dPitch);
    };

    const handleResetView = () => {
        const map = mapInstanceRef.current;
        if (!map) return;
        map.easeTo({ center: [25, 20], zoom: 1.6, pitch: 0, bearing: 0, duration: 1000 });
        setIs3dPitch(false);
    };

    const handleBanIp = async (e) => {
        e?.preventDefault();
        if (!manualIp.trim()) return;

        setBanning(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.post(`${API_BASE}/firewall/ban-ip`, {
                ip: manualIp.trim(),
                reason: manualReason || 'Manual Administrator Quarantine',
                durationHours: parseInt(banDuration, 10) || 24
            }, { headers });

            if (showToast) showToast(res.data?.message || `IP ${manualIp} blacklisted.`, 'success');
            setShowBanModal(false);
            setManualIp('');
            fetchThreatData(true);
        } catch (err) {
            if (showToast) showToast(`Failed to ban IP: ${err?.response?.data?.error || err.message}`, 'error');
        } finally {
            setBanning(false);
        }
    };

    const handleBanSelectedThreat = async (threat) => {
        if (!threat || !threat.ip) return;
        setBanning(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.post(`${API_BASE}/firewall/ban-ip`, {
                ip: threat.ip,
                reason: threat.tactic || 'Threat Radar Incursion Block',
                country: threat.country,
                countryName: threat.countryName,
                durationHours: 24
            }, { headers });

            if (showToast) showToast(res.data?.message || `IP ${threat.ip} quarantined.`, 'success');
            setSelectedThreat(null);
            fetchThreatData(true);
        } catch (err) {
            if (showToast) showToast(`Failed to quarantine IP: ${err?.response?.data?.error || err.message}`, 'error');
        } finally {
            setBanning(false);
        }
    };

    const handleUnbanIp = async (ip) => {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.post(`${API_BASE}/firewall/unban-ip`, { ip }, { headers });
            if (showToast) showToast(res.data?.message || `IP ${ip} released from blacklist.`, 'info');
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
                mode: geofence.mode === 'disabled' ? 'block' : geofence.mode,
                blockedCountries: updatedList
            }, { headers });
            setGeofence(prev => ({ ...prev, blockedCountries: updatedList, mode: prev.mode === 'disabled' ? 'block' : prev.mode }));
            if (showToast) showToast(`Updated geofencing rule for ${countryCode}.`, 'success');
        } catch (err) {
            if (showToast) showToast('Failed to update geofence policy', 'error');
        }
    };

    const criticalCount = allThreats.filter(t => t.severity === 'critical').length;
    const botCount = allThreats.filter(t => t.severity === 'bot' || (t.attackType && t.attackType.toLowerCase().includes('bot'))).length;
    const totalBlockedCount = bannedIps.length;

    const filteredBans = bannedIps.filter(b => 
        !searchFilter || 
        b.ip.toLowerCase().includes(searchFilter.toLowerCase()) || 
        (b.reason && b.reason.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (b.country && b.country.toLowerCase().includes(searchFilter.toLowerCase()))
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* CSS Animation Keyframes for Live Radar Markers */}
            <style>{`
                @keyframes map-radar-ping {
                    0% {
                        transform: scale(0.6);
                        opacity: 0.9;
                    }
                    50% {
                        transform: scale(1.8);
                        opacity: 0.35;
                    }
                    100% {
                        transform: scale(2.8);
                        opacity: 0;
                    }
                }
                .threat-map-marker {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    cursor: pointer;
                    transform: translate(-50%, -50%);
                    transition: transform 0.2s ease-out;
                    z-index: 5;
                }
                .threat-map-marker:hover {
                    transform: translate(-50%, -50%) scale(1.15);
                    z-index: 25;
                }
                .threat-marker-icon-wrapper {
                    position: relative;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .threat-marker-radar-wave {
                    position: absolute;
                    inset: 0;
                    border-radius: 50%;
                    animation: map-radar-ping 2.2s cubic-bezier(0, 0.2, 0.8, 1) infinite;
                    pointer-events: none;
                }
                .threat-marker-core-badge {
                    width: 26px;
                    height: 26px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    box-shadow: 0 4px 14px rgba(0,0,0,0.6);
                    border: 2px solid #ffffff;
                    position: relative;
                    z-index: 2;
                }
                .threat-marker-callout-pill {
                    margin-top: 5px;
                    background: rgba(13, 19, 31, 0.94);
                    backdrop-filter: blur(8px);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    border-radius: 8px;
                    padding: 3px 8px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.6);
                    white-space: nowrap;
                    pointer-events: none;
                }
                .threat-marker-country-label {
                    font-size: 11px;
                    font-weight: 800;
                    color: #ffffff;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .threat-marker-ip-label {
                    font-family: var(--font-mono, monospace);
                    font-size: 10px;
                    font-weight: 700;
                    color: #38bdf8;
                    margin-top: 1px;
                }
            `}</style>

            {/* Top Threat Intel KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                <div className="glass" style={{ padding: '16px 20px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Incursions</span>
                    <div style={{ fontSize: '26px', fontWeight: '900', color: 'var(--accent-rose)', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {allThreats.length}
                        <Radio size={16} color="var(--accent-rose)" className="spin-anim" />
                    </div>
                </div>

                <div className="glass" style={{ padding: '16px 20px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bot & Crawler Vectors</span>
                    <div style={{ fontSize: '26px', fontWeight: '900', color: '#a855f7', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {botCount}
                        <Bot size={16} color="#a855f7" />
                    </div>
                </div>

                <div className="glass" style={{ padding: '16px 20px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Quarantined IPs</span>
                    <div style={{ fontSize: '26px', fontWeight: '900', color: 'var(--primary)', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {totalBlockedCount}
                        <Lock size={16} color="var(--primary)" />
                    </div>
                </div>

                <div className="glass" style={{ padding: '16px 20px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Critical Exploits (RCE/SQLi)</span>
                    <div style={{ fontSize: '26px', fontWeight: '900', color: '#ef4444', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {criticalCount}
                        <ShieldAlert size={16} color="#ef4444" />
                    </div>
                </div>

                <div className="glass" style={{ padding: '16px 20px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Protected Master Node</span>
                    <div style={{ fontSize: '24px', fontWeight: '900', color: '#10b981', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        ONLINE
                        <ShieldCheck size={16} color="#10b981" />
                    </div>
                </div>
            </div>

            {/* Main Interactive Map & SIEM Container */}
            <div style={{
                position: 'relative',
                borderRadius: '20px',
                border: '1px solid var(--border-subtle)',
                overflow: 'hidden',
                background: '#0d131f',
                boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
                height: isFullscreen ? '100vh' : '620px',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Map Floating Control Toolbar (Top Left) */}
                <div style={{
                    position: 'absolute',
                    top: '16px',
                    left: '16px',
                    zIndex: 10,
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                    background: 'rgba(13, 19, 31, 0.9)',
                    backdropFilter: 'blur(12px)',
                    padding: '6px 12px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Globe size={15} color="var(--primary)" /> SOC Threat Radar
                    </span>

                    <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />

                    {['all', 'exploits', 'bots', 'quarantined'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveFilterTab(tab)}
                            style={{
                                border: 'none',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '700',
                                textTransform: 'capitalize',
                                cursor: 'pointer',
                                transition: '0.2s',
                                background: activeFilterTab === tab ? 'var(--primary)' : 'transparent',
                                color: activeFilterTab === tab ? '#ffffff' : '#94a3b8'
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Map View Controls (Top Right) */}
                <div style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    zIndex: 10,
                    display: 'flex',
                    gap: '8px'
                }}>
                    <button
                        onClick={handleToggle3d}
                        style={{
                            background: 'rgba(13, 19, 31, 0.9)',
                            backdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            color: is3dPitch ? 'var(--primary)' : '#f8fafc',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                        }}
                    >
                        <Compass size={14} /> {is3dPitch ? '2D View' : '3D Tilt'}
                    </button>

                    <button
                        onClick={handleResetView}
                        style={{
                            background: 'rgba(13, 19, 31, 0.9)',
                            backdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            color: '#f8fafc',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            cursor: 'pointer'
                        }}
                        title="Reset Radar View"
                    >
                        <RotateCcw size={14} />
                    </button>

                    <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        style={{
                            background: 'rgba(13, 19, 31, 0.9)',
                            backdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            color: '#f8fafc',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            cursor: 'pointer'
                        }}
                        title="Toggle Fullscreen"
                    >
                        {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                </div>

                {/* Map Canvas */}
                <div ref={mapContainerRef} style={{ flex: 1, width: '100%', height: '100%' }} />

                {/* Live Real-Time Incursion Feed Ticker (Bottom of Map) */}
                <div style={{
                    background: 'rgba(13, 19, 31, 0.95)',
                    backdropFilter: 'blur(12px)',
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                    padding: '10px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    zIndex: 10,
                    overflowX: 'auto'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <Activity size={14} color="var(--accent-rose)" className="spin-anim" />
                        <span style={{ fontSize: '11px', fontWeight: '900', color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Live Incursion Log:</span>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', minWidth: 0, flex: 1 }}>
                        {(incursionLogs.length > 0 ? incursionLogs : allThreats).length === 0 ? (
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Awaiting live WAF security events... System secure.</span>
                        ) : (
                            (incursionLogs.length > 0 ? incursionLogs : allThreats).slice(0, 5).map(log => (
                                <div 
                                    key={log.id || log.ip} 
                                    style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '6px', 
                                        background: 'rgba(255,255,255,0.06)', 
                                        padding: '4px 10px', 
                                        borderRadius: '6px',
                                        border: `1px solid ${log.verdict === 'BLOCKED' || log.action === 'BLOCKED' ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.35)'}`,
                                        fontSize: '11px',
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0
                                    }}
                                >
                                    <span>{COUNTRY_FLAGS[log.country] || '🌐'}</span>
                                    <span style={{ fontWeight: '700', color: '#f8fafc' }}>{log.ip}</span>
                                    <span style={{ color: '#94a3b8', fontSize: '10.5px' }}>({log.countryName || COUNTRY_NAMES[log.country] || log.country})</span>
                                    <span style={{ color: log.verdict === 'BLOCKED' || log.action === 'BLOCKED' ? '#ef4444' : '#f59e0b', fontWeight: '800' }}>[{log.type || log.attackType || 'BLOCKED'}]</span>
                                    <span style={{ color: '#94a3b8', fontSize: '10px' }}>{log.time || new Date(log.timestamp || Date.now()).toLocaleTimeString()}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Perimeter Firewall & Threat Intel Console (2-Column Layout) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
                
                {/* Quarantined IPs & Blacklist Manager */}
                <div className="glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-0)', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div>
                            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Ban size={16} color="#ef4444" /> Quarantined Threat Blacklist
                            </h4>
                            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                {bannedIps.length} active persistent IP blacklists dropping inbound traffic
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                                onClick={handleAutoQuarantineAll}
                                className="btn-secondary shadow-premium"
                                style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '11.5px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }}
                            >
                                <ShieldCheck size={14} /> Auto-Quarantine
                            </button>
                            <button 
                                onClick={() => setShowBanModal(true)}
                                className="btn-secondary shadow-premium"
                                style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '11.5px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                <Plus size={14} /> Quarantine IP
                            </button>
                        </div>
                    </div>

                    <div style={{ marginBottom: '14px', position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                        <input 
                            type="text"
                            placeholder="Search banned IP, country, or reason..."
                            value={searchFilter}
                            onChange={e => setSearchFilter(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 12px 8px 34px',
                                borderRadius: '10px',
                                background: 'var(--bg-surface-1)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-primary)',
                                fontSize: '12px',
                                outline: 'none'
                            }}
                        />
                    </div>

                    {filteredBans.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px' }}>
                            {searchFilter ? 'No banned IPs match your search query.' : 'Zero active blacklisted IPs. Inbound perimeter clean.'}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                            {filteredBans.map((b) => (
                                <div 
                                    key={b.ip}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '10px 14px',
                                        borderRadius: '10px',
                                        background: 'var(--bg-surface-1)',
                                        border: '1px solid var(--border-subtle)'
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--text-primary)', fontSize: '13px' }}>{b.ip}</span>
                                            <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(244, 63, 94, 0.12)', color: '#f43f5e', fontWeight: '800' }}>
                                                {COUNTRY_FLAGS[b.country] || '🌐'} {b.country || 'XX'}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                                            {b.reason} • {b.attempts || 1} attempts
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
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Globe size={16} color="#10b981" /> High-Risk Nation-State Geofencing
                    </h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
                        Toggle automatic perimeter inbound packet dropping for geographic national origin zones.
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

            {/* Threat Detail Modal on Node Click */}
            {selectedThreat && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.75)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 2000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }} onClick={() => setSelectedThreat(null)}>
                    <div className="glass" style={{
                        width: '100%',
                        maxWidth: '480px',
                        borderRadius: '18px',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-surface-0)',
                        padding: '24px',
                        boxShadow: '0 25px 60px rgba(0,0,0,0.6)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ShieldAlert size={20} color={SEVERITY_COLORS[selectedThreat.severity] || '#ef4444'} />
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>Threat Node Inspection</h3>
                            </div>
                            <button onClick={() => setSelectedThreat(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                                <X size={18} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-surface-1)', borderRadius: '8px' }}>
                                <span style={{ color: 'var(--text-dim)' }}>Source IP</span>
                                <span style={{ fontWeight: '800', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{selectedThreat.ip}</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-surface-1)', borderRadius: '8px' }}>
                                <span style={{ color: 'var(--text-dim)' }}>Origin Location</span>
                                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                                    {COUNTRY_FLAGS[selectedThreat.country] || '🌐'} {selectedThreat.countryName} ({selectedThreat.city})
                                </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-surface-1)', borderRadius: '8px' }}>
                                <span style={{ color: 'var(--text-dim)' }}>Attack Classification</span>
                                <span style={{ fontWeight: '800', color: SEVERITY_COLORS[selectedThreat.severity] || '#ef4444' }}>{selectedThreat.tactic}</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-surface-1)', borderRadius: '8px' }}>
                                <span style={{ color: 'var(--text-dim)' }}>Calculated Threat Score</span>
                                <span style={{ fontWeight: '800', color: selectedThreat.threatScore >= 75 ? '#ef4444' : '#f59e0b' }}>{selectedThreat.threatScore} / 100</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-surface-1)', borderRadius: '8px' }}>
                                <span style={{ color: 'var(--text-dim)' }}>WAF Enforcement Action</span>
                                <span style={{ fontWeight: '800', color: selectedThreat.action === 'BLOCKED' ? '#ef4444' : '#10b981' }}>{selectedThreat.action}</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button
                                onClick={() => setSelectedThreat(null)}
                                className="btn-secondary"
                                style={{ flex: 1, padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700' }}
                            >
                                Close
                            </button>
                            <button
                                onClick={() => handleBanSelectedThreat(selectedThreat)}
                                disabled={banning}
                                className="btn-primary"
                                style={{ flex: 1, padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
                            >
                                <Ban size={14} style={{ display: 'inline', marginRight: '4px' }} />
                                {banning ? 'Quarantining...' : 'Permanent Block'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Manual IP Ban Modal */}
            {showBanModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.75)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 2000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }} onClick={() => setShowBanModal(false)}>
                    <div className="glass" style={{
                        width: '100%',
                        maxWidth: '460px',
                        borderRadius: '20px',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-surface-0)',
                        padding: '24px',
                        boxShadow: '0 25px 60px rgba(0,0,0,0.6)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Ban size={20} color="#ef4444" />
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>Quarantine IP Address</h3>
                            </div>
                            <button onClick={() => setShowBanModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleBanIp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Target IP</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. 198.51.100.42"
                                    value={manualIp}
                                    onChange={e => setManualIp(e.target.value)}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Quarantine Reason</label>
                                <input
                                    type="text"
                                    value={manualReason}
                                    onChange={e => setManualReason(e.target.value)}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', marginTop: '4px' }}
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Ban Duration (Hours)</label>
                                <select
                                    value={banDuration}
                                    onChange={e => setBanDuration(e.target.value)}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', marginTop: '4px' }}
                                >
                                    <option value="1">1 Hour</option>
                                    <option value="6">6 Hours</option>
                                    <option value="24">24 Hours (Standard)</option>
                                    <option value="168">7 Days</option>
                                    <option value="8760">Permanent (1 Year)</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowBanModal(false)}
                                    className="btn-secondary"
                                    style={{ flex: 1, padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={banning}
                                    className="btn-primary"
                                    style={{ flex: 1, padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
                                >
                                    {banning ? 'Quarantining...' : 'Enforce Blacklist'}
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
