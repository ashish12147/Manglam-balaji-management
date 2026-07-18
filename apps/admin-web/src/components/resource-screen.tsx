'use client';

import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  InlineNotice,
  PermissionState,
  Select,
  Skeleton,
  Surface,
} from '@manglam/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSearch,
  LockKeyhole,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import Link from 'next/link';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { useAuth } from './auth-provider';
import { PageHeader } from './page-header';
import { CreateRecordDialog, RecordActionDialog, RecordDetailDialog } from './resource-dialogs';
import { apiList, ApiError, isPermissionError } from '@/lib/api-client';
import type { ApiRecord } from '@/lib/api-types';
import type { BadgeTone } from '@manglam/ui';
import type { ColumnConfig, ResourceActionConfig, ResourceConfig } from '@/lib/resource-config';
import { RESOURCE_BY_KEY } from '@/lib/resource-config';

function nestedValue(record: ApiRecord, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, record);
}

function statusTone(value: string): BadgeTone {
  const normalized = value.toUpperCase();
  if (
    /(ACTIVE|APPROVED|PAID|COMPLETED|ISSUED|PUBLISHED|RESOLVED|CHECKED_OUT|COLLECTED|SUCCESS|CONFIRMED)/.test(
      normalized,
    )
  )
    return 'success';
  if (
    /(PENDING|AWAITING|EXPECTED|ARRIVED|PARTIALLY|PROCESSING|ACKNOWLEDGED|ASSIGNED|DRAFT|SCHEDULED)/.test(
      normalized,
    )
  )
    return 'warning';
  if (
    /(REJECTED|FAILED|SUSPENDED|DEACTIVATED|REVOKED|CANCELLED|EXPIRED|OVERDUE|VOIDED|FALSE_ALARM|DENIED)/.test(
      normalized,
    )
  )
    return 'danger';
  if (/(IN_PROGRESS|RESPONDING|CHECKED_IN|HELD)/.test(normalized)) return 'info';
  return 'neutral';
}

function formatValue(value: unknown, column: ColumnConfig): ReactNode {
  if (value === null || value === undefined || value === '')
    return <span className="muted-value">Not recorded</span>;
  if (column.format === 'status') {
    const label = String(value)
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/^./, (letter) => letter.toUpperCase());
    return <Badge tone={statusTone(String(value))}>{label}</Badge>;
  }
  if (column.format === 'boolean') return value ? 'Yes' : 'No';
  if (column.format === 'currency') {
    const amount = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(amount)
      ? new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 2,
        }).format(amount)
      : String(value);
  }
  if (column.format === 'date' || column.format === 'datetime') {
    const date = new Date(String(value));
    if (Number.isNaN(date.valueOf())) return String(value);
    return new Intl.DateTimeFormat(
      'en-IN',
      column.format === 'date'
        ? { dateStyle: 'medium' }
        : { dateStyle: 'medium', timeStyle: 'short' },
    ).format(date);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item !== 'object' || !item) return String(item);
        const record = item as Record<string, unknown>;
        return String(record.displayName ?? record.name ?? record.code ?? record.id ?? 'Recorded');
      })
      .join(', ');
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return String(
      record.displayName ??
        record.name ??
        record.code ??
        record.reference ??
        record.id ??
        'Recorded',
    );
  }
  return String(value);
}

function ResourceLoading({ columns }: { columns: number }) {
  return (
    <Surface className="data-surface">
      <div className="table-skeleton">
        {Array.from({ length: 8 }, (_, row) => (
          <div
            style={{ gridTemplateColumns: `repeat(${Math.max(2, columns)}, minmax(90px, 1fr))` }}
            key={row}
          >
            {Array.from({ length: Math.max(2, columns) }, (_, cell) => (
              <Skeleton key={cell} />
            ))}
          </div>
        ))}
      </div>
    </Surface>
  );
}

