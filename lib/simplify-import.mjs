// Simplify's tracked-jobs export. Pure parsing; never executes cells or fetches URLs.
export const simplifyColumns=['Job Title','Company Name','Location','Job URL','Applied Date','Status','Status Date','Archived','Date Archived','Notes','job_type'];
export const MAX_CSV_BYTES=200000;
export function parseCsv(text) {
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_CSV_BYTES)throw Error('Choose a CSV smaller than 200 KB.');
 text=text.replace(/^\uFEFF/,'');
 const rows=[];let row=[],cell='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
  if(c==='"'){if(cell||closed)throw Error('Invalid CSV quoting. Export a fresh CSV from Simplify.');quoted=true;}
  else if(c===','||c==='\n'||c==='\r'){row.push(cell);cell='';closed=false;if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(v=>v.trim()))rows.push(row);row=[];}}
  else{if(closed)throw Error('Unexpected text after a quoted CSV cell.');cell+=c;}
 }
 if(quoted)throw Error('The CSV ends inside a quoted cell. Export it again.');
 row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
 return rows;
}
const empty=v=>['','N/A'].includes(v.trim())?'':v.trim();
function date(v,line){v=empty(v);if(!v)return null;if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)throw Error(`Row ${line}: invalid date ${v}.`);return v;}
export function canonicalImportUrl(value){
 const text=empty(value);if(!text)return null;
 let url;try{url=new URL(text);}catch{throw Error('Job URL must be a complete HTTPS or HTTP address.');}
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error('Job URL must be an HTTPS or HTTP address without credentials.');
 for(const key of [...url.searchParams.keys()])if(/^utm_/i.test(key)||['ref','src','source'].includes(key.toLowerCase()))url.searchParams.delete(key);
 url.hash='';url.searchParams.sort();return url.href;
}
export function parseSimplifyCsv(text){
 const [headers,...raw]=parseCsv(text);if(!headers||headers.length!==new Set(headers).size||simplifyColumns.some(h=>!headers.includes(h)))throw Error('Use the tracked-jobs CSV exported by Simplify. Its expected columns are missing or repeated.');
 if(!raw.length||raw.length>500)throw Error('Choose an export containing 1–500 jobs.');
 const rows=raw.map((cells,i)=>{
  const line=i+2;if(cells.length!==headers.length)throw Error(`Row ${line}: column count does not match the header.`);
  const r=Object.fromEntries(headers.map((h,j)=>[h,cells[j]]));
  if(!empty(r['Company Name'])||!empty(r['Job Title']))throw Error(`Row ${line}: company and job title are required.`);
  if(!['SAVED','APPLIED'].includes(r.Status))throw Error(`Row ${line}: unsupported status ${r.Status}. Nothing has been saved.`);
  if(!['Internship','Full-time'].includes(r.job_type))throw Error(`Row ${line}: unsupported job type ${r.job_type}.`);
  if(!['Yes','No'].includes(r.Archived))throw Error(`Row ${line}: Archived must be Yes or No.`);
  let url;try{url=canonicalImportUrl(r['Job URL']);}catch(e){throw Error(`Row ${line}: ${e.message}`);}
  const row={company:empty(r['Company Name']),title:empty(r['Job Title']),location:empty(r.Location),url,status:r.Status,employmentType:r.job_type==='Full-time'?'FT':'Internship',appliedDate:date(r['Applied Date'],line),statusDate:date(r['Status Date'],line),archived:r.Archived==='Yes',archivedDate:date(r['Date Archived'],line),notes:empty(r.Notes)};
  if(row.company.length>300||row.title.length>500||row.location.length>500||(url?.length||0)>2048||row.notes.length>10000)throw Error(`Row ${line}: a field exceeds the import limit.`);
  return row;
 });
 return {rows,total:rows.length,applied:rows.filter(r=>r.status==='APPLIED').length,saved:rows.filter(r=>r.status==='SAVED').length,missingUrls:rows.filter(r=>!r.url).length};
}
export function importedApplication(row){
 const r=row.record;
 return {id:`import:${row.id}`,company:r.company,title:r.title,location:r.location,employmentType:r.employmentType,url:r.url||'',applicationUrl:r.url||'',status:r.status==='APPLIED'?'Submitted':'New',questions:[],imported:row,archived:r.archived,trackerItem:{appliedDate:r.appliedDate,openedDate:null},activity:r.status==='APPLIED'?[{text:'You reported Submitted: imported from Simplify',actor:'user',at:r.appliedDate}]:[]};
}
