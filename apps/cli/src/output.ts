import type { CommandResult } from './types.js';
import type { OutputFormat } from './types.js';

export function emitResult(result: CommandResult, format: OutputFormat): void {
  if (format === 'json') {
    console.log(
      JSON.stringify(
        {
          exitCode: result.exitCode,
          ...(result.summary !== undefined ? { summary: result.summary } : {}),
          ...(result.payload !== undefined ? { data: result.payload } : {}),
          ...(result.errors !== undefined && result.errors.length > 0
            ? { errors: result.errors }
            : {}),
        },
        null,
        2,
      ),
    );
    return;
  }

  if (result.summary) {
    console.log(result.summary);
  }
  if (result.errors && result.errors.length > 0) {
    for (const error of result.errors) {
      console.error(`${error.code}: ${error.message}`);
    }
  }
  if (result.payload !== undefined) {
    console.log(JSON.stringify(result.payload, null, 2));
  }
}
