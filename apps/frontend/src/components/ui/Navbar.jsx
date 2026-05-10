import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.js';
import Logo from './Logo.jsx';
import { LogOut, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import Avatar from './Avatar.jsx';

export default function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    toast.success('Logged out');
  };

  const avatarUrl = user?.profilePic;

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#060811]/70 backdrop-blur-xl">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-24 flex items-center justify-between">
        <Logo size="md" />

        <div className="flex items-center gap-4 sm:gap-6">
          {user?.role === 'admin' && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/admin')}
              className="px-6 py-3.5 rounded-2xl bg-primary-500/15 text-primary-400 border border-primary-500/30 hover:bg-primary-500/25 transition-all flex items-center gap-3 font-bold shadow-lg shadow-primary-500/10"
              title="Admin Hub"
            >
              <Shield size={20} />
              <span className="hidden sm:inline text-sm font-black uppercase tracking-wider">Admin Hub</span>
            </motion.button>
          )}
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <div className="flex items-center gap-2 mb-0.5">
                {user?.role === 'admin' && (
                  <span className="px-2 py-0.5 rounded-md bg-primary-500/10 text-primary-400 text-[9px] font-black uppercase tracking-widest border border-primary-500/20">
                    ADMIN
                  </span>
                )}
                <p className="text-lg font-black tracking-tight text-white/95">
                  {user?.name}
                </p>
              </div>
              <p className="text-[10px] font-bold tracking-widest text-white/30 truncate max-w-[180px]">
                {user?.email}
              </p>
            </div>

            <Avatar src={avatarUrl} name={user?.name} size="md" />
          </div>
          
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-6 py-3.5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-base font-bold transition-all shadow-inner active:scale-95"
          >
            <LogOut size={18} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
