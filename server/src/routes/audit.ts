import { Router, Request, Response } from 'express';
import { database } from '../services/database';
import { 
  AuditEvent,
  AuditEventListFilter,
  ApiResponse
} from '@machina/shared';

export const auditRouter = Router();

// GET /audit/events - List audit events with filtering
auditRouter.get('/events', (req: Request, res: Response) => {
  const filters: AuditEventListFilter = {
    action: req.query.action as AuditEventListFilter['action'],
    outcome: req.query.outcome as AuditEventListFilter['outcome'],
    actor_id: req.query.actor_id as string,
    target_type: req.query.target_type as string,
    target_id: req.query.target_id as string,
    after: req.query.after as string,
    before: req.query.before as string
  };

  let filtered = database.getAuditEvents();

  // Apply filters
  if (filters.action) {
    filtered = filtered.filter(e => e.action === filters.action);
  }
  if (filters.outcome) {
    filtered = filtered.filter(e => e.outcome === filters.outcome);
  }
  if (filters.actor_id) {
    filtered = filtered.filter(e => e.actor_id === filters.actor_id);
  }
  if (filters.target_type) {
    filtered = filtered.filter(e => e.target_type === filters.target_type);
  }
  if (filters.target_id) {
    filtered = filtered.filter(e => e.target_id === filters.target_id);
  }
  if (filters.after) {
    filtered = filtered.filter(e => new Date(e.timestamp) >= new Date(filters.after!));
  }
  if (filters.before) {
    filtered = filtered.filter(e => new Date(e.timestamp) <= new Date(filters.before!));
  }

  // Sort by timestamp descending
  filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Pagination
  const page = parseInt(req.query.page as string) || 1;
  const perPage = Math.min(parseInt(req.query.per_page as string) || 50, 200);
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / perPage);
  const startIndex = (page - 1) * perPage;
  const paginatedEvents = filtered.slice(startIndex, startIndex + perPage);

  const response: ApiResponse<AuditEvent[]> = {
    success: true,
    data: paginatedEvents,
    meta: {
      pagination: {
        page,
        per_page: perPage,
        total_items: totalItems,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1
      },
      timestamp: new Date().toISOString()
    }
  };

  res.json(response);
});
