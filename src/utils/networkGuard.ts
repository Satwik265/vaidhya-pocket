// PHASE1-POCKET
/**
 * Network guard: makes the "zero bytes leave the device" claim measurable.
 *
 * Wraps fetch, XMLHttpRequest, navigator.sendBeacon and WebSocket.
 *  - Allowed: same-origin, loopback (127.0.0.1 / localhost / ::1), data: and blob: URLs.
 *  - Blocked: every other origin, unless explicitly allow-listed via allowHosts() for a user-initiated
 *    action (for example the one-time local-model weight download).
 * Counters are exposed through getNetworkStats() / subscribeNetworkStats().
 */

export interface NetworkStats {
  /** Requests that reached the network layer (same-origin or loopback). */
  allowedRequests: number;
  /** Cross-origin requests that were refused. */
  blockedRequests: number;
  /** Request-body bytes of every non-GET/HEAD request (should stay 0 in the Pocket flow). */
  payloadBytesUploaded: number;
  /** Request-body bytes that the guard refused to send. */
  blockedBytes: number;
  /** Bytes fetched from explicitly allow-listed hosts (model download). */
  allowlistedRequests: number;
  lastBlocked?: string;
  installed: boolean;
}

const initialStats = (): NetworkStats => ({
  allowedRequests: 0,
  blockedRequests: 0,
  payloadBytesUploaded: 0,
  blockedBytes: 0,
  allowlistedRequests: 0,
  installed: false,
});

let stats: NetworkStats = initialStats();
const listeners = new Set<() => void>();
const allowedHosts = new Set<string>();

function emit() {
  stats = { ...stats };
  listeners.forEach((l) => l());
}

export function getNetworkStats(): NetworkStats {
  return stats;
}

export function subscribeNetworkStats(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Temporarily allow named hosts (user-initiated, e.g. one-time model download). */
export function allowHosts(hosts: string[]): void {
  hosts.forEach((h) => allowedHosts.add(h.toLowerCase()));
}
export function clearAllowedHosts(): void {
  allowedHosts.clear();
}

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

export type Verdict = 'same-origin' | 'loopback' | 'allowlisted' | 'blocked';

export function classifyUrl(rawUrl: string, baseOrigin?: string): Verdict {
  const base = baseOrigin ?? (typeof location !== 'undefined' ? location.href : 'http://localhost/');
  let u: URL;
  try {
    u = new URL(rawUrl, base);
  } catch {
    return 'blocked';
  }
  if (u.protocol === 'data:' || u.protocol === 'blob:') return 'same-origin';
  const baseUrl = new URL(base);
  if (u.origin === baseUrl.origin) return 'same-origin';
  if (LOOPBACK.has(u.hostname)) return 'loopback';
  if (allowedHosts.has(u.hostname.toLowerCase())) return 'allowlisted';
  return 'blocked';
}

export function bodySize(body: unknown): number {
  if (body == null) return 0;
  if (typeof body === 'string') return new TextEncoder().encode(body).length;
  if (typeof Blob !== 'undefined' && body instanceof Blob) return body.size;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body)) return (body as ArrayBufferView).byteLength;
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return new TextEncoder().encode(body.toString()).length;
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    let n = 0;
    body.forEach((v) => {
      n += typeof v === 'string' ? v.length : (v as File).size;
    });
    return n;
  }
  return 0;
}

function record(verdict: Verdict, url: string, method: string, bytes: number) {
  const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
  if (verdict === 'blocked') {
    stats.blockedRequests += 1;
    stats.blockedBytes += bytes;
    stats.lastBlocked = `${method.toUpperCase()} ${url}`.slice(0, 160);
  } else if (verdict === 'allowlisted') {
    stats.allowlistedRequests += 1;
  } else {
    stats.allowedRequests += 1;
    if (isWrite) stats.payloadBytesUploaded += bytes;
  }
  emit();
}

export function installNetworkGuard(): () => void {
  if (typeof window === 'undefined' || stats.installed) return () => undefined;
  const w = window as any;
  const origFetch: typeof fetch | undefined = w.fetch?.bind(window);
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  const origBeacon = navigator.sendBeacon?.bind(navigator);
  const OrigWS = w.WebSocket;

  if (origFetch) {
    w.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
      const method = (init?.method || (typeof input === 'object' && 'method' in (input as any) ? (input as Request).method : 'GET')) as string;
      const bytes = bodySize(init?.body);
      const verdict = classifyUrl(url);
      record(verdict, url, method, bytes);
      if (verdict === 'blocked') {
        throw new TypeError(`NETWORK_GUARD_BLOCKED: ${url}`);
      }
      return origFetch(input as any, init);
    };
  }

  XMLHttpRequest.prototype.open = function (this: any, method: string, url: string | URL, ...rest: any[]) {
    this.__ng = { method, url: String(url) };
    return (origOpen as any).call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (this: any, body?: any) {
    const meta = this.__ng || { method: 'GET', url: '' };
    const verdict = classifyUrl(meta.url);
    record(verdict, meta.url, meta.method, bodySize(body));
    if (verdict === 'blocked') {
      this.abort?.();
      throw new DOMException(`NETWORK_GUARD_BLOCKED: ${meta.url}`, 'NetworkError');
    }
    return origSend.call(this, body);
  };

  if (origBeacon) {
    (navigator as any).sendBeacon = (url: string, data?: any) => {
      const verdict = classifyUrl(url);
      record(verdict, url, 'POST', bodySize(data));
      if (verdict === 'blocked') return false;
      return origBeacon(url, data);
    };
  }

  if (OrigWS) {
    const Guarded: any = function (url: string | URL, protocols?: string | string[]) {
      const href = String(url).replace(/^ws/i, 'http');
      const verdict = classifyUrl(href);
      record(verdict, String(url), 'GET', 0);
      if (verdict === 'blocked') throw new DOMException(`NETWORK_GUARD_BLOCKED: ${url}`, 'SecurityError');
      return new OrigWS(url, protocols);
    };
    Guarded.prototype = OrigWS.prototype;
    ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach((k) => (Guarded[k] = OrigWS[k]));
    w.WebSocket = Guarded;
  }

  stats.installed = true;
  emit();

  return () => {
    if (origFetch) w.fetch = origFetch;
    XMLHttpRequest.prototype.open = origOpen;
    XMLHttpRequest.prototype.send = origSend;
    if (origBeacon) (navigator as any).sendBeacon = origBeacon;
    if (OrigWS) w.WebSocket = OrigWS;
    stats.installed = false;
    emit();
  };
}

/** Test helper. */
export function resetNetworkStats(): void {
  stats = { ...initialStats(), installed: stats.installed };
  allowedHosts.clear();
  listeners.forEach((l) => l());
}
