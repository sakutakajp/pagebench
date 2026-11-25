// TEST ONLY: actual Node IPC/start grant, fixed VM/CDP model, no Chrome/network.
import {awaitStart} from '../nuxt-debug/protocol.mjs';import {progressWriter} from '../natural-reads/live-journal.mjs';
import {run400Control} from '../public-rejection-logs/control.mjs';import {scoped400Record} from '../natural-reads/scoped400-record.mjs';
import {scope,writeCounts,fixedWrite} from './records.mjs';import {childOwner} from './evidence.mjs';import {writeFileSync} from 'node:fs';import {join} from 'node:path';
await awaitStart();const[mode,directory]=process.argv.slice(2),s=scope(),owner=childOwner(directory,s),emit=progressWriter(process.env.PB_NATURAL_DIRECTORY);
emit({phase:'OPEN',navigation_invocations:0,evidence:null,passive_signals:null,samples:null,nuxt_error:null});
if(mode==='unsealed_zero')process.exit(1);
if(mode==='sealed_zero'){owner.seal();process.exit(1);}
const page={goto(){return Promise.resolve();}};owner.wrapGoto(page);await page.goto('FIXED_MODEL_DELEGATE_NOT_A_URL');
if(mode==='unsealed_call')process.exit(1);
const r=await run400Control({profile:'CLOSED400',beforeAck:mode==='stop'?405:4,afterStop:mode==='stop'?40:0,earlyFcp:true,onProgress:emit}),record=scoped400Record(r.result,r.census,r.meter);if(!record)throw Error('FIXED_RECORD');
writeCounts(directory,r.rejections,s);fixedWrite(record,join(directory,'record.json'));owner.note({phase:'OBSERVATION_RETURNED',observation:r.result.status==='OBSERVED'?'OBSERVED':'FAILED_OR_UNKNOWN',cleanup:r.result.cleanup==='complete'?'COMPLETE':'UNKNOWN'});owner.note({phase:'RECORD_READBACK',record:'WRITTEN_AND_READBACK'});owner.seal();
if(mode==='record_invalid')writeFileSync(join(directory,'record.json'),'{}');
emit(record.observation);await new Promise(resolve=>process.send({kind:'natural-final',observation:record.observation,transport:{kind:'CLOSED_ABSENT',forwarding:'ABSENT',upstream:0,open_sockets:0,closed:true}},resolve));process.disconnect();process.exitCode=record.observation.status==='OBSERVED'?0:1;
