import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { database } from '../services/database';
import { 
  ProviderAccount, 
  ProviderAccountCreateRequest,
  ProviderOptions,
  ApiResponse,
  ProviderType
} from '@machina/shared';
import { AppError } from '../middleware/errorHandler';
import { storeCredentials, deleteCredentials, getCredentials } from '../services/terraform';

export const providersRouter = Router();

// Provider options for each provider type
const providerOptions: Record<ProviderType, ProviderOptions> = {
  digitalocean: {
    provider_type: 'digitalocean',
    regions: [
      { slug: 'nyc1', name: 'New York 1', available: true },
      { slug: 'nyc3', name: 'New York 3', available: true },
      { slug: 'sfo3', name: 'San Francisco 3', available: true },
      { slug: 'ams3', name: 'Amsterdam 3', available: true },
      { slug: 'sgp1', name: 'Singapore 1', available: true },
      { slug: 'lon1', name: 'London 1', available: true },
      { slug: 'fra1', name: 'Frankfurt 1', available: true },
      { slug: 'tor1', name: 'Toronto 1', available: true },
      { slug: 'blr1', name: 'Bangalore 1', available: true }
    ],
    sizes: [
      { slug: 's-1vcpu-1gb', name: 'Basic 1GB', vcpus: 1, memory_mb: 1024, disk_gb: 25, price_monthly: 6, available: true },
      { slug: 's-1vcpu-2gb', name: 'Basic 2GB', vcpus: 1, memory_mb: 2048, disk_gb: 50, price_monthly: 12, available: true },
      { slug: 's-2vcpu-4gb', name: 'Basic 4GB', vcpus: 2, memory_mb: 4096, disk_gb: 80, price_monthly: 24, available: true },
      { slug: 's-4vcpu-8gb', name: 'Basic 8GB', vcpus: 4, memory_mb: 8192, disk_gb: 160, price_monthly: 48, available: true },
      { slug: 's-8vcpu-16gb', name: 'Basic 16GB', vcpus: 8, memory_mb: 16384, disk_gb: 320, price_monthly: 96, available: true },
      { slug: 'c-2', name: 'CPU-Optimized 2 vCPU', vcpus: 2, memory_mb: 4096, disk_gb: 25, price_monthly: 42, available: true },
      { slug: 'c-4', name: 'CPU-Optimized 4 vCPU', vcpus: 4, memory_mb: 8192, disk_gb: 50, price_monthly: 84, available: true },
      { slug: 'm-2vcpu-16gb', name: 'Memory-Optimized 16GB', vcpus: 2, memory_mb: 16384, disk_gb: 50, price_monthly: 84, available: true }
    ],
    images: [
      { slug: 'ubuntu-22-04-x64', name: 'Ubuntu 22.04 (LTS) x64', distribution: 'Ubuntu', version: '22.04', type: 'base', available: true },
      { slug: 'ubuntu-24-04-x64', name: 'Ubuntu 24.04 (LTS) x64', distribution: 'Ubuntu', version: '24.04', type: 'base', available: true },
      { slug: 'debian-12-x64', name: 'Debian 12 x64', distribution: 'Debian', version: '12', type: 'base', available: true },
      { slug: 'centos-stream-9-x64', name: 'CentOS Stream 9 x64', distribution: 'CentOS', version: 'Stream 9', type: 'base', available: true },
      { slug: 'fedora-39-x64', name: 'Fedora 39 x64', distribution: 'Fedora', version: '39', type: 'base', available: true },
      { slug: 'rockylinux-9-x64', name: 'Rocky Linux 9 x64', distribution: 'Rocky Linux', version: '9', type: 'base', available: true }
    ]
  },
  aws: {
    provider_type: 'aws',
    regions: [
      { slug: 'us-east-1', name: 'US East (N. Virginia)', available: true, zones: ['us-east-1a', 'us-east-1b', 'us-east-1c', 'us-east-1d', 'us-east-1e', 'us-east-1f'] },
      { slug: 'us-east-2', name: 'US East (Ohio)', available: true, zones: ['us-east-2a', 'us-east-2b', 'us-east-2c'] },
      { slug: 'us-west-1', name: 'US West (N. California)', available: true, zones: ['us-west-1a', 'us-west-1b'] },
      { slug: 'us-west-2', name: 'US West (Oregon)', available: true, zones: ['us-west-2a', 'us-west-2b', 'us-west-2c', 'us-west-2d'] },
      { slug: 'eu-west-1', name: 'EU (Ireland)', available: true, zones: ['eu-west-1a', 'eu-west-1b', 'eu-west-1c'] },
      { slug: 'eu-west-2', name: 'EU (London)', available: true, zones: ['eu-west-2a', 'eu-west-2b', 'eu-west-2c'] },
      { slug: 'eu-central-1', name: 'EU (Frankfurt)', available: true, zones: ['eu-central-1a', 'eu-central-1b', 'eu-central-1c'] },
      { slug: 'ap-southeast-1', name: 'Asia Pacific (Singapore)', available: true, zones: ['ap-southeast-1a', 'ap-southeast-1b', 'ap-southeast-1c'] },
      { slug: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)', available: true, zones: ['ap-northeast-1a', 'ap-northeast-1c', 'ap-northeast-1d'] }
    ],
    sizes: [
      { slug: 't3.micro', name: 't3.micro (2 vCPU, 1GB)', vcpus: 2, memory_mb: 1024, disk_gb: 8, price_hourly: 0.0104, available: true },
      { slug: 't3.small', name: 't3.small (2 vCPU, 2GB)', vcpus: 2, memory_mb: 2048, disk_gb: 8, price_hourly: 0.0208, available: true },
      { slug: 't3.medium', name: 't3.medium (2 vCPU, 4GB)', vcpus: 2, memory_mb: 4096, disk_gb: 8, price_hourly: 0.0416, available: true },
      { slug: 't3.large', name: 't3.large (2 vCPU, 8GB)', vcpus: 2, memory_mb: 8192, disk_gb: 8, price_hourly: 0.0832, available: true },
      { slug: 't3.xlarge', name: 't3.xlarge (4 vCPU, 16GB)', vcpus: 4, memory_mb: 16384, disk_gb: 8, price_hourly: 0.1664, available: true },
      { slug: 'm5.large', name: 'm5.large (2 vCPU, 8GB)', vcpus: 2, memory_mb: 8192, disk_gb: 8, price_hourly: 0.096, available: true },
      { slug: 'm5.xlarge', name: 'm5.xlarge (4 vCPU, 16GB)', vcpus: 4, memory_mb: 16384, disk_gb: 8, price_hourly: 0.192, available: true },
      { slug: 'c5.large', name: 'c5.large (2 vCPU, 4GB)', vcpus: 2, memory_mb: 4096, disk_gb: 8, price_hourly: 0.085, available: true },
      { slug: 'c5.xlarge', name: 'c5.xlarge (4 vCPU, 8GB)', vcpus: 4, memory_mb: 8192, disk_gb: 8, price_hourly: 0.17, available: true }
    ],
    images: [
      { slug: 'ami-0c55b159cbfafe1f0', name: 'Amazon Linux 2023', distribution: 'Amazon Linux', version: '2023', type: 'base', available: true },
      { slug: 'ami-ubuntu-22-04', name: 'Ubuntu 22.04 LTS', distribution: 'Ubuntu', version: '22.04', type: 'base', available: true },
      { slug: 'ami-ubuntu-24-04', name: 'Ubuntu 24.04 LTS', distribution: 'Ubuntu', version: '24.04', type: 'base', available: true },
      { slug: 'ami-debian-12', name: 'Debian 12', distribution: 'Debian', version: '12', type: 'base', available: true },
      { slug: 'ami-rhel-9', name: 'Red Hat Enterprise Linux 9', distribution: 'RHEL', version: '9', type: 'base', available: true }
    ]
  },
  gcp: {
    provider_type: 'gcp',
    regions: [
      { slug: 'us-central1', name: 'US Central (Iowa)', available: true, zones: ['us-central1-a', 'us-central1-b', 'us-central1-c', 'us-central1-f'] },
      { slug: 'us-east1', name: 'US East (South Carolina)', available: true, zones: ['us-east1-b', 'us-east1-c', 'us-east1-d'] }
    ],
    sizes: [
      { slug: 'e2-micro', name: 'e2-micro', vcpus: 2, memory_mb: 1024, disk_gb: 10, available: true },
      { slug: 'e2-small', name: 'e2-small', vcpus: 2, memory_mb: 2048, disk_gb: 10, available: true }
    ],
    images: [
      { slug: 'ubuntu-2204-jammy', name: 'Ubuntu 22.04 LTS', distribution: 'Ubuntu', version: '22.04', type: 'base', available: true }
    ]
  },
  hetzner: {
    provider_type: 'hetzner',
    regions: [
      { slug: 'fsn1', name: 'Falkenstein', available: true },
      { slug: 'nbg1', name: 'Nuremberg', available: true },
      { slug: 'hel1', name: 'Helsinki', available: true }
    ],
    sizes: [
      { slug: 'cx11', name: 'CX11', vcpus: 1, memory_mb: 2048, disk_gb: 20, price_monthly: 3.29, available: true },
      { slug: 'cx21', name: 'CX21', vcpus: 2, memory_mb: 4096, disk_gb: 40, price_monthly: 5.83, available: true }
    ],
    images: [
      { slug: 'ubuntu-22.04', name: 'Ubuntu 22.04', distribution: 'Ubuntu', version: '22.04', type: 'base', available: true }
    ]
  },
  baremetal: {
    provider_type: 'baremetal',
    regions: [],
    sizes: [],
    images: []
  }
};

