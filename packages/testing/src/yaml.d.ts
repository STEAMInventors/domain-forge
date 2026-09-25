declare module 'yaml' {
  export function parse(source: string, options?: unknown): unknown;
  export function stringify(value: unknown, options?: unknown): string;
}
