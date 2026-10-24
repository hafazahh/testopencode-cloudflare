/**
 * SKELETON Fase B — security headers untuk testopencode.
 *
 * Port dari `app.py` (`SECURITY_HEADERS` + `HSTS_VALUE` + `apply_security_headers`):
 *   CSP, X-Content-Type-Options: nosniff, X-Frame-Options: DENY,
 *   Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy,
 *   Cross-Origin-Opener-Policy: same-origin,
 *   Cross-Origin-Resource-Policy: same-origin,
 *   HSTS `max-age=31536000; includeSubDomains` (hanya over HTTPS, TANPA preload).
 *
 * PITFALL dari Fase 3b port Flask: CSP `script-src 'self'` memblokir SEMUA
 * inline `<script>` dan atribut `on*`. Itu yang pernah mematikan tombol
 * "+ Tambah Item" dan `onsubmit=confirm(...)`. Port harus pakai nonce +
 * file .js eksternal, bukan longgarkan CSP.
 */

export function securityHeaders(_nonce: string, _isSecure: boolean): Record<string, string> {
  // Diisi Fase D.
  return {};
}
