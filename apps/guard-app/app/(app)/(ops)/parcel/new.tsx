import * as Crypto from "expo-crypto";
import { PackagePlus, WifiOff } from "lucide-react-native";
import { Controller, useForm } from "react-hook-form";
import { useRouter } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { useState } from "react";
import { z } from "zod";

import { endpoints } from "@/api/endpoints";
import { uploadPrivateImage, type LocalImage } from "@/api/uploads";
import { ActionButton, Field } from "@/components/Controls";
import { FlatSearch } from "@/components/FlatSearch";
import { PhotoCapture } from "@/components/PhotoCapture";
import { Screen } from "@/components/Screen";
import { StatePanel } from "@/components/StatePanel";
import { PageTitle } from "@/components/Typography";
import { useConnectivity } from "@/connectivity/connectivity-context";
import { colors, typography } from "@/theme/tokens";
import type { FlatDirectoryItem } from "@/types/domain";
import { zodFormResolver } from "@/utils/zod-form-resolver";

const schema = z.object({
  courierName: z.string().trim().max(100),
  description: z.string().trim().min(2, "Enter a short parcel description.").max(200)
});

export default function NewParcelScreen() {
  const router = useRouter();
  const connectivity = useConnectivity();
  const [flat, setFlat] = useState<FlatDirectoryItem | null>(null);
  const [photo, setPhoto] = useState<LocalImage | null>(null);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<z.infer<typeof schema>>({
    defaultValues: { courierName: "", description: "" },
    resolver: zodFormResolver(schema)
  });

  const submit = handleSubmit(async (values) => {
    if (!connectivity.isOnline) {
      setError("root", {
        message: "Reconnect before recording a parcel. Parcel holds are not accepted by the offline protocol."
      });
      return;
    }
    if (!flat) {
      setError("root", { message: "Select the destination flat." });
      return;
    }
    try {
      const uploadedPhoto = photo ? await uploadPrivateImage(photo, "PARCEL_PHOTO") : undefined;
      const parcel = await endpoints.createParcel(
        {
          courierName: values.courierName.trim() || undefined,
          description: values.description.trim(),
          flatId: flat.id,
          photoFileId: uploadedPhoto?.fileId
        },
        Crypto.randomUUID()
      );
      router.replace({
        pathname: "/parcel/[id]",
        params: {
          id: parcel.id,
          ...(uploadedPhoto ? { uploadScanStatus: uploadedPhoto.scanStatus } : {})
        }
      });
    } catch (caught) {
      setError("root", { message: caught instanceof Error ? caught.message : "Parcel recording failed." });
    }
  });

  return (
    <Screen keyboardShouldPersistTaps="handled">
      <PageTitle subtitle="The server records the hold and issues the resident collection code.">
        Hold parcel / पार्सल रखें
      </PageTitle>
      {!connectivity.isOnline ? (
        <StatePanel
          detail="Parcel holds and private photo scans require the server. Reconnect before entering or releasing a parcel."
          icon={WifiOff}
          title="Internet required / इंटरनेट चाहिए"
          tone="warning"
        />
      ) : null}
      <FlatSearch onSelect={setFlat} selected={flat} />
      <Controller
        control={control}
        name="courierName"
        render={({ field }) => (
          <Field
            autoCapitalize="words"
            error={errors.courierName?.message}
            label="Courier name (optional) / कूरियर नाम"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="Courier or delivery service"
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <Field
            error={errors.description?.message}
            label="Parcel description / पार्सल विवरण"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="Box, envelope, or food package"
            required
            value={field.value}
          />
        )}
      />
      <PhotoCapture disabled={!connectivity.isOnline} label="Parcel photo / पार्सल फोटो" onChange={setPhoto} value={photo} />
      {errors.root?.message ? <Text style={styles.error}>{errors.root.message}</Text> : null}
      <ActionButton
        disabled={!connectivity.isOnline}
        icon={connectivity.isOnline ? PackagePlus : WifiOff}
        label={connectivity.isOnline ? "Record held parcel" : "Reconnect to record parcel"}
        loading={isSubmitting}
        onPress={() => void submit()}
        secondaryLabel={connectivity.isOnline ? "पार्सल दर्ज करें" : "इंटरनेट से जुड़ें"}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.critical, fontSize: typography.label, lineHeight: 21 }
});
