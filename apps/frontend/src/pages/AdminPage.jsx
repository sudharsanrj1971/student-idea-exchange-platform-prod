import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Shield, Activity, Search, Filter, 
  MoreVertical, UserCheck, UserX, Trash2, 
  RefreshCcw, ArrowLeft, LayoutDashboard,
  TrendingUp, Calendar, Zap, Key, Check,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Settings
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../components/ui/Avatar.jsx';
import api from '../services/api.js';
import { toast } from 'react-hot-toast';
import Logo from '../components/ui/Logo.jsx';

export default function AdminPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ users: 0, sessions: 0, active: 0, growth: '0%' });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [passwords, setPasswords] = useState({});
  
  // Tabs: users, sessions, health
  const [activeTab, setActiveTab] = useState('users');
  const [activeSessions, setActiveSessions] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  const [selectedSessionSnapshot, setSelectedSessionSnapshot] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [configs, setConfigs] = useState([]);
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 20 });

  // New Features State
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [viewingUserActivity, setViewingUserActivity] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [noticeHistory, setNoticeHistory] = useState([]);

  // Fetch Stats (Only on mount)
  useEffect(() => {
    fetchStats();
    fetchHealth();
  }, []);

  useEffect(() => {
    if (activeTab === 'sessions') {
      fetchActiveSessions();
    }
  }, [activeTab]);

  // Fetch data based on active tab
  useEffect(() => {
    if (activeTab === 'users') {
        fetchData();
    } else if (activeTab === 'sessions') {
        fetchActiveSessions();
    } else if (activeTab === 'health') {
        fetchHealth();
    } else if (activeTab === 'audit') {
        fetchAuditLogs();
    } else if (activeTab === 'settings') {
        fetchConfigs();
    }
  }, [activeTab, page]);

  // Fetch Users with debounced search and role changes
  useEffect(() => {
    const timer = setTimeout(() => {
        setPage(1); 
        if (activeTab === 'users') fetchData();
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm, filterRole]);

  const fetchStats = async () => {
    try {
      const sRes = await api.get('/api/admin/stats');
      setStats(sRes.data);
    } catch (err) {
      console.error('Failed to fetch stats');
    }
  };

  const fetchHealth = async () => {
    try {
      const { data } = await api.get('/api/admin/system-health');
      setSystemHealth(data);
    } catch (err) {
      console.error('Failed to fetch health');
    }
  };

  const fetchActiveSessions = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/api/admin/active-sessions');
      setActiveSessions(data);
    } catch (err) {
      toast.error('Failed to load active sessions');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/api/admin/audit-logs?page=${page}`);
      setAuditLogs(data.logs);
      setPagination(data.pagination);
    } catch (err) {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/api/admin/config');
      setConfigs(data);
    } catch (err) {
      toast.error('Failed to load platform settings');
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (key, value) => {
    try {
       await api.patch(`/api/admin/config/${key}`, { value });
       setConfigs(prev => prev.map(c => c.key === key ? { ...c, value } : c));
       toast.success(`${key.replace(/_/g, ' ')} updated`);
    } catch (err) {
       toast.error('Failed to update setting');
    }
  };

  const fetchNoticeHistory = async () => {
    try {
      const { data } = await api.get('/api/admin/broadcasts');
      setNoticeHistory(data);
    } catch (err) {
      console.error('Failed to fetch notice history');
    }
  };

  const deleteNotice = async (noticeId) => {
    try {
      await api.delete(`/api/admin/broadcasts/${noticeId}`);
      setNoticeHistory(prev => prev.filter(n => n._id !== noticeId));
      toast.success('Announcement removed from history');
    } catch (err) {
      toast.error('Failed to delete announcement');
    }
  };

  const fetchData = async () => {
    if (activeTab !== 'users') return;
    try {
      setLoading(true);
      const { data } = await api.get('/api/admin/users', {
        params: {
          page,
          limit: 20,
          search: searchTerm,
          role: filterRole
        }
      });
      setUsers(data.users);
      setPagination(data.pagination);
      setSelectedUsers([]); // Clear selection on page/filter change
    } catch (err) {
      toast.error('Failed to load user data');
      if (err.response?.status === 403) navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserActivity = async (userId) => {
    try {
      setActivityLoading(true);
      const { data } = await api.get(`/api/admin/users/${userId}/activity`);
      setViewingUserActivity(data);
    } catch (err) {
      toast.error('Failed to load user activity');
    } finally {
      setActivityLoading(false);
    }
  };

  const handleBulkAction = async (action, value) => {
    if (selectedUsers.length === 0) return;
    try {
      setLoading(true);
      await api.post('/api/admin/users/bulk', {
        userIds: selectedUsers,
        action,
        value
      });
      toast.success(`Bulk ${action} updated for ${selectedUsers.length} users`);
      fetchData();
      setSelectedUsers([]);
    } catch (err) {
      toast.error('Bulk action failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (userId, updates) => {
    try {
      const { data } = await api.patch(`/api/admin/users/${userId}`, updates);
      setUsers(users.map(u => u._id === userId ? { ...u, ...data.user } : u));
      setEditingUser(null);
      toast.success('User updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await api.patch(`/api/admin/users/${userId}`, { role: newRole });
      setUsers(users.map(u => u._id === userId ? { ...u, role: newRole } : u));
      toast.success(`Role updated to ${newRole}`);
    } catch (err) {
      toast.error('Failed to update role');
    }
  };

  const handleUpdatePassword = async (userId) => {
    const password = passwords[userId];
    if (!password || password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      await api.patch(`/api/admin/users/${userId}`, { password });
      setPasswords({ ...passwords, [userId]: '' });
      toast.success('Password reset successfully');
    } catch (err) {
      toast.error('Failed to update password');
    }
  };

  const toggleUserStatus = async (user) => {
    try {
      const newStatus = !user.isActive;
      await api.patch(`/api/admin/users/${user._id}`, { isActive: newStatus });
      setUsers(users.map(u => u._id === user._id ? { ...u, isActive: newStatus } : u));
      toast.success(newStatus ? 'User activated' : 'User deactivated');
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleBroadcast = async () => {
    if (!announcement.trim()) return;
    try {
      setIsBroadcasting(true);
      await api.post('/api/admin/broadcast', { content: announcement });
      setAnnouncement('');
      toast.success('Global notice sent!');
    } catch (err) {
      toast.error('Failed to send announcement');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const fetchSessionSnapshot = async (sessionId) => {
    try {
      const { data } = await api.get(`/api/admin/sessions/${sessionId}/snapshot`);
      setSelectedSessionSnapshot(data);
    } catch (err) {
      toast.error('Failed to load session snapshot');
    }
  };

  const terminateSession = async (sessionId) => {
    if (!confirm('Are you SURE you want to terminate this session? This will kick ALL participants immediately.')) return;
    try {
      await api.delete(`/api/admin/sessions/${sessionId}`);
      toast.success('Session terminated');
      fetchActiveSessions();
      setSelectedSessionSnapshot(null);
    } catch (err) {
      toast.error('Failed to terminate session');
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-[#060811] text-white selection:bg-primary-500/30">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-primary-600/10 rounded-full blur-[100px]" />
      </div>

      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#060811]/70 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 h-24 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => navigate('/dashboard')}
              className="p-3 hover:bg-white/5 rounded-2xl transition-all text-white/40 hover:text-white border border-transparent hover:border-white/10 active:scale-95"
            >
              <ArrowLeft size={24} />
            </button>
            <Logo size="md" />
          </div>

          <button 
            onClick={() => {
              fetchStats();
              if (activeTab === 'users') fetchData();
              if (activeTab === 'sessions') fetchActiveSessions();
              fetchHealth();
            }}
            disabled={loading}
            className="p-3 hover:bg-white/5 rounded-2xl transition-all text-white/40 hover:text-white disabled:opacity-50"
          >
            <RefreshCcw size={24} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 sm:px-10 mt-6 flex items-center gap-2">
        {[
          { id: 'dashboard', label: 'Hub', icon: LayoutDashboard },
          { id: 'users', label: 'Users', icon: Users },
          { id: 'sessions', label: 'Live Sessions', icon: Activity },
          { id: 'audit', label: 'Audit', icon: Shield },
          { id: 'settings', label: 'Settings', icon: Settings },
          { id: 'health', label: 'System Health', icon: Zap }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all border ${
              activeTab === tab.id 
                ? 'bg-primary-500 text-white border-primary-400 shadow-lg shadow-primary-500/20' 
                : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10 hover:text-white'
            }`}
          >
            <tab.icon size={18} />
            <span className="text-sm">{tab.label}</span>
          </button>
        ))}
      </div>

      <motion.main 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Users} label="Total Users" value={stats.users} subValue={stats.growth} color="text-blue-400" />
          <StatCard icon={Activity} label="Active Sessions" value={stats.active} subValue="Live Now" color="text-emerald-400" />
          <StatCard icon={Users} label="New Users (24h)" value={stats.newUsers24h || 0} subValue="Onboarding" color="text-amber-400" />
          <StatCard icon={Zap} label="System Status" value="Online" subValue="99.9% Uptime" color="text-emerald-400" />
        </div>

        {/* Global Tools Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
           <div className="lg:col-span-2 bento-card bg-primary-500/5 border-primary-500/10 flex flex-col justify-between">
              <div>
                 <h3 className="text-sm font-black uppercase tracking-widest text-primary-400 mb-2 flex items-center gap-2">
                    <Zap size={16} /> Global Announcement
                 </h3>
                 <p className="text-xs text-white/40 mb-6">Send a real-time notice to ALL active users across the platform.</p>
                 <textarea 
                    className="w-full bg-[#0d101d] border border-white/5 rounded-2xl p-4 text-sm outline-none focus:border-primary-500/50 transition-all min-h-[100px] resize-none"
                    placeholder="Type your announcement here..."
                    value={announcement}
                    onChange={(e) => setAnnouncement(e.target.value)}
                 />
              </div>
              <div className="flex justify-end mt-4">
                 <button 
                    onClick={handleBroadcast}
                    disabled={isBroadcasting || !announcement.trim()}
                    className="px-8 py-3 bg-primary-500 hover:bg-primary-600 rounded-xl font-bold text-sm shadow-lg shadow-primary-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
                 >
                    {isBroadcasting ? <RefreshCcw className="animate-spin" size={16} /> : <Zap size={16} />}
                    Broadcast Now
                 </button>
              </div>
           </div>
           <div className="bento-card bg-white/[0.01] border-white/5 flex flex-col">
              <h3 className="text-sm font-black uppercase tracking-widest text-white/40 mb-4 flex items-center gap-2">
                 <Shield size={16} /> Broadcast History
              </h3>
              <div className="flex-1 overflow-y-auto max-h-[180px] space-y-3 pr-2 custom-scrollbar">
                 {noticeHistory.length === 0 ? (
                    <p className="text-[10px] text-white/10 font-medium italic">No recent announcements.</p>
                 ) : (
                    noticeHistory.map(notice => (
                       <div key={notice._id} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 group relative">
                          <p className="text-[11px] text-white/60 line-clamp-2 pr-6">{notice.content}</p>
                          <div className="flex items-center justify-between mt-2">
                             <span className="text-[9px] text-white/20 font-bold uppercase">{new Date(notice.createdAt).toLocaleDateString()}</span>
                             <button 
                               onClick={() => deleteNotice(notice._id)}
                               className="text-red-400/0 group-hover:text-red-400/60 hover:text-red-400 transition-all"
                             >
                                <Trash2 size={12} />
                             </button>
                          </div>
                       </div>
                    ))
                 )}
              </div>
              <button 
                onClick={fetchNoticeHistory}
                className="mt-4 text-[10px] font-black uppercase tracking-widest text-primary-400 hover:text-primary-300 transition-colors flex items-center gap-1"
              >
                 <RefreshCcw size={10} /> Refresh History
              </button>
           </div>
        </div>

        <motion.div variants={itemVariants} className="bento-card !p-0 overflow-hidden border-white/5">
          {activeTab === 'users' ? (
            <>
              <div className="p-6 border-b border-white/5 bg-white/[0.02] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                    <input 
                      type="text" 
                      placeholder="Live search by name or email..."
                      className="w-full bg-[#0d101d] border border-white/5 rounded-2xl py-3 pl-12 pr-4 focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 outline-none transition-all placeholder:text-white/10 text-sm"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {loading && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />}
                  </div>
                  
                  {selectedUsers.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2 bg-primary-500/10 border border-primary-500/20 px-4 py-2 rounded-xl"
                    >
                      <span className="text-xs font-bold text-primary-400">{selectedUsers.length} selected</span>
                      <div className="h-4 w-px bg-white/10 mx-2" />
                      <button onClick={() => handleBulkAction('status', true)} className="text-[10px] font-black uppercase text-emerald-400 hover:text-emerald-300">Activate</button>
                      <button onClick={() => handleBulkAction('status', false)} className="text-[10px] font-black uppercase text-red-400 hover:text-red-300">Ban</button>
                      <select 
                        onChange={(e) => handleBulkAction('role', e.target.value)}
                        className="bg-transparent text-[10px] font-black uppercase text-white/40 hover:text-white outline-none cursor-pointer"
                        defaultValue=""
                      >
                        <option value="" disabled>Role</option>
                        <option value="student">To Student</option>
                        <option value="teacher">To Teacher</option>
                        <option value="admin">To Admin</option>
                      </select>
                    </motion.div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex bg-[#0d101d] p-1 rounded-xl border border-white/5">
                    {['all', 'admin', 'teacher', 'student'].map(role => (
                      <button
                        key={role}
                        onClick={() => setFilterRole(role)}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                          filterRole === role ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'text-white/30 hover:text-white'
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.01]">
                      <th className="px-6 py-4 w-10">
                        <input 
                          type="checkbox" 
                          className="rounded border-white/10 bg-white/5 text-primary-500 focus:ring-primary-500/20"
                          checked={users.length > 0 && selectedUsers.length === users.length}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedUsers(users.map(u => u._id));
                            else setSelectedUsers([]);
                          }}
                        />
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/20">User Profile</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/20">Role</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/20">Last Seen</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/20">Activity</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/20">Status</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/20 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    <AnimatePresence mode="popLayout">
                      {users.map((user) => (
                        <motion.tr 
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          key={user._id} 
                          className="group hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-6 py-5">
                            <input 
                              type="checkbox" 
                              className="rounded border-white/10 bg-white/5 text-primary-500 focus:ring-primary-500/20"
                              checked={selectedUsers.includes(user._id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedUsers([...selectedUsers, user._id]);
                                else setSelectedUsers(selectedUsers.filter(id => id !== user._id));
                              }}
                            />
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden shadow-md">
                                <Avatar 
                                  src={user.avatar} 
                                  name={user.name} 
                                  size="sm"
                                  className="w-full h-full"
                                />
                              </div>
                              <div>
                                <p className="font-bold text-sm group-hover:text-primary-400 transition-colors">{user.name}</p>
                                <p className="text-xs text-white/30 truncate max-w-[150px]">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <select 
                              value={user.role}
                              onChange={(e) => handleUpdateRole(user._id, e.target.value)}
                              className="bg-transparent text-xs font-bold uppercase tracking-wider text-white/60 outline-none cursor-pointer hover:text-primary-400 transition-colors"
                            >
                              <option value="student">Student</option>
                              <option value="teacher">Teacher</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td className="px-6 py-5">
                            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                               {user.lastSeen ? new Date(user.lastSeen).toLocaleDateString() : 'Never'}
                            </p>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col gap-1">
                               <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                                  <div className="h-full bg-primary-500" style={{ width: `${Math.min(100, (user.totalTime || 0) / 3600 * 10)}%` }} />
                               </div>
                               <span className="text-[9px] text-white/20 font-black uppercase tracking-[0.1em]">
                                  {Math.round((user.totalTime || 0) / 60)}m active
                                </span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase ${
                              user.isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-emerald-400' : 'bg-red-400'}`} />
                              {user.isActive ? 'Active' : 'Banned'}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => fetchUserActivity(user._id)}
                                className="p-2 rounded-lg text-white/20 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
                                title="Activity History"
                              >
                                <TrendingUp size={18} />
                              </button>
                              <button 
                                onClick={() => setEditingUser(user)}
                                className="p-2 rounded-lg text-white/20 hover:text-primary-400 hover:bg-primary-500/10 transition-all"
                                title="Edit Credentials"
                              >
                                <Key size={18} />
                              </button>
                              <button 
                                onClick={() => toggleUserStatus(user)}
                                className={`p-2 rounded-lg transition-all ${
                                  user.isActive ? 'text-white/20 hover:text-red-400 hover:bg-red-500/10' : 'text-white/20 hover:text-emerald-400 hover:bg-emerald-500/10'
                                }`}
                                title={user.isActive ? 'Deactivate' : 'Activate'}
                              >
                                {user.isActive ? <UserX size={18} /> : <UserCheck size={18} />}
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                    {!loading && users.length === 0 && (
                      <tr>
                        <td colSpan="6" className="px-6 py-20 text-center text-white/20 font-medium">
                          No users found. Try adjusting your search or filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="p-6 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
                <p className="text-xs text-white/20 font-medium">
                  Showing <span className="text-white">{(page-1)*pagination.limit + 1}</span> to <span className="text-white">{Math.min(page*pagination.limit, pagination.total)}</span> of <span className="text-white">{pagination.total}</span> users
                </p>
                
                <div className="flex items-center gap-2">
                  <PaginationButton 
                    onClick={() => setPage(1)} 
                    disabled={page === 1}
                    icon={ChevronsLeft}
                  />
                  <PaginationButton 
                    onClick={() => setPage(p => Math.max(1, p-1))} 
                    disabled={page === 1}
                    icon={ChevronLeft}
                  />
                  
                  <div className="flex items-center px-4 h-9 rounded-lg bg-white/5 border border-white/5 text-[10px] font-black tracking-widest">
                    PAGE {page} OF {pagination.pages}
                  </div>

                  <PaginationButton 
                    onClick={() => setPage(p => Math.min(pagination.pages, p+1))} 
                    disabled={page === pagination.pages}
                    icon={ChevronRight}
                  />
                  <PaginationButton 
                    onClick={() => setPage(pagination.pages)} 
                    disabled={page === pagination.pages}
                    icon={ChevronsRight}
                  />
                </div>
              </div>
            </>
          ) : activeTab === 'sessions' ? (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeSessions.map(sess => (
                  <div key={sess._id} className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-primary-500/30 transition-all group">
                    <div className="flex items-center justify-between mb-4">
                      <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">Live</span>
                      <div className="flex items-center gap-2">
                         <button 
                            onClick={() => fetchSessionSnapshot(sess._id)}
                            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                            title="God Mode Snapshot"
                         >
                            <Shield size={14} />
                         </button>
                         <button 
                            onClick={() => terminateSession(sess._id)}
                            className="p-2 bg-red-500/10 hover:bg-red-500 rounded-lg text-red-400 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                            title="Terminate Session"
                         >
                            <Trash2 size={14} />
                         </button>
                      </div>
                    </div>
                    <h4 className="font-bold text-lg mb-1">{sess.title}</h4>
                    <p className="text-xs text-white/40 mb-4 tracking-wide font-medium">Host: <span className="text-white/60">{sess.host?.name || 'Unknown'}</span></p>
                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                       <div className="flex items-center gap-2 text-primary-400">
                          <Users size={16} />
                          <span className="text-xs font-black uppercase tracking-widest">Active Members</span>
                       </div>
                       <span className="text-lg font-black">{sess.participants?.length || 0}</span>
                    </div>
                  </div>
                ))}
                {activeSessions.length === 0 && (
                  <div className="col-span-full py-20 text-center text-white/20 font-medium">
                    No active sessions found.
                  </div>
                )}
              </div>

              {/* God Mode Snapshot Modal */}
              <AnimatePresence>
                 {selectedSessionSnapshot && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 sm:p-10">
                       <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setSelectedSessionSnapshot(null)}
                          className="absolute inset-0 bg-[#060811]/90 backdrop-blur-xl"
                       />
                       <motion.div 
                          initial={{ opacity:0, scale: 0.95 }}
                          animate={{ opacity:1, scale: 1 }}
                          exit={{ opacity:0, scale: 0.95 }}
                          className="relative w-full max-w-4xl max-h-[90vh] bento-card border-primary-500/20 shadow-2xl shadow-primary-500/10 overflow-hidden flex flex-col"
                       >
                          <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                             <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary-500/20 rounded-2xl text-primary-400">
                                   <Shield size={24} />
                                </div>
                                <div>
                                   <h2 className="text-xl font-black tracking-tight">{selectedSessionSnapshot.session.title}</h2>
                                   <p className="text-xs text-white/40 font-bold uppercase tracking-widest">Live Auditor View • God Mode</p>
                                </div>
                             </div>
                             <button onClick={() => setSelectedSessionSnapshot(null)} className="p-2 hover:bg-white/5 rounded-xl transition-all">
                                <ArrowLeft size={20} className="rotate-180" />
                             </button>
                          </div>
                          
                          <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div>
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-4 flex items-center gap-2">
                                   <Users size={14} className="text-primary-400" /> Active Participants ({selectedSessionSnapshot.session.participants.length})
                                </h3>
                                <div className="space-y-4">
                                   {selectedSessionSnapshot.session.participants.map(p => (
                                      <div key={p.socketId} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                                         <div className="flex items-center gap-3">
                                         <div className="w-8 h-8 rounded-full border border-primary-500/10 overflow-hidden shrink-0">
                                            <Avatar 
                                               src={p.avatar} // Assuming snapshot gives p.avatar
                                               name={p.name}
                                               size="sm"
                                               className="w-full h-full"
                                            />
                                         </div>
                                            <span className="text-sm font-bold">{p.name}</span>
                                         </div>
                                         <div className="flex items-center gap-2">
                                            <button className="p-1.5 hover:bg-white/5 rounded-lg text-white/20 hover:text-white transition-all"><MoreVertical size={14} /></button>
                                         </div>
                                      </div>
                                   ))}
                                </div>
                             </div>
                             <div>
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-4 flex items-center gap-2">
                                   <Activity size={14} className="text-indigo-400" /> Live Chat Feed
                                </h3>
                                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                   {selectedSessionSnapshot.messages.map(m => (
                                      <div key={m._id} className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                                         <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">{m.senderName}</span>
                                            <span className="text-[9px] text-white/10">{new Date(m.createdAt).toLocaleTimeString()}</span>
                                         </div>
                                         <p className="text-xs text-white/60 leading-relaxed">{m.text}</p>
                                      </div>
                                   ))}
                                </div>
                             </div>
                          </div>

                          <div className="p-6 border-t border-white/5 bg-white/[0.01] flex justify-between items-center">
                             <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-black tracking-widest uppercase border border-emerald-500/10">
                                   <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Signal Stable
                                </span>
                             </div>
                             <button 
                                onClick={() => terminateSession(selectedSessionSnapshot.session._id)}
                                className="px-6 py-2 bg-red-500 hover:bg-red-600 rounded-xl font-bold text-xs transition-all shadow-lg shadow-red-500/20"
                             >
                                Terminate Session
                             </button>
                          </div>
                       </motion.div>
                    </div>
                 )}
              </AnimatePresence>
            </div>
          ) : activeTab === 'audit' ? (
             <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="pr-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-white/20">Type</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-white/20">Admin</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-white/20">Details</th>
                        <th className="pl-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-white/20">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {auditLogs.map(log => (
                        <tr key={log._id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="pr-6 py-4">
                            <span className="px-2 py-1 rounded-lg bg-primary-500/10 text-primary-400 border border-primary-500/10 text-[9px] font-black uppercase tracking-widest">
                               {log.action}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-white/60">
                             {log.adminId?.name || 'Automated'}
                          </td>
                          <td className="px-6 py-4 text-[11px] text-white/40 font-medium italic">
                             {JSON.stringify(log.details || '').slice(0, 50)}...
                          </td>
                          <td className="pl-6 py-4 text-right text-[10px] font-bold text-white/20 uppercase tracking-widest">
                             {new Date(log.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-8 flex justify-center gap-2">
                   {[...Array(pagination.pages || 1)].map((_, i) => (
                      <button 
                         key={i} 
                         onClick={() => setPage(i + 1)}
                         className={`w-8 h-8 rounded-lg font-black text-xs transition-all ${page === i + 1 ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'bg-white/5 text-white/30 hover:bg-white/10'}`}
                      >
                         {i + 1}
                      </button>
                   ))}
                </div>
             </div>
          ) : activeTab === 'settings' ? (
             <div className="p-10 max-w-2xl mx-auto">
                <h3 className="text-xl font-black mb-8 flex items-center gap-3">
                   <Settings className="text-primary-400" /> Platform Infrastructure
                </h3>
                <div className="space-y-6">
                   {configs.map(conf => (
                      <div key={conf._id} className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                         <div>
                            <p className="font-black text-sm uppercase tracking-widest text-white/80 mb-1">{conf.key.replace(/_/g, ' ')}</p>
                            <p className="text-xs text-white/30 font-medium tracking-wide">{conf.description}</p>
                         </div>
                         {typeof conf.value === 'boolean' ? (
                            <button 
                               onClick={() => updateConfig(conf.key, !conf.value)}
                               className={`relative w-12 h-6 rounded-full transition-all ${conf.value ? 'bg-emerald-500' : 'bg-white/10'}`}
                            >
                               <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${conf.value ? 'left-7' : 'left-1'}`} />
                            </button>
                         ) : (
                            <input 
                               type="number"
                               className="w-20 bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-sm text-center outline-none focus:border-primary-500/50"
                               defaultValue={conf.value}
                               onBlur={(e) => updateConfig(conf.key, parseInt(e.target.value))}
                            />
                         )}
                      </div>
                   ))}

                   <div className="mt-12 p-8 rounded-[2rem] bg-amber-500/10 border border-amber-500/20">
                      <div className="flex items-center gap-4 mb-3">
                         <div className="p-3 bg-amber-500/20 rounded-2xl text-amber-500">
                            <Shield size={24} />
                         </div>
                         <h4 className="font-black text-lg text-amber-500">Infrastructure Safeguard</h4>
                      </div>
                      <p className="text-xs text-amber-500/60 leading-relaxed font-medium">
                         Maintenance mode blocks all non-administrative traffic globally. 
                         Admins and internal health checks bypass this layer automatically. 
                         Ensure you finish critical updates before disabling.
                      </p>
                   </div>
                </div>
             </div>
          ) : (
            <div className="p-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                <div className="space-y-6">
                   <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/20 flex items-center gap-2">
                      <Activity size={14} className="text-primary-500" /> Database Stack
                   </h3>
                   <div className="p-6 rounded-3xl bg-[#0d101d] border border-white/5 space-y-4">
                      <div className="flex items-center justify-between">
                         <span className="text-xs text-white/40 font-medium">Platform Backend</span>
                         <span className="text-xs font-black uppercase text-emerald-400 tracking-widest bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/10">Connected</span>
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-xs text-white/40 font-medium">Storage Engine</span>
                         <span className="text-xs font-black uppercase text-white/80 tracking-widest">{systemHealth?.database?.type || 'Loading...'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-xs text-white/40 font-medium">Atlas Cluster</span>
                         <span className="text-xs font-black uppercase text-indigo-400 tracking-widest">{systemHealth?.database?.status || 'Active'}</span>
                      </div>
                   </div>

                   <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/20 flex items-center gap-2 pt-4">
                      <Zap size={14} className="text-amber-500" /> Mediasoup SFU Node
                   </h3>
                   <div className="p-6 rounded-3xl bg-[#0d101d] border border-white/5 space-y-4">
                      <div className="flex items-center justify-between">
                         <span className="text-xs text-white/40 font-medium">Worker Status</span>
                         <span className="text-xs font-black uppercase text-emerald-400 tracking-widest">Operational</span>
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-xs text-white/40 font-medium">Port Health</span>
                         <span className="text-xs font-black uppercase text-white/80 tracking-widest">OK</span>
                      </div>
                   </div>
                </div>

                <div className="space-y-6 text-left">
                   <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/20 flex items-center gap-2">
                      <TrendingUp size={14} className="text-emerald-500" /> Performance Metrics
                   </h3>
                   <div className="p-6 rounded-3xl bg-[#0d101d] border border-white/5 space-y-6">
                      <div>
                         <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-white/40 font-medium">Node Uptime</span>
                            <span className="text-xs text-emerald-400 font-black uppercase tracking-widest">
                               {Math.floor((systemHealth?.uptime || 0) / 3600)}h {Math.floor(((systemHealth?.uptime || 0) % 3600) / 60)}m
                            </span>
                         </div>
                         <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 w-[95%]" />
                         </div>
                      </div>

                      <div>
                         <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-white/40 font-medium">Memory Usage</span>
                            <span className="text-xs text-amber-400 font-black uppercase tracking-widest">
                               {Math.round((systemHealth?.memory?.rss || 0) / 1024 / 1024)} MB
                            </span>
                         </div>
                         <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 w-[60%]" />
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* --- MODALS --- */}
        <AnimatePresence>
          {editingUser && (
            <EditUserModal 
              user={editingUser} 
              onClose={() => setEditingUser(null)} 
              onSave={handleUpdateUser} 
            />
          )}
          
          {viewingUserActivity && (
            <UserActivityModal 
              data={viewingUserActivity} 
              onClose={() => setViewingUserActivity(null)} 
            />
          )}
        </AnimatePresence>
      </motion.main>
    </div>
  );
}

function PaginationButton({ onClick, disabled, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-white/5 text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
    >
      <Icon size={16} />
    </button>
  );
}

function StatCard({ icon: Icon, label, value, subValue, color }) {
  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      className="bento-card border-white/5 bg-white/[0.01]"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-xl bg-white/5 ${color}`}>
          <Icon size={20} />
        </div>
        <TrendingUp size={16} className="text-white/10" />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-1">{label}</p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-3xl font-black tracking-tight">{value}</h3>
          <span className="text-[10px] font-bold text-emerald-400">{subValue}</span>
        </div>
      </div>
    </motion.div>
  );
}

// Modal Components
function EditUserModal({ user, onClose, onSave }) {
  const [form, setForm] = useState({
    name: user.name || '',
    email: user.email || '',
    studentId: user.studentId || '',
    role: user.role || 'student',
    password: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onSave(user._id, form);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-[#0d101d] border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl">
        <div className="p-8 border-b border-white/5 bg-white/[0.02]">
          <h3 className="text-xl font-black flex items-center gap-2"><Key className="text-primary-400" /> Edit Credentials</h3>
          <p className="text-xs text-white/30 mt-1 uppercase font-bold tracking-widest">User: {user.name}</p>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-white/20 ml-1">Full Name</label>
            <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm focus:border-primary-500/50 outline-none transition-all" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-white/20 ml-1">Email Address</label>
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm focus:border-primary-500/50 outline-none transition-all" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-white/20 ml-1">Student ID</label>
            <input type="text" value={form.studentId} onChange={e => setForm({...form, studentId: e.target.value})} className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm focus:border-primary-500/50 outline-none transition-all" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-white/20 ml-1">Update Password</label>
            <input type="password" placeholder="Leave blank to keep current" onChange={e => setForm({...form, password: e.target.value})} className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm focus:border-primary-500/50 outline-none transition-all" />
          </div>
          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/5 font-bold text-sm hover:bg-white/5 transition-all">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-3 bg-primary-500 rounded-xl font-bold text-sm shadow-lg shadow-primary-500/20 disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function UserActivityModal({ data, onClose }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative w-full max-w-2xl max-h-[80vh] bg-[#0d101d] border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col">
        <div className="p-8 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <TrendingUp size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black">{data.user.name}</h3>
              <p className="text-xs text-white/30 uppercase font-bold tracking-widest">{data.user.role} • Joined {new Date(data.user.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-all"><ArrowLeft size={20} className="rotate-180" /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          <section>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-4">Recent Attendance</h4>
            <div className="space-y-2">
              {data.attendance.length === 0 ? <p className="text-xs text-white/10 italic">No attendance records found.</p> : data.attendance.map((at, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
                   <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <div>
                         <p className="text-sm font-bold">Session Entry</p>
                         <p className="text-[10px] text-white/30">{new Date(at.joinTime).toLocaleString()}</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-xs font-black text-primary-400 uppercase tracking-widest">{Math.round((at.duration || 0) / 60)}m</p>
                      <p className="text-[9px] text-white/10">Duration</p>
                   </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-4">Sessions Hosted</h4>
            <div className="space-y-2">
               {data.sessionsHosted.length === 0 ? <p className="text-xs text-white/10 italic">No sessions hosted yet.</p> : data.sessionsHosted.map(sess => (
                  <div key={sess._id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                     <p className="text-sm font-bold text-white/80">{sess.title}</p>
                     <div className="flex items-center gap-3 mt-2">
                        <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">{new Date(sess.createdAt).toLocaleDateString()}</span>
                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{sess.participants?.length || 0} Participants</span>
                     </div>
                  </div>
               ))}
            </div>
          </section>
        </div>
      </motion.div>
    </div>
  );
}
