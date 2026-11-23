/** Keeps the proxy setting alias so existing environment files continue to work. */
export function trustedProxiesFromEnv(env: Record<string, string | undefined>): string[] | undefined {
  const proxies = (env.BLEX_TRUSTED_PROXIES ?? env.TRUSTED_PROXY_IPS)
    ?.split(',')
    .map((proxy) => proxy.trim())
    .filter(Boolean);
  return proxies?.length ? proxies : undefined;
}
