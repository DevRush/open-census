/* engine/core.js — namespace, seeded randomness, dates, text templating, registries.
   Loads first. No dependencies. Works as a plain <script> in the browser and with require() in Node. */
(function(g){
'use strict';
var H=g.HOSP=g.HOSP||{};
H.version='1.0';
H.BASE_NOW=new Date(2026,10,17,14,30);      // simulated "now" at start (same as NOW in data.js)
H.DEFAULT_SEED=20261117;
H.cfg={seed:H.DEFAULT_SEED,now:new Date(H.BASE_NOW.getTime())};

/* ---------- registries filled by hospital/ and modules/ files ---------- */
H.conditions={};H.comorbidities={};H.clinicModules={};H.complications={};
H.T={labs:{},meds:{},freq:{},panels:[],vitals:{},phr:{},defaults:{}};        // shared tables
H.model={buildings:[],units:[],services:[],consults:[],clinics:[],ors:[],names:{}};
H.condition=function(m){H.conditions[m.key]=m;return m;};
H.comorbidity=function(m){H.comorbidities[m.key]=m;return m;};
H.clinic=function(m){H.clinicModules[m.key]=m;return m;};
H.complication=function(m){H.complications[m.key]=m;return m;};

/* ---------- hashing and random numbers ---------- */
H.hash=function(s){s=String(s);var h=2166136261>>>0;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
  h^=h>>>15;h=Math.imul(h,2246822507);h^=h>>>13;h=Math.imul(h,3266489909);h^=h>>>16;return h>>>0;};
H.mulberry=function(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;var t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};};
/* H.R('any string') -> random source that depends only on the hospital seed and that string */
H.R=function(key){var f=H.mulberry(H.hash(H.cfg.seed+'|'+key));
  var R={f:f,
    int:function(a,b){return a+Math.floor(f()*(b-a+1));},
    chance:function(p){return f()<p;},
    pick:function(a){return a[Math.floor(f()*a.length)];},
    tri:function(lo,hi,mode){if(mode==null)mode=(lo+hi)/2;var u=f(),c=(mode-lo)/(hi-lo||1);return u<c?lo+Math.sqrt(u*(hi-lo)*(mode-lo)):hi-Math.sqrt((1-u)*(hi-lo)*(hi-mode));},
    norm:function(m,sd){return m+sd*((f()+f()+f()+f())-2)*1.732;},
    /* weighted pick: items = array, w = function(item)->weight */
    wpick:function(items,w){var tot=0,i,ws=[];for(i=0;i<items.length;i++){var x=Math.max(0,w(items[i]));ws.push(x);tot+=x;}if(tot<=0)return items[0];
      var u=f()*tot;for(i=0;i<items.length;i++){u-=ws[i];if(u<0)return items[i];}return items[items.length-1];},
    /* weighted pick from an object {key:weight} -> key */
    wkey:function(o){var ks=Object.keys(o);return R.wpick(ks,function(k){return o[k];});}};
  return R;};
/* deterministic noise in [-1,1] for (key) — used so any reading can be recomputed on its own */
H.noise=function(key){return H.hash(H.cfg.seed+'~'+key)/2147483648-1;};
H.unit01=function(key){return H.hash(H.cfg.seed+'^'+key)/4294967296;};

/* ---------- dates (local time, like data.js) ---------- */
var MON=H.MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var DOW=H.DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function p2(n){return (n<10?'0':'')+n;}
H.p2=p2;
H.addH=function(d,h){return new Date(Math.round((d.getTime()+h*3600000)/60000)*60000);};   // always lands on a whole minute
H.addMin=function(d,m){return new Date(d.getTime()+Math.round(m)*60000);};
H.addD=function(d,n){var x=new Date(d.getTime());x.setDate(x.getDate()+n);return x;};
H.day0=function(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate());};
H.at=function(d,h,m){return new Date(d.getFullYear(),d.getMonth(),d.getDate(),h,m||0);};
H.days=function(a,b){return (b.getTime()-a.getTime())/86400000;};          // b - a in days (fractional)
H.calDays=function(a,b){return Math.round((H.day0(b)-H.day0(a))/86400000);}; // whole calendar days
H.hm=function(d){return p2(d.getHours())+':'+p2(d.getMinutes());};
H.dm=function(d){return d.getDate()+' '+MON[d.getMonth()];};
H.dmy=function(d){return p2(d.getDate())+' '+MON[d.getMonth()]+' '+d.getFullYear();};
H.dt=function(d){return H.dm(d)+' '+H.hm(d);};
H.iso=function(d){return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())+'T'+p2(d.getHours())+':'+p2(d.getMinutes());};
H.isoDate=function(d){return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());};
H.parseDate=function(s){if(s instanceof Date)return s;var m=/^(\d{4})-(\d\d)-(\d\d)(?:T(\d\d):(\d\d))?/.exec(s);return m?new Date(+m[1],+m[2]-1,+m[3],+(m[4]||0),+(m[5]||0)):new Date(s);};
H.weekIndex=function(d){return Math.floor((H.day0(d).getTime()-new Date(2020,0,6).getTime())/604800000+0.01);};  // weeks since Mon 6 Jan 2020
H.weekStart=function(w){return H.addD(new Date(2020,0,6),w*7);};

