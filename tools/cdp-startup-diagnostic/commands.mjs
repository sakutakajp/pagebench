// Fixed command/scope enums only. No target/session IDs, params or response bodies.
const COMMANDS=new Set(['Target.setAutoAttach','Browser.getVersion','Target.setDiscoverTargets','Target.getTargets','Target.createTarget','Page.enable','Page.getFrameTree']);
const SCOPES=new Set(['BROWSER','TAB','BROWSER_UI','PAGE','UNCLASSIFIED_SESSION']);
const EVENTS=new Set(['SENT','RESPONDED','ERROR','TIMEOUT','CANCELLED']);
function descriptor(raw){if(!raw||!Number.isInteger(raw.command_no)||raw.command_no<1||raw.command_no>64||!COMMANDS.has(raw.command)||!SCOPES.has(raw.scope))return null;return Object.freeze({command_no:raw.command_no,command:raw.command,scope:raw.scope});}
export function freezeCommands(raw){
 const entries=[];for(const e of (Array.isArray(raw?.entries)?raw.entries:[]).slice(0,128)){const d=descriptor(e);if(d&&EVENTS.has(e.event))entries.push(Object.freeze({n:entries.length+1,...d,event:e.event}));}
 const timeouts=[];for(const t of (Array.isArray(raw?.timeouts)?raw.timeouts:[]).slice(0,64)){const d=descriptor(t);if(d)timeouts.push(Object.freeze({...d,pending:Object.freeze((Array.isArray(t.pending)?t.pending:[]).slice(0,64).map(descriptor).filter(Boolean))}));}
 return Object.freeze({entries:Object.freeze(entries),timeouts:Object.freeze(timeouts)});
}
export class CommandLog{
 constructor(){this.serial=0;this.entries=[];this.timeouts=[];}
 sent(command,scope){const d=descriptor({command_no:this.serial+1,command,scope});if(!d)return null;this.serial++;this.event(d,'SENT');return d;}
 event(d,event){if(this.entries.length<128)this.entries.push({...d,event});}
 timeout(d,pending){this.event(d,'TIMEOUT');this.timeouts.push({...d,pending});}
 snapshot(){return freezeCommands(this);}
}
