const geoip = require('geoip-lite');
const logger = require('./logger');

// Country ISO alpha-2 to English name and default capital / central coordinates
const COUNTRY_COORDS = {
    US: { lat: 37.0902, lng: -95.7129, name: 'United States', city: 'Washington D.C.' },
    CN: { lat: 35.8617, lng: 104.1954, name: 'China', city: 'Beijing' },
    RU: { lat: 61.5240, lng: 105.3188, name: 'Russia', city: 'Moscow' },
    DE: { lat: 51.1657, lng: 10.4515, name: 'Germany', city: 'Berlin' },
    IN: { lat: 20.5937, lng: 78.9629, name: 'India', city: 'New Delhi' },
    GB: { lat: 55.3781, lng: -3.4360, name: 'United Kingdom', city: 'London' },
    FR: { lat: 46.2276, lng: 2.2137, name: 'France', city: 'Paris' },
    NL: { lat: 52.1326, lng: 5.2913, name: 'Netherlands', city: 'Amsterdam' },
    VN: { lat: 14.0583, lng: 108.2772, name: 'Vietnam', city: 'Hanoi' },
    BR: { lat: -14.2350, lng: -51.9253, name: 'Brazil', city: 'Brasilia' },
    AU: { lat: -25.2744, lng: 133.7751, name: 'Australia', city: 'Canberra' },
    JP: { lat: 36.2048, lng: 138.2529, name: 'Japan', city: 'Tokyo' },
    KR: { lat: 35.9078, lng: 127.7669, name: 'South Korea', city: 'Seoul' },
    KP: { lat: 40.3399, lng: 127.5101, name: 'North Korea', city: 'Pyongyang' },
    IR: { lat: 32.4279, lng: 53.6880, name: 'Iran', city: 'Tehran' },
    CA: { lat: 56.1304, lng: -106.3468, name: 'Canada', city: 'Ottawa' },
    SG: { lat: 1.3521, lng: 103.8198, name: 'Singapore', city: 'Singapore' },
    UA: { lat: 48.3794, lng: 31.1656, name: 'Ukraine', city: 'Kyiv' },
    TR: { lat: 38.9637, lng: 35.2433, name: 'Turkey', city: 'Ankara' },
    IT: { lat: 41.8719, lng: 12.5674, name: 'Italy', city: 'Rome' },
    ES: { lat: 40.4637, lng: -3.7492, name: 'Spain', city: 'Madrid' },
    PL: { lat: 51.9194, lng: 19.1451, name: 'Poland', city: 'Warsaw' },
    RO: { lat: 45.9432, lng: 24.9668, name: 'Romania', city: 'Bucharest' },
    IL: { lat: 31.0461, lng: 34.8516, name: 'Israel', city: 'Jerusalem' },
    ID: { lat: -0.7893, lng: 113.9213, name: 'Indonesia', city: 'Jakarta' },
    PK: { lat: 30.3753, lng: 69.3451, name: 'Pakistan', city: 'Islamabad' },
    NG: { lat: 9.0820, lng: 8.6753, name: 'Nigeria', city: 'Abuja' },
    ZA: { lat: -30.5595, lng: 22.9375, name: 'South Africa', city: 'Pretoria' },
    EG: { lat: 26.8206, lng: 30.8025, name: 'Egypt', city: 'Cairo' },
    SA: { lat: 23.8859, lng: 45.0792, name: 'Saudi Arabia', city: 'Riyadh' },
    AE: { lat: 23.4241, lng: 53.8478, name: 'United Arab Emirates', city: 'Abu Dhabi' },
    SE: { lat: 60.1282, lng: 18.6435, name: 'Sweden', city: 'Stockholm' },
    NO: { lat: 60.4720, lng: 8.4689, name: 'Norway', city: 'Oslo' },
    FI: { lat: 61.9241, lng: 25.7482, name: 'Finland', city: 'Helsinki' },
    CH: { lat: 46.8182, lng: 8.2275, name: 'Switzerland', city: 'Bern' }
};

/**
 * Determine if an IP is local, loopback, or private intranet
 */
function isPrivateIp(ip) {
    if (!ip) return true;
    const clean = ip.replace(/^::ffff:/, '');
    if (clean === '127.0.0.1' || clean === '::1' || clean === 'localhost') return true;
    if (clean.startsWith('10.') || clean.startsWith('192.168.') || clean.startsWith('172.16.') || clean.startsWith('172.24.')) return true;
    if (clean.startsWith('169.254.') || clean.startsWith('fc00:') || clean.startsWith('fe80:')) return true;
    return false;
}

/**
 * Resolve IP address to geographic metadata
 */
function resolveIp(ip) {
    if (!ip) {
        return { country: 'XX', countryName: 'Unknown', city: 'Unknown', lat: 20.0, lng: 0.0 };
    }

    const cleanIp = ip.replace(/^::ffff:/, '').trim();

    // Check if private / internal network
    if (isPrivateIp(cleanIp)) {
        return {
            ip: cleanIp,
            country: 'LOCAL',
            countryName: 'Local Cluster Node',
            city: 'Internal LAN / Node',
            lat: 37.7749, // Represented on trusted master control hub
            lng: -122.4194,
            isPrivate: true
        };
    }

    // Try GeoIP lookup via geoip-lite
    try {
        const geo = geoip.lookup(cleanIp);
        if (geo && geo.country) {
            const countryCode = geo.country.toUpperCase();
            const fallback = COUNTRY_COORDS[countryCode] || { name: countryCode, city: geo.city || countryCode };
            const lat = geo.ll && geo.ll[0] != null ? geo.ll[0] : (fallback.lat || 0.0);
            const lng = geo.ll && geo.ll[1] != null ? geo.ll[1] : (fallback.lng || 0.0);
            const city = geo.city || fallback.city || countryCode;
            const countryName = fallback.name || countryCode;

            return {
                ip: cleanIp,
                country: countryCode,
                countryName,
                city,
                lat,
                lng,
                isPrivate: false
            };
        }
    } catch (err) {
        logger.debug(`[GeoService] GeoIP lookup error for ${cleanIp}: ${err.message}`);
    }

    // Fallback based on test/documentation IP ranges or known IP blocks
    if (cleanIp.startsWith('203.0.113.') || cleanIp.startsWith('198.51.100.') || cleanIp.startsWith('192.0.2.')) {
        // Documentation & test probe range (RFC 5737) - map to an active origin test vector
        return {
            ip: cleanIp,
            country: 'US',
            countryName: 'United States',
            city: 'Silicon Valley',
            lat: 37.3861,
            lng: -122.0839,
            isPrivate: false
        };
    }

    return {
        ip: cleanIp,
        country: 'XX',
        countryName: 'External Origin',
        city: 'Global Network',
        lat: 25.0,
        lng: 15.0,
        isPrivate: false
    };
}

module.exports = {
    resolveIp,
    isPrivateIp,
    COUNTRY_COORDS
};
