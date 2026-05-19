import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { UserPlus, Zap, Eye, EyeOff, BadgeCheck, Lock, Wand2, GraduationCap, UserRound, RefreshCw, Copy } from 'lucide-react';
import api from '../services/api.js';
import { useAuthStore } from '../store/authStore.js';
import GoogleAuthButton from '../components/auth/GoogleAuthButton.jsx';
import Logo from '../components/ui/Logo.jsx';
import Avatar from '../components/ui/Avatar.jsx';
import { motion, AnimatePresence } from 'framer-motion';

import { useLocation } from 'react-router-dom';

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth, refreshProfile } = useAuthStore();
  
  const from = location.state?.from?.pathname || '/dashboard';
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'student',
    studentId: '',
    password: '',
    confirm: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatedPwCopied, setGeneratedPwCopied] = useState(false);
  
  // Real-time Email Preview & Validation
  const [emailPreview, setEmailPreview] = useState({ profilePic: null, isTaken: false, checking: false });

  // ── Generate a random strong password ──
  const generatePassword = () => {
    const charset = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789@#$!';
    let pw = '';
    for (let i = 0; i < 10; i++) {
      pw += charset[Math.floor(Math.random() * charset.length)];
    }
    setForm((prev) => ({ ...prev, password: pw, confirm: pw }));
    setAutoFilled(true);
    setShowPassword(true);
    setShowConfirm(true);
    // Copy to clipboard
    navigator.clipboard?.writeText(pw).then(() => {
      setGeneratedPwCopied(true);
      setTimeout(() => setGeneratedPwCopied(false), 3000);
    });
  };

  // ── Auto-derive password from last 6 digits of Registration Number ──
  const handleIdChange = (e) => {
    const id = e.target.value;
    const digits = id.replace(/\D/g, ''); // extract only numeric digits
    const last6 = digits.slice(-6);
    
    setForm((prev) => {
      const newForm = { ...prev, studentId: id };
      
      // Auto-fill logic: only if the numeric part reaches 6 digits
      if (last6.length === 6) {
        // Only if password hasn't been manually touched or was already an auto-fill
        const currentIsAutoDerived = prev.password === prev.studentId.replace(/\D/g, '').slice(-6);
        if (!prev.password || currentIsAutoDerived) {
          const generatedPw = last6;
          newForm.password = generatedPw;
          newForm.confirm = generatedPw;
          setAutoFilled(true);
        }
      } else {
        setAutoFilled(false);
      }
      
      return newForm;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirm) {
      return toast.error('Passwords do not match');
    }
    if (form.password.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }

    if (form.role === 'student' && form.studentId) {
      const digits = form.studentId.replace(/\D/g, '');
      const last6 = digits.slice(-6);
      if (last6.length === 6 && !form.password.includes(last6)) {
        return toast.error(`Password must contain the last 6 digits of your Student ID (${last6})`);
      }
    }

    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/register', {
        name: form.name,
        email: form.email,
        role: form.role,
        password: form.password,
        studentId: form.role === 'student' ? (form.studentId || undefined) : undefined,
      });
      // Standardize the user object to include profilePic
      const user = {
        ...data.user,
        profilePic: data.user.profilePic || data.user.avatar
      };
      setAuth(user, data.accessToken);
      // Force immediate profile sync after registration
      await refreshProfile();
      toast.success(`Welcome to iChange, ${data.user.name}!`);
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Debounced Email Sync ──
  useEffect(() => {
    const syncProfileFromEmail = async () => {
      const email = form.email;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      if (!email || !emailRegex.test(email)) {
        setEmailPreview({ profilePic: null, isTaken: false, checking: false });
        return;
      }

      setEmailPreview(prev => ({ ...prev, checking: true }));
      try {
        const { data } = await api.get(`/api/auth/sync-profile/${encodeURIComponent(email)}`);
        if (data.valid) {
          setEmailPreview({ 
            profilePic: data.profilePic, 
            isTaken: false, // We'll let the submit handle existing email errors or check elsewhere
            checking: false 
          });
        } else {
          setEmailPreview({ profilePic: null, isTaken: false, checking: false });
        }
      } catch (err) {
        setEmailPreview(prev => ({ ...prev, checking: false }));
      }
    };

    const timer = setTimeout(syncProfileFromEmail, 600);
    return () => clearTimeout(timer);
  }, [form.email]);

  // ── Sanitization: Ensure form is fresh on mount ──
  useEffect(() => {
    const timer = setTimeout(() => {
      setForm({
        name: '',
        email: '',
        role: 'student',
        studentId: '',
        password: '',
        confirm: '',
      });
      setEmailPreview({ profilePic: null, isTaken: false, checking: false });
    }, 100);
    return () => clearTimeout(timer);
  }, []);


  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 transition-colors duration-300">
      {/* Animated background glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md animate-in">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold mb-6">Create your account</h2>

          {/* Role Selector */}
          <div className="flex p-1 bg-surface-900/50 border border-border rounded-xl mb-6">
            <button
              type="button"
              onClick={() => setForm({ ...form, role: 'student' })}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
                form.role === 'student'
                  ? 'bg-primary-500 text-white shadow-lg'
                  : 'text-foreground/40 hover:text-foreground/70'
              }`}
            >
              <GraduationCap size={18} />
              I'm a Student
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, role: 'teacher' })}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
                form.role === 'teacher'
                  ? 'bg-primary-500 text-white shadow-lg'
                  : 'text-foreground/40 hover:text-foreground/70'
              }`}
            >
              <UserRound size={18} />
              I'm a Teacher
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-foreground/60 mb-2">Full Name</label>
              <input
                id="name"
                type="text"
                className="input-field"
                placeholder="Student"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-foreground/60 mb-2 flex items-center justify-between">
                 <span>Email</span>
                 {emailPreview.isTaken && <span className="text-[10px] text-red-400 font-black uppercase tracking-widest animate-pulse">Already Registered</span>}
              </label>
              <div className="relative">
                <input
                  id="reg-email"
                  type="email"
                  className={`input-field pr-12 transition-all ${
                    emailPreview.isTaken ? 'border-red-500/50 ring-1 ring-red-500/20' : 
                    emailPreview.profilePic ? 'border-primary-500/50 ring-1 ring-primary-500/20' : ''
                  }`}
                  placeholder="student@gmail.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  autoComplete="none"
                />
                
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                   {emailPreview.checking ? (
                      <RefreshCw size={16} className="text-white/20 animate-spin" />
                   ) : (emailPreview.profilePic || emailPreview.isTaken) ? (
                      <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-7 h-7 rounded-full border border-primary-500/30 overflow-hidden shadow-lg shadow-primary-500/20">
                         <Avatar src={emailPreview.profilePic} name={form.name || 'User'} size="xs" className="w-full h-full" />
                      </motion.div>
                   ) : null}
                </div>
              </div>
              {emailPreview.profilePic && (
                <p className="mt-1.5 text-[10px] text-primary-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                   <BadgeCheck size={12} /> Profile Detected
                </p>
              )}
            </div>

            {/* Student ID — triggers password auto-fill — Only for Students */}
            {form.role === 'student' && (
              <div>
                <label className="block text-sm font-medium text-foreground/60 mb-2 flex items-center gap-1.5">
                  <BadgeCheck size={14} className="text-primary-400" />
                  Student ID
                  <span className="text-foreground/30 font-normal text-xs">— password auto-sets using last 6 digits</span>
                </label>
                <div className="relative">
                  <input
                    id="student-id"
                    type="text"
                    className={`input-field pr-10 transition-all ${autoFilled ? 'border-primary-500/60 ring-1 ring-primary-500/30' : ''}`}
                    placeholder="e.g. 22CS1049"
                    value={form.studentId}
                    onChange={handleIdChange}
                    required={form.role === 'student'}
                    autoComplete="off"
                  />
                  {autoFilled && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Wand2 size={16} className="text-primary-400 animate-pulse" />
                    </div>
                  )}
                </div>
                {autoFilled && (
                  <p className="mt-1.5 text-xs text-primary-400 flex items-center gap-1">
                    <Wand2 size={11} />
                    Password auto-set to last 6 digits: <strong className="font-mono tracking-widest">{form.password}</strong>
                  </p>
                )}
              </div>
            )}

            {/* Teacher ID Placeholder — If Teacher selected */}
            {form.role === 'teacher' && (
              <div>
                <label className="block text-sm font-medium text-foreground/60 mb-2 flex items-center gap-1.5">
                  <BadgeCheck size={14} className="text-primary-400" />
                  Teacher Registration No.
                  <span className="text-foreground/30 font-normal text-xs">— Optional</span>
                </label>
                <input
                  id="teacher-id"
                  type="text"
                  className="input-field"
                  placeholder="e.g. TCH8892 (Optional)"
                  value={form.studentId}
                  onChange={handleIdChange}
                />
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-foreground/60 mb-2 flex items-center gap-1.5">
                <Lock size={14} />
                Password
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  className={`input-field pr-12 ${autoFilled ? 'border-primary-500/40' : ''}`}
                  placeholder={autoFilled ? 'Auto-filled from Student ID' : 'Min. 6 characters'}
                  value={form.password}
                  onChange={(e) => {
                    setForm({ ...form, password: e.target.value });
                    setAutoFilled(false);
                  }}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/70 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-foreground/60 mb-2 flex items-center gap-1.5">
                <Lock size={14} />
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  className={`input-field pr-24 ${
                    form.confirm && form.confirm !== form.password
                      ? 'border-red-500/60 ring-1 ring-red-500/20'
                      : form.confirm && form.confirm === form.password
                      ? 'border-emerald-500/50'
                      : ''
                  }`}
                  placeholder="Re-enter your password"
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  required
                  autoComplete="new-password"
                />
                {/* Show/Hide toggle */}
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-foreground/70 transition-colors"
                  tabIndex={-1}
                  title={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {form.confirm && form.confirm !== form.password && (
                <p className="text-xs text-red-400 mt-1">Passwords don't match</p>
              )}
              {form.confirm && form.confirm === form.password && form.confirm && (
                <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">✓ Passwords match</p>
              )}
            </div>

            {/* Auto-fill / generate info */}
            {autoFilled ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-2.5 text-xs text-emerald-300">
                <Wand2 size={14} className="shrink-0" />
                <span>
                  Password auto-set to last 6 digits:{' '}
                  <strong className="font-mono tracking-widest">{form.password}</strong>
                  {generatedPwCopied && (
                    <span className="ml-2 text-primary-300 font-medium">✓ Copied to clipboard!</span>
                  )}
                </span>
              </div>
            ) : (
              <div className="bg-primary-500/10 border border-primary-500/20 rounded-xl p-3 flex gap-2.5 text-xs text-primary-300">
                <RefreshCw size={14} className="shrink-0 mt-0.5" />
                <span>Click <strong>↺</strong> next to Confirm Password to <strong>auto-generate</strong> a secure password — it'll be copied to your clipboard.</span>
              </div>
            )}

            <button
              id="register-btn"
              type="submit"
              disabled={loading || (form.confirm && form.confirm !== form.password)}
              className="btn-primary w-full flex items-center justify-center gap-2 !mt-6"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus size={18} />
                  Create Account
                </>
              )}
            </button>
          </form>

          <div className="mt-8 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-surface-800/50 backdrop-blur-xl text-foreground/40">or {form.role === 'student' ? 'sign up' : 'continue'} with</span>
            </div>
          </div>

          <div className="mt-6">
            <GoogleAuthButton role={form.role} text="Sign up with Google" />
          </div>

          <p className="text-center text-foreground/40 text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login" state={{ from: location.state?.from }} className="text-primary-400 hover:text-primary-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
