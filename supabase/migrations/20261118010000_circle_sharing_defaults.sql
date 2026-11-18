-- New Circle memberships start with both link-sharing permissions enabled.
-- Existing membership choices and the rejoin reset are unchanged.
alter table private.circle_members alter column allowed_types set default array['resource','opportunity']::text[];
