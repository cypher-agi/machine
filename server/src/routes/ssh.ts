import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { database } from '../services/database';
import { 
  SSHKey,
  SSHKeyCreateRequest,
  SSHKeyImportRequest,
  SSHKeyGenerateResponse,
  ApiResponse
} from '@machina/shared';
import { AppError } from '../middleware/errorHandler';
import { getCredentials } from '../services/terraform';

export const sshRouter = Router();

// Helper to generate SSH key using ssh-keygen
async function generateSSHKey(
  keyType: 'ed25519' | 'rsa' | 'ecdsa' = 'ed25519',
  keyBits: number = 4096,
  comment: string = ''
): Promise<{ publicKey: string; privateKey: string; fingerprint: string }> {
  return new Promise((resolve, reject) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssh-'));
    const keyPath = path.join(tmpDir, 'id_key');

    const args = [
      '-t', keyType,
      '-f', keyPath,
      '-N', '', // No passphrase
      '-C', comment || `machine-${Date.now()}`
    ];

    // RSA-specific options
    if (keyType === 'rsa') {
      args.push('-b', String(keyBits));
    }

    const proc = spawn('ssh-keygen', args, { stdio: 'pipe' });

    let stderr = '';
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      try {
        if (code !== 0) {
          reject(new Error(`ssh-keygen failed: ${stderr}`));
          return;
        }

        // Read the generated keys
        const privateKey = fs.readFileSync(keyPath, 'utf8');
        const publicKey = fs.readFileSync(`${keyPath}.pub`, 'utf8').trim();

        // Get fingerprint using ssh-keygen -l
        const fingerprintProc = spawn('ssh-keygen', ['-l', '-f', `${keyPath}.pub`], { stdio: 'pipe' });
        let fingerprintOutput = '';
        
        fingerprintProc.stdout.on('data', (data) => {
          fingerprintOutput += data.toString();
        });

        fingerprintProc.on('close', () => {
          // Cleanup temp files
          try {
            fs.unlinkSync(keyPath);
            fs.unlinkSync(`${keyPath}.pub`);
            fs.rmdirSync(tmpDir);
          } catch (e) {
            // Ignore cleanup errors
          }

          // Parse fingerprint (format: "256 SHA256:xxxx comment (ED25519)")
          const fingerprintMatch = fingerprintOutput.match(/SHA256:([A-Za-z0-9+/=]+)/);
          const fingerprint = fingerprintMatch ? `SHA256:${fingerprintMatch[1]}` : '';

          resolve({ publicKey, privateKey, fingerprint });
        });
      } catch (error: any) {
        // Cleanup on error
        try {
          fs.unlinkSync(keyPath);
          fs.unlinkSync(`${keyPath}.pub`);
          fs.rmdirSync(tmpDir);
        } catch (e) {
          // Ignore cleanup errors
        }
        reject(error);
      }
    });

    proc.on('error', (error) => {
      reject(new Error(`Failed to run ssh-keygen: ${error.message}. Make sure OpenSSH is installed.`));
    });
  });
}

// Helper to calculate fingerprint from public key
function calculateFingerprint(publicKey: string): string {
  // Parse the public key to extract the base64 part
  const parts = publicKey.trim().split(' ');
  if (parts.length < 2) {
    throw new Error('Invalid public key format');
  }
  
  const keyData = Buffer.from(parts[1], 'base64');
  const hash = crypto.createHash('sha256').update(keyData).digest('base64');
  // Remove trailing = padding
  return `SHA256:${hash.replace(/=+$/, '')}`;
}

