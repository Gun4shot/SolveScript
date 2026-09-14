import './PaperLoadingState.css';

export default function PaperLoadingState({ message = 'Opening the paper shelves…', tone = 'light' }) {
  return (
    <section className={`paper-library-loading ${tone}`} role="status" aria-live="polite">
      <div className="paper-loading-heading">
        <span className="paper-loading-mark" aria-hidden="true"><i /><i /><i /></span>
        <div><b>{message}</b><small>Arranging your paper folders</small></div>
      </div>
      <div className="paper-loading-grid" aria-hidden="true">
        {[0, 1, 2].map((item) => <article className="paper-loading-card" key={item}><i /><b /><span /><span /></article>)}
      </div>
    </section>
  );
}
