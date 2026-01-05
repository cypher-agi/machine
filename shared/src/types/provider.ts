import { ProviderType } from './machine';

// Provider Account - Stored credentials and config
export type CredentialStatus = 'valid' | 'invalid' | 'expired' | 'unchecked';

export interface ProviderAccount {
  provider_account_id: string;
  provider_type: ProviderType;
  label: string;
  credential_status: CredentialStatus;
  scopes?: string[];
  permissions?: string[];
  
  // Timestamps
  created_at: string;
  updated_at: string;
  last_verified_at?: string;
  
  // Metadata (non-sensitive)
  metadata?: Record<string, string>;
}

export interface ProviderAccountCreateRequest {
  provider_type: ProviderType;
  label: string;
  credentials: ProviderCredentials;
}

export type ProviderCredentials = 
  | DigitalOceanCredentials
  | AWSCredentials
  | GCPCredentials
  | HetznerCredentials;

export interface DigitalOceanCredentials {
  type: 'digitalocean';
  api_token: string;
}

export interface AWSCredentials {
  type: 'aws';
  access_key_id: string;
  secret_access_key: string;
  region?: string;
  assume_role_arn?: string;
}

export interface GCPCredentials {
  type: 'gcp';
  project_id: string;
  service_account_json: string;
}

export interface HetznerCredentials {
  type: 'hetzner';
  api_token: string;
}

// Provider options (regions, sizes, images)
export interface ProviderRegion {
  slug: string;
  name: string;
  available: boolean;
  zones?: string[];
}

export interface ProviderSize {
  slug: string;
  name: string;
  vcpus: number;
  memory_mb: number;
  disk_gb: number;
  price_hourly?: number;
  price_monthly?: number;
  available: boolean;
}

export interface ProviderImage {
  slug: string;
  name: string;
  distribution: string;
  version?: string;
  type: 'base' | 'snapshot' | 'custom';
  available: boolean;
}

export interface ProviderOptions {
  provider_type: ProviderType;
  regions: ProviderRegion[];
  sizes: ProviderSize[];
  images: ProviderImage[];
}