// Helper to determine key type from public key
function getKeyTypeFromPublicKey(publicKey: string): { type: 'ed25519' | 'rsa' | 'ecdsa'; bits: number } {
  const parts = publicKey.trim().split(' ');
  const keyType = parts[0];
  
  if (keyType === 'ssh-ed25519') {
    return { type: 'ed25519', bits: 256 };
  } else if (keyType === 'ssh-rsa') {
    // Estimate RSA bits from key length
    const keyData = Buffer.from(parts[1], 'base64');
    const bits = Math.round(keyData.length * 8 / 1.2); // Rough estimate
    return { type: 'rsa', bits: bits >= 4096 ? 4096 : bits >= 2048 ? 2048 : 1024 };
  } else if (keyType.startsWith('ecdsa-')) {
    const bitsMatch = keyType.match(/nistp(\d+)/);
    return { type: 'ecdsa', bits: bitsMatch ? parseInt(bitsMatch[1]) : 256 };
  }
  
  return { type: 'rsa', bits: 2048 };
}

// GET /ssh/keys - List all SSH keys
sshRouter.get('/keys', (_req: Request, res: Response) => {
  const keys = database.getSSHKeys();

  const response: ApiResponse<SSHKey[]> = {
    success: true,
    data: keys
  };

  res.json(response);
});

// GET /ssh/keys/:id - Get single SSH key
sshRouter.get('/keys/:id', (req: Request, res: Response) => {
  const key = database.getSSHKey(req.params.id);

  if (!key) {
    throw new AppError(404, 'SSH_KEY_NOT_FOUND', `SSH key ${req.params.id} not found`);
  }

  const response: ApiResponse<SSHKey> = {
    success: true,
    data: key
  };

  res.json(response);
});

// POST /ssh/keys/generate - Generate a new SSH key pair
sshRouter.post('/keys/generate', async (req: Request, res: Response) => {
  const body: SSHKeyCreateRequest = req.body;

  if (!body.name) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Missing required field: name');
  }

  const keyType = body.key_type || 'ed25519';
  const keyBits = body.key_bits || 4096;
  const comment = body.comment || `machine-key-${body.name}`;

  // Generate the key pair
  let keyData;
  try {
    keyData = await generateSSHKey(keyType, keyBits, comment);
  } catch (error: any) {
    throw new AppError(500, 'KEY_GENERATION_FAILED', `Failed to generate SSH key: ${error.message}`);
  }

  // Check for duplicate fingerprint
  const existingKey = database.getSSHKeyByFingerprint(keyData.fingerprint);
  if (existingKey) {
    throw new AppError(409, 'DUPLICATE_KEY', `An SSH key with this fingerprint already exists: ${existingKey.name}`);
  }

  const keyId = `sshkey_${uuidv4().substring(0, 12)}`;

  const newKey: SSHKey = {
    ssh_key_id: keyId,
    name: body.name,
    fingerprint: keyData.fingerprint,
    public_key: keyData.publicKey,
    key_type: keyType,
    key_bits: keyType === 'ed25519' ? 256 : keyBits,
    comment,
    provider_key_ids: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Save to database
  database.insertSSHKey(newKey);
  
  // Store encrypted private key
  database.storeSSHKeyPrivateKey(keyId, keyData.privateKey);

  const response: ApiResponse<SSHKeyGenerateResponse> = {
    success: true,
    data: {
      ...newKey,
      private_key: keyData.privateKey
    }
  };

  res.status(201).json(response);
});

