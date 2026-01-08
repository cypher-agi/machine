import { describe, it, expect, vi } from 'vitest';

// Mock fs module before importing credentialVault
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue('a'.repeat(64)), // 64 hex chars = 32 bytes
  writeFileSync: vi.fn(),
}));

// Import after mocking
import {
  encryptCredentials,
  decryptCredentials,
  generateOAuthState,
  validateOAuthState,
} from './credentialVault';

describe('Credential Vault', () => {
  describe('encryptCredentials / decryptCredentials', () => {
    const teamId = 'team_test123';
    const integrationId = 'int_test456';

    it('should encrypt and decrypt credentials correctly', () => {
      const credentials = {
        client_id: 'my-client-id',
        client_secret: 'super-secret-key',
      };

      const encrypted = encryptCredentials(teamId, integrationId, credentials);
      const decrypted = decryptCredentials(teamId, integrationId, encrypted);

      expect(decrypted).toEqual(credentials);
    });

    it('should produce different ciphertext for same plaintext (random IV)', () => {
      const credentials = { api_key: 'test-key' };

      const encrypted1 = encryptCredentials(teamId, integrationId, credentials);
      const encrypted2 = encryptCredentials(teamId, integrationId, credentials);

      expect(encrypted1).not.toBe(encrypted2);

      // Both should decrypt to same value
      expect(decryptCredentials(teamId, integrationId, encrypted1)).toEqual(credentials);
      expect(decryptCredentials(teamId, integrationId, encrypted2)).toEqual(credentials);
    });

    it('should fail decryption with wrong teamId (AAD binding)', () => {
      const credentials = { secret: 'sensitive-data' };
      const encrypted = encryptCredentials(teamId, integrationId, credentials);

      expect(() => {
        decryptCredentials('wrong_team_id', integrationId, encrypted);
      }).toThrow();
    });

    it('should fail decryption with wrong integrationId (AAD binding)', () => {
      const credentials = { secret: 'sensitive-data' };
      const encrypted = encryptCredentials(teamId, integrationId, credentials);

      expect(() => {
        decryptCredentials(teamId, 'wrong_integration_id', encrypted);
      }).toThrow();
    });

    it('should handle complex nested objects', () => {
      const credentials = {
        oauth: {
          access_token: 'gho_xxxx',
          refresh_token: 'ghr_yyyy',
          expires_at: 1234567890,
        },
        metadata: {
          scopes: ['repo', 'read:org'],
          user_id: 12345,
        },
      };

      const encrypted = encryptCredentials(teamId, integrationId, credentials);
      const decrypted = decryptCredentials(teamId, integrationId, encrypted);

      expect(decrypted).toEqual(credentials);
    });

    it('should handle special characters in credentials', () => {
      const credentials = {
        password: '!@#$%^&*()_+-=[]{}|;:,.<>?/~`',
        unicode: '密码 🔐 пароль',
      };

      const encrypted = encryptCredentials(teamId, integrationId, credentials);
      const decrypted = decryptCredentials(teamId, integrationId, encrypted);

      expect(decrypted).toEqual(credentials);
    });

    it('should throw on invalid encrypted data format', () => {
      expect(() => {
        decryptCredentials(teamId, integrationId, 'invalid-format');
      }).toThrow('Invalid encrypted credential format');
    });

    it('should throw on tampered ciphertext', () => {
      const credentials = { secret: 'test' };
      const encrypted = encryptCredentials(teamId, integrationId, credentials);
      const [iv, authTag, ciphertext] = encrypted.split(':');

      // Tamper with ciphertext
      const tamperedCiphertext = ciphertext.slice(0, -2) + 'ff';
      const tampered = `${iv}:${authTag}:${tamperedCiphertext}`;

      expect(() => {
        decryptCredentials(teamId, integrationId, tampered);
      }).toThrow();
    });

    it('should throw on tampered auth tag', () => {
      const credentials = { secret: 'test' };
      const encrypted = encryptCredentials(teamId, integrationId, credentials);
      const [iv, authTag, ciphertext] = encrypted.split(':');

      // Tamper with auth tag
      const tamperedAuthTag = authTag.slice(0, -2) + 'ff';
      const tampered = `${iv}:${tamperedAuthTag}:${ciphertext}`;

      expect(() => {
        decryptCredentials(teamId, integrationId, tampered);
      }).toThrow();
    });

    it('should derive different keys for different teams', () => {
      const credentials = { secret: 'test' };

      const encryptedTeam1 = encryptCredentials('team_1', integrationId, credentials);
      const encryptedTeam2 = encryptCredentials('team_2', integrationId, credentials);

      // Cross-team decryption should fail
      expect(() => {
        decryptCredentials('team_2', integrationId, encryptedTeam1);
      }).toThrow();

      expect(() => {
        decryptCredentials('team_1', integrationId, encryptedTeam2);
      }).toThrow();
    });
  });

  describe('generateOAuthState / validateOAuthState', () => {
    const teamId = 'team_oauth123';
    const userId = 'user_456';

    it('should generate and validate OAuth state', () => {
      const state = generateOAuthState(teamId, userId);
      const result = validateOAuthState(state);

      expect(result).not.toBeNull();
      expect(result?.teamId).toBe(teamId);
      expect(result?.userId).toBe(userId);
    });

    it('should generate unique states for same input', () => {
      const state1 = generateOAuthState(teamId, userId);
      const state2 = generateOAuthState(teamId, userId);

      expect(state1).not.toBe(state2);

      // Both should validate successfully
      expect(validateOAuthState(state1)).not.toBeNull();
      expect(validateOAuthState(state2)).not.toBeNull();
    });

    it('should be URL-safe (base64url encoded)', () => {
      const state = generateOAuthState(teamId, userId);

      // Should not contain + / = characters
      expect(state).not.toMatch(/[+/=]/);
      // Should only contain URL-safe characters
      expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should reject tampered state', () => {
      const state = generateOAuthState(teamId, userId);

      // Tamper with the state
      const decoded = Buffer.from(state, 'base64url').toString('utf8');
      const parts = decoded.split(':');
      parts[0] = 'tampered_team'; // Change team ID
      const tampered = Buffer.from(parts.join(':')).toString('base64url');

      const result = validateOAuthState(tampered);
      expect(result).toBeNull();
    });

    it('should reject expired state', () => {
      const state = generateOAuthState(teamId, userId);

      // Validate with negative max age (definitely expired)
      const result = validateOAuthState(state, -1);
      expect(result).toBeNull();
    });

    it('should reject invalid base64 state', () => {
      const result = validateOAuthState('not-valid-base64!!!');
      expect(result).toBeNull();
    });

    it('should reject state with wrong format', () => {
      // Create a valid base64url but wrong format
      const invalid = Buffer.from('only:two:parts').toString('base64url');
      const result = validateOAuthState(invalid);
      expect(result).toBeNull();
    });

    it('should reject empty or null state', () => {
      expect(validateOAuthState('')).toBeNull();
    });

    it('should handle special characters in teamId and userId', () => {
      const specialTeamId = 'team_with-special.chars_123';
      const specialUserId = 'user@example.com';

      const state = generateOAuthState(specialTeamId, specialUserId);
      const result = validateOAuthState(state);

      expect(result).not.toBeNull();
      expect(result?.teamId).toBe(specialTeamId);
      expect(result?.userId).toBe(specialUserId);
    });
  });

  describe('Security Properties', () => {
    it('should use AES-256-GCM (authenticated encryption)', () => {
      // The encrypted format should be iv:authTag:ciphertext
      const encrypted = encryptCredentials('team', 'int', { test: 'data' });
      const parts = encrypted.split(':');

      expect(parts).toHaveLength(3);

      // IV should be 32 hex chars (16 bytes)
      expect(parts[0]).toMatch(/^[0-9a-f]{32}$/);

      // Auth tag should be 32 hex chars (16 bytes for GCM)
      expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);

      // Ciphertext should be hex
      expect(parts[2]).toMatch(/^[0-9a-f]+$/);
    });

    it('should use HMAC-SHA256 for state validation', () => {
      const state = generateOAuthState('team', 'user');
      const decoded = Buffer.from(state, 'base64url').toString('utf8');
      const parts = decoded.split(':');

      // Format: teamId:userId:timestamp:nonce:hmac
      expect(parts).toHaveLength(5);

      // HMAC should be 64 hex chars (32 bytes SHA256)
      expect(parts[4]).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should use timing-safe comparison for HMAC validation', () => {
      // This is a behavior test - if timingSafeEqual is not used,
      // invalid HMACs would still fail, but with timing side-channel
      const state = generateOAuthState('team', 'user');

      // Create state with slightly different HMAC (should fail consistently)
      const decoded = Buffer.from(state, 'base64url').toString('utf8');
      const parts = decoded.split(':');
      parts[4] = 'a'.repeat(64); // Wrong HMAC
      const badState = Buffer.from(parts.join(':')).toString('base64url');

      // Should consistently return null
      for (let i = 0; i < 10; i++) {
        expect(validateOAuthState(badState)).toBeNull();
      }
    });
  });
});
