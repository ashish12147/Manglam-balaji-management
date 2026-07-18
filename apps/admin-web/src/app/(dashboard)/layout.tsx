import type { ReactNode } from 'react';

import { AuthenticatedShell } from '@/components/app-shell';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
