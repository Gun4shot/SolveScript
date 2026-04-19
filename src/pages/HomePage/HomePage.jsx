import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './HomePage.css';

export default function HomePage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="home-page">
      {/* Ambient glows */}
      <div className="glow-orb glow-orb-1" />
      <div className="glow-orb glow-orb-2" />

      {/* Hero */}
      <section className="hero">
        <div className="container">
          <div className="hero-content animate-fade-in-up">
            <div className="hero-badge badge badge-accent">
              A-Level Past Paper Solver
            </div>
            <h1 className="hero-title">
              Master Your <span className="text-gradient">MCQs</span> with
              Precision
            </h1>
            <p className="hero-subtitle">
              Upload any Cambridge A-Level MCQ paper and marking scheme. 
              Solve in exam or casual mode with a rich annotation toolkit, 
              then get detailed performance analytics.
            </p>
            <div className="hero-actions">
              {isAuthenticated ? (
                <Link to="/dashboard" className="btn btn-primary btn-lg">
                  Go to Dashboard
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Link>
              ) : (
                <>
                  <Link to="/register" className="btn btn-primary btn-lg">
                    Get Started Free
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Link>
                  <Link to="/upload" className="btn btn-secondary btn-lg">
                    Try as Guest
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Feature cards */}
          <div className="features-grid">
            <div className="feature-card glass-card animate-fade-in-up stagger-1">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
              </div>
              <h3>Upload Any Paper</h3>
              <p className="text-secondary">Upload your question paper PDF and marking scheme. Answers are auto-extracted instantly.</p>
            </div>

            <div className="feature-card glass-card animate-fade-in-up stagger-2">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                  <path d="M2 2l7.586 7.586"/>
                  <circle cx="11" cy="11" r="2"/>
                </svg>
              </div>
              <h3>Annotate & Draw</h3>
              <p className="text-secondary">Draw, highlight, add text and shapes directly on the paper. Use the rough page for working out.</p>
            </div>

            <div className="feature-card glass-card animate-fade-in-up stagger-3">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <h3>Exam & Casual Modes</h3>
              <p className="text-secondary">Simulate real exam conditions with a timer, or solve casually with instant feedback.</p>
            </div>

            <div className="feature-card glass-card animate-fade-in-up stagger-4">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/>
                  <line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              </div>
              <h3>Detailed Analytics</h3>
              <p className="text-secondary">See which questions you got wrong, time spent per question, and track your progress.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
