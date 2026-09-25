import type { ModelPolicy, ModelProvider, ModelRequest, ModelResponse } from '@domain-forge/contracts';
import { ModelInvocationError, ModelOutputError } from '@domain-forge/core';
import {
  asFiniteNonNegativeNumber,
  asRecord,
  assertExplicitModelPolicy,
  assertNoProviderNativeTools,
  isRetryableProviderStatus,
  optionalString,
  parseJsonIfPossible,
  postProviderJson,
  type ProviderFetch,
} from './provider-http.js';

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_TIMEOUT_MS = 120_000;

export interface OpenAIModelProviderConfig {
  readonly apiKey: string;
  readonly timeoutMs?: number;
  readonly baseUrl?: string;
  readonly fetchImpl?: ProviderFetch;
}

function extractOutputText(body: Readonly<Record<string, unknown>>): string | undefined {
  if (typeof body['output_text'] === 'string') return body['output_text'];

  const output = body['output'];
  if (!Array.isArray(output)) return undefined;

  const text: string[] = [];
  for (const item of output) {
    const itemRecord = asRecord(item);
    if (!itemRecord) continue;

    const content = itemRecord['content'];
    if (!Array.isArray(content)) continue;

    for (const part of content) {
      const partRecord = asRecord(part);
      if (!partRecord) continue;

      if (partRecord['type'] === 'output_text' && typeof partRecord['text'] === 'string') {
        text.push(partRecord['text']);
      } else if (partRecord['type'] === 'refusal' && typeof partRecord['refusal'] === 'string') {
        text.push(partRecord['refusal']);
      }
    }
  }

  return text.length > 0 ? text.join('\n') : undefined;
}

function extractUsage(body: Readonly<Record<string, unknown>>): ModelResponse['tokenUsage'] | undefined {
  const usage = asRecord(body['usage']);
  if (!usage) return undefined;

  const input = asFiniteNonNegativeNumber(usage['input_tokens']);
  const output = asFiniteNonNegativeNumber(usage['output_tokens']);
  if (input === undefined || output === undefined) return undefined;

  const reportedTotal = asFiniteNonNegativeNumber(usage['total_tokens']);
  return { input, output, total: reportedTotal ?? input + output };
}

function providerErrorDetails(
  body: unknown,
  response: Response,
): Readonly<Record<string, unknown>> {
  const root = asRecord(body);
  const error = root ? asRecord(root['error']) : undefined;

  return {
    provider: 'openai',
    httpStatus: response.status,
    ...(optionalString(error?.['type']) !== undefined
      ? { providerErrorType: optionalString(error?.['type']) }
      : {}),
    ...(optionalString(error?.['code']) !== undefined
      ? { providerErrorCode: optionalString(error?.['code']) }
      : {}),
    ...(response.headers.get('x-request-id')
      ? { requestId: response.headers.get('x-request-id') as string }
      : {}),
  };
}

export class OpenAIModelProvider implements ModelProvider {
  readonly providerName = 'openai';

  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly baseUrl: string;
  private readonly fetchImpl: ProviderFetch;

  constructor(config: OpenAIModelProviderConfig) {
    if (config.apiKey.trim().length === 0) {
      throw new ModelInvocationError('OpenAI API key is not configured', { provider: 'openai' }, false);
    }

    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.baseUrl = (config.baseUrl ?? DEFAULT_OPENAI_BASE_URL).replace(/\/$/, '');
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
      input: request.prompt,
    };

    if (request.systemPrompt !== undefined) requestBody['instructions'] = request.systemPrompt;
    if (policy.maxTokens !== undefined) requestBody['max_output_tokens'] = policy.maxTokens;
    if (policy.temperature !== undefined) requestBody['temperature'] = policy.temperature;

    if (request.jsonSchema !== undefined) {
      requestBody['text'] = {
        format: {
          type: 'json_schema',
          name: 'domain_forge_output',
          schema: request.jsonSchema,
          strict: true,
        },
      };
    }

    const { response, body } = await postProviderJson({
      providerName: this.providerName,
      fetchImpl: this.fetchImpl,
      url: `${this.baseUrl}/responses`,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: requestBody,
      timeoutMs: this.timeoutMs,
    });

    if (!response.ok) {
      throw new ModelInvocationError(
        `OpenAI model invocation failed with HTTP ${response.status}`,
        providerErrorDetails(body, response),
        isRetryableProviderStatus(response.status),
      );
    }

    const root = asRecord(body);
    if (!root) {
      throw new ModelOutputError('OpenAI returned a non-object response', {
        provider: this.providerName,
        modelIdentifier: policy.modelIdentifier,
      });
    }

    const rawText = extractOutputText(root);
    const tokenUsage = extractUsage(root);
    if (rawText === undefined || tokenUsage === undefined) {
      throw new ModelOutputError('OpenAI response is missing required output or usage metadata', {
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
