/* Open Census practice chart: pictures drawn by the simulator from report text.
   SIMIMG.kind(title) -> 'ecg' | 'cxr' | null
   SIMIMG.ecg(canvas, reportText, fallbackRate, seed)   12-lead ECG on pink paper, 25 mm/s, 10 mm/mV
   SIMIMG.cxr(canvas, reportText, seed)                 frontal chest radiograph, patient's right on image left
   These are illustrations of what the report says. They are not recordings or radiographs. */
var SIMIMG=(function(){
"use strict";
function rnd(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;var t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function sents(t){return String(t||'').replace(/(\d)\.(\d)/g,'$1·$2').split(/[.\n;]+/).map(function(s){return s.trim();}).filter(Boolean);}
/* sentences that mention re and are not negated before the mention */
function hits(t,re){return sents(t).filter(function(s){var m=re.exec(s);if(!m)return false;var pre=s.slice(0,m.index),n=/\b(no|not|without|negative for|absence of|resolved|free of|rule out|pneumonia or|look for|question)\b/i.exec(pre);
  if(!n)return !/\?\s*$/.test(s);return /\b(but|however|with a|remains)\b/i.test(pre.slice(n.index));});}
function has(t,re){return hits(t,re).length>0;}
function kind(title){title=String(title||'');if(/\becg\b|electrocardiogram/i.test(title))return 'ecg';if(/chest x-?ray|chest radiograph/i.test(title))return 'cxr';return null;}

/* ---------------- ECG ---------------- */
var ORDER=[['I','aVR','V1','V4'],['II','aVL','V2','V5'],['III','aVF','V3','V6']];
var BASE={I:[.08,-.03,.6,-.1,.18],II:[.13,-.04,1,-.12,.28],III:[.06,-.03,.45,-.1,.1],aVR:[-.1,0,.08,-.8,-.22],aVL:[.04,-.04,.3,-.12,.08],aVF:[.1,-.03,.7,-.1,.2],V1:[.05,0,.2,-1,.05],V2:[.06,0,.35,-1.5,.35],V3:[.07,0,.8,-1,.4],V4:[.08,-.05,1.5,-.45,.4],V5:[.08,-.06,1.3,-.2,.32],V6:[.08,-.06,1,-.1,.25]};
function leadsIn(s){var o=[],m;s=String(s);
  if(/inferior/i.test(s))o.push('II','III','aVF');if(/anterior|anteroseptal/i.test(s))o.push('V1','V2','V3','V4');if(/lateral/i.test(s))o.push('I','aVL','V5','V6');if(/septal/i.test(s))o.push('V1','V2');
  var re=/V([1-6])\s*(?:to|through|–|-)\s*V?([1-6])/gi;while((m=re.exec(s))){for(var i=+m[1];i<=+m[2];i++)o.push('V'+i);}
  re=/\b(aVR|aVL|aVF|V[1-6]|III|II|I)\b/g;while((m=re.exec(s)))o.push(m[1]);
  return o.filter(function(v,i){return o.indexOf(v)===i;});}
function ecgSpec(text,hr){
  var m=/\brate\s*(?:of|is|about|:)?\s*(\d{2,3})\b/i.exec(text)||/\b(\d{2,3})\s*(?:\/min|bpm|beats per minute)/i.exec(text);
  var s={rate:m?+m[1]:(hr||75),af:has(text,/atrial fibrillation/i),lbbb:has(text,/left bundle[- ]branch block/i),rbbb:has(text,/right bundle[- ]branch block/i),lvh:has(text,/left ventricular (hypertrophy|thickening)/i),ste:[],std:[],tall:[],twi:[]};
  if(s.af&&/sinus rhythm/i.test(text)&&!/atrial fibrillation/i.test(sents(text)[0]||''))s.af=has(sents(text)[0],/atrial fibrillation/i)||!/^sinus/i.test(text.trim());
  hits(text,/ST[- ](?:segment )?(?:elevation|depression)/i).forEach(function(x){var re=/ST[- ](?:segment )?(elevation|depression)/gi,m2,marks=[];while((m2=re.exec(x)))marks.push([m2.index,m2[1].toLowerCase()]);
    marks.forEach(function(mk,i){var seg=x.slice(mk[0],i+1<marks.length?marks[i+1][0]:x.length),l=leadsIn(seg);if(mk[1]==='elevation')s.ste=s.ste.concat(l);else s.std=s.std.concat(l);});});
  hits(text,/T waves? (?:are )?tall|tall,? (?:narrow |peaked )?T|peaked T/i).forEach(function(x){s.tall=s.tall.concat(leadsIn(x));});
  hits(text,/T[- ]wave inversion|inverted T/i).forEach(function(x){s.twi=s.twi.concat(leadsIn(x));});
  var q=/QRS(?: duration)?\s*(?:of\s*)?(\d{2,3})\s*ms/i.exec(text);s.qrs=q?+q[1]:(s.lbbb||s.rbbb?148:92);
  return s;}
function ecg(cv,text,hr,seed){
  var sp=ecgSpec(text,hr),r=rnd((seed||7)+sp.rate*13),x=cv.getContext('2d'),MM=4,X0=36,LEN=1000,W=cv.width=X0+LEN+14,H=cv.height=560,rows=[120,240,360,476];
  x.fillStyle='#fff6f4';x.fillRect(0,0,W,H);
  x.lineWidth=1;x.strokeStyle='#f6cfcf';x.beginPath();for(var g=0;g<=W;g+=MM){x.moveTo(g+.5,0);x.lineTo(g+.5,H);}for(g=0;g<=H;g+=MM){x.moveTo(0,g+.5);x.lineTo(W,g+.5);}x.stroke();
  x.strokeStyle='#eaa3a3';x.beginPath();for(g=0;g<=W;g+=MM*5){x.moveTo(g+.5,0);x.lineTo(g+.5,H);}for(g=0;g<=H;g+=MM*5){x.moveTo(0,g+.5);x.lineTo(W,g+.5);}x.stroke();
  var rr=60/sp.rate,beats=[],t=-0.2+r()*0.3;while(t<10.6){beats.push(t);t+=rr*(sp.af?0.62+r()*0.8:0.985+r()*0.03);}
  var w=sp.qrs/92,sq=Math.sqrt(Math.min(1.2,Math.max(.35,rr))),fw=[r()*6,r()*6,r()*6];
  function ga(u,mu,sg,a){var d=(u-mu)/sg;return d*d>30?0:a*Math.exp(-d*d/2);}
  function amp(L){var b=BASE[L].slice(),o={p:b[0],q:b[1],r:b[2],s:b[3],t:b[4],st:0,notch:0,r2:0,ts:1};
    if(sp.lvh){if(L==='V5'||L==='V6')o.r*=1.6;if(L==='V1'||L==='V2')o.s*=1.45;if(L==='aVL'||L==='I')o.r*=1.7;}
    if(sp.lbbb){if(/^(I|aVL|V5|V6)$/.test(L)){o.q=0;o.s=0;o.notch=1;o.r*=.85;o.t=-.22;o.st=-.07;}else if(/^V[1-3]$/.test(L)){o.r=.05;o.s*=1.15;o.st=.16;o.t=.42;}else if(L==='II'){o.r=.6;o.s=-.2;o.t=.1;}else if(L==='III'||L==='aVF'){o.r=.2;o.s=-.5;o.t=.15;}}
    if(sp.rbbb){if(L==='V1'||L==='V2'){o.r=.25;o.s=-.3;o.r2=.75;o.t=-.2;}if(/^(I|aVL|V5|V6)$/.test(L))o.s=-.35;}
    if(sp.ste.indexOf(L)>=0){o.st+=.25;o.t=Math.abs(o.t)+.15;}
    if(sp.std.indexOf(L)>=0){o.st-=.15;}
    if(sp.twi.indexOf(L)>=0){o.t=-Math.abs(o.t)-.08;}
    if(sp.tall.indexOf(L)>=0){o.t=Math.abs(o.t)*2.3;o.ts=.62;}
    return o;}
  var A={};Object.keys(BASE).forEach(function(L){A[L]=amp(L);});
  function val(L,u){var a=A[L],y=0,i;for(i=0;i<beats.length;i++){var d=u-beats[i];if(d<-0.35||d>0.75)continue;
      if(!sp.af)y+=ga(d,-0.16,0.024,a.p);
      y+=ga(d,-0.024*w,0.008*w,a.q)+ga(d,0,0.011*w,a.r)+ga(d,0.03*w,0.012*w,a.s);
      if(a.notch)y+=ga(d,0.045*w,0.014*w,a.r*.85);
      if(a.r2)y+=ga(d,0.07,0.016,a.r2);
      var tc=0.02*w+0.3*sq;
      if(a.st)y+=a.st/(1+Math.exp(-(d-0.05*w)/0.008))/(1+Math.exp((d-tc)/0.03));
      y+=ga(d,tc,0.055*sq*a.ts,a.t);}
    if(sp.af){var k=(L==='V1'||L==='II')?1:.55;y+=k*(.035*Math.sin(u*38+fw[0])+.03*Math.sin(u*53+fw[1])+.02*Math.sin(u*71+fw[2]));}
    return y+.012*Math.sin(u*1.7+fw[0]);}
  x.strokeStyle='#1c1c1c';x.lineWidth=1.35;x.lineJoin='round';x.lineCap='round';x.fillStyle='#1c1c1c';x.font='600 13px ui-monospace,Menlo,Consolas,monospace';
  rows.forEach(function(y0,ri){
    x.beginPath();x.moveTo(6,y0);x.lineTo(11,y0);x.lineTo(11,y0-40);x.lineTo(27,y0-40);x.lineTo(27,y0);x.lineTo(X0,y0);x.stroke();
    x.beginPath();
    for(var px=0;px<=LEN;px+=.5){var u=px/100,col=Math.min(3,Math.floor(px/250)),L=ri<3?ORDER[ri][col]:'II',y=y0-val(L,u)*40;
      if(ri<3&&px%250===0&&px>0&&px<LEN){x.stroke();x.beginPath();x.moveTo(X0+px,y0-14);x.lineTo(X0+px,y0+14);x.stroke();x.beginPath();x.moveTo(X0+px,y);}
      if(px===0)x.moveTo(X0+px,y);else x.lineTo(X0+px,y);}
    x.stroke();
    if(ri<3)ORDER[ri].forEach(function(L,c){x.fillText(L,X0+c*250+6,y0-44);});else x.fillText('II (rhythm strip)',X0+6,y0-44);});
  x.font='12px ui-monospace,Menlo,Consolas,monospace';x.fillText('25 mm/s    10 mm/mV    '+(sp.af?'ventricular rate ':'rate ')+sp.rate+'/min    QRS '+sp.qrs+' ms',X0,H-14);
  x.textAlign='right';x.fillText('SIMULATED · drawn from the report text',W-10,20);x.textAlign='left';
  return sp;}

/* ---------------- chest radiograph ---------------- */
function side(s){var o=[];if(/bilateral|both|each side/i.test(s))return ['R','L'];if(/\bright\b/i.test(s))o.push('R');if(/\bleft\b/i.test(s))o.push('L');return o;}
function zone(s){var o=[];if(/upper|apex|apical/i.test(s))o.push('u');if(/middle lobe|mid[- ]?zone|perihilar|lingula/i.test(s))o.push('m');if(/lower|base|basal|basilar/i.test(s))o.push('l');return o;}
function cxrSpec(text){
  var s={cons:[],eff:[],ptx:[],drain:[],fx:[],lines:{}};
  hits(text,/consolidation|pneumonia|opacit|infiltrate|contusion|bruised lung|band of collapse|atelectasis/i).forEach(function(x){if(/consistent with asthma/i.test(x)&&!/collapse/i.test(x))return;var sd=side(x),z=zone(x);if(!sd.length)return;if(!z.length)z=['l'];
    var size=/dense|lobar|large|extensive|air bronchogram/i.test(x)?1:(/faint|thin|small|subtle|band|mild|hazy/i.test(x)?.45:.75);
    sd.forEach(function(a){z.forEach(function(b){if(!s.cons.some(function(c){return c.s===a&&c.z===b;}))s.cons.push({s:a,z:b,k:size});});});});
  hits(text,/effusion|pleural fluid|fluid at the|haemothorax|hemothorax/i).forEach(function(x){var sd=side(x);if(!sd.length)return;var k=/large|massive/i.test(x)?1:(/moderate/i.test(x)?.7:.4);sd.forEach(function(a){if(!s.eff.some(function(c){return c.s===a;}))s.eff.push({s:a,k:k});});});
  hits(text,/pneumothorax|rim of air/i).forEach(function(x){var sd=side(x),m=/(\d+)\s*mm/.exec(x);if(/re-expanded/i.test(x)&&!/rim of air|remains/i.test(x))return;(sd.length?sd:[]).forEach(function(a){if(!s.ptx.some(function(c){return c.s===a;}))s.ptx.push({s:a,k:m?Math.min(1,Math.max(.25,+m[1]/30)):(/large|tension/i.test(x)?1:.5)});});});
  hits(text,/chest drain|chest tube|intercostal drain/i).forEach(function(x){var sd=side(x);if(sd[0]&&s.drain.indexOf(sd[0])<0)s.drain.push(sd[0]);});
  hits(text,/fractures? of[^,]*ribs?|rib fractures?/i).forEach(function(x){var sd=side(x);if(sd[0]&&s.fx.indexOf(sd[0])<0)s.fx.push(sd[0]);});
  s.congest=has(text,/oedema|edema|congestion|upper-lobe vessel|vascular redistribution|interstitial lines/i);
  s.big=has(text,/enlarged heart|cardiomegaly|heart (is |size )?(is )?enlarged/i);
  s.hyper=has(text,/hyperinflat|over-inflat/i);
  var cl=hits(text,/(internal jugular|subclavian|central venous|tunnelled)[^,]*(catheter|line)|central line/i)[0];if(cl)s.lines.cvc=/\bleft\b/i.test(cl)?'L':'R';
  s.lines.ett=has(text,/endotracheal tube/i);s.lines.ng=has(text,/nasogastric|feeding tube/i);s.lines.pm=has(text,/pacemaker|pacing (lead|wire)/i);s.lines.leads=has(text,/monitoring leads/i);s.lines.wires=has(text,/sternotomy|sternal wires/i);
  return s;}
function cxr(cv,text,seed){
  var sp=cxrSpec(text),r=rnd(seed||5),x=cv.getContext('2d'),W=cv.width=560,H=cv.height=620,dy=sp.hyper?26:0,hs=sp.big?1.36:1;
  function mx(px,s){return s==='L'?W-px:px;}                 /* s is the patient's side; patient's right is on image left */
  x.fillStyle='#040404';x.fillRect(0,0,W,H);
  /* soft tissue of neck, shoulders and trunk */
  var gb=x.createLinearGradient(0,0,W,0);gb.addColorStop(0,'#1b1b1b');gb.addColorStop(.12,'#353535');gb.addColorStop(.5,'#434343');gb.addColorStop(.88,'#353535');gb.addColorStop(1,'#1b1b1b');
  x.fillStyle=gb;x.beginPath();x.moveTo(228,0);x.bezierCurveTo(226,52,180,66,24,104);x.lineTo(0,150);x.lineTo(0,H);x.lineTo(W,H);x.lineTo(W,150);x.lineTo(536,104);x.bezierCurveTo(380,66,334,52,332,0);x.closePath();x.fill();
  function lung(s){x.beginPath();x.moveTo(mx(232,s),92);x.bezierCurveTo(mx(170,s),84,mx(96,s),190,mx(86,s),330);x.bezierCurveTo(mx(80,s),400,mx(84,s),440,mx(92,s),486+dy);
    x.bezierCurveTo(mx(140,s),440+dy,mx(210,s),432+dy,mx(256,s),462+dy);x.bezierCurveTo(mx(262,s),380,mx(262,s),200,mx(250,s),118);x.bezierCurveTo(mx(248,s),100,mx(242,s),94,mx(232,s),92);x.closePath();}
  ['R','L'].forEach(function(s){lung(s);var c=mx(165,s),gl=x.createRadialGradient(c,290,20,c,290,230);gl.addColorStop(0,'#060606');gl.addColorStop(.75,'#121212');gl.addColorStop(1,'#232323');x.fillStyle=gl;x.fill();});
  /* lung markings */
  ['R','L'].forEach(function(s){x.save();lung(s);x.clip();x.strokeStyle='rgba(215,215,215,'+(sp.congest?.2:.11)+')';
    for(var i=0;i<26;i++){var a=(-1.15+2.3*i/25)+(r()-.5)*.15,len=70+r()*95,hx=mx(246,s),hy=285+(r()-.5)*30,dir=s==='L'?1:-1;x.lineWidth=2.6;x.beginPath();x.moveTo(hx,hy);
      var ex=hx+dir*Math.cos(a)*len,ey=hy+Math.sin(a)*len*1.25;x.quadraticCurveTo(hx+dir*Math.cos(a)*len*.5,hy+Math.sin(a)*len*.45,ex,ey);x.stroke();
      x.lineWidth=1.2;x.beginPath();x.moveTo(ex,ey);x.lineTo(ex+dir*Math.cos(a+.5)*34,ey+Math.sin(a+.5)*34);x.moveTo(ex,ey);x.lineTo(ex+dir*Math.cos(a-.45)*30,ey+Math.sin(a-.45)*30);x.stroke();}
    var gh=x.createRadialGradient(mx(240,s),285,4,mx(240,s),285,62);gh.addColorStop(0,'rgba(215,215,215,.42)');gh.addColorStop(1,'rgba(215,215,215,0)');x.fillStyle=gh;x.fillRect(0,0,W,H);
    if(sp.congest){var gc=x.createRadialGradient(mx(226,s),300,10,mx(226,s),300,150);gc.addColorStop(0,'rgba(225,225,225,.42)');gc.addColorStop(1,'rgba(225,225,225,0)');x.fillStyle=gc;x.fillRect(0,0,W,H);
      x.strokeStyle='rgba(235,235,235,.5)';x.lineWidth=1;for(var k=0;k<7;k++){var ky=388+k*10;x.beginPath();x.moveTo(mx(92,s),ky);x.lineTo(mx(112,s),ky+1);x.stroke();}}
    x.restore();});
  /* ribs: posterior (brighter, slope down and out) then anterior (fainter, slope down and in) */
  x.lineCap='round';
  for(var i=0;i<10;i++){var ry=84+i*40;['R','L'].forEach(function(s){
    x.strokeStyle='rgba(225,225,225,.12)';x.lineWidth=8;x.beginPath();x.moveTo(mx(262,s),ry);x.quadraticCurveTo(mx(150,s),ry-22,mx(72,s),ry+52);x.stroke();
    if(i<7){x.strokeStyle='rgba(225,225,225,.05)';x.lineWidth=11;x.beginPath();x.moveTo(mx(74,s),ry+70);x.quadraticCurveTo(mx(130,s),ry+128,mx(214,s),ry+150);x.stroke();}});}
  sp.fx.forEach(function(s){x.strokeStyle='rgba(0,0,0,.8)';x.lineWidth=2.5;[4,5,6].forEach(function(n){var ry=84+n*40;x.beginPath();x.moveTo(mx(96,s),ry+12);x.lineTo(mx(102,s),ry+30);x.stroke();});});
  /* clavicles and shoulder blades */
  ['R','L'].forEach(function(s){x.strokeStyle='rgba(230,230,230,.34)';x.lineWidth=12;x.beginPath();x.moveTo(mx(262,s),116);x.quadraticCurveTo(mx(180,s),100,mx(70,s),92);x.stroke();
    x.strokeStyle='rgba(225,225,225,.1)';x.lineWidth=5;x.beginPath();x.moveTo(mx(108,s),120);x.quadraticCurveTo(mx(70,s),250,mx(118,s),345);x.stroke();});
  /* spine and mediastinum */
  var gm=x.createLinearGradient(236,0,324,0);gm.addColorStop(0,'rgba(200,200,200,0)');gm.addColorStop(.3,'rgba(205,205,205,.5)');gm.addColorStop(.7,'rgba(205,205,205,.5)');gm.addColorStop(1,'rgba(200,200,200,0)');x.fillStyle=gm;x.fillRect(236,0,88,H);
  x.strokeStyle='rgba(0,0,0,.2)';x.lineWidth=2;for(i=0;i<16;i++){x.beginPath();x.moveTo(262,40+i*37);x.lineTo(298,40+i*37);x.stroke();}
  x.fillStyle='rgba(0,0,0,.42)';x.beginPath();x.moveTo(271,0);x.lineTo(289,0);x.lineTo(288,196);x.lineTo(304,226);x.lineTo(298,232);x.lineTo(280,206);x.lineTo(262,232);x.lineTo(256,226);x.lineTo(272,196);x.closePath();x.fill();
  /* heart, aortic knuckle, right heart border */
  var hx=306,hy=380+dy*.6,gh2=x.createRadialGradient(hx,hy+10,10,hx,hy+10,112*hs);gh2.addColorStop(0,'rgba(220,220,220,.62)');gh2.addColorStop(.8,'rgba(206,206,206,.5)');gh2.addColorStop(1,'rgba(200,200,200,0)');
  x.fillStyle=gh2;x.beginPath();x.moveTo(250-(hs-1)*40,hy-70);x.bezierCurveTo(232-(hs-1)*60,hy-10,236-(hs-1)*60,hy+60,262,hy+88);x.lineTo(hx+54*hs,hy+92);x.bezierCurveTo(hx+96*hs,hy+70,hx+90*hs,hy-30,hx+42*hs,hy-92);x.bezierCurveTo(hx+36,hy-120,270,hy-120,250-(hs-1)*40,hy-70);x.closePath();x.fill();
  var gk=x.createRadialGradient(314,178,4,314,178,34);gk.addColorStop(0,'rgba(215,215,215,.42)');gk.addColorStop(1,'rgba(215,215,215,0)');x.fillStyle=gk;x.fillRect(270,140,90,80);
  /* diaphragm and upper abdomen */
  x.fillStyle='rgba(200,200,200,.74)';x.beginPath();x.moveTo(40,H);x.lineTo(60,500+dy);x.bezierCurveTo(100,438+dy,220,424+dy,270,470+dy);x.bezierCurveTo(330,440+dy,450,446+dy,500,506+dy);x.lineTo(520,H);x.closePath();x.fill();
  var gs=x.createRadialGradient(402,508+dy,3,402,508+dy,40);gs.addColorStop(0,'rgba(0,0,0,.45)');gs.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=gs;x.fillRect(350,480+dy,110,56);
  /* findings inside the lungs */
  var ZY={u:170,m:285,l:392+dy};
  sp.cons.forEach(function(c){x.save();lung(c.s);x.clip();var cx=mx(c.z==='m'?176:160,c.s),cy=ZY[c.z],rad=50+70*c.k,g2=x.createRadialGradient(cx,cy,6,cx,cy,rad);g2.addColorStop(0,'rgba(236,236,236,'+(.25+.4*c.k)+')');g2.addColorStop(.6,'rgba(232,232,232,'+(.16+.3*c.k)+')');g2.addColorStop(1,'rgba(232,232,232,0)');x.fillStyle=g2;x.fillRect(0,0,W,H);
    for(var q=0;q<5;q++){var qx=cx+(r()-.5)*rad,qy=cy+(r()-.5)*rad*.8,g3=x.createRadialGradient(qx,qy,2,qx,qy,rad*.45);g3.addColorStop(0,'rgba(240,240,240,'+(.12+.2*c.k)+')');g3.addColorStop(1,'rgba(240,240,240,0)');x.fillStyle=g3;x.fillRect(0,0,W,H);}
    if(c.k>=1){x.strokeStyle='rgba(0,0,0,.35)';x.lineWidth=2;for(q=0;q<4;q++){x.beginPath();x.moveTo(cx+(r()-.5)*40,cy-30+(r()*20));x.lineTo(cx+(r()-.5)*90,cy+10+r()*40);x.stroke();}}
    x.restore();});
  sp.eff.forEach(function(e){x.save();lung(e.s);x.clip();var top=486+dy-60-150*e.k;x.fillStyle='rgba(214,214,214,.17)';
    for(var q=0;q<7;q++){var t2=top+q*8;x.beginPath();x.moveTo(mx(60,e.s),t2-74);x.quadraticCurveTo(mx(150,e.s),t2+56,mx(270,e.s),t2+18);x.lineTo(mx(270,e.s),H);x.lineTo(mx(60,e.s),H);x.closePath();x.fill();}x.restore();});
  sp.ptx.forEach(function(p){x.save();lung(p.s);x.clip();var off=14+46*p.k;x.fillStyle='rgba(0,0,0,.88)';x.beginPath();x.moveTo(mx(236,p.s),86);x.bezierCurveTo(mx(170,p.s),80,mx(90,p.s),190,mx(80,p.s),350);x.lineTo(mx(80+off,p.s),350);x.bezierCurveTo(mx(92+off,p.s),214,mx(172+off*.4,p.s),98+off,mx(236,p.s),96+off);x.closePath();x.fill();
    x.strokeStyle='rgba(240,240,240,.75)';x.lineWidth=1.3;x.beginPath();x.moveTo(mx(80+off,p.s),350);x.bezierCurveTo(mx(92+off,p.s),214,mx(172+off*.4,p.s),98+off,mx(236,p.s),96+off);x.stroke();x.restore();});
  /* lines, tubes and drains */
  x.lineCap='round';x.lineJoin='round';
  function tube(pts,wd,a){x.strokeStyle='rgba(255,255,255,'+(a||.9)+')';x.lineWidth=wd||2.2;x.beginPath();x.moveTo(pts[0][0],pts[0][1]);for(var j=1;j<pts.length;j++)x.lineTo(pts[j][0],pts[j][1]);x.stroke();}
  if(sp.lines.cvc){var s=sp.lines.cvc;x.strokeStyle='rgba(255,255,255,.92)';x.lineWidth=2.2;x.beginPath();x.moveTo(mx(236,s),8);x.bezierCurveTo(mx(232,s),80,mx(s==='R'?250:200,s),120,s==='R'?256:262,176);x.bezierCurveTo(254,220,254,260,254,296);x.stroke();}
  if(sp.lines.ett){tube([[280,0],[280,150]],4,.75);tube([[276,150],[284,150]],2);}
  if(sp.lines.ng){x.strokeStyle='rgba(255,255,255,.85)';x.lineWidth=2;x.beginPath();x.moveTo(286,0);x.bezierCurveTo(290,200,286,380,300,470+dy);x.bezierCurveTo(320,520+dy,380,530+dy,404,512+dy);x.stroke();}
  sp.drain.forEach(function(s){x.strokeStyle='rgba(255,255,255,.9)';x.lineWidth=4;x.beginPath();x.moveTo(mx(40,s),372);x.bezierCurveTo(mx(96,s),350,mx(150,s),240,mx(196,s),128);x.stroke();x.strokeStyle='rgba(0,0,0,.6)';x.lineWidth=1.2;x.beginPath();x.moveTo(mx(40,s),372);x.bezierCurveTo(mx(96,s),350,mx(150,s),240,mx(196,s),128);x.stroke();});
  if(sp.lines.pm){x.fillStyle='rgba(250,250,250,.95)';x.beginPath();x.ellipse(430,150,30,24,.2,0,6.3);x.fill();x.strokeStyle='rgba(255,255,255,.92)';x.lineWidth=2;x.beginPath();x.moveTo(404,140);x.bezierCurveTo(330,96,262,150,258,250);x.bezierCurveTo(256,330,300,400,352,430);x.stroke();}
  if(sp.lines.wires){for(i=0;i<6;i++){x.strokeStyle='rgba(255,255,255,.9)';x.lineWidth=1.6;x.beginPath();x.ellipse(280,150+i*38,9,6,.3,0,6.3);x.stroke();}}
  if(sp.lines.leads){[[150,150],[410,150],[150,430],[420,440],[330,330]].forEach(function(q){x.fillStyle='rgba(255,255,255,.85)';x.beginPath();x.arc(q[0],q[1],5,0,6.3);x.fill();x.strokeStyle='rgba(255,255,255,.5)';x.lineWidth=1;x.beginPath();x.moveTo(q[0],q[1]);x.quadraticCurveTo(q[0]+30,q[1]+120,q[0]<280?0:W,q[1]+190);x.stroke();});}
  /* fine grain, side marker, label */
  for(i=0;i<1400;i++){x.fillStyle='rgba(255,255,255,'+(r()*.035)+')';x.fillRect(r()*W,r()*H,2,2);}
  x.fillStyle='rgba(255,255,255,.92)';x.font='700 26px system-ui,sans-serif';x.fillText('R',22,46);x.strokeStyle='rgba(255,255,255,.92)';x.lineWidth=2;x.strokeRect(14,20,34,34);
  x.font='11px ui-monospace,Menlo,Consolas,monospace';x.fillStyle='rgba(255,255,255,.75)';x.textAlign='right';x.fillText('SIMULATED · drawn from the report text',W-10,H-10);x.textAlign='left';
  return sp;}
return {kind:kind,ecg:ecg,cxr:cxr,ecgSpec:ecgSpec,cxrSpec:cxrSpec};
})();
