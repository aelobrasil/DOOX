-- Harden community social profile links: only canonical Instagram/TikTok profiles.
alter table public.hm_community_messages
  drop constraint if exists hm_community_messages_social_url_https_check;

alter table public.hm_community_messages
  add constraint hm_community_messages_social_url_https_check
  check (
    social_url is null
    or social_url ~ '^https://www[.]instagram[.]com/[A-Za-z0-9_]([A-Za-z0-9._]{0,28}[A-Za-z0-9_])?/$'
    or social_url ~ '^https://www[.]tiktok[.]com/@[A-Za-z0-9_]([A-Za-z0-9._]{0,22}[A-Za-z0-9_])?/$'
  );
