import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import api from '../services/api.js';

export default function JoinPage() {
  const { linkCode } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const resolve = async () => {
      try {
        const { data } = await api.get(`/api/sessions/join/${linkCode}`);
        navigate(`/session/${data.session._id}`, { replace: true });
      } catch (err) {
        toast.error(err.response?.data?.error || 'Session not found');
        navigate('/dashboard', { replace: true });
      }
    };
    resolve();
  }, [linkCode, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center transition-colors duration-300">
      <div className="text-center animate-in">
        <Loader2 className="w-10 h-10 text-primary-400 animate-spin mx-auto mb-4" />
        <p className="text-foreground/60">Resolving session link...</p>
        <p className="text-foreground/30 text-sm mt-1">Code: <code className="font-mono">{linkCode}</code></p>
      </div>
    </div>
  );
}