// GET /providers - List supported providers
providersRouter.get('/', (_req: Request, res: Response) => {
  const providers = [
    { type: 'digitalocean', name: 'DigitalOcean', supported: true },
    { type: 'aws', name: 'Amazon Web Services', supported: false },
    { type: 'gcp', name: 'Google Cloud Platform', supported: false },
    { type: 'hetzner', name: 'Hetzner', supported: false },
    { type: 'baremetal', name: 'Bare Metal / BYO Server', supported: false }
  ];

  const response: ApiResponse<typeof providers> = {
    success: true,
    data: providers
  };

  res.json(response);
});

// GET /providers/:type/options - Get provider options (regions, sizes, images)
providersRouter.get('/:type/options', (req: Request, res: Response) => {
  const providerType = req.params.type as ProviderType;
  const options = providerOptions[providerType];

  if (!options) {
    throw new AppError(404, 'PROVIDER_NOT_FOUND', `Provider ${providerType} not found`);
  }

  const response: ApiResponse<ProviderOptions> = {
    success: true,
    data: options
  };

  res.json(response);
});

// GET /providers/accounts - List all provider accounts
providersRouter.get('/accounts', (_req: Request, res: Response) => {
  const accounts = database.getProviderAccounts();
  
  // Add credential status based on whether we have stored credentials
  const accountsWithStatus = accounts.map(account => ({
    ...account,
    credential_status: getCredentials(account.provider_account_id) ? 'valid' : 'unchecked'
  }));

  const response: ApiResponse<ProviderAccount[]> = {
    success: true,
    data: accountsWithStatus as ProviderAccount[]
  };

  res.json(response);
});

