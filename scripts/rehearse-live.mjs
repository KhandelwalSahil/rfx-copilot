// Executes REAL Azure model calls, only with explicit local opt-in; no canned model results.
// Input is the workspace JSON exported after receiving generator-v2 demo replies.
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {handleAPI} from '../src/server.js';
import {rfxSourceSignature} from '../src/domain.js';
const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Usage: node scripts/rehearse-live.mjs workspace.json /absolute/private/rehearsal-output-directory');
if(process.env.AERCHAIN_ALLOW_LIVE!=='true')throw Error('Set AERCHAIN_ALLOW_LIVE=true explicitly. Real model usage may incur charges.');
if(!process.env.OPENAI_API_KEY||!process.env.MODEL_BASE_URL||!process.env.MODEL_DEPLOYMENT)throw Error('Configure OPENAI_API_KEY, MODEL_BASE_URL and MODEL_DEPLOYMENT privately in your local environment. Never paste keys into chat or commit them.');
const state=JSON.parse(fs.readFileSync(input,'utf8'));state.data={};state.chat=[];state.audit=[];state.version=1;fs.mkdirSync(output,{recursive:true,mode:0o700});
const config={allowLive:true,base:process.env.MODEL_BASE_URL,model:process.env.MODEL_DEPLOYMENT,key:process.env.OPENAI_API_KEY};
async function api(body){const response=await handleAPI(new Request('https://local.test/api',{method:'POST',headers:{'content-type':'application/json',origin:'https://local.test'},body:JSON.stringify({...body,config})}));const x=await response.json();if(!response.ok)throw Error(x.error);return x;}
function checkpoint(){fs.writeFileSync(path.join(output,'workspace-record.json'),JSON.stringify(state,null,2),{mode:0o600});}
for(const vendor of state.rfx.invitedVendors||['Metro','Bharat','Jaipur Paper','Rajan','QuickDesk']){
 const pack=state.packages[vendor];if(!pack&&(state.rfx.responseProfile==='supplier-v3'||state.rfx.scenarioId==='seven-supplier-2027')&&vendor==='NorthStar'){console.log('NorthStar: awaiting response; no model request made.');continue;}if(![2,3].includes(pack?.generatorVersion))throw Error('Use freshly generated v2 or v3 source documents for '+vendor);
 const files=[];for(const key of pack.files){const asset=pack.assets[key],name=asset.displayName;const filePath=path.join(output,path.basename(name));fs.writeFileSync(filePath,Buffer.from(asset.base64,'base64'),{mode:0o600});const prep=spawnSync('python3',[new URL('./prepare-source.py',import.meta.url).pathname,filePath],{encoding:'utf8',maxBuffer:20e6});if(prep.status!==0)throw Error('Could not prepare '+name+': '+prep.stderr);files.push(JSON.parse(prep.stdout));}
 const result=await api({action:'extract',rfx:state.rfx,vendor,files});state.data[vendor]={...result.result,meta:{model:result.model,responseId:result.responseId,at:result.at,files:result.files,rfxSignature:rfxSourceSignature(state.rfx)}};state.version++;checkpoint();console.log(vendor+': extraction saved with provider response ID.');
}
const questions=['Compare the complete quality-cleared bids. Explain exclusions and show total evaluated costs.','What is the cheapest per-line split among vendors who cleared the quality questionnaire? Show savings versus the best complete single bid.','Does the paper discount still apply under this allocation? Show the awarded volume and the threshold.','Which missing commercial commitments must be clarified before an award? Cite the supplier sources.','Now exclude the cheapest eligible supplier and recompute. Treat this as a what-if, not a confirmed buyer exclusion.'];
for(const question of questions){const result=await api({action:'ask',question,rfx:state.rfx,data:state.data,history:state.chat,version:state.version});state.chat.push({role:'user',text:question},{role:'assistant',...result});checkpoint();console.log('Analyst answer saved ('+result.traces.length+' tool calls).');}
console.log('Real rehearsal data saved. Run scripts/score-run.mjs on workspace-record.json and inspect sources manually. This transcript is NOT a screen recording.');
