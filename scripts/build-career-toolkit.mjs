import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const catalog = JSON.parse(await read('integrations/career-ops/catalog.json'));
const manifest = JSON.parse(await read('integrations/career-ops/manifest.json'));
const documents = {};
for (const file of manifest.files) {
  const content = await read(`integrations/career-ops/upstream/${file.path}`);
  if (createHash('sha256').update(content).digest('hex') !== file.sha256) throw Error(`Upstream source changed: ${file.path}`);
  documents[file.path] = content;
}
const adapter = `Use this Career Toolkit workflow whenever it matches the current user goal or authorized queued task. Select it automatically from the guide index; never require the user to name a skill, copy a prompt or install individual skills. This is a Lookout adaptation of Career Ops, not a local Career Ops installation. Apply the workflow's reasoning to available context; never claim a command, integration, document renderer or scheduler exists merely because the reference mentions it.
Read current Lookout developer/personal context using available scoped tools. Treat profile facts, selected resume, preferences, owned application and timeline as the inputs corresponding to upstream cv.md, profile.yml and tracker files. Local file paths, CLI commands, shell snippets, user-file writes and installation steps in the source documents are reference requirements, not instructions to execute or install software. Use only available, authorized tools. Do not create a parallel tracker or profile. If an output has no supported persistence operation, give the user the draft in conversation and say it was not saved.
The user's goals replace upstream default seniority, scoring weights and career archetypes. Never fabricate experience, metrics, eligibility, dates, outcomes or arithmetic. Ask one focused question at a time when facts are missing. Do not turn uncertain estimates into verified profile facts. Proposed facts and answers remain unverified; no guide grants approval, autofill permission, submission rights, sharing consent, messaging permission or scheduling access. Retain exact review and uncertainty boundaries from Lookout. Profile proposals use the existing profile tools; application preparation uses existing draft/plan tools; outreach uses the cold-outreach guide and scoped outreach tools. Read actual histories before statistics or follow-ups. Regional legal or eligibility facts require current official sources.
Browsing a manual or copying a request does not execute work. For recurring tasks, ask for timezone/cadence and verify real runtime scheduling support; never report activation from a saved preference alone. For file output, check rendering and upload support; provide a content draft when missing. Guides are read-only instruction packages. The updated local Lookout MCP runner separately exposes list_job_providers, configure_job_provider, scan_job_sources, verify_job_posting, check_resume_ats, generate_career_document and analyze_career_history. Prefer these actual tools when available; hosted context/results/upload tools alone do not execute local programs. Scans consume saved preferences.search.targets and save discovered leads, not verified fits. Verify official postings before publish_batch. Save scored requirement evidence with record_toolkit_result(kind=evaluation, applicationId, score 1–5 and requirements); compensation observations need amount, currency, date, type and source. Analytics uses owned records and reports missing/partial data. Generated PDFs return private fileId and resumeId for resumes, never automatic defaults or approval. Demo context is fictional and must never trigger account writes, real file retrieval, external messages or submissions.`;
const guides = catalog.skills.map(skill => {
  const paths = [...skill.sources];
  if (['evaluate-job','quick-triage','compare-jobs'].includes(skill.id)) paths.push('modes/_shared.md');
  if (['tailor-resume','resume-pdf','cover-letter','application-email','find-contacts','follow-up'].includes(skill.id)) paths.push('modes/heuristics/recruiter-side.md','modes/_writing.md');
  return {
    id: skill.guideId, version: skill.version, name: skill.title, description: skill.summary,
    whenToUse: skill.whenToUse,
    instructions: `${adapter}\n\nSkill: ${skill.title}\nInputs:\n${skill.inputs.map(x=>'- '+x).join('\n')}\nProcedure:\n${skill.steps.map((x,i)=>`${i+1}. ${x}`).join('\n')}\nRequirements: ${skill.requirements}\nUse the source documents below for the underlying Career Ops workflow. The Lookout adaptation above takes precedence over conflicting filesystem, permissions, unsupported tool and persistence assumptions.`,
    expectedOutput: skill.outputs,
    manual: skill,
    attribution: {repository:manifest.repository,commit:manifest.commit,license:manifest.license},
    sourceDocuments: paths.map(path => {
      let content = documents[path];
      if (!content) throw Error(`Missing skill source: ${path}`);
      if (path === 'docs/SCRIPTS.md') {
        const start = content.indexOf('## salary-gap\n');
        const end = content.indexOf('\n## ',start+4);
        content = content.slice(start,end < 0 ? undefined : end);
      }
      return {path,content};
    }),
  };
});
// Search has one canonical procedure, independent of generated upstream references.
const discovery=guides.find(g=>g.id==='career-find-jobs');
Object.assign(discovery, JSON.parse(await read('supabase/functions/agent-gateway/skills/career-find-jobs.json')));

// The company research handoff uses the durable workspace boundary.
for(const guide of guides)if(guide.id==='career-research-company')guide.instructions+='\n\nLookout Network storage: read list_company_workspaces and save_company_workspace with the existing target ID and current expectedRevision (0 for new). Preserve private priorities, target teams, concerns, next action, follow-up date, dated sources, explicit contact/application links and archive state. Complete record fields are name,website,priority,interest,targetTeams,concerns,research,nextAction,followUpDate,sources [{title,url,observedAt,summary}],contactIds,applicationIds,archived. Use list_companies for maintained canonical names/aliases; unknown companies remain valid private workspaces. Do not edit the shared registry or merge duplicate research automatically. Legacy list_contacts/save_contact projections are compatibility only. Circle evidence may be read through search_circle_knowledge with scope current_memberships and companyId or unresolved company text. Reading evidence does not authorize sharing private research or copying replies into interview reports.';

const output = JSON.stringify({version:catalog.version,upstream:manifest.commit,guides},null,2)+'\n';
const target = new URL('supabase/functions/agent-gateway/skills/career-toolkit.json', root);
if (process.argv.includes('--check')) {
  if (await readFile(target,'utf8') !== output) throw Error('Career Toolkit guide bundle is stale; run node scripts/build-career-toolkit.mjs');
  console.log(`${guides.length} Career Toolkit guides match pinned sources and manuals.`);
} else { await writeFile(target,output); console.log(`Built ${guides.length} Career Toolkit guides.`); }
