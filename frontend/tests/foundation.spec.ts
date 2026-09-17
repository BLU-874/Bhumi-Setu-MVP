import {test,expect} from '@playwright/test';
test('real backend workflow, evidence, persisted reload, and responsive layouts',async({page})=>{
 const errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/');
 await expect(page.getByText('Local demo storage')).toBeVisible();
 await expect(page.getByText('500',{exact:false}).first()).toBeVisible();
 const completion=page.waitForResponse(r=>r.url().endsWith('/api/runs')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Run harmonization'}).click();
 expect((await completion).status()).toBe(201);
 await expect(page.getByRole('button',{name:'Run harmonization'})).toBeEnabled();
 await expect(page.getByText('Latest run, explained')).toBeVisible({timeout:45000});
 await expect(page.locator('.error-banner')).toHaveCount(0);
 await page.reload();
 await expect(page.getByText('Latest run, explained')).toBeVisible();
 await page.screenshot({path:'../artifacts/dashboard-desktop.png',fullPage:true});
 await page.getByRole('link',{name:'Data sources',exact:true}).click();
 await expect(page.getByText('Different sources. Shared geography.')).toBeVisible();
 await expect(page.locator('.source-card')).toHaveCount(3);
 await expect(page.getByText('500 valid after processing')).toBeVisible();
 await page.screenshot({path:'../artifacts/data-sources-desktop.png',fullPage:true});
 await page.getByRole('link',{name:'WebGIS workspace',exact:true}).click();
 await expect(page.locator('.leaflet-container')).toBeVisible();
 await page.locator('.record-list button').first().click();
 await expect(page.getByRole('complementary',{name:'Parcel evidence'})).toBeVisible();
 await expect(page.getByText('Confidence calculation',{exact:true})).toBeVisible();
 await page.screenshot({path:'../artifacts/evidence-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Close evidence'}).click();
 await page.getByRole('combobox').selectOption('conflict');
 await expect(page.locator('.record-list button')).not.toHaveCount(0);
 await page.goto('/review');
 await expect(page.getByRole('heading',{name:'Review queue'})).toBeVisible();
 await page.locator('.case-row').first().click();
 await page.getByLabel('Reviewer identifier').fill('browser-officer');
 await page.getByRole('button',{name:'Reject'}).click();
 await expect(page.getByText('Decision persisted to the backend')).toBeVisible();
 await page.reload();
 await page.getByRole('button',{name:/resolved/}).click();
 await expect(page.getByText('rejected',{exact:true}).first()).toBeVisible();
 await page.goto('/audit');
 await expect(page.getByRole('heading',{name:'Audit trail'})).toBeVisible();
 await expect(page.getByRole('article').filter({hasText:'REJECT'}).first()).toBeVisible();
 for(const size of [{width:768,height:1024},{width:390,height:844}]){
  await page.setViewportSize(size);
  for(const route of ['/','/data-sources','/map','/harmonization']){
   await page.goto(route);
   await expect(page.getByText('Local demo storage')).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
   if(route==='/')await page.screenshot({path:`../artifacts/dashboard-${size.width}.png`,fullPage:true});
   if(route==='/map'&&size.width===390){
    await page.locator('.record-list button').first().click();
    await expect(page.getByRole('complementary',{name:'Parcel evidence'})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
    await page.screenshot({path:'../artifacts/evidence-mobile.png',fullPage:true});
   }
  }
 }
 await page.getByRole('button',{name:'Toggle navigation'}).click();
 await expect(page.getByRole('link',{name:'Data sources',exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Data sources',exact:true}).click();
 await expect(page.getByText('Different sources. Shared geography.')).toBeVisible();
 expect(errors).toEqual([]);
});
