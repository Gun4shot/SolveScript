import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import './AuthPages.css';

const signInErrors = {
  google_cancelled: 'Google sign-in was cancelled. You can try again whenever you are ready.',
  google_state: 'That sign-in link expired. Please start again.',
  google_exchange: 'Google could not complete that sign-in. Please try again.',
  google_profile: 'We could not verify that Google account. Please try another account.',
  google_not_configured: 'Google sign-in has not been configured on this server yet.'
};

export default function LoginPage({ signup = false }) {
  const { user, completeProfile, login, register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const needsName = Boolean(user?.needsProfileName);
  // React Router can reuse this component as the path changes. The path is the
  // authoritative mode, which keeps login/register navigation in sync.
  const isSignup = signup || location.pathname === '/register';
  const returnTo = (() => {
    const from = location.state?.from;
    if (!from || typeof from.pathname !== 'string' || !from.pathname.startsWith('/') || from.pathname.startsWith('//')) return '/dashboard';
    if (from.pathname === '/login' || from.pathname === '/register') return '/dashboard';
    return `${from.pathname}${from.search || ''}${from.hash || ''}`;
  })();

  useEffect(() => {
    const error = params.get('authError');
    if (error) toast.error(signInErrors[error] || 'Sign-in could not be completed. Please try again.');
  }, [params, toast]);

  useEffect(() => {
    if (user && !user.needsProfileName) navigate(returnTo, { replace: true });
  }, [navigate, returnTo, user]);

  const submitName = async (event) => {
    event.preventDefault();
    if (name.trim().length < 2) {
      toast.error('Please enter the name you would like us to use.');
      return;
    }
    setSaving(true);
    try {
      await completeProfile(name.trim());
      toast.success(`Nice to meet you, ${name.trim()}!`);
      navigate(returnTo, { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'We could not save your name.');
    } finally {
      setSaving(false);
    }
  };

  const submitManual = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Please enter your email and password.');
      return;
    }
    if (isSignup) {
      if (name.trim().length < 2) {
        toast.error('Please enter the name you would like us to use.');
        return;
      }
      if (password.length < 6) {
        toast.error('Your password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        toast.error('Your passwords do not match.');
        return;
      }
    }
    setSaving(true);
    try {
      if (isSignup) {
        await register(name.trim(), email.trim(), password);
        toast.success(`Welcome to SolveScript, ${name.trim()}!`);
      } else {
        await login(email.trim(), password);
        toast.success('Welcome back!');
      }
      navigate(returnTo, { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'We could not sign you in. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-art-panel" aria-label="A study journey under a starry sky">
        <Link className="auth-brand" to="/">
          <img src="/solvescript-character-mark-v1.png" alt="" />
          <span>solve<i>script</i><small>THE STUDY STUDIO</small></span>
        </Link>
        <img className="auth-hero-art" src="/media/solvescript-login-hero-v2.png" alt="Study companions travelling along an open notebook path" />
        <div className="auth-art-caption">
          <span><Sparkles size={14} /> SMALL WINS, CLEARER NEXT STEPS</span>
          <h1>Your paper practice,<br /><em>made visible.</em></h1>
        </div>
      </section>

      <section className="auth-form-panel">
        <Link className="auth-mobile-brand" to="/">
          <img src="/solvescript-character-mark-v1.png" alt="" /> solve<i>script</i>
        </Link>
        <div className="auth-card animate-fade-in-up">
          <img className="auth-peeking-mascot" src="/media/solvescript-login-mascot-v2.png" alt="A friendly SolveScript study companion peeking over the sign-in card" />
          {needsName ? (
            <>
              <div className="auth-header">
                <span className="auth-eyebrow">ONE LAST THING</span>
                <h2>What should we call you?</h2>
                <p>Your name makes your study space feel like yours.</p>
              </div>
              <form className="auth-form" onSubmit={submitName}>
                <label className="auth-label" htmlFor="display-name">Your name</label>
                <input id="display-name" className="auth-input" autoFocus autoComplete="name" placeholder="e.g. Aisha" value={name} onChange={(event) => setName(event.target.value)} maxLength={50} />
                <button className="auth-primary" type="submit" disabled={saving}>
                  {saving ? <span className="spinner" /> : <>Open my study space <ArrowRight size={17} /></>}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="auth-header">
                <span className="auth-eyebrow">{isSignup ? 'START YOUR STUDY SPACE' : 'WELCOME BACK'}</span>
                <h2>{isSignup ? 'A clearer way to practise.' : 'Pick up where you left off.'}</h2>
                <p>{isSignup ? 'Create an account to keep every paper, result, and streak.' : 'Sign in to save your papers, results, and streak.'}</p>
              </div>
              <form className="auth-form" onSubmit={submitManual}>
                {isSignup && (
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="signup-name">Your name</label>
                    <input id="signup-name" className="auth-input" autoComplete="name" placeholder="e.g. Aisha" value={name} onChange={(event) => setName(event.target.value)} maxLength={50} />
                  </div>
                )}
                <div className="auth-field">
                  <label className="auth-label" htmlFor="auth-email">Email address</label>
                  <input id="auth-email" className="auth-input" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
                </div>
                <div className="auth-field">
                  <label className="auth-label" htmlFor="auth-password">Password</label>
                  <input id="auth-password" className="auth-input" type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} placeholder={isSignup ? 'At least 6 characters' : 'Your password'} value={password} onChange={(event) => setPassword(event.target.value)} />
                </div>
                {isSignup && (
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="auth-confirm-password">Confirm password</label>
                    <input id="auth-confirm-password" className="auth-input" type="password" autoComplete="new-password" placeholder="Repeat your password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                  </div>
                )}
                <button className="auth-primary" type="submit" disabled={saving}>
                  {saving ? <span className="spinner" /> : <>{isSignup ? 'Create account' : 'Log in'} <ArrowRight size={17} /></>}
                </button>
              </form>
              <div className="auth-divider"><i />or continue with<i /></div>
              <button className="auth-google" type="button" onClick={authAPI.googleLogin}>
                <span className="auth-google-mark" aria-hidden="true">G</span>
                Continue with Google
              </button>
              <p className="auth-switch">{isSignup ? 'Already have an account?' : 'New to SolveScript?'} <Link to={isSignup ? '/login' : '/register'} state={location.state}>{isSignup ? 'Log in' : 'Create one'}</Link></p>
              <Link className="auth-guest-link" to="/dashboard">I’d rather try as a guest <ArrowRight size={15} /></Link>
            </>
          )}
        </div>
        <p className="auth-bottom-note">Your work deserves a record of how far you have come.</p>
      </section>
    </main>
  );
}
