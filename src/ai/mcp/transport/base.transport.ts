import { Logger } from '@nestjs/common';
import { IMCPTransport, TransportOptions, TransportStats } from '../interfaces/transport.interface';

export abstract class BaseTransport implements IMCPTransport {
  protected readonly logger: Logger;
  abstract readonly name: string;
  protected _connected = false;
  protected messageHandler?: (message: unknown) => void;
  protected errorHandler?: (error: Error) => void;
  protected closeHandler?: () => void;
  protected stats: TransportStats = {
    bytesSent: 0,
    bytesReceived: 0,
    messagesSent: 0,
    messagesReceived: 0,
    connectTime: 0,
    lastActivity: 0,
    reconnects: 0,
  };

  constructor(protected readonly options: TransportOptions = {}) {
    this.logger = new Logger((this.constructor as any).name || 'BaseTransport');
  }

  get connected(): boolean {
    return this._connected;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  async send(message: unknown): Promise<void> {
    const serialized = JSON.stringify(message);
    this.stats.bytesSent += Buffer.byteLength(serialized, 'utf-8');
    this.stats.messagesSent++;
    this.stats.lastActivity = Date.now();
    await this.sendRaw(serialized);
  }

  protected abstract sendRaw(data: string): Promise<void>;

  onMessage(handler: (message: unknown) => void): void {
    this.messageHandler = handler;
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }

  getStats(): TransportStats {
    return { ...this.stats };
  }

  protected handleMessage(raw: string): void {
    this.stats.bytesReceived += Buffer.byteLength(raw, 'utf-8');
    this.stats.messagesReceived++;
    this.stats.lastActivity = Date.now();
    try {
      const parsed = JSON.parse(raw);
      this.messageHandler?.(parsed);
    } catch {
      this.logger.warn(`Failed to parse MCP message: ${raw.substring(0, 100)}`);
    }
  }

  protected handleError(error: Error): void {
    this.logger.error(`Transport error: ${error.message}`);
    this.errorHandler?.(error);
  }

  protected handleClose(): void {
    this._connected = false;
    this.closeHandler?.();
  }
}
