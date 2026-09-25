import type { CliContext, CommandResult } from './types.js';
import { ExitCode } from './exit-codes.js';
import { parseGlobalFlags } from './args.js';
import { printHelp } from './help.js';
import { cmdValidatePack } from './commands/validate-pack.js';
import {
  cmdCreateRun,
  cmdExecuteStage,
  cmdInspectCorpus,
  cmdInspectPack,
  cmdInspectRun,
  cmdRecordGate,
  cmdResumeRun,
} from './commands/forge-run.js';
import { cmdQualify } from './commands/qualify.js';
import { cmdCertify } from './commands/certify.js';
import { cmdRuntimeEligibility } from './commands/runtime-eligibility.js';
import { cmdProvenance } from './commands/provenance.js';

export async function dispatchCommand(
  ctx: CliContext,
  argv: readonly string[],
): Promise<CommandResult> {
  const { outputFormat, positional } = parseGlobalFlags(argv);
  const [command, ...args] = positional;

  const effectiveCtx: CliContext = { ...ctx, outputFormat };

  if (!command || command === 'help') {
    printHelp();
    return { exitCode: ExitCode.SUCCESS, summary: 'Help displayed' };
  }

  switch (command) {
    case 'create-run':
      return cmdCreateRun(effectiveCtx, args);
    case 'inspect-run':
      return cmdInspectRun(effectiveCtx, args[0]);
    case 'execute-stage':
      return cmdExecuteStage(effectiveCtx, args[0]);
    case 'resume-run':
      return cmdResumeRun(effectiveCtx, args[0]);
    case 'record-gate':
      return cmdRecordGate(effectiveCtx, args);
    case 'validate-pack':
      return cmdValidatePack(effectiveCtx, args[0]);
    case 'inspect-pack':
      return cmdInspectPack(effectiveCtx, args[0]);
    case 'inspect-corpus':
      return cmdInspectCorpus(effectiveCtx, args[0]);
    case 'qualify':
      return cmdQualify(effectiveCtx, args);
    case 'certify':
      return cmdCertify(effectiveCtx, args);
    case 'runtime-eligibility':
      return cmdRuntimeEligibility(effectiveCtx, args);
    case 'provenance':
      return cmdProvenance(effectiveCtx, args[0]);
    default:
      printHelp();
      return {
        exitCode: ExitCode.USAGE_OR_CONFIG,
        summary: `Unknown command: ${command}`,
        errors: [{ code: 'UNKNOWN_COMMAND', message: `Unknown command: ${command}` }],
      };
  }
}
