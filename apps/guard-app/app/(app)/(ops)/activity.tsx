import { useQuery } from "@tanstack/react-query";
import { Activity as ActivityIcon } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { endpoints } from "@/api/endpoints";
import { ChoiceGroup } from "@/components/Controls";
import { RecordItem } from "@/components/Records";
import { Screen } from "@/components/Screen";
import { ErrorPanel, LoadingPanel, StatePanel } from "@/components/StatePanel";
import { PageTitle } from "@/components/Typography";
import { useConnectivity } from "@/connectivity/connectivity-context";
import { spacing } from "@/theme/tokens";
import type { ActivityEvent } from "@/types/domain";
import { formatDateTime } from "@/utils/date";

const filters = [
  { label: "All", secondaryLabel: "सभी", value: "ALL" },
  { label: "Visitors", secondaryLabel: "विज़िटर", value: "VISITOR" },
  { label: "Daily help", secondaryLabel: "सहायक", value: "DAILY_HELP" },
  { label: "Parcels", secondaryLabel: "पार्सल", value: "PARCEL" },
  { label: "Emergency", secondaryLabel: "आपातकाल", value: "EMERGENCY" }
] as const;

export default function ActivityScreen() {
  const router = useRouter();
  const connectivity = useConnectivity();
  const [category, setCategory] = useState<(typeof filters)[number]["value"]>("ALL");
  const activity = useQuery({
    enabled: connectivity.isOnline,
    queryFn: () => endpoints.activity({ category: category === "ALL" ? undefined : category }),
    queryKey: ["activity", category],
    refetchInterval: 15_000
  });

  function openEvent(event: ActivityEvent) {
    if (!event.entityId) return;
    if (event.category === "VISITOR") router.push({ pathname: "/visitor/[id]", params: { id: event.entityId } });
    else if (event.category === "DAILY_HELP") router.push({ pathname: "/daily-help/[id]", params: { id: event.entityId } });
    else if (event.category === "PARCEL") router.push({ pathname: "/parcel/[id]", params: { id: event.entityId } });
    else if (event.category === "EMERGENCY") router.push({ pathname: "/emergency/[id]", params: { id: event.entityId } });
    else if (event.category === "SYNC") router.push({ pathname: "/sync/[id]", params: { id: event.entityId } });
  }

  return (
    <Screen onRefresh={() => void activity.refetch()} refreshing={activity.isRefetching}>
      <PageTitle subtitle="Authoritative gate events returned by the server.">Gate activity / गेट गतिविधि</PageTitle>
      <ChoiceGroup label="Filter / फ़िल्टर" onChange={setCategory} options={filters} value={category} />
      {!connectivity.isOnline ? (
        <StatePanel detail="Reconnect to load the authoritative gate event history." title="Activity unavailable offline" tone="warning" />
      ) : activity.isLoading ? <LoadingPanel /> : activity.isError ? (
        <ErrorPanel message={(activity.error as Error).message} onRetry={() => void activity.refetch()} />
      ) : activity.data?.items.length === 0 ? <StatePanel detail="No activity matches this filter." title="No gate activity" /> : (
        <View style={styles.records}>
          {activity.data?.items.map((event) => {
            const opensDetail = !!event.entityId && ["VISITOR", "DAILY_HELP", "PARCEL", "EMERGENCY", "SYNC"].includes(event.category);
            return (
              <RecordItem
                detail={event.detail}
                icon={ActivityIcon}
                key={event.id}
                meta={formatDateTime(event.occurredAt)}
                onPress={opensDetail ? () => openEvent(event) : undefined}
                status={event.status}
                title={event.title}
              />
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ records: { gap: spacing.sm } });
