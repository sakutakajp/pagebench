// Fixture projector double: emits only statically enumerated public literals.
// Unknown actual input is never parsed, retained or emitted as a path.
export*from'../rejected-paths-local/schema.mjs';
import{project as originalProject,own}from'../rejected-paths-local/schema.mjs';import{knownFixtureURL}from'./data.mjs';
let unknown=0,scopeMiss=0,saturated=false;const inc=k=>{if(k==='unknown'){if(unknown<65535)unknown++;else saturated=true;}else{if(scopeMiss<65535)scopeMiss++;else saturated=true;}};
export function projectionSnapshot(){return{unknown,scopeMiss,saturated};}
export function project(e,bound){if(!bound){inc('scope');return originalProject({},false);}const literal=knownFixtureURL(own(own(e,'request'),'url'));if(!literal){inc('unknown');return{path:null,state:'UNAVAILABLE',detail:'EVENT_UNAVAILABLE'};}return originalProject({request:{url:literal}},true);}
