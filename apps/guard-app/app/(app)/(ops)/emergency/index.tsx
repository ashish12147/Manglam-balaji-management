import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react-native";
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

export default function EmergencyListScreen() {
  const router = useRouter();
  const connectivity = useConnectivity();
  const alerts = useQuery({
    enabled: connectivity.isOnline,
    queryFn: endpoints.activeEmergencies,
    queryKey: ["emergencies", "active"],
    refetchInterval: 5_000
  });
  return (
    <Screen onRefresh={() => void alerts.refetch()} refreshing={alerts.isRefetching}>
      <PageTitle subtitle="Acknowledge immediately, then update the live response status.">
        Emergency alerts / आपातकालीन अलर्ट
      </PageTitle>
      {!connectivity.isOnline ? (
        <StatePanel detail="The live emergency list needs the server. Alerts already open on this device can still store an offline acknowledgement." title="Emergency feed offline" tone="critical" />
      ) : alerts.isLoading ? (
        <LoadingPanel label="Loading active emergency alerts…" />
      ) : alerts.isError ? (
        <ErrorPanel message={(alerts.error as Error).message} onRetry={() => void alerts.refetch()} />
      ) : alerts.data?.items.length === 0 ? (
        <StatePanel detail="There are no active emergency alerts for this gate." title="No active emergency" />
      ) : (
        <View style={styles.records}>
          {alerts.data?.items.map((alert) => (
            <RecordItem
              detail={`${alert.flat.displayLabel} • ${alert.residentDisplayName}`}
              icon={AlertTriangle}
              key={alert.id}
              meta={formatDateTime(alert.createdAt)}
              onPress={() => router.push({ pathname: "/emergency/[id]", params: { id: alert.id } })}
              status={humanizeConstant(alert.status)}
              statusTone="critical"
              title={humanizeConstant(alert.category)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ records: { gap: spacing.sm } });
