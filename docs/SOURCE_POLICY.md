# Source Policy

## Forge-Controlled Research

Provider-native web search and page retrieval are **disabled** for research stages.

## Flow

```
Model requests search → Forge SearchProvider executes → results returned
Model requests URL → Forge SourceRetriever fetches → snapshot stored → hash recorded → content returned
```

## SourceSnapshot

Minimum fields: sourceSnapshotId, URL, retrieval timestamp, raw content, extracted raw text, normalized text, content hash, extraction/normalization versions, source tier, jurisdiction.

Retrieval, extraction, normalization, storage, and evidence selection are separate concepts.

## Quote Verification (v0)

Normalization performs ONLY:

1. Unicode NFC
2. Whitespace collapsing
3. Quote-mark folding

Verification against normalized stored text. Failure → `EVIDENCE_VERIFICATION_FAILED`.

No fuzzy matching, OCR correction, or paraphrase.

## Search Snippets

Discovery aids only. Not authoritative until URL fetched and snapshotted.
