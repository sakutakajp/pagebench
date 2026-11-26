// Description only. No --execute mode or default selection/measurement path.
import{fileURLToPath}from'node:url';import{describe}from'./registry.mjs';
if(process.argv[1]===fileURLToPath(import.meta.url))try{if(process.argv.length!==4||process.argv[2]!=='--policy')throw Error();console.log(JSON.stringify(describe(process.argv[3])));}catch{console.log('{"kind":"PERSISTENT_STAGING_POLICY_DESCRIPTION","status":"SELECTION_REJECTED","measurement_authorized":false,"network_calls":0}');process.exitCode=1;}
