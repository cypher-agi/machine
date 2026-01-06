// SSH Key types for managing SSH identities

export interface SSHKey {
  ssh_key_id: string;
  name: string;
  fingerprint: string;
  public_key: string;
  
  // Provider key IDs - mapping of provider_type to their key ID
  // e.g., { digitalocean: "12345678", aws: "key-0abc123" }
  provider_key_ids: Record<string, string>;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  // Metadata
  key_type: SSHKeyType;
  key_bits: number;
  comment?: string;
}

export type SSHKeyType = 'ed25519' | 'rsa' | 'ecdsa';

export interface SSHKeyCreateRequest {
  name: string;
  key_type?: SSHKeyType; // defaults to ed25519
  key_bits?: number; // for RSA, defaults to 4096
  comment?: string;
}

export interface SSHKeyImportRequest {
  name: string;
  public_key: string;
  private_key?: string; // Optional - if provided, will be encrypted and stored
  comment?: string;
}

// Response that includes the private key (only returned once on generation)
export interface SSHKeyGenerateResponse extends SSHKey {
  private_key: string; // Only returned when generating a new key
}

// For syncing with providers
export interface SSHKeyProviderSync {
  provider_type: string;
  provider_account_id: string;
  provider_key_id?: string;
  synced_at?: string;
  error?: string;
}


