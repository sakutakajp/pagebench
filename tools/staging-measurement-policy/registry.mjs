// Persistent configuration, no activation on import/description/selection.
import{readFileSync}from'node:fs';import{ORIGINS as verifiedOrigins}from'../staging-cloudflare-origin/config.mjs';
export const POLICY_ID='staging-ja-cloudflare-script-400-v1';
const expected={schema:1,id:POLICY_ID,activation:'EXPLICIT_SELECTION_AFTER_EXISTING_ADMISSION',target:'https://staging.hirameki.dev/ja/',origins:[...verifiedOrigins],new_origin_resource_types:['Script'],new_origin_methods:['GET','HEAD'],https_port:443,document_limit:1,request_limit:400,inflight_limit:6,prefetch:'SAME_POLICY_AS_ORDINARY_READS',path_query_policy:'UNCHANGED_REVIEWED_STATIC_AND_PUBLIC_CONTENT_POLICY',publication:'FIXED_PROJECTION_ONLY',authority:'CONFIGURATION_ONLY_NOT_MEASUREMENT_AUTHORIZATION'};
export function validateRegistration(v){return JSON.stringify(v)===JSON.stringify(expected);}
const raw=JSON.parse(readFileSync(new URL('../../config/staging-measurement-policy.json',import.meta.url)));if(!validateRegistration(raw))throw Error('STAGING_POLICY_INVALID');
export const ORIGINS=Object.freeze([...raw.origins]);export const PUBLIC_HOSTS=Object.freeze(ORIGINS.map(o=>new URL(o).hostname));
const registration=Object.freeze({...raw,origins:ORIGINS,new_origin_resource_types:Object.freeze([...raw.new_origin_resource_types]),new_origin_methods:Object.freeze([...raw.new_origin_methods])});
export function selectPolicy(id){if(id!==POLICY_ID)throw Error('STAGING_POLICY_SELECTION_REQUIRED');return registration;}
export function describe(id){const x=selectPolicy(id);return{kind:'PERSISTENT_STAGING_POLICY_DESCRIPTION',policy_id:x.id,explicit_selection:true,configuration_only:true,measurement_authorized:false,main_or_existing_workflow_changed:false,new_host_script_only:true,https_standard_port_only:true,request_limit:x.request_limit,inflight_limit:x.inflight_limit,document_limit:x.document_limit,prefetch:'UNCHANGED',path_query_policy:'UNCHANGED',network_calls:0};}
