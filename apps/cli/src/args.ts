export interface ParsedGlobalFlags {
  readonly outputFormat: 'json' | 'human';
  readonly positional: readonly string[];
}

export function parseGlobalFlags(argv: readonly string[]): ParsedGlobalFlags {
  const positional: string[] = [];
  let outputFormat: 'json' | 'human' = 'human';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--json') {
      outputFormat = 'json';
      continue;
    }
    if (arg === '--human') {
      outputFormat = 'human';
      continue;
    }
    positional.push(arg);
  }

  return { outputFormat, positional };
}

export function requireArgs(
  args: readonly string[],
  count: number,
  _usage: string,
): string[] | undefined {
  if (args.length < count) {
    return undefined;
  }
  return [...args.slice(0, count)];
}
