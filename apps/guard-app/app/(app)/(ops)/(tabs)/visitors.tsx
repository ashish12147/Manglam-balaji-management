import { useQuery } from "@tanstack/react-query";
import { Clock3, ScanLine, UserPlus, UsersRound } from "lucide-react-native";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { endpoints } from "@/api/endpoints";
import { ActionButton } from "@/components/Controls";
import { RecordItem } from "@/components/Records";
import { Screen } from "@/components/Screen";
import { ErrorPanel, LoadingPanel, StatePanel } from "@/components/StatePanel";
import { PageTitle, SectionTitle } from "@/components/Typography";
import { useConnectivity } from "@/connectivity/connectivity-context";
import { spacing } from "@/theme/tokens";
import { formatDateTime } from "@/utils/date";
import { humanizeConstant } from "@/utils/text";

export default function VisitorsScreen() {
  const router = useRouter();
  const connectivity = useConnectivity();
  const visitors = useQuery({
    enabled: connectivity.isOnline,
    queryFn: () => endpoints.visitorList("AWAITING_APPROVAL,APPROVED,CHECKED_IN"),
    queryKey: ["visitors", "gate-active"],
    refetchInterval: 5_000
  });
  return (
    <Screen onRefresh={() => void visitors.refetch()} refreshing={visitors.isRefetching}>
      <PageTitle subtitle="Register, verify, admit, and check out gate visitors.">
        Visitors / विज़िटर
      </PageTitle>
      <View style={styles.actions}>
        <View style={styles.actionCell}>
          <ActionButton
            icon={UserPlus}
            label="Register visitor"
            onPress={() => router.push("/visitor/new")}
            secondaryLabel="विज़िटर दर्ज करें"
          />
        </View>
        <View style={styles.actionCell}>
          <ActionButton
            disabled={!connectivity.isOnline}
            icon={ScanLine}
            label="Verify code"
            onPress={() => router.push("/visitor/code")}
            secondaryLabel="कोड जांचें"
            variant="secondary"
          />
        </View>
        <View style={styles.actionCell}>
          <ActionButton
            icon={UsersRound}
            label="All active visits"
            onPress={() => router.push("/visitor/active")}
            secondaryLabel="सक्रिय विज़िटर"
            variant="secondary"
          />
        </View>
      </View>
      <SectionTitle>Pending and inside / प्रतीक्षा और अंदर</SectionTitle>
      {!connectivity.isOnline ? (
        <StatePanel
          detail="Live approvals are unavailable. Open Register visitor to prepare a draft or record an explicitly offline manual entry."
          icon={Clock3}
          title="Live visitor list is offline"
          tone="warning"
        />
      ) : visitors.isLoading ? (
        <LoadingPanel />
      ) : visitors.isError ? (
        <ErrorPanel message={(visitors.error as Error).message} onRetry={() => void visitors.refetch()} />
      ) : visitors.data?.items.length === 0 ? (
        <StatePanel detail="There are no visitors awaiting a decision or currently inside." title="No active visitors" />
      ) : (
        <View style={styles.records}>
          {visitors.data?.items.map((visit) => (
            <RecordItem
              detail={`${visit.flat.displayLabel} • ${humanizeConstant(visit.category)}`}
              icon={UsersRound}
              key={visit.id}
              meta={formatDateTime(visit.arrivedAt ?? visit.createdAt)}
              onPress={() => router.push({ pathname: "/visitor/[id]", params: { id: visit.id } })}
              status={humanizeConstant(visit.status)}
              statusTone={
                visit.status === "REJECTED" || visit.status === "APPROVAL_TIMED_OUT"
                  ? "critical"
                  : visit.status === "CHECKED_IN"
                    ? "success"
                    : "warning"
              }
              title={visit.visitorName}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actionCell: {
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: 160
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  records: {
    gap: spacing.sm
  }
});
