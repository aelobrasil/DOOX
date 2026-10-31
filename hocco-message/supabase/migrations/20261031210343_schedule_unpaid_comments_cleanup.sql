select cron.schedule('hocco-expire-unpaid-comments','* * * * *','select public.hm_expire_unpaid_comments()');

select public.hm_expire_unpaid_comments();
