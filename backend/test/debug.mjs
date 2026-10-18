import {createVoiceServer} from '../src/server.mjs';
import {FixtureProvider,fixturePolicy} from './fixture.mjs';
const service=createVoiceServer({provider:new FixtureProvider(),authorize:()=>fixturePolicy,origins:['http://127.0.0.1:8090','http://localhost:8090']});
await service.listen(8081,'127.0.0.1');
console.log('TOOLKIT TEST FIXTURE voice backend on http://127.0.0.1:8081 (no paid provider calls)');
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,async()=>{await service.close();process.exit(0);});
