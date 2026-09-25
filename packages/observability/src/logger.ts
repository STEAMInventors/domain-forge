const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/g,
  /api[_-]?key[=:]\s*\S+/gi,
  /Bearer\s+\S+/gi,
];

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  runId?: string;
  stageId?: string;
  details?: Record<string, unknown>;
}

function redactSecrets(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

export function createLogger(context?: { runId?: string; stageId?: string }) {
  function log(level: LogLevel, message: string, details?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level,
      message: redactSecrets(message),
      timestamp: new Date().toISOString(),
    };
    if (context?.runId !== undefined) entry.runId = context.runId;
    if (context?.stageId !== undefined) entry.stageId = context.stageId;
    if (details !== undefined) {
      entry.details = JSON.parse(redactSecrets(JSON.stringify(details)));
    }
    const line = JSON.stringify(entry);
    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  return {
    debug: (msg: string, details?: Record<string, unknown>) => log('debug', msg, details),
    info: (msg: string, details?: Record<string, unknown>) => log('info', msg, details),
    warn: (msg: string, details?: Record<string, unknown>) => log('warn', msg, details),
    error: (msg: string, details?: Record<string, unknown>) => log('error', msg, details),
  };
}
