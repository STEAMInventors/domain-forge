const domain = process.argv[2]?.trim();
const policyAlias = process.argv[3]?.trim() || 'research.high_accuracy';

if (!domain) {
  console.error(
    'Usage: node --env-file=.env scripts/model-smoke.mjs <domain> [policyAlias]',
  );
  process.exit(2);
}

const { createProductionModelRuntimeFromEnv } = await import('../packages/models/dist/index.js');

const { modelProvider, policyRegistry } = createProductionModelRuntimeFromEnv(process.env);
const policy = policyRegistry.resolve(policyAlias);

console.log('DOMAIN FORGE MODEL SMOKE');
console.log('');
console.log(`Domain: ${domain}`);
console.log(`Policy: ${policy.alias}`);
console.log(`Provider: ${policy.provider}`);
console.log(`Model: ${policy.modelIdentifier}`);
console.log('');

const response = await modelProvider.invoke(
  {
    prompt: [
      'This is a Domain Forge connectivity smoke test.',
      `The user supplied this domain label: ${JSON.stringify(domain)}.`,
      'Return one short sentence confirming that you received the domain label.',
      'Do not browse, research, infer domain rules, propose Domain Pack semantics, or create a Domain Pack.',
    ].join('\n'),
  },
  policy,
);

console.log('RESULT');
console.log(response.rawText);
console.log('');
console.log('USAGE');
console.log(JSON.stringify(response.tokenUsage, null, 2));
