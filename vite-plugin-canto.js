// Vite dev-server plugin: Canto DAM search + image proxy
// Mirrors the cantoflow-master backend pattern, but as Vite middleware
// so the whole tool runs from a single `npm run dev`.
//
// Required env (read from .env.local at repo root):
//   CANTO_DOMAIN       e.g. medartis.canto.global   (no scheme)
// Plus ONE of:
//   CANTO_ACCESS_TOKEN (pre-generated, easiest)
//   CANTO_APP_ID + CANTO_APP_SECRET (OAuth client-credentials)
//
// Routes:
//   GET /api/canto/status                         → { configured, mode }
//   GET /api/canto/search?q=&limit=&start=        → { results, total }
//   GET /api/canto/proxy-image?url=               → image bytes

import https from 'node:https';
import http from 'node:http';
import { URL, URLSearchParams } from 'node:url';

// Canto OAuth lives at the same regional TLD as the tenant
// medartis.canto.de  ↔  oauth.canto.de
// medartis.canto.com ↔ oauth.canto.com
// fallback (any other) ↔ oauth.canto.global
function oauthUrlFor(domain) {
  if (process.env.CANTO_OAUTH_URL) return process.env.CANTO_OAUTH_URL.replace(/\/$/, '') + '/token';
  if (!domain) return 'https://oauth.canto.global/oauth/api/oauth2/token';
  const m = domain.match(/canto\.(de|com|global)$/i);
  const tld = m ? m[1].toLowerCase() : 'global';
  return `https://oauth.canto.${tld}/oauth/api/oauth2/token`;
}

// Simple in-memory token cache
let tokenCache = { token: null, expiresAt: 0 };

function jsonFetch(urlStr, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        method,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const text = buf.toString('utf8');
          let data;
          try { data = JSON.parse(text); } catch { data = text; }
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${typeof data === 'string' ? data : JSON.stringify(data)}`));
          } else {
            resolve(data);
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function streamFetch(urlStr, { headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        method: 'GET',
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        headers,
      },
      (res) => {
        // follow one redirect (Canto returns 302 to a signed S3-style URL sometimes)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          streamFetch(res.headers.location, { headers: {} }).then(resolve, reject);
          return;
        }
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        resolve(res);
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function getAccessToken() {
  // Pre-generated token wins
  if (process.env.CANTO_ACCESS_TOKEN) return process.env.CANTO_ACCESS_TOKEN;

  const appId = process.env.CANTO_APP_ID;
  const appSecret = process.env.CANTO_APP_SECRET;
  if (!appId || !appSecret) throw new Error('No Canto credentials configured');

  // Cached?
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 30_000) {
    return tokenCache.token;
  }

  const body = new URLSearchParams();
  body.append('app_id', appId);
  body.append('app_secret', appSecret);
  body.append('grant_type', 'client_credentials');

  const data = await jsonFetch(oauthUrlFor(process.env.CANTO_DOMAIN), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const token = data.accessToken || data.access_token;
  const ttlSec = data.expiresIn || data.expires_in || 3600;
  if (!token) throw new Error('Canto OAuth returned no token: ' + JSON.stringify(data));
  tokenCache = { token, expiresAt: Date.now() + ttlSec * 1000 };
  return token;
}

function statusInfo() {
  const domain = process.env.CANTO_DOMAIN;
  if (!domain) return { configured: false, reason: 'CANTO_DOMAIN not set' };
  if (process.env.CANTO_ACCESS_TOKEN) return { configured: true, mode: 'token', domain };
  if (process.env.CANTO_APP_ID && process.env.CANTO_APP_SECRET) {
    return { configured: true, mode: 'oauth', domain };
  }
  return { configured: false, reason: 'No CANTO_ACCESS_TOKEN or APP_ID/APP_SECRET set' };
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

export default function cantoPlugin() {
  return {
    name: 'canto-dev-server',
    configureServer(server) {
      // Status — no auth needed
      server.middlewares.use('/api/canto/status', (req, res) => {
        sendJson(res, 200, statusInfo());
      });

      // Search
      server.middlewares.use('/api/canto/search', async (req, res) => {
        try {
          const status = statusInfo();
          if (!status.configured) {
            return sendJson(res, 500, { error: status.reason });
          }
          const url = new URL(req.url, 'http://localhost');
          const keyword = url.searchParams.get('q') || url.searchParams.get('keyword') || '';
          const limit = url.searchParams.get('limit') || '60';
          const start = url.searchParams.get('start') || '0';
          // Default to image scheme so albums/folders don't pollute thumbnail grid;
          // callers can pass scheme= to override (e.g. "image|video|document").
          const scheme = url.searchParams.get('scheme') || 'image';

          const token = await getAccessToken();
          const params = new URLSearchParams({
            keyword: keyword || '*',
            limit,
            start,
            scheme,
          });
          const data = await jsonFetch(
            `https://${status.domain}/api/v1/search?${params}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          // Canto returns pre-signed CloudFront URLs for `directUrlOriginal` and
          // `directUrlPreview` — these are public (CORS *), need no auth header,
          // and serve the FULL resolution (original up to ~10k px wide).
          // We hand them straight to the browser. Only fall back to the
          // auth-required api_binary endpoints (via proxy) when an asset is
          // missing the direct URLs.
          const proxy = (u) => u ? `/api/canto/proxy-image?url=${encodeURIComponent(u)}` : '';
          const directOrProxy = (direct, fallback) => direct || proxy(fallback);

          const results = (data.results || []).map((a) => {
            const u = a.url || {};
            return {
              id: a.id,
              name: a.name || 'Untitled',
              scheme: a.scheme,
              width: a.width,
              height: a.height,
              size: a.size,
              dpi: a.dpi,
              // Thumbnail: 800px direct URL (no auth, no proxy) is plenty for grid
              previewUrl: directOrProxy(u.directUrlPreview, u.preview || u.LowJPG),
              // Full-resolution for canvas: original direct URL (no auth, no proxy)
              originalUrl: directOrProxy(
                u.directUrlOriginal,
                u.PNG || u.HighJPG || u.download || u.preview
              ),
            };
          });
          sendJson(res, 200, { results, total: data.found || results.length });
        } catch (err) {
          console.error('[canto] search failed:', err.message);
          sendJson(res, 500, { error: err.message });
        }
      });

      // Image proxy — strips/applies the auth header, streams bytes
      server.middlewares.use('/api/canto/proxy-image', async (req, res) => {
        try {
          const url = new URL(req.url, 'http://localhost');
          const target = url.searchParams.get('url');
          if (!target) {
            res.statusCode = 400;
            return res.end('missing url');
          }
          const token = await getAccessToken();
          const upstream = await streamFetch(target, {
            headers: { Authorization: `Bearer ${token}` },
          });
          res.setHeader(
            'Content-Type',
            upstream.headers['content-type'] || 'image/jpeg'
          );
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader('Access-Control-Allow-Origin', '*');
          upstream.pipe(res);
        } catch (err) {
          console.error('[canto] proxy-image failed:', err.message);
          res.statusCode = 502;
          res.end('image fetch failed');
        }
      });
    },
  };
}
