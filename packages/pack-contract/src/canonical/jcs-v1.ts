/**
 * JSON Canonicalization Scheme (RFC 8785) — versioned isolated implementation.
 *
 * CANONICALIZATION_VERSION identifies this implementation for auditability.
 */
export const CANONICALIZATION_VERSION = 'jcs-rfc8785-v1' as const;

export class CanonicalizationError extends Error {
  readonly code = 'CANONICALIZATION_ERROR' as const;

  constructor(message: string) {
    super(message);
    this.name = 'CanonicalizationError';
  }
}

/** Canonicalize a JSON-compatible value to an RFC 8785 string. Fails closed on non-canonical input. */
export function canonicalizeJson(value: unknown): string {
  return serializeValue(value);
}

function serializeValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  const valueType = typeof value;

  if (valueType === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (valueType === 'number') {
    return serializeNumber(value as number);
  }

  if (valueType === 'string') {
    return serializeString(value as string);
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => serializeValue(item));
    return `[${items.join(',')}]`;
  }

  if (valueType === 'object') {
    if (Object.getPrototypeOf(value) !== Object.prototype && value !== null) {
      throw new CanonicalizationError('Only plain objects are canonicalizable');
    }
    return serializeObject(value as Record<string, unknown>);
  }

  throw new CanonicalizationError(`Unsupported canonicalization type: ${valueType}`);
}

function serializeObject(value: Record<string, unknown>): string {
  const keys = Object.keys(value).sort();
  const members: string[] = [];

  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      continue;
    }
    const propertyValue = value[key];
    if (propertyValue === undefined) {
      throw new CanonicalizationError(`Undefined property "${key}" is not canonicalizable`);
    }
    members.push(`${serializeString(key)}:${serializeValue(propertyValue)}`);
  }

  return `{${members.join(',')}}`;
}

function serializeNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new CanonicalizationError('Non-finite numbers are not canonicalizable');
  }

  if (Object.is(value, -0)) {
    throw new CanonicalizationError('-0 is not canonicalizable');
  }

  if (Number.isInteger(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER) {
    return value.toString();
  }

  const serialized = value.toString();
  if (Number(serialized) !== value) {
    throw new CanonicalizationError(`Number ${serialized} is not canonicalizable`);
  }

  return serialized;
}

function serializeString(value: string): string {
  let result = '"';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    switch (code) {
      case 0x22:
        result += '\\"';
        break;
      case 0x5c:
        result += '\\\\';
        break;
      case 0x08:
        result += '\\b';
        break;
      case 0x0c:
        result += '\\f';
        break;
      case 0x0a:
        result += '\\n';
        break;
      case 0x0d:
        result += '\\r';
        break;
      case 0x09:
        result += '\\t';
        break;
      default:
        if (code < 0x20) {
          result += `\\u${code.toString(16).padStart(4, '0')}`;
        } else {
          result += value[i];
        }
    }
  }
  result += '"';
  return result;
}
