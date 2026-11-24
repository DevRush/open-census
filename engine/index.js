/* engine/index.js — Node loader. const HOSP=require('./engine')({seed, now, handwritten:true|false});
   Loads the same files, in the same order, that a browser page loads (see engine/load-order.json). */
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..');
function files(){const order=JSON.parse(fs.readFileSync(path.join(__dirname,'load-order.json'),'utf8'));let out=[];
  order.forEach(e=>{if(e.endsWith('/')){fs.readdirSync(path.join(root,e)).filter(f=>f.endsWith('.js')).sort().forEach(f=>out.push(e+f));}else out.push(e);});return out;}
function handwritten(){const ctx={console};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'data.js'),'utf8'),ctx);
  fs.readdirSync(path.join(root,'patients')).filter(f=>/^p\d+\.js$/.test(f)).sort((a,b)=>parseInt(a.slice(1))-parseInt(b.slice(1))).forEach(f=>vm.runInContext(fs.readFileSync(path.join(root,'patients',f),'utf8'),ctx,{filename:f}));
  /* dates made in the other context are still Date objects for our purposes, but re-wrap so instanceof works here */
  const fix=o=>{if(o&&typeof o==='object'){if(Object.prototype.toString.call(o)==='[object Date]')return new Date(o.getTime());if(Array.isArray(o))return o.map(fix);const r={};for(const k in o)r[k]=fix(o[k]);return r;}return o;};
  return fix(vm.runInContext('seed().concat(EXTRA.map(function(f){return f();}))',ctx));}
module.exports=function(opts){opts=opts||{};if(!globalThis.HOSP||!globalThis.HOSP.buildChart){files().forEach(f=>require(path.join(root,f)));}
  const H=globalThis.HOSP;const o={seed:opts.seed,now:opts.now,truthInKey:opts.truthInKey,handwritten:opts.handwritten===false?false:(Array.isArray(opts.handwritten)?opts.handwritten:handwritten())};H.init(o);return H;};
module.exports.files=files;module.exports.root=root;
