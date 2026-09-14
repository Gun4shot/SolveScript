import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUpRight, Check, Code2, FolderOpen, Infinity as InfinityIcon, KeyRound, PencilLine } from 'lucide-react';
import { observeScrollScene, sceneStyleWriter } from './scrollScene';
import './AboutStory.css';

const chapters = [
  {
    id: 'about-organised', label: 'A place for every paper', title: 'Less searching.', emphasis: 'More starting.',
    body: 'All your past papers, organised. Find Cambridge AS & A Level papers by subject, year, and exam session. Your next session starts with a paper, not a pile of tabs.',
    detail: 'MCQ & written papers · Subject → year → session', to: '/library', action: 'Find your next paper', Icon: FolderOpen,
  },
  {
    id: 'about-practice', label: 'Room for your thinking', title: 'Work it out.', emphasis: 'Make it yours.',
    body: 'Write on the page, take your time, or practise against the clock. Keep your drafts and past attempts together, then come back to the work with fresh eyes.',
    detail: 'Annotations · Saved drafts · Attempt history', to: '/written-library', action: 'Explore written practice', Icon: PencilLine,
  },
  {
    id: 'about-review', label: 'A second pair of eyes', title: 'Your answers.', emphasis: 'Another perspective.',
    body: 'Bring your own Gemini API key for an optional AI review of your written answers against the marking scheme. Find gaps in your working and see where to focus next.',
    detail: 'Your key is used for the request, never stored. AI feedback is an estimate; the official scheme stays beside you. Provider usage limits or charges may apply.', to: '/written-library', action: 'Explore the review workflow', Icon: KeyRound,
  },
  {
    id: 'about-open', label: 'Good tools should be open', title: 'Open source.', emphasis: 'Always free.',
    body: 'A study space you can make your own. SolveScript is free to use, with its source open to explore, improve, and build on. More room to learn. More room to go further.',
    detail: 'Free paper practice. Optional AI runs on your own key.', href: 'https://github.com/Gun4shot/SolveScript', action: 'Explore the source', Icon: Code2,
  },
];

const clamp = (value) => Math.max(0, Math.min(1, value));
const ease = (value) => { const t = clamp(value); return t * t * (3 - 2 * t); };

function Paper({ variant = '' }) {
  return <div className={`about-paper ${variant}`}>
    <div className="about-paper-top"><span>SolveScript</span><span>9702 / PHYSICS</span></div>
    <span className="about-paper-eyebrow">SPACE TO THINK</span>
    <strong>Every mark<br />starts somewhere.</strong>
    <div className="about-paper-lines"><i /><i /><i /></div>
    <div className="about-paper-equation">F = ma <span>✓</span></div>
    <div className="about-paper-lines short"><i /><i /></div>
    <span className="about-paper-note">keep the working.</span>
    <div className="about-paper-footer"><span>YOUR NEXT CHAPTER</span><span>01</span></div>
  </div>;
}

function StoryScene() {
  return <div className="about-scene" aria-hidden="true">
    <div className="about-orbit about-orbit-one" /><div className="about-orbit about-orbit-two" />
    <span className="about-coordinate">27° / A LITTLE PERSPECTIVE</span>
    <div className="about-paper-world">
      <div className="about-loose-paper about-loose-one"><Paper variant="paper-blue" /></div>
      <div className="about-loose-paper about-loose-two"><Paper variant="paper-coral" /></div>
      <div className="about-main-paper"><Paper /></div>
      <div className="about-folder"><span className="about-folder-tab">YOUR COLLECTION</span><FolderOpen size={27} /><strong>Everything.<br />In its place.</strong><span>PAST PAPERS / POSSIBILITIES</span></div>
    </div>
    <div className="about-review-stamp"><Check size={17} /><span>Working, understood.</span></div>
    <div className="about-key-art"><img src="/media/about-review-key-v1.png" alt="" width="1024" height="1024" loading="lazy" decoding="async" /></div>
    <div className="about-key-label"><KeyRound size={16} /><span>Your key. Your call.</span></div>
    <div className="about-bird-art"><img src="/media/about-paper-bird-v1.png" alt="" width="1024" height="1024" loading="lazy" decoding="async" /></div>
    <div className="about-free-seal"><InfinityIcon size={28} /><span>ALWAYS FREE</span></div>
    <div className="about-scene-caption"><span>FROM A PILE OF PAPERS</span><i /><span>TO A LITTLE POSSIBILITY</span></div>
  </div>;
}

