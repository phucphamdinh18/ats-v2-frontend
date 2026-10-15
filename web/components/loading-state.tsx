/** A predictable loading layout; placeholder content stays out of the accessibility tree. */
export default function LoadingState({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div className="loading-state" role="status">
      <div className="loading-caption"><span className="spinner" aria-hidden="true" />{label}</div>
      <div className="skeleton-list" aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
          <div className="skeleton-row" key={index}>
            <span className="skeleton-avatar" />
            <span className="skeleton-copy"><span /><span /></span>
          </div>
        ))}
      </div>
    </div>
  );
}
