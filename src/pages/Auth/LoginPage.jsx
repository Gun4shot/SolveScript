import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { CheckCircle } from 'lucide-react';

export default function LoginPage() {
  const location = useLocation();
  const toast = useToast();

  useEffect(() => {
    // Check for error in URL params (from OAuth failure)
    const params = new URLSearchParams(location.search);
    if (params.get('error') === 'auth_failed') {
      toast.error('Google Authentication failed. Please try again.');
    }
  }, [location, toast]);

  const handleGoogleLogin = () => {
    // Redirect to backend OAuth route
    window.location.href = 'http://localhost:5000/api/auth/google';
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-surface px-6">
      <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-2xl shadow-soft border border-border text-center">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center">
            <CheckCircle size={24} className="text-white" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-primary mb-2">Welcome to PaperSolve</h1>
        <p className="text-secondary mb-8">Sign in to save your progress and access detailed analytics.</p>

        <button 
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white border border-border text-primary font-medium py-3 px-4 rounded-xl hover:bg-surface transition-colors shadow-sm active:scale-[0.98]"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <p className="mt-8 text-xs text-secondary">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
