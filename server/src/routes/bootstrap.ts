import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { database } from '../services/database';
import type {
  BootstrapProfile,
  BootstrapProfileCreateRequest,
  FirewallProfile,
  ApiResponse,
} from '@machina/shared';
import { AppError } from '../middleware/errorHandler';

export const bootstrapRouter = Router();

// GET /bootstrap/profiles - List all bootstrap profiles
bootstrapRouter.get('/profiles', (_req: Request, res: Response) => {
  const response: ApiResponse<BootstrapProfile[]> = {
    success: true,
    data: database.getBootstrapProfiles(),
  };

  res.json(response);
});

// GET /bootstrap/profiles/:id - Get single bootstrap profile
bootstrapRouter.get('/profiles/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    throw new AppError(400, 'BAD_REQUEST', 'Missing profile ID');
  }

  const profile = database.getBootstrapProfile(id);

  if (!profile) {
    throw new AppError(404, 'PROFILE_NOT_FOUND', `Bootstrap profile ${id} not found`);
  }

  const response: ApiResponse<BootstrapProfile> = {
    success: true,
    data: profile,
  };

  res.json(response);
});

// POST /bootstrap/profiles - Create new bootstrap profile
bootstrapRouter.post('/profiles', (req: Request, res: Response) => {
  const body: BootstrapProfileCreateRequest = req.body;

  if (!body.name || !body.method) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Missing required fields: name and method');
  }

  // Validate that the correct template is provided based on method
  if (body.method === 'cloud_init' && !body.cloud_init_template) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'cloud_init_template is required for cloud_init method'
    );
  }
  if (body.method === 'ssh_script' && !body.ssh_bootstrap_script) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'ssh_bootstrap_script is required for ssh_script method'
    );
  }
  if (body.method === 'ansible' && !body.ansible_playbook_ref) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'ansible_playbook_ref is required for ansible method'
    );
  }

  const newProfile: BootstrapProfile = {
    profile_id: `bp_${uuidv4().substring(0, 12)}`,
    name: body.name,
    ...(body.description && { description: body.description }),
    method: body.method,
    ...(body.cloud_init_template && { cloud_init_template: body.cloud_init_template }),
    ...(body.ssh_bootstrap_script && { ssh_bootstrap_script: body.ssh_bootstrap_script }),
    ...(body.ansible_playbook_ref && { ansible_playbook_ref: body.ansible_playbook_ref }),
    services_to_run: body.services_to_run || [],
    ...(body.config_schema && { config_schema: body.config_schema }),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: 'user_current',
    ...(body.tags && { tags: body.tags }),
    is_system_profile: false,
  };

  database.insertBootstrapProfile(newProfile);

  const response: ApiResponse<BootstrapProfile> = {
    success: true,
    data: newProfile,
  };

  res.status(201).json(response);
});

// PUT /bootstrap/profiles/:id - Update bootstrap profile
bootstrapRouter.put('/profiles/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    throw new AppError(400, 'BAD_REQUEST', 'Missing profile ID');
  }

  const profile = database.getBootstrapProfile(id);

  if (!profile) {
    throw new AppError(404, 'PROFILE_NOT_FOUND', `Bootstrap profile ${id} not found`);
  }

  if (profile.is_system_profile) {
    throw new AppError(403, 'FORBIDDEN', 'Cannot modify system profiles');
  }

  const body: Partial<BootstrapProfileCreateRequest> = req.body;

  database.updateBootstrapProfile({
    profile_id: id,
    name: body.name || profile.name,
    ...(body.description !== undefined
      ? body.description
        ? { description: body.description }
        : {}
      : profile.description
        ? { description: profile.description }
        : {}),
    ...(body.cloud_init_template !== undefined
      ? body.cloud_init_template
        ? { cloud_init_template: body.cloud_init_template }
        : {}
      : profile.cloud_init_template
        ? { cloud_init_template: profile.cloud_init_template }
        : {}),
    ...(body.ssh_bootstrap_script !== undefined
      ? body.ssh_bootstrap_script
        ? { ssh_bootstrap_script: body.ssh_bootstrap_script }
        : {}
      : profile.ssh_bootstrap_script
        ? { ssh_bootstrap_script: profile.ssh_bootstrap_script }
        : {}),
    ...(body.ansible_playbook_ref !== undefined
      ? body.ansible_playbook_ref
        ? { ansible_playbook_ref: body.ansible_playbook_ref }
        : {}
      : profile.ansible_playbook_ref
        ? { ansible_playbook_ref: profile.ansible_playbook_ref }
        : {}),
    services_to_run: body.services_to_run || profile.services_to_run,
    ...(body.config_schema
      ? { config_schema: body.config_schema }
      : profile.config_schema
        ? { config_schema: profile.config_schema }
        : {}),
    ...(body.tags ? { tags: body.tags } : profile.tags ? { tags: profile.tags } : {}),
    updated_at: new Date().toISOString(),
  });

  const updatedProfile = database.getBootstrapProfile(id);

  if (!updatedProfile) {
    throw new AppError(500, 'UPDATE_FAILED', 'Failed to retrieve updated profile');
  }

  const response: ApiResponse<BootstrapProfile> = {
    success: true,
    data: updatedProfile,
  };

  res.json(response);
});

// DELETE /bootstrap/profiles/:id - Delete bootstrap profile
bootstrapRouter.delete('/profiles/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    throw new AppError(400, 'BAD_REQUEST', 'Missing profile ID');
  }

  const profile = database.getBootstrapProfile(id);

  if (!profile) {
    throw new AppError(404, 'PROFILE_NOT_FOUND', `Bootstrap profile ${id} not found`);
  }

  if (profile.is_system_profile) {
    throw new AppError(403, 'FORBIDDEN', 'Cannot delete system profiles');
  }

  database.deleteBootstrapProfile(id);

  const response: ApiResponse<{ deleted: boolean }> = {
    success: true,
    data: { deleted: true },
  };

  res.json(response);
});

// GET /bootstrap/firewall-profiles - List all firewall profiles
bootstrapRouter.get('/firewall-profiles', (_req: Request, res: Response) => {
  const response: ApiResponse<FirewallProfile[]> = {
    success: true,
    data: database.getFirewallProfiles(),
  };

  res.json(response);
});

// GET /bootstrap/firewall-profiles/:id - Get single firewall profile
bootstrapRouter.get('/firewall-profiles/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    throw new AppError(400, 'BAD_REQUEST', 'Missing profile ID');
  }

  const profile = database.getFirewallProfile(id);

  if (!profile) {
    throw new AppError(404, 'PROFILE_NOT_FOUND', `Firewall profile ${id} not found`);
  }

  const response: ApiResponse<FirewallProfile> = {
    success: true,
    data: profile,
  };

  res.json(response);
});
