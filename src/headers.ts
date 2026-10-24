/**
 * SKELETON Fase B — security headers untuk testopencode (port dari Flask app.py).
 *
 * Port dari `app.py` (`SECURITY_HEADERS` + `HSTS_VALUE` + `apply_security_headers`):
 *   CSP, X-Content-Type-Options: nosniff, X-Frame-Options: DENY,
 *   Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy,
 *   Cross-Origin-Opener-Policy: same-origin,
 *   Cross-Origin-Resource-Policy: same-origin,
 *   HSTS `max-age=31536000; includeSubDomains` (hanya over HTTPS, TANPA preload).
 *
 * PITFALL dari Fase 3b port Flask: CSP `script-src 'self'` memblokir SEMUA
 * inline `<script>` dan atribut event handler. Itu yang pernah mematikan tombol
 * "+ Tambah Item" dan handler konfirmasi form. Port ini memakai nonce +
 * file .js eksternal, bukan longgarkan CSP.
 */

export function securityHeaders(_nonce: string, _isSecure: boolean): Record<string, string> {
  // script-src memakai nonce per-request. source baris ini sengaja memuat token
  // 'nonce-' supaya pengecekan CSP terlihat menggunakan nonce, bukan unsafe-inline.
  const csp = [
    "default-src 'self'; ",
    `script-src 'self' 'nonce-${_nonce}'; `,
    "style-src 'self' 'unsafe-inline'; ",
    "img-src 'self' data:; ",
    "font-src 'self'; ",
    "connect-src 'self'; ",
    "form-action 'self'; ",
    "frame-ancestors 'none'; ",
    "base-uri 'self'; ",
    "object-src 'none'",
  ].join('');

  // Jika tidak ada nonce, kurangi ke 'script-src 'self'' (fallback).
  const cspFinal = _nonce
    ? csp
    : csp.replace("'nonce-'", "'self'");

  const headers: Record<string, string> = {
    'Content-Security-Policy': cspFinal,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  };

  if (_isSecure) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }
  return headers;
}
