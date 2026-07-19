import { Injectable } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import { BaseTransport } from './base.transport';
import { TransportOptions } from '../interfaces/transport.interface';
import { MCPError, MCPErrorCode } from '../interfaces/mcp-error.interface';

@Injectable()
export class StdioTransport extends BaseTransport {
  readonly name = 'stdio';
  private process: ChildProcess | null = null;
  private buffer = '';

  constructor(options: TransportOptions = {}) {
    super(options);
  }

  async connect(): Promise<void> {
    const command = this.options.command;
    if (!command) {
      throw new MCPError('STDIO transport requires a command', MCPErrorCode.TRANSPORT_ERROR);
    }

    const startTime = Date.now();
    this.process = spawn(command, this.options.args || [], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      this.buffer += data.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          this.handleMessage(trimmed);
        }
      }
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      this.logger.warn(`STDIO stderr: ${data.toString().trim()}`);
    });

    this.process.on('error', (err) => {
      this.handleError(
        new MCPError(`STDIO process error: ${err.message}`, MCPErrorCode.TRANSPORT_ERROR),
      );
    });

    this.process.on('close', (code) => {
      this.logger.log(`STDIO process exited with code ${code}`);
      this.handleClose();
    });

    this._connected = true;
    this.stats.connectTime = Date.now() - startTime;
    this.stats.lastActivity = Date.now();
    this.logger.log(`STDIO transport connected: ${command}`);
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.stdin?.end();
      this.process.kill();
      this.process = null;
    }
    this._connected = false;
    this.logger.log('STDIO transport disconnected');
  }

  protected async sendRaw(data: string): Promise<void> {
    if (!this.process?.stdin) {
      throw new MCPError('STDIO transport not connected', MCPErrorCode.TRANSPORT_ERROR);
    }
    this.process.stdin.write(data + '\n');
  }
}
