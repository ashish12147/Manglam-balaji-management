'use client';

import { Button, EmptyState, ErrorState, PermissionState, Skeleton, Surface } from '@manglam/ui';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BellRing,
  ClipboardList,
  FileCheck2,
  IndianRupee,
  LockKeyhole,
  Megaphone,
  ShieldCheck,
  Siren,
  UserCheck,
} from 'lucide-react';
import Link from 'next/link';

import { useAuth } from './auth-provider';
import { PageHeader } from './page-header';
import { apiData, ApiError, isPermissionError } from '@/lib/api-client';
import type { ApiRecord, DashboardSummary } from '@/lib/api-types';

function metricValue(value: number | string | undefined, currency = false) {
  if (value === undefined) return 'Not reported';
  if (currency) {
    const amount = Number(value);
    return Number.isFinite(amount)
      ? new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 0,
        }).format(amount)
      : String(value);
  }
  return typeof value === 'number' ? value.toLocaleString('en-IN') : value;
}

function DashboardLoading() {
  return (
    <div className="page-content">
      <div className="summary-grid">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton className="skeleton-summary" key={index} />
        ))}
      </div>
      <div className="dashboard-grid">
        <Skeleton className="skeleton-panel" />
        <Skeleton className="skeleton-panel" />
      </div>
    </div>
  );
}

function ActivityList({ items }: { items: ApiRecord[] }) {
  if (!items.length) {
    return (
      <EmptyState
        icon={<Activity />}
        title="No recent gate activity"
        description="Live gate events will appear here after guards record access activity."
      />
    );
  }

  return (
    <div className="activity-list">
      {items.slice(0, 8).map((item) => {
        const title = String(
          item.title ?? item.visitorName ?? item.type ?? item.reference ?? 'Gate event',
        );
        const detail = String(
          item.detail ?? item.flatDisplayName ?? item.gateName ?? 'Recorded by the access system',
        );
        const timeValue = item.occurredAt ?? item.createdAt;
        const time = timeValue ? new Date(String(timeValue)) : null;
        return (
          <article key={item.id}>
            <span className="activity-list__icon" aria-hidden>
              <ShieldCheck size={16} />
            </span>
            <div>
              <strong>{title}</strong>
              <p>{detail}</p>
            </div>
            <time dateTime={time?.toISOString()}>
              {time && !Number.isNaN(time.valueOf())
                ? new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(
                    time,
                  )
                : 'Time unavailable'}
            </time>
          </article>
        );
      })}
    </div>
  );
}

