// CLOSED fixture adapter only. No CLI, admission, live factory or policy option.
// Reuses the reviewed post-flush opener; original six cases/verdicts stay intact.
import {observedNative} from '../proxy-cleanup-evidence/native.mjs';
import {postFlushOpen} from '../connect-postflush-closed/open.mjs';
export function observedFixtureNative(j,{diagnostics,hash,open=postFlushOpen}={}) {
  return observedNative(j,{diagnostics,hash,open});
}
