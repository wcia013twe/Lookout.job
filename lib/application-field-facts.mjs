// Shared by direct draft filling and final server-side submission authorization.
export const normalizeApplicationQuestion=value=>String(value||'').trim().replace(/\s+/g,' ').toLowerCase().replace(/[ *:]+$/g,'');
export const APPLICATION_FACT_LABELS={
 name:['name','full name','legal name'],firstName:['first name'],lastName:['last name'],
 email:['email','email address'],phone:['phone','phone number'],location:['location','current location','city'],
 linkedin:['linkedin','linkedin profile','linkedin profile url'],portfolio:['website','portfolio','portfolio url'],
 github:['github','github profile','github profile url','github url'],
};
export const RESUME_QUESTION_LABELS=['resume','resume/cv','resume / cv','cv','upload resume','attach resume'];
