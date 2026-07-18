import { zodResolver } from "@hookform/resolvers/zod";
import * as Crypto from "expo-crypto";
import { Controller, useForm } from "react-hook-form";
import { PackageCheck } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Text } from "react-native";
import { z } from "zod";

import { endpoints } from "@/api/endpoints";
import { ActionButton, Field } from "@/components/Controls";
import { Screen } from "@/components/Screen";
import { StatePanel } from "@/components/StatePanel";
import { PageTitle } from "@/components/Typography";
import { useConnectivity } from "@/connectivity/connectivity-context";
import { colors, typography } from "@/theme/tokens";

const schema = z.object({ code: z.string().trim().min(4, "Enter the collection code.").max(32) });

export default function ParcelVerifyScreen() {
  const router = useRouter();
  const connectivity = useConnectivity();
  const { control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({
    defaultValues: { code: "" },
    resolver: zodResolver(schema)
  });
  if (!connectivity.isOnline) {
    return (
      <Screen>
        <StatePanel detail="Collection codes are one-time server credentials and cannot be consumed offline." title="Internet required / इंटरनेट चाहिए" tone="warning" />
      </Screen>
    );
  }
  const submit = handleSubmit(async ({ code }) => {
    try {
      const parcel = await endpoints.verifyParcelCode(
        code.trim().toUpperCase(),
        Crypto.randomUUID()
      );
      router.replace({ pathname: "/parcel/[id]", params: { id: parcel.id } });
    } catch (caught) {
      setError("root", { message: caught instanceof Error ? caught.message : "Collection code verification failed." });
    }
  });
  return (
    <Screen keyboardShouldPersistTaps="handled">
      <PageTitle subtitle="The server verifies one-time use before collection.">
        Collection code / कलेक्शन कोड
      </PageTitle>
      <Controller
        control={control}
        name="code"
        render={({ field }) => (
          <Field
            autoCapitalize="characters"
            autoCorrect={false}
            error={errors.code?.message}
            label="Collection code / कलेक्शन कोड"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="Enter resident code"
            required
            value={field.value}
          />
        )}
      />
      {errors.root?.message ? <Text style={{ color: colors.critical, fontSize: typography.label }}>{errors.root.message}</Text> : null}
      <ActionButton icon={PackageCheck} label="Verify collection" loading={isSubmitting} onPress={() => void submit()} secondaryLabel="कलेक्शन सत्यापित करें" />
    </Screen>
  );
}
