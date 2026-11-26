// Storage identity only. Never returns or changes browser admission authority.
import {plainData} from '../native-score-proof/case-project.mjs';
import {ownerRecord} from '../script-owner/owner-record.mjs';import {scope} from './config.mjs';
export function storageScope(grant,identity=scope()){
 if(!plainData(grant)||!plainData(identity)||Object.keys(grant).sort().join(',')!=='attempt,binary,chrome,mode,ref,run,sha'||Object.keys(identity).sort().join(',')!=='attempt,mode,ref,run,sha')throw Error('FIXED_DIAGNOSTIC_STORAGE');
 const canonical=scope({GITHUB_ACTIONS:'true',GITHUB_REF:identity.ref,GITHUB_SHA:identity.sha,GITHUB_RUN_ID:identity.run,GITHUB_RUN_ATTEMPT:String(identity.attempt)});
 if(Object.keys(canonical).some(k=>identity[k]!==canonical[k]||grant[k]!==canonical[k])||!/^([a-f0-9]{64})$/.test(grant.binary)||!/^(Chrome|HeadlessChrome)\/\d+\.\d+\.\d+\.\d+$/.test(grant.chrome))throw Error('FIXED_DIAGNOSTIC_STORAGE');
 return Object.freeze(canonical);
}
// This exact function is used by the default LIVE branch and the file/CLI regression.
export function openOwnerRecord(grant){return ownerRecord(storageScope(grant));}
