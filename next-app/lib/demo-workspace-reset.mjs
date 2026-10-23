// Only accepts the disposable demo store. Never imports Auth or backend clients.
export function previewDemoReset(store){
 const state=store.get();
 return {state:'ready',personalVersion:1,files:[],counts:{'Fictional applications':Object.keys(state.workflow.applications||{}).length,'Fictional resumes':(state.workflow.resumes||[]).length,'Fictional saved answers':(state.workflow.savedAnswers||[]).length,'Fictional profile':1}};
}
export function resetDemoWorkspace(store,confirmation){
 if(confirmation!=='RESET MY WORKSPACE')throw Error('Exact confirmation required');
 const state=store.get();
 state.workflow={applications:{},preparationPlans:{},preparationPlanner:{settings:{dailyMinutes:45,version:0},sessions:[]},profile:{name:'',email:'',phone:'',location:'',authorization:'',verified:false},resumes:[],savedAnswers:[],deletedAnswerIds:[],cloudDirty:false,theme:{pack:'base'},searchPreferences:{},tierLists:[],activeTierListId:''};
 state.network={companies:[],people:[],referrals:[]};state.tracker={ids:[],items:{}};state.progress={xp:0,xpAwards:{},streakDays:[]};state.drops={seenDropIds:[],packStamps:{}};
 store.reset(state);
 return {state:'completed',fictional:true};
}
