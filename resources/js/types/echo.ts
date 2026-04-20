/**
 * Typed Echo interfaces for Laravel Echo integration
 * Provides type-safe channel and event handling
 */

export type Presence = {
  id: number;
  name?: string;
  [key: string]: unknown;
};

export interface EchoChannel {
  here(cb: (members: Presence[]) => void): EchoChannel;
  joining(cb: (member: Presence) => void): EchoChannel;
  leaving(cb: (member: Presence) => void): EchoChannel;
  listen<T = unknown>(event: string, cb: (payload: T) => void): EchoChannel;
  stopListening(event: string): EchoChannel;
}

export interface EchoInstance {
  join(channel: string): EchoChannel;
  leave(channel: string): void;
  socketId(): string;
  disconnect(): void;
}

/**
 * Type-safe helper to cast echo instance
 */
export const getTypedEcho = (echo: unknown): EchoInstance | null => {
  if (!echo) return null;
  return echo as EchoInstance;
};
