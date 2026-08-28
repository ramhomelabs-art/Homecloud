import React, { useState, useEffect, useRef } from 'react';
import { 
    Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, 
    ListMusic, X, Disc, Music, GripVertical, Shuffle, Repeat, Repeat1
} from 'lucide-react';

const API_BASE = '/api';

const AudioPlayer = ({ 
    activeTrack, 
    playQueue, 
    isPlaying, 
    onPlayPause, 
    onNext, 
    onPrev, 
    onSelectTrack, 
    onRemoveTrack, 
    onClose, 
    shareId 
}) => {
    const audioRef = useRef(null);
    const containerRef = useRef(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.8);
    const [isMuted, setIsMuted] = useState(false);
    const [showQueue, setShowQueue] = useState(false);
    const [showVolumeSlider, setShowVolumeSlider] = useState(false);

    // Advanced features state
    const [repeatMode, setRepeatMode] = useState('off'); // 'off', 'all', 'one'
    const [isShuffle, setIsShuffle] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

    // Drag-and-drop state
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });

    const tok = localStorage.getItem('token') || '';
    let trackUrl = '';

    if (activeTrack) {
        if (shareId) {
            trackUrl = `${API_BASE}/share/stream?filePath=${encodeURIComponent(activeTrack.path)}&token=${shareId}&intent=stream`;
        } else {
            trackUrl = `${API_BASE}/files/download?path=${encodeURIComponent(activeTrack.path)}&token=${tok}&intent=stream`;
            if (activeTrack.agentId) trackUrl += `&agentId=${activeTrack.agentId}`;
        }
    }

    // Play/Pause effect
    useEffect(() => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.play()
                .then(() => {
                    audioRef.current.playbackRate = playbackSpeed;
                })
                .catch(err => console.log('Audio playback failed:', err));
        } else {
            audioRef.current.pause();
        }
    }, [isPlaying, activeTrack?.path]);

    // Handle track changes
    useEffect(() => {
        if (!audioRef.current) return;
        setCurrentTime(0);
        setDuration(0);
        if (isPlaying) {
            audioRef.current.load();
            audioRef.current.play()
                .then(() => {
                    audioRef.current.playbackRate = playbackSpeed;
                })
                .catch(err => console.log('Audio playback failed:', err));
        }
    }, [activeTrack?.path]);

    // Apply speed changes
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.playbackRate = playbackSpeed;
        }
    }, [playbackSpeed, activeTrack?.path]);

    // Time update
    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    // Duration load
    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
            audioRef.current.playbackRate = playbackSpeed;
        }
    };

    // Custom track ending handler based on Repeat / Shuffle modes
    const handleEnded = () => {
        if (repeatMode === 'one') {
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play()
                    .then(() => {
                        audioRef.current.playbackRate = playbackSpeed;
                    })
                    .catch(err => console.log('Audio playback failed:', err));
            }
        } else if (isShuffle) {
            playRandomTrack();
        } else {
            playNextTrackCustom();
        }
    };

    // Helper: Play random track
    const playRandomTrack = () => {
        if (playQueue && playQueue.length > 0) {
            const randomIndex = Math.floor(Math.random() * playQueue.length);
            onSelectTrack(playQueue[randomIndex]);
        }
    };

    // Helper: Play next track with loop checks
    const playNextTrackCustom = () => {
        if (!playQueue || playQueue.length === 0) return;
        const currentIndex = playQueue.findIndex(t => t.path === activeTrack?.path);
        if (currentIndex !== -1 && currentIndex < playQueue.length - 1) {
            onSelectTrack(playQueue[currentIndex + 1]);
        } else {
            if (repeatMode === 'all') {
                onSelectTrack(playQueue[0]);
            } else {
                // End of queue and repeat is off -> stop playing
                if (audioRef.current) {
                    audioRef.current.pause();
                }
                if (isPlaying && onPlayPause) {
                    onPlayPause(); // toggles playing state to false
                }
            }
        }
    };

    // Custom Button Click Handlers
    const handleNextClick = () => {
        if (isShuffle) {
            playRandomTrack();
        } else {
            if (onNext) onNext();
        }
    };

    const handlePrevClick = () => {
        if (isShuffle) {
            playRandomTrack();
        } else {
            if (onPrev) onPrev();
        }
    };

    // Toggle advanced options
    const toggleShuffle = () => setIsShuffle(!isShuffle);
    const toggleRepeat = () => {
        setRepeatMode(prev => {
            if (prev === 'off') return 'all';
            if (prev === 'all') return 'one';
            return 'off';
        });
    };
    const cyclePlaybackSpeed = () => {
        setPlaybackSpeed(prev => {
            if (prev === 0.75) return 1.0;
            if (prev === 1.0) return 1.25;
            if (prev === 1.25) return 1.5;
            if (prev === 1.5) return 2.0;
            return 0.75;
        });
    };

    // Seek
    const handleSeek = (e) => {
        const val = parseFloat(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = val;
            setCurrentTime(val);
        }
    };

    // Volume change
    const handleVolumeChange = (e) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        setIsMuted(val === 0);
        if (audioRef.current) {
            audioRef.current.volume = val;
            audioRef.current.muted = val === 0;
        }
    };

    // Mute toggle
    const toggleMute = () => {
        const nextMuted = !isMuted;
        setIsMuted(nextMuted);
        if (audioRef.current) {
            audioRef.current.muted = nextMuted;
            audioRef.current.volume = nextMuted ? 0 : volume;
        }
    };

    const formatTime = (time) => {
        if (isNaN(time)) return '0:00';
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    // Drag events
    const handleMouseDown = (e) => {
        if (e.target.closest('button') || e.target.closest('input')) return;
        setIsDragging(true);
        dragStart.current = {
            x: e.clientX - offset.x,
            y: e.clientY - offset.y
        };
        e.preventDefault();
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        const newX = e.clientX - dragStart.current.x;
        const newY = e.clientY - dragStart.current.y;
        setOffset({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleTouchStart = (e) => {
        if (e.target.closest('button') || e.target.closest('input')) return;
        setIsDragging(true);
        const touch = e.touches[0];
        dragStart.current = {
            x: touch.clientX - offset.x,
            y: touch.clientY - offset.y
        };
    };

    const handleTouchMove = (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        const newX = touch.clientX - dragStart.current.x;
        const newY = touch.clientY - dragStart.current.y;
        setOffset({ x: newX, y: newY });
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('touchmove', handleTouchMove, { passive: false });
            window.addEventListener('touchend', handleTouchEnd);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isDragging]);

    if (!activeTrack) return null;

    const playerStyle = {
        ...styles.playerContainer,
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        transition: isDragging ? 'none' : 'transform 0.1s ease-out',
        cursor: isDragging ? 'grabbing' : 'default'
    };

    return (
        <div ref={containerRef} style={playerStyle}>
            {/* Inline CSS Animations */}
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes bounce {
                    0%, 100% { transform: scaleY(0.35); }
                    50% { transform: scaleY(1); }
                }
                @keyframes pulse-glow {
                    0% { box-shadow: 0 0 0 0 rgba(0, 180, 216, 0.4); }
                    70% { box-shadow: 0 0 0 8px rgba(0, 180, 216, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(0, 180, 216, 0); }
                }
                @keyframes marquee {
                    0% { transform: translate3d(0, 0, 0); }
                    100% { transform: translate3d(-50%, 0, 0); }
                }
            `}} />

            {trackUrl && (
                <audio
                    ref={audioRef}
                    src={trackUrl}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={handleEnded}
                />
            )}

            <div style={styles.mainBar}>
                {/* Drag Handle */}
                <div 
                    style={{ 
                        ...styles.dragHandle, 
                        cursor: isDragging ? 'grabbing' : 'grab',
                        color: isDragging ? 'var(--accent-cyan, #00b4d8)' : '#8b949e'
                    }}
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                    title="Drag player to move"
                >
                    <GripVertical size={16} />
                </div>

                {/* Track Info */}
                <div style={styles.trackInfo}>
                    <div style={styles.discWrapper}>
                        <Disc style={{ ...styles.discIcon, animation: isPlaying ? 'spin 5s linear infinite' : 'none' }} size={20} />
                    </div>
                    <div style={styles.textWrapper}>
                        <div style={styles.trackTitle} title={activeTrack.name}>{activeTrack.name}</div>
                        <div style={styles.trackSubtitle}>NexaDisk Media</div>
                    </div>
                    {/* Animated visualizer wave */}
                    {isPlaying && (
                        <div style={styles.waveContainer}>
                            <div style={{ ...styles.waveBar, animation: 'bounce 0.8s ease-in-out infinite' }} />
                            <div style={{ ...styles.waveBar, animation: 'bounce 0.5s ease-in-out infinite 0.15s' }} />
                            <div style={{ ...styles.waveBar, animation: 'bounce 0.7s ease-in-out infinite 0.3s' }} />
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div style={styles.controlsSection}>
                    <div style={styles.buttonRow}>
                        {/* Shuffle Button */}
                        <button 
                            onClick={toggleShuffle} 
                            style={{ ...styles.controlBtn, color: isShuffle ? 'var(--accent-cyan, #00b4d8)' : '#8b949e' }} 
                            title="Shuffle"
                        >
                            <Shuffle size={13} />
                        </button>

                        {/* Prev Button */}
                        <button onClick={handlePrevClick} style={styles.controlBtn} title="Previous">
                            <SkipBack size={15} />
                        </button>

                        {/* Play/Pause Button */}
                        <button 
                            onClick={onPlayPause} 
                            style={{ 
                                ...styles.playBtn, 
                                animation: isPlaying ? 'pulse-glow 2s infinite' : 'none' 
                            }} 
                            title={isPlaying ? 'Pause' : 'Play'}
                        >
                            {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" style={{ marginLeft: '1.5px' }} />}
                        </button>

                        {/* Next Button */}
                        <button onClick={handleNextClick} style={styles.controlBtn} title="Next">
                            <SkipForward size={15} />
                        </button>

                        {/* Repeat Button */}
                        <button 
                            onClick={toggleRepeat} 
                            style={{ 
                                ...styles.controlBtn, 
                                color: repeatMode !== 'off' ? 'var(--accent-cyan, #00b4d8)' : '#8b949e' 
                            }} 
                            title={repeatMode === 'one' ? 'Repeat One' : repeatMode === 'all' ? 'Repeat All' : 'Repeat'}
                        >
                            {repeatMode === 'one' ? <Repeat1 size={13} /> : <Repeat size={13} />}
                        </button>
                    </div>

                    {/* Progress Bar */}
                    <div style={styles.progressRow}>
                        <span style={styles.timeLabel}>{formatTime(currentTime)}</span>
                        <input
                            type="range"
                            min="0"
                            max={duration || 0}
                            value={currentTime}
                            onChange={handleSeek}
                            style={styles.progressBar}
                        />
                        <span style={styles.timeLabel}>{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Volume & Speed & Queue */}
                <div style={styles.rightSection}>
                    {/* Collapsible Volume Row */}
                    <div 
                        style={styles.volumeRow}
                        onMouseEnter={() => setShowVolumeSlider(true)}
                        onMouseLeave={() => setShowVolumeSlider(false)}
                    >
                        <button onClick={toggleMute} style={styles.muteBtn}>
                            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                        </button>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={isMuted ? 0 : volume}
                            onChange={handleVolumeChange}
                            style={{
                                ...styles.volumeSlider,
                                width: showVolumeSlider ? '50px' : '0px',
                                opacity: showVolumeSlider ? 1 : 0,
                                marginLeft: showVolumeSlider ? '6px' : '0px',
                                visibility: showVolumeSlider ? 'visible' : 'hidden'
                            }}
                        />
                    </div>

                    {/* Playback Speed Badge Button */}
                    <button 
                        onClick={cyclePlaybackSpeed} 
                        style={styles.speedBtn}
                        title="Playback Speed"
                    >
                        {playbackSpeed}x
                    </button>

                    {/* Queue Button */}
                    <button 
                        onClick={() => setShowQueue(!showQueue)} 
                        style={{ ...styles.utilityBtn, color: showQueue ? 'var(--accent-cyan, #00b4d8)' : '#8b949e' }}
                        title="Play Queue"
                    >
                        <ListMusic size={18} />
                        {playQueue.length > 0 && <span style={styles.badge}>{playQueue.length}</span>}
                    </button>

                    {/* Close Button */}
                    <button onClick={onClose} style={styles.utilityBtn} title="Close Player">
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Queue Panel */}
            {showQueue && (
                <div style={styles.queuePanel}>
                    <div style={styles.queueHeader}>
                        <h4 style={{ margin: 0, fontSize: '13px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Music size={14} /> Play Queue
                        </h4>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{playQueue.length} items</span>
                    </div>
                    <div style={styles.queueList}>
                        {playQueue.length === 0 ? (
                            <div style={styles.emptyQueue}>Queue is empty</div>
                        ) : (
                            playQueue.map((track, idx) => {
                                const isActive = track.path === activeTrack.path;
                                return (
                                    <div 
                                        key={track.path + '-' + idx} 
                                        style={{ 
                                            ...styles.queueItem, 
                                            background: isActive ? 'rgba(0, 180, 216, 0.08)' : 'transparent',
                                            borderLeft: isActive ? '3px solid var(--accent-cyan, #00b4d8)' : '3px solid transparent'
                                        }}
                                    >
                                        <div 
                                            onClick={() => onSelectTrack(track)} 
                                            style={{ 
                                                ...styles.queueItemTitle,
                                                color: isActive ? 'var(--accent-cyan, #00b4d8)' : '#c9d1d9',
                                                fontWeight: isActive ? 'bold' : 'normal'
                                            }}
                                        >
                                            {track.name}
                                        </div>
                                        <button 
                                            onClick={() => onRemoveTrack(track, idx)} 
                                            style={styles.queueItemRemove}
                                            title="Remove from queue"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const styles = {
    playerContainer: {
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '480px', // Reduced from 550px
        backgroundColor: 'rgba(17, 19, 23, 0.95)', // Slightly darker
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px', // Reduced from 16px
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.65)',
        zIndex: 9999,
        padding: '12px 14px', // Reduced padding
        boxSizing: 'border-box',
        color: 'var(--text-primary)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        userSelect: 'none'
    },
    mainBar: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
    },
    dragHandle: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 2px',
        transition: 'color 0.2s ease',
        touchAction: 'none'
    },
    trackInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '130px', // Reduced from 160px
        overflow: 'hidden',
        flexShrink: 0
    },
    discWrapper: {
        width: '32px', // Reduced from 40px
        height: '32px',
        borderRadius: '50%',
        background: 'var(--bg-surface-2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
    },
    discIcon: {
        color: 'var(--accent-cyan, #00b4d8)'
    },
    textWrapper: {
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flex: 1
    },
    trackTitle: {
        fontSize: '12px', // Reduced from 13px
        fontWeight: '600',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        color: 'var(--text-primary)'
    },
    trackSubtitle: {
        fontSize: '10px', // Reduced from 11px
        color: 'var(--text-secondary)',
        marginTop: '1px'
    },
    waveContainer: {
        display: 'flex',
        alignItems: 'flex-end',
        gap: '2px',
        height: '10px',
        width: '12px',
        flexShrink: 0
    },
    waveBar: {
        width: '2px',
        height: '100%',
        backgroundColor: 'var(--accent-cyan, #00b4d8)',
        transformOrigin: 'bottom'
    },
    controlsSection: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        flex: 1,
        minWidth: '130px'
    },
    buttonRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
    },
    controlBtn: {
        background: 'transparent',
        border: 'none',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        padding: '4px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'color 0.2s, background-color 0.2s',
        outline: 'none'
    },
    playBtn: {
        background: 'var(--accent-cyan, #00b4d8)',
        border: 'none',
        color: '#0d1117',
        width: '30px', // Reduced from 36px
        height: '30px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        outline: 'none'
    },
    progressRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        width: '100%'
    },
    progressBar: {
        flex: 1,
        height: '3px', // Sleeker progress bar
        borderRadius: '1.5px',
        background: 'rgba(255, 255, 255, 0.1)',
        outline: 'none',
        cursor: 'pointer',
        accentColor: 'var(--accent-cyan, #00b4d8)'
    },
    timeLabel: {
        fontSize: '9px',
        color: 'var(--text-secondary)',
        width: '26px',
        textAlign: 'center'
    },
    rightSection: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0
    },
    volumeRow: {
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        height: '24px',
        padding: '0 4px',
        borderRadius: '12px',
        transition: 'background 0.2s ease'
    },
    muteBtn: {
        background: 'transparent',
        border: 'none',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        padding: '2px',
        display: 'flex',
        alignItems: 'center',
        outline: 'none'
    },
    volumeSlider: {
        height: '3px',
        borderRadius: '1.5px',
        background: 'rgba(255, 255, 255, 0.15)',
        outline: 'none',
        cursor: 'pointer',
        accentColor: 'var(--accent-cyan, #00b4d8)',
        transition: 'width 0.2s ease, opacity 0.2s ease, margin 0.2s ease'
    },
    speedBtn: {
        background: 'var(--bg-surface-2)',
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-secondary)',
        fontSize: '9px',
        padding: '2px 6px',
        borderRadius: '10px',
        cursor: 'pointer',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '32px',
        transition: 'color 0.2s, background-color 0.2s',
        outline: 'none'
    },
    utilityBtn: {
        background: 'transparent',
        border: 'none',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        padding: '2px',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        outline: 'none'
    },
    badge: {
        position: 'absolute',
        top: '-5px',
        right: '-5px',
        background: 'var(--accent-cyan, #00b4d8)',
        color: '#0d1117',
        borderRadius: '50%',
        width: '12px',
        height: '12px',
        fontSize: '8px',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    queuePanel: {
        marginTop: '10px',
        borderTop: '1px solid var(--border-subtle)',
        paddingTop: '8px',
        maxHeight: '160px', // Slightly shorter panel
        display: 'flex',
        flexDirection: 'column'
    },
    queueHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '6px'
    },
    queueList: {
        overflowY: 'auto',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
        paddingRight: '2px'
    },
    emptyQueue: {
        textAlign: 'center',
        color: 'var(--text-secondary)',
        fontSize: '11px',
        padding: '12px 0'
    },
    queueItem: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 8px',
        borderRadius: '6px',
        transition: 'background 0.2s'
    },
    queueItemTitle: {
        fontSize: '11px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        cursor: 'pointer',
        flex: 1,
        marginRight: '10px'
    },
    queueItemRemove: {
        background: 'transparent',
        border: 'none',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        padding: '2px',
        display: 'flex',
        alignItems: 'center',
        borderRadius: '4px',
        outline: 'none',
        transition: 'color 0.2s, background 0.2s'
    }
};

export default AudioPlayer;
