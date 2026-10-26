import {join} from 'node:path';

export const stockTuneDefaults = {enabled:true, mode:'quick', goal:'speed', leaveRam:0, use:'chat', allowSmallDifferences:false, allowNotRepeatable:false};
export const stockKv = {'FP16/FP16':'fp16', 'Q8/Q8':'int8', 'Q8/Q4':'k8v4', 'Q4/Q4':'q4_0'};
export function tuneSettings(value={}) {
 const t={...stockTuneDefaults,...value};
 if(!['quick','thorough'].includes(t.mode)||!['speed','room'].includes(t.goal)||!['chat','coding'].includes(t.use))throw new Error('Invalid stock Strata tuning mode, goal or workload.');
 if(!Number.isInteger(t.leaveRam)||t.leaveRam<0||t.leaveRam>50)throw new Error('RAM reserve must be an integer from 0 to 50 percent.');
 for(const k of ['enabled','allowSmallDifferences','allowNotRepeatable'])if(typeof t[k]!=='boolean')throw new Error(`Invalid auto-tune ${k}.`);
 return t;
}

/** Migration changes only plugin profiles. The caller saves the complete old file first. */
export function migrateStock(profile, receipt) {
 if(profile.nativeServer)return profile;
 let p=structuredClone(profile);
 if(!['stock','stock-extensions'].includes(p.engineFlavor)) {
  p.legacyEngine=structuredClone({sourceDir:p.sourceDir,executable:p.executable,python:p.python,options:p.options,extraArgs:p.extraArgs,environment:p.environment,tuned:p.tuned,tunePolicy:p.tunePolicy,externalMtpPath:p.externalMtpPath,kvK:p.kvK,kvV:p.kvV});
  p.engineFlavor='stock';p.needsStockRuntime=true;p.autoTune={...stockTuneDefaults};p.tuned={};p.tuneReport=null;
  p.migrationNotes=['Migrated from Strata Unleashed to stock Strata. Previous settings are retained in the profile backup.'];
  delete p.importedEngineArgs;delete p.importedFingerprint;
  if(p.architecture==='qwen35moe') {
   p.kvK=p.kvV='FP32';p.kvCache=false;p.residentMode='percent';p.residentPercent=100;
   for(const key of ['--snapshots','--mtp-sampled','--gqa-attn','--kv','--mtp-model'])delete p.options[key];
   p.extraArgs=(p.extraArgs||[]).filter((arg,i,args)=>!/^--(?:snapshots|mtp-sampled|gqa-attn|kv|mtp-model)(?:=|$)/.test(arg)&&!(i>0&&/^--(?:snapshots|kv|mtp-model)$/.test(args[i-1])&&!arg.startsWith('--')));
   if(p.externalMtpPath){p.externalMtpPath='';if(!p.embeddedMtp)p.options['--mtp']=0;}
   p.migrationNotes.push('Stock Qwen3.6 uses native FP32 KV and embedded MTP only; fork-only INT8 KV, external MTP and flags are disabled until their optional extensions are enabled.');
  }else if(!stockKv[`${p.kvK}/${p.kvV}`]) {
   p.kvK=p.kvV='Q8';p.migrationNotes.push('The fork-only mixed KV format was replaced with stock INT8 K/V.');
  }
 }
 if(receipt&&p.needsStockRuntime) {
  p={...p,...receipt,needsStockRuntime:false};
  // Replace engine-owned resources, keeping all user model/pack/tokenizer files in place.
  if(/unleashed/i.test(p.options?.['--expert-profile']||''))p.options['--expert-profile']=join(receipt.sourceDir,'data','expert-profile.bin');
 }
 return p;
}

export function presetDirectory(root,p){return join(root,'presets',p.id);}
