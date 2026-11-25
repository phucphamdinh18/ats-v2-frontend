import test from 'node:test';
import assert from 'node:assert/strict';
import {buildHomeTasks,jobRecruitingOwner} from '../lib/home-model';
import type {JobRecruiter} from '../lib/admin-jobs';
const team:JobRecruiter[]=[{job_id:'j',user_id:'s',email:'s@test.invalid',display_name:'Linh',ta_assignment:'SUPPORT'}, {job_id:'j',user_id:'p',email:'p@test.invalid',display_name:'Phuc',ta_assignment:'PRIMARY'}, {job_id:'other',user_id:'x',email:'x@test.invalid',display_name:'Other',ta_assignment:'PRIMARY'}];
test('Job reminders show named primary and support TAs without selecting another Job',()=>{
 const owner=jobRecruitingOwner('j',team,true);assert.equal(owner.owner,'Phuc (Primary TA); Linh (Support TA)');
 assert.match(jobRecruitingOwner('j',undefined,true).owner,/Could not load TA assignment/);
 assert.match(jobRecruitingOwner('j',[],true).owner,/No TA assigned/);
 assert.match(jobRecruitingOwner('j',[{...team[0],ta_assignment:null,display_name:null}],true).owner,/s@test.invalid.*Not classified/);
 const rows=buildHomeTasks({perspective:'ADMIN',userId:'me',userName:'An',jobs:[{id:'j',title:'Engineer',job_code:null,status:'DRAFT',metrics:{new_count:1} as never}],tasks:[{id:'t',title:'Own task',job_id:'j',status:'OPEN',priority:'NORMAL',due_at:null,application_id:null,candidate_id:null,created_at:'',completed_at:null}],interviews:[],offers:[],en:true,recruiters:team});
 assert.equal(rows.find(r=>r.id==='task-t')?.owner,'An');
 assert.equal(rows.find(r=>r.id==='applications-j')?.owner,owner.owner);
 assert.equal(rows.find(r=>r.id==='job-j')?.owner,owner.owner);
});
