import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import api from '../../services/api.js';
import { useAuthStore } from '../../store/authStore.js';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function GoogleAuthButton({ role = 'student', text = 'Continue with Google' }) {
  const [isLoading, setIsLoading] = useState(false);
  const { setAuth, refreshProfile } = useAuthStore();
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse) => {
    setIsLoading(true);
    try {
      // Send the id_token to the backend for verification
      const res = await api.post('/api/auth/google', {
        idToken: credentialResponse.credential,
        role // The requested role (student or teacher)
      });
      
      const { user, accessToken } = res.data;
      console.log('[GoogleAuth] Login response user.avatar:', user?.avatar);
      setAuth(user, accessToken, null); // Refresh token is now in a secure cookie
      // Immediately sync the resolved profile image from backend as safety net
      await refreshProfile();
      toast.success('Successfully logged in with Google');
      navigate('/dashboard');
    } catch (err) {
      console.error('Google Auth Error:', err);
      toast.error(err.response?.data?.error || 'Failed to authenticate with Google');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = (err) => {
    console.error('[GoogleAuth] Native Error:', err);
    toast.error(
      <div className="flex flex-col gap-1">
        <span className="font-bold">Google Auth Configuration Error</span>
        <span className="text-xs opacity-80">Please ensure http://localhost:5173 is added to "Authorized JavaScript Origins" in your Google Cloud Console.</span>
      </div>,
      { duration: 8000 }
    );
  };

  return (
    <div className={`w-full flex justify-center ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
      <GoogleLogin
        onSuccess={handleGoogleSuccess}
        onError={handleGoogleError}
        useOneTap={false}
        theme="filled_black" // Options: outline, filled_blue, filled_black
        text={text === 'Continue with Google' ? 'continue_with' : 'signin_with'} // The component has limited text properties
        shape="rectangular"
        size="large"
      />
    </div>
  );
}
