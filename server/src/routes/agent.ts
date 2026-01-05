import { Router, Request, Response } from 'express';
import { database } from '../services/database';
import { ApiResponse } from '@machine/shared';

export const agentRouter = Router();

interface HeartbeatPayload {
  machine_id: string;
  agent_version: string;
  hostname: string;
  uptime_seconds: number;
  load_average: [number, number, number];
  memory_total_mb: number;
  memory_used_mb: number;
  disk_total_gb: number;
  disk_used_gb: number;
  public_ip?: string;
}

// POST /agent/heartbeat - Receive heartbeat from machine agent
agentRouter.post('/heartbeat', (req: Request, res: Response) => {
  const payload: HeartbeatPayload = req.body;

  if (!payload.machine_id) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'machine_id is required' }
    });
    return;
  }

  // Find machine by ID
  const machine = database.getMachine(payload.machine_id);
  
  if (!machine) {
    // Try to find by public IP (for initial registration)
    const allMachines = database.getMachines();
    const machineByIp = allMachines.find(m => m.public_ip === payload.public_ip);
    
    if (!machineByIp) {
      res.status(404).json({
        success: false,
        error: { code: 'MACHINE_NOT_FOUND', message: 'Machine not found' }
      });
      return;
    }
    
    // Update using found machine
    database.updateMachine({
      machine_id: machineByIp.machine_id,
      agent_status: 'connected',
      last_health_check: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Store agent metrics
    database.updateAgentMetrics(machineByIp.machine_id, {
      agent_version: payload.agent_version,
      hostname: payload.hostname,
      uptime_seconds: payload.uptime_seconds,
      load_average: payload.load_average,
      memory_total_mb: payload.memory_total_mb,
      memory_used_mb: payload.memory_used_mb,
      disk_total_gb: payload.disk_total_gb,
      disk_used_gb: payload.disk_used_gb,
      last_heartbeat: new Date().toISOString()
    });

    const response: ApiResponse<{ status: string }> = {
      success: true,
      data: { status: 'registered' }
    };
    res.json(response);
    return;
  }

  // Update machine agent status
  database.updateMachine({
    machine_id: machine.machine_id,
    agent_status: 'connected',
    last_health_check: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  // Store agent metrics
  database.updateAgentMetrics(machine.machine_id, {
    agent_version: payload.agent_version,
    hostname: payload.hostname,
    uptime_seconds: payload.uptime_seconds,
    load_average: payload.load_average,
    memory_total_mb: payload.memory_total_mb,
    memory_used_mb: payload.memory_used_mb,
    disk_total_gb: payload.disk_total_gb,
    disk_used_gb: payload.disk_used_gb,
    last_heartbeat: new Date().toISOString()
  });

  console.log(`💓 Heartbeat from ${machine.name} (${machine.public_ip})`);

  const response: ApiResponse<{ status: string }> = {
    success: true,
    data: { status: 'ok' }
  };
  res.json(response);
});

// GET /agent/metrics/:machineId - Get agent metrics for a machine
agentRouter.get('/metrics/:machineId', (req: Request, res: Response) => {
  const metrics = database.getAgentMetrics(req.params.machineId);
  
  const response: ApiResponse<typeof metrics> = {
    success: true,
    data: metrics
  };
  res.json(response);
});

