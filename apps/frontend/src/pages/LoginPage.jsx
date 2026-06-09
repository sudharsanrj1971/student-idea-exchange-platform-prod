import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Eye, EyeOff, LogIn, Mail, Lock, Zap } from 'lucide-react';
import api from '../services/api.js';
import { useAuthStore } from '../store/authStore.js';
import GoogleAuthButton from '../components/auth/GoogleAuthButton.jsx';
import Logo from '../components/ui/Logo.jsx';
import Avatar from '../components/ui/Avatar.jsx';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, BadgeCheck } from 'lucide-react';

import { useLocation } from 'react-router-dom';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth, refreshProfile } = useAuthStore();
  
  const from = location.state?.from?.pathname || '/dashboard';
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // FIX 3: Track maintenance mode so admin can still see the login form
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);

  // ── Sanitization: Ensure form is fresh on mount ──
  useEffect(() => {
    const timer = setTimeout(() => {
      setForm({ email: '', password: '' });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Real-time Email Preview & Sync
  const [emailPreview, setEmailPreview] = useState({ profilePic: null, valid: false, checking: false });

  useEffect(() => {
    const syncProfileFromEmail = async () => {
      const email = form.email;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      if (!email || !emailRegex.test(email)) {
        setEmailPreview({ profilePic: null, valid: false, checking: false });
        return;
      }

      setEmailPreview(prev => ({ ...prev, checking: true }));
      try {
        const { data } = await api.get(`/api/auth/sync-profile/${encodeURIComponent(email)}`);
        if (data.valid) {
          setEmailPreview({ 
            profilePic: data.profilePic, 
            valid: true, 
            checking: false 
          });
        } else {
          setEmailPreview({ profilePic: null, valid: false, checking: false });
        }
      } catch (err) {
        setEmailPreview(prev => ({ ...prev, checking: false }));
      }
    };

    const timer = setTimeout(syncProfileFromEmail, 600);
    return () => clearTimeout(timer);
  }, [form.email]);



  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/login', form);
      // Standardize the user object to include profilePic
      const user = {
        ...data.user,
        profilePic: data.user.profilePic || data.user.avatar
      };
      setAuth(user, data.accessToken);
      toast.success(`Welcome back, ${data.user.name}!`);
      const destination = (from && from !== '/login') ? from : '/dashboard';
      navigate(destination, { replace: true });
      // Sync profile in background after navigation
      refreshProfile().catch(() => {});
    } catch (err) {
      // FIX 3: Special handling for maintenance mode (503)
      if (err.response?.status === 503) {
        setIsMaintenanceMode(true);
        toast.error('Platform is under maintenance. Admin login still works.');
      } else {
        setIsMaintenanceMode(false);
        toast.error(err.response?.data?.error || err.response?.data?.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden transition-colors duration-300">
      {/* Background design elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-[440px] z-10 animate-in">
        {/* Branding header */}
        <div className="flex justify-center mb-10">
          <Logo size="lg" />
        </div>

        <div className="bg-surface-800/50 backdrop-blur-xl border border-border rounded-[2rem] p-8 md:p-10 shadow-2xl transition-colors duration-300">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-foreground">Sign In</h2>
            <p className="text-foreground/30 text-sm mt-1">Enter your email or student ID to continue</p>
          </div>

          {/* FIX 3: Maintenance mode banner — form stays enabled so admin can log in */}
          {isMaintenanceMode && (
            <div className="mb-6 flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10">
              <span className="text-amber-400 text-lg shrink-0">🛠️</span>
              <div>
                <p className="text-sm font-bold text-amber-300">Platform Under Maintenance</p>
                <p className="text-xs text-amber-400/70 mt-0.5">Admin credentials will still work. Users will be redirected after maintenance ends.</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
            {/* Identifier Field (Email or ID) */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/50 ml-1">Email or Student ID</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/30 group-focus-within:text-primary-400 transition-colors">
                  <Mail size={18} />
                </div>
                <input
                  id="email"
                  type="text"
                  className={`input-field pl-12 pr-12 transition-all ${
                    emailPreview.valid ? 'border-primary-500/50 ring-1 ring-primary-500/20' : ''
                  }`}
                  placeholder="student@gmail.com or Student ID..."
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  autoComplete="off"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                   {emailPreview.checking ? (
                      <RefreshCw size={16} className="text-white/20 animate-spin" />
                   ) : emailPreview.valid ? (
                      <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-7 h-7 rounded-full border border-primary-500/30 overflow-hidden shadow-lg shadow-primary-500/20">
                         <Avatar src={emailPreview.profilePic} name={form.email} size="xs" className="w-full h-full" />
                      </motion.div>
                   ) : null}
                </div>
              </div>
              {emailPreview.valid && (
                <p className="mt-1.5 text-[10px] text-primary-400 font-bold uppercase tracking-widest flex items-center gap-1.5 ml-1">
                   <BadgeCheck size={12} /> Profile Detected
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-sm font-medium text-foreground/50">Password</label>
              </div>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/30 group-focus-within:text-primary-400 transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input-field pl-12 pr-12 transition-all"
                  placeholder="••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-foreground/70 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="login-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white font-bold h-14 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary-500/25 transition-all duration-200 mt-8 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <LogIn size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-surface-800/50 backdrop-blur-xl text-foreground/40">or continue with</span>
            </div>
          </div>

          <div className="mt-6">
            <GoogleAuthButton text="Sign in with Google" />
          </div>

          {/* Footer links */}
          <div className="mt-8 pt-8 border-t border-border text-center">
            <p className="text-foreground/30 text-sm">
              Don't have an account?{' '}
              <Link to="/register" state={{ from: location.state?.from }} className="text-primary-400 hover:text-primary-300 font-semibold transition-colors">
                Create Account
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-foreground/20 text-xs mt-10 tracking-wider uppercase">
          © 2026 iChange Learning
        </p>
      </div>
    </div>
  );
}
