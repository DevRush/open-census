HOSP.comorbidity({key:'dementia',name:'Dementia',icd:'F03.90',prior:[0,.01,.14],minAge:62,
 problem:'Dementia, [mild|moderate]; lives with family support',pmh:'[Alzheimer’s disease|Mixed dementia], diagnosed {year}',home:['donepezil10'],
 opd:{clinic:{key:'memc',p:.35},every:[26,52],tracks:{},sx:['family report slow change in memory; still enjoys [music|the garden|television quizzes]','needs prompting to wash and dress','one episode of getting lost near home','sleeping well; no agitation in the evenings'],
  plan:['Carer support and day-centre information given','Driving and home safety reviewed','Advance care planning discussed with family','Medicines reviewed to remove those that worsen confusion']},
 flags:['frail'],avoid:['benzodiazepine'],orders:[['Nursing','Delirium prevention: glasses and hearing aids on, family presence, lights on by day']],
 plan:'Dementia: delirium precautions, familiar routine, involve family in decisions.',interact:{delirium:3,fall:2},los:.8});
