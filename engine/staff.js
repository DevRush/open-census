/* engine/staff.js — staff roster and "who is on today". Deterministic from the seed and the date.
   Attendings and fellows are fixed pools per service; on-service attendings rotate weekly; residents and students
   rotate in 4-week blocks; nurses are drawn from a per-unit pool for each shift. */
(function(H){
'use strict';
var M=H.model;
function nm(key,sex){var r=H.R('name|'+key),N=M.names;sex=sex||(H.hash(key+'sx')%2?'F':'M');var g=r.pick(N[sex]),s=r.pick(N.S);if(r.chance(.33)){var s2=r.pick(N.S);if(s2!==s)s+='-'+s2;}return {given:g,sur:s,sex:sex};}
H.personName=nm;
H.staffName=function(key,style){var n=nm(key);
  if(style==='dr')return 'Dr. '+n.given+' '+n.sur;
  if(style==='rn')return n.given.charAt(0)+'. '+n.sur+' RN';
  if(style==='pharm')return n.given.charAt(0)+'. '+n.sur+' PharmD';
  if(style==='full')return n.given+' '+n.sur;
  return n.given.charAt(0)+'. '+n.sur;};
var memo={};
function pool(svc){var k='pool|'+svc.key;if(memo[k])return memo[k];var a=[],f=[],i;
  for(i=0;i<svc.attendings;i++)a.push({id:'s.'+svc.key+'.att.'+i,name:H.staffName(svc.key+'att'+i,'dr'),role:'Attending',service:svc.key});
  for(i=0;i<svc.fellows;i++)f.push({id:'s.'+svc.key+'.fel.'+i,name:H.staffName(svc.key+'fel'+i,'dr'),role:'Fellow',grade:'PGY-'+(4+i%3),service:svc.key});
  return memo[k]={att:a,fel:f};}
/* Teams of a service on a date. Returns [{key,name,attending,fellow,senior,interns[],students[],app}] */
H.serviceTeams=function(svcKey,date){var svc=M.serviceByKey[svcKey];if(!svc)return [];date=date||H.cfg.now;
  var w=H.weekIndex(date),b=Math.floor(w/4),k='teams|'+svcKey+'|'+w;if(memo[k])return memo[k];
  var P=pool(svc),n=Math.max(1,svc.teams),out=[],surg=/Surgery|Orthopaedic|Neurosurgery|Urology|Otolaryngology|Plastic|Obstetrics/.test(svc.programme);
  for(var t=0;t<n;t++){var T={key:svcKey+'.'+(t+1),service:svcKey,name:svc.name+(n>1?' Team '+String.fromCharCode(65+t):svc.teams?' Team':' Consult Team')};
    if(P.att.length)T.attending=P.att[(w*5+t*Math.max(1,Math.floor(P.att.length/n)))%P.att.length];
    else T.attending={id:'s.'+svcKey+'.lead.'+t,name:H.staffName(svcKey+'lead'+t,'full'),role:'Lead clinician',service:svcKey};
    if(P.fel.length)T.fellow=P.fel[(w+t)%P.fel.length];
    if(!svc.allied&&svc.programme){var rk=svcKey+'|b'+b+'|t'+t;
      T.senior={id:'s.'+svcKey+'.sr.'+b+'.'+t,name:H.staffName(rk+'sr','dr'),role:'Senior resident',grade:'PGY-'+(surg?3+H.hash(rk)%3:2+H.hash(rk)%2),service:svcKey};
      T.interns=[0,1].slice(0,svc.teams?2:1).map(function(i){return {id:'s.'+svcKey+'.int.'+b+'.'+t+'.'+i,name:H.staffName(rk+'int'+i,'dr'),role:'Resident',grade:'PGY-1',service:svcKey};});
      T.students=[0,1].slice(0,svc.teams?1+H.hash(rk+'st')%2:H.hash(rk+'st')%2).map(function(i){return {id:'s.'+svcKey+'.ms.'+b+'.'+t+'.'+i,name:H.staffName(rk+'ms'+i,'full'),role:'Medical student',grade:'MS'+(3+H.hash(rk+'y'+i)%2),service:svcKey};});
      if(svc.teams&&H.hash(rk+'app')%3===0)T.app={id:'s.'+svcKey+'.app.'+t,name:H.staffName(svcKey+'app'+t,'full')+(H.hash(rk)%2?' NP':' PA'),role:'Advanced practice provider',service:svcKey};
    }else{T.interns=[];T.students=[];}
    out.push(T);}
  return memo[k]=out;};
var RATIO={icu:2,step:3,ward:5,ed:4};
/* Staff of a unit on a date: nurses by shift, charge nurses, pharmacist, therapists, case manager ... */
H.unitStaff=function(unitKey,date){var u=M.unitByKey[unitKey];if(!u)return null;date=date||H.cfg.now;var dk=H.isoDate(date),k='unit|'+unitKey+'|'+dk;if(memo[k])return memo[k];
  var ratio=u.pop==='psych'?6:u.pop==='neonate'?3:RATIO[u.acuity]||5,per=Math.ceil(u.beds/ratio),poolN=Math.ceil(per*2.6)+2,S={unit:unitKey,ratio:ratio,nurses:{day:[],night:[]}};
  function rn(i){return {id:'s.'+unitKey+'.rn.'+i,name:H.staffName(unitKey+'rn'+i,'rn'),role:'Nurse',unit:unitKey};}
  ['day','night'].forEach(function(sh,si){var off=H.hash(unitKey+dk+sh)%poolN;for(var i=0;i<per;i++)S.nurses[sh].push(rn((off+i+si*per)%poolN));
    S['charge'+H.cap(sh)]={id:'s.'+unitKey+'.rn.'+((off+per+si*per)%poolN),name:H.staffName(unitKey+'rn'+((off+per+si*per)%poolN),'rn'),role:'Charge nurse',unit:unitKey};});
  function one(role,tag,style,suffix){return {id:'s.'+unitKey+'.'+tag,name:H.staffName(unitKey+tag,style||'x')+(suffix||''),role:role,unit:unitKey};}
  S.manager=one('Nurse manager','mgr','full',' RN');S.pharmacist=one('Pharmacist','ph','pharm');S.caseManager=one('Case manager','cm');S.socialWorker=one('Social worker','sw');
  S.pt=one('Physical therapist','pt','x',' PT');S.ot=one('Occupational therapist','ot','x',' OT');S.dietitian=one('Dietitian','rd','x',' RD');S.clerk=one('Unit clerk','uc','full');
  S.rt=one('Respiratory therapist','rt','x',' RRT');S.slp=one('Speech therapist','slp','x',' SLP');S.wound=one('Wound and ostomy nurse','wound','x',' RN');
  if(u.pop==='ob'||u.pop==='neonate')S.lactation=one('Lactation consultant','lact','x',' RN');if(u.pop==='peds'||u.pop==='neonate')S.childLife=one('Child life specialist','cl','x');
  S.poolSize=poolN;return memo[k]=S;};
H.nurseFor=function(unitKey,bedIdx,date,shift){var S=H.unitStaff(unitKey,date),a=S.nurses[shift||'day'];return a[Math.floor(bedIdx/S.ratio)%a.length];};
/* Full roster for a date. filter: {service, unit, role} (all optional). */
H.staff=function(filter){filter=filter||{};var date=filter.date?H.parseDate(filter.date):H.cfg.now,out=[],seen={};
  function add(p,extra){if(!p||seen[p.id])return;seen[p.id]=1;var o={};for(var k in p)o[k]=p[k];if(extra)for(var e in extra)o[e]=extra[e];out.push(o);}
  M.services.forEach(function(svc){if(filter.unit||(filter.service&&filter.service!==svc.key))return;var P=pool(svc);
    var teams=H.serviceTeams(svc.key,date),on={};teams.forEach(function(t){if(t.attending)on[t.attending.id]=t.name;if(t.fellow)on[t.fellow.id]=t.name;});
    P.att.forEach(function(a){add(a,{team:on[a.id]||null,onService:!!on[a.id]});});P.fel.forEach(function(a){add(a,{team:on[a.id]||null,onService:!!on[a.id]});});
    teams.forEach(function(t){if(!P.att.length)add(t.attending,{team:t.name,onService:true});[t.senior,t.app].concat(t.interns,t.students).forEach(function(x){add(x,{team:t.name,onService:true});});});});
  M.units.forEach(function(u){if(filter.service||(filter.unit&&filter.unit!==u.key))return;var S=H.unitStaff(u.key,date);
    S.nurses.day.forEach(function(n){add(n,{shift:'day'});});S.nurses.night.forEach(function(n){add(n,{shift:'night'});});
    add(S.chargeDay,{shift:'day'});add(S.chargeNight,{shift:'night'});['manager','pharmacist','caseManager','socialWorker','pt','ot','slp','dietitian','rt','wound','lactation','childLife','clerk'].forEach(function(k){add(S[k]);});});
  if(filter.role)out=out.filter(function(s){return s.role===filter.role;});return out;};
H._staffMemoClear=function(){memo={};};
})(HOSP);
