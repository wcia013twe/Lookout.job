// Deliberately omit values, IDs, free-form server text and interviewer content.
const messages=new Set([
 'Mock arguments required','Mock session UUID required','Mock artifact and bounded interviewer profile required',
 'scheduledAt must include Z or an explicit UTC offset, for example 2026-11-09T15:00:00-05:00','Remove preparedFor from mock interviews; describe the target interview in purpose or body instead',
 'Dated mock session required','Valid time zone required','Assign the mock to its scheduled local week',
 'Title, purpose and content required','Dated HTTPS sources required','Unique typed subject links required',
 'preparedFor is supported only for kind weekly_prep or interview_brief; omit preparedFor for practice and other saved materials',
 'Unique non-self material references require a Markdown prep collection','Owned record not found',
 'Record or settings changed; read current state and retry with its version','Dated mock session in its local week required',
 'Invalid artifact content','Mock artifact and interviewer profile required','New mocks start scheduled',
 'Restore archived session first','Create a new session after a terminal mock','Resume the existing session',
 'Complete an active mock with a saved debrief','Invalid tool arguments','Missing required scope',
]);
const type=value=>value===null?'null':Array.isArray(value)?'array':typeof value;
export function mockRejection(tool,stage,reason,args,status){
 const artifact=args?.artifact;
 return {service:'lookout-mcp',event:'mock.rejected',diagnosticId:crypto.randomUUID(),tool:tool==='read_mock_interview'?tool:'save_mock_interview',stage,status,
  reason:messages.has(reason)?reason:'Invalid arguments or backend rejection; inspect schema checks',
  shape:{arguments:type(args),artifact:type(artifact),interviewerProfile:type(args?.interviewerProfile),
   ...(artifact&&type(artifact)==='object'?{fieldTypes:Object.fromEntries(['id','expectedVersion','kind','format','scheduledAt','timeZone','durationMinutes','sessionStatus','weekOf','sources','links'].map(key=>[key,type(artifact[key])]))}:{}),
  }};
}
