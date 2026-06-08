import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Camera, Mic, Check, Volume2, Play, MonitorUp } from 'lucide-react';
import { buildMediaConstraints } from '../../services/mediaDevices.js';

export default function MediaSettingsModal({ isOpen, onClose, selectedVideoId, selectedAudioId, selectedSpeakerId, dataSaver, onDeviceChange, onToggleDataSaver }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);

  // Local selections — applied to the session only when the user clicks "Done"
  const [localVideoId, setLocalVideoId] = useState(selectedVideoId);
  const [localAudioId, setLocalAudioId] = useState(selectedAudioId);
  const [localSpeakerId, setLocalSpeakerId] = useState(selectedSpeakerId || '');

  const videoRef = useRef(null);
  const previewStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const mountedRef = useRef(false);

  // Sync local state when modal opens with fresh selections
  useEffect(() => {
    if (isOpen) {
      setLocalVideoId(selectedVideoId);
      setLocalAudioId(selectedAudioId);
      setLocalSpeakerId(selectedSpeakerId || '');
    }
  }, [isOpen, selectedSpeakerId, selectedAudioId, selectedVideoId]);

  // Load device list once when modal opens
  useEffect(() => {
    mountedRef.current = true;
    if (isOpen) {
      loadDevices();
    }
    return () => {
      mountedRef.current = false;
      stopPreview();
    };
  }, [isOpen]);

  // Restart preview ONLY when LOCAL preview selections change
  useEffect(() => {
    if (isOpen) {
      startPreview(localVideoId, localAudioId);
    }
  }, [isOpen, localVideoId, localAudioId]);

  const loadDevices = async () => {
    try {
      setLoading(true);
      // Request permissions to get real device labels
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        .then(s => s.getTracks().forEach(t => t.stop())); // stop immediately, just for permission
      if (!mountedRef.current) return;

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      setDevices(allDevices);
    } catch (err) {
      console.error('Error loading devices:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const startPreview = async (videoId, audioId) => {
    stopPreview(); // always clear previous streams first

    try {
      const constraints = await buildMediaConstraints(videoId, audioId);
      
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        if (err.name === 'OverconstrainedError') {
          console.warn('OverconstrainedError during preview. Retrying with basic constraints...');
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } else {
          throw err;
        }
      }

      if (!mountedRef.current || !isOpen) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      previewStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Audio Meter Setup
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateMeter = () => {
        if (!mountedRef.current || !isOpen) return;
        analyserRef.current?.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        setAudioLevel(sum / bufferLength);
        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch (err) {
      console.error('Preview error:', err.message);
    }
  };

  const stopPreview = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach(t => t.stop());
      previewStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  };

  // Apply changes to the live session only when user clicks "Done"
  const handleDone = () => {
    const videoChanged = localVideoId !== selectedVideoId;
    const audioChanged = localAudioId !== selectedAudioId;
    const speakerChanged = localSpeakerId !== selectedSpeakerId;

    if (videoChanged) onDeviceChange('video', localVideoId);
    if (audioChanged) onDeviceChange('audio', localAudioId);
    if (speakerChanged) onDeviceChange('speaker', localSpeakerId);

    stopPreview();
    onClose();
  };

  const testSpeaker = () => {
    const ctx = new AudioContext();
    if (typeof ctx.setSinkId === 'function' && localSpeakerId) {
      ctx.setSinkId(localSpeakerId).catch(console.error);
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 440;
    gain.gain.value = 0.1;
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    setTimeout(() => ctx.close(), 700);
  };

  if (!isOpen) return null;

  const audioDevices = devices.filter(d => d.kind === 'audioinput');
  const videoDevices = devices.filter(d => d.kind === 'videoinput');
  const speakerDevices = devices.filter(d => d.kind === 'audiooutput');

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300 overflow-y-auto">
      <div className="w-full max-w-5xl bg-[#0f1115] border border-white/10 rounded-[2rem] overflow-hidden flex flex-col md:flex-row shadow-2xl relative max-h-[90vh] md:max-h-none overflow-y-auto md:overflow-visible">
        {/* Abstract Glows */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-500/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        
        {/* Left Area: Live Preview */}
        <div className="w-full md:w-[380px] shrink-0 border-b md:border-b-0 md:border-r border-white/10 p-6 md:p-8 flex flex-col relative z-10 bg-black/20">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white tracking-tight">Audio & Video</h2>
            <button onClick={() => { stopPreview(); onClose(); }} className="md:hidden p-2 text-white/40 hover:text-white bg-white/5 rounded-full">
              <X size={18} />
            </button>
          </div>
          
          <div className="relative w-full rounded-2xl overflow-hidden bg-black shadow-inner border border-white/10 aspect-video md:aspect-[4/3]">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror" />
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
               <span className="text-[10px] font-medium text-emerald-100 tracking-wide uppercase">Live</span>
             </div>
          </div>

          <div className="mt-8 flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs text-white/50 font-medium">
              <span>Input Level</span>
              <span>{Math.round((audioLevel / 255) * 100)}%</span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
               <div
                 className="h-full bg-emerald-400 transition-all duration-75 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                 style={{ width: `${Math.min(100, (audioLevel / 128) * 100)}%` }}
               />
            </div>
          </div>

          <button
            onClick={testSpeaker}
            className="mt-6 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 transition-colors border border-white/5 font-medium text-sm group"
          >
            <Volume2 size={16} className="text-white/40 group-hover:text-white transition-colors" />
            Play Test Sound
          </button>
        </div>

        {/* Right Area: Devices */}
        <div className="flex-1 flex flex-col relative z-10 p-6 md:p-8 min-w-0">
          <div className="hidden md:flex justify-end mb-4">
             <button onClick={() => { stopPreview(); onClose(); }} className="text-white/40 hover:text-white transition-colors p-2">
                <X size={24} />
             </button>
          </div>

          <div className="space-y-8 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            
            {/* Camera Category */}
            <div>
              <h3 className="text-[11px] font-bold text-white/40 flex items-center gap-2 uppercase tracking-widest mb-4">
                <Camera size={14} /> Camera
              </h3>
              {loading ? (
                <div className="h-12 w-full animate-pulse bg-white/5 rounded-xl" />
              ) : (
                <div className="flex flex-col gap-2">
                  {videoDevices.map((device) => (
                    <button
                      key={device.deviceId}
                      onClick={() => setLocalVideoId(device.deviceId)}
                      className={`flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all text-sm group text-left ${
                        localVideoId === device.deviceId
                          ? 'bg-primary-500/10 border-primary-500/30 text-white'
                          : 'bg-transparent border-transparent hover:bg-white/5 text-white/60 hover:text-white'
                      }`}
                    >
                      <span className="truncate flex-1 min-w-0 pr-4">{device.label || `Camera ${device.deviceId.slice(0, 5)}`}</span>
                      <div className={`transition-all shrink-0 ${localVideoId === device.deviceId ? 'opacity-100 text-primary-400' : 'opacity-0'}`}>
                        <Check size={16} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mic Category */}
            <div>
              <h3 className="text-[11px] font-bold text-white/40 flex items-center gap-2 uppercase tracking-widest mb-4">
                <Mic size={14} /> Microphone
              </h3>
              {loading ? (
                <div className="h-12 w-full animate-pulse bg-white/5 rounded-xl" />
              ) : (
                <div className="flex flex-col gap-2">
                  {audioDevices.map((device) => (
                    <button
                      key={device.deviceId}
                      onClick={() => setLocalAudioId(device.deviceId)}
                      className={`flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all text-sm group text-left ${
                        localAudioId === device.deviceId
                          ? 'bg-orange-500/10 border-orange-500/30 text-white'
                          : 'bg-transparent border-transparent hover:bg-white/5 text-white/60 hover:text-white'
                      }`}
                    >
                      <span className="truncate flex-1 min-w-0 pr-4">{device.label || `Microphone ${device.deviceId.slice(0, 5)}`}</span>
                      <div className={`transition-all shrink-0 ${localAudioId === device.deviceId ? 'opacity-100 text-orange-400' : 'opacity-0'}`}>
                        <Check size={16} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Speaker Category */}
            {speakerDevices.length > 0 && (
              <div>
                <h3 className="text-[11px] font-bold text-white/40 flex items-center gap-2 uppercase tracking-widest mb-4">
                  <Volume2 size={14} /> Output
                </h3>
                <div className="flex flex-col gap-2">
                  {speakerDevices.map((device) => (
                    <button
                      key={device.deviceId}
                      onClick={() => setLocalSpeakerId(device.deviceId)}
                      className={`flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all text-sm group text-left ${
                        localSpeakerId === device.deviceId
                          ? 'bg-indigo-500/10 border-indigo-500/30 text-white'
                          : 'bg-transparent border-transparent hover:bg-white/5 text-white/60 hover:text-white'
                      }`}
                    >
                      <span className="truncate flex-1 min-w-0 pr-4">{device.label || `Speaker ${device.deviceId.slice(0, 5)}`}</span>
                      <div className={`transition-all shrink-0 ${localSpeakerId === device.deviceId ? 'opacity-100 text-indigo-400' : 'opacity-0'}`}>
                        <Check size={16} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-6">
             <label className="flex items-center gap-3 cursor-pointer group">
                <button
                  onClick={onToggleDataSaver}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-300 focus:outline-none ${
                    dataSaver ? 'bg-primary-500' : 'bg-white/10'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${dataSaver ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <div className="space-y-0.5">
                  <div className="text-sm text-white/80 font-bold">Data Saver</div>
                  <div className="text-[10px] text-white/40">Disable incoming video</div>
                </div>
             </label>

             <button onClick={handleDone} className="bg-white hover:bg-gray-100 text-black px-8 py-3 rounded-xl font-bold transition-all w-full sm:w-auto shadow-lg">
               Save Changes
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
