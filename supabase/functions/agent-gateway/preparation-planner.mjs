import { applicationRounds, roundDate } from './application-rounds.mjs';
import { preparationDate } from './preparation-model.mjs';
const DAY = 86400000;
export const plannerDay = (date, offset = 0) => new Date(Date.parse(`${date}T12:00:00Z`) + offset * DAY).toISOString().slice(0, 10);
export const plannerWeekStart = date => plannerDay(date, -(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7);
export function buildWeeklyPreparationAgenda(input = {}) {
 const today = input.today || plannerToday(new Date(), input.timeZone || 'UTC');
 const weekOf = input.weekOf || plannerWeekStart(today);
 if (!preparationDate(weekOf) || plannerWeekStart(weekOf) !== weekOf) throw Error('Choose a Monday week date.');
 return {...buildPreparationAgenda({...input,today,windowStart:weekOf}),weekOf};
}
export function plannerToday(now = new Date(), timeZone = 'UTC') {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now)).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch { return new Date(now).toISOString().slice(0, 10); }
}
export function validatePlannerMinutes(value) {
  if (!Number.isInteger(value) || value < 0 || value > 240) throw Error('Choose a daily budget between 0 and 240 minutes.');
  return value;
}
const targetKey = target => `${target.goalId ? `goal:${target.goalId}` : target.applicationId}:${target.taskId}`;
function taskGroup(task, plan, application) {
  const key = task.key || task.id?.slice(`${plan.applicationId}:`.length);
  if (key?.startsWith('guide-')) {
    const guide = (plan.guides || []).find(g => g.id === task.guideId || `guide-${g.id}` === key);
    // Company research and intelligence are never silently generalized.
    if (guide && !guide.companyMatch && !guide.companies?.length && guide.url?.startsWith('https://')) {
      return { key: `resource:${guide.url}`, title: `Review ${guide.title}`, detail: task.detail, shared: true };
    }
  }
  if (key === 'practice') {
    const stage = (plan.deadline?.stage || '').toLowerCase();
    const role = `${application.title || ''} ${application.description || ''}`.toLowerCase();
    const focus = plan.roundId ? (plan.practiceCategory === 'general' ? null : plan.practiceCategory) : /system.?design|architecture/.test(stage) ? 'systems' : /coding|algorithm|\boa\b/.test(stage) ? 'coding'
      : /behavior|recruiter|phone screen/.test(stage) ? 'behavioral'
      : /technical/.test(stage) ? /sql|database/.test(role) ? 'sql' : /machine learning|inference|\bml\b/.test(role) ? 'ml' : /backend|distributed|infrastructure|platform/.test(role) ? 'systems' : 'coding' : null;
    const labels = { systems: ['Practice system design', 'Explain a design, its tradeoffs and failure modes aloud.'], coding: ['Practice coding interviews', 'Solve a relevant problem, explain your approach and review its complexity.'], behavioral: ['Rehearse your experience stories', 'Practice concise examples from your own experience and the decisions you made.'], sql: ['Practice SQL and database questions', 'Work through queries and explain indexes, query plans and tradeoffs.'], ml: ['Practice ML systems interviews', 'Explain model serving, evaluation and performance tradeoffs relevant to your roles.'] };
    if (focus && labels[focus]) return { key: `practice:${focus}`, title: labels[focus][0], detail: labels[focus][1], shared: true };
  }
  return { key: `specific:${application.id}:${task.id}`, title: task.title, detail: task.detail, shared: false };
}

