/** BLEX 3.x used TRUSTED_PROXY_IPS, so upgraded environment files keep their proxy list. */
export function trustedProxiesFromEnv(env: Record<string, string | undefined>): string[] | undefined {
  const proxies = (env.BLEX_TRUSTED_PROXIES ?? env.TRUSTED_PROXY_IPS)
    ?.split(',')
    .map((proxy) => proxy.trim())
    .filter(Boolean);
  return proxies?.length ? proxies : undefined;
}
