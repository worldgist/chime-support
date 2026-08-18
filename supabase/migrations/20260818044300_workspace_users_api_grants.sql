grant select, insert, update, delete on public.workspace_users to authenticated;
grant all on public.workspace_users to service_role;

notify pgrst, 'reload schema';
