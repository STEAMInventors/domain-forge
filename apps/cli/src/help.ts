export function printHelp(): void {
  console.log(`Domain Forge CLI

Global flags:
  --json     Emit deterministic JSON output
  --human    Emit concise human-readable output (default)

Commands:
  forge <domainName>                              Create a real ForgeRun and immutable domain intent
  create-run <domainId> <packId> <packVersion>   Create a new ForgeRun and DRAFT pack version
  inspect-run <runId>                           Inspect run state, transitions, and reviews
  execute-stage <runId>                         Execute the bootstrap example stage
  resume-run <runId>                            Resume a blocked/waiting run
  record-gate <runId> <gateType> <reviewerId>   Record human gate approval
  validate-pack <packVersionId>                 Deterministic pack validation
  inspect-pack <packVersionId>                  Inspect pack version and related records
  inspect-corpus <fixtureCorpusHash>            Inspect accepted fixture corpus reference
  qualify <packVersionId> <profileId> <profileVersion> <fixtureCorpusHash> <executionRunId> <executorTrustLevel> <hiveVersion> <executorVersion>
                                                Execute qualification and persist QualificationRecord
  certify <packVersionId> <qualificationRecordId> <certificationProfileId> <certificationProfileVersion> <reviewerId> <reviewerRole>
                                                Certify a PROVISIONAL pack using Step-15 service
  runtime-eligibility <packVersionId> <hiveVersion> [capabilitiesCsv] [qualificationRecordId] [extractionModelFamily] [extractionModelVersion] [extractionPolicyVersion]
                                                Evaluate runtime eligibility (read-only)
  provenance <packVersionId>                    Show pack provenance summary
  help                                          Show this help text
`);
}
