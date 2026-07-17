import { useLocalSearchParams } from 'expo-router';
import { VisitorDetailScreen } from '@/components/visitor-flows';
export default function VisitorRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <VisitorDetailScreen id={id ?? ''} />;
}
