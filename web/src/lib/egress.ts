/**
 * Outbound-HTTPS helper. Node's global `fetch` (its internal undici) ignores
 * HTTPS_PROXY, so in proxied environments (this sandbox, many corporate networks)
 * provider calls to OpenAI/ElevenLabs/Google never leave the box.
 *
 * When HTTPS_PROXY is set we route through an undici ProxyAgent — using undici's
 * OWN fetch, because a ProxyAgent from the npm `undici` package is not accepted as
 * a `dispatcher` by Node's *internal* undici (UND_ERR_INVALID_ARG). The proxy's
 * CA is trusted via NODE_EXTRA_CA_CERTS. With no proxy configured this is a plain
 * global fetch, so production is unaffected.
 */
import { fetch as undiciFetch, ProxyAgent } from "undici";

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
  if (!d) return fetch(url, init);
  // undici's fetch + its own ProxyAgent (same instance) — Response is compatible.
  return undiciFetch(url, { ...(init as Record<string, unknown>), dispatcher: d }) as unknown as Promise<Response>;
}