export default function AboutStory() {
  const journeyRef = useRef(null);

  useEffect(() => {
    const root = journeyRef.current;
    // Account restoration can mount this section after the browser's initial hash jump.
    const anchor = window.location.hash.slice(1);
    const anchorFrame = anchor === 'about' || chapters.some(({ id }) => id === anchor)
      ? requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'instant' }))
      : 0;
    const write = sceneStyleWriter(root.querySelector('.about-visual'));
    const writeProgress = sceneStyleWriter(root.querySelector('.about-journey-progress b'));
    const stop = observeScrollScene(root, { onProgress: (p) => {
      const gather = ease(p / .27);
      const practice = ease((p - .23) / .15);
      const review = ease((p - .48) / .16);
      const freedom = ease((p - .77) / .17);
      write('--about-progress', p);
      write('--gather', gather);
      write('--practice', practice);
      write('--review', review);
      write('--freedom', freedom);
      write('--key-opacity', review * (1 - freedom));
      write('--stamp-opacity', practice * (1 - freedom));
      writeProgress('--about-progress', p);
    } });
    return () => {
      stop();
      if (anchorFrame) cancelAnimationFrame(anchorFrame);
    };
  }, []);

  return <section id="about" className="about-story" aria-labelledby="about-heading">
    <div className="about-intro container">
      <div className="about-intro-meta"><span className="section-tag">01 / Inside SolveScript</span><span>A SMALL STUDIO. A BIGGER PICTURE.</span></div>
      <h2 id="about-heading">A little less friction.<br /><em>A lot more possibility.</em></h2>
      <div className="about-intro-bottom"><p>For the messy working, the lightbulb moments,<br className="about-desktop-break" /> and every paper in between. This space is yours.</p><a href="#about-organised">Unfold the story <ArrowDown size={17} aria-hidden="true" /></a></div>
    </div>
    <div className="about-journey" ref={journeyRef}>
      <div className="about-visual"><div className="about-world-backdrop" /><StoryScene /></div>
      <div className="about-chapters">
        {chapters.map((chapter, index) => { const { id, label, title, emphasis, body, detail, to, href, action, Icon } = chapter; return <article className="about-chapter" id={id} key={id} aria-labelledby={`${id}-heading`}>
          <div className="about-chapter-copy">
            <span className="about-chapter-label"><Icon size={16} aria-hidden="true" />{String(index + 1).padStart(2, '0')} / {label}</span>
            <h3 id={`${id}-heading`}>{title}<br /><em>{emphasis}</em></h3>
            <p>{body}</p><small>{detail}</small>
            {href ? <a className="about-story-link" href={href} target="_blank" rel="noreferrer">{action}<ArrowUpRight size={17} aria-hidden="true" /></a> : <Link className="about-story-link" to={to}>{action}<ArrowUpRight size={17} aria-hidden="true" /></Link>}
          </div>
        </article>; })}
      </div>
      <div className="about-journey-progress" aria-hidden="true"><span>UNFOLDING THE STUDIO</span><i><b /></i><span>01 — 04</span></div>
    </div>
    <div className="about-colophon container"><span><Code2 size={16} aria-hidden="true" /> Open by design.</span><span><InfinityIcon size={18} aria-hidden="true" /> Free by choice.</span><span><KeyRound size={16} aria-hidden="true" /> AI on your terms.</span></div>
  </section>;
}
