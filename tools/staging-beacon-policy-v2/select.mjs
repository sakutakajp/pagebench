// Inert configuration inspection. This CLI cannot authorize or start measurement.
import{selectPolicy,POLICY_ID}from'./registry.mjs';
let selected=false;
try{if(process.argv.length!==4||process.argv[2]!=='--policy')throw Error('FIXED_SELECTION');selectPolicy(process.argv[3]);selected=true;}catch{}
console.log(JSON.stringify({kind:'STAGING_BEACON_V2_CONFIGURATION',policy_id:selected?POLICY_ID:null,selected,measurement_authorized:false,network_calls:0,request_limit:400,inflight_limit:6,document_limit:1,prefetch:'UNCHANGED',suffix:'V_HEX32_DECIMAL13_ONE_SEGMENT'}));
if(!selected)process.exitCode=1;
