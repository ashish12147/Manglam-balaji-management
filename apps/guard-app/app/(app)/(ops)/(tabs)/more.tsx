import { Activity, AlertTriangle, RefreshCw, Settings, UserRoundCog } from "lucide-react-native";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { ActionButton } from "@/components/Controls";
import { Screen } from "@/components/Screen";
import { PageTitle, SectionTitle } from "@/components/Typography";
import { useSync } from "@/offline/sync-context";
import { spacing } from "@/theme/tokens";

export default function MoreScreen() {
  const router = useRouter();
  const sync = useSync();
  return (
    <Screen>
      <PageTitle subtitle="Emergency response, diagnostics, and shift settings.">
        More operations / अन्य कार्य
      </PageTitle>
      <SectionTitle>Safety / सुरक्षा</SectionTitle>
      <View style={styles.list}>
        <ActionButton
          icon={AlertTriangle}
          label="Emergency alerts"
          onPress={() => router.push("/emergency")}
          secondaryLabel="आपातकालीन अलर्ट"
          variant="danger"
        />
        <ActionButton
          icon={Activity}
          label="Gate activity"
          onPress={() => router.push("/activity")}
          secondaryLabel="गेट गतिविधि"
          variant="secondary"
        />
      </View>
      <SectionTitle>Device / डिवाइस</SectionTitle>
      <View style={styles.list}>
        <ActionButton
          icon={RefreshCw}
          label={`Synchronization (${sync.counts.LOCAL_PENDING + sync.counts.FAILED + sync.counts.CONFLICT})`}
          onPress={() => router.push("/sync")}
          secondaryLabel="सिंक स्थिति"
          variant="secondary"
        />
        <ActionButton
          icon={UserRoundCog}
          label="Guard account"
          onPress={() => router.push("/account")}
          secondaryLabel="गार्ड खाता"
          variant="secondary"
        />
        <ActionButton
          icon={Settings}
          label="Change gate"
          onPress={() => router.push("/gate")}
          secondaryLabel="गेट बदलें"
          variant="quiet"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm
  }
});
