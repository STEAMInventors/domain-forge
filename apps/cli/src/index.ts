#!/usr/bin/env node
import { parseGlobalFlags } from './args.js';
import { createCliContext } from './context.js';
import { dispatchCommand } from './router.js';
import { emitResult } from './output.js';
import { ExitCode } from './exit-codes.js';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const { outputFormat } = parseGlobalFlags(argv);
  const ctx = await createCliContext({ outputFormat });
  const result = await dispatchCommand(ctx, argv);
  emitResult(result, outputFormat);
  if (result.exitCode !== ExitCode.SUCCESS) {
    process.exit(result.exitCode);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(ExitCode.INTERNAL_FAILURE);
});
