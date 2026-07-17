import { useLocalSearchParams } from 'expo-router';
import { ComplaintDetailScreen } from '@/components/update-flows';
export default function ComplaintRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ComplaintDetailScreen id={id ?? ''} />;
}
