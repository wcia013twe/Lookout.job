#!/usr/bin/env node
// Private prospective normalization only; N01 source files remain untouched.
import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {read,write,digest} from './core.mjs';
const [manifest,candidate,out]=process.argv.slice(2);if(!manifest||!candidate||!out||fs.existsSync(out))throw Error('New private candidate pack required');
const original=read(manifest),normalized=structuredClone(original),pdf=path.join(candidate,'resume.pdf'),text=execFileSync('pdftotext',['-layout',pdf,'-'],{encoding:'utf8'});
const name=text.split('\n').map(x=>x.trim()).find(Boolean),email=text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
if(!name||!email||name.length>100||!/^\p{L}[\p{L} .'-]+$/u.test(name))throw Error('Resume identity extraction requires manual review');
const facts=normalized.settings.profile.facts,old={name:facts.name,email:facts.email};facts.name=name;facts.email=email;
fs.mkdirSync(out,{recursive:true,mode:0o700});fs.mkdirSync(out+'/candidate',{mode:0o700});fs.copyFileSync(pdf,out+'/candidate/resume.pdf');
let profile=fs.readFileSync(candidate+'/profile.md','utf8');for(const key of ['name','email']){const before=`My ${key} is ${old[key]}.`,after=`My ${key} is ${facts[key]}.`;if(!profile.includes(before))throw Error('Readable profile normalization anchor missing');profile=profile.replaceAll(before,after);}
fs.writeFileSync(out+'/candidate/profile.md',profile,{mode:0o600});write(out+'/context.private.json',normalized);
write(out+'/identity.private.json',{name,email});write(out+'/provenance.private.json',{status:'normalized_from_supplied_resume',originalManifestHash:digest(manifest),originalProfileHash:digest(candidate+'/profile.md'),resumeHash:digest(pdf),normalizedManifestHash:digest(out+'/context.private.json'),normalizedProfileHash:digest(out+'/candidate/profile.md'),fields:['name','email'],originalsUntouched:true});
console.log(JSON.stringify({status:'prepared',originalsUntouched:true,privateOutput:out}));
