/**
 * Outbound-HTTPS helper. Node's global `fetch` (its internal undici) ignores
 * HTTPS_PROXY, so in proxied environments (dev sandboxes, some corporate
 * networks) provider calls to OpenAI/ElevenLabs/Google never leave the box.
 *
 * When HTTPS_PROXY is set we route through an undici ProxyAgent — using undici's
 * OWN fetch, because a ProxyAgent from the npm `undici` package is not accepted
 * as a `dispatcher` by Node's *internal* undici (UND_ERR_INVALID_ARG). The
 * proxy's CA is trusted via NODE_EXTRA_CA_CERTS.
 *
 * undici is imported LAZILY and only when a proxy is configured, so production
 * (no proxy → plain global fetch) never loads it. This also keeps undici out of
 * the build-time module graph, where evaluating it can fail on some Node builds.
 */
type UndiciModule = typeof import("undici");

let undiciP: Promise<UndiciModule> | null = null;
let agent: InstanceType<UndiciModule["ProxyAgent"]> | null = null;

function proxyUrl(): string | undefined {
  return process.env.HTTPS_PROXY || process.env.https_proxy || undefined;
}

/** fetch() that honors HTTPS_PROXY when present; plain global fetch otherwise. */
export async function egressFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const proxy = proxyUrl();
  if (!proxy) return fetch(url, init);

  if (!undiciP) undiciP = import("undici");
  const { fetch: undiciFetch, ProxyAgent } = await undiciP;
  if (!agent) agent = new ProxyAgent(proxy);
  return undiciFetch(url, {
    ...(init as Record<string, unknown>),
    dispatcher: agent,
  }) as unknown as Promise<Response>;
}
