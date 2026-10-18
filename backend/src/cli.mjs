import {readFile} from 'node:fs/promises';
import {timingSafeEqual} from 'node:crypto';
import {createVoiceServer} from './server.mjs';
import {OpenAICompatibleProvider} from './providers.mjs';

if(!process.env.VOICE_POLICY_FILE)throw new Error('Set VOICE_POLICY_FILE to server-owned scope/tool policy JSON');
if(!process.env.VOICE_AUTH_TOKEN)throw new Error('Set VOICE_AUTH_TOKEN, or embed createVoiceServer with your host authentication');
const policy=JSON.parse(await readFile(process.env.VOICE_POLICY_FILE,'utf8'));
const expected=Buffer.from(`Bearer ${process.env.VOICE_AUTH_TOKEN}`);
const service=createVoiceServer({
  provider:new OpenAICompatibleProvider({baseUrl:process.env.LITELLM_BASE_URL,apiKey:process.env.LITELLM_API_KEY,openAIKey:process.env.OPENAI_API_KEY,elevenLabsKey:process.env.ELEVENLABS_API_KEY,elevenLabsVoice:process.env.ELEVENLABS_VOICE_ID}),
  origins:(process.env.VOICE_ALLOWED_ORIGINS??'').split(',').filter(Boolean),
  publicUrl:process.env.VOICE_PUBLIC_URL,
  authorize:req=>{const actual=Buffer.from(req.headers.authorization??'');return actual.length===expected.length&&timingSafeEqual(actual,expected)?policy:null;},
});
const address=await service.listen(Number(process.env.PORT??8081),process.env.HOST??'127.0.0.1');
console.log(`Voice backend listening on ${address.address}:${address.port}`);
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,async()=>{await service.close();process.exit(0);});