// GET /providers/accounts/:id - Get single provider account
providersRouter.get('/accounts/:id', (req: Request, res: Response) => {
  const account = database.getProviderAccount(req.params.id);

  if (!account) {
    throw new AppError(404, 'ACCOUNT_NOT_FOUND', `Provider account ${req.params.id} not found`);
  }

  const response: ApiResponse<ProviderAccount> = {
    success: true,
    data: {
      ...account,
      credential_status: getCredentials(account.provider_account_id) ? 'valid' : 'unchecked'
    } as ProviderAccount
  };

  res.json(response);
});

// POST /providers/:type/accounts - Create new provider account
providersRouter.post('/:type/accounts', async (req: Request, res: Response) => {
  const providerType = req.params.type as ProviderType;
  const body: ProviderAccountCreateRequest = req.body;

  if (!body.label || !body.credentials) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Missing required fields: label and credentials');
  }

  // Validate credentials based on provider type
  if (providerType === 'digitalocean') {
    if (!body.credentials || body.credentials.type !== 'digitalocean' || !body.credentials.api_token) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid credentials for DigitalOcean - api_token required');
    }
    
    // Sanitize the token - remove any whitespace or non-ASCII characters
    const apiToken = body.credentials.api_token.trim().replace(/[^\x20-\x7E]/g, '');
    
    if (!apiToken || apiToken.length < 10) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid API token format');
    }
    
    // Update the token in the body with sanitized version
    body.credentials.api_token = apiToken;
    
    // Verify the token works by making a test API call
    try {
      const response = await fetch('https://api.digitalocean.com/v2/account', {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorBody = await response.text();
        console.error('DigitalOcean API error:', response.status, errorBody);
        throw new AppError(400, 'INVALID_CREDENTIALS', 'DigitalOcean API token is invalid or expired');
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Credential verification error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new AppError(400, 'VALIDATION_FAILED', `Could not verify credentials: ${errorMessage}`);
    }
  }

  if (providerType === 'aws' && (!body.credentials || body.credentials.type !== 'aws')) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid credentials for AWS');
  }

  const accountId = `pa_${providerType}_${uuidv4().substring(0, 8)}`;

  const newAccount: ProviderAccount = {
    provider_account_id: accountId,
    provider_type: providerType,
    label: body.label,
    credential_status: 'valid',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_verified_at: new Date().toISOString()
  };

  // Save account to database FIRST (credentials table has foreign key)
  database.insertProviderAccount(newAccount);

  // Then store credentials (encrypted in database)
  if (providerType === 'digitalocean' && body.credentials.type === 'digitalocean') {
    storeCredentials(accountId, { api_token: body.credentials.api_token });
  } else if (providerType === 'aws' && body.credentials.type === 'aws') {
    storeCredentials(accountId, {
      access_key_id: body.credentials.access_key_id,
      secret_access_key: body.credentials.secret_access_key,
      region: body.credentials.region || 'us-east-1'
    });
  }

  const response: ApiResponse<ProviderAccount> = {
    success: true,
    data: newAccount
  };

  res.status(201).json(response);
});

