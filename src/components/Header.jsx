import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "./Header.css";

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef(null);
  const toggleRef = useRef(null);
  const closeMenu = () => setMenuOpen(false);
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onPointerDown = (event) => {
      if (!headerRef.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);
  const handleLogout = async () => {
    await logout();
    closeMenu();
    navigate("/");
  };
  return (
    <header ref={headerRef} className={`header ${location.pathname === "/" ? "header-home" : ""}`} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) closeMenu();
    }}>
      <div className="header-inner container">
        <Link to="/" className="header-logo" onClick={closeMenu}>
          <span className="logo-icon">
            <img src="/solvescript-character-mark-v1.png" alt="" width="48" height="48" decoding="async" />
          </span>
          <span className="logo-text">
            <span className="brand-word">solve<span>script</span></span>
            <small>PAST PAPER STUDIO</small>
          </span>
        </Link>
        <nav
          id="landing-navigation"
          className={`header-nav ${menuOpen ? "is-open" : ""}`}
          aria-label="Primary navigation"
        >
          <a className="header-nav-link" href="#about" onClick={closeMenu}>About</a>
          <a className="header-nav-link" href="#developers" onClick={closeMenu}>Developers</a>
          <div className="mobile-nav-actions">
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="header-account-link" onClick={closeMenu}>My studio <ArrowUpRight size={16} aria-hidden="true" /></Link>
                <button className="header-text-action" onClick={handleLogout}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={closeMenu}
                  className="header-text-action"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  onClick={closeMenu}
                  className="header-account-link"
                >
                  Create account
                </Link>
                <Link
                  to="/dashboard"
                  onClick={closeMenu}
                  className="guest-link"
                >
                  Try as guest
                </Link>
              </>
            )}
          </div>
        </nav>
        <div className="header-actions">
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="header-account-link desktop-only">
                My studio <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
              <div className="user-menu">
                <div className="user-avatar" aria-hidden="true">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <span className="user-name">{user?.name}</span>
                <button
                  className="header-text-action desktop-only"
                  onClick={handleLogout}
                >
                  Log out
                </button>
              </div>
            </>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="header-text-action desktop-only">
                Log in
              </Link>
              <Link
                to="/register"
                className="header-account-link desktop-only"
              >
                Create account
              </Link>
              <Link to="/dashboard" className="guest-link desktop-only">
                Try as guest
              </Link>
            </div>
          )}
          <button
            ref={toggleRef}
            className="menu-toggle"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="landing-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>
    </header>
  );
}
