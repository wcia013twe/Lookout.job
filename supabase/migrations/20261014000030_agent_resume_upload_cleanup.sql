-- Upload bookkeeping must not prevent the owner removing an unused resume.
-- Deleting a resume clears only its completed reservations; storage deletion
-- remains the existing owner's explicit Storage API operation.
alter table private.agent_resume_uploads drop constraint agent_resume_uploads_user_id_resume_id_fkey;
alter table private.agent_resume_uploads add constraint agent_resume_uploads_user_id_resume_id_fkey
  foreign key(user_id,resume_id) references public.resumes(user_id,id) on delete cascade;