// POST /ssh/keys/import - Import an existing SSH key
sshRouter.post('/keys/import', (req: Request, res: Response) => {
  const body: SSHKeyImportRequest = req.body;

  if (!body.name || !body.public_key) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Missing required fields: name and public_key');
  }

  // Validate and parse public key
  let fingerprint: string;
  let keyInfo: { type: 'ed25519' | 'rsa' | 'ecdsa'; bits: number };
  
  try {
    fingerprint = calculateFingerprint(body.public_key);
    keyInfo = getKeyTypeFromPublicKey(body.public_key);
  } catch (error: any) {
    throw new AppError(400, 'INVALID_KEY', `Invalid public key format: ${error.message}`);
  }

  // Check for duplicate fingerprint
  const existingKey = database.getSSHKeyByFingerprint(fingerprint);
  if (existingKey) {
    throw new AppError(409, 'DUPLICATE_KEY', `An SSH key with this fingerprint already exists: ${existingKey.name}`);
  }

  // Extract comment from public key if not provided
  const publicKeyParts = body.public_key.trim().split(' ');
  const keyComment = body.comment || (publicKeyParts.length > 2 ? publicKeyParts.slice(2).join(' ') : undefined);

  const keyId = `sshkey_${uuidv4().substring(0, 12)}`;

  const newKey: SSHKey = {
    ssh_key_id: keyId,
    name: body.name,
    fingerprint,
    public_key: body.public_key.trim(),
    key_type: keyInfo.type,
    key_bits: keyInfo.bits,
    comment: keyComment,
    provider_key_ids: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Save to database
  database.insertSSHKey(newKey);

  // If private key is provided, store it encrypted
  if (body.private_key) {
    database.storeSSHKeyPrivateKey(keyId, body.private_key);
  }

  const response: ApiResponse<SSHKey> = {
    success: true,
    data: newKey
  };

  res.status(201).json(response);
});

// GET /ssh/keys/:id/private - Download private key (one-time or authorized access)
sshRouter.get('/keys/:id/private', (req: Request, res: Response) => {
  const key = database.getSSHKey(req.params.id);

  if (!key) {
    throw new AppError(404, 'SSH_KEY_NOT_FOUND', `SSH key ${req.params.id} not found`);
  }

  const privateKey = database.getSSHKeyPrivateKey(req.params.id);

  if (!privateKey) {
    throw new AppError(404, 'PRIVATE_KEY_NOT_FOUND', 'Private key not available for this SSH key');
  }

  const response: ApiResponse<{ private_key: string }> = {
    success: true,
    data: { private_key: privateKey }
  };

  res.json(response);
});

// POST /ssh/keys/:id/sync/:providerAccountId - Sync key to a provider
sshRouter.post('/keys/:id/sync/:providerAccountId', async (req: Request, res: Response) => {
  const key = database.getSSHKey(req.params.id);

  if (!key) {
    throw new AppError(404, 'SSH_KEY_NOT_FOUND', `SSH key ${req.params.id} not found`);
  }

  const providerAccount = database.getProviderAccount(req.params.providerAccountId);
  if (!providerAccount) {
    throw new AppError(404, 'ACCOUNT_NOT_FOUND', `Provider account ${req.params.providerAccountId} not found`);
  }

  const credentials = getCredentials(req.params.providerAccountId);
  if (!credentials) {
    throw new AppError(400, 'CREDENTIALS_NOT_FOUND', 'No credentials found for this provider account');
  }

  // Check if key already synced to this provider
  if (key.provider_key_ids[providerAccount.provider_type]) {
    throw new AppError(409, 'ALREADY_SYNCED', `Key already synced to ${providerAccount.provider_type}`);
  }

  // Sync based on provider type
  if (providerAccount.provider_type === 'digitalocean') {
    try {
      const response = await fetch('https://api.digitalocean.com/v2/account/keys', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.api_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: key.name,
          public_key: key.public_key
        })
      });

      if (!response.ok) {
        const error = await response.json() as { message?: string };
        throw new Error(error.message || 'Failed to upload key to DigitalOcean');
      }

      const data = await response.json() as { ssh_key: { id: number | string } };
      const providerKeyId = String(data.ssh_key.id);

      // Update provider_key_ids
      const updatedProviderKeyIds = {
        ...key.provider_key_ids,
        digitalocean: providerKeyId
      };

      database.updateSSHKey({
        ssh_key_id: key.ssh_key_id,
        provider_key_ids: updatedProviderKeyIds
      });

      const updatedKey = database.getSSHKey(key.ssh_key_id);

      const apiResponse: ApiResponse<SSHKey> = {
        success: true,
        data: updatedKey!
      };

      res.json(apiResponse);
    } catch (error: any) {
      throw new AppError(500, 'SYNC_FAILED', `Failed to sync key to DigitalOcean: ${error.message}`);
    }
  } else {
    throw new AppError(501, 'NOT_IMPLEMENTED', `Provider ${providerAccount.provider_type} sync not yet implemented`);
  }
});

