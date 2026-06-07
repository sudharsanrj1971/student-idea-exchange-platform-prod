import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Maximize, Minimize, Download, Share2, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../services/api.js';
import { socketService } from '../services/socket.js';
import { webrtcService } from '../services/webrtc.js';
import { useAuthStore } from '../store/authStore.js';
import { useSessionStore } from '../store/sessionStore.js';
import { buildMediaConstraints } from '../services/mediaDevices.js';
import { useActiveSpeaker } from '../hooks/useActiveSpeaker.js';
import VideoGrid from '../components/session/VideoGrid.jsx';
import ControlBar from '../components/session/ControlBar.jsx';
import ChatPanel from '../components/session/ChatPanel.jsx';
import ParticipantsPanel from '../components/session/ParticipantsPanel.jsx';
import MediaSettingsModal from '../components/session/MediaSettingsModal.jsx';
import AttendanceModal from '../components/session/AttendanceModal.jsx';
import PollModal from '../components/session/PollModal.jsx';
import { EmojiRain } from '../components/session/EmojiReactions.jsx';
import { ConnectionStatus } from '../components/ui/ConnectionStatus.jsx';
import { ReconnectBanner } from '../components/ui/ReconnectBanner.jsx';
import PreJoinLobby from '../components/session/PreJoinLobby.jsx';
import ErrorBoundary from '../components/ui/ErrorBoundary.jsx';

