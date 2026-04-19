import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Header.css';

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="header">
      <div className="header-inner container">
        <Link to="/" className="header-logo">
          <div className="logo-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="2" y="2" width="24" height="24" rx="6" stroke="url(#logo-grad)" strokeWidth="2.5"/>
              <path d="M8 14L12 18L20 10" stroke="url(#logo-grad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="logo-grad" x1="2" y1="2" x2="26" y2="26">
                  <stop stopColor="#6366f1"/>
                  <stop offset="1" stopColor="#a78bfa"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="logo-text">
            <span className="text-gradient">PaperSolve</span>
          </span>
        </Link>

        <nav className="header-nav hide-mobile">
          {isAuthenticated && (
            <>
              <Link to="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}>
                Dashboard
              </Link>
              <Link to="/upload" className={`nav-link ${isActive('/upload') ? 'active' : ''}`}>
                New Paper
              </Link>
              <Link to="/history" className={`nav-link ${isActive('/history') ? 'active' : ''}`}>
                History
              </Link>
            </>
          )}
        </nav>

        <div className="header-actions">
          {isAuthenticated ? (
            <div className="user-menu">
              <div className="user-avatar">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <span className="user-name hide-mobile">{user?.name}</span>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                Logout
              </button>
            </div>
          ) : (
            <div className="auth-buttons">
              <Link to="/upload" className="btn btn-ghost btn-sm">
                Try as Guest
              </Link>
              <Link to="/login" className="btn btn-secondary btn-sm">
                Login
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
