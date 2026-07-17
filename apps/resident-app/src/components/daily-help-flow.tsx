import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Field, PageHeader, Pill, QueryState, Row, Screen, Section } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useApiQuery } from '@/lib/query';
import { dailyHelpApi } from '@/lib/resident-api';
import { useConnectivity } from '@/providers/ConnectivityProvider';
import { colors, spacing, typography } from '@/theme/tokens';

export function DailyHelpManagementScreen() {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const assigned = useApiQuery(['daily-help'], () => dailyHelpApi.list({ limit: 50 }));
  const directory = useApiQuery(
    ['daily-help-directory', search],
    () => dailyHelpApi.directory(search),
    { enabled: search.trim().length >= 2 },
  );
  const assign = useMutation({
    mutationFn: (id: string) =>
      dailyHelpApi.assign(id, {
        allowedDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
        notes: 'Assigned by resident',
      }),
    onSettled: () => void client.invalidateQueries({ queryKey: ['daily-help'] }),
  });
  const end = useMutation({
    mutationFn: dailyHelpApi.endAssignment,
    onSettled: () => void client.invalidateQueries({ queryKey: ['daily-help'] }),
  });
  const c = useConnectivity();
  const view = {
    error: assigned.error,
    isLoading: assigned.isLoading,
    isOffline: c.isResolved && !c.isOnline,
    onRetry: () => void assigned.refetch(),
  };
  return (
    <Screen>
      <PageHeader
        subtitle="Assignments and access rules are enforced by the server."
        title="Manage daily help"
      />
      <QueryState {...view}>
        <Section title="Assigned to this home">
          {(assigned.data?.items.length ?? 0) === 0 ? (
            <Row
              detail="No daily-help profile is assigned to this home."
              title="No assigned daily help"
            />
          ) : (
            assigned.data?.items.map((helper) => (
              <View key={helper.id}>
                <Row detail={helper.allowedDays.join(', ')} title={helper.name}>
                  <Pill
                    label={helper.status}
                    tone={helper.status === 'ACTIVE' ? 'success' : 'warning'}
                  />
                </Row>
                <Button
                  disabled={end.isPending}
                  onPress={() => end.mutate(helper.id)}
                  tone="secondary"
                >
                  End assignment
                </Button>
              </View>
            ))
          )}
          {end.error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {errorMessage(end.error)}
            </Text>
          ) : null}
        </Section>
        <Section title="Find registered help">
          <View style={styles.form}>
            <Field
              label="Search by name"
              onChangeText={setSearch}
              placeholder="Type at least 2 characters"
              value={search}
            />
            {search.trim().length < 2 ? (
              <Row
                detail="Search only queries the society directory after two characters."
                title="Search directory"
              />
            ) : (
              <QueryState
                error={directory.error}
                isLoading={directory.isLoading}
                isOffline={c.isResolved && !c.isOnline}
                onRetry={() => void directory.refetch()}
              >
                {(directory.data?.items.length ?? 0) === 0 ? (
                  <Row detail="No registered profile matches this search." title="No matches" />
                ) : (
                  directory.data?.items.map((helper) => (
                    <Row detail={helper.type} key={helper.id} title={helper.name}>
                      <Button
                        disabled={assign.isPending}
                        onPress={() => assign.mutate(helper.id)}
                        tone="secondary"
                      >
                        Assign
                      </Button>
                    </Row>
                  ))
                )}
              </QueryState>
            )}
            {assign.error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {errorMessage(assign.error)}
              </Text>
            ) : null}
          </View>
        </Section>
      </QueryState>
    </Screen>
  );
}
const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: typography.caption },
  form: { gap: spacing.md, paddingVertical: spacing.md },
});
