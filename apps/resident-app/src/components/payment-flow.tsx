import * as Linking from 'expo-linking';
import { useMutation } from '@tanstack/react-query';
import { Text } from 'react-native';

import { Button, PageHeader, QueryState, Row, Screen, Section } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { isSecureExternalUrl } from '@/lib/links';
import { useApiQuery } from '@/lib/query';
import { maintenanceApi } from '@/lib/resident-api';
import { useConnectivity } from '@/providers/ConnectivityProvider';
import { colors, typography } from '@/theme/tokens';

export function PaymentScreen() {
  const capability = useApiQuery(['payment-capability'], maintenanceApi.paymentCapabilities);
  const start = useMutation({
    mutationFn: maintenanceApi.startOnlinePayment,
    onSuccess: async (data) => {
      if (!isSecureExternalUrl(data.checkoutUrl)) {
        throw new Error('The payment provider returned an unsafe checkout URL.');
      }
      const available = await Linking.canOpenURL(data.checkoutUrl);
      if (!available)
        throw new Error('The verified payment URL could not be opened on this device.');
      await Linking.openURL(data.checkoutUrl);
    },
  });
  const c = useConnectivity();
  const view = {
    error: capability.error,
    isLoading: capability.isLoading,
    isOffline: c.isResolved && !c.isOnline,
    onRetry: () => void capability.refetch(),
  };
  return (
    <Screen>
      <PageHeader
        subtitle="A payment is never marked paid by this app. The provider and server must verify it."
        title="Online payment"
      />
      <QueryState {...view}>
        {capability.data?.onlinePaymentsEnabled ? (
          <Section>
            <Row
              detail={capability.data.providerLabel ?? 'Verified payment provider'}
              title="Ready to continue"
            />
            <Button disabled={start.isPending} onPress={() => start.mutate()}>
              {start.isPending ? 'Opening verified checkout' : 'Continue to secure payment'}
            </Button>
            {start.error ? (
              <Text
                accessibilityRole="alert"
                style={{ color: colors.danger, fontSize: typography.body }}
              >
                {errorMessage(start.error)}
              </Text>
            ) : null}
          </Section>
        ) : (
          <Section>
            <Row
              detail="The society has not configured a verified online payment provider."
              title="Online payment disabled"
            />
          </Section>
        )}
      </QueryState>
    </Screen>
  );
}
