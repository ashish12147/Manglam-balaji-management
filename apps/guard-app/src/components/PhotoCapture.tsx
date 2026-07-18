import * as ImagePicker from "expo-image-picker";
import { Camera, RotateCcw, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import type { LocalImage } from "@/api/uploads";
import { ActionButton } from "@/components/Controls";
import { colors, radii, spacing, typography } from "@/theme/tokens";

export function PhotoCapture({
  disabled = false,
  label,
  onChange,
  value
}: {
  disabled?: boolean;
  label: string;
  onChange: (image: LocalImage | null) => void;
  value: LocalImage | null;
}) {
  const [error, setError] = useState<string | null>(null);

  async function takePhoto() {
    setError(null);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError("Camera permission was denied. Enable it in Android settings and try again.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.back,
        exif: false,
        mediaTypes: ["images"],
        quality: 0.65
      });
      if (result.canceled) return;
      const image = result.assets[0];
      if (!image) {
        setError("The camera did not return a photograph.");
        return;
      }
      onChange({
        fileName: image.fileName,
        fileSize: image.fileSize,
        mimeType: image.mimeType,
        uri: image.uri
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The camera could not be opened.");
    }
  }

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      {value ? (
        <View style={styles.previewGroup}>
          <Image accessibilityLabel="Captured gate photograph" source={{ uri: value.uri }} style={styles.preview} />
          <View style={styles.actions}>
            <View style={styles.actionCell}>
              <ActionButton
                disabled={disabled}
                icon={RotateCcw}
                label="Retake"
                onPress={() => void takePhoto()}
                secondaryLabel="फिर फोटो लें"
                variant="secondary"
              />
            </View>
            <View style={styles.actionCell}>
              <ActionButton
                disabled={disabled}
                icon={Trash2}
                label="Remove"
                onPress={() => {
                  setError(null);
                  onChange(null);
                }}
                secondaryLabel="हटाएं"
                variant="quiet"
              />
            </View>
          </View>
        </View>
      ) : (
        <ActionButton
          disabled={disabled}
          icon={Camera}
          label="Take optional photo"
          onPress={() => void takePhoto()}
          secondaryLabel="वैकल्पिक फोटो लें"
          variant="secondary"
        />
      )}
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
      <Text style={styles.hint}>JPEG, PNG or WebP, up to 5 MB. Photos require an online secure upload and security scan.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actionCell: { flex: 1, minWidth: 140 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  error: { color: colors.critical, fontSize: typography.label, lineHeight: 21 },
  group: { gap: spacing.sm },
  hint: { color: colors.muted, fontSize: typography.caption, lineHeight: 18 },
  label: { color: colors.ink, fontSize: typography.label, fontWeight: "700" },
  preview: { aspectRatio: 16 / 9, backgroundColor: colors.background, borderRadius: radii.md, width: "100%" },
  previewGroup: { gap: spacing.sm }
});
