import { ZodError } from 'zod';
import { sanitizeErrorMessage } from './helpers.js';

type SendJson = (statusCode: number, data: unknown) => void;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getStatusCode(error: unknown): number {
  if (isRecord(error) && typeof error.statusCode === 'number') {
    return error.statusCode;
  }

  // Preserve the existing API contract for untyped service/request errors.
  return 400;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * Converts route failures into the common public API error shape.
 */
export function renderError(sendJson: SendJson, error: unknown): void {
  if (error instanceof ZodError) {
    sendJson(400, {
      error: 'Validation failed',
      details: error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
      code: 'ValidationError',
    });
    return;
  }

  const record = isRecord(error) ? error : undefined;
  const analysisId = typeof record?.analysisId === 'string' ? record.analysisId : undefined;
  const errorName = error instanceof Error ? error.name : 'Error';

  sendJson(getStatusCode(error), {
    error: sanitizeErrorMessage(getErrorMessage(error)),
    code: errorName,
    ...(analysisId ? { analysisId } : {}),
  });
}
