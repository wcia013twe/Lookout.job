export const VERSION = 'eval-v1';
export const statuses = ['completed','timed_out','execution_failed','setup_failed','artifact_failed','harness_failed'];
export const scoreConfigs = [
  {name:'eval_v1_cost_coverage',dataType:'CATEGORICAL',categories:['complete','partial','unknown'].map((label,value)=>({label,value})),description:'Provider usage coverage, not grading success.'},
  ...['input_tokens','cached_input_tokens','output_tokens','estimated_model_usd','estimated_total_usd','toolUsd','infrastructureUsd','lookoutProcessingUsd','attempted_stages','covered_stages'].map(key=>({name:'eval_v1_cost_'+key,dataType:'NUMERIC',minValue:0,description:'Whole-trajectory cost accounting. Missing stays absent; USD estimates are API-equivalent, not subscription charges.'})),
  {name:'eval_v1_task_success',dataType:'BOOLEAN',description:'Whole-trajectory success under the declared grader. Missing/unreviewed judgments are omitted, never zero.'},
  {name:'eval_v1_quality',dataType:'NUMERIC',minValue:0,maxValue:1,description:'Reviewed normalized rubric score. Compare only matching scenario and grader versions.'},
  {name:'eval_v1_active_seconds',dataType:'NUMERIC',minValue:0,description:'Sum of active execution seconds across wakes; includes failed attempts. Excludes simulated waiting and export time.'},
  {name:'eval_v1_tool_calls',dataType:'NUMERIC',minValue:0,description:'Observed tool invocations across the full trajectory; count each invocation once.'},
  {name:'eval_v1_wakes_used',dataType:'NUMERIC',minValue:0,description:'Number of participant wakes actually attempted.'},
  {name:'eval_v1_reviewed',dataType:'BOOLEAN',description:'Whether an independent final quality judgment is available.'},
  {name:'eval_v1_execution_status',dataType:'CATEGORICAL',categories:statuses.map((label,value)=>({label,value})),description:'Execution outcome, separate from judged task success.'},
];
const eq=(column,value)=>({column,operator:'=',type:'string',value});
const widget=(name,score,view,description,dimensions=['traceName','traceVersion'])=>({
  name:'Eval case · '+name,description,view,dimensions:dimensions.map(field=>({field})),
  metrics:[{measure:view==='scores-categorical'?'count':'value',agg:view==='scores-categorical'?'count':'max'}],
  filters:[eq('environment','benchmark'),eq('name',score)],chartType:'PIVOT_TABLE',
  chartConfig:{type:'PIVOT_TABLE',row_limit:100},
});
export const widgets = [
  widget('Completion status','eval_v1_execution_status','scores-categorical','Selected case and run only. Count must be one per condition/version; duplicates need investigation.',['traceName','stringValue']),
  widget('Task success','eval_v1_task_success','scores-boolean','Selected attempt: 1 pass, 0 fail. Missing means unreviewed, not failure.'),
  widget('Quality','eval_v1_quality','scores-numeric','Selected attempt normalized quality; missing means no independent judgment.'),
  widget('Active seconds','eval_v1_active_seconds','scores-numeric','Selected attempt active execution seconds, excluding simulated waiting.'),
  widget('Tool calls','eval_v1_tool_calls','scores-numeric','Selected attempt observed tool calls.'),
  widget('Wakes used','eval_v1_wakes_used','scores-numeric','Selected attempt wakes actually attempted.'),
  widget('Reviewed','eval_v1_reviewed','scores-boolean','Selected attempt: 1 independently reviewed, 0 not reviewed.'),
];
export const dashboard = {
  name:'Eval Case & Run',
  description:'Select exactly one eval-case tag and one eval-run tag in the two Tags dropdowns. Baseline and Lookout are shown together. Release/version rows keep reused run numbers separate; do not combine them. No cross-case summary. Empty panels mean no compatible measured results exported. Default: COM1, run 1.',
  filters:[
    {column:'tags',operator:'any of',type:'arrayOptions',value:['eval-case:COM1']},
    {column:'tags',operator:'any of',type:'arrayOptions',value:['eval-run:1']},
  ],
};
