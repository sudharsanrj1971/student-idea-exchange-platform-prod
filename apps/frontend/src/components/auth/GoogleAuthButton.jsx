import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../../services/api.js';
import { useAuthStore } from '../../store/authStore.js';

export default function GoogleAuthButton({ role = 'student', text = 'Continue with Google' }) {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { setAuth, refreshProfile } = useAuthStore();
  const googleBtnRef = useRef(null);

  const handleCredentialResponse = async (response) => {
    try {
      setIsLoading(true);
      const res = await api.post('/api/auth/google', {
        idToken: response.credential,
        role
      });
      
      const { user, accessToken } = res.data;
      
      // Store accessToken from response in localStorage as 'token'
      localStorage.setItem('token', accessToken);
      
      // Set auth in store
      setAuth(user, accessToken);
      
      // Sync profile
      await refreshProfile();
      
      toast.success(`Welcome, ${user.name}!`);
      
      // Redirect to /dashboard
      navigate('/dashboard');
    } catch (err) {
      console.error('[Google Auth Error]', err);
      toast.error(err.response?.data?.error || 'Google Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 1. Load the script
    const id = 'google-gsi-client';
    let script = document.getElementById(id);
    
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.id = id;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    const initGis = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
        });

        if (googleBtnRef.current) {
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: googleBtnRef.current.parentElement?.offsetWidth || 350,
          });
        }
      } else {
        setTimeout(initGis, 100);
      }
    };

    if (window.google?.accounts?.id) {
      initGis();
    } else {
      script.addEventListener('load', initGis);
    }

    return () => {
      if (script) {
        script.removeEventListener('load', initGis);
      }
    };
  }, [role]);

  return (
    <div className="relative w-full flex justify-center">
      <div 
        ref={googleBtnRef} 
        className="w-full flex justify-center"
        style={{ minHeight: '44px' }}
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg">
          <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