function RowActions({
  actions,
  can,
  onAction,
  onView,
}: {
  actions: ResourceActionConfig[];
  can: (permission?: string) => boolean;
  onAction: (action: ResourceActionConfig) => void;
  onView: () => void;
}) {
  const available = actions.filter((action) => can(action.permission));
  return (
    <div className="row-actions">
      <IconButton label="View details" size="sm" onClick={onView}>
        <Eye size={16} />
      </IconButton>
      {available.slice(0, 2).map((action) => (
        <Button
          key={action.key}
          size="sm"
          tone={action.tone === 'danger' ? 'quiet' : 'secondary'}
          onClick={() => onAction(action)}
        >
          {action.label}
        </Button>
      ))}
      {available.length > 2 ? (
        <details className="action-menu">
          <summary aria-label="More actions">More</summary>
          <div>
            {available.slice(2).map((action) => (
              <button type="button" key={action.key} onClick={() => onAction(action)}>
                {action.label}
              </button>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function RecordsTable({
  config,
  records,
  selectAction,
  selectDetail,
}: {
  config: ResourceConfig;
  records: ApiRecord[];
  selectAction: (record: ApiRecord, action: ResourceActionConfig) => void;
  selectDetail: (record: ApiRecord) => void;
}) {
  const { can } = useAuth();
  const actions = config.actions ?? [];
  return (
    <Surface className="data-surface">
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {config.columns.map((column) => (
                <th key={column.key} scope="col">
                  {column.label}
                </th>
              ))}
              <th scope="col" className="data-table__actions">
                <span className="mb-sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                {config.columns.map((column) => (
                  <td key={column.key}>{formatValue(nestedValue(record, column.key), column)}</td>
                ))}
                <td className="data-table__actions">
                  <RowActions
                    actions={actions}
                    can={can}
                    onView={() => selectDetail(record)}
                    onAction={(action) => selectAction(record, action)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mobile-records">
        {records.map((record) => (
          <article className="mobile-record" key={record.id}>
            <div className="mobile-record__fields">
              {config.columns.slice(0, 6).map((column) => (
                <div className="mobile-record__field" key={column.key}>
                  <small>{column.label}</small>
                  <span>{formatValue(nestedValue(record, column.key), column)}</span>
                </div>
              ))}
            </div>
            <RowActions
              actions={actions}
              can={can}
              onView={() => selectDetail(record)}
              onAction={(action) => selectAction(record, action)}
            />
          </article>
        ))}
      </div>
    </Surface>
  );
}

function ResourceScreenContent({ config }: { config: ResourceConfig }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<ApiRecord | null>(null);
  const [actionRecord, setActionRecord] = useState<ApiRecord | null>(null);
  const [selectedAction, setSelectedAction] = useState<ResourceActionConfig | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['resource', config.endpoint, config.baseQuery, search, status, cursor],
    queryFn: ({ signal }) =>
      apiList<ApiRecord>(
        config.endpoint,
        {
          ...config.baseQuery,
          q: search,
          status,
          cursor,
          limit: 25,
        },
        signal,
      ),
    enabled: can(config.permission),
  });

  const filtered = Boolean(search || status);
  const error = listQuery.error instanceof ApiError ? listQuery.error : null;
  const records = listQuery.data?.items ?? [];

  const resultLabel = useMemo(() => {
    if (!listQuery.data) return '';
    return listQuery.data.total === null
      ? `Showing ${records.length} record${records.length === 1 ? '' : 's'}`
      : `${listQuery.data.total.toLocaleString('en-IN')} record${listQuery.data.total === 1 ? '' : 's'}`;
  }, [listQuery.data, records.length]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setCursor(null);
    setCursorHistory([]);
    setSearch(searchInput.trim());
  }

  function clearFilters() {
    setSearchInput('');
    setSearch('');
    setStatus('');
    setCursor(null);
    setCursorHistory([]);
  }

  async function mutationSucceeded(message: string) {
    setCreateOpen(false);
    setSelectedAction(null);
    setActionRecord(null);
    setSuccess(message);
    await queryClient.invalidateQueries({ queryKey: ['resource', config.endpoint] });
  }

  const primaryAction = config.createHref ? (
    <Link className="button-link" href={config.createHref}>
      <Plus size={17} aria-hidden />
      Create notice
    </Link>
  ) : config.create && can(config.create.permission) ? (
    <Button leadingIcon={<Plus size={17} />} onClick={() => setCreateOpen(true)}>
      {config.create.label}
    </Button>
  ) : null;

  return (
    <>
      <PageHeader
        eyebrow={config.eyebrow}
        title={config.title}
        description={config.description}
        actions={primaryAction}
      />
      <div className="page-content">
        {success ? (
          <InlineNotice tone="success">
            <span>{success}</span>
            <button className="notice-dismiss" type="button" onClick={() => setSuccess(null)}>
              Dismiss
            </button>
          </InlineNotice>
        ) : null}

        {!can(config.permission) ? (
          <Surface className="page-state-surface">
            <PermissionState
              icon={<LockKeyhole />}
              title="Permission required"
              description="Your account does not have permission to view this administration area."
            />
          </Surface>
        ) : (
          <>
            <div className="toolbar">
              <form className="toolbar__filters" onSubmit={submitSearch}>
                <label className="search-control">
                  <Search size={16} aria-hidden />
                  <span className="mb-sr-only">Search {config.title}</span>
                  <input
                    type="search"
                    value={searchInput}
                    placeholder={config.searchPlaceholder ?? 'Search records'}
                    onChange={(event) => setSearchInput(event.target.value)}
                  />
                </label>
                {config.statusOptions?.length ? (
                  <Select
                    aria-label="Filter by status"
                    value={status}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                      setStatus(event.target.value);
                      setCursor(null);
                      setCursorHistory([]);
                    }}
                  >
                    <option value="">All statuses</option>
                    {config.statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                ) : null}
                <Button
                  tone="secondary"
                  size="sm"
                  type="submit"
                  leadingIcon={<SlidersHorizontal size={15} />}
                >
                  Apply
                </Button>
                {filtered ? (
                  <Button tone="quiet" size="sm" type="button" onClick={clearFilters}>
                    Clear
                  </Button>
                ) : null}
              </form>
              <div className="toolbar__actions">
                <IconButton
                  label="Refresh records"
                  onClick={() => void listQuery.refetch()}
                  disabled={listQuery.isFetching}
                >
                  <RefreshCw size={17} />
                </IconButton>
              </div>
            </div>

            {listQuery.isLoading ? (
              <ResourceLoading columns={config.columns.length} />
            ) : error ? (
              <Surface className="page-state-surface">
                {isPermissionError(error) ? (
                  <PermissionState
                    icon={<LockKeyhole />}
                    title="Access denied by the server"
                    description={error.message}
                  />
                ) : (
                  <ErrorState
                    icon={<AlertTriangle />}
                    title="Records could not be loaded"
                    description={error.message}
                    correlationId={error.correlationId}
                    action={<Button onClick={() => void listQuery.refetch()}>Try again</Button>}
                  />
                )}
              </Surface>
            ) : records.length ? (
              <>
                <RecordsTable
                  config={config}
                  records={records}
                  selectDetail={setDetailRecord}
                  selectAction={(record, action) => {
                    setActionRecord(record);
                    setSelectedAction(action);
                  }}
                />
                <div className="data-footer">
                  <p>{resultLabel}</p>
                  <div className="data-footer__buttons">
                    <Button
                      tone="secondary"
                      size="sm"
                      disabled={!cursorHistory.length}
                      leadingIcon={<ChevronLeft size={15} />}
                      onClick={() => {
                        const history = [...cursorHistory];
                        const previous = history.pop() ?? null;
                        setCursorHistory(history);
                        setCursor(previous);
                      }}
                    >
                      Previous
                    </Button>
                    <Button
                      tone="secondary"
                      size="sm"
                      disabled={!listQuery.data?.nextCursor}
                      trailingIcon={<ChevronRight size={15} />}
                      onClick={() => {
                        if (!listQuery.data?.nextCursor) return;
                        setCursorHistory((history) => [...history, cursor]);
                        setCursor(listQuery.data.nextCursor);
                      }}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <Surface className="page-state-surface">
                <EmptyState
                  icon={<FileSearch />}
                  title={filtered ? 'No matching records' : config.emptyTitle}
                  description={
                    filtered
                      ? 'No records match the current search and status filters.'
                      : config.emptyDescription
                  }
                  action={
                    filtered ? (
                      <Button tone="secondary" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    ) : (
                      primaryAction
                    )
                  }
                />
              </Surface>
            )}
          </>
        )}
      </div>

      {config.create ? (
        <CreateRecordDialog
          config={config.create}
          resourceEndpoint={config.endpoint}
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSuccess={(message) => void mutationSucceeded(message)}
        />
      ) : null}
      <RecordDetailDialog
        config={config}
        record={detailRecord}
        open={Boolean(detailRecord)}
        onClose={() => setDetailRecord(null)}
      />
      <RecordActionDialog
        action={selectedAction}
        record={actionRecord}
        resourceEndpoint={config.endpoint}
        open={Boolean(selectedAction && actionRecord)}
        onClose={() => {
          setSelectedAction(null);
          setActionRecord(null);
        }}
        onSuccess={(message) => void mutationSucceeded(message)}
      />
    </>
  );
}

export function ResourceScreen({ resourceKey }: { resourceKey: string }) {
  const config = RESOURCE_BY_KEY.get(resourceKey);
  if (!config) return null;
  return <ResourceScreenContent config={config} />;
}
