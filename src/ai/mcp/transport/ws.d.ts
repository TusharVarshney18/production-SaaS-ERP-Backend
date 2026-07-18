declare module 'ws' {
  import { EventEmitter } from 'events';

  interface WebSocketOptions {
    headers?: Record<string, string>;
    handshakeTimeout?: number;
  }

  class WebSocket extends EventEmitter {
    static OPEN: number;
    static CONNECTING: number;
    static CLOSING: number;
    static CLOSED: number;
    readonly readyState: number;
    constructor(url: string, options?: WebSocketOptions);
    send(data: string): void;
    close(): void;
    on(event: 'open', listener: () => void): this;
    on(event: 'message', listener: (data: Buffer) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'close', listener: () => void): this;
    on(event: 'unexpected-response', listener: () => void): this;
  }

  export { WebSocket };
}
