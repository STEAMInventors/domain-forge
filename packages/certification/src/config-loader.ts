import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CertificationProfileLoader } from '@domain-forge/contracts';
import {
  createCertificationProfileLoader,
  parseCertificationProfile,
} from './certification-profile.js';

/** Load certification profiles from configs/certification/profiles — exact id+version only. */
export function loadCertificationProfilesFromDirectory(
  profilesDir: string,
): CertificationProfileLoader {
  const profiles = [];
  const bootstrapDefault = join(profilesDir, 'bootstrap-default-v1.json');
  profiles.push(parseCertificationProfile(JSON.parse(readFileSync(bootstrapDefault, 'utf8'))));
  return createCertificationProfileLoader(profiles);
}
