HOSP.comorbidity({key:'hypothyroid',name:'Hypothyroidism',icd:'E03.9',prior:[.04,.08,.11],minAge:20,ob:true,
 problem:'Hypothyroidism on levothyroxine',pmh:'Hypothyroidism',
 opd:{clinic:{key:'endog',p:.12},every:[26,52],tracks:{tsh:{start:[2.2,9.5],drift:.3,noise:.6,floor:.6}},
  ladder:{on:'tsh',above:4.5,effect:2.6,startMax:2,steps:['levo50','levo75','levo100','levo125']},
  sx:['energy [good|a little low]; weight steady','takes the tablet on an empty stomach each morning','no palpitations or tremor'],
  plan:['Thyroid test 6 to 8 weeks after any dose change','Keep calcium and iron 4 hours apart from the tablet']},
 plan:'Hypothyroidism: continue levothyroxine.',los:0});