export function DashboardScreen() {
  const { can } = useAuth();
  const query = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => apiData<DashboardSummary>('/admin/dashboard'),
    enabled: can('dashboard.read'),
    refetchInterval: 15_000,
  });

  if (!can('dashboard.read')) {
    return (
      <Surface className="page-state-surface">
        <PermissionState
          icon={<LockKeyhole />}
          title="Dashboard permission required"
          description="Your account cannot view the society operations summary."
        />
      </Surface>
    );
  }

  const error = query.error instanceof ApiError ? query.error : null;
  const data = query.data;

  return (
    <>
      <PageHeader
        eyebrow="Operations overview"
        title="Society dashboard"
        description="Live priorities across gate access, residents, service requests, safety, and maintenance."
        actions={
          <Button tone="secondary" onClick={() => void query.refetch()} loading={query.isFetching}>
            Refresh
          </Button>
        }
      />

      {query.isLoading ? (
        <DashboardLoading />
      ) : error ? (
        <Surface className="page-state-surface">
          {isPermissionError(error) ? (
            <PermissionState
              icon={<LockKeyhole />}
              title="Dashboard access denied"
              description={error.message}
            />
          ) : (
            <ErrorState
              icon={<AlertTriangle />}
              title="Dashboard could not be loaded"
              description={error.message}
              correlationId={error.correlationId}
              action={<Button onClick={() => void query.refetch()}>Try again</Button>}
            />
          )}
        </Surface>
      ) : data ? (
        <div className="page-content">
          <div className="summary-grid">
            <Link href="/access/visits">
              <Surface className="summary-card">
                <span className="summary-card__icon">
                  <Activity size={18} />
                </span>
                <p className="summary-card__value">{metricValue(data.activeGateActivity)}</p>
                <p className="summary-card__label">Active gate activity</p>
              </Surface>
            </Link>
            <Link href="/people/approvals">
              <Surface className="summary-card summary-card--warning">
                <span className="summary-card__icon">
                  <UserCheck size={18} />
                </span>
                <p className="summary-card__value">{metricValue(data.pendingResidentApprovals)}</p>
                <p className="summary-card__label">Resident approvals</p>
              </Surface>
            </Link>
            <Link href="/emergencies">
              <Surface className="summary-card summary-card--danger">
                <span className="summary-card__icon">
                  <Siren size={18} />
                </span>
                <p className="summary-card__value">{metricValue(data.activeEmergencies)}</p>
                <p className="summary-card__label">Active emergencies</p>
              </Surface>
            </Link>
            <Link href="/complaints">
              <Surface className="summary-card summary-card--info">
                <span className="summary-card__icon">
                  <ClipboardList size={18} />
                </span>
                <p className="summary-card__value">{metricValue(data.openComplaints)}</p>
                <p className="summary-card__label">Open complaints</p>
              </Surface>
            </Link>
            <Link href="/access/visits">
              <Surface className="summary-card">
                <span className="summary-card__icon">
                  <FileCheck2 size={18} />
                </span>
                <p className="summary-card__value">{metricValue(data.recentVisitorActivity)}</p>
                <p className="summary-card__label">Recent visitor records</p>
              </Surface>
            </Link>
            <Link href="/maintenance/dues">
              <Surface className="summary-card summary-card--warning">
                <span className="summary-card__icon">
                  <IndianRupee size={18} />
                </span>
                <p className="summary-card__value">{metricValue(data.unpaidMaintenanceDues)}</p>
                <p className="summary-card__label">Unpaid dues</p>
              </Surface>
            </Link>
            <Link href="/maintenance/dues">
              <Surface className="summary-card">
                <span className="summary-card__icon">
                  <IndianRupee size={18} />
                </span>
                <p className="summary-card__value">
                  {metricValue(data.unpaidMaintenanceAmount, true)}
                </p>
                <p className="summary-card__label">Outstanding amount</p>
              </Surface>
            </Link>
            <Link href="/administration/audit">
              <Surface className="summary-card summary-card--danger">
                <span className="summary-card__icon">
                  <BellRing size={18} />
                </span>
                <p className="summary-card__value">{metricValue(data.auditAlerts)}</p>
                <p className="summary-card__label">Audit warnings</p>
              </Surface>
            </Link>
          </div>

          <div className="dashboard-grid">
            <Surface>
              <div className="panel-header">
                <div>
                  <h2>Recent gate activity</h2>
                  <p>Latest records returned by the access service</p>
                </div>
                <Link className="panel-link" href="/access/visits">
                  View full log
                </Link>
              </div>
              <ActivityList items={data.recentGateActivity ?? []} />
            </Surface>
            <Surface>
              <div className="panel-header">
                <div>
                  <h2>Priority actions</h2>
                  <p>Authorised operational shortcuts</p>
                </div>
              </div>
              <div className="quick-actions">
                {can('membership.approve') ? (
                  <Link className="quick-action" href="/people/approvals">
                    <span>
                      <UserCheck size={17} />
                    </span>
                    <span>
                      <strong>Review residents</strong>
                      <small>Verify pending memberships</small>
                    </span>
                    <ArrowRight size={15} />
                  </Link>
                ) : null}
                {can('notice.create') ? (
                  <Link className="quick-action" href="/communication/notices/new">
                    <span>
                      <Megaphone size={17} />
                    </span>
                    <span>
                      <strong>Draft a notice</strong>
                      <small>Target residents and flats</small>
                    </span>
                    <ArrowRight size={15} />
                  </Link>
                ) : null}
                {can('emergency.read_all') ? (
                  <Link className="quick-action" href="/emergencies">
                    <span>
                      <Siren size={17} />
                    </span>
                    <span>
                      <strong>Emergency monitor</strong>
                      <small>Review response timelines</small>
                    </span>
                    <ArrowRight size={15} />
                  </Link>
                ) : null}
                {can('audit.read') ? (
                  <Link className="quick-action" href="/administration/audit">
                    <span>
                      <ShieldCheck size={17} />
                    </span>
                    <span>
                      <strong>Review audit log</strong>
                      <small>Inspect security-sensitive events</small>
                    </span>
                    <ArrowRight size={15} />
                  </Link>
                ) : null}
              </div>
            </Surface>
          </div>
        </div>
      ) : (
        <Surface className="page-state-surface">
          <EmptyState
            icon={<Activity />}
            title="Dashboard data is unavailable"
            description="The server returned no dashboard summary. Refresh after the administration API is ready."
            action={<Button onClick={() => void query.refetch()}>Refresh</Button>}
          />
        </Surface>
      )}
    </>
  );
}
