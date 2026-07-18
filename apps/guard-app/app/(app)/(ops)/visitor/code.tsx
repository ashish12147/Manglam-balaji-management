import { zodResolver } from "@hookform/resolvers/zod";
import * as Crypto from "expo-crypto";
import { Controller, useForm } from "react-hook-form";
import { ScanLine } from "lucide-react-native";
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

const schema = z.object({
  code: z.string().trim().min(6, "Enter the visitor code.").max(128, "The code is too long.")
});

export default function VisitorCodeScreen() {
  const router = useRouter();
  const connectivity = useConnectivity();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<z.infer<typeof schema>>({ defaultValues: { code: "" }, resolver: zodResolver(schema) });
  if (!connectivity.isOnline) {
    return (
      <Screen>
        <StatePanel
          detail="Visitor codes are one-time server credentials and cannot be verified from an offline snapshot."
          title="Internet required / इंटरनेट चाहिए"
          tone="warning"
        />
      </Screen>
    );
  }
  const submit = handleSubmit(async ({ code }) => {
    try {
      const visit = await endpoints.verifyVisitorCode(
        code.trim().toUpperCase(),
        Crypto.randomUUID()
      );
      router.replace({ pathname: "/visitor/[id]", params: { id: visit.id } });
    } catch (caught) {
      setError("root", { message: caught instanceof Error ? caught.message : "Code verification failed." });
    }
  });
  return (
    <Screen keyboardShouldPersistTaps="handled">
      <PageTitle subtitle="The code is verified and consumed only by the server.">
        Verify visitor code / विज़िटर कोड
      </PageTitle>
      <Controller
        control={control}
        name="code"
        render={({ field }) => (
          <Field
            autoCapitalize="characters"
            autoCorrect={false}
            error={errors.code?.message}
            label="Visitor code / विज़िटर कोड"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="Enter or paste code"
            required
            value={field.value}
          />
        )}
      />
      {errors.root?.message ? (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.critical, fontSize: typography.label }}>
          {errors.root.message}
        </Text>
      ) : null}
      <ActionButton
        icon={ScanLine}
        label="Verify code"
        loading={isSubmitting}
        onPress={() => void submit()}
        secondaryLabel="कोड सत्यापित करें"
      />
    </Screen>
  );
}
