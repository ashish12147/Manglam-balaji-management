import type { Metadata } from 'next';
import { Suspense } from 'react';

import { LoginScreen } from '@/components/login-screen';

export const metadata: Metadata = { title: 'Administrator sign in' };

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="auth-page" aria-label="Loading sign in" />}>
      <LoginScreen />
    </Suspense>
  );
}
