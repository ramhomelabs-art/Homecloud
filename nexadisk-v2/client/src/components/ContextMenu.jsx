import React from 'react';
import {
    FolderOpen, Eye, Download, Copy, Scissors, Trash2, Box, Edit, Share2, Info, Plus, RefreshCw
} from 'lucide-react';

const ContextMenu = ({ data, onAction, onPaste, hasClipboard, onCreateFolder, onRefresh, selectedCount, isGuest, guestPermissions }) => {
    if (!data) return null;
    const isFile = !!data.file;
    const isBulk = selectedCount > 1;

    const canEdit = !isGuest || guestPermissions === 'Edit' || guestPermissions === 'Full Access';
    const canFullAccess = !isGuest || guestPermissions === 'Full Access';

    return (
        <div className="context-menu glass" style={{
            position: 'fixed',
            top: data.y,
            left: data.x,
            zIndex: 2000,
            width: '200px'
        }}>
            {isGuest ? (
                data.file ? (
                    <>
                        {data.file.isDirectory ? (
                            <div className="cm-item" onClick={() => onAction('open', data.file)}>
                                <FolderOpen size={16} /> Open
                            </div>
                        ) : (
                            <>
                                <div className="cm-item" onClick={() => onAction('view', data.file)}>
                                    <Eye size={16} /> View
                                </div>
                                <div className="cm-item" onClick={() => onAction('download', data.file)}>
                                    <Download size={16} /> Download
                                </div>
                            </>
                        )}
                    </>
                ) : (
                    <div className="cm-item" onClick={onRefresh}><RefreshCw size={16} /> Refresh</div>
                )
            ) : (
                data.file ? (
                    <>
                        {data.file && !data.file.isDirectory && /\.(mp4|webm|ogg|mov|avi|mkv|mp3|wav|flac|m4a|aac)$/i.test(data.file.name) && (
                            <>
                                <div className="cm-item" onClick={() => onAction('playMedia', data.file)}>
                                    <Eye size={16} /> Play Now
                                </div>
                                <div className="cm-item" onClick={() => onAction('queueMedia', data.file)}>
                                    <Plus size={16} /> Queue to Player
                                </div>
                                <div className="cm-divider" />
                            </>
                        )}
                        <div className="cm-item" onClick={() => onAction('copy', data.file)}>
                            <Copy size={16} /> {isBulk ? `Copy (${selectedCount} items)` : 'Copy'}
                        </div>
                        {canEdit && (
                            <div className="cm-item" onClick={() => onAction('cut', data.file)}>
                                <Scissors size={16} /> {isBulk ? `Cut (${selectedCount} items)` : 'Cut'}
                            </div>
                        )}
                        {canFullAccess && (
                            <div className="cm-item" onClick={() => onAction('delete', data.file)} style={{ color: '#f85149' }}>
                                <Trash2 size={16} /> {isBulk ? `Delete (${selectedCount} items)` : 'Delete'}
                            </div>
                        )}
                        {!isGuest && (
                            <div className="cm-item" onClick={() => onAction('compress', data.file)}>
                                <Box size={16} /> {isBulk ? `Compress (${selectedCount} items)...` : 'Compress...'}
                            </div>
                        )}
                        {!isBulk && (
                            <>
                                {(canEdit || !isGuest) && <div className="cm-divider" />}
                                {canEdit && (
                                    <div className="cm-item" onClick={() => onAction('rename', data.file)}>
                                        <Edit size={16} /> Rename
                                    </div>
                                )}
                                {!isGuest && (
                                    <div className="cm-item" onClick={() => onAction('share', data.file)}>
                                        <Share2 size={16} /> Share
                                    </div>
                                )}
                                {!isGuest && (
                                    <div className="cm-item" onClick={() => onAction('properties', data.file)}>
                                        <Info size={16} /> Properties
                                    </div>
                                )}
                                {!isGuest && !data.file.isDirectory && /\.(zip|tar|tar\.gz|tgz|gz|rar|7z)$/i.test(data.file.name) && (
                                    <div className="cm-item" onClick={() => onAction('extract', data.file)}>
                                        <FolderOpen size={16} /> Extract Here
                                    </div>
                                )}
                                {!isGuest && !data.file.isDirectory && (
                                    <div className="cm-item" onClick={() => onAction('scan', data.file)} style={{ color: '#58a6ff' }}>
                                        <Info size={16} /> Scan File
                                    </div>
                                )}
                            </>
                        )}
                    </>
                ) : (
                    <>
                        {canEdit && <div className="cm-item" onClick={onCreateFolder}><Plus size={16} /> New Folder</div>}
                        {canEdit && hasClipboard && <div className="cm-item" onClick={onPaste}><Edit size={16} /> Paste</div>}
                        {(canEdit || hasClipboard) && <div className="cm-divider"></div>}
                        <div className="cm-item" onClick={onRefresh}><RefreshCw size={16} /> Refresh</div>
                    </>
                )
            )}
        </div>
    );
};

export default ContextMenu;
