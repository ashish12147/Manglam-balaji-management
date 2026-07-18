import { useQuery } from "@tanstack/react-query";
import { Package, PackageCheck, Plus } from "lucide-react-native";
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

export default function ParcelsScreen() {
  const router = useRouter();
  const connectivity = useConnectivity();
  const parcels = useQuery({
    enabled: connectivity.isOnline,
    queryFn: () => endpoints.parcelList("ARRIVED,HELD_AT_GATE"),
    queryKey: ["parcels", "held"],
    refetchInterval: 15_000
  });
  return (
    <Screen onRefresh={() => void parcels.refetch()} refreshing={parcels.isRefetching}>
      <PageTitle subtitle="Record held parcels and verify one-time collection codes.">
        Parcels / पार्सल
      </PageTitle>
      <View style={styles.actions}>
        <View style={styles.actionCell}>
          <ActionButton
            icon={Plus}
            label="Hold parcel"
            onPress={() => router.push("/parcel/new")}
            secondaryLabel="पार्सल रखें"
          />
        </View>
        <View style={styles.actionCell}>
          <ActionButton
            disabled={!connectivity.isOnline}
            icon={PackageCheck}
            label="Collection code"
            onPress={() => router.push("/parcel/verify")}
            secondaryLabel="कलेक्शन कोड"
            variant="secondary"
          />
        </View>
      </View>
      <SectionTitle>Held at gate / गेट पर रखे पार्सल</SectionTitle>
      {!connectivity.isOnline ? (
        <StatePanel
          detail="The live held-parcel list and code verification need the server. A new hold can be stored locally with LOCAL_PENDING status."
          title="Parcel list is offline"
          tone="warning"
        />
      ) : parcels.isLoading ? (
        <LoadingPanel />
      ) : parcels.isError ? (
        <ErrorPanel message={(parcels.error as Error).message} onRetry={() => void parcels.refetch()} />
      ) : parcels.data?.items.length === 0 ? (
        <StatePanel detail="No parcel is currently held at this gate." title="No held parcels" />
      ) : (
        <View style={styles.records}>
          {parcels.data?.items.map((parcel) => (
            <RecordItem
              detail={`${parcel.flat.displayLabel} • ${parcel.courierName ?? "Courier not supplied"}`}
              icon={Package}
              key={parcel.id}
              meta={formatDateTime(parcel.heldAt ?? parcel.createdAt)}
              onPress={() => router.push({ pathname: "/parcel/[id]", params: { id: parcel.id } })}
              status={humanizeConstant(parcel.status)}
              statusTone={parcel.status === "HELD_AT_GATE" ? "warning" : "info"}
              title={parcel.description ?? "Parcel"}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actionCell: {
    flex: 1,
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
