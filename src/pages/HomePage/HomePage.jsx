import { Link } from 'react-router-dom';
import { ArrowUpRight, Code2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Hero3D from '../../components/Hero3D';
import AboutStory from '../../components/AboutStory';
import './HomePage.css';

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const primaryPath = isAuthenticated ? '/dashboard' : '/login';
  return <main className="new-home">
    <Hero3D primaryPath={primaryPath} />
    <AboutStory />
    <section id="developers" className="home-developers" aria-labelledby="developers-heading">
      <div className="container home-developers-layout">
        <div><span className="section-tag">02 / Developers</span><h2 id="developers-heading">Thoughtfully built.<br /><em>For the work ahead.</em></h2><p>SolveScript brings paper practice and a digital workspace together. Behind every tool is a simple aim: give students more space to think, practise, and understand their progress.</p></div>
        <article className="home-team-card"><span className="home-team-label"><Code2 size={18} aria-hidden="true" /> The developer behind the studio</span><img src="/solvescript-character-mark-v1.png" alt="" width="112" height="112" loading="lazy" /><h3>Sidant Chaturbedi</h3><p>Solo developer · Design & development</p><div className="home-team-note">Care in the details.<br />Clarity in the everyday.</div></article>
      </div>
    </section>
    <footer id="paper-waiting" className="home-cta"><div className="container"><span className="section-tag">Your paper is waiting</span><h2>Make the next one<br /><em>mean something.</em></h2><Link className="home-primary light-cta" to={isAuthenticated ? '/dashboard' : '/register'}><span>{isAuthenticated ? 'Open your dashboard' : 'Create your study studio'}</span><span className="home-button-arrow" aria-hidden="true"><ArrowUpRight size={20} /></span></Link><a className="home-back-top" href="#top">Back to top ↑</a></div></footer>
  </main>;
}
