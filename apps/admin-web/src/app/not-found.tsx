import { EmptyState } from '@manglam/ui';
import { FileQuestion } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="standalone-state" id="main-content">
      <EmptyState
        icon={<FileQuestion />}
        title="Page not found"
        description="This administration page does not exist or is no longer available."
        action={
          <Link className="button-link" href="/dashboard">
            Return to dashboard
          </Link>
        }
      />
    </main>
  );
}
