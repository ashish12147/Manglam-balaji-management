import { Skeleton } from '@manglam/ui';

export default function Loading() {
  return (
    <div className="route-loading" aria-label="Loading page">
      <Skeleton className="skeleton-heading" />
      <div className="summary-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="skeleton-summary" key={index} />
        ))}
      </div>
      <Skeleton className="skeleton-panel" />
    </div>
  );
}
