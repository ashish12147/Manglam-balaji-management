import { Building2, RefreshCw, Search } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionButton } from "@/components/Controls";
import { useSync } from "@/offline/sync-context";
import { colors, control, radii, spacing, typography } from "@/theme/tokens";
import type { FlatDirectoryItem } from "@/types/domain";

export function FlatSearch({
  onSelect,
  selected
}: {
  onSelect: (flat: FlatDirectoryItem | null) => void;
  selected: FlatDirectoryItem | null;
}) {
  const sync = useSync();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<FlatDirectoryItem[]>([]);
  const [isExpired, setIsExpired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      void sync.searchFlats(query)
        .then((result) => {
          if (!active) return;
          setItems(result.items);
          setIsExpired(result.isExpired);
        })
        .catch((caught) => {
          if (active) setError(caught instanceof Error ? caught.message : "Flat directory search failed.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, sync]);

  return (
    <View style={styles.group}>
      <Text style={styles.label}>Destination flat / जाने वाला फ्लैट *</Text>
      {selected ? (
        <Pressable
          accessibilityLabel={`Selected flat ${selected.displayLabel}. Change flat.`}
          accessibilityRole="button"
          onPress={() => {
            onSelect(null);
            setQuery("");
            setItems([]);
          }}
          style={styles.selected}
        >
          <Building2 color={colors.primary} size={24} />
          <View style={styles.selectedContent}>
            <Text style={styles.selectedTitle}>{selected.displayLabel}</Text>
            {selected.residentDisplayName ? <Text style={styles.selectedMeta}>{selected.residentDisplayName}</Text> : null}
          </View>
          <Text style={styles.change}>Change</Text>
        </Pressable>
      ) : (
        <>
          <View style={styles.searchBox}>
            <Search color={colors.muted} size={22} />
            <TextInput
              accessibilityLabel="Search block or flat number"
              autoCapitalize="characters"
              onChangeText={setQuery}
              placeholder="Block or flat number"
              placeholderTextColor={colors.disabled}
              style={styles.input}
              value={query}
            />
            {loading ? <ActivityIndicator color={colors.primary} /> : null}
          </View>
          {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
          {isExpired ? (
            <View style={styles.expired}>
              <Text style={styles.expiredText}>The offline flat directory has expired. Reconnect and refresh before using it.</Text>
              <ActionButton icon={RefreshCw} label="Refresh directory" onPress={() => void sync.refreshSnapshot(true)} secondaryLabel="डायरेक्टरी अपडेट करें" variant="secondary" />
            </View>
          ) : (
            <View style={styles.results}>
              {items.map((flat) => (
                <Pressable
                  accessibilityLabel={`${flat.displayLabel}${flat.residentDisplayName ? `, ${flat.residentDisplayName}` : ""}`}
                  accessibilityRole="button"
                  key={flat.id}
                  onPress={() => onSelect(flat)}
                  style={({ pressed }) => [styles.result, pressed ? styles.pressed : null]}
                >
                  <Building2 color={colors.primary} size={22} />
                  <View style={styles.selectedContent}>
                    <Text style={styles.resultTitle}>{flat.displayLabel}</Text>
                    {flat.residentDisplayName ? <Text style={styles.selectedMeta}>{flat.residentDisplayName}</Text> : null}
                  </View>
                </Pressable>
              ))}
              {!loading && query.trim() && items.length === 0 ? <Text style={styles.empty}>No matching flat in the current directory.</Text> : null}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  change: { color: colors.primary, fontSize: typography.label, fontWeight: "700" },
  empty: { color: colors.muted, fontSize: typography.label, padding: spacing.md, textAlign: "center" },
  error: { color: colors.critical, fontSize: typography.label, lineHeight: 20 },
  expired: { gap: spacing.sm }, expiredText: { color: colors.critical, fontSize: typography.label, lineHeight: 20 },
  group: { gap: spacing.sm }, input: { color: colors.black, flex: 1, fontSize: typography.body, minHeight: control.minHeight - 2, paddingVertical: spacing.sm },
  label: { color: colors.ink, fontSize: typography.label, fontWeight: "700" }, pressed: { opacity: 0.72 },
  result: { alignItems: "center", backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: spacing.md, minHeight: 58, padding: spacing.md },
  resultTitle: { color: colors.ink, fontSize: typography.body, fontWeight: "700" },
  results: { borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, maxHeight: 300, overflow: "hidden" },
  searchBox: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: "row", gap: spacing.sm, minHeight: control.minHeight, paddingHorizontal: spacing.md },
  selected: { alignItems: "center", backgroundColor: colors.primarySoft, borderColor: colors.primary, borderRadius: radii.md, borderWidth: 1, flexDirection: "row", gap: spacing.md, minHeight: 68, padding: spacing.md },
  selectedContent: { flex: 1, minWidth: 0 }, selectedMeta: { color: colors.muted, fontSize: typography.caption, lineHeight: 18 },
  selectedTitle: { color: colors.primary, fontSize: typography.body, fontWeight: "800" }
});
