import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mic, MicOff, Video, VideoOff, MessageSquare,
  Hand, PhoneOff, Users, Maximize, Minimize, Settings, MonitorUp, Download, Share2,
  Captions, CaptionsOff, LayoutGrid, Disc, BarChart3, Layout, Grid
} from 'lucide-react';
import { useSessionStore } from '../../store/sessionStore.js';

export default function ControlBar({
  isMuted, isCamOff, chatOpen, unreadCount, participantsOpen, isFullScreen, isScreenSharing,
  onToggleMic, onToggleCam, onToggleChat, onToggleParticipants, onToggleFullScreen,
  onToggleScreenShare, onToggleSettings, onSendReaction,
  onRaiseHand, onLeave, onDownloadAttendance, onCopyLink,
  captionsEnabled, onToggleCaptions,
  hideNonVideo, onToggleHideNonVideo,
  isRecording, onToggleRecording,
  onOpenPoll,
  layoutMode, onLayoutChange
}) {
  const { participants, raisedHands } = useSessionStore();
  const [handRaised, setHandRaised] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const timerRef = useRef(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsVisible(true);
    timerRef.current = setTimeout(() => {
      // Don't hide if a menu is open
      if (!showReactions && !showLayoutMenu) {
        setIsVisible(false);
      }
    }, 4000); // Hide after 4 seconds of inactivity
  }, [showReactions, showLayoutMenu]);

  useEffect(() => {
    const handleActivity = () => resetTimer();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('keydown', handleActivity);
    
    resetTimer(); // Start timer on mount

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer]);

  const handleHandRaise = () => {
    const newState = !handRaised;
    setHandRaised(newState);
    onRaiseHand(newState);
  };

  const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95vw] lg:w-fit transition-all duration-500 ease-in-out ${
      isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'
    }`}>
      <div className="flex items-center gap-2 sm:gap-3 p-3 px-4 sm:px-8 bg-surface-800/70 backdrop-blur-3xl saturate-150 border border-white/20 rounded-[28px] ring-1 ring-black/40 shadow-2xl transition-all duration-500 overflow-x-auto custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
        
        {/* Group 1: Media Controls */}
        <div className="flex items-center gap-2">
          {/* Mic */}
          <ControlButton
            id="control-mic"
            active={!isMuted}
            activeClass="bg-primary-500/20 border-primary-500/40 text-primary-300 shadow-[0_0_20px_rgba(67,97,238,0.2)]"
            inactiveClass="bg-surface-700 hover:bg-surface-600"
            onClick={onToggleMic}
            title={isMuted ? 'Unmute' : 'Mute'}
            label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff size={22} className="text-red-500/80" /> : <Mic size={22} />}
          </ControlButton>

          {/* Camera */}
          <ControlButton
            id="control-cam"
            active={!isCamOff}
            activeClass="bg-primary-500/20 border-primary-500/40 text-primary-300 shadow-[0_0_20px_rgba(67,97,238,0.2)]"
            inactiveClass="bg-surface-700 hover:bg-surface-600"
            onClick={onToggleCam}
            title={isCamOff ? 'Turn on camera' : 'Turn off camera'}
            label={isCamOff ? 'Cam On' : 'Cam Off'}
          >
            {isCamOff ? <VideoOff size={22} className="text-red-500/80" /> : <Video size={22} />}
          </ControlButton>

          {/* Reactions */}
          <div className="relative">
            <ControlButton
              id="control-reactions"
              active={showReactions}
              activeClass="bg-primary-500/20 border-primary-500/40 text-primary-400 shadow-[0_0_20px_rgba(67,97,238,0.2)]"
              inactiveClass="bg-surface-700 hover:bg-surface-600"
              onClick={() => setShowReactions(!showReactions)}
              title="Reactions"
              label="React"
            >
              <div className="text-xl">😊</div>
            </ControlButton>
            
            {showReactions && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 bg-surface-800/90 backdrop-blur-xl border border-white/10 rounded-2xl p-3 flex gap-2 animate-in zoom-in-95 duration-200 shadow-2xl flex-wrap justify-center w-[280px] sm:w-auto sm:flex-nowrap z-50">
                {['❤️', '👍', '🎉', '😂', '😮', '😢', '🔥', '👏'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onSendReaction(emoji);
                      setShowReactions(false);
                    }}
                    className="w-12 h-12 flex items-center justify-center text-2xl hover:bg-white/10 rounded-xl transition-all hover:scale-125 active:scale-95"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            {showReactions && (
              <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowReactions(false)} />
            )}
          </div>

          {/* Screen Share */}
          <ControlButton
              id="control-screen"
              active={isScreenSharing}
              activeClass="bg-primary-500/20 border-primary-500/40 text-primary-300 shadow-[0_0_20px_rgba(67,97,238,0.2)]"
              inactiveClass="bg-surface-700 hover:bg-surface-600"
              onClick={onToggleScreenShare}
              title="Share Screen"
              label="Share"
            >
              <MonitorUp size={22} className={isScreenSharing ? 'text-primary-400' : ''} />
            </ControlButton>

          {/* Fullscreen */}
          <ControlButton
            id="control-fullscreen"
            active={isFullScreen}
            activeClass="bg-primary-500/20 border-primary-500/40 text-primary-300 shadow-[0_0_20px_rgba(67,97,238,0.2)]"
            inactiveClass="bg-surface-700 hover:bg-surface-600"
            onClick={onToggleFullScreen}
            title={isFullScreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            label={isFullScreen ? 'Exit FS' : 'Full FS'}
          >
            {isFullScreen ? <Minimize size={22} /> : <Maximize size={22} />}
          </ControlButton>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-8 bg-white/5 shrink-0" />

        {/* Group 2: Collaboration */}
        <div className="flex items-center gap-2">
          {/* Raise hand */}
          <ControlButton
            id="control-hand"
            active={handRaised}
            activeClass="bg-primary-500/20 border-primary-500/40 text-primary-300 shadow-[0_0_20px_rgba(67,97,238,0.2)]"
            inactiveClass="bg-surface-700 hover:bg-surface-600"
            onClick={handleHandRaise}
            title={handRaised ? 'Lower hand' : 'Raise hand'}
            label={handRaised ? 'Lower' : 'Hand'}
          >
            <Hand size={22} className={handRaised ? 'text-amber-400' : ''} />
          </ControlButton>

          {/* Share Link */}
          <ControlButton
            id="control-share"
            active={false}
            activeClass=""
            inactiveClass="bg-surface-700 hover:bg-surface-600"
            onClick={onCopyLink}
            title="Share Session Link"
            label="Link"
          >
            <Share2 size={22} className="text-primary-400" />
          </ControlButton>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-8 bg-white/5 shrink-0" />

        {/* Group 3: Tools */}
        <div className="flex items-center gap-2">
          {/* Layout & Focus Menu */}
          <div className="relative">
            <ControlButton
              id="control-layout"
              active={showLayoutMenu || layoutMode !== 'auto'}
              activeClass="bg-primary-500/20 border-primary-500/40 text-primary-400 shadow-[0_0_20px_rgba(67,97,238,0.2)]"
              inactiveClass="bg-surface-700 hover:bg-surface-600"
              onClick={() => setShowLayoutMenu(!showLayoutMenu)}
              title="Change layout"
              label="Layout"
            >
              {layoutMode === 'spotlight' ? <Maximize size={22} /> : 
               layoutMode === 'sidebar' ? <Layout size={22} /> : 
               layoutMode === 'tiled' ? <Grid size={22} /> : 
               <LayoutGrid size={22} />}
            </ControlButton>

            {showLayoutMenu && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 bg-surface-800/90 backdrop-blur-3xl saturate-200 border border-white/20 rounded-2xl p-3 w-[240px] shadow-[0_30px_60px_rgba(0,0,0,0.6)] animate-in zoom-in-95 duration-300 z-50">
                <div className="text-[10px] font-bold text-white/60 uppercase tracking-widest px-2 mb-3">Layout Mode</div>
                
                <div className="space-y-1 mb-4">
                  {[
                    { id: 'auto', label: 'Auto', desc: 'Smarter switching' },
                    { id: 'tiled', label: 'Tiled', desc: 'Everyone in a grid' },
                    { id: 'spotlight', label: 'Spotlight', desc: 'Focus on one person' },
                    { id: 'sidebar', label: 'Sidebar', desc: 'Speaker and small tiles' }
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => {
                        onLayoutChange(mode.id);
                        setShowLayoutMenu(false);
                      }}
                      className={`w-full flex flex-col items-start px-3 py-2.5 rounded-xl transition-all border ${
                        layoutMode === mode.id 
                          ? 'bg-primary-500/20 text-primary-300 border-primary-500/40 shadow-inner' 
                          : 'hover:bg-white/5 text-white/90 border-transparent hover:border-white/5'
                      }`}
                    >
                      <span className={`text-sm font-black tracking-tight ${layoutMode === mode.id ? 'text-primary-300' : 'text-white'}`}>{mode.label}</span>
                      <span className={`text-[10px] uppercase font-black tracking-widest opacity-60 mt-0.5 ${layoutMode === mode.id ? 'text-primary-400' : ''}`}>{mode.desc}</span>
                    </button>
                  ))}
                </div>

                <div className="pt-3 border-t border-white/5">
                  <button
                    onClick={() => {
                      onToggleHideNonVideo();
                      setShowLayoutMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                      hideNonVideo 
                        ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                        : 'hover:bg-white/5 text-white/70 border border-transparent'
                    }`}
                  >
                    <span className="text-xs font-bold whitespace-nowrap">Focus Mode</span>
                    <div className={`w-2 h-2 rounded-full ${hideNonVideo ? 'bg-indigo-400 animate-pulse' : 'bg-white/10'}`} />
                  </button>
                  <p className="text-[9px] text-white/50 px-3 mt-1 underline decoration-white/20 underline-offset-2 italic">Hide non-video participants</p>
                </div>
              </div>
            )}
            {showLayoutMenu && (
              <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowLayoutMenu(false)} />
            )}
          </div>

          {/* Record */}
          <button
              id="control-record"
            onClick={onToggleRecording}
            className={`flex items-center gap-2 px-4 h-12 sm:h-14 rounded-2xl transition-all duration-300 font-bold justify-center border ${
              isRecording 
                ? 'bg-red-500/20 text-red-500 border-red-500/40 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.25)]' 
                : 'bg-surface-700 hover:bg-surface-600 text-white border-white/10'
            }`}
            title={isRecording ? 'Stop Recording' : 'Start Recording'}
          >
            <Disc size={22} className={isRecording ? 'text-red-500 shadow-glow shadow-red-500/50' : 'text-primary-400/80'} />
            <span className={`text-[10px] uppercase font-black tracking-widest leading-none ${isRecording ? 'text-red-500' : 'text-white/40'}`}>
              {isRecording ? 'Stop Record' : 'Start Record'}
            </span>
            </button>

          {/* Poll */}
          <ControlButton
            id="control-poll"
            active={false}
            activeClass=""
            inactiveClass="bg-surface-700 hover:bg-surface-600"
            onClick={onOpenPoll}
            title="Create/View Poll"
            label="Poll"
          >
            <BarChart3 size={22} />
          </ControlButton>

          {/* Settings */}
          <ControlButton
            id="control-settings"
            active={false}
            activeClass=""
            inactiveClass="bg-surface-700 hover:bg-surface-600"
            onClick={onToggleSettings}
            title="Settings"
            label="Settings"
          >
            <Settings size={22} />
          </ControlButton>

          {/* Captions */}
          <ControlButton
            id="control-cc"
            active={captionsEnabled}
            activeClass="bg-primary-500/20 border-primary-500/40 text-primary-300 shadow-[0_0_20px_rgba(67,97,238,0.2)]"
            inactiveClass="bg-surface-700 hover:bg-surface-600"
            onClick={onToggleCaptions}
            title={captionsEnabled ? 'Disable Captions' : 'Enable Live Captions'}
            label={captionsEnabled ? 'CC On' : 'CC Off'}
          >
            {captionsEnabled ? <Captions size={22} className="text-primary-400" /> : <CaptionsOff size={22} />}
          </ControlButton>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-8 bg-white/5 shrink-0" />

        {/* Group 4: Session Panel Controls */}
        <div className="flex items-center gap-2">
          {/* Chat */}
          <ControlButton
            id="control-chat"
            active={chatOpen}
            activeClass="bg-primary-500/20 border-primary-500/40 text-primary-300 shadow-[0_0_20px_rgba(67,97,238,0.2)]"
            inactiveClass="bg-surface-700 hover:bg-surface-600 relative"
            onClick={onToggleChat}
            title="Toggle chat"
            label="Chat"
          >
            <MessageSquare size={22} className={chatOpen ? 'text-primary-400' : ''} />
            {unreadCount > 0 && !chatOpen && (
              <span className="absolute -top-1.5 -right-1.5 bg-primary-500 text-white text-[10px] flex items-center justify-center font-bold px-1.5 py-0.5 rounded-full shadow-md min-w-[20px] min-h-[20px]">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </ControlButton>

          {/* Participants */}
          <button
            id="control-participants"
            onClick={onToggleParticipants}
            aria-label="Toggle participants panel"
            className={`flex items-center justify-center gap-2 px-4 h-12 sm:h-14 rounded-2xl transition-all duration-300 font-bold shrink-0 border group/pbtn ${
              participantsOpen 
                ? 'bg-primary-500/20 border-primary-500/40 text-primary-300 shadow-[0_0_20px_rgba(67,97,238,0.1)]' 
                : 'bg-surface-700 hover:bg-surface-600 text-white border-white/10'
            }`}
          >
            <Users size={22} className={participantsOpen ? 'text-primary-400' : 'text-primary-400/80'} />
            <span className={`text-[11px] font-black tabular-nums tracking-widest ${participantsOpen ? 'text-primary-400' : 'text-white/40'}`}>
              {participants.length}
            </span>
          </button>

          {/* Attendance */}
          <ControlButton
            id="control-download"
            active={false}
            activeClass=""
            inactiveClass="bg-surface-700 hover:bg-surface-600"
            onClick={onDownloadAttendance}
            title="Attendance"
            label="Attend"
          >
            <Download size={22} />
          </ControlButton>

          {/* Leave */}
          <button
            id="control-leave"
            onClick={onLeave}
            aria-label="Leave session"
            className="flex items-center gap-2 px-5 sm:px-8 h-12 sm:h-14 rounded-2xl bg-red-600/90 hover:bg-red-500 text-white font-black transition-all duration-300 shadow-2xl shadow-red-600/30 ml-2 hover:scale-105 active:scale-95 border-t border-white/20"
          >
            <PhoneOff size={20} className="stroke-[3px]" />
            <span className="text-sm uppercase tracking-widest hidden lg:inline">Leave</span>
          </button>
        </div>
      </div>
    </div>
  );
}


function ControlButton({ id, children, onClick, title, active, activeClass, inactiveClass, label }) {
  return (
    <div className="relative group/btn">
      <button
        id={id}
        onClick={onClick}
        title={title}
        aria-label={title}
        className={`relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl transition-all duration-300 text-white flex-shrink-0 border ${
          active ? activeClass : inactiveClass
        } hover:scale-110 active:scale-90 hover:shadow-xl hover:z-10`}
      >
        {children}
      </button>
      
      {/* Tooltip-style Label */}
      {label && (
        <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1 bg-surface-800/90 border border-white/20 rounded-lg text-[10px] font-black uppercase tracking-widest text-white pointer-events-none opacity-0 group-hover/btn:opacity-100 group-hover/btn:-top-12 transition-all duration-200 shadow-2xl backdrop-blur-xl saturate-150">
          {label}
        </span>
      )}
    </div>
  );
}
