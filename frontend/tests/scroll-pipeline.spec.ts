import {test, expect} from '@playwright/test';

test('continuous 9-stage scroll pipeline renders all stages, sticky visual, and workspace transition', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('net::ERR_CONNECTION_REFUSED')) {
      errors.push(message.text());
    }
  });

  await page.goto('/');

  // 1. Hero verification
  await expect(page.getByRole('heading', {name: 'One parcel. Three realities.', level: 1})).toBeVisible();

  // 2. Scroll Pipeline Section verification
  const pipeline = page.locator('#pipeline');
  await expect(pipeline).toBeVisible();

  // 3. Subtle 01 — 09 Progress Bar has 9 pills
  const progressPills = page.locator('.pipeline-step-pill');
  await expect(progressPills).toHaveCount(9);

  // 4. Verify all 9 Stage Headlines
  const stageHeadlines = [
    'Different sources.',
    'Before they can agree, they need to speak the same language.',
    'Which records describe the same place?',
    'Every decision has evidence.',
    'One map. Three outcomes.',
    "Uncertainty doesn't disappear.",
    'Automation proposes. People decide.',
    'Nothing disappears after the decision.',
    'FROM FRAGMENTED DATA',
  ];

  for (const headline of stageHeadlines) {
    await expect(page.getByRole('heading', {name: new RegExp(headline)})).toBeVisible();
  }

  // 5. Verify Sticky Visual Column exists
  const visualColumn = page.locator('.pipeline-visual-column');
  await expect(visualColumn).toBeVisible();
  await expect(visualColumn.locator('.visual-chrome')).toContainText('BHUMI-SETU ENGINE');

  // 6. Test progress pill click navigation & capture key visual stages
  await page.screenshot({path: '../artifacts/ui04-pipeline-stage-01.png'});

  await progressPills.nth(3).click(); // Click Stage 04 Evidence
  await page.waitForTimeout(400);
  await page.screenshot({path: '../artifacts/ui04-pipeline-stage-04.png'});

  await progressPills.nth(8).click(); // Click Stage 09 Trusted
  await page.waitForTimeout(400);
  await page.screenshot({path: '../artifacts/ui04-pipeline-stage-09.png'});

  // 7. Verify Transition to Actual Workspace
  const transitionBanner = page.locator('.workspace-transition-banner');
  await expect(transitionBanner.getByRole('heading', {name: 'Now investigate the map.'})).toBeVisible();
  await expect(transitionBanner).toContainText('Select a parcel. Inspect its evidence. Trace its source.');

  const exploreBtn = transitionBanner.locator('.workspace-transition-cta');
  await expect(exploreBtn).toBeVisible();
  await expect(exploreBtn).toContainText('EXPLORE WORKSPACE');
  await page.screenshot({path: '../artifacts/ui04-pipeline-transition.png'});

  // 8. Verify the Live Workspace is present and intact
  const workspace = page.locator('#workspace.workspace-section');
  await workspace.scrollIntoViewIfNeeded();
  await expect(workspace.locator('.workspace-chrome')).toContainText('LIVE VECTOR WORKSPACE');
  await expect(workspace.getByRole('button', {name: 'Synthetic Benchmark', exact: true})).toHaveAttribute('aria-pressed', 'true');

  // 9. Responsive layout checks across viewports
  for (const viewport of [
    {width: 1920, height: 1080},
    {width: 1440, height: 900},
    {width: 1024, height: 768},
    {width: 768, height: 1024},
    {width: 390, height: 844},
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(200);

    // Verify no horizontal overflow
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(noOverflow).toBeTruthy();

    if (viewport.width === 390) {
      await page.screenshot({path: '../artifacts/ui04-pipeline-mobile-390.png'});
    }
  }

  // 10. Reduced motion verification
  await page.emulateMedia({reducedMotion: 'reduce'});
  await expect(page.locator('#pipeline')).toBeVisible();

  expect(errors).toEqual([]);
});
