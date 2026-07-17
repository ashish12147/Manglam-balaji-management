import { useLocalSearchParams } from 'expo-router';
import { ParcelDetailScreen } from '@/components/service-flows';
export default function ParcelRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ParcelDetailScreen id={id ?? ''} />;
}
