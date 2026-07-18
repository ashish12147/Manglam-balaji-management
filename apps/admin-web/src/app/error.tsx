'use client';

import { Button, ErrorState } from '@manglam/ui';
import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin route error', error);
  }, [error]);

  return (
    <div className="page-state-surface">
      <ErrorState
        icon={<AlertTriangle />}
        title="This page could not be loaded"
        description="The dashboard encountered an unexpected error. Your submitted data has not been confirmed."
        correlationId={error.digest}
        action={<Button onClick={reset}>Try again</Button>}
      />
    </div>
  );
}
