import { useEffect } from 'react';
import { useAuthStore } from '../../store/authStore.js';
import { useSessionStore } from '../../store/sessionStore.js';
import { socketService } from '../../services/socket.js';

/**
 * Global component to handle profile revalidation on window focus
 */
export default function ProfileRevalidator() {
  const { user, refreshProfile, updateUser } = useAuthStore();
  const { updateParticipantProfile } = useSessionStore();

  useEffect(() => {
    if (!user) return;

    // 1. Socket Listener for real-time updates
    const socket = socketService.connect();
    
    const onProfileUpdate = ({ userId, avatar, source }) => {
      // Update self if this is us
      if (userId === user._id) {
        console.log('[Sync] Received self profile update:', avatar, source);
        updateUser({ avatar, image_source: source });
      }
      
      // Update entry in active session participants list (regardless of who it is)
      updateParticipantProfile(userId, avatar);
    };

    const onGlobalNotice = (notice) => {
      import('react-hot-toast').then(({ toast }) => {
        toast.custom((t) => (
          <div className={`${t.visible ? 'animate-in fade-in slide-in-from-top-2' : 'animate-out fade-out slide-out-to-top-2'} max-w-md w-full bg-[#0d101d]/90 backdrop-blur-2xl border border-primary-500/50 rounded-2xl shadow-2xl shadow-primary-500/20 pointer-events-auto flex overflow-hidden`}>
            <div className="w-1.5 bg-gradient-to-b from-primary-500 to-indigo-500" />
            <div className="flex-1 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                  <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                  </div>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary-400 mb-1">
                    Announcement from {notice.adminName || 'Admin'}
                  </p>
                  <p className="text-sm text-white leading-relaxed">
                    {notice.content}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-white/10">
              <button
                onClick={() => toast.dismiss(t.id)}
                className="w-full border border-transparent p-4 flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/5 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ), { duration: 15000, position: 'top-center' });
      });
    };

    socket.on('user:profile_updated', onProfileUpdate);
    socket.on('global:notice', onGlobalNotice);

    // 2. Tab Focus fallback (covers cases where socket might have missed while tab was dormant)
    const handleFocus = () => {
      refreshProfile().catch(err => console.warn('Profile revalidation failed', err));
    };

    window.addEventListener('focus', handleFocus);
    
    return () => {
      socket.off('user:profile_updated', onProfileUpdate);
      socket.off('global:notice', onGlobalNotice);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, refreshProfile, updateUser, updateParticipantProfile]);

  return null;
}
