import * as Crypto from "expo-crypto";
import { CheckCircle2, Save, Send, ShieldAlert } from "lucide-react-native";
import { Controller, useForm } from "react-hook-form";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";

import { endpoints } from "@/api/endpoints";
import { uploadPrivateImage, type LocalImage } from "@/api/uploads";
import { useSession } from "@/auth/session-context";
import { ActionButton, ChoiceGroup, Field } from "@/components/Controls";
import { FlatSearch } from "@/components/FlatSearch";
import { PhotoCapture } from "@/components/PhotoCapture";
import { Screen } from "@/components/Screen";
import { StatePanel } from "@/components/StatePanel";
import { PageTitle } from "@/components/Typography";
import { useConnectivity } from "@/connectivity/connectivity-context";
import { useSync } from "@/offline/sync-context";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import type { FlatDirectoryItem, VisitorCategory } from "@/types/domain";
import { zodFormResolver } from "@/utils/zod-form-resolver";

const schema = z.object({
  category: z.enum(["GUEST", "DELIVERY", "CAB", "SERVICE_PROVIDER", "OTHER"]),
  name: z.string().trim().min(2, "Enter the visitor name.").max(100),
  offlineReason: z.string().trim().max(300),
  phone: z.string().trim().max(20),
  purpose: z.string().trim().max(200),
  vehicleNumber: z.string().trim().max(20)
});

type FormValues = z.infer<typeof schema>;

const categories: readonly {
  label: string;
  secondaryLabel: string;
  value: VisitorCategory;
}[] = [
  { label: "Guest", secondaryLabel: "मेहमान", value: "GUEST" },
  { label: "Delivery", secondaryLabel: "डिलीवरी", value: "DELIVERY" },
  { label: "Cab", secondaryLabel: "कैब", value: "CAB" },
  { label: "Service", secondaryLabel: "सेवा", value: "SERVICE_PROVIDER" },
  { label: "Other", secondaryLabel: "अन्य", value: "OTHER" }
];

