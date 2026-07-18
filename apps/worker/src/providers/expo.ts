export type ExpoReceiptStatus = 'DELIVERED' | 'ENDPOINT_EXPIRED' | 'RETRY';

export function classifyExpoReceipt(receipt: unknown): ExpoReceiptStatus {
  if (!receipt || typeof receipt !== 'object') throw new Error('Expo receipt is malformed.');
  const value = receipt as { details?: { error?: unknown }; status?: unknown };
  if (value.status === 'ok') return 'DELIVERED';
  if (value.status === 'error' && value.details?.error === 'DeviceNotRegistered')
    return 'ENDPOINT_EXPIRED';
  if (value.status === 'error') return 'RETRY';
  throw new Error('Expo receipt does not have a recognized status.');
}

export class ExpoReceiptProvider {
  constructor(
    private readonly accessToken: string,
    private readonly timeoutMs: number,
  ) {}

  async get(ticketId: string): Promise<ExpoReceiptStatus> {
    if (!/^[A-Za-z0-9-]{8,200}$/.test(ticketId)) throw new Error('Expo ticket id is invalid.');
    const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      body: JSON.stringify({ ids: [ticketId] }),
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${this.accessToken}`,
        'content-type': 'application/json',
      },
      method: 'POST',
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const body = (await response.json().catch(() => null)) as {
      data?: Record<string, unknown>;
    } | null;
    if (!response.ok || !body?.data?.[ticketId])
      throw new Error(`Expo receipt endpoint returned HTTP ${response.status}.`);
    return classifyExpoReceipt(body.data[ticketId]);
  }
}
