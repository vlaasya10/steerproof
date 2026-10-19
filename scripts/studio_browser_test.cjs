// Production frontend regression test; backend replies are intercepted, never real processing jobs.
const {chromium}=require('../render-service/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=(process.env.BASE_URL||'http://localhost:3030').replace(/\/$/,'');
const pdf=path.join(__dirname,'../demo/papers/hall-kahan-2018.pdf');
const payload=fs.readFileSync(pdf);
const cors={'Access-Control-Allow-Origin':base,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'content-type, authorization'};
async function main(){
 const browser=await chromium.launch({headless:true});
 try{
  for(const mobile of [false,true])for(const mode of ['api','offline','checking','full','protected-full']){
   const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
   let capability;const operations=[];const privateReads=[];
   await ctx.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.pathname==='/api/public/capabilities'){
     assert.equal(request.headers().authorization,undefined);
     if(mode==='checking'){capability=route;return;}
     if(mode==='offline')return route.abort();
     return route.fulfill({headers:cors,contentType:'application/json',body:JSON.stringify({mode:mode==='api'?'api':'full',processingEnabled:mode!=='api',authenticationRequired:mode==='protected-full'})});
    }
    if(url.pathname==='/api/papers'){
     if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
     if(request.method()==='GET'){privateReads.push(url.pathname);return route.fulfill({status:401,headers:cors,body:'{}'});}
     operations.push(request.postDataBuffer());
     return route.fulfill({status:400,headers:cors,contentType:'application/json',body:JSON.stringify({error:'TEST_CAPTURE',message:'Test intercepted upload; no paper was created.'})});
    }
    if(url.origin!==new URL(base).origin)return route.abort();
    return route.continue();
   });
   const page=await ctx.newPage();
   await page.goto(base+'/papers');
   await page.getByRole('heading',{name:'Clinical metabolic evidence, verified.'}).waitFor();
   assert.equal(await page.locator('input[type=password]').count(),0);
   assert.equal(await page.getByLabel('Optional Editorial Theme').count(),1);
   assert.equal(await page.getByLabel('Or paste PDF URL').count(),1);
   assert.equal(await page.getByRole('button',{name:'Sample: Hall & Kahan (2018)',exact:true}).count(),1);
   assert.equal(await page.getByRole('link',{name:'Papers',exact:true}).getAttribute('href'),'/papers');
   assert.equal(await page.getByRole('link',{name:'Public Showcase',exact:true}).getAttribute('href'),'/');
   const drop=page.getByRole('button',{name:'Choose or drop a clinical PDF'});
   if(mode==='full'){
    await page.waitForFunction(()=>!document.querySelector('#file-upload').disabled);
    assert.equal(await page.getByTestId('studio-disclaimer').count(),0);
    await page.getByLabel('Optional Editorial Theme').fill('Source-linked test theme');
    const chooserPromise=page.waitForEvent('filechooser');await drop.click();await (await chooserPromise).setFiles(pdf);
    await page.getByRole('alert').filter({hasText:'Test intercepted upload'}).waitFor();
    // Chromium's intercepted postData omits binary file bytes; verify the actual
    // selected File plus multipart filename/type and scalar fields instead.
    assert.equal(operations.length,1);assert.ok(operations[0].includes(Buffer.from('filename="hall-kahan-2018.pdf"')));assert.ok(operations[0].includes(Buffer.from('Content-Type: application/pdf')));assert.ok(operations[0].includes(Buffer.from('Source-linked test theme')));
    assert.equal(await page.locator('#file-upload').evaluate(input=>input.files[0].size),payload.length);
    await page.getByRole('button',{name:'Sample: Hall & Kahan (2018)',exact:true}).click();
    assert.equal(await page.getByLabel('Or paste PDF URL').inputValue(),'https://doi.org/10.1016/j.mcna.2017.08.012');
    assert.equal(await page.getByLabel('Optional Editorial Theme').inputValue(),'Weight regain biology & metabolic adaptation');
    const urlResponse=page.waitForResponse(r=>r.url().endsWith('/api/papers')&&r.request().method()==='POST');
    await page.getByRole('button',{name:'Fetch',exact:true}).click();await urlResponse;
    await page.waitForFunction(()=>!document.querySelector('button[type=submit]').disabled);
    assert.equal(operations.length,2);assert.ok(operations[1].includes(Buffer.from('https://doi.org/10.1016/j.mcna.2017.08.012')));
    const dropResponse=page.waitForResponse(r=>r.url().endsWith('/api/papers')&&r.request().method()==='POST');
    const droppedSize=await drop.evaluate((element,base64)=>{const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));const transfer=new DataTransfer();transfer.items.add(new File([bytes],'hall-kahan-2018.pdf',{type:'application/pdf'}));element.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));return transfer.files[0].size;},payload.toString('base64'));await dropResponse;
    await page.waitForFunction(()=>!document.querySelector('#file-upload').disabled);
    assert.equal(operations.length,3);assert.equal(droppedSize,payload.length);assert.ok(operations[2].includes(Buffer.from('filename="hall-kahan-2018.pdf"')));
   }else{
    if(mode!=='checking')await page.getByTestId('studio-disclaimer').waitFor();
    assert.equal(await page.locator('#file-upload').isDisabled(),true);
    assert.equal(await drop.getAttribute('aria-disabled'),'true');
    await page.getByLabel('Or paste PDF URL').fill('https://doi.org/10.1016/j.mcna.2017.08.012');
    assert.equal(await page.getByRole('button',{name:'Fetch',exact:true}).isDisabled(),true);
    assert.equal(await page.getByRole('button',{name:'Sample: Hall & Kahan (2018)',exact:true}).isDisabled(),true);
    await page.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    await drop.evaluate(element=>{const transfer=new DataTransfer();transfer.items.add(new File(['%PDF-disabled'],'disabled.pdf',{type:'application/pdf'}));element.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));});
    assert.equal(operations.length,0);
    if(mode==='api'){
     await page.getByRole('heading',{name:'Live processing is unavailable in this deployment',exact:true}).waitFor();
     const upload=await page.getByTestId('studio-upload').boundingBox(),notice=await page.getByTestId('studio-disclaimer').boundingBox();assert.ok(notice.y>=upload.y+upload.height);
     assert.equal(await page.getByRole('link',{name:'Explore Completed Examples →',exact:true}).getAttribute('href'),'/#examples');
     await page.screenshot({path:path.join(__dirname,`../docs/screenshots/studio-api-${mobile?'mobile':'desktop'}.png`),fullPage:true});
    }
   }
   assert.deepEqual(privateReads,[],'Public Studio fetched private records');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'Mobile layout overflows');
   if(capability)await capability.fulfill({headers:cors,contentType:'application/json',body:'{"mode":"api","processingEnabled":false,"authenticationRequired":true}'});
   await page.reload();await page.getByRole('heading',{name:'Clinical metabolic evidence, verified.'}).waitFor();
   assert.equal(await page.locator('input[type=password]').count(),0);
   // Release a deferred capability request on refresh before closing the context.
   if(mode==='checking'&&capability)await capability.fulfill({headers:cors,contentType:'application/json',body:'{"mode":"api","processingEnabled":false,"authenticationRequired":true}'}).catch(()=>{});
   await page.getByRole('link',{name:'Public Showcase',exact:true}).click();await page.waitForURL(base+'/');
   assert.equal(await page.getByTestId('case-card').count(),3);
   await page.getByRole('link',{name:'Papers',exact:true}).click();await page.waitForURL(base+'/papers');
   assert.equal(await page.locator('input[type=password]').count(),0);
   await ctx.close();console.log(`${mobile?'Mobile':'Desktop'} ${mode}: original Studio, capability safety, navigation and refresh passed`);
  }
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
