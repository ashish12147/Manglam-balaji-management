import { RefreshControl, ScrollView, StyleSheet, View, type ScrollViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "@/theme/tokens";

interface ScreenProps extends Pick<ScrollViewProps, "keyboardShouldPersistTaps"> {
  children: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  scroll?: boolean;
  testID?: string;
}

export function Screen({
  children,
  keyboardShouldPersistTaps = "handled",
  onRefresh,
  refreshing = false,
  scroll = true,
  testID
}: ScreenProps) {
  const content = <View style={styles.content}>{children}</View>;
  return (
    <SafeAreaView edges={["bottom"]} style={styles.safeArea} testID={testID}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                colors={[colors.primary]}
                onRefresh={onRefresh}
                refreshing={refreshing}
                tintColor={colors.primary}
              />
            ) : undefined
          }
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    alignSelf: "center",
    flexGrow: 1,
    gap: spacing.lg,
    padding: spacing.lg,
    width: "100%",
    maxWidth: 920
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1
  },
  scrollContent: {
    flexGrow: 1
  }
});
