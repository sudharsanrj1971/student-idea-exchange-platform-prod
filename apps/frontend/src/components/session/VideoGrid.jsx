import { memo, useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useSessionStore } from '../../store/sessionStore.js';
import { MicOff, VideoOff, Pin, PinOff, PictureInPicture2, SignalHigh, Maximize, Minimize, ChevronLeft, ChevronRight } from 'lucide-react';
import { useActiveSpeaker } from '../../hooks/useActiveSpeaker.js';
import Avatar from '../ui/Avatar.jsx';

const TILE_PAGINATION_SIZE = 12;

export default function VideoGrid({ 
  streams, localStream, localUser, isMuted, isCamOff, 
  localScreenStream, pinnedId, onTogglePin, selectedSpeakerId,
  liveCaption, dataSaver, hideNonVideo, onVisibilityChange,
  consumerStats, layoutMode = 'auto'
}) {
  const { participants, raisedHands } = useSessionStore();
  const [currentPage, setCurrentPage] = useState(0);

  const tiles = useMemo(() => {
    const allTiles = [];

    // 1. Local Tile
    // BUG FIX: localUser comes from authStore where the avatar is stored as 'profilePic'.
    // The Avatar component receives 'src={user?.avatar}' in VideoTile, so we must
    // normalize the field here by mapping profilePic → avatar.
    allTiles.push({ 
      id: 'local', 
      stream: localStream, 
      user: { 
        ...localUser,
        avatar: localUser?.profilePic || localUser?.avatar || null,
      }, 
      isLocal: true, 
      isMuted, 
      isCamOff, 
      hasRaisedHand: raisedHands.has(localUser?._id?.toString()) 
    });

    // 2. Local Screen Share
    if (localScreenStream) {
      allTiles.push({ 
        id: 'local-screen', 
        stream: localScreenStream, 
        user: { ...localUser, name: `${localUser?.name}'s Screen` }, 
        isLocal: true, 
        isMuted: true, 
        isCamOff: false,
        isScreen: true
      });
    }

    // 3. Remote Tiles
    participants.forEach((p) => {
      const pId = p.userId?.toString();
      if (pId === localUser?._id?.toString()) return;

      const remoteStreams = streams.has(p.socketId) ? [streams.get(p.socketId)] : Array.from(streams.values()).filter(s => s.socketId === p.socketId || s.userId === pId);
      
      // BUG FIX: Normalize avatar field. The backend participant object stores the
      // profile pic as 'avatar' (set during session:join). However on different code
      // paths it might arrive as 'profilePic'. Resolve the first truthy value.
      const resolvedAvatar = p.avatar || p.profilePic || null;

      if (remoteStreams.length === 0) {
        if (!hideNonVideo) {
          allTiles.push({
            id: p.socketId,
            stream: null,
            user: { name: p.name, avatar: resolvedAvatar },
            isLocal: false,
            isCamOff: true,
            isMuted: true,
            hasRaisedHand: raisedHands.has(pId),
          });
        }
      } else {
        const screenStreams = remoteStreams.filter(s => s.appData?.screen);
        const camMicStreams = remoteStreams.filter(s => !s.appData?.screen);

        if (camMicStreams.length > 0) {
           const pStream = camMicStreams[0].stream;
           const vidProducerId = camMicStreams[0].producerId;

           allTiles.push({
              id: p.socketId,
              producerId: vidProducerId,
              stream: pStream,
              user: { name: p.name, avatar: resolvedAvatar },
              isLocal: false,
              hasRaisedHand: raisedHands.has(pId),
              isScreen: false,
              isMuted: pStream.getAudioTracks().length === 0,
              isCamOff: pStream.getVideoTracks().length === 0,
              quality: vidProducerId ? consumerStats?.get(vidProducerId)?.quality : 'good'
           });
        }

        screenStreams.forEach(s => {
           allTiles.push({
              id: s.producerId,
              producerId: s.producerId,
              stream: s.stream,
              user: { name: `${p.name}'s Screen`, avatar: resolvedAvatar },
              isLocal: false,
              hasRaisedHand: false,
              isScreen: true,
              isMuted: true,
              quality: consumerStats?.get(s.producerId)?.quality || 'good'
           });
        });
      }
    });

    return allTiles;
  }, [participants, streams, raisedHands, localStream, localUser, isMuted, isCamOff, localScreenStream, hideNonVideo, consumerStats]);

  // Find dominant tile based on layoutMode
  // Tiled mode = no dominant tile, everyone is in the grid
  const dominantTileId = useMemo(() => {
    if (layoutMode === 'tiled') return null;
    
    // Priority: Pinned > Screen Share > Spotlight/Sidebar default
    if (pinnedId) return pinnedId;
    const screenTile = tiles.find(t => t.isScreen);
    if (screenTile) return screenTile.id;
    
    // In Spotlight or Sidebar mode, if nothing is pinned, we pick the first non-local participant or local if alone
    if (layoutMode === 'spotlight' || layoutMode === 'sidebar') {
       const firstRemote = tiles.find(t => !t.isLocal);
       return firstRemote ? firstRemote.id : 'local';
    }
    
    return null;
  }, [layoutMode, pinnedId, tiles]);

  const dominantTile = useMemo(() => tiles.find(t => t.id === dominantTileId), [tiles, dominantTileId]);
  
  const otherTiles = useMemo(() => {
    if (layoutMode === 'spotlight' && dominantTile) return []; // Spotlight shows ONLY the main tile
    return tiles.filter(t => t.id !== dominantTileId);
  }, [tiles, dominantTileId, layoutMode, dominantTile]);

  // Paginate other tiles
  const totalPages = Math.ceil(otherTiles.length / TILE_PAGINATION_SIZE);
  const paginatedOtherTiles = useMemo(() => {
    const start = currentPage * TILE_PAGINATION_SIZE;
    return otherTiles.slice(start, start + TILE_PAGINATION_SIZE);
  }, [otherTiles, currentPage]);

  // Sync visibility state with parent (SessionPage) to pause/resume consumers
  useEffect(() => {
    if (typeof onVisibilityChange !== 'function') return;
    
    const visibleIds = new Set();
    if (dominantTile?.producerId) visibleIds.add(dominantTile.producerId);
    paginatedOtherTiles.forEach(t => {
       if (t.producerId) visibleIds.add(t.producerId);
    });
    
    onVisibilityChange(visibleIds);
  }, [dominantTile, paginatedOtherTiles, onVisibilityChange]);

  const handlePrev = () => setCurrentPage(p => Math.max(0, p - 1));
  const handleNext = () => setCurrentPage(p => Math.min(totalPages - 1, p + 1));

  if (dominantTile) {
    return (
      <div className={`flex-1 flex gap-3 p-3 overflow-hidden bg-background min-h-0 ${layoutMode === 'spotlight' ? 'flex-col' : 'flex-col md:flex-row'}`}>
        <div className={`flex-[3] relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 transition-all duration-500 ${layoutMode === 'spotlight' ? 'w-full h-full' : ''}`}>
          <VideoTile 
            {...dominantTile} 
            isPinned={pinnedId === dominantTile.id}
            onTogglePin={onTogglePin}
            isDominant={true}
            selectedSpeakerId={selectedSpeakerId}
          />
        </div>
        
        {layoutMode !== 'spotlight' && (
          <div className="flex-1 flex flex-col gap-3 min-w-[200px] max-h-full">
          <div className="flex-1 flex flex-row md:flex-col gap-3 overflow-x-auto md:overflow-y-auto pr-2 custom-scrollbar no-scrollbar md:no-scrollbar pb-2 md:pb-0">
            {paginatedOtherTiles.map((tile) => (
              <div key={tile.id} className="min-w-[180px] md:min-w-0 aspect-video shrink-0">
                <VideoTile 
                  {...tile} 
                  isPinned={pinnedId === tile.id}
                  onTogglePin={onTogglePin}
                  selectedSpeakerId={selectedSpeakerId}
                />
              </div>
            ))}
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2 py-1 bg-surface-800/50 rounded-xl border border-white/5">
              <button onClick={handlePrev} disabled={currentPage === 0} className="p-1 hover:bg-white/10 rounded-lg disabled:opacity-30">
                <ChevronLeft size={16} />
              </button>
              <span className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest">
                Page {currentPage + 1} / {totalPages}
              </span>
              <button onClick={handleNext} disabled={currentPage >= totalPages - 1} className="p-1 hover:bg-white/10 rounded-lg disabled:opacity-30">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
      </div>
    );
  }

  const gridCols =
    paginatedOtherTiles.length + (dominantTile ? 1 : 0) <= 1 ? 'grid-cols-1' :
    paginatedOtherTiles.length + (dominantTile ? 1 : 0) <= 2 ? 'grid-cols-1 md:grid-cols-2' :
    paginatedOtherTiles.length + (dominantTile ? 1 : 0) <= 4 ? 'grid-cols-2' :
    'grid-cols-2 lg:grid-cols-4';

  return (
    <div className="flex-1 flex flex-col gap-2 p-2 sm:p-3 overflow-hidden min-h-0">
      <div className={`flex-1 grid ${gridCols} gap-2 sm:gap-3 overflow-y-auto custom-scrollbar min-h-0`}>
        {paginatedOtherTiles.map((tile) => (
          <VideoTile 
            key={tile.id} 
            {...tile} 
            isPinned={pinnedId === tile.id}
            onTogglePin={onTogglePin}
            selectedSpeakerId={selectedSpeakerId}
            dataSaver={dataSaver}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-6 py-2">
          <button 
            onClick={handlePrev} 
            disabled={currentPage === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-800 border border-white/10 hover:bg-surface-700 disabled:opacity-30 transition-all font-bold text-xs"
          >
            <ChevronLeft size={16} /> PREVIOUS
          </button>
          <span className="text-xs font-bold text-primary-400 bg-primary-500/10 px-4 py-2 rounded-xl border border-primary-500/20">
            {currentPage + 1} OF {totalPages}
          </span>
          <button 
            onClick={handleNext} 
            disabled={currentPage >= totalPages - 1}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-800 border border-white/10 hover:bg-surface-700 disabled:opacity-30 transition-all font-bold text-xs"
          >
            NEXT <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Live Caption Overlay (Universal) */}
      {liveCaption && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-black/80 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-2xl max-w-[90vw] text-center">
            <p className="text-primary-400 text-[10px] uppercase tracking-widest font-bold mb-1 opacity-70">
              {liveCaption.name}
            </p>
            <p className="text-white text-lg font-medium leading-tight">
              {liveCaption.text}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

const VideoTile = memo(({ 
  id, stream, user, isLocal, isMuted, isCamOff, hasRaisedHand, 
  isScreen, isPinned, onTogglePin, isDominant, selectedSpeakerId, dataSaver,
  quality
}) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const isSpeaking = useActiveSpeaker(stream);
  const [isTileFullScreen, setIsTileFullScreen] = useState(false);

  useEffect(() => {
    const handler = () => {
      setIsTileFullScreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleFullScreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement === containerRef.current) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen().catch(err => {
        console.error('Fullscreen failed', err);
      });
    }
  };

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !stream) return;

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    const startPlayback = async () => {
      try {
        video.muted = true;

        await video.play();

        if (video.readyState < 2) {
          await new Promise(resolve => {
            video.onloadeddata = () => resolve();
          });
        }

        video.muted = isLocal || isScreen;

        console.log('[VIDEO DEBUG]', {
          readyState: video.readyState,
          paused: video.paused,
          currentTime: video.currentTime,
          tracks: stream.getTracks().map(t => ({
            kind: t.kind,
            enabled: t.enabled,
            muted: t.muted,
            readyState: t.readyState
          }))
        });

      } catch (err) {
        console.warn('[VIDEO PLAY ERROR]', err);
      }
    };

    startPlayback();

  }, [stream, isLocal, isScreen]);

  useEffect(() => {
    // WebRTC remote audio routing
    const video = videoRef.current;
    if (video && typeof video.setSinkId === 'function' && !isLocal && selectedSpeakerId) {
      video.setSinkId(selectedSpeakerId).catch(err => {
        console.warn('Failed to set sink ID:', err);
      });
    }
  }, [selectedSpeakerId, isLocal]);

  const handlePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.error('PiP failed', err);
    }
  };

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  const hasVideo = stream && stream.getVideoTracks().length > 0;

  const activeRing = isSpeaking && !isMuted ? 'ring-primary-400/60 ring-4 shadow-[0_0_30px_rgba(67,97,238,0.4)] z-20' : '';
  const pinnedRing = isPinned ? 'ring-primary-500/80 ring-2' : '';

  // Signal Strength dynamic color
  const signalColor = quality === 'poor' ? 'text-red-500' : quality === 'fair' ? 'text-amber-400' : 'text-emerald-400';

  return (
    <div 
      ref={containerRef}
      className={`video-tile group relative w-full h-full rounded-[2.5rem] overflow-hidden bg-surface-900 ring-1 ring-white/10 transition-all duration-500 shadow-[0_20px_50px_rgba(0,0,0,0.5)] ${isTileFullScreen ? 'rounded-none' : ''} ${pinnedRing} ${activeRing}`} 
      id={`video-tile-${id}`}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          webkit-playsinline="true"
          muted={isLocal}
          className={`w-full h-full ${isScreen || isDominant ? 'object-contain bg-black' : 'object-cover'} ${isLocal && !isScreen ? 'mirror' : ''}`}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-surface-800 to-surface-900 flex flex-col items-center justify-center gap-6 relative overflow-hidden">
          <audio ref={videoRef} autoPlay playsInline muted={isLocal} className="hidden" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary-500/10 via-transparent to-transparent animate-pulse duration-[4s]" />
          
          <div className={`rounded-full bg-gradient-to-b from-surface-700 to-surface-800 border-2 border-white/10 flex items-center justify-center font-black text-white relative z-10 shadow-[0_20px_40px_rgba(0,0,0,0.4)] ring-1 ring-white/20 overflow-hidden transition-all duration-500 hover:scale-105 ${isDominant ? 'w-48 h-48' : 'w-24 h-24'}`}>
            <Avatar 
              src={user?.avatar} 
              name={user?.name} 
              size={isDominant ? 'xl' : 'lg'} 
              className="w-full h-full"
            />
          </div>

          {!hasVideo && isLocal && (
            <div className="bg-red-500/5 backdrop-blur-md border border-red-500/20 px-4 py-1.5 rounded-xl flex items-center gap-2 z-10 animate-in fade-in zoom-in duration-500">
              <VideoOff size={14} className="text-red-500/60" />
              <span className="text-[10px] font-black text-red-500/60 uppercase tracking-[0.2em]">Privacy Mode</span>
            </div>
          )}
        </div>
      )}

      {/* Pin & PiP Controls (Top Right) */}
      <div className={`absolute top-3 right-3 flex flex-col gap-2 z-30 transition-all duration-300 ${isDominant ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <button
          onClick={() => onTogglePin(id)}
          className={`p-2 rounded-xl transition-all duration-300 ${
            isPinned 
              ? 'bg-primary-500 text-white shadow-lg' 
              : 'bg-black/40 text-white/70 hover:bg-black/60 shadow-md backdrop-blur-sm'
          }`}
          title={isPinned ? 'Unpin' : 'Pin'}
        >
          {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
        </button>

        {hasVideo && !isLocal && (
          <button
            onClick={handlePiP}
            className="p-2 rounded-xl bg-black/40 text-white/70 hover:bg-black/60 hover:text-white transition-all duration-300 shadow-md backdrop-blur-sm"
            title="Pop Out (Picture in Picture)"
          >
            <PictureInPicture2 size={16} />
          </button>
        )}

        <button
          onClick={handleFullScreen}
          className="p-2 rounded-xl bg-black/40 text-white/70 hover:bg-black/60 hover:text-white transition-all duration-300 shadow-md backdrop-blur-sm"
          title={isTileFullScreen ? 'Exit Full Screen' : 'Full Screen'}
        >
          {isTileFullScreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </button>
      </div>

      {/* Overlay info */}
      <div className={`absolute inset-x-0 bottom-0 p-4 sm:p-6 bg-gradient-to-t from-black/95 via-black/40 to-transparent transition-all duration-500 backdrop-blur-[2px] ${isDominant ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0'}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="group/stat relative shrink-0">
              <SignalHigh size={16} className={`${signalColor} drop-shadow-lg transition-colors duration-500`} />
              {/* Tooltip for stats */}
              <div className="absolute bottom-full left-0 mb-3 p-2 px-3 bg-surface-900/95 backdrop-blur-2xl rounded-xl text-[10px] whitespace-nowrap opacity-0 group-hover/stat:opacity-100 transition-all pointer-events-none border border-white/10 z-[100] shadow-2xl font-black uppercase tracking-widest text-white translate-y-2 group-hover/stat:translate-y-0 saturate-150">
                 Latency: <span className={signalColor}>{quality || 'Optimal'}</span>
              </div>
            </div>
            <span className="text-base font-black truncate text-white/95 tracking-tight drop-shadow-2xl">
              {isLocal ? `${user?.name} (You)` : user?.name}
            </span>
            {isScreen && (
              <span className="px-3 py-1 rounded-lg bg-primary-500 text-white text-[9px] font-black uppercase tracking-[0.15em] shadow-lg shadow-primary-500/20">
                Live Share
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {hasRaisedHand && (
              <div className="w-8 h-8 bg-amber-500 border-2 border-white/20 rounded-full flex items-center justify-center text-lg shadow-2xl shadow-amber-500/40 animate-bounce">
                ✋
              </div>
            )}
            {isMuted && (
              <div className="p-2 rounded-xl bg-red-500/20 backdrop-blur-md border border-red-500/30 shadow-lg">
                <MicOff size={16} className="text-red-400" />
              </div>
            )}
          </div>
        </div>
      </div>


      {isLocal && !isPinned && (
        <div className="absolute top-3 right-3 mr-12">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/20 text-primary-400 border border-indigo-500/20">YOU</span>
        </div>
      )}
    </div>
  );
});
