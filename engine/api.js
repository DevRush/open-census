/* engine/api.js — the public API. See docs/ENGINE_API.md. Loads last. */
(function(H){
'use strict';
var M=H.model,charts={};
function reset(){charts={};H._resetCensus();H._resetOutpatient();H._staffMemoClear();H._resetCand();}
/* HOSP.init({seed, now, handwritten}) — optional; the engine works without it using the defaults.
   handwritten: array of patient objects (data.js seed() plus EXTRA). In a browser page that has loaded data.js and
   patients/*.js this is picked up automatically. */
H.init=function(o){o=o||{};H.cfg.seed=o.seed!=null?o.seed:H.DEFAULT_SEED;H.cfg.now=o.now?H.parseDate(o.now):new Date(H.BASE_NOW.getTime());H.cfg.truthInKey=!!o.truthInKey;reset();
  var hw=o.handwritten;if(!hw&&o.handwritten!==false&&typeof seed==='function'&&typeof EXTRA!=='undefined'){try{hw=seed().concat(EXTRA.map(function(f){return f();}));}catch(e){hw=[];}}
  H.registerHandwritten(hw||[]);return H;};
H.setNow=function(d){H.cfg.now=H.parseDate(d);charts={};H._resetOutpatientSchedules&&H._resetOutpatientSchedules();return H.cfg.now;};
H.now=function(){return H.cfg.now;};
H.hospital=function(){var beds=0,ed=0;M.units.forEach(function(u){if(u.acuity==='ed')ed+=u.beds;else beds+=u.beds;});
  return {name:M.name,seed:H.cfg.seed,now:H.cfg.now,inpatientBeds:beds,emergencyBays:ed,units:M.units.length,clinics:M.clinics.length,services:M.services.length,buildings:M.buildings.slice(),
    modules:{conditions:Object.keys(H.conditions).length,comorbidities:Object.keys(H.comorbidities).length,clinics:Object.keys(H.clinicModules).length,complications:Object.keys(H.complications).length}};};
H.buildings=function(){return M.buildings.map(function(b){return {key:b.key,name:b.name,floors:b.floors,units:M.units.filter(function(u){return u.building===b.key;}).map(function(u){return u.key;}),clinics:M.clinics.filter(function(c){return c.building===b.key;}).map(function(c){return c.key;})};});};
/* HOSP.units({counts:true}) */
H.units=function(o){return M.units.map(function(u){var b=M.buildings.filter(function(x){return x.key===u.building;})[0],r={key:u.key,name:u.name,prefix:u.prefix,beds:u.beds,building:b.name,buildingKey:u.building,floor:u.floor,acuity:u.acuity,population:u.pop,kinds:u.kinds.slice(),
    services:u.services.map(function(s){return {key:s[0],name:M.serviceByKey[s[0]].name};})};
  if(o&&o.counts){var c=H.census(u.key),n=0;c.forEach(function(x){if(x.status==='occupied')n++;});r.occupied=n;}return r;});};
H.services=function(){return M.services.map(function(s){return {key:s.key,name:s.name,group:s.group,primary:s.primary,consult:s.consult,allied:s.allied,teams:H.serviceTeams(s.key).map(function(t){return {name:t.name,attending:t.attending&&t.attending.name,fellow:t.fellow?t.fellow.name:null,
  senior:t.senior?t.senior.name+' ('+t.senior.grade+')':null,residents:(t.interns||[]).map(function(x){return x.name+' ('+x.grade+')';}),students:(t.students||[]).map(function(x){return x.name+' ('+x.grade+')';}),app:t.app?t.app.name:null};})};});};
H.consultServices=function(){return M.services.filter(function(s){return s.consult;}).map(function(s){return {key:s.key,name:s.name,group:s.group,allied:s.allied};});};
H.operatingRooms=function(){return M.ors.map(function(o){return {key:o.key,name:o.name,building:M.buildings.filter(function(b){return b.key===o.building;})[0].name,floor:o.floor,rooms:o.rooms.slice(),services:o.services.map(function(k){return M.serviceByKey[k]?M.serviceByKey[k].name:k;})};});};
/* HOSP.patient(id) — full inpatient chart (SCHEMA.md shape). Built on first request, then cached until the clock changes. */
H.patient=function(id){if(H.hand.byId[id])return H.hand.byId[id];var c=charts[id];if(c)return c;var P=H.plan(id);if(!P||P.admit>H.cfg.now)return null;return charts[id]=H.buildChart(P,H.cfg.now);};
/* whole-hospital census in one call: {unitKey:[rows]} */
H.censusAll=function(){var o={};M.units.forEach(function(u){o[u.key]=H.census(u.key);});return o;};
/* the app's own post-processing (ids on medicines, orders as objects), for callers that want charts ready for the existing page */
H.prepare=function(p){if(p._prepared)return p;p.meds.forEach(function(m,i){m.id=p.id+'m'+i;m.a=m.a||[];});var mo=p.meds.map(function(m){return ['Medication',m.name+' · '+m.sig,'Active',m.ordered];});
  p.orders=mo.concat(p.orders).map(function(o,i){return Array.isArray(o)?{id:p.id+'o'+i,cat:o[0],text:o[1],st:o[2],t:o[3],by:'Care team'}:o;});p.notes.forEach(function(n,i){n.id=p.id+'n'+i;});p.pending=p.pending||[];p._prepared=true;return p;};
})(HOSP);
