export type HttpMethodName =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS'
  | 'HEAD';

export interface RoutePattern {
  id: string;
  organizationId: string;
  serviceId: string;
  method: HttpMethodName;
  path: string;
  authRequired: boolean;
  rateLimitRpm: number;
  upstreamUrl: string;
  serviceName: string;
}

export interface MatchedRoute {
  route: RoutePattern;
  params: Record<string, string>;
}

/**
 * Matches `/users/:id` style patterns against request paths.
 * Exact segment counts required; no greedy catch-all in MVP.
 */
export function matchRoutePath(pattern: string, path: string): Record<string, string> | null {
  const patternParts = normalizePath(pattern).split('/').filter(Boolean);
  const pathParts = normalizePath(path).split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const expected = patternParts[i]!;
    const actual = pathParts[i]!;
    if (expected.startsWith(':')) {
      params[expected.slice(1)] = decodeURIComponent(actual);
      continue;
    }
    if (expected !== actual) {
      return null;
    }
  }
  return params;
}

export function normalizePath(path: string): string {
  if (!path.startsWith('/')) {
    return `/${path}`;
  }
  if (path.length > 1 && path.endsWith('/')) {
    return path.slice(0, -1);
  }
  return path;
}

export function findMatchingRoute(
  routes: RoutePattern[],
  method: string,
  path: string,
): MatchedRoute | null {
  const normalizedMethod = method.toUpperCase() as HttpMethodName;
  const normalizedPath = normalizePath(path);

  for (const route of routes) {
    if (route.method !== normalizedMethod) continue;
    const params = matchRoutePath(route.path, normalizedPath);
    if (params) {
      return { route, params };
    }
  }
  return null;
}

/**
 * SSRF guard: only http/https, no credentials in URL, no localhost bypass via weird hosts
 * unless explicitly allowlisted for local demo.
 */
export function isSafeUpstreamUrl(
  urlString: string,
  options: { allowLocalhost?: boolean } = {},
): boolean {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false;
  }
  if (url.username || url.password) {
    return false;
  }

  const host = url.hostname.toLowerCase();
  const isLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.localhost');

  if (isLocal && !options.allowLocalhost) {
    return false;
  }

  return true;
}

export function buildUpstreamTarget(
  upstreamBase: string,
  requestPath: string,
  queryString?: string,
): string {
  const base = upstreamBase.endsWith('/') ? upstreamBase.slice(0, -1) : upstreamBase;
  const path = normalizePath(requestPath);
  const qs = queryString && queryString.length > 0 ? `?${queryString}` : '';
  return `${base}${path}${qs}`;
}