// PUT /providers/accounts/:id - Update provider account credentials
providersRouter.put('/accounts/:id', async (req: Request, res: Response) => {
  const account = database.getProviderAccount(req.params.id);

  if (!account) {
    throw new AppError(404, 'ACCOUNT_NOT_FOUND', `Provider account ${req.params.id} not found`);
  }

  const { label, credentials } = req.body;

  // Update label if provided
  if (label) {
    database.updateProviderAccount({
      provider_account_id: account.provider_account_id,
      label,
      updated_at: new Date().toISOString()
    });
  }

  // Update credentials if provided
  if (credentials) {
    database.storeCredentials(account.provider_account_id, credentials);
    
    // Verify the new credentials
    if (account.provider_type === 'digitalocean' && credentials.api_token) {
      try {
        const response = await fetch('https://api.digitalocean.com/v2/account', {
          headers: {
            'Authorization': `Bearer ${credentials.api_token}`,
            'Content-Type': 'application/json'
          }
        });
        
        database.updateProviderAccount({
          provider_account_id: account.provider_account_id,
          credential_status: response.ok ? 'valid' : 'invalid',
          updated_at: new Date().toISOString()
        });
      } catch {
        database.updateProviderAccount({
          provider_account_id: account.provider_account_id,
          credential_status: 'invalid',
          updated_at: new Date().toISOString()
        });
      }
    }
  }

  const updatedAccount = database.getProviderAccount(req.params.id);
  
  const response: ApiResponse<ProviderAccount> = {
    success: true,
    data: updatedAccount!
  };

  res.json(response);
});

// POST /providers/accounts/:id/verify - Verify provider account credentials
providersRouter.post('/accounts/:id/verify', async (req: Request, res: Response) => {
  const account = database.getProviderAccount(req.params.id);

  if (!account) {
    throw new AppError(404, 'ACCOUNT_NOT_FOUND', `Provider account ${req.params.id} not found`);
  }

  const credentials = getCredentials(account.provider_account_id);
  if (!credentials) {
    throw new AppError(400, 'NO_CREDENTIALS', 'No credentials stored for this account');
  }

  // Verify based on provider type
  if (account.provider_type === 'digitalocean') {
    try {
      const response = await fetch('https://api.digitalocean.com/v2/account', {
        headers: {
          'Authorization': `Bearer ${credentials.api_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        database.updateProviderAccount({
          provider_account_id: account.provider_account_id,
          credential_status: 'invalid',
          updated_at: new Date().toISOString()
        });
        throw new AppError(400, 'INVALID_CREDENTIALS', 'DigitalOcean API token is invalid or expired');
      }
      
      database.updateProviderAccount({
        provider_account_id: account.provider_account_id,
        credential_status: 'valid',
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new AppError(400, 'VALIDATION_FAILED', `Could not verify credentials: ${errorMessage}`);
    }
  }

  const updatedAccount = database.getProviderAccount(account.provider_account_id);

  const response: ApiResponse<ProviderAccount> = {
    success: true,
    data: updatedAccount!
  };

  res.json(response);
});

// DELETE /providers/accounts/:id - Delete provider account
providersRouter.delete('/accounts/:id', (req: Request, res: Response) => {
  const account = database.getProviderAccount(req.params.id);

  if (!account) {
    throw new AppError(404, 'ACCOUNT_NOT_FOUND', `Provider account ${req.params.id} not found`);
  }

  // Check for linked machines
  const machines = database.getMachines();
  const linkedMachines = machines.filter(m => m.provider_account_id === req.params.id);
  
  if (linkedMachines.length > 0) {
    throw new AppError(
      400, 
      'PROVIDER_HAS_MACHINES', 
      `Cannot delete provider: ${linkedMachines.length} machine(s) are linked to this account. Delete the machines first.`
    );
  }

  // Delete from database (also deletes credentials)
  database.deleteProviderAccount(req.params.id);

  const response: ApiResponse<{ deleted: boolean }> = {
    success: true,
    data: { deleted: true }
  };

  res.json(response);
});