// DELETE /ssh/keys/:id/sync/:providerType - Remove key from a provider
sshRouter.delete('/keys/:id/sync/:providerType', async (req: Request, res: Response) => {
  const key = database.getSSHKey(req.params.id);

  if (!key) {
    throw new AppError(404, 'SSH_KEY_NOT_FOUND', `SSH key ${req.params.id} not found`);
  }

  const providerType = req.params.providerType;
  const providerKeyId = key.provider_key_ids[providerType];

  if (!providerKeyId) {
    throw new AppError(404, 'NOT_SYNCED', `Key not synced to ${providerType}`);
  }

  // Find a provider account with credentials for this provider type
  const providerAccounts = database.getProviderAccounts();
  const account = providerAccounts.find(a => a.provider_type === providerType);
  
  if (!account) {
    throw new AppError(404, 'NO_PROVIDER_ACCOUNT', `No provider account found for ${providerType}`);
  }

  const credentials = getCredentials(account.provider_account_id);
  if (!credentials) {
    throw new AppError(400, 'CREDENTIALS_NOT_FOUND', 'No credentials found for provider');
  }

  // Remove from provider
  if (providerType === 'digitalocean') {
    try {
      const response = await fetch(`https://api.digitalocean.com/v2/account/keys/${providerKeyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${credentials.api_token}`,
          'Content-Type': 'application/json'
        }
      });

      // 204 = success, 404 = already deleted (which is fine)
      if (!response.ok && response.status !== 404) {
        const error = await response.json() as { message?: string };
        throw new Error(error.message || 'Failed to remove key from DigitalOcean');
      }
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, 'REMOVE_FAILED', `Failed to remove key from DigitalOcean: ${error.message}`);
    }
  }

  // Update local record
  const updatedProviderKeyIds = { ...key.provider_key_ids };
  delete updatedProviderKeyIds[providerType];

  database.updateSSHKey({
    ssh_key_id: key.ssh_key_id,
    provider_key_ids: updatedProviderKeyIds
  });

  const updatedKey = database.getSSHKey(key.ssh_key_id);

  const apiResponse: ApiResponse<SSHKey> = {
    success: true,
    data: updatedKey!
  };

  res.json(apiResponse);
});

// PATCH /ssh/keys/:id - Update SSH key name
sshRouter.patch('/keys/:id', (req: Request, res: Response) => {
  const key = database.getSSHKey(req.params.id);

  if (!key) {
    throw new AppError(404, 'SSH_KEY_NOT_FOUND', `SSH key ${req.params.id} not found`);
  }

  const { name } = req.body;

  if (name) {
    database.updateSSHKey({
      ssh_key_id: key.ssh_key_id,
      name
    });
  }

  const updatedKey = database.getSSHKey(key.ssh_key_id);

  const response: ApiResponse<SSHKey> = {
    success: true,
    data: updatedKey!
  };

  res.json(response);
});

// DELETE /ssh/keys/:id - Delete SSH key
sshRouter.delete('/keys/:id', (req: Request, res: Response) => {
  const key = database.getSSHKey(req.params.id);

  if (!key) {
    throw new AppError(404, 'SSH_KEY_NOT_FOUND', `SSH key ${req.params.id} not found`);
  }

  // Note: This does NOT remove the key from providers
  // User should unsync from providers first if needed
  
  database.deleteSSHKey(req.params.id);

  const response: ApiResponse<{ deleted: boolean }> = {
    success: true,
    data: { deleted: true }
  };

  res.json(response);
});

