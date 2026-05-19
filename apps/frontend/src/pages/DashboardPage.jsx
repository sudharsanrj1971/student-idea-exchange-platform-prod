import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Zap, Video, Users, Calendar,
  Copy, Trash2, Play, ExternalLink, Clock, Hash,
  ClipboardList, ArrowRight, Sparkles
} from 'lucide-react';
import api from '../services/api.js';
import { useAuthStore } from '../store/authStore.js';
import { SkeletonCard } from '../components/ui/Skeleton.jsx';
import CreateSessionModal from '../components/dashboard/CreateSessionModal.jsx';
import AttendanceModal from '../components/dashboard/AttendanceModal.jsx';
import Avatar from '../components/ui/Avatar.jsx';
import Navbar from '../components/ui/Navbar.jsx';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout, uploadAvatar, refreshProfile } = useAuthStore();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [attendanceSession, setAttendanceSession] = useState(null);
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    fetchSessions();
    // Sync profile from backend on mount (covers persisted stale state)
    refreshProfile();
  }, []);

  const fetchSessions = async () => {
    try {
      const { data } = await api.get('/api/sessions');
      setSessions(data.sessions || []);
    } catch (err) {
      console.warn('[Dashboard] Failed to load sessions, defaulting to empty list:', err.message || err);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };



  const handleDeleteSession = async (sessionId) => {
    if (!confirm('Delete this session?')) return;
    try {
      await api.delete(`/api/sessions/${sessionId}`);
      setSessions((s) => s.filter((sess) => sess._id !== sessionId));
      toast.success('Session deleted');
    } catch {
      toast.error('Failed to delete session');
    }
  };

  const handleCopyLink = (linkCode) => {
    if (!linkCode) return;
    const url = `${window.location.origin}/join/${linkCode}`;
    navigator.clipboard.writeText(url)
      .then(() => toast.success('Link copied!'))
      .catch(() => toast.error('Failed to copy link'));
  };

  const handleJoinByCode = (e) => {
    e.preventDefault();
    let code = joinCode.trim();
    if (!code) return;

    if (code.includes('/join/')) {
      const parts = code.split('/join/');
      code = parts[parts.length - 1];
    }
    
    navigate(`/join/${code}`);
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 }
  };

  return (
    <div className="min-h-screen bg-[#060811] text-white selection:bg-primary-500/30">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-600/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-indigo-600/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Navbar */}
      <Navbar />

      <motion.main 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative z-10"
      >
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12">
          <motion.div variants={itemVariants}>
            <div className="flex items-center gap-2 mb-2">
              <span className="h-px w-8 bg-primary-500/50" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary-500/80">Student Idea Exchange</span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tighter mb-4 leading-tight">
              Good {getTimeOfDay().text},{' '}
              <span className="text-gradient drop-shadow-2xl opacity-90">{user?.name?.split(' ')[0]}</span> {getTimeOfDay().icon}
            </h1>
            <p className="text-white/40 text-lg sm:text-xl max-w-xl font-medium leading-relaxed">
              Transforming education through shared insights and real-time collaboration. Start an exchange or join a hub.
            </p>
          </motion.div>

          <motion.button
            variants={itemVariants}
            whileHover={{ scale: 1.02, translateY: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center justify-center gap-3 h-14 px-8 shadow-glow-primary group"
          >
            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            <span className="font-bold text-lg uppercase tracking-wider">New Session</span>
          </motion.button>
        </div>

        {/* Bento Stats Grid */}
        <AnimatePresence>
          {sessions.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-5 mb-12"
            >
              {/* Main Stat - Large Box */}
              <div className="md:col-span-2 lg:col-span-3 bento-card bg-gradient-to-br from-primary-600/20 to-indigo-600/5 group overflow-hidden">
                <div className="absolute top-0 right-0 p-8 text-primary-500/10 group-hover:text-primary-500/20 transition-colors">
                  <Video size={120} strokeWidth={1} />
                </div>
                <div className="relative z-10">
                  <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-primary-400 mb-2 flex items-center gap-2">
                    <Sparkles size={10} /> Overview
                  </p>
                  <h3 className="text-5xl font-black mb-2">{sessions.length}</h3>
                  <p className="text-white/50 font-medium">Total Learning Sessions</p>
                  <div className="mt-8 flex gap-3">
                    <div className="h-1 w-12 bg-primary-500 rounded-full" />
                    <div className="h-1 w-4 bg-white/10 rounded-full" />
                    <div className="h-1 w-4 bg-white/10 rounded-full" />
                  </div>
                </div>
              </div>

              {/* Live Stat - Glow Box */}
              <div className="md:col-span-2 lg:col-span-3 bento-card border-emerald-500/20 bg-emerald-500/5">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-emerald-400 mb-1">Live Action</p>
                    <h3 className="text-4xl font-black">{sessions.filter((s) => s.isActive).length}</h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Play size={18} className="text-emerald-400 fill-emerald-400/20" />
                  </div>
                </div>
                <p className="text-white/40 text-sm font-medium leading-relaxed">
                  Active sessions currently streaming with real-time participation.
                </p>
                <div className="mt-6 flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-400 tracking-wider">REALTIME TRACKING ENABLED</span>
                </div>
              </div>

              {/* Smaller Stats */}
              <div className="bento-card lg:col-span-2">
                <Users className="w-6 h-6 text-amber-400 mb-4" />
                <p className="text-2xl font-black">{sessions.reduce((sum, s) => sum + (s.participants?.length || 0), 0)}</p>
                <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">Total Users</p>
              </div>

              <div className="bento-card lg:col-span-2">
                <Calendar className="w-6 h-6 text-purple-400 mb-4" />
                <p className="text-2xl font-black">{sessions.filter((s) => s.scheduledAt && new Date(s.scheduledAt) > new Date()).length}</p>
                <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">Scheduled</p>
              </div>

                <div className="bento-card lg:col-span-2 flex flex-col items-center justify-center text-center cursor-pointer border-dashed border-white/10 hover:border-primary-500/30 hover:bg-primary-500/5 transition-all group">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-primary-500 group-hover:text-white group-hover:rotate-12 transition-all duration-300">
                    <Plus size={24} />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/30 group-hover:text-primary-400">Launch Module</p>
                </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Panel: Join by Code */}
        <motion.div 
          variants={itemVariants}
          className="glass-dark border-white/5 rounded-[2rem] p-6 sm:p-8 mb-16 flex flex-col md:flex-row items-center gap-6 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary-500/50 to-transparent" />
          <div className="flex items-center gap-4 flex-1">
            <div className="w-12 h-12 bg-primary-500/10 rounded-2xl flex items-center justify-center border border-primary-500/20">
              <Hash className="text-primary-400" size={24} />
            </div>
            <div>
              <h4 className="font-bold text-lg">Quick Access</h4>
              <p className="text-white/30 text-sm">Enter a session code to instantly jump into the stream.</p>
            </div>
          </div>
          <form onSubmit={handleJoinByCode} className="flex gap-3 w-full md:w-auto md:min-w-[400px]">
            <input
              id="join-code-input"
              type="text"
              className="input-field !py-3.5 !px-6 text-base font-medium tracking-wide flex-1 shadow-inner focus:shadow-primary-500/5"
              placeholder="Ex: NEX-782-K9"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              maxLength={20}
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              id="join-btn"
              type="submit"
              className="btn-primary !py-3.5 !px-8 flex items-center gap-2 group shadow-glow-primary"
            >
              <span className="font-bold">JOIN</span>
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </motion.button>
          </form>
        </motion.div>

        {/* Sessions Section */}
        <div className="mb-20">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <Video className="text-primary-400" size={24} />
              Your Sessions
            </h2>
            <div className="h-px bg-white/5 flex-1 mx-6 hidden sm:block" />
            <div className="flex gap-2">
              <button className="h-11 w-11 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 text-white/40 hover:text-white transition-all">
                <Sparkles size={18} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : sessions.length > 0 ? (
            <motion.div 
              layout
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              <AnimatePresence mode="popLayout">
                {sessions.map((session) => (
                  <SessionCard
                    key={session._id}
                    session={session}
                    userId={user?._id}
                    isAdmin={user?.role === 'admin'}
                    onDelete={handleDeleteSession}
                    onCopyLink={handleCopyLink}
                    onJoin={() => navigate(`/session/${session._id}`)}
                    onViewAttendance={() => setAttendanceSession(session)}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="card border-dashed border-2 border-white/5 bg-transparent flex flex-col items-center justify-center py-24 text-center rounded-[3rem]"
            >
              <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center mb-8 border border-white/5">
                <Video className="w-10 h-10 text-white/10" />
              </div>
              <h2 className="text-2xl font-bold mb-3 tracking-tight">Expand the Network</h2>
              <p className="text-white/30 mb-10 max-w-sm font-medium">
                You haven't hosted any sessions yet. Begin your journey by creating a new exchange hub.
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowCreate(true)}
                className="btn-primary flex items-center gap-3 h-14 px-10 shadow-glow-primary"
              >
                <Plus size={20} />
                <span className="font-bold">Start First Session</span>
              </motion.button>
            </motion.div>
          )}
        </div>
      </motion.main>

      {/* Modals */}
      <AnimatePresence>
        {showCreate && (
          <CreateSessionModal
            onClose={() => setShowCreate(false)}
            onCreated={(s) => {
              setSessions((prev) => [s, ...prev]);
              setShowCreate(false);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {attendanceSession && (
          <AttendanceModal
            session={attendanceSession}
            onClose={() => setAttendanceSession(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SessionCard({ session, userId, isAdmin, onDelete, onCopyLink, onJoin, onViewAttendance }) {
  const isHost = session.host?._id === userId || session.host === userId || isAdmin;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ translateY: -4 }}
      className={`bento-card flex flex-col h-full border-white/[0.03] ${session.isActive ? 'border-emerald-500/30' : ''}`}
    >
      {session.isActive && (
        <div className="absolute top-4 right-4 z-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest bg-emerald-500 text-white uppercase shadow-lg shadow-emerald-500/40 glow-emerald">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            LIVE
          </span>
        </div>
      )}

      <div className="mb-4">
        <h3 className="font-bold text-xl leading-tight mb-2 line-clamp-1 pr-12 group-hover:text-primary-400 transition-colors">
          {session.title}
        </h3>
        <p className="text-white/40 text-sm line-clamp-2 min-h-[2.5rem] font-medium leading-relaxed">
          {session.description || "No description provided for this session."}
        </p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        {session.scheduledAt && (
          <div className="flex items-center gap-1.5 text-white/40 text-[10px] font-bold uppercase whitespace-nowrap bg-white/5 px-2 py-1 rounded-md border border-white/5">
            <Clock size={11} className="text-primary-500" />
            {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(session.scheduledAt))}
          </div>
        )}
        <div className="flex items-center gap-1.5 text-white/30 text-[10px] font-bold uppercase tracking-wider">
          <Users size={12} className="text-indigo-500" />
          {session.participants?.length || 0}
        </div>
      </div>

      <div className="mt-auto space-y-3">
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onJoin}
            className={`flex-1 h-11 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all duration-300 ${
              session.isActive 
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-glow-emerald border border-white/20' 
                : 'bg-primary-500 hover:bg-primary-600 text-white shadow-glow-primary border border-white/20'
            }`}
          >
            <Play size={16} className={session.isActive ? 'fill-white' : ''} />
            {session.isActive ? 'Join Stream' : 'Enter'}
          </motion.button>
          
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => onCopyLink(session.linkCode)}
            className="w-11 h-11 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl flex items-center justify-center text-white/40 hover:text-white transition-colors"
            title="Copy link"
          >
            <Copy size={16} />
          </motion.button>

          {isHost && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => onDelete(session._id)}
              className="w-11 h-11 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-xl flex items-center justify-center transition-all"
              title="Delete session"
            >
              <Trash2 size={16} />
            </motion.button>
          )}
        </div>
        
        {isHost && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onViewAttendance}
            className="w-full h-10 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black tracking-widest uppercase text-white/40 hover:text-primary-400 transition-all"
          >
            <ClipboardList size={14} />
            Attendance Metrics
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return { text: 'morning', icon: '🌅' };
  if (h < 17) return { text: 'afternoon', icon: '☀️' };
  return { text: 'evening', icon: '🌙' };
}
