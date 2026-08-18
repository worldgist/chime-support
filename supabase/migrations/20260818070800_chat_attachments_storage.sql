insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  true,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'application/zip'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read chat attachments" on storage.objects;
create policy "Public can read chat attachments"
  on storage.objects
  for select
  to public
  using (bucket_id = 'chat-attachments');

drop policy if exists "Chat can upload ticket attachments" on storage.objects;
create policy "Chat can upload ticket attachments"
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

drop policy if exists "Admins can update chat attachments" on storage.objects;
create policy "Admins can update chat attachments"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'chat-attachments' and public.is_admin())
  with check (bucket_id = 'chat-attachments' and public.is_admin());

drop policy if exists "Admins can delete chat attachments" on storage.objects;
create policy "Admins can delete chat attachments"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'chat-attachments' and public.is_admin());

create or replace function public.touch_support_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_tickets
  set
    last_message = left(
      coalesce(
        nullif(new.body, ''),
        new.attachments #>> '{0,name}',
        'Attachment'
      ),
      180
    ),
    last_activity_at = new.created_at,
    unread = case
      when new.sender = 'user' then unread + 1
      when new.sender = 'support' then 0
      else unread
    end,
    status = case
      when new.sender = 'user' and status = 'resolved' then 'open'
      else status
    end,
    updated_at = now()
  where id = new.ticket_id;
  return new;
end;
$$;
