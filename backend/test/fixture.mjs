/** Test-only fixture. Production CLI never imports or selects this provider. */
import {setTimeout as delay} from 'node:timers/promises';
export const fixturePolicy={organizations:['noizu-labs'],projects:['noizu-infra'],backends:['litellm'],engines:['tts','elevenlabs','openai-realtime'],models:['fixture-model','fixture-model-2','gpt-realtime-mini'],allowSystemPrompt:true,tools:{'fixture.echo':{description:'Test echo',invoke:args=>args}}};
export class FixtureProvider {
  async respond({messages,signal,emit}) {
    const content=messages.at(-1).content;
    const text=Array.isArray(content)?`${content[0].text} [image received]`:content;
    emit({type:'animation',state:'tool_running'});
    if(text.includes('slow'))await delay(250,undefined,{signal});
    signal.throwIfAborted();return `Sandbox voice reply: ${text}`;
  }
  async transcribe(){return 'Recorded sandbox voice';}
  async speak(text,{signal,emit}){signal.throwIfAborted();emit({type:'audio',data:Buffer.alloc(text.includes('long audio')?192000:480).toString('base64'),mimeType:'audio/pcm',sampleRate:24000});}
  async mintRealtime(){throw Object.assign(new Error('Fixture does not mint real provider credentials'),{code:'fixture_realtime_unavailable'});}
}
