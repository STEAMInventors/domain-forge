import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { QualificationProfile } from '@domain-forge/contracts';
import { createQualificationProfileLoader, parseQualificationProfile } from './qualification-profile.js';

/** Load qualification profiles from configs/qualification/profiles — exact id+version only. */
export function loadQualificationProfilesFromDirectory(
  profilesDir: string,
): ReturnType<typeof createQualificationProfileLoader> {
  const profiles: QualificationProfile[] = [];
  const bootstrapDefault = join(profilesDir, 'bootstrap-default-v1.json');
  profiles.push(parseQualificationProfile(JSON.parse(readFileSync(bootstrapDefault, 'utf8'))));
  return createQualificationProfileLoader(profiles);
}
