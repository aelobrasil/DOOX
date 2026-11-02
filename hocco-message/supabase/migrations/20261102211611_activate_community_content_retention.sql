select cron.alter_job((select jobid from cron.job where jobname='hocco-community-content-retention'),active:=true);
