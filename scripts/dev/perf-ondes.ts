// Coût du dessin des ondes sous le doigt (v5.22) : 6 ondes, canvas iPhone ×3.
//   npx tsx scripts/dev/perf-ondes.ts
import { createCanvas } from '@napi-rs/canvas';
import { drawRipples } from '../../src/render/ripples';
import { addRipple, type Ripple } from '../../src/core/feedback';
const c = createCanvas(844*3, 390*3); const ctx = c.getContext('2d') as any;
const list: Ripple[] = [];
const kinds = ['move','charge','attack','capture','select','tap'] as const;
for (let i=0;i<6;i++) addRipple(list,{x:100+i*80,y:200,kind:kinds[i],team:'#a9a9af'});
list.forEach((r,i)=>r.t=0.05*i);
const N=2000; const t0=performance.now();
for(let i=0;i<N;i++) drawRipples(ctx,list,false,3);
console.log(((performance.now()-t0)/N).toFixed(3),'ms / image pour 6 ondes');
