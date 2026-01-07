import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AppError, errorHandler } from './errorHandler';

describe('errorHandler middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let mockJson: ReturnType<typeof vi.fn>;
  let mockStatus: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockJson = vi.fn();
    mockStatus = vi.fn().mockReturnThis();
    mockReq = {};
    mockRes = {
      status: mockStatus,
      json: mockJson,
    };
    mockNext = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('AppError', () => {
    it('should create error with code and message', () => {
      const error = new AppError(400, 'BAD_REQUEST', 'Invalid input');

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.message).toBe('Invalid input');
      expect(error.name).toBe('AppError');
    });

    it('should support details object', () => {
      const error = new AppError(400, 'VALIDATION_ERROR', 'Invalid input', {
        field: 'email',
        reason: 'Invalid format',
      });

      expect(error.details).toEqual({
        field: 'email',
        reason: 'Invalid format',
      });
    });
  });

  describe('errorHandler', () => {
    it('should return JSON response for AppError', () => {
      const error = new AppError(400, 'BAD_REQUEST', 'Invalid input');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid input',
        },
      });
    });

    it('should include details in response when present', () => {
      const error = new AppError(422, 'VALIDATION_ERROR', 'Validation failed', {
        errors: ['email is required'],
      });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: { errors: ['email is required'] },
        },
      });
    });

    it('should log errors to console', () => {
      const error = new Error('Test error');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(console.error).toHaveBeenCalledWith('Error:', error);
    });

    it('should handle unknown errors with 500 status', () => {
      const error = new Error('Something went wrong');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: expect.any(String),
        },
      });
    });

    it('should hide error details in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Sensitive error details');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An internal error occurred',
        },
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should show error details in development', () => {
      process.env.NODE_ENV = 'test';

      const error = new Error('Debug error details');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Debug error details',
        },
      });
    });
  });
});
