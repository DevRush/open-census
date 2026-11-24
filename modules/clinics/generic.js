/* Fallback clinic module. Used by every clinic whose row in hospital/clinics.js says module 'generic';
   the reasons for visits come from that row. Replace by writing a real module and changing the row. */
HOSP.clinic({key:'generic',name:'Specialty clinic',every:[8,13,26],noShow:.08,age:[18,90,55],
 visitTypes:['New patient','Return visit','Hospital follow-up'],problems:[],
 exam:'[Looks well|Comfortable at rest]. Focused examination [unchanged from the last visit|without new findings].',
 referral:'Referred by [primary care|another specialist|the emergency department] for assessment',
 planGeneric:'[stable; continue current management|improving; no change to treatment|symptoms controlled; continue and review|investigation results reviewed and explained; plan unchanged|treatment adjusted today; written instructions given]',
 notes:{new:'New patient visit to {clinic}. {age} {sex}. {referral}. Records and results reviewed.',ret:'{age} {sex} here for planned follow-up in {clinic}.',hfu:'{age} {sex} seen in {clinic} after a hospital stay; the discharge summary was reviewed.'},
 hm:[],orders:[]});
