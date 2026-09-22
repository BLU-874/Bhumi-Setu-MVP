import {test,expect,type Page} from '@playwright/test';

async function scrollHero(page:Page,progress:number){
 await page.evaluate(value=>{
  const hero=document.querySelector<HTMLElement>('.cinematic-hero')!;
  const top=hero.getBoundingClientRect().top+window.scrollY;
  window.scrollTo({top:top+(hero.offsetHeight-window.innerHeight)*value,behavior:'instant'});
 },progress);
 await page.waitForTimeout(180);
}

test('cinematic hero reveals real imagery, stages four sources and resolves into the product',async({page})=>{
 const errors:string[]=[],writes:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 page.on('request',request=>{if(['POST','PATCH','DELETE'].includes(request.method()))writes.push(request.url());});
 await page.goto('/');
 const center=page.locator('.cinematic-center');
 await expect(page.getByRole('heading',{level:1,name:'One parcel. Three realities.'})).toBeVisible();
 await expect(center).toHaveCSS('position','absolute');
 await expect(page.locator('.cinematic-stage')).toHaveCSS('position','sticky');
 await expect(center).toHaveCSS('clip-path','polygon(25% 25%, 75% 25%, 75% 75%, 25% 75%)');
 const initialSize=await center.evaluate(el=>parseFloat(getComputedStyle(el).backgroundSize));
 await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:'../artifacts/ui03-1440-start.png'});
 await scrollHero(page,.44);
 await expect(center).toHaveCSS('clip-path','polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)');
 expect(await center.evaluate(el=>parseFloat(getComputedStyle(el).backgroundSize))).toBeLessThan(initialSize);
 expect(Math.abs((await page.locator('.cinematic-stage').boundingBox())!.y)).toBeLessThan(2);
 await expect(page.locator('.source-cadastral')).toHaveCSS('opacity','1');
 const firstTransform=await page.locator('.source-cadastral').evaluate(el=>getComputedStyle(el).transform);
 await page.screenshot({path:'../artifacts/ui03-1440-reveal.png'});
 await scrollHero(page,.69);
 for(const name of ['cadastral','drone','gnss','reconciliation']){
  const figure=page.locator(`.source-${name}`);
  await expect(figure).toHaveCSS('opacity','1');
  expect(await figure.locator('img').evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBeTruthy();
 }
 expect(await page.locator('.source-cadastral').evaluate(el=>getComputedStyle(el).transform)).not.toBe(firstTransform);
 await page.screenshot({path:'../artifacts/ui03-1440-sources.png'});
 await scrollHero(page,.95);
 await expect(center).toHaveCSS('opacity','0');
 await expect(page.locator('.cinematic-payoff')).toHaveCSS('opacity','1');
 await expect(page.getByRole('heading',{name:'One trusted picture.',exact:true})).toBeVisible();
 await page.screenshot({path:'../artifacts/ui03-1440-payoff.png'});
 await scrollHero(page,0);
 await expect(center).toHaveCSS('clip-path','polygon(25% 25%, 75% 25%, 75% 75%, 25% 75%)');
 await page.getByRole('link',{name:'See How It Works',exact:true}).click();
 await expect(page).toHaveURL(/#hero-story$/);
 await expect(page.locator('.source-cadastral')).toBeVisible();
 await page.locator('.hero-image-credits summary').click();
 await expect(page.locator('.hero-image-credits li')).toHaveCount(5);
 await expect(page.locator('.hero-image-credits')).toContainText('not corresponding datasets');
 await scrollHero(page,0);
 await page.locator('.cinematic-intro').getByRole('link',{name:'Explore Workspace',exact:true}).click();
 await expect(page).toHaveURL(/\/map$/);
 await expect(page.getByRole('button',{name:'Synthetic Benchmark',exact:true})).toBeVisible();
 expect(writes).toEqual([]);
 expect(errors).toEqual([]);
});

test('cinematic composition fits desktop, tablet and mobile at each scroll stage',async({page})=>{
 for(const viewport of [{width:1920,height:1080},{width:1024,height:768},{width:768,height:1024},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  await page.goto('/');
  await expect(page.locator('.cinematic-intro')).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
  for(const progress of [0,.44,.69,.95]){
   await scrollHero(page,progress);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
   const stage=await page.locator('.cinematic-stage').boundingBox();
   expect(stage!.width).toBeLessThanOrEqual(viewport.width);
   if(progress===0){
    const title=await page.locator('#cinematic-title').boundingBox();
    expect(title!.x).toBeGreaterThanOrEqual(0);
    expect(title!.x+title!.width).toBeLessThanOrEqual(viewport.width);
    await expect(page.locator('.cinematic-intro .cinematic-button')).toBeInViewport();
   }
   if(progress===.69){
    for(const label of await page.locator('.scroll-source figcaption').all()){
     const bounds=await label.boundingBox();
     expect(bounds!.x).toBeGreaterThanOrEqual(0);
     expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(viewport.width);
     expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(viewport.height);
    }
   }
   if(viewport.width===1920||viewport.width===390)await page.screenshot({path:`../artifacts/ui03-${viewport.width}-${progress}.png`});
  }
 }
});

test('reduced motion exposes the complete story without a long sticky scroll',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await expect(page.locator('.cinematic-hero')).toHaveClass(/is-reduced/);
 await expect(page.locator('.cinematic-stage')).toHaveCSS('position','relative');
 await expect(page.locator('.cinematic-center')).toHaveCSS('clip-path','none');
 for(const figure of await page.locator('.scroll-source').all()){
  await expect(figure).toHaveCSS('opacity','1');
  await expect(figure).toHaveCSS('transform','none');
 }
 await page.keyboard.press('Tab');
 await expect(page.getByRole('link',{name:'Skip to content',exact:true})).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(page).toHaveURL(/#landing-main$/);
 await page.locator('.cinematic-payoff').scrollIntoViewIfNeeded();
 await expect(page.locator('.cinematic-payoff .cinematic-button')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.locator('.cinematic-hero').screenshot({path:'../artifacts/ui03-reduced-motion.png'});
});
