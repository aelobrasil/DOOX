-- Keep the database publish guard aligned with the four-hour Community expiry.
alter table public.hm_community_messages
  drop constraint if exists hm_community_publish_guard;

update public.hm_community_messages
set expires_at = published_at + interval '4 hours'
where published_at is not null
  and expires_at is not null
  and review = 'approved'
  and payment = 'confirmed';

alter table public.hm_community_messages
  add constraint hm_community_publish_guard
  check (
    (published_at is null and expires_at is null)
    or (
      review = 'approved'
      and payment = 'confirmed'
      and published_at is not null
      and expires_at = published_at + interval '4 hours'
    )
  );
