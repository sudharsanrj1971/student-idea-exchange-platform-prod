import { useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Megaphone, Info, AlertTriangle } from 'lucide-react';
import { socketService } from '../../services/socket.js';
import { useAuthStore } from '../../store/authStore.js';

export default function GlobalNotificationListener() {
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) return;

    const socket = socketService.connect();
    if (!socket) return;

    const handleGlobalNotice = (notice) => {
      console.log('📣 Global Notice Received:', notice);
      
      const { content, type, adminName } = notice;
      
      let Icon = Megaphone;
      let iconColor = 'text-blue-400';
      if (type === 'banner') {
        Icon = AlertTriangle;
        iconColor = 'text-amber-400';
      } else if (type === 'popup') {
        Icon = Info;
        iconColor = 'text-indigo-400';
      }

      toast.custom(
        (t) => (
          <div
            className={`${
              t.visible ? 'animate-in slide-in-from-top-2 fade-in duration-300' : 'animate-out slide-out-to-top-2 fade-out duration-200'
            } max-w-md w-full bg-surface-800/95 backdrop-blur-xl shadow-2xl rounded-2xl pointer-events-auto border border-border flex ring-1 ring-black/5 p-4 relative overflow-hidden group`}
          >
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-primary-500/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            
            <div className="flex-1 w-0">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                  <div className={`w-10 h-10 rounded-full bg-surface-900 flex items-center justify-center border border-border/50 shadow-inner`}>
                    <Icon size={20} className={iconColor} />
                  </div>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-foreground tracking-wide flex items-center gap-2">
                    Admin Announcement
                    <span className="px-1.5 py-0.5 rounded-md bg-primary-500/10 text-[10px] text-primary-400 font-bold uppercase tracking-widest border border-primary-500/20">Global</span>
                  </p>
                  <p className="mt-1.5 text-sm text-foreground/70 leading-relaxed font-medium">
                    {content}
                  </p>
                  <p className="mt-2 text-xs text-foreground/40 font-medium">
                    Broadcasted by {adminName || 'Admin'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-border/50 pl-4 ml-4">
              <button
                onClick={() => toast.dismiss(t.id)}
                className="w-full flex items-center justify-center text-sm font-medium text-primary-400 hover:text-primary-300 focus:outline-none transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        ),
        {
          duration: type === 'banner' ? 10000 : 6000,
          position: 'top-center',
        }
      );
    };

    socketService.on('global:notice', handleGlobalNotice);

    return () => {
      socketService.off('global:notice', handleGlobalNotice);
    };
  }, [user]);

  return null;
}
