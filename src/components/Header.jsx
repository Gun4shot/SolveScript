import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, CheckCircle, Upload } from 'lucide-react';

export default function Header() {
  const { isAuthenticated, logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
            <CheckCircle size={18} className="text-white" />
          </div>
          <span className="font-semibold text-lg tracking-tight text-primary">PaperSolve</span>
        </Link>

        <nav className="flex items-center gap-6">
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="text-sm font-medium text-secondary hover:text-primary transition-colors">
                Dashboard
              </Link>
              <Link to="/history" className="text-sm font-medium text-secondary hover:text-primary transition-colors">
                My Papers
              </Link>
              <Link to="/upload" className="flex items-center gap-2 text-sm font-medium bg-surface hover:bg-border text-primary px-4 py-2 rounded-lg transition-colors">
                <Upload size={16} />
                Solve New
              </Link>
              <div className="w-px h-6 bg-border mx-2"></div>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm font-medium text-secondary hover:text-error transition-colors"
              >
                <LogOut size={16} />
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/upload" className="text-sm font-medium text-secondary hover:text-primary transition-colors">
                Try Guest Mode
              </Link>
              <Link to="/login" className="text-sm font-medium bg-accent hover:bg-accentHover text-white px-5 py-2 rounded-lg transition-colors shadow-soft">
                Login
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
