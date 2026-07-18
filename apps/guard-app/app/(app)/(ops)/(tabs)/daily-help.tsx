import { useQuery } from "@tanstack/react-query";
import { Search, UserRoundCheck } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, TextInput, View } from "react-native";

import { endpoints } from "@/api/endpoints";
import { RecordItem } from "@/components/Records";
import { Screen } from "@/components/Screen";
import { ErrorPanel, LoadingPanel, StatePanel } from "@/components/StatePanel";
import { StatusBadge } from "@/components/Status";
import { PageTitle } from "@/components/Typography";
import { useConnectivity } from "@/connectivity/connectivity-context";
import { useSync } from "@/offline/sync-context";
import { colors, control, radii, spacing, typography } from "@/theme/tokens";
import type { DailyHelpDirectoryItem } from "@/types/domain";
import { humanizeConstant } from "@/utils/text";

export default function DailyHelpScreen() {
  const router = useRouter();
  const connectivity = useConnectivity();
  const sync = useSync();
  const [search, setSearch] = useState("");
  const [offlineItems, setOfflineItems] = useState<DailyHelpDirectoryItem[]>([]);
  const [snapshotExpired, setSnapshotExpired] = useState(false);
  const helpers = useQuery({
    enabled: connectivity.isOnline,
    queryFn: () => endpoints.dailyHelp(search),
    queryKey: ["daily-help", search],
    refetchInterval: 30_000
  });

  useEffect(() => {
    if (connectivity.isOnline) return;
    let active = true;
    void sync.searchDailyHelp(search).then((result) => {
      if (!active) return;
      setOfflineItems(result.items);
      setSnapshotExpired(result.isExpired);
    });
    return () => {
      active = false;
    };
  }, [connectivity.isOnline, search, sync]);

  const items = useMemo(
    () => (connectivity.isOnline ? helpers.data?.items ?? [] : offlineItems),
    [connectivity.isOnline, helpers.data?.items, offlineItems]
  );

  return (
    <Screen onRefresh={() => void helpers.refetch()} refreshing={helpers.isRefetching}>
      <View style={styles.heading}>
        <PageTitle subtitle="Verify the helper and permitted flats before attendance.">
          Daily help / दैनिक सहायक
        </PageTitle>
        <StatusBadge
          label={connectivity.isOnline ? "LIVE DIRECTORY" : "OFFLINE SNAPSHOT"}
          tone={connectivity.isOnline ? "success" : "warning"}
        />
      </View>
      <View style={styles.searchBox}>
        <Search color={colors.muted} size={22} />
        <TextInput
          accessibilityLabel="Search daily help name or type"
          onChangeText={setSearch}
          placeholder="Name or helper type"
          placeholderTextColor={colors.disabled}
          style={styles.input}
          value={search}
        />
        {helpers.isFetching && connectivity.isOnline ? <ActivityIndicator color={colors.primary} /> : null}
      </View>
      {connectivity.isOnline && helpers.isLoading ? <LoadingPanel /> : null}
      {connectivity.isOnline && helpers.isError ? (
        <ErrorPanel message={(helpers.error as Error).message} onRetry={() => void helpers.refetch()} />
      ) : null}
      {!connectivity.isOnline && snapshotExpired ? (
        <StatePanel
          detail="The 24-hour helper snapshot lease has expired. Reconnect before searching or recording attendance."
          title="Offline directory expired"
          tone="critical"
        />
      ) : items.length === 0 && !helpers.isLoading ? (
        <StatePanel detail="No active daily-help profile matches this search." title="No helper found" />
      ) : (
        <View style={styles.records}>
          {items.map((helper) => (
            <RecordItem
              detail={`${humanizeConstant(helper.type)} • ${helper.allowedFlatLabels.join(", ") || "No active flat assignment"}`}
              icon={UserRoundCheck}
              key={helper.id}
              meta={helper.accessWindow ?? undefined}
              onPress={() => router.push({ pathname: "/daily-help/[id]", params: { id: helper.id } })}
              status={helper.status}
              statusTone={helper.status === "ACTIVE" ? "success" : "critical"}
              title={helper.name}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  input: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.body,
    minHeight: control.minHeight - 2
  },
  records: {
    gap: spacing.sm
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: control.minHeight,
    paddingHorizontal: spacing.md
  }
});
