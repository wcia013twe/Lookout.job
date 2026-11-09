export const VERSION = 'eval-v1';
export const statuses = ['completed','timed_out','execution_failed','setup_failed','artifact_failed','harness_failed'];
export const scoreConfigs = [
  {name:'eval_v1_task_success',dataType:'BOOLEAN',description:'Whole-trajectory success under the declared grader. Missing/unreviewed judgments are omitted, never zero.'},
  {name:'eval_v1_quality',dataType:'NUMERIC',minValue:0,maxValue:1,description:'Reviewed normalized rubric score. Compare only matching scenario and grader versions.'},
  {name:'eval_v1_active_seconds',dataType:'NUMERIC',minValue:0,description:'Sum of active execution seconds across wakes; includes failed attempts. Excludes simulated waiting and export time.'},
  {name:'eval_v1_tool_calls',dataType:'NUMERIC',minValue:0,description:'Observed tool invocations across the full trajectory; count each invocation once.'},
  {name:'eval_v1_wakes_used',dataType:'NUMERIC',minValue:0,description:'Number of participant wakes actually attempted.'},
  {name:'eval_v1_reviewed',dataType:'BOOLEAN',description:'Whether an independent final quality judgment is available.'},
  {name:'eval_v1_execution_status',dataType:'CATEGORICAL',categories:statuses.map((label,value)=>({label,value})),description:'Execution outcome, separate from judged task success.'},
];
const eq=(column,value)=>({column,operator:'=',type:'string',value});
const widget=(name,score,view,measure,agg,description,dimensions=['traceVersion','traceName'])=>({
  name:'Eval v1 · '+name,description,view,dimensions:dimensions.map(field=>({field})),
  metrics:[{measure,agg}],filters:[eq('environment','benchmark'),eq('name',score)],chartType:'PIVOT_TABLE',
  chartConfig:{type:'PIVOT_TABLE',row_limit:100},
});
export const widgets = [
  widget('Attempts by outcome','eval_v1_execution_status','scores-categorical','count','count','One score per trajectory. Filter a campaign before comparison.',['traceName','stringValue']),
  widget('Evaluated attempts','eval_v1_task_success','scores-boolean','count','count','Denominator for success rate; compare against attempts and review coverage.'),
  widget('Task success rate','eval_v1_task_success','scores-boolean','value','avg','Fraction 0–1 of judged trajectories that passed; missing judgments excluded, not passed.'),
  widget('Quality','eval_v1_quality','scores-numeric','value','avg','Mean reviewed quality; separate scenario/grader versions.'),
  widget('Active seconds','eval_v1_active_seconds','scores-numeric','value','p50','Median active seconds across all outcomes, not time-to-success. Inspect alongside success rate.'),
  widget('Tool calls','eval_v1_tool_calls','scores-numeric','value','p50','Median observed tool calls across all outcomes.'),
  widget('Wakes used','eval_v1_wakes_used','scores-numeric','value','p50','Median attempted wakes across all outcomes.'),
  widget('Review coverage','eval_v1_reviewed','scores-boolean','value','avg','Fraction independently reviewed. Unreviewed quality is not assumed to pass.'),
];
export const dashboard = {
  name:'Eval Overview v1',
  description:'Whole trajectories, measured runs only. Filter traceRelease to one campaign. traceVersion separates scenario and grader versions; traceName separates conditions. Active time/effort include failures. Use Experiments for matched item comparisons. Empty charts mean no compatible results exported yet.',
  filters:[eq('environment','benchmark')],
};
