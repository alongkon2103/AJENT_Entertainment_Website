/** Retired production domains must never leak back into canonical or preview URLs from an old PM2 environment. */
export function resolveSiteUrl(value = "http://localhost:3000") {
  const url = new URL(value.trim());
  if (["ajentmedia.com", "www.ajentmedia.com"].includes(url.hostname.toLowerCase())) {
    return "https://judystudiox.com";
  }
  return url.href.replace(/\/+$/, "");
}
