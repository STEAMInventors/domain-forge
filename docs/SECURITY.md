# Security

## Secrets

- Via environment/configuration only
- Never commit API keys
- Redact secrets from logs

## Source Retrieval (SSRF Protection)

Implemented in `@domain-forge/sources/security.ts`:

- Allowed protocols: `http:`, `https:` only
- Blocked hosts: localhost, 127.0.0.1, .local
- No credentials in URLs
- Fetch size and timeout limits defined

## Prompt Injection Defenses

1. Retrieved content is **DATA**, never instruction
2. Model-generated URLs are not automatically trusted — Forge controls all fetches
3. Prompt injection in sources cannot modify Forge policy
4. Stage input projection limits what model sees from prior stages
5. Untrusted HTML/PDF treated as data; extraction separates content from markup

## Fixture Data

Synthetic fixtures only. No real customer/patient/legal-case documents.

## Least Privilege

File/storage access scoped to configured data directories.
