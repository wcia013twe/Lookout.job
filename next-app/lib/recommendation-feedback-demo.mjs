export const feedbackDemoRows=[
  {kind:'job',targetId:'demo-robinhood',rating:'helpful',reason:'',note:'',version:1},
  {kind:'job',targetId:'demo-stripe',rating:'not-helpful',reason:'Role scope',note:'Fictional feedback: show more storage-engine work.',version:2},
  {kind:'network',targetId:'demo-referral',rating:'not-helpful',reason:'Timing',note:'Fictional feedback: wait until after the interview.',version:1},
];

export function createDemoFeedbackServices(scenario) {
  const rows=new Map(feedbackDemoRows.map(row=>[JSON.stringify([row.kind,row.targetId]),{...row}]));
  const failed=new Set();
  const wait=()=>new Promise(resolve=>setTimeout(resolve,250));
  return {
    async readRecommendationFeedback({targets}) {
      await wait();
      if(scenario==='unavailable'&&!failed.has('read')){failed.add('read');throw new Error('Fictional demo load failure');}
      return {rows:targets.map(target=>rows.get(JSON.stringify([target.kind,target.targetId]))||{...target,rating:null,reason:'',note:'',version:0})};
    },
    async saveRecommendationFeedback({kind,targetId,rating,reason,note,expectedVersion,context}) {
      await wait();
      const key=JSON.stringify([kind,targetId]);
      if(scenario==='unavailable'&&!failed.has(key)) {
        failed.add(key);
        rows.set(key,{kind,targetId,rating:'helpful',reason:'',note:'',version:expectedVersion+1});
        throw new Error('Fictional stale feedback version');
      }
      const row={kind,targetId,rating,reason,note,context,version:expectedVersion+1};
      rows.set(key,row);
      return row;
    },
  };
}
