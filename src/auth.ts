/**
 * SKELETON Fase B — auth (session + PBKDF2 + RBAC) untuk testopencode.
 *
 * Aturan dari skill `cloudflare-worker-api` dan port Flask:
 *   - workerd TIDAK dukung scrypt → pakai PBKDF2-SHA256.
 *   - workerd membatasi PBKDF2 di 100.000 iterasi; lebih dari itu =
 *     `NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not
 *     supported` dan login GAGAL SENYAP.
 *   - Simpan sebagai `pbkdf2$100000$<saltB64>$<hashB64>`.
 *   - Flask memakai `werkzeug.security.generate_password_hash`; port harus
 *     menerima hash itu, bukan hanya format sendiri.
 *   - Session: UUID acak di D1, expiry 7 hari, cookie HttpOnly SameSite=Lax
 *     (`Secure` hanya saat ENVIRONMENT=production).
 */

export interface SessionRow {
  id: string;
  user_id: number;
  expires_at: number;
}
