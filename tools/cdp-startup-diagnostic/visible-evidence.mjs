// Read-only, post-Lighthouse observation. This never changes acceptance or waits
// for hydration. Counts remain ephemeral except the pre-existing success fields.
const BOOLS=['body_text_minimum_met','headings_present','document_url_matches','page_url_matches','body_present','body_text_content_minimum_met','body_layout_present','heading_layout_present','nuxt_root_present','viewport_nonempty','viewport_matches_report','unapproved_api_blocked','static_or_query_blocked','prefetch_blocked'];
export function safeVisibleEvidence(value){
 const out={};for(const key of BOOLS)out[key]=typeof value?.[key]==='boolean'?value[key]:null;
 out.ready_state=['loading','interactive','complete'].includes(value?.ready_state)?value.ready_state:'UNKNOWN';
 out.hydration=['HYDRATING','SETTLED','UNAVAILABLE'].includes(value?.hydration)?value.hydration:'UNAVAILABLE';
 return out;
}
export function visiblePolicyEvidence(stats){
 const c=stats?.blocked_categories;
 const valid=n=>Number.isInteger(n)&&n>=0&&n<=10000;
 const category=key=>c&&typeof c==='object'&&!Array.isArray(c)?Object.hasOwn(c,key)?valid(c[key])?c[key]>0:null:false:null;
 const resource=category('UNAPPROVED_RESOURCE'),query=category('UNSAFE_QUERY');
 return{unapproved_api_blocked:category('UNAPPROVED_API'),static_or_query_blocked:resource===null||query===null?null:resource||query,prefetch_blocked:valid(stats?.prefetch_blocked)?stats.prefetch_blocked>0:null};
}
// Self-contained because Puppeteer serializes this function into the shared page.
export function sampleVisibleDocument({target,screen}){
 const body_characters=document.body?.innerText.trim().length||0;
 const headings=document.querySelectorAll('h1,h2').length;
 const flags={body_text_minimum_met:body_characters>=20,headings_present:headings>=1};
 try{flags.document_url_matches=location.href===target;}catch{}
 try{flags.body_present=!!document.body;flags.body_text_content_minimum_met=(document.body?.textContent.trim().length||0)>=20;flags.body_layout_present=Array.from(document.body?.getClientRects()||[]).some(r=>r.width>0&&r.height>0);flags.heading_layout_present=Array.from(document.querySelectorAll('h1,h2')).some(h=>Array.from(h.getClientRects()).some(r=>r.width>0&&r.height>0));}catch{}
 try{flags.ready_state=document.readyState;}catch{}
 try{const root=document.querySelector('#__nuxt');flags.nuxt_root_present=!!root;const v=root?.__vue_app__?.config?.globalProperties?.$nuxt?.isHydrating;flags.hydration=v===true?'HYDRATING':v===false?'SETTLED':'UNAVAILABLE';}catch{}
 try{flags.viewport_nonempty=innerWidth>0&&innerHeight>0;if(screen&&Number.isFinite(screen.width)&&Number.isFinite(screen.height)&&screen.disabled!==true)flags.viewport_matches_report=innerWidth===screen.width&&innerHeight===screen.height;}catch{}
 return{body_characters,headings,flags};
}
export async function observeVisibleDocument(page,target,screen){
 let pageMatch=null;try{pageMatch=page.url()===target;}catch{}
 const v=await page.evaluate(sampleVisibleDocument,{target,screen});
 return{body_characters:v.body_characters,headings:v.headings,diagnostic:safeVisibleEvidence({...v.flags,page_url_matches:pageMatch})};
}
