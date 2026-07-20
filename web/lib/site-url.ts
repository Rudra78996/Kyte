const sitesDomain =
  process.env.NEXT_PUBLIC_SITES_DOMAIN?.trim() || "sites.localhost";
const sitesScheme =
  process.env.NEXT_PUBLIC_SITES_SCHEME?.trim() ||
  (sitesDomain.endsWith(".localhost") ? "http" : "https");

export function siteHostname(subdomain: string) {
  return `${subdomain}.${sitesDomain}`;
}

export function siteUrl(subdomain: string, path = "") {
  const normalizedPath = path && !path.startsWith("/") ? `/${path}` : path;
  return `${sitesScheme}://${siteHostname(subdomain)}${normalizedPath}`;
}
