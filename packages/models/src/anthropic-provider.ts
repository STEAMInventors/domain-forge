import type { ModelPolicy, ModelProvider, ModelRequest, ModelResponse } from '@domain-forge/contracts';
import { ModelInvocationError, ModelOutputError } from '@domain-forge/core';
import {
  asFiniteNonNegativeNumber,
  asRecord,
  assertExplicitModelPolicy,
  assertNoProviderNativeTools,
  assertReturnedModelMatchesPolicy,
  isRetryableProviderStatus,
  optionalString,
  parseJsonIfPossible,
  postProviderJson,
  type ProviderFetch,
} from './provider-http.js';

const DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';
const DEFAULT_ANTHROPIC_API_VERSION = '2023-06-01';
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_TOKENS = 8_192;

export interface AnthropicModelProviderConfig {
  readonly apiKey: string;
  readonly apiVersion?: string;
  readonly workspaceId?: string;
  readonly timeoutMs?: number;
  readonly defaultMaxTokens?: number;
  readonly baseUrl?: string;
  readonly fetchImpl?: ProviderFetch;
}

function extractOutputText(body: Readonly<Record<string, unknown>>): string | undefined {
  const content = body['content'];
  if (!Array.isArray(content)) return undefined;

  const text: string[] = [];
  for (const block of content) {
    const blockRecord = asRecord(block);
    if (blockRecord?.['type'] === 'text' && typeof blockRecord['text'] === 'string') {
      text.push(blockRecord['text']);
    }
  }

  return text.length > 0 ? text.join('\n') : undefined;
}

function extractUsage(body: Readonly<Record<string, unknown>>): ModelResponse['tokenUsage'] | undefined {
  const usage = asRecord(body['usage']);
  if (!usage) return undefined;

  const directInput = asFiniteNonNegativeNumber(usage['input_tokens']);
  const output = asFiniteNonNegativeNumber(usage['output_tokens']);
  if (directInput === undefined || output === undefined) return undefined;

  const cacheCreation = asFiniteNonNegativeNumber(usage['cache_creation_input_tokens']) ?? 0;
  const cacheRead = asFiniteNonNegativeNumber(usage['cache_read_input_tokens']) ?? 0;
  const input = directInput + cacheCreation + cacheRead;

  return { input, output, total: input + output };
}

function providerErrorDetails(
  body: unknown,
  response: Response,
): Record<string, unknown> {
  const root = asRecord(body);
  const error = root ? asRecord(root['error']) : undefined;
  const bodyRequestId = optionalString(root?.['request_id']);
  const headerRequestId = response.headers.get('request-id');

  return {
    provider: 'anthropic',
    httpStatus: response.status,
    ...(optionalString(error?.['type']) !== undefined
      ? { providerErrorType: optionalString(error?.['type']) }
      : {}),
    ...(bodyRequestId !== undefined
      ? { requestId: bodyRequestId }
      : headerRequestId
        ? { requestId: headerRequestId }
        : {}),
  };
}

export class AnthropicModelProvider implements ModelProvider {
  readonly providerName = 'anthropic';

  private readonly apiKey: string;
  private readonly apiVersion: string;
  private readonly workspaceId?: string;
  private readonly timeoutMs: number;
  private readonly defaultMaxTokens: number;
  private readonly baseUrl: string;
  private readonly fetchImpl: ProviderFetch;

  constructor(config: AnthropicModelProviderConfig) {
    if (config.apiKey.trim().length === 0) {
      throw new ModelInvocationError(
        'Anthropic API key is not configured',
        { provider: 'anthropic' },
        false,
      );
    }

    this.apiKey = config.apiKey;
    this.apiVersion = config.apiVersion ?? DEFAULT_ANTHROPIC_API_VERSION;
    this.workspaceId = config.workspaceId?.trim() || undefined;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.defaultMaxTokens = config.defaultMaxTokens ?? DEFAULT_MAX_TOKENS;
    this.baseUrl = (config.baseUrl ?? DEFAULT_ANTHROPIC_BASE_URL).replace(/\/$/, '');
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  getModelIdentity(policy: ModelPolicy): string {
    assertExplicitModelPolicy(policy, this.providerName);
    return `${policy.provider}:${policy.modelIdentifier}${policy.modelVersion ? `@${policy.modelVersion}` : ''}`;
  }

  async invoke(request: ModelRequest, policy: ModelPolicy): Promise<ModelResponse> {
    assertExplicitModelPolicy(policy, this.providerName);
    assertNoProviderNativeTools(request, this.providerName);

    const requestBody: Record<string, unknown> = {
      model: policy.modelIdentifier,
      max_tokens: policy.maxTokens ?? this.defaultMaxTokens,
      messages: [{ role: 'user', content: request.prompt }],
    };

    if (request.systemPrompt !== undefined) requestBody['system'] = request.systemPrompt;
    if (policy.temperature !== undefined) requestBody['temperature'] = policy.temperature;

    if (request.jsonSchema !== undefined) {
      requestBody['output_config'] = {
        format: {
          type: 'json_schema',
          schema: request.jsonSchema,
        },
      };
    }

    const { response, body } = await postProviderJson({
      providerName: this.providerName,
      fetchImpl: this.fetchImpl,
      url: `${this.baseUrl}/messages`,
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': this.apiVersion,
        ...(this.workspaceId !== undefined
          ? { 'anthropic-workspace-id': this.workspaceId }
          : {}),
        'Content-Type': 'application/json',
      },
      body: requestBody,
      timeoutMs: this.timeoutMs,
    });

    if (!response.ok) {
      throw new ModelInvocationError(
        `Anthropic model invocation failed with HTTP ${response.status}`,
        providerErrorDetails(body, response),
        isRetryableProviderStatus(response.status),
      );
    }

    const root = asRecord(body);
    if (!root) {
      throw new ModelOutputError('Anthropic returned a non-object response', {
        provider: this.providerName,
        modelIdentifier: policy.modelIdentifier,
      });
    }

    assertReturnedModelMatchesPolicy(optionalString(root['model']), policy, this.providerName);

    const rawText = extractOutputText(root);
    const tokenUsage = extractUsage(root);
    if (rawText === undefined || tokenUsage === undefined) {
      throw new ModelOutputError('Anthropic response is missing required output or usage metadata', {
        provider: this.providerName,
        modelIdentifier: policy.modelIdentifier,
        ...(optionalString(root['id']) !== undefined ? { responseId: optionalString(root['id']) } : {}),
      });
    }

    const result: ModelResponse = {
      rawText,
      parsedJson: parseJsonIfPossible(rawText),
      tokenUsage,
      modelIdentifier: policy.modelIdentifier,
      provider: this.providerName,
    };

    if (policy.modelVersion !== undefined) result.modelVersion = policy.modelVersion;
    return result;
  }
}