// Exact multiple-choice knapsack for each day: choose at most one time slice per
// topic, maximizing deadline-weighted interview coverage under that day's budget.
function allocate(groups, available, date, planned) {
  let states = new Map([[0, { score: 0, picks: [] }]]);
  for (const group of groups) {
    const active = group.targets.filter(t => t.deadline >= date && (planned.get(targetKey(t)) || 0) < t.remaining);
    if (!active.length) continue;
    const remaining = Math.max(...active.map(t => t.remaining - (planned.get(targetKey(t)) || 0)));
    const max = Math.min(remaining, available);
    const minimum = Math.min(15, available);
    const sizes = [...new Set([...Array.from({ length: Math.max(0, Math.floor((max - minimum) / 5) + 1) }, (_, i) => minimum + i * 5), ...(remaining <= available ? [remaining] : [])])].filter(n => n > 0);
    const next = new Map(states);
    for (const [used, state] of states) for (const minutes of sizes) {
      if (used + minutes > available) continue;
      const score = active.reduce((sum, t) => {
        const days = Math.round((Date.parse(`${t.deadline}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / DAY);
        const credit = Math.min(minutes, t.remaining - (planned.get(targetKey(t)) || 0));
        return sum + (1 + 7 / (days + 1)) * t.priority * credit / Math.max(30, t.minutes);
      }, 0);
      const total = state.score + score;
      if (total > (next.get(used + minutes)?.score ?? -1)) next.set(used + minutes, { score: total, picks: [...state.picks, { group, targets: active, minutes }] });
    }
    states = next;
  }
  return [...states.values()].reduce((best, value) => value.score > best.score ? value : best, { score: -1, picks: [] }).picks;
}
export function roundPreparationRows(rows, applications, timeZone='UTC') {
 return rows.flatMap(row=>{
  const plan=row.plan;if(!plan)return [];
  const application=applications[plan.applicationId]||Object.values(applications).find(a=>a.backendId===row.application_id);
  if(!application)return [row];
  const tasks=plan.tasks||[],roundIds=[...new Set(tasks.map(t=>t.roundId).filter(Boolean))];
  if(!roundIds.length)return [row];
  const events=application.milestones||[],superseded=new Set(events.map(m=>m.supersedes_id).filter(Boolean));
  const current=events.filter(m=>!superseded.has(m.id));
  const legacy=tasks.filter(t=>!t.roundId);
  return [...(legacy.length?[{...row,plan:{...plan,tasks:legacy,standalone:true}}]:[]),...roundIds.flatMap(roundId=>{
   const round=current.find(m=>(m.round_id||m.id)===roundId);
   if(!round||round.phase!=='scheduled'||round.confirmation==='incorrect')return [];
   const confirmed=round.confirmation==='confirmed'||(!round.confirmation&&round.source?.timestampConfirmed===true);
   return [{...row,plan:{...plan,roundId,roundEventId:round.id,practiceCategory:round.practice_category||'general',deadline:{date:round.occurred_at?plannerToday(round.occurred_at,timeZone):null,status:confirmed?'confirmed':'needs_confirmation',stage:round.label,source:round.source},tasks:tasks.filter(t=>t.roundId===roundId)}}];
  })];
 });
}
export function buildPreparationAgenda({ applications = {}, plans = [], sessions = [], settings = {}, learningGoals = [], artifacts = [], today = plannerToday(), timeZone = 'UTC', holds = [], imports = [], calendarArtifacts = [], windowStart = today } = {}) {
  if (!preparationDate(today)) throw Error('Choose a valid planner date.');
  const dailyMinutes = validatePlannerMinutes(settings.dailyMinutes ?? 45);
  if (!preparationDate(windowStart)) throw Error('Choose a valid calendar start date.');
  const end = plannerDay(windowStart, 6), progress = new Map(), spent = new Map();
  for (const session of sessions) {
    const date = plannerToday(session.completed_at || session.completedAt, timeZone);
    spent.set(date, (spent.get(date) || 0) + session.minutes);
    for (const target of session.targets || []) progress.set(targetKey(target), (progress.get(targetKey(target)) || 0) + session.minutes);
  }
  const groups = new Map(), interviews = [], dormant = [], uncertain = [], expired = [], pending = [];
  const outside = date => !date || date < windowStart || date > end;
  const pendingReason = date => !date ? 'No date set' : date < today ? 'Overdue' : 'Outside this week';
  const activeApplication = app => !['rejected','withdrawn','closed','posting closed'].includes(String(app.status).toLowerCase()) && !app.archived && !holds.some(h => h.application_id === (app.backendId || app.id) && !h.resumed_at);
  const dayOf = value => roundDate(value) ? value.length === 10 ? value : plannerToday(value, timeZone) : null;
  // Saved rounds are calendar events even before a preparation plan exists.
  const native = Object.values(applications);
  const imported = imports.filter(row => !native.some(app => (row.record.url && row.record.url === app.url) || ['company','title','location'].every(k => String(row.record[k] || '').toLowerCase() === String(app[k] || '').toLowerCase()))).map(row => ({...row.record, id:`import:${row.id}`, imported:row}));
  const events = [];
  for (const app of [...native, ...imported].filter(activeApplication)) {
    const rounds = applicationRounds(app).filter(round => !round.cancelled && ['pending','scheduled'].includes(round.status));
    const actionDate = preparationDate(app.actionDate);
    const hasAction = Boolean(app.imported && app.nextAction && (actionDate || app.needsAction));
    for (const round of rounds) {
      const date = dayOf(round.date);
      // An imported application may describe its one open round through its
      // next action. Keep that saved deadline; do not synthesize a round date.
      if (!date && rounds.length === 1 && hasAction) continue;
      if (outside(date)) pending.push({id:`round:${app.id}:${round.id}`,applicationId:app.id,roundId:round.id,company:app.company,title:round.label,date,reason:pendingReason(date)});
      else interviews.push({applicationId:app.id, roundId:round.id, company:app.company, title:app.title, stage:round.label, date, kind:round.stage === 'SCREEN' ? 'Screen' : 'Interview'});
    }
    // A dated round already represents this application's action on that day.
    const roundOwnsActionDate = actionDate && rounds.some(round => dayOf(round.date) === actionDate);
    if (hasAction && !roundOwnsActionDate) {
      events.push({id:`action:${app.id}`, applicationId:app.id, path:`/applications/?application=${encodeURIComponent(app.id)}`, company:app.company, title:app.nextAction, date:actionDate, kind:'Next action'});
    }
  }
  for (const artifact of calendarArtifacts) {
    const c = artifact.content || {}, date = dayOf(c.scheduledAt);
    if (artifact.archived || c.kind !== 'mock_interview' || !['scheduled','in_progress'].includes(c.sessionStatus) || !date) continue;
    events.push({id:`mock:${artifact.id}`, title:c.title, date, kind:'Mock interview', path:`/career-toolkit/?artifact=${encodeURIComponent(artifact.id)}`});
  }

  for (const event of events) if (outside(event.date)) pending.push({...event,reason:pendingReason(event.date)});
  const missingTasks = (row,application,date,reason) => {
   for (const task of row.plan.tasks || []) if (!task.completed) pending.push({id:`prep:${row.application_id}:${task.id}`,applicationId:application.id,roundId:task.roundId,company:application.company,title:task.title,date,reason});
  };
  const rows = Array.isArray(plans) ? plans : Object.entries(plans).map(([id, value]) => value?.plan ? value : { application_id: id, version: 0, plan: value });
  for (const row of roundPreparationRows(rows,applications,timeZone)) {
    if(holds.some(h=>h.application_id===row.application_id&&!h.resumed_at))continue;
    const plan = row.plan;
    const application = applications[plan?.applicationId] || Object.values(applications).find(a => a.backendId === row.application_id);
    if (!application || !plan || !activeApplication(application) || (application.milestones || []).some(event => ['rejected','withdrawn'].includes(event.kind) && event.phase !== 'scheduled')) continue;
    const date = preparationDate(plan.deadline?.date);
    if (!date || plan.deadline?.status !== 'confirmed') { uncertain.push(application.id); missingTasks(row,application,null,'Date needs confirmation'); continue; }
    if (date < today) { expired.push(application.id); missingTasks(row,application,date,'Overdue'); continue; }
    if (date > end) { dormant.push(application.id); missingTasks(row,application,date,'Outside this week'); continue; }
    if (!applicationRounds(application).length) interviews.push({ roundId:plan.roundId, standalone:!!plan.standalone, applicationId: application.id, company: application.company, title: application.title, date, stage: plan.deadline.stage });
    for (const task of plan.tasks || []) {
      if (task.completed || !Number.isFinite(task.minutes) || task.minutes <= 0) continue;
      const target = { applicationId: row.application_id || application.backendId || application.id, jobId: application.id, roundId:plan.roundId, taskId: task.id, expectedVersion: row.version || 0, company: application.company, deadline: date, minutes: task.minutes, priority: application.priority === 'Apply Now' ? 1.5 : 1 };
      target.remaining = Math.max(0, task.minutes - (progress.get(targetKey(target)) || 0));
      if (!target.remaining) continue;
      const definition = taskGroup(task, plan, application);
      const group = groups.get(definition.key) || { ...definition, targets: [] };
      group.targets.push(target); groups.set(definition.key, group);
    }
  }
  const learning = [];
  for (const row of learningGoals) {
    if (!row.goal?.active) continue;
    for (const task of row.goal.tasks || []) {
      if (task.completed || !Number.isFinite(task.minutes) || task.minutes <= 0) continue;
      if (!preparationDate(task.targetDate) || task.targetDate > end) { pending.push({id:`goal:${row.id}:${task.id}`,title:task.title,company:row.goal.title,date:task.targetDate || null,reason:pendingReason(task.targetDate),path:'/career-toolkit/'}); continue; }
      const target = {goalId:row.id,taskId:task.id,expectedVersion:row.version,company:row.goal.title,deadline:task.targetDate < today ? today : task.targetDate,minutes:task.minutes,priority:1};
      target.remaining=Math.max(0,task.minutes-(progress.get(targetKey(target))||0));
      if(target.remaining)learning.push({key:`learning:${row.id}:${task.id}`,title:task.title,detail:task.detail,shared:false,learning:true,targets:[target]});
    }
  }
  const references = target => artifacts.filter(a => (a.links || []).some(l => l.taskId === target.taskId && (target.goalId ? l.goalId === target.goalId : l.applicationId === target.applicationId))).map(({id,version,title,path}) => ({id,version,title,path:`${path}${path?.includes('?')?'&':'?'}version=${version}&returnTo=%2Fneeds-you%2F`}));
  const ordered = [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
  const planned = new Map();
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = plannerDay(windowStart, i), completedMinutes = spent.get(date) || 0;
    const available = date < today ? 0 : Math.max(0, dailyMinutes - completedMinutes);
    const interviewPicks = allocate(ordered, available, date, planned);
    const picks = [...interviewPicks,...allocate(learning,available-interviewPicks.reduce((sum,p)=>sum+p.minutes,0),date,planned)];
    const items = picks.map(({ group, targets, minutes }) => {
      const remaining = Math.max(...targets.map(t => t.remaining - (planned.get(targetKey(t)) || 0)));
      for (const target of targets) planned.set(targetKey(target), Math.min(target.remaining, (planned.get(targetKey(target)) || 0) + minutes));
      return { learning:Boolean(group.learning), artifacts:[...new Map(targets.flatMap(references).map(a=>[a.id,a])).values()], needsMaterial:group.learning || group.key.startsWith('practice:'), id: `${date}:${group.key}`, title: group.title, detail: group.detail, shared: group.shared, minutes, remainingAfter: Math.max(0, remaining - minutes), targets, reason: group.learning ? `Learning goal: ${targets[0].company} · target ${targets[0].deadline}` : `${targets.length > 1 ? `Covers ${targets.length} interviews` : `For ${targets[0].company}`} · earliest round ${targets.map(t => t.deadline).sort()[0]}` };
    });
    return { date, completedMinutes, plannedMinutes: items.reduce((sum, item) => sum + item.minutes, 0), items, events: events.filter(e => e.date === date).sort((a,b)=>a.id.localeCompare(b.id)), interviews: interviews.filter(i => i.date === date) };
  });
  const unscheduled = [...ordered,...learning].flatMap(g => g.targets).filter(t => (planned.get(targetKey(t)) || 0) < t.remaining).length;
  for (const group of [...ordered,...learning]) for (const target of group.targets) if ((planned.get(targetKey(target)) || 0) < target.remaining) pending.push({id:`unallocated:${targetKey(target)}`,title:group.title,company:target.company,date:target.deadline,applicationId:target.jobId,roundId:target.roundId,path:target.goalId?'/career-toolkit/':undefined,reason:'Outside daily budget'});
  return { today, dailyMinutes, days, interviews, pending, unscheduled, dormantCount: dormant.length, uncertainCount: uncertain.length, expiredCount: expired.length };
}

// Guest and demo mutations mirror the atomic owned RPC's version/credit rules.
export function recordLocalPreparationSession(bundle, { sessionId, minutes, targets }, now = new Date().toISOString()) {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240 || !Array.isArray(targets) || !targets.length || targets.length > 100) throw Error('Choose a valid preparation session.');
  const prior = (bundle.sessions || []).find(s => s.id === sessionId);
  const cleanTargets = targets.map(({ applicationId, goalId, taskId, expectedVersion }) => ({ ...(goalId ? {goalId} : {applicationId}), taskId, expectedVersion }));
  if (prior) {
    if (prior.minutes !== minutes || JSON.stringify(prior.targets) !== JSON.stringify(cleanTargets)) throw Error('Session ID already used.');
    return bundle;
  }
  const today = plannerToday(now, bundle.timeZone || 'UTC');
  const spent = (bundle.sessions || []).filter(s => plannerToday(s.completed_at, bundle.timeZone || 'UTC') === today).reduce((sum, s) => sum + s.minutes, 0);
  if (spent + minutes > (bundle.settings?.dailyMinutes ?? 45)) throw Error('This session exceeds your remaining daily budget.');
  const unique = new Set();
  const next = structuredClone(bundle);
  const changed = new Set();
  for (const target of cleanTargets) {
    if (unique.has(targetKey(target))) throw Error('Duplicate session task.');
    unique.add(targetKey(target));
    if (!!target.goalId === !!target.applicationId) throw Error('Choose one owned target.');
    const row = target.goalId ? (next.learningGoals || []).find(r=>r.id===target.goalId) : next.plans.find(r => r.application_id === target.applicationId);
    if (!row || row.version !== target.expectedVersion) throw Error('Preparation changed. Reload before saving.');
    if (target.goalId && !row.goal.active) throw Error('Preparation changed. Reload before saving.');
    const task = (target.goalId ? row.goal : row.plan).tasks.find(t => t.id === target.taskId);
    if (!task || task.completed) throw Error('Preparation task changed. Reload before saving.');
    const credit = (bundle.sessions || []).filter(s => s.targets.some(t => targetKey(t) === targetKey(target))).reduce((sum, s) => sum + s.minutes, 0);
    if (credit + minutes >= task.minutes) { task.completed = true; task.completedAt = now; }
    changed.add(row);
  }
  for (const row of changed) row.version++;
  next.sessions = [...(next.sessions || []), { id: sessionId, minutes, targets: cleanTargets, completed_at: now }];
  return next;
}