export default function SessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { setCurrentSession, setParticipants, addParticipant, removeParticipant, toggleHand, lowerHand, reset } = useSessionStore();

  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [connectionState, setConnectionState] = useState('connecting');
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState(new Map()); // producerId → stream info
  const [consumerStats, setConsumerStats] = useState(new Map()); // consumerId → { quality: 'good'|'fair'|'poor' }
  const [localStream, setLocalStream] = useState(null); // BUG FIX: was missing, caused ReferenceError
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState(localStorage.getItem('ichange_video_id') || '');
  const [selectedAudioId, setSelectedAudioId] = useState(localStorage.getItem('ichange_audio_id') || '');
  const [selectedSpeakerId, setSelectedSpeakerId] = useState(localStorage.getItem('ichange_speaker_id') || '');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [reactions, setReactions] = useState([]);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [pinnedId, setPinnedId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [sessionDuration, setSessionDuration] = useState('00:00:00');
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [liveCaption, setLiveCaption] = useState(null);
  const [dataSaver, setDataSaver] = useState(false);
  const [hideNonVideo, setHideNonVideo] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPollOpen, setIsPollOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState('auto'); // auto, tiled, spotlight, sidebar
  const [activePoll, setActivePoll] = useState(null);
  const [pollVotes, setPollVotes] = useState({}); // optionIndex -> count
  const [userVote, setUserVote] = useState(null);
  const chatOpenRef = useRef(chatOpen);
  const speechRecoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const remoteStreamsRef = useRef(new Map());
  const consumingRef = useRef(new Set());
  const handleNewProducerRef = useRef(null); // Always points to latest handleNewProducer

  useEffect(() => {
    const interval = setInterval(() => {
      const currentParticipants = useSessionStore.getState().participants;
      let changed = false;
      
      const activeSocketIds = new Set(currentParticipants.map(p => p.socketId));
      for (const [socketId] of remoteStreamsRef.current) {
        if (!activeSocketIds.has(socketId)) {
          remoteStreamsRef.current.delete(socketId);
          changed = true;
        }
      }

      const activeProducerIds = new Set();
      webrtcService.consumers.forEach(c => activeProducerIds.add(c.producerId));
      
      for (const prodId of consumingRef.current) {
        if (!activeProducerIds.has(prodId)) {
          consumingRef.current.delete(prodId);
        }
      }

      if (changed) {
        setRemoteStreams(new Map(remoteStreamsRef.current));
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!sessionStartTime) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - sessionStartTime) / 1000);
      const h = Math.floor(diff / 3600).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      // Only show hours if > 0
      setSessionDuration(h === '00' ? `${m}:${s}` : `${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

  useEffect(() => {
    chatOpenRef.current = chatOpen;
    if (chatOpen) setUnreadCount(0);
  }, [chatOpen]);

  // Update browser tab title based on recording state
  useEffect(() => {
    if (isRecording) {
      document.title = "● RECORDING - iChange";
    } else {
      document.title = "iChange — Live Learning Platform";
    }
    return () => {
      document.title = "iChange — Live Learning Platform";
    };
  }, [isRecording]);

  const onTogglePin = useCallback((id) => setPinnedId(prev => (prev === id ? null : id)), []);


  // Lobby state — shown before joining
  const [showLobby, setShowLobby] = useState(true);
  // Lobby pre-fetches session info so we can show title/host in the lobby
  const [lobbySessionData, setLobbySessionData] = useState(null);

  const mountedRef = useRef(true);
  const localStreamRef = useRef(null);
  const [localScreenStream, setLocalScreenStream] = useState(null);
  const [localAnalyzerStream, setLocalAnalyzerStream] = useState(null);
  const socketRef = useRef(null);

  // Monitor speaking while muted
  const isSpeaking = useActiveSpeaker(localAnalyzerStream, 0.05);
  useEffect(() => {
    if (isMuted && isSpeaking) {
      toast('Your microphone is muted', { id: 'muted-speak', icon: '🎤', duration: 2000 });
    }
  }, [isMuted, isSpeaking]);

  // Phase 1: load session data for the lobby (no socket, no WebRTC yet)
  useEffect(() => {
    mountedRef.current = true;
    fetchSessionForLobby();
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [sessionId]);

  const hasRetriedRef = useRef(false);

  const fetchSessionForLobby = async () => {
    try {
      const { data } = await api.get(`/api/sessions/${sessionId}`);
      if (!mountedRef.current) return;
      setLobbySessionData(data.session);
      setLoading(false);
    } catch (err) {
      console.error('Session load error:', err);
      if (!hasRetriedRef.current) {
        hasRetriedRef.current = true;
        console.log('Session load failed. Retrying in 2 seconds...');
        setTimeout(() => {
          if (mountedRef.current) {
            fetchSessionForLobby();
          }
        }, 2000);
      } else {
        toast.error('Failed to load session. Please check your connection.');
        navigate('/dashboard');
      }
    }
  };

  // Phase 2: called when user clicks "Join Now" in the lobby
  const handleLobbyJoin = ({ isMuted: startMuted, isCamOff: startCamOff }) => {
    setIsMuted(startMuted);
    setIsCamOff(startCamOff);
    setShowLobby(false);
    setSession(lobbySessionData);
    setCurrentSession(lobbySessionData);
    setLoading(true);
    initSession(startMuted, startCamOff);
  };

  // Phase 2: connect socket and start WebRTC after lobby
  const initSession = async (startMuted = false, startCamOff = false) => {
    try {
      setLoading(false);

      // Connect socket
      const socket = socketService.connect();
      socketRef.current = socket;

      // Single registration point for all permanent listeners
      setupSocketListeners(socket);

      // Re-trigger connection logic if already connected
      if (socket.connected) {
        handleSocketConnect(socket);
      }
    } catch (err) {
      console.error('Session load error:', err);
      toast.error('Failed to load session');
      navigate('/dashboard');
    }
  };

  const setupSocketListeners = (socket) => {
    // Clean up any existing listeners on this socket to prevent accumulation
    const events = [
      'connect', 'disconnect', 'reconnect',
      'session:participants', 'session:joined_toast', 'session:left_toast',
      'hand:update', 'admin:muteAll', 'admin:muted', 'admin:kicked', 'session:reaction',
      'media:newProducer', 'media:producerClosed', 'error', 'session:caption',
      'poll:started', 'poll:vote_cast', 'poll:ended'
    ];
    events.forEach(e => socket.off(e));

    // Basic events
    socket.on('connect', () => handleSocketConnect(socket));

    socket.on('disconnect', () => {
      setConnectionState('disconnected');
      setIsReconnecting(true);
    });
    socket.on('reconnect', () => {
      setConnectionState('connected');
      setIsReconnecting(false);
      toast.success('Reconnected!');
      handleSocketConnect(socket);
    });

    // Room events (Throttled list updates)
    socket.on('session:participants', ({ participants }) => {
      setParticipants(participants);
    });

    // Individual participant activity toasts (Immediate)
    socket.on('session:joined_toast', (joined) => {
      if (joined.id !== user?._id) {
        toast.success(`${joined.name} joined`, { icon: '👋', duration: 3000 });
      }
    });

    socket.on('session:left_toast', (left) => {
      if (left.id !== user?._id) {
        toast(`${left.name} left`, { icon: '🚪', duration: 3000 });
        removeParticipant(left.id);
      }
    });

    socket.on('hand:update', ({ userId, raised }) => {
      toggleHand(userId, raised);
    });

    // Admin events — received by ALL in the room; host is excluded from self-muting
    socket.on('admin:muteAll', () => {
      // The host triggered this — don't mute them
      const isHost = session?.host?._id?.toString() === user?._id?.toString() ||
                     session?.host?.toString() === user?._id?.toString();
      if (isHost) return;
      setIsMuted(true);
      stopMic();
      toast('🔇 You were muted by the host');
    });

    // Received only by the specifically muted user
    socket.on('admin:muted', () => {
      setIsMuted(true);
      stopMic();
      toast('🔇 You were muted by the host');
    });

    // Received only by the kicked user
    socket.on('admin:kicked', () => {
      toast.error('You have been removed from this session by the host.');
      cleanup();
      navigate('/dashboard');
    });

    socket.on('session:reaction', ({ userId, name, emoji }) => {
      const id = Date.now() + Math.random();
      // Pre-compute position so values are stable on each render
      const startX = 10 + Math.random() * 80;
      const sway = Math.random() * 80 - 40;
      setReactions(prev => [...prev.slice(-20), { id, userId, name, emoji, startX, sway }]);
    });

    socket.on('session:caption', ({ userId, name, text }) => {
      const id = Date.now();
      setLiveCaption({ text, name, id });
      setTimeout(() => {
        setLiveCaption(prev => prev?.id === id ? null : prev);
      }, 5000);
    });

    socket.on('poll:started', (poll) => {
      setActivePoll(poll);
      setPollVotes({});
      setUserVote(null);
      setIsPollOpen(true);
      toast('A new poll has started!', { icon: '📊' });
    });

    socket.on('poll:vote_cast', ({ pollId, optionIndex, userId }) => {
      setPollVotes(prev => ({
        ...prev,
        [optionIndex]: (prev[optionIndex] || 0) + 1
      }));
    });

    socket.on('poll:ended', () => {
      toast('The poll has ended.', { icon: '🛑' });
      // Keep results visible for a moment then allow closing
      setTimeout(() => {
        setActivePoll(null);
        setPollVotes({});
        setUserVote(null);
        setIsPollOpen(false);
      }, 10000);
    });

    socket.on('chat:message', (msg) => {
      const isOwn = msg.sender?._id === user?._id || msg.sender === user?._id;
      if (!chatOpenRef.current && !isOwn) {
        setUnreadCount(prev => prev + 1);
      }
    });

    socket.on('media:newProducer', (data) => {
      // Call via ref to always use the latest closure (avoids stale ref bug)
      if (handleNewProducerRef.current) handleNewProducerRef.current(data);
    });

    socket.on('media:producerClosed', ({ producerId }) => {
      // Map is keyed by socketId — find the entry that owns this producerId
      setRemoteStreams((prev) => {
        const newMap = new Map(prev);
        let deletedKey = null;
        for (const [key, val] of newMap) {
          if (val.producerIds && val.producerIds.has(producerId)) {
            val.producerIds.delete(producerId);
            if (val.producerIds.size === 0) {
              deletedKey = key;
            }
          }
        }
        if (deletedKey) {
          newMap.delete(deletedKey);
          // Also clean remoteStreamsRef
          remoteStreamsRef.current.delete(deletedKey);
        }
        return newMap;
      });
      consumingRef.current.delete(producerId);
      setPinnedId((prev) => (prev === producerId ? null : prev));
    });

    socket.on('error', ({ message }) => {
      // Only handle critical session-level errors here.
      // Media errors (transport, produce, consume) are now sent via response
      // events and handled by the _request promise — they never reach here.
      const critical = ['Session not found', 'Session is full', 'Failed to join session'];
      if (critical.some(m => message?.includes(m))) {
        toast.error(message);
        navigate('/dashboard');
        return;
      }
      // Log anything else but don't spam toasts
      console.warn('[Socket error]', message);
    });
  };

  const isJoiningRef = useRef(false);

  const handleSocketConnect = async (socket) => {
    if (isJoiningRef.current) return;
    isJoiningRef.current = true;

    try {
      setConnectionState('connected');
      setIsReconnecting(false);

      // On reconnect/rejoin: clean up existing WebRTC transports & clear remoteStreams state
      if (webrtcService.sessionId) {
        console.log('[WebRTC] Reconnecting/rejoining: cleaning up old session media');
        webrtcService.closeAll();
        setRemoteStreams(new Map());
        remoteStreamsRef.current = new Map();
        consumingRef.current = new Set();
      }

      // Emit session:join with an acknowledgment callback.
      // The server calls ack() AFTER socket.join(sessionId) is complete,
      // guaranteeing the socket is in the room before we call media:getRtpCapabilities.
      socket.emit('session:join', { sessionId }, async (response) => {
        if (!mountedRef.current) return;

        if (response?.error) {
          toast.error(response.error);
          if (response.error.includes('full') || response.error.includes('not found')) {
            navigate('/dashboard');
          }
          isJoiningRef.current = false;
          return;
        }

        // Room join confirmed — safe to initialize WebRTC now
        try {
          if (!sessionStartTime) setSessionStartTime(Date.now());
          await webrtcService.init(sessionId);
          await startLocalStream();

          const { producers } = await webrtcService._request('media:getProducers', { sessionId });
          for (const p of producers) {
            await handleNewProducer(p);
          }
        } catch (err) {
          console.error('WebRTC initialization failed:', err);
          toast.error('Could not connect media. Please refresh.');
        } finally {
          isJoiningRef.current = false;
        }
      });
    } catch (err) {
      console.error('handleSocketConnect error:', err);
      isJoiningRef.current = false;
    }
  };

  // Live Captions Engine (Speech-to-Text)
  useEffect(() => {
    if (!captionsEnabled || isMuted) {
      if (speechRecoRef.current) {
        try { speechRecoRef.current.stop(); } catch(e){}
      }
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Live Captions are not supported in your browser.');
      setCaptionsEnabled(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript.trim()) {
        socketRef.current?.emit('session:caption', { sessionId, text: finalTranscript.trim() });
      }
    };

    recognition.onerror = (e) => {
      console.warn('[Speech API] Error:', e.error);
      if (e.error === 'not-allowed') {
        toast.error('Microphone permission denied for captions');
        setCaptionsEnabled(false);
      }
    };

    recognition.onend = () => {
      // Auto-restart if it shuts off but we still want it
      if (captionsEnabled && !isMuted && speechRecoRef.current) {
        try { speechRecoRef.current.start(); } catch(e){}
      }
    };

    speechRecoRef.current = recognition;
    try { recognition.start(); } catch(e){}

    return () => {
      if (speechRecoRef.current) {
        try { speechRecoRef.current.stop(); } catch(e){}
      }
      speechRecoRef.current = null;
    };
  }, [captionsEnabled, isMuted, sessionId]);

  // Network Stats Polling (Quality Indicators)
  useEffect(() => {
    const interval = setInterval(async () => {
      const statsMap = new Map();
      
      const statPromises = Array.from(webrtcService.consumers.entries()).map(async ([consumerId, consumer]) => {
        const stats = await webrtcService.getConsumerStats(consumerId);
        if (!stats) return;

        // Simple heuristic for signal strength (standard RTCP stats)
        // Find the 'inbound-rtp' report
        let packetLoss = 0;
        stats.forEach(report => {
          if (report.type === 'inbound-rtp') {
            packetLoss = report.packetsLost || 0;
          }
        });

        // Current simplified logic: check if packetLoss is increasing rapidly 
        // (For now, we'll just mock a quality based on mere availability or jitter if present)
        statsMap.set(consumer.producerId, { 
          quality: packetLoss > 100 ? 'poor' : packetLoss > 10 ? 'fair' : 'good' 
        });
      });

      await Promise.all(statPromises);
      setConsumerStats(statsMap);
    }, 5000);

    return () => clearInterval(interval);
  }, []);


  const handleNewProducer = async ({ producerId, socketId, userId, name, kind, appData }) => {
    const userIdStr = userId?.toString?.() || (typeof userId === 'string' ? userId : null);
    if (!webrtcService.device?.loaded) {
      setTimeout(() => handleNewProducer({ producerId, socketId, userId, name, kind, appData }), 1000);
      return;
    }
    if (socketId === socketRef.current?.id) return;
    if (consumingRef.current.has(producerId)) return; // Already consuming
    consumingRef.current.add(producerId);

    try {
      const consumer = await webrtcService.consumeProducer(producerId);
      
      if (!remoteStreamsRef.current.has(socketId)) {
        remoteStreamsRef.current.set(socketId, {
          stream: new MediaStream(),
          tracks: {}
        });
      }

      const entry = remoteStreamsRef.current.get(socketId);

      consumer.track.enabled = true;

      const existingTrack = entry.stream
        .getTracks()
        .find(t => t.kind === consumer.track.kind);

      if (existingTrack) {
        entry.stream.removeTrack(existingTrack);
        existingTrack.stop();
      }

      entry.stream.addTrack(consumer.track);
      entry.tracks[consumer.track.kind] = consumer.track;
      const freshStream = new MediaStream(entry.stream.getTracks());
      entry.stream = freshStream;

      setRemoteStreams(prev => {
        const next = new Map(prev);

        const existing = next.get(socketId) || {};
        const producerIds = existing.producerIds || new Set();
        producerIds.add(producerId);

        let videoProducerId = existing.videoProducerId;
        let audioProducerId = existing.audioProducerId;
        if (consumer.track.kind === 'video') videoProducerId = producerId;
        if (consumer.track.kind === 'audio') audioProducerId = producerId;

        next.set(socketId, { 
          ...existing, 
          stream: freshStream, 
          kind: consumer.track.kind, 
          socketId, 
          userId: userIdStr || socketId, 
          appData, 
          name, 
          producerIds, 
          producerId, // Fallback for backward compatibility
          videoProducerId,
          audioProducerId,
          _t: Date.now() 
        });

        return next;
      });

      // Confirm the consumer is resumed on the server
      socketRef.current?.emit('media:resumeConsumer', { consumerId: consumer.id });

      if (appData?.screen) {
        setPinnedId(producerId);
        toast('Someone is presenting');
      }
    } catch (err) {
      console.error('Consume error:', err);
      // Remove from guard so a future new-producer event can retry
      consumingRef.current.delete(producerId);
    }
  };

  // Keep ref in sync with latest handleNewProducer closure
  handleNewProducerRef.current = handleNewProducer;

  const cleanup = () => {
    socketRef.current?.emit('session:leave', { sessionId });
    stopAllMedia();
    webrtcService.closeAll();
    webrtcService.cleanup();
    webrtcService.consumers.forEach(c => { try { c.close(); } catch(_){} });
    webrtcService.consumers.clear();
    webrtcService.producerToConsumerMap.clear();
    webrtcService.consumePromises.clear();
    consumingRef.current.clear();
    webrtcService.recvTransport = null;
    webrtcService.sendTransport = null;
    // Do NOT disconnect the global socket, so we can still receive global notices in the dashboard.
    reset();
  };

  const startLocalStream = async () => {
    try {
      if (localStreamRef.current && localStreamRef.current.active) {
        console.log('[DEBUG] Local stream already active, publishing existing stream');
        const stream = localStreamRef.current;
        await webrtcService.produceStream(stream, {
          userId: user?._id,
          name: user?.name,
          role: user?.role,
          type: 'camera',
        });
        setRemoteStreams(prev => new Map(prev));
        return stream;
      }

      let stream;
      const constraints = await buildMediaConstraints(selectedVideoId, selectedAudioId);

      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        console.warn('Primary media access failed, trying fallbacks...', err.name);
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (f1Err) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            toast.success('Joined with audio only (No camera detected)');
          } catch (f2Err) {
            try {
              stream = await navigator.mediaDevices.getUserMedia({ video: true });
              toast.success('Joined with video only (No microphone detected)');
            } catch (f3Err) {
              throw new Error('No camera or microphone could be accessed. Please check your browser permissions.');
            }
          }
        }
      }

      // ── Common processing path for all success cases ──
      localStreamRef.current = stream;
      setLocalStream(stream);

      const hasVideo = stream.getVideoTracks().length > 0;
      const hasAudio = stream.getAudioTracks().length > 0;

      if (hasAudio) {
        // Create an un-mutated clone purely for local audio level analysis
        const rawAnalyzerStream = new MediaStream([stream.getAudioTracks()[0].clone()]);
        setLocalAnalyzerStream(rawAnalyzerStream);
      }

      // Apply the cam/mic preference chosen in the pre-join lobby
      // isMuted / isCamOff are already set from handleLobbyJoin
      if (hasVideo) {
        stream.getVideoTracks()[0].enabled = !isCamOff;
      } else {
        setIsCamOff(true);
      }
      if (hasAudio) {
        stream.getAudioTracks()[0].enabled = !isMuted;
      } else {
        setIsMuted(true);
      }

      // Publish to Mediasoup
      const tracksToPublish = new MediaStream();
      stream.getAudioTracks().forEach(t => tracksToPublish.addTrack(t));
      if (!isCamOff) stream.getVideoTracks().forEach(t => tracksToPublish.addTrack(t));
      await webrtcService.produceStream(tracksToPublish, {
        userId: user?._id,
        name: user?.name,
        role: user?.role,
        type: 'camera',
      });

      setRemoteStreams(prev => new Map(prev));
      return stream;
    } catch (err) {
      console.error('Media access error:', err);
      toast.error(err.message || 'Could not access camera or microphone.');
      setIsCamOff(true);
      setIsMuted(true);
    }
  };

  const handleDeviceChange = async (type, deviceId) => {
    if (type === 'video') {
      setSelectedVideoId(deviceId);
      localStorage.setItem('ichange_video_id', deviceId);
    } else if (type === 'audio') {
      setSelectedAudioId(deviceId);
      localStorage.setItem('ichange_audio_id', deviceId);
    } else if (type === 'speaker') {
      setSelectedSpeakerId(deviceId);
      localStorage.setItem('ichange_speaker_id', deviceId);
      return; // No need to restart streams if just changing speaker output
    }
    
    // Clear old stream if changing hardware
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    await startLocalStream(); // Restart stream with new device
  };

  const toggleScreenShare = async () => {
    try {
      const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone/i.test(navigator.userAgent);
      if (isMobile && (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia)) {
        toast.error('Screen sharing is not supported on your browser. Please use desktop Chrome.');
        return;
      }
      if (isScreenSharing) {
        setIsScreenSharing(false);
        setLocalScreenStream(null);
        // Close specific screen producers
        for (const [id, producer] of webrtcService.producers.entries()) {
          if (producer.appData?.screen) {
            webrtcService.closeProducer(id);
          }
        }
        toast('Screen sharing stopped');
      } else {

        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const producers = await webrtcService.produceStream(screenStream, { screen: true });
        
        setIsScreenSharing(true);
        setLocalScreenStream(screenStream);
        setPinnedId('local-screen'); // Auto-pin own screen share
        toast.success('You are presenting');
        
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          setLocalScreenStream(null);
          setPinnedId(prev => prev === 'local-screen' ? null : prev);
          producers.forEach(p => {
             webrtcService.closeProducer(p.id);
          });
          toast('Screen sharing ended');
        };
      }
    } catch (err) {
      console.error('Screen share error:', err);
      toast.error('Failed to share screen');
    }
  };

  const stopAllMedia = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
  };

  const stopMic = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = false; });
  };

  const toggleMic = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsMuted(!track.enabled);
    }
  }, []);

  const toggleCam = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsCamOff(!track.enabled);
    }
  }, []);

  const handleToggleRecording = async () => {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isIOS) {
      toast.error('Recording is not supported on this device');
      return;
    }

    let mimeType = 'video/webm;codecs=vp9';
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
      if (!window.MediaRecorder || !MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/mp4';
        if (!window.MediaRecorder || !MediaRecorder.isTypeSupported(mimeType)) {
          toast.error('Recording is not supported on this device');
          return;
        }
      }
    }

    if (isRecording) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
      return;
    }

    try {
      // Prompt for tab capture — allows recording the meeting interface itself
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true // Capture tab audio too
      });

      recordingChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(displayStream, {
        mimeType: mimeType
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `IChange-Session-${sessionId}-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        
        // Stop all tracks in the display stream
        displayStream.getTracks().forEach(track => track.stop());
        toast.success('Recording saved to your downloads!');
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      toast.success('Recording started');

      // Stop recording if the user manually stops sharing via the browser bar
      displayStream.getVideoTracks()[0].onended = () => {
        if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
        setIsRecording(false);
      };

    } catch (err) {
      console.error('Recording error:', err);
      toast.error('Failed to start recording');
    }
  };

  const handleStartPoll = ({ question, options }) => {
    socketRef.current?.emit('session:poll_start', { sessionId, question, options });
  };

  const handleVote = (optionIndex) => {
    setUserVote(optionIndex);
    socketRef.current?.emit('session:poll_vote', { sessionId, pollId: activePoll.id, optionIndex });
  };

  const handleEndPoll = (pollId) => {
    socketRef.current?.emit('session:poll_end', { sessionId, pollId });
  };

  const handleLeave = () => {
    cleanup();
    navigate('/dashboard');
  };

  const handleRaiseHand = (raised) => {
    socketRef.current?.emit('hand:raise', { sessionId, raised });
  };

  const handleMuteAll = () => {
    socketRef.current?.emit('admin:muteAll', { sessionId });
    // Don't set a local toast — the socket event will come back from the server
    // to all non-host participants. Host is excluded on the frontend.
  };

  const handleMuteUser = (targetUserId) => {
    socketRef.current?.emit('admin:muteUser', { sessionId, targetUserId });
  };

  const handleKickUser = (targetUserId) => {
    socketRef.current?.emit('admin:kickUser', { sessionId, targetUserId });
  };

  const handleLowerHand = (targetUserId) => {
    socketRef.current?.emit('hand:lower', { sessionId, targetUserId });
    lowerHand(targetUserId);
  };

  const handleSendReaction = (emoji) => {
    socketRef.current?.emit('session:reaction', { sessionId, emoji });
  };

  const handleVisibilityChange = useCallback((visibleIds) => {
    // We only pause/resume VIDEO consumers.
    // Audio is always kept active for low-latency background interaction.
    webrtcService.consumers.forEach(async (consumer, consumerId) => {
      if (consumer.kind !== 'video') return;
      
      const isVisible = visibleIds.has(consumer.producerId);
      
      if (isVisible && consumer.paused) {
        await webrtcService.resumeConsumer(consumerId);
      } else if (!isVisible && !consumer.paused) {
        // Only pause if it's not a screen share (keep screen shares always resumed if consumed)
        if (!consumer.appData?.screen) {
          await webrtcService.pauseConsumer(consumerId);
        }
      }
    });
  }, []);

  const handleCopyLink = useCallback(() => {
    if (!session?.linkCode) return;
    const link = `${window.location.origin}/join/${session.linkCode}`;
    navigator.clipboard.writeText(link)
      .then(() => toast.success('Link copied to clipboard!'))
      .catch(() => toast.error('Failed to copy link. Please manually copy the code.'));
  }, [session?.linkCode]);

  const toggleFullScreen = () => {
    const doc = window.document;
    const docEl = doc.documentElement;

    const requestFullScreen = 
      docEl.requestFullscreen || 
      docEl.mozRequestFullScreen || 
      docEl.webkitRequestFullScreen || 
      docEl.msRequestFullscreen;
      
    const cancelFullScreen = 
      doc.exitFullscreen || 
      doc.mozCancelFullScreen || 
      doc.webkitExitFullscreen || 
      doc.msExitFullscreen;

    if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
      if (requestFullScreen) {
        requestFullScreen.call(docEl).catch(err => {
          toast.error(`Fullscreen failed: ${err.message}`);
        });
      } else {
        toast.error('Fullscreen not supported on this device');
      }
    } else {
      if (cancelFullScreen) {
        cancelFullScreen.call(doc);
      }
    }
  };

  // Sync isFullScreen state on ESC key or browser manual toggle
  useEffect(() => {
    const handler = () => {
      setIsFullScreen(!!(
        document.fullscreenElement || 
        document.webkitFullscreenElement || 
        document.mozFullscreenElement || 
        document.msFullscreenElement
      ));
    };
    
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    document.addEventListener('mozfullscreenchange', handler);
    document.addEventListener('MSFullscreenChange', handler);
    
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler);
      document.removeEventListener('mozfullscreenchange', handler);
      document.removeEventListener('MSFullscreenChange', handler);
    };
  }, []);

  // ── Render Logic ──
  if (showLobby) {
    if (!lobbySessionData) {
      // Still loading session data for the lobby
      return (
        <div className="h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-primary-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-foreground/40">Loading session...</p>
          </div>
        </div>
      );
    }
    return (
      <PreJoinLobby
        session={lobbySessionData}
        user={user}
        onJoin={handleLobbyJoin}
      />
    );
  }

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center transition-colors duration-300">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-foreground/40">Connecting to session...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="h-[100dvh] bg-background flex flex-col transition-colors duration-300 overflow-hidden">
        {/* Top bar - Hidden when in fullscreen for immersive experience */}
        {!isFullScreen && (
          <div className="h-20 sm:h-24 flex items-center justify-between px-6 sm:px-12 border-b border-white/5 bg-surface-900/60 backdrop-blur-3xl saturate-150 shrink-0 z-50 shadow-2xl transition-all duration-500">
            <div className="flex items-center gap-8">
              <button
                id="back-to-dashboard"
                onClick={() => navigate('/dashboard')}
                aria-label="Back to Dashboard"
                className="flex items-center gap-3 px-5 py-3 rounded-2xl text-white/50 hover:text-white hover:bg-white/10 transition-all border border-white/10 hover:border-white/20 active:scale-95 shadow-2xl bg-black/5"
              >
                <ArrowLeft size={22} className="stroke-[2.5px]" />
                <span className="hidden sm:inline text-sm font-black uppercase tracking-widest">Dashboard</span>
              </button>
              
              <div className="w-px h-10 bg-white/10 hidden sm:block" />
              
              <div className="flex flex-col">
                <h1 className="font-black text-xl sm:text-2xl tracking-tighter text-white/95 truncate max-w-[250px] sm:max-w-md">
                  {session?.title || 'Session'}
                </h1>
                <p className="text-xs text-white/60 truncate mt-0.5 max-w-[200px] sm:max-w-[300px]">
                   Hosted by: {session?.host?.name || 'Authorized'}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-glow shadow-emerald-500/50" />
                  <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.2em]">
                    Live / {session?.host?.name || 'Authorized'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-6 sm:gap-10">
              <div className="hidden lg:flex flex-col items-end gap-0.5 transition-all duration-300">
                <span className="text-[10px] font-black text-primary-400 uppercase tracking-[0.3em] mb-0.5 opacity-80">Connected Admin</span>
                <p className="text-base font-black text-white/95 leading-tight tracking-tight">{user?.name || 'sudharsan'}</p>
                <p className="text-[9px] font-bold text-white/20 tracking-[0.3em] uppercase">{user?.email}</p>
              </div>

              {user?.role === 'admin' && (
                <motion.button
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/admin')}
                  className="hidden md:flex px-6 py-3 rounded-2xl bg-primary-500/10 text-primary-400 border border-primary-500/20 hover:bg-primary-500/20 transition-all items-center gap-3 font-black shadow-2xl shadow-primary-500/10 ring-1 ring-primary-500/10"
                  title="Admin Hub"
                >
                  <Shield size={18} className="stroke-[2.5px]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Vault</span>
                </motion.button>
              )}

              {isRecording && (
                <div className="flex items-center gap-2.5 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-2xl text-[10px] font-black text-red-500 uppercase tracking-[0.25em] animate-pulse shadow-glow shadow-red-500/10">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.7)]" />
                  Live
                </div>
              )}
              
              <div className="flex items-center gap-4">
                {sessionStartTime && (
                  <div className="font-mono text-sm font-bold text-white/50 bg-black/20 px-4 py-2 rounded-xl border border-white/5 hidden lg:block tracking-widest shadow-inner">
                    {sessionDuration}
                  </div>
                )}
                <ConnectionStatus state={connectionState} />
              </div>
            </div>
          </div>
        )}

      {isReconnecting && <ReconnectBanner />}

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Video area */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            <VideoGrid
              streams={remoteStreams}
              localStream={localStream}
              localUser={user}
              isMuted={isMuted}
              isCamOff={isCamOff}
              localScreenStream={localScreenStream}
              pinnedId={pinnedId}
              onTogglePin={onTogglePin}
              selectedSpeakerId={selectedSpeakerId}
              liveCaption={liveCaption}
              dataSaver={dataSaver}
              hideNonVideo={hideNonVideo}
              onVisibilityChange={handleVisibilityChange}
              consumerStats={consumerStats}
              layoutMode={layoutMode}
            />
          <ControlBar
            isMuted={isMuted}
            isCamOff={isCamOff}
            isFullScreen={isFullScreen}
            isScreenSharing={isScreenSharing}
            chatOpen={chatOpen}
            unreadCount={unreadCount}
            onToggleMic={toggleMic}
            onToggleCam={toggleCam}
            onToggleChat={() => {
              setChatOpen(!chatOpen);
              setParticipantsOpen(false);
            }}
            onToggleParticipants={() => {
              setParticipantsOpen(!participantsOpen);
              setChatOpen(false);
            }}
            participantsOpen={participantsOpen}
            onToggleFullScreen={toggleFullScreen}
            onToggleScreenShare={toggleScreenShare}
            onToggleSettings={() => setIsSettingsOpen(true)}
            onSendReaction={handleSendReaction}
            onRaiseHand={handleRaiseHand}
            onLeave={handleLeave}
            onCopyLink={handleCopyLink}
            onDownloadAttendance={() => setIsAttendanceOpen(true)}
            captionsEnabled={captionsEnabled}
            onToggleCaptions={() => setCaptionsEnabled(!captionsEnabled)}
            hideNonVideo={hideNonVideo}
            onToggleHideNonVideo={() => setHideNonVideo(!hideNonVideo)}
            isRecording={isRecording}
            onToggleRecording={handleToggleRecording}
            onOpenPoll={() => setIsPollOpen(true)}
            layoutMode={layoutMode}
            onLayoutChange={setLayoutMode}
          />
        </div>

        {/* Side Panels */}
        {(chatOpen || participantsOpen) && (
          <div className="fixed inset-0 z-50 md:relative md:inset-auto md:w-[350px] md:border-l border-border flex flex-col bg-surface-800 animate-in slide-in-from-right duration-300 shadow-2xl">
            <div className="md:hidden absolute top-3 right-3 z-10">
              <button 
                onClick={() => {
                  setChatOpen(false);
                  setParticipantsOpen(false);
                }}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 shadow-md backdrop-blur-md"
              >
                <X size={20} />
              </button>
            </div>
            
            {chatOpen && (
              <ChatPanel
                sessionId={sessionId}
                socket={socketRef.current}
                user={user}
                sessionHostId={session?.host?._id?.toString() || session?.host?.toString()}
              />
            )}
            
            {participantsOpen && (
              <ParticipantsPanel
                onClose={() => setParticipantsOpen(false)}
                sessionId={sessionId}
                sessionTitle={session?.title}
                isHost={user?._id?.toString() === (session?.host?._id || session?.host)?.toString()}
                currentUserId={user?._id?.toString()}
                onMuteAll={handleMuteAll}
                onMuteUser={handleMuteUser}
                onKickUser={handleKickUser}
                onLowerHand={handleLowerHand}
              />
            )}
          </div>
        )}
      </div>

      <MediaSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        selectedVideoId={selectedVideoId}
        selectedAudioId={selectedAudioId}
        selectedSpeakerId={selectedSpeakerId}
        dataSaver={dataSaver}
        onDeviceChange={handleDeviceChange}
        onToggleDataSaver={() => setDataSaver(!dataSaver)}
      />

      <AttendanceModal
        isOpen={isAttendanceOpen}
        onClose={() => setIsAttendanceOpen(false)}
        sessionId={sessionId}
        sessionTitle={session?.title || 'Session'}
        hostName={session?.host?.name || 'Host'}
        sessionDate={session?.createdAt || new Date()}
      />

      <PollModal
        isOpen={isPollOpen}
        onClose={() => setIsPollOpen(false)}
        isHost={user?._id?.toString() === (session?.host?._id || session?.host)?.toString()}
        activePoll={activePoll}
        pollVotes={pollVotes}
        userVote={userVote}
        onStartPoll={handleStartPoll}
        onVote={handleVote}
        onEndPoll={handleEndPoll}
      />

      <EmojiRain reactions={reactions} />
    </div>
    </ErrorBoundary>
  );
}
