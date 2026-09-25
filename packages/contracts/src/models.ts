export interface ModelPolicy {
  alias: string;
  provider: string;
  modelIdentifier: string;
  modelVersion?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ModelRequest {
  prompt: string;
  systemPrompt?: string;
  jsonSchema?: unknown;
  tools?: readonly string[];
}

export interface ModelResponse {
  rawText: string;
  parsedJson?: unknown;
  tokenUsage: { input: number; output: number; total: number };
  costUsd?: number;
  modelIdentifier: string;
  modelVersion?: string;
  provider: string;
}

export interface ModelExecutionRecord {
  requestHash: string;
  responseHash: string;
  provider: string;
  modelIdentifier: string;
  modelVersion?: string;
  tokenUsage: { input: number; output: number; total: number };
  costUsd?: number;
  timestamp: string;
}

export interface ModelProvider {
  readonly providerName: string;
  invoke(request: ModelRequest, policy: ModelPolicy): Promise<ModelResponse>;
  getModelIdentity(policy: ModelPolicy): string;
}
