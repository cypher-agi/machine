import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

// Data directory for key storage
const DATA_DIR = path.join(process.cwd(), '.data');
const KEY_FILE = path.join(DATA_DIR, '.encryption_key');

/**
 * Get or create master encryption key
 * Uses env var if set, otherwise uses/creates persistent key file
 */
function getMasterKey(): string {
  if (process.env.ENCRYPTION_KEY) {
    return process.env.ENCRYPTION_KEY;
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(KEY_FILE)) {
    return fs.readFileSync(KEY_FILE, 'utf8').trim();
  }

  const newKey = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(KEY_FILE, newKey, { mode: 0o600 });
  console.log('🔐 Generated new encryption key');
  return newKey;
}

const MASTER_KEY = getMasterKey();
const ALGORITHM = 'aes-256-gcm';

/**
 * Derive a team-specific encryption key using HKDF
 * This ensures each team's credentials are encrypted with a unique key
 */
function deriveTeamKey(teamId: string): Buffer {
  const salt = Buffer.from('machina-integration-v1', 'utf8');
  const info = Buffer.from(`team:${teamId}:credentials`, 'utf8');

  const keyBuffer = crypto.hkdfSync('sha256', Buffer.from(MASTER_KEY, 'hex'), salt, info, 32);
  return Buffer.from(keyBuffer);
}

/**
 * Encrypt credentials with team-specific key and AAD binding
 */
export function encryptCredentials(
  teamId: string,
  integrationId: string,
  credentials: Record<string, unknown>
): string {
  const key = deriveTeamKey(teamId);
  const iv = crypto.randomBytes(16);

  // AAD binds the ciphertext to this specific team and integration
  // Prevents ciphertext from being "moved" to another team
  const aad = Buffer.from(`${teamId}:${integrationId}`, 'utf8');

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(aad);

  const plaintext = JSON.stringify(credentials);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt credentials - validates team binding
 */
export function decryptCredentials(
  teamId: string,
  integrationId: string,
  encryptedData: string
): Record<string, unknown> {
  const [ivHex, authTagHex, ciphertext] = encryptedData.split(':');
  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error('Invalid encrypted credential format');
  }

  const key = deriveTeamKey(teamId);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const aad = Buffer.from(`${teamId}:${integrationId}`, 'utf8');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

/**
 * Generate secure OAuth state with HMAC
 * Prevents CSRF and callback hijacking
 */
export function generateOAuthState(teamId: string, userId: string): string {
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = `${teamId}:${userId}:${timestamp}:${nonce}`;

  // HMAC prevents tampering
  const hmac = crypto.createHmac('sha256', MASTER_KEY).update(payload).digest('hex');

  // Base64 encode for URL safety
  return Buffer.from(`${payload}:${hmac}`).toString('base64url');
}

/**
 * Validate OAuth state - checks HMAC and expiry
 */
export function validateOAuthState(
  state: string,
  maxAgeMs: number = 10 * 60 * 1000 // 10 minutes
): { teamId: string; userId: string } | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 5) return null;

    const [teamId, userId, timestampStr, nonce, providedHmac] = parts;
    if (!teamId || !userId || !timestampStr || !nonce || !providedHmac) return null;

    const timestamp = parseInt(timestampStr, 10);

    // Check expiry
    if (Date.now() - timestamp > maxAgeMs) return null;

    // Verify HMAC
    const payload = `${teamId}:${userId}:${timestamp}:${nonce}`;
    const expectedHmac = crypto.createHmac('sha256', MASTER_KEY).update(payload).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(providedHmac), Buffer.from(expectedHmac))) {
      return null;
    }

    return { teamId, userId };
  } catch {
    return null;
  }
}
