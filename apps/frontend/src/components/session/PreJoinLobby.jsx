import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Video, VideoOff, ChevronRight, ArrowLeft, Users, Shield } from 'lucide-react';
import { buildMediaConstraints } from '../../services/mediaDevices.js';
import Avatar from '../ui/Avatar.jsx';

export default function PreJoinLobby({ session, user, onJoin }) {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mountedRef = useRef(true);

  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [permissionState, setPermissionState] = useState('requesting'); // requesting | granted | denied
  const [joining, setJoining] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    startPreview();
    return () => {
      mountedRef.current = false;
      stopPreview();
    };
  }, []);

  const startPreview = async () => {
    try {
      const constraints = await buildMediaConstraints(undefined, undefined);
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        if (err.name === 'OverconstrainedError') {
          console.warn('OverconstrainedError during startPreview. Retrying with basic constraints...');
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } else {
          throw err;
        }
      }
      if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }

      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setPermissionState('granted');
      
      // Setup Audio Meter
      if (stream.getAudioTracks().length > 0) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') ctx.resume();
        
        const analyser = ctx.createAnalyser();
        const source = ctx.createMediaStreamSource(new MediaStream([stream.getAudioTracks()[0].clone()]));
        source.connect(analyser);
        analyser.fftSize = 256;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const updateMeter = () => {
          if (!mountedRef.current) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
          setAudioLevel(sum / dataArray.length);
          animationFrameRef.current = requestAnimationFrame(updateMeter);
        };
        updateMeter();
      }
    } catch (err) {
      console.warn('Camera/mic access denied or unavailable:', err.name);
      setPermissionState('denied');
      setIsMuted(true);
      setIsCamOff(true);
    }
  };

  const stopPreview = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const toggleCam = () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !isCamOff;
      setIsCamOff(prev => !prev);
    } else {
      setIsCamOff(prev => !prev);
    }
  };

  const toggleMic = () => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = isMuted; // if currently muted, unmute
      setIsMuted(prev => !prev);
    } else {
      setIsMuted(prev => !prev);
    }
  };

  const handleJoin = async () => {
    setJoining(true);
    // Stop the preview stream — SessionPage will create its own
    stopPreview();
    // Pass user's choices to the session page
    onJoin({ isMuted, isCamOff });
  };


  return (
    <div className="min-h-screen bg-[#060811] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Dynamic Aesthetic Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-600/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-indigo-600/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 w-full max-w-5xl flex flex-col lg:flex-row gap-10 items-center">

        {/* ── Left: Camera Preview ── */}
        <div className="flex-1 w-full max-w-xl">
          {/* Preview box */}
          <div className="relative aspect-video rounded-3xl overflow-hidden bg-surface-900/50 border border-white/10 shadow-2xl group bento-card !p-0">
            {/* Video feed */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover mirror transition-all duration-700 ${isCamOff ? 'opacity-0 scale-95 blur-xl' : 'opacity-100 scale-100 blur-0'}`}
            />

            {/* Avatar fallback when cam is off */}
            {isCamOff && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="w-20 h-20 rounded-full border border-primary-500/30 overflow-hidden shadow-xl">
                  <Avatar 
                    src={user?.profilePic || user?.avatar} 
                    name={user?.name} 
                    size="lg"
                    className="w-full h-full"
                  />
                </div>
                <p className="text-sm text-foreground/40">Camera is off</p>
              </div>
            )}

            {/* Permission denied overlay */}
            {permissionState === 'denied' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-900/90">
                <VideoOff size={36} className="text-red-400" />
                <p className="text-sm text-foreground/60 text-center px-4">
                  Camera/mic access denied.<br />
                  <span className="text-foreground/40 text-xs">Check browser permissions to enable.</span>
                </p>
              </div>
            )}

            {/* Name label */}
            <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg text-sm font-semibold border border-white/10">
              {user?.name || 'You'}
            </div>

            {/* Status indicators top-right */}
            {(isMuted || isCamOff) && (
              <div className="absolute top-4 right-4 flex gap-2">
                {isMuted && (
                  <div className="p-1.5 bg-red-500/20 border border-red-500/30 rounded-lg">
                    <MicOff size={14} className="text-red-400" />
                  </div>
                )}
                {isCamOff && (
                  <div className="p-1.5 bg-red-500/20 border border-red-500/30 rounded-lg">
                    <VideoOff size={14} className="text-red-400" />
                  </div>
                )}
              </div>
            )}

            {/* Audio VU Meter */}
            {!isMuted && permissionState === 'granted' && (
              <div className="absolute top-4 left-4 z-20 pointer-events-none">
                 <div className="flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg border border-white/10">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                   <div className="h-1.5 w-16 bg-black/40 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-75"
                        style={{ width: `${Math.min(100, (audioLevel / 128) * 100)}%` }}
                      />
                   </div>
                 </div>
              </div>
            )}
          </div>

          {/* ── Cam / Mic Toggle Buttons ── */}
          <div className="flex justify-center gap-4 mt-5">
            {/* Mic */}
            <button
              onClick={toggleMic}
              className={`flex flex-col items-center gap-2 px-8 py-4 rounded-2xl border transition-all active:scale-95 ${
                isMuted
                  ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                  : 'glass-dark border-white/10 text-white hover:bg-white/5'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-1">
                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
                {isMuted ? 'Muted' : 'Unmuted'}
              </span>
            </button>

            {/* Camera */}
            <button
              onClick={toggleCam}
              className={`flex flex-col items-center gap-2 px-8 py-4 rounded-2xl border transition-all active:scale-95 ${
                isCamOff
                  ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                  : 'glass-dark border-white/10 text-white hover:bg-white/5'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-1">
                {isCamOff ? <VideoOff size={24} /> : <Video size={24} />}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
                {isCamOff ? 'Stop Cam' : 'Start Cam'}
              </span>
            </button>
          </div>
        </div>

        {/* ── Right: Session Info + Join ── */}
        <div className="flex-1 w-full max-w-sm flex flex-col gap-6">
          {/* Back button */}
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-foreground/40 hover:text-foreground transition-colors text-sm w-fit"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>

          {/* Session card */}
          <div className="glass-dark border-white/10 rounded-[2rem] p-8 space-y-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div>
              <p className="text-[10px] text-primary-400 uppercase tracking-[0.2em] font-black mb-2 flex items-center gap-2">
                <Shield size={10} /> Incoming Session
              </p>
              <h1 className="text-3xl font-black leading-tight tracking-tight text-gradient">{session?.title || 'Session'}</h1>
            </div>

            <div className="flex items-center gap-4 py-4 border-t border-white/5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-primary-500/20 overflow-hidden shrink-0">
                <Avatar 
                  src={session?.host?.avatar} 
                  name={session?.host?.name || 'Host'} 
                  size="md"
                  className="w-full h-full rounded-2xl"
                />
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Hosted by</p>
                <p className="text-base font-bold">{session?.host?.name || 'Host'}</p>
              </div>
            </div>

            {/* Status indicators */}
            <div className="flex gap-3">
              <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl flex-1 justify-center border transition-colors ${
                isMuted
                  ? 'bg-red-500/10 border-red-500/20 text-red-400'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}>
                {isMuted ? <MicOff size={12} /> : <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                {isMuted ? 'Muted' : 'Mic Active'}
              </div>
              <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl flex-1 justify-center border transition-colors ${
                isCamOff
                  ? 'bg-red-500/10 border-red-500/20 text-red-400'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}>
                {isCamOff ? <VideoOff size={12} /> : <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                {isCamOff ? 'Cam Off' : 'Cam Active'}
              </div>
            </div>
          </div>

          {/* Joining as */}
          <div className="flex items-center gap-3 px-4 py-3 bg-surface-800/50 border border-white/5 rounded-xl">
            <div className="w-9 h-9 rounded-full border border-primary-500/20 overflow-hidden shrink-0">
              <Avatar 
                src={user?.profilePic || user?.avatar} 
                name={user?.name} 
                size="sm"
                className="w-full h-full"
              />
            </div>
            <div>
              <p className="text-[10px] text-foreground/30 uppercase tracking-widest">Joining as</p>
              <p className="text-sm font-semibold">{user?.name}</p>
            </div>
          </div>

          {/* Join button */}
          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full py-5 rounded-[1.5rem] bg-gradient-to-r from-primary-500 to-indigo-600 hover:from-primary-600 hover:to-indigo-700 text-white font-bold text-lg flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-glow-primary group disabled:opacity-50"
          >
            {joining ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="uppercase tracking-[0.2em] text-sm">Synchronizing...</span>
              </div>
            ) : (
              <>
                <span className="uppercase tracking-[0.2em] text-sm">Join Session</span>
                <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>

          <p className="text-center text-[11px] text-foreground/20">
            You can change camera and microphone settings inside the session
          </p>
        </div>
      </div>
    </div>
  );
}
