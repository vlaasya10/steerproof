// Run against a production frontend: BASE_URL=http://localhost:3030 node scripts/showcase_browser_test.cjs
const {chromium}=require('../render-service/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=(process.env.BASE_URL||'http://localhost:3030').replace(/\/$/,'');
const cases=JSON.parse(fs.readFileSync(path.join(__dirname,'../frontend/showcase/generated/cases.json'),'utf8'));
const shots=path.join(__dirname,'../docs/screenshots');
async function main(){
  fs.mkdirSync(shots,{recursive:true});
  const browser=await chromium.launch({headless:true});
  try{
    for(const mobile of [false,true]){
      const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
      await context.addInitScript(()=>{
        // Public exploration must not even read browser storage when access is denied.
        for(const key of ['localStorage','sessionStorage'])Object.defineProperty(window,key,{get(){throw new DOMException('Browser storage disabled','SecurityError');}});
      });
      // Fresh incognito-style context. Block every processing/private backend request.
      const unexpected=[];const errors=[];
      await context.route('**/*',route=>{const u=new URL(route.request().url());assert.equal(route.request().headers().authorization,undefined,'Public requests must not attach a bearer token');if(u.origin!==new URL(base).origin){unexpected.push(u.origin);return route.abort();}return route.continue();});
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
      const protocol=await context.newCDPSession(page);
      await protocol.send('Emulation.setDocumentCookieDisabled',{disabled:true});
      assert.equal((await page.goto(base)).status(),200);
      await page.getByRole('heading',{name:'From Research Papers to Evidence-Linked Instagram Content',exact:true}).waitFor();
      await page.getByRole('heading',{name:'Explore Three Completed Research Examples',exact:true}).waitFor();
      assert.equal(await page.getByTestId('case-card').count(),3);
      assert.equal(await page.locator('a[href="/workspace"], a[href^="/papers/"]').count(),0,'Public pages must not advertise a workspace login');
      assert.equal(await page.evaluate(()=>document.cookie),'');
      assert.equal(await page.locator('input[type=password]').count(),0);
      assert.equal(await page.locator('input[type=file]').count(),0,'Public API-only showcase must not offer a failing upload');
      assert.equal(await page.getByText('Workspace password',{exact:true}).count(),0);
      assert.equal(await page.getByText('Explore completed research-to-content examples with source-linked claims and generated media. Live processing is not available in this hosted demonstration.',{exact:true}).isVisible(),true);
      await page.screenshot({path:path.join(shots,`showcase-home-${mobile?'mobile':'desktop'}.png`),fullPage:true});
      const listing=await context.request.get(base+'/api/showcase');assert.equal(listing.status(),200);assert.equal((await listing.json()).length,3);
      for(const method of ['POST','PATCH','DELETE','PUT'])assert.equal((await context.request.fetch(base+'/api/showcase',{method,data:{}})).status(),405);
      for(const item of cases){
        const url=base+'/showcase/'+item.slug;
        await page.goto(base);
        const card=page.getByTestId('case-card').filter({hasText:item.paper.title});
        assert.equal(await card.count(),1);
        assert.equal(await card.getByRole('link',{name:'Explore Example',exact:true}).getAttribute('href'),'/showcase/'+item.slug);
        await card.getByRole('link',{name:'Explore Example',exact:true}).click();
        await page.waitForURL(url);
        assert.equal(new URL(page.url()).pathname,'/showcase/'+item.slug);
        assert.equal((await page.goto(url)).status(),200);
        assert.equal((await page.reload()).status(),200);
        assert.equal(await page.locator('input[type=password]').count(),0);
        assert.equal(await page.locator('a[href="/workspace"], a[href^="/papers/"]').count(),0);
        for(const label of ['Extracted claims','Risk & applicability','First review','Final review','Export']){
          await page.getByRole('button',{name:new RegExp(label)}).click();
          await page.getByRole('heading',{name:label,exact:true}).waitFor();
        }
        const download=await context.request.get(base+item.downloads[0].url);assert.equal(download.status(),200);assert.equal((await download.body()).subarray(0,2).toString(),'PK');
        await page.getByRole('button',{name:/Generated content/}).click();
        await page.getByRole('button',{name:'Next carousel image',exact:true}).click();
        await page.waitForFunction(()=>Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0),null,{timeout:30000});
        assert.equal(await page.locator('img').evaluateAll(images=>images.every(i=>i.complete&&i.naturalWidth>0)),true);
        await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&v.readyState>=1;},null,{timeout:60000});
        const media=await page.locator('video').evaluate(async v=>{v.muted=true;await v.play();return {duration:v.duration,tracks:v.textTracks.length};});
        assert.ok(media.duration>10);assert.equal(media.tracks,1);
        await page.waitForFunction(()=>document.querySelector('video').currentTime>0.25);
        await page.locator('video').evaluate(v=>v.pause());
        const reel=item.assets.find(a=>a.type==='REEL');const subs=await context.request.get(base+reel.subtitleUrl);assert.equal(subs.status(),200);assert.ok((await subs.text()).startsWith('WEBVTT'));
        const claim=item.claims.find(c=>c.claimId===item.summaryClaimId);
        const evidence=base+'/showcase/'+item.slug+'/evidence/'+claim.claimId;
        assert.equal((await page.goto(evidence)).status(),200);await page.reload();
        await page.getByRole('heading',{name:'Follow the evidence.'}).waitFor();
        assert.equal(await page.locator('a[href="/workspace"], a[href^="/papers/"]').count(),0);
        assert.equal(await page.locator('[aria-label="Original Docling passage bounding box"]').count(),1);
        assert.ok((await page.locator('blockquote').innerText()).includes(claim.quote));
        if(item===cases[0])await page.screenshot({path:path.join(shots,`showcase-evidence-${mobile?'mobile':'desktop'}.png`),fullPage:true});
        for(const method of ['POST','PATCH','DELETE','PUT'])assert.equal((await context.request.fetch(base+'/api/showcase/'+item.slug,{method,data:{doctorStatus:'APPROVED'}})).status(),405);
        assert.equal((await context.request.get(base+'/api/showcase/'+item.slug)).status(),200);
      }
      assert.equal((await context.request.get(base+'/showcase/not-a-case')).status(),404);
      assert.equal((await context.request.get(base+'/api/showcase/not-a-case')).status(),404);
      assert.equal(unexpected.length,0,'Public routes requested a backend/external dependency');
      assert.deepEqual(errors,[]);
      // Simulate the protected API response to verify private guards remain scoped.
      await context.unroute('**/*');
      await context.route('**/api/auth/config',r=>r.fulfill({status:r.request().method()==='OPTIONS'?204:200,contentType:'application/json',body:r.request().method()==='OPTIONS'?'':'{"enabled":true}',headers:{'Access-Control-Allow-Origin':base,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'content-type, authorization'}}));
      await page.goto(base+'/workspace');await page.locator('input[type=password]').waitFor();
      await page.goto(base+'/papers/P-0003');await page.locator('input[type=password]').waitFor();
      await page.goto(base);assert.equal(await page.locator('input[type=password]').count(),0);
      await context.close();console.log((mobile?'Mobile':'Desktop')+': cookies/storage disabled; no public workspace entry or bearer headers; anonymous routes, refresh, 3 cases, media playback, evidence, downloads, mutation rejection and private guard passed');
    }
    // Normal first-time visitors and returning browsers with stale private sessions.
    for(const returning of [false,true]){
      const context=await browser.newContext();
      await context.addInitScript(stale=>{
        localStorage.clear();sessionStorage.clear();
        if(stale)sessionStorage.setItem('steerproof_workspace_session',JSON.stringify({token:'invalid-returning-session',mediaToken:'invalid-returning-media',expiresAt:'2100-01-01T00:00:00Z'}));
      },returning);
      const requests=[];
      await context.route('**/*',route=>{
        assert.equal(route.request().headers().authorization,undefined);
        const u=new URL(route.request().url());
        if(u.origin!==new URL(base).origin){requests.push(u.origin);return route.abort();}
        return route.continue();
      });
      const page=await context.newPage();
      const response=await page.goto(base);assert.equal(response.status(),200);assert.equal(response.headers()['www-authenticate'],undefined);
      for(const item of cases){await page.goto(base+'/showcase/'+item.slug);await page.reload();assert.equal(await page.locator('input[type=password]').count(),0);}
      assert.deepEqual(requests,[]);await context.close();
      console.log((returning?'Returning browser with stale private session':'First-time browser with empty storage')+': public navigation and refresh passed without authentication');
    }
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
