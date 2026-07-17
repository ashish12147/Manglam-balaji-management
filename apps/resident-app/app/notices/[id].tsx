import { useLocalSearchParams } from 'expo-router';
import { NoticeDetailScreen } from '@/components/update-flows';
export default function NoticeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <NoticeDetailScreen id={id ?? ''} />;
}
