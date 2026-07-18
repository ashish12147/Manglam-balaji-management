import { useQuery } from "@tanstack/react-query";
import { UsersRound } from "lucide-react-native";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { endpoints } from "@/api/endpoints";
import { RecordItem } from "@/components/Records";
import { Screen } from "@/components/Screen";
import { ErrorPanel, LoadingPanel, StatePanel } from "@/components/StatePanel";
import { PageTitle } from "@/components/Typography";
import { useConnectivity } from "@/connectivity/connectivity-context";
import { spacing } from "@/theme/tokens";
import { formatDateTime } from "@/utils/date";
import { humanizeConstant } from "@/utils/text";

export default function ActiveVisitorsScreen() {
  const router = useRouter();
  const connectivity = useConnectivity();
  const visits = useQuery({
    enabled: connectivity.isOnline,
    queryFn: () => endpoints.visitorList("AWAITING_APPROVAL,APPROVED,CHECKED_IN"),
    queryKey: ["visitors", "active"],
    refetchInterval: 5_000
  });
  return (
    <Screen onRefresh={() => void visits.refetch()} refreshing={visits.isRefetching}>
      <PageTitle subtitle="Approval requests, admitted visitors, and visitors currently inside.">
        Active visits / सक्रिय विज़िटर
      </PageTitle>
      {!connectivity.isOnline ? (
        <StatePanel detail="Reconnect to load the authoritative active-visit list." title="Active visits unavailable offline" tone="warning" />
      ) : visits.isLoading ? (
        <LoadingPanel />
      ) : visits.isError ? (
        <ErrorPanel message={(visits.error as Error).message} onRetry={() => void visits.refetch()} />
      ) : visits.data?.items.length === 0 ? (
        <StatePanel detail="No approval is pending and no visitor is currently inside." title="No active visits" />
      ) : (
        <View style={styles.records}>
          {visits.data?.items.map((visit) => (
            <RecordItem
              detail={`${visit.flat.displayLabel} • ${humanizeConstant(visit.category)}`}
              icon={UsersRound}
              key={visit.id}
              meta={formatDateTime(visit.arrivedAt ?? visit.createdAt)}
              onPress={() => router.push({ pathname: "/visitor/[id]", params: { id: visit.id } })}
              status={humanizeConstant(visit.status)}
              statusTone={visit.status === "CHECKED_IN" ? "success" : "warning"}
              title={visit.visitorName}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ records: { gap: spacing.sm } });
