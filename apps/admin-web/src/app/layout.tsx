import '@manglam/ui/styles.css';
import './globals.css';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: {
    default: 'Manglam Balaji Administration',
    template: '%s | Manglam Balaji',
  },
  description: 'Secure society operations dashboard for Manglam Balaji Society.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#176b5b',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
