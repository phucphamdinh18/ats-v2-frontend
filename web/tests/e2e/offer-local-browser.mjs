// Browser -> real local GoTrue/JWT -> Edge -> disposable PostgreSQL. No Gmail.
const {chromium}=await import(process.env.ATS_E2E_PLAYWRIGHT_MODULE||'playwright');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const base=process.env.ATS_BASE_URL||'http://127.0.0.1:3000';assert.equal(base,'http://127.0.0.1:3000');
const fixture=JSON.parse(await fs.readFile(process.env.ATS_OFFER_BROWSER_FIXTURE,'utf8'));
assert.match(fixture.dh_email,/@example\.invalid$/);
const artifacts=process.env.ATS_E2E_ARTIFACT_DIR||'/tmp/ats-browser-e2e';await fs.mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true});const contexts=[];const errors=[];
async function login(email){assert.match(email,/@example\.invalid$/);const context=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(context);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base,{waitUntil:'networkidle'});await page.getByRole('button',{name:'Mở đăng nhập thử nghiệm cục bộ'}).click();await page.getByLabel('Email thử nghiệm').fill(email);await page.getByLabel('Mật khẩu thử nghiệm').fill('LocalTestOnly-2026-ATS!');await page.getByRole('button',{name:'Đăng nhập thử',exact:true}).click();await page.waitForFunction(email=>Object.keys(localStorage).some(k=>k.startsWith('sb-')&&localStorage.getItem(k)?.includes(email)),email,{timeout:20000});return page;}
let ta,dh;
try{
 ta=await login('ta-e2e@example.invalid');await ta.goto(base+'/offer-approval/',{waitUntil:'networkidle'});
 await ta.getByRole('combobox',{name:'Job',exact:true}).selectOption({label:'TEST-OFFER-HTTP · '+fixture.job_title});
 await ta.getByRole('option',{name:fixture.candidate_name,exact:true}).waitFor({state:'attached',timeout:15000});
 await ta.getByRole('combobox',{name:'Ứng viên đang ở vòng Phỏng vấn'}).selectOption({label:fixture.candidate_name});
 for(const [label,value] of [['Level','L6'],['Bộ phận','TEST ONLY Department'],['Function','Engineering'],['Mức lương','60000000'],['Ngày dự kiến onboard','2026-12-01']])await ta.getByLabel(label,{exact:true}).fill(value);
 await ta.getByLabel('Lý do đề xuất / Ghi chú').fill('TEST ONLY Offer browser approval');
 const saved=ta.waitForResponse(r=>r.url().endsWith('/functions/v1/offer-workflow')&&r.request().postDataJSON()?.action==='draft');
 await ta.getByRole('button',{name:'Lưu nháp',exact:true}).click();const saveResponse=await saved;assert.equal(saveResponse.status(),200);const offerId=(await saveResponse.json()).result.offer_id;
 await ta.getByRole('button',{name:'Gửi đề xuất cho người duyệt'}).waitFor({state:'visible',timeout:15000});
 await ta.getByRole('combobox',{name:'Người duyệt DH / CEO'}).selectOption({label:'dh-offer-e2e'});
 await ta.getByRole('combobox',{name:'Mẫu Offer Letter'}).selectOption({label:fixture.template_name+' · v1'});
 await ta.getByRole('button',{name:'Gửi đề xuất cho người duyệt'}).click();
 await ta.getByText('Chờ duyệt',{exact:true}).first().waitFor({state:'visible'});
 await ta.screenshot({path:path.join(artifacts,'offer-ta-submitted.png'),fullPage:true});
 const hm=await login('hm-e2e@example.invalid');await hm.goto(base+'/offer-approval/?offer='+offerId,{waitUntil:'networkidle'});
 await hm.getByRole('button',{name:'Đăng nhập bằng Google'}).waitFor({state:'visible',timeout:15000});assert.equal(await hm.getByRole('button',{name:'Phê duyệt',exact:true}).count(),0,'Unassigned HM must not approve');
 dh=await login(fixture.dh_email);await dh.goto(base+'/offer-approval/?offer='+offerId,{waitUntil:'networkidle'});
 await dh.getByRole('button',{name:'Phê duyệt',exact:true}).waitFor({state:'visible',timeout:15000});
 assert.equal(await dh.getByRole('heading',{name:'Tạo Offer Proposal'}).count(),0,'Role-less DH must not get recruiter forms');
 await dh.getByLabel('Nhận xét; bắt buộc khi từ chối').fill('TEST ONLY approved by DH browser');
 const decisions=[];let drop=true;
 await dh.route('**/functions/v1/offer-workflow',async route=>{const body=route.request().postDataJSON();if(body.action==='decide'){decisions.push(body);if(drop){drop=false;const response=await route.fetch();assert.equal(response.status(),200);await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'TEST ONLY response lost after commit'})});return;}}await route.continue();});
 await dh.getByRole('button',{name:'Phê duyệt',exact:true}).click();
 await dh.getByRole('button',{name:'Thử lại đúng yêu cầu'}).waitFor({state:'visible',timeout:15000});assert.equal(await dh.getByRole('button',{name:'Phê duyệt',exact:true}).isDisabled(),true);
 await dh.getByRole('button',{name:'Thử lại đúng yêu cầu'}).click();await dh.getByText('Đã duyệt nội bộ',{exact:true}).first().waitFor({state:'visible',timeout:15000});
 assert.equal(decisions.length,2);assert.deepEqual(decisions[0],decisions[1],'Retry must retain the exact request ID and payload');
 await dh.screenshot({path:path.join(artifacts,'offer-dh-approved.png'),fullPage:true});
 await ta.getByRole('button',{name:'Tải lại danh sách',exact:true}).click();await ta.getByText('Đã duyệt nội bộ',{exact:true}).first().waitFor({state:'visible',timeout:15000});
 const scope=ta.getByRole('complementary');await scope.getByText('Offer Letter cho ứng viên',{exact:true}).waitFor({state:'visible',timeout:15000});assert.equal(await scope.getByText('Offer Letter cho ứng viên',{exact:true}).count(),1,'There must be exactly one candidate letter task');
 assert.equal(await scope.getByText('Ứng viên đồng ý',{exact:true}).count(),0,'DH approval is not candidate acceptance');
 assert.deepEqual(errors,[]);
 console.log('Offer browser E2E PASS: TA draft/submit; unassigned HM denied; role-less DH approval; lost-response exact retry; one letter task. No email sent.');
}catch(e){for(const [name,page] of [['offer-ta-failure',ta],['offer-dh-failure',dh]])if(page){console.error(name+': '+(await page.locator('body').innerText().catch(()=>'' )).slice(0,7000));await page.screenshot({path:path.join(artifacts,name+'.png'),fullPage:true}).catch(()=>{});}throw e;
}finally{await Promise.all(contexts.map(c=>c.close()));await browser.close();}
