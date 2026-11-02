export interface StructuredLogger {
  info(detailsOrMessage: Record<string, unknown> | string, message?: string): void;
  error(detailsOrMessage: Record<string, unknown> | string, message?: string): void;
}

function sanitizeLogValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeLogMessage(value.message),
    };
  }

  if (typeof value === 'string') {
    return sanitizeLogMessage(value);
  }

  return value;
}

function sanitizeLogMessage(message: string): string {
  return message
    .replace(/(password|secret|token|api[_-]?key)\s*[=:]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/:\/\/([^:]+):([^@]+)@/g, '://$1:***@');
}

function writeLog(
  level: 'info' | 'error',
  scope: string,
  detailsOrMessage: Record<string, unknown> | string,
  message?: string
): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const details = typeof detailsOrMessage === 'string' ? {} : detailsOrMessage;
  const logMessage = typeof detailsOrMessage === 'string' ? detailsOrMessage : message;
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    scope,
    ...(logMessage ? { message: sanitizeLogMessage(logMessage) } : {}),
    ...Object.fromEntries(Object.entries(details).map(([key, value]) => [key, sanitizeLogValue(value)])),
  };

  if (level === 'error') {
    console.error(JSON.stringify(payload));
  } else {
    console.info(JSON.stringify(payload));
  }
}

export async function getLog(scope: string): Promise<StructuredLogger> {
  return {
    info: (detailsOrMessage, message) => writeLog('info', scope, detailsOrMessage, message),
    error: (detailsOrMessage, message) => writeLog('error', scope, detailsOrMessage, message),
  };
}

export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const statusCode = 'statusCode' in error && typeof error.statusCode === 'number'
      ? error.statusCode
      : undefined;

    return {
      name: error.name,
      message: sanitizeLogMessage(error.message),
      ...(statusCode === undefined ? {} : { statusCode }),
    };
  }

  return { message: sanitizeLogMessage(String(error)) };
}
