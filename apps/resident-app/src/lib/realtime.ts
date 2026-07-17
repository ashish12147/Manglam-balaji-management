import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';

import { apiClient } from '@/lib/api';
import { getRuntimeConfig } from '@/lib/config';
import { useAuth } from '@/providers/AuthProvider';

export function useResidentRealtime(): void {
  const client = useQueryClient();
  const { selectedMembership } = useAuth();
  useEffect(() => {
    const token = apiClient.getAccessToken();
    if (!token || !selectedMembership) return;
    const socket = io(getRuntimeConfig().wsUrl, {
      auth: { membershipId: selectedMembership.id, token },
      reconnection: true,
      reconnectionAttempts: 6,
      transports: ['websocket', 'polling'],
    });
    const refresh = () => {
      void client.invalidateQueries({ queryKey: ['visitor-approvals'] });
      void client.invalidateQueries({ queryKey: ['visits'] });
      void client.invalidateQueries({ queryKey: ['preapprovals'] });
      void client.invalidateQueries({ queryKey: ['notifications'] });
    };
    socket.on('visitor.approval.updated', refresh);
    socket.on('visitor.status.updated', refresh);
    socket.on('notification.created', refresh);
    return () => {
      socket.off('visitor.approval.updated', refresh);
      socket.off('visitor.status.updated', refresh);
      socket.off('notification.created', refresh);
      socket.disconnect();
    };
  }, [client, selectedMembership]);
}
