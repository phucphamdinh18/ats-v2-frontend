-- READ ONLY. Run as separate statements if the query client returns only its first result.
select table_name
from information_schema.tables
where table_schema='public'
  and table_name in ('recruitment_tasks','recruitment_task_events','offer_proposals','offer_approver_grants','offer_mail_outbox')
order by table_name;

select p.proname,pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
 ('list_my_recruitment_tasks','get_recruitment_task_detail','reassign_recruitment_task','complete_recruitment_task','read_offer_workflow','get_offer_workflow_setup')
order by p.proname;
