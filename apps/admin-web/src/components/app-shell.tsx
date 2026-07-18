'use client';

import { Button, ErrorState, IconButton, InlineNotice, Skeleton } from '@manglam/ui';
import {
  BellRing,
  Building2,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  UserRound,
  WifiOff,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from './auth-provider';
import { ALL_NAVIGATION_ITEMS, NAVIGATION, navigationLabel } from '@/lib/navigation';

function Brand() {
  return (
    <Link className="brand" href="/dashboard" aria-label="Manglam Balaji administration home">
      <span className="brand__mark" aria-hidden="true">
        <Building2 size={21} />
      </span>
      <span className="brand__copy">
        <strong>Manglam Balaji</strong>
        <small>Society operations</small>
      </span>
    </Link>
  );
}

function Navigation({ close }: { close?: () => void }) {
  const pathname = usePathname();
  const { can } = useAuth();

  return (
    <nav className="side-nav" aria-label="Primary navigation">
      {NAVIGATION.map((group) => {
        const items = group.items.filter((item) => can(item.permission));
        if (!items.length) return null;

        return (
          <div className="side-nav__group" key={group.label}>
            <p>{group.label}</p>
            {items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  className={active ? 'side-nav__item side-nav__item--active' : 'side-nav__item'}
                  href={item.href}
                  key={item.href}
                  {...(active ? { 'aria-current': 'page' as const } : {})}
                  {...(close ? { onClick: close } : {})}
                >
                  <Icon aria-hidden size={17} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

function SearchBox() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { can } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return [];
    return ALL_NAVIGATION_ITEMS.filter(
      (item) => can(item.permission) && item.label.toLowerCase().includes(value),
    ).slice(0, 7);
  }, [can, query]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    const first = results[0];
    if (first) {
      router.push(first.href);
      setOpen(false);
      setQuery('');
    }
  }

  return (
    <div className="global-search" ref={rootRef}>
      <form role="search" onSubmit={submit}>
        <Search size={17} aria-hidden />
        <label className="mb-sr-only" htmlFor="global-navigation-search">
          Find a dashboard page
        </label>
        <input
          id="global-navigation-search"
          type="search"
          value={query}
          placeholder="Find a page"
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
        />
      </form>
      {open && query ? (
        <div className="global-search__results" role="listbox">
          {results.length ? (
            results.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  type="button"
                  role="option"
                  aria-selected="false"
                  onClick={() => {
                    router.push(item.href);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <Icon size={16} aria-hidden />
                  {item.label}
                </button>
              );
            })
          ) : (
            <p>No accessible page matches that search.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="shell shell--loading" aria-label="Loading administration workspace">
      <aside className="sidebar">
        <Skeleton className="skeleton-brand" />
        {Array.from({ length: 9 }, (_, index) => (
          <Skeleton className="skeleton-nav" key={index} />
        ))}
      </aside>
      <div className="shell__main">
        <header className="topbar">
          <Skeleton className="skeleton-title" />
        </header>
        <main className="workspace">
          <Skeleton className="skeleton-heading" />
          <Skeleton className="skeleton-panel" />
        </main>
      </div>
    </div>
  );
}

export function AuthenticatedShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const { error, logout, refreshSession, status, user } = useAuth();

  useEffect(() => {
    const syncOnlineState = () => setOnline(navigator.onLine);
    queueMicrotask(syncOnlineState);
    window.addEventListener('online', syncOnlineState);
    window.addEventListener('offline', syncOnlineState);
    return () => {
      window.removeEventListener('online', syncOnlineState);
      window.removeEventListener('offline', syncOnlineState);
    };
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      const next = encodeURIComponent(pathname || '/dashboard');
      router.replace(`/login?next=${next}`);
    }
  }, [pathname, router, status]);

  if (status === 'loading') return <ShellSkeleton />;

  if (status === 'error') {
    return (
      <main className="standalone-state">
        <ErrorState
          title="Session verification failed"
          description={error?.message ?? 'The administration session could not be verified.'}
          correlationId={error?.correlationId}
          action={<Button onClick={() => void refreshSession()}>Try again</Button>}
        />
      </main>
    );
  }

  if (status !== 'authenticated' || !user) return <ShellSkeleton />;

  const displayName = user.displayName;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <Brand />
        </div>
        <Navigation />
        <div className="sidebar__footer">
          <Link href="/account/profile" className="sidebar-profile">
            <span aria-hidden>
              <UserRound size={18} />
            </span>
            <span>
              <strong>{displayName}</strong>
              <small>Account</small>
            </span>
            <ChevronDown size={15} aria-hidden />
          </Link>
        </div>
      </aside>

      {mobileOpen ? (
        <div className="mobile-nav" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button
            className="mobile-nav__backdrop"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="mobile-nav__panel">
            <div className="mobile-nav__header">
              <Brand />
              <IconButton label="Close navigation" onClick={() => setMobileOpen(false)}>
                <X size={19} />
              </IconButton>
            </div>
            <Navigation close={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="shell__main">
        <header className="topbar">
          <div className="topbar__start">
            <IconButton
              className="mobile-menu-button"
              label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} />
            </IconButton>
            <div className="topbar__title">
              <small>Manglam Balaji</small>
              <strong>{navigationLabel(pathname)}</strong>
            </div>
          </div>
          <SearchBox />
          <div className="topbar__actions">
            <Link
              className="topbar-icon-link"
              href="/emergencies"
              aria-label="Open emergency monitor"
              title="Emergency monitor"
            >
              <BellRing size={18} />
            </Link>
            <Button
              tone="quiet"
              size="sm"
              leadingIcon={<LogOut size={17} />}
              onClick={() => void logout()}
            >
              Sign out
            </Button>
          </div>
        </header>
        {!online ? (
          <InlineNotice className="offline-banner" tone="warning">
            <WifiOff size={17} aria-hidden />
            You are offline. Administrative changes are paused until the connection returns.
          </InlineNotice>
        ) : null}
        <main className="workspace" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