export default function NewVisitorScreen() {
  const router = useRouter();
  const connectivity = useConnectivity();
  const session = useSession();
  const sync = useSync();
  const [flat, setFlat] = useState<FlatDirectoryItem | null>(null);
  const [photo, setPhoto] = useState<LocalImage | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    defaultValues: {
      category: "GUEST",
      name: "",
      offlineReason: "",
      phone: "",
      purpose: "",
      vehicleNumber: ""
    },
    resolver: zodFormResolver(schema)
  });

  const canManualOffline =
    session.hasPermission("visitor.override") || session.hasPermission("visitor.offline_entry");
  const submit = handleSubmit(async (values) => {
    if (!flat) {
      setError("root", { message: "Select the destination flat." });
      return;
    }
    try {
      if (!connectivity.isOnline) {
        if (photo) {
          setError("root", { message: "Remove the photo before saving an offline record." });
          return;
        }
        const manual = values.offlineReason.trim().length > 0;
        if (manual && !canManualOffline) {
          setError("root", { message: "Your guard account cannot record an offline manual entry." });
          return;
        }
        if (manual && values.offlineReason.trim().length < 10) {
          setError("offlineReason", { message: "Give a clear offline-entry reason (at least 10 characters)." });
          return;
        }
        const mutation = await sync.enqueue({
          entityType: "Visit",
          operation: manual ? "VISIT_MANUAL_ENTRY" : "VISIT_PREPARE",
          payload: {
            category: values.category,
            flatId: flat.id,
            name: values.name.trim(),
            offlineReason: manual ? values.offlineReason.trim() : null,
            phone: values.phone.trim() || null,
            purpose: values.purpose.trim() || null,
            vehicleNumber: values.vehicleNumber.trim().toUpperCase() || null
          }
        });
        setSuccessId(mutation.clientMutationId);
        return;
      }

      const uploadedPhoto = photo ? await uploadPrivateImage(photo, "VISITOR_PHOTO") : undefined;
      const visit = await endpoints.createVisitorRequest(
        {
          category: values.category,
          flatId: flat.id,
          name: values.name.trim(),
          phone: values.phone.trim() || undefined,
          photoFileId: uploadedPhoto?.fileId,
          purpose: values.purpose.trim() || undefined,
          vehicleNumber: values.vehicleNumber.trim().toUpperCase() || undefined
        },
        Crypto.randomUUID()
      );
      router.replace({
        pathname: "/visitor/[id]",
        params: {
          id: visit.id,
          ...(uploadedPhoto ? { uploadScanStatus: uploadedPhoto.scanStatus } : {})
        }
      });
    } catch (caught) {
      setError("root", { message: caught instanceof Error ? caught.message : "Visitor registration failed." });
    }
  });

  if (successId) {
    return (
      <Screen>
        <StatePanel
          detail="The record is stored on this device as LOCAL_PENDING. No resident approval has been claimed. It will synchronize with the same client UUID when the connection returns."
          icon={CheckCircle2}
          title="Offline record saved / ऑफलाइन रिकॉर्ड सेव"
        />
        <ActionButton
          icon={Save}
          label="Open sync record"
          onPress={() => router.replace({ pathname: "/sync/[id]", params: { id: successId } })}
          secondaryLabel="सिंक रिकॉर्ड देखें"
        />
      </Screen>
    );
  }

  return (
    <Screen keyboardShouldPersistTaps="handled">
      <PageTitle
        subtitle={
          connectivity.isOnline
            ? "A resident decision will be requested."
            : "Only reviewed offline actions are available."
        }
      >
        Register visitor / विज़िटर दर्ज करें
      </PageTitle>
      {!connectivity.isOnline ? (
        <View style={styles.offlineNotice}>
          <ShieldAlert color={colors.warning} size={26} />
          <Text style={styles.offlineText}>
            Offline. This form cannot approve a visitor. Leave the reason blank to save a draft, or provide an authorised manual-entry reason.
          </Text>
        </View>
      ) : null}
      <Controller
        control={control}
        name="category"
        render={({ field }) => (
          <ChoiceGroup
            label="Visitor category / विज़िटर प्रकार"
            onChange={field.onChange}
            options={categories}
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <Field
            autoCapitalize="words"
            error={errors.name?.message}
            label="Visitor name / विज़िटर नाम"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="Full name"
            required
            value={field.value}
          />
        )}
      />
      <FlatSearch onSelect={setFlat} selected={flat} />
      <Controller
        control={control}
        name="phone"
        render={({ field }) => (
          <Field
            error={errors.phone?.message}
            keyboardType="phone-pad"
            label="Phone (optional) / फोन"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="Visitor phone"
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="vehicleNumber"
        render={({ field }) => (
          <Field
            autoCapitalize="characters"
            error={errors.vehicleNumber?.message}
            label="Vehicle number (optional) / वाहन नंबर"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="RJ14 AB 1234"
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="purpose"
        render={({ field }) => (
          <Field
            error={errors.purpose?.message}
            label="Purpose (optional) / आने का कारण"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="Reason for visit"
            value={field.value}
          />
        )}
      />
      <PhotoCapture
        disabled={!connectivity.isOnline}
        label="Visitor photo / विज़िटर फोटो"
        onChange={setPhoto}
        value={photo}
      />
      {!connectivity.isOnline && canManualOffline ? (
        <Controller
          control={control}
          name="offlineReason"
          render={({ field }) => (
            <Field
              error={errors.offlineReason?.message}
              hint="Leave blank to save a draft. A reason records an explicit offline manual entry."
              label="Offline manual-entry reason / ऑफलाइन कारण"
              multiline
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              placeholder="Supervisor instruction or emergency reason"
              value={field.value}
            />
          )}
        />
      ) : null}
      {errors.root?.message ? <Text style={styles.error}>{errors.root.message}</Text> : null}
      <ActionButton
        icon={connectivity.isOnline ? Send : Save}
        label={
          connectivity.isOnline
            ? "Request resident approval"
            : watch("offlineReason").trim()
              ? "Record offline manual entry"
              : "Save offline draft"
        }
        loading={isSubmitting}
        onPress={() => void submit()}
        secondaryLabel={connectivity.isOnline ? "निवासी से अनुमति लें" : "डिवाइस पर सुरक्षित करें"}
        variant={!connectivity.isOnline && watch("offlineReason").trim() ? "warning" : "primary"}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: {
    color: colors.critical,
    fontSize: typography.label,
    lineHeight: 21
  },
  offlineNotice: {
    alignItems: "flex-start",
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  offlineText: {
    color: colors.warning,
    flex: 1,
    fontSize: typography.label,
    lineHeight: 21
  }
});
