import React, { useState, useEffect } from 'react';
import { Camera } from 'lucide-react';

const Avatar = ({ user, size = 40, onClick, showHover = false }) => {
    const [imgError, setImgError] = useState(false);
    
    const initials = user?.first_name && user?.last_name 
        ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
        : (user?.username ? user.username.substring(0, 2).toUpperCase() : 'U');

    // Default API path for fetching avatar
    const avatarUrl = user?.avatar_thumbnail_path || user?.avatar_path 
        ? `/api/v1/profile/avatar/${user.id}?size=${size <= 64 ? '64' : (size <= 128 ? '128' : (size <= 256 ? '256' : 'original'))}&t=${new Date(user.avatar_updated_at || Date.now()).getTime()}` 
        : null;

    useEffect(() => {
        setImgError(false);
    }, [avatarUrl]);

    const styles = {
        container: {
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            backgroundColor: '#1f6feb',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: `${size * 0.4}px`,
            fontWeight: 'bold',
            overflow: 'hidden',
            position: 'relative',
            cursor: onClick || showHover ? 'pointer' : 'default',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.1)',
            flexShrink: 0
        },
        img: {
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: imgError ? 'none' : 'block'
        },
        overlay: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0,
            transition: 'opacity 0.2s ease',
            color: 'var(--text-primary)'
        }
    };

    return (
        <div 
            style={styles.container} 
            onClick={onClick}
            onMouseEnter={(e) => { if(showHover) e.currentTarget.lastChild.style.opacity = 1; }}
            onMouseLeave={(e) => { if(showHover) e.currentTarget.lastChild.style.opacity = 0; }}
        >
            {avatarUrl && !imgError ? (
                <img 
                    src={avatarUrl} 
                    alt={user?.username} 
                    style={styles.img} 
                    onError={() => setImgError(true)} 
                />
            ) : (
                <span>{initials}</span>
            )}

            {showHover && (
                <div style={styles.overlay}>
                    <Camera size={size * 0.3} />
                </div>
            )}
        </div>
    );
};

export default Avatar;
