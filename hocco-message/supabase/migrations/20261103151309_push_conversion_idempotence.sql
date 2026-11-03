create or replace function public.hm_push_conversion() returns trigger language plpgsql security invoker set search_path='' as $$
declare d public.hm_push_devices;
begin
 if new.payment='confirmed' and old.payment is distinct from 'confirmed' then
  update public.hm_push_devices set origin='participant' where source_code=new.code;
  for d in update public.hm_push_devices set conversion_count=conversion_count+1,last_conversion_at=now() where source_code=new.code and last_return_at>coalesce(last_conversion_at,'epoch'::timestamptz) and last_return_at>now()-interval '7 days' returning * loop
   insert into public.hm_reactivation_events(phone_hash,event,variant) values(d.device_hash,'converted','push');
  end loop;
 end if;return new;
end $$;
revoke all on function public.hm_push_conversion() from public,anon,authenticated;
