/**
 * 统一错误响应（任务书 §27）：
 * { "success": false, "error": { "code": "XXX", "message": "..." } }
 */
import { Response } from 'express';

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  SCHEDULE_NOT_FOUND: 'SCHEDULE_NOT_FOUND',
  LLM_UNAVAILABLE: 'LLM_UNAVAILABLE',
  VOICE_UNAVAILABLE: 'VOICE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export function sendError(res: Response, status: number, code: ErrorCode | string, message: string, details?: unknown): void {
  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  });
}

/** 兼容返回结构化成功响应 */
export function sendOk(res: Response, data: unknown): void {
  res.json(data);
}
