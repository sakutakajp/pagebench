// Public synthetic constants only. No real site, user input or variable origin.
export const ORIGIN='http://127.0.0.1:47500';
export const CASES=Object.freeze(['normal','unique401','duplicates','longest401','overflow1100','redacted401','post401']);
function longest(i){const base='/'+Array(80).fill('ab').join('/')+'/p'+i;return base+'c'.repeat(256-base.length);}
export function rowsFor(name){if(!CASES.includes(name))throw Error('FIXED_CASE');if(name==='normal')return[];const n=name==='overflow1100'?1100:401,rows=Array.from({length:n},(_,i)=>Object.freeze({path:name==='longest401'?longest(i):name==='redacted401'?'/token-'+i:'/blocked-'+String(i).padStart(4,'0')+'.js',method:name==='post401'?'POST':'GET'}));if(name==='duplicates'||name==='overflow1100')for(let i=0;i<5;i++)rows.push(Object.freeze({path:'/blocked-0000.js?fixed=1',method:'GET'}));return rows;}
const known=new Map();for(const name of CASES)for(const r of rowsFor(name)){const u=ORIGIN+r.path;known.set(u,u);}export const knownFixtureURL=value=>typeof value==='string'?known.get(value):undefined;
export function expected(name){const rows=rowsFor(name);return{events:rows.length,retained:name==='normal'?0:name==='redacted401'?1:name==='overflow1100'?1024:401,omitted:name==='overflow1100'?76:0,duplicates:name==='duplicates'||name==='overflow1100'?6:null};}
