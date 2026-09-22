import {test,expect} from '@playwright/test';

test('landing retains working workspace modes and real navigation',async({page})=>{
 const errors:string[]=[],writes:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 page.on('request',request=>{if(['POST','PATCH','DELETE'].includes(request.method()))writes.push(request.url());});
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'One parcel. Three realities.',level:1})).toBeVisible();
 await expect(page.locator('h1')).toHaveCount(1);
 await page.getByRole('link',{name:'See How It Works',exact:true}).click();
 await expect(page).toHaveURL(/#hero-story$/);
 await expect(page.locator('.landing-pipeline li')).toHaveCount(5);
 await page.getByRole('navigation',{name:'Product navigation'}).getByRole('link',{name:'Workspace',exact:true}).click();
 const workspace=page.locator('.landing-workspace');
 await expect(workspace.locator('.leaflet-container').first()).toBeVisible();
 await expect(workspace.getByRole('button',{name:'Synthetic Benchmark',exact:true})).toHaveAttribute('aria-pressed','true');
 if(await workspace.getByRole('complementary',{name:'Parcel evidence',exact:true}).count()){
  await expect(workspace.getByRole('complementary',{name:'Parcel evidence',exact:true})).toBeVisible();
  await expect(workspace.getByText('Deterministic confidence',{exact:true})).toBeVisible();
 }
 const buildings=workspace.getByRole('checkbox',{name:'Buildings',exact:true});
 await buildings.uncheck();await expect(buildings).not.toBeChecked();await buildings.check();
 await workspace.screenshot({path:'../artifacts/ui01-workspace-synthetic.png'});
 await workspace.getByRole('button',{name:'Real-World Dataset',exact:true}).click();
 const real=workspace.getByRole('region',{name:'Real-world workspace',exact:true});
 await expect(real.getByRole('heading',{name:'Lalpur, Ahmedabad, Gujarat',exact:true})).toBeVisible();
 await expect(real.locator('path[stroke="#1973d2"]')).toHaveCount(24);
 await real.locator('.record-list button').first().click();
 await expect(real.getByRole('complementary',{name:'Real building provenance'})).toBeVisible();
 await expect(real.getByText('Segmentation probability',{exact:true})).toBeVisible();
 await expect(real.getByRole('checkbox',{name:'Cadastral — unavailable',exact:true})).toBeDisabled();
 const original=real.getByRole('checkbox',{name:'Original source outlines',exact:true});
 await original.check();await expect(real.locator('path[stroke="#bd7626"]')).toHaveCount(24);await original.uncheck();
 await workspace.screenshot({path:'../artifacts/ui01-workspace-lalpur.png'});
 await expect(page.locator('h1')).toHaveCount(1);
 await workspace.getByRole('button',{name:'Synthetic Benchmark',exact:true}).click();
 for(const viewport of [{width:1920,height:1080},{width:1440,height:1000},{width:1024,height:768},{width:768,height:1024},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  await page.evaluate(()=>window.scrollTo(0,0));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
  await expect(page.getByRole('heading',{name:'One parcel. Three realities.',level:1})).toBeVisible();
  const headline=await page.locator('.cinematic-intro').boundingBox();
  expect(headline&&headline.x>=0&&headline.x+headline.width<=viewport.width).toBeTruthy();
  await page.screenshot({path:`../artifacts/ui01-hero-${viewport.width}.png`});
  if(viewport.width===1440)await page.screenshot({path:'../artifacts/ui01-landing-full.png',fullPage:true});
 }
 await page.getByRole('button',{name:'Toggle landing navigation'}).click();
 await page.getByRole('navigation',{name:'Product navigation'}).getByRole('link',{name:'How it works',exact:true}).click();
 await expect(page).toHaveURL(/#how-it-works$/);
 await expect(page.getByRole('button',{name:'Toggle landing navigation'})).toHaveAttribute('aria-expanded','false');
 await page.emulateMedia({reducedMotion:'reduce'});
 await expect(page.locator('.cinematic-hero')).toHaveClass(/is-reduced/);
 await expect(page.locator('.cinematic-intro')).toHaveCSS('visibility','visible');
 expect(await page.locator('.cinematic-center').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 await page.locator('.cinematic-intro').getByRole('link',{name:'Explore Workspace',exact:true}).click();
 await expect(page).toHaveURL(/\/map$/);
 await expect(page.getByRole('button',{name:'Synthetic Benchmark',exact:true})).toBeVisible();
 await page.goto('/');
 await page.getByRole('link',{name:'Explore Lalpur data',exact:true}).click();
 await expect(page).toHaveURL(/\/map\?mode=real_world_reference$/);
 await expect(page.getByRole('heading',{name:'Lalpur, Ahmedabad, Gujarat',exact:true})).toBeVisible();
 expect(writes).toEqual([]);
 expect(errors).toEqual([]);
});

test('landing keyboard access and unavailable backend have an honest fallback',async({page})=>{
 // Explicit failure injection, not mock data: do not invent a result when offline.
 await page.route('**/api/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{"detail":"Test backend unavailable"}'}));
 await page.goto('/');
 await expect(page.getByRole('heading',{level:1,name:'One parcel. Three realities.'})).toBeVisible();
 await page.keyboard.press('Tab');
 await expect(page.getByRole('link',{name:'Skip to content',exact:true})).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(page).toHaveURL(/#landing-main$/);
 await expect(page.getByRole('alert')).toContainText('Live workspace data is unavailable');
 await expect(page.locator('.cinematic-hero')).not.toContainText('/ 100');
 await expect(page.locator('.evidence-concepts')).toContainText('Candidate ranking');
 await expect(page.getByRole('button',{name:'Retry connection',exact:true})).toBeEnabled();
});