/* ---------- numbers and text ---------- */
H.round=function(v,dec){var m=Math.pow(10,dec||0);return Math.round(v*m)/m;};
H.clamp=function(v,lo,hi){return v<lo?lo:v>hi?hi:v;};
H.num=function(n){return String(n).replace(/\B(?=(\d{3})+(?!\d))/g,',');};         // 1850 -> '1,850'
H.signed=function(n){return (n<0?'−':'+')+H.num(Math.abs(Math.round(n)));};   // '+540' / '−620'
H.cap=function(s){return s?s.charAt(0).toUpperCase()+s.slice(1):s;};
H.list=function(a){return a.length<2?a.join(''):a.slice(0,-1).join(', ')+' and '+a[a.length-1];};
/* piecewise-linear interpolation over [[x,y],...] sorted by x; holds the end values */
H.interp=function(pts,x){if(!pts||!pts.length)return 0;if(x<=pts[0][0])return pts[0][1];var n=pts.length;if(x>=pts[n-1][0])return pts[n-1][1];
  for(var i=0;i<n-1;i++){var a=pts[i],b=pts[i+1];if(x>=a[0]&&x<=b[0])return a[1]+(b[1]-a[1])*(x-a[0])/((b[0]-a[0])||1);}return pts[n-1][1];};
/* Template filler.
   "[a|b|c]"  -> one alternative, chosen by rnd()
   "[=a|b|c]" -> linked alternatives: every [=...] group in the same text uses the same position (first with first, ...)
   "{slot}"   -> ctx.slot ; dotted paths allowed: {lab.cr}
   Unknown slots become '' and are recorded in H.fill.missing (the module validator and tests read it). */
H.fill=function(tpl,ctx,rnd){if(tpl==null)return '';if(Array.isArray(tpl))tpl=tpl[Math.floor((rnd?rnd():0)*tpl.length)];
  var link=null;
  var s=String(tpl).replace(/\[(=?)([^\[\]]*\|[^\[\]]*)\]/g,function(_,eq,alts){var a=alts.split('|'),u=rnd?rnd():0;if(eq){if(link==null)link=u;u=link;}return a[Math.floor(u*a.length)];});
  return s.replace(/\{([A-Za-z0-9_.]+)\}/g,function(_,k){var v=ctx,parts=k.split('.');for(var i=0;i<parts.length&&v!=null;i++)v=v[parts[i]];
    if(typeof v==='function')v=v();if(v==null){H.fill.missing[k]=(H.fill.missing[k]||0)+1;return '';}return v;});};
H.fill.missing={};
/* choose the entry of a phase bank {phaseKey:text} for the current phase, falling back to earlier phases */
H.byPhase=function(bank,phases,idx){if(bank==null)return null;if(typeof bank==='string'||Array.isArray(bank))return bank;
  for(var i=idx;i>=0;i--){var v=bank[phases[i][0]];if(v!=null)return v;}for(var k in bank)return bank[k];return null;};

if(typeof module!=='undefined'&&module.exports)module.exports=H;
})(typeof globalThis!=='undefined'?globalThis:this);
