import type { ModelPolicy, ModelRequest } from '@domain-forge/contracts';
import { ModelInvocationError, ModelOutputError } from '@domain-forge/core';

export type ProviderFetch = typeof fetch;

export interface ProviderHttpResult {
  readonly response: Response;
  readonly body: unknown;
}

function containsLatest(value: string): boolean {
  return /(^|[-_.:/])latest($|[-_.:/])/i.test(value);
}

export function assertExplicitModelPolicy(policy: ModelPolicy, providerName: string): void {
  if (policy.provider !== providerName) {
    throw new ModelInvocationError(
      `Model policy provider "${policy.provider}" cannot be invoked by "${providerName}" adapter`,
      { configuredProvider: policy.provider, adapterProvider: providerName },
      false,
    );
  }

  if (
    policy.modelIdentifier.length === 0 ||
    policy.modelIdentifier !== policy.modelIdentifier.trim() ||
    containsLatest(policy.modelIdentifier)
  ) {
    throw new ModelInvocationError(
      `Model policy "${policy.alias}" must use an explicit ${providerName} model identifier and may not use "latest"`,
      { provider: providerName, policyAlias: policy.alias },
      false,
    );
  }

  if (
    policy.modelVersion !== undefined &&
    (policy.modelVersion.length === 0 ||
      policy.modelVersion !== policy.modelVersion.trim() ||
      containsLatest(policy.modelVersion))
  ) {
    throw new ModelInvocationError(
      `Model policy "${policy.alias}" must use an explicit model version and may not use "latest"`,
      { provider: providerName, policyAlias: policy.alias },
      false,
    );
  }
}

export function assertNoProviderNativeTools(request: ModelRequest, providerName: string): void {
  if ((request.tools?.length ?? 0) > 0) {
    throw new ModelInvocationError(
      `${providerName} provider-native tools are disabled; Forge-controlled tooling must be used`,
      { provider: providerName, requestedToolCount: request.tools?.length ?? 0 },
      false,
    );
  }
}

export function parseJsonIfPossible(rawText: string): unknown | undefined {
  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    return undefined;
  }
}

export function isRetryableProviderStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export async function postProviderJson(input: {
  readonly providerName: string;
  readonly fetchImpl: ProviderFetch;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly timeoutMs: number;
}): Promise<ProviderHttpResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await input.fetchImpl(input.url, {
      method: 'POST',
      headers: { ...input.headers },
      body: JSON.stringify(input.body),
      signal: controller.signal,
    });

    let rawBody: string;
    try {
      rawBody = await response.text();
    } catch {
      throw new ModelInvocationError(
        `${input.providerName} response body could not be read`,
        { provider: input.providerName, httpStatus: response.status },
        isRetryableProviderStatus(response.status),
      );
    }

    let body: unknown = rawBody;
    if (rawBody.length > 0) {
      try {
        body = JSON.parse(rawBody) as unknown;
      } catch {
        // Preserve non-JSON provider responses for adapter-level output validation.
      }
    }

    return { response, body };
  } catch (error) {
    if (error instanceof ModelInvocationError) throw error;

    if (isAbortError(error)) {
      throw new ModelInvocationError(
        `${input.providerName} model invocation timed out`,
        { provider: input.providerName, timeoutMs: input.timeoutMs },
        true,
      );
    }

    throw new ModelInvocationError(
      `${input.providerName} model invocation failed before a response was received`,
      {
        provider: input.providerName,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      },
      true,
    );
  } finally {
    clearTimeout(timer);
  }
}

export function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  return value as Readonly<Record<string, unknown>>;
}

export function asFiniteNonNegativeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function assertReturnedModelMatchesPolicy(
  returnedModel: string | undefined,
  policy: ModelPolicy,
  providerName: string,
): void {
  if (returnedModel !== undefined && returnedModel !== policy.modelIdentifier) {
    throw new ModelOutputError(
      `${providerName} returned a different model identifier than the configured policy`,
      {
        provider: providerName,
        requestedModelIdentifier: policy.modelIdentifier,
        returnedModelIdentifier: returnedModel,
      },
    );
  }
}
