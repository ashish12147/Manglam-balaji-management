import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ProfileScreen, SessionsScreen } from '@/components/account-screens';
import { DashboardScreen } from '@/components/dashboard-screen';
import { NoticeEditor } from '@/components/notice-editor';
import { ResourceScreen } from '@/components/resource-screen';
import { SettingsScreen } from '@/components/settings-screen';
import { ADMIN_PATHS, RESOURCE_BY_PATH } from '@/lib/resource-config';

interface RouteProps {
  params: Promise<{ segments: string[] }>;
}

function pageTitle(path: string) {
  if (path === 'dashboard') return 'Dashboard';
  if (path === 'society/settings') return 'Society settings';
  if (path === 'communication/notices/new') return 'Create notice';
  if (path === 'account/profile') return 'Profile';
  if (path === 'account/sessions') return 'Sessions';
  return RESOURCE_BY_PATH.get(path)?.title ?? 'Administration';
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { segments } = await params;
  return { title: pageTitle(segments.join('/')) };
}

export default async function AdminRoute({ params }: RouteProps) {
  const { segments } = await params;
  const path = segments.join('/');
  if (!ADMIN_PATHS.has(path)) notFound();

  if (path === 'dashboard') return <DashboardScreen />;
  if (path === 'society/settings') return <SettingsScreen />;
  if (path === 'communication/notices/new') return <NoticeEditor />;
  if (path === 'account/profile') return <ProfileScreen />;
  if (path === 'account/sessions') return <SessionsScreen />;

  const config = RESOURCE_BY_PATH.get(path);
  if (!config) notFound();
  return <ResourceScreen resourceKey={config.key} />;
}
