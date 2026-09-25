# Certification

## Gate

Only explicit human action: `PROVISIONAL → CERTIFIED`

The model never certifies output.

## Certification Record

Must record:

- certification ID
- pack ID, pack version
- exact `packContentHash`
- reviewer ID, role, credential descriptor
- decision, notes, timestamp
- certification policy version

## Hash Binding

Certification for hash A never certifies hash B. Modified pack content invalidates prior certification applicability (`certificationApplies`).

## Bootstrap

Implemented in `@domain-forge/certification`. CLI `certify` command for human certification recording.
