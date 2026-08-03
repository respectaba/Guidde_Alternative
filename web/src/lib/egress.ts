/**
 * Outbound-HTTPS helper. Node's global `fetch` (undici) ignores HTTPS_PROXY, so
 * in proxied environments (this sandbox, many corporate networks) provider calls
 * to OpenAI/ElevenLabs never leave the box. When HTTPS_PROXY is set we route the
 * fetch through an undici ProxyAgent; the proxy's CA is already trusted via
 * NODE_EXTRA_CA_CERTS. No-op (direct fetch) when no proxy is configured.
 */
import { ProxyAgent } from "undici";

let cached: ProxyAgent | null | undefined;

function dispatcher(): ProxyAgent | undefined {
  if (cached !== undefined) return cached ?? undefined;
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  cached = proxy ? new ProxyAgent(proxy) : null;
  return cached ?? undefined;
}

/** fetch() that honors HTTPS_PROXY when present. */
export function egressFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const d = dispatcher();
  // `dispatcher` is an undici extension not present in the DOM RequestInit type.
  return fetch(url, d ? ({ ...init, dispatcher: d } as RequestInit) : init);
}
