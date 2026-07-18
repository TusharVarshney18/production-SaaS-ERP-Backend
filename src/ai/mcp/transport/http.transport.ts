import { Injectable } from '@nestjs/common';
import { BaseTransport } from './base.transport';
import { TransportOptions } from '../interfaces/transport.interface';
import { MCPError, MCPErrorCode } from '../interfaces/mcp-error.interface';

@Injectable()
export class HttpTransport extends BaseTransport {
  readonly name = 'http';
  private readonly baseUrl: string;

  constructor(options: TransportOptions = {}) {
    super(options);
    this.baseUrl = options.url || '';
  }

  async connect(): Promise<void> {
    if (!this.baseUrl) {
      throw new MCPError('HTTP transport requires a URL', MCPErrorCode.TRANSPORT_ERROR);
    }
    const startTime = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: { ...this.options.headers },
        signal: AbortSignal.timeout(this.options.timeout || 5000),
      });
      if (!response.ok) {
        throw new MCPError(`HTTP health check failed: ${response.statusText}`, MCPErrorCode.CONNECTION_FAILED);
      }
      this._connected = true;
      this.stats.connectTime = Date.now() - startTime;
      this.stats.lastActivity = Date.now();
      this.logger.log(`HTTP transport connected: ${this.baseUrl}`);
    } catch (error) {
      throw new MCPError(
        `HTTP connection failed: ${(error as Error).message}`,
        MCPErrorCode.CONNECTION_FAILED,
      );
    }
  }

  async disconnect(): Promise<void> {
    this._connected = false;
    this.logger.log('HTTP transport disconnected');
  }

  protected async sendRaw(data: string): Promise<void> {
    if (!this._connected) {
      throw new MCPError('HTTP transport not connected', MCPErrorCode.TRANSPORT_ERROR);
    }
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.options.headers,
        },
        body: data,
        signal: AbortSignal.timeout(this.options.timeout || 30000),
      });
      if (response.ok) {
        const text = await response.text();
        if (text) {
          this.handleMessage(text);
        }
      } else {
        const errorText = await response.text();
        this.handleError(
          new MCPError(`HTTP ${response.status}: ${errorText}`, MCPErrorCode.TRANSPORT_ERROR),
        );
      }
    } catch (error) {
      this.handleError(
        new MCPError(`HTTP request failed: ${(error as Error).message}`, MCPErrorCode.TRANSPORT_ERROR),
      );
    }
  }
}
