import { Redis } from 'ioredis';

export type RedisErrorHandler = (error: unknown) => void;
export type WakeHandler = () => void;

export class RedisAccelerator {
  private publisher: Redis | undefined;
  private subscriber: Redis | undefined;
  private readonly channel: string;

  constructor(
    private readonly redisUrl: string,
    prefix: string,
  ) {
    this.channel = `${prefix}:outbox:wake`;
  }

  async start(onWake: WakeHandler, onError: RedisErrorHandler): Promise<boolean> {
    const options = {
      connectTimeout: 2000,
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      tls: this.redisUrl.startsWith('rediss://') ? {} : undefined,
    } as const;
    const publisher = new Redis(this.redisUrl, options);
    const subscriber = new Redis(this.redisUrl, options);
    publisher.on('error', onError);
    subscriber.on('error', onError);
    subscriber.on('message', (channel: string) => {
      if (channel === this.channel) onWake();
    });
    try {
      await Promise.all([publisher.connect(), subscriber.connect()]);
      await subscriber.subscribe(this.channel);
      this.publisher = publisher;
      this.subscriber = subscriber;
      return true;
    } catch (error) {
      onError(error);
      publisher.disconnect(false);
      subscriber.disconnect(false);
      return false;
    }
  }

  async publishWake(onError: RedisErrorHandler): Promise<boolean> {
    if (!this.publisher || this.publisher.status !== 'ready') return false;
    try {
      await this.publisher.publish(this.channel, 'poll');
      return true;
    } catch (error) {
      onError(error);
      return false;
    }
  }

  async close(): Promise<void> {
    const clients = [this.subscriber, this.publisher].filter(
      (client): client is Redis => client !== undefined,
    );
    await Promise.all(
      clients.map(async (client) => {
        if (client.status === 'ready') await client.quit();
        else client.disconnect(false);
      }),
    );
    this.publisher = undefined;
    this.subscriber = undefined;
  }
}
