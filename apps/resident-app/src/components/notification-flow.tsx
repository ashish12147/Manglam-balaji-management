import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import {
  Button,
  PageHeader,
  Pill,
  QueryState,
  RefreshAction,
  Row,
  Screen,
  Section,
} from '@/components/ui';
import { useApiQuery } from '@/lib/query';
import { isSafeInternalRoute } from '@/lib/links';
import { notificationApi } from '@/lib/resident-api';
import { useConnectivity } from '@/providers/ConnectivityProvider';
import { formatDateTime } from '@/lib/format';

export function NotificationScreen() {
  const client = useQueryClient();
  const notifications = useApiQuery(['notifications'], () => notificationApi.list({ limit: 50 }));
  const read = useMutation({
    mutationFn: notificationApi.markRead,
    onSettled: () => void client.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const all = useMutation({
    mutationFn: notificationApi.markAllRead,
    onSettled: () => void client.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const c = useConnectivity();
  const view = {
    error: notifications.error,
    isLoading: notifications.isLoading,
    isOffline: c.isResolved && !c.isOnline,
    onRetry: () => void notifications.refetch(),
  };
  const open = (id: string, link: string | null) => {
    read.mutate(id);
    if (!link) return;
    if (isSafeInternalRoute(link)) router.push(link as never);
  };
  return (
    <Screen>
      <PageHeader
        action={<RefreshAction onPress={() => void notifications.refetch()} />}
        title="Notifications"
      />
      <Button disabled={all.isPending} onPress={() => all.mutate()} tone="secondary">
        Mark all read
      </Button>
      <QueryState {...view}>
        <Section>
          {(notifications.data?.items.length ?? 0) === 0 ? (
            <Row detail="There are no notifications for this account." title="No notifications" />
          ) : (
            notifications.data?.items.map((item) => (
              <Row
                detail={formatDateTime(item.createdAt) + '. ' + item.body}
                key={item.id}
                onPress={() => void open(item.id, item.deepLink)}
                title={item.title}
              >
                <Pill
                  label={item.readAt ? 'Read' : item.category}
                  tone={item.readAt ? 'neutral' : 'warning'}
                />
              </Row>
            ))
          )}
        </Section>
      </QueryState>
    </Screen>
  );
}
