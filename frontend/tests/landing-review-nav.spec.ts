import { test, expect } from '@playwright/test';

test('landing page human review CTA navigates directly to existing review queue', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  // 1. Open landing page /
  await page.goto('/');
  await expect(page.locator('.cinematic-hero')).toBeVisible();

  // 2. Locate the Human Review / Review Results CTA in the pipeline
  // Scroll down to the Review / Human Decision stage
  const reviewStage = page.locator('#stage-review');
  await reviewStage.scrollIntoViewIfNeeded();
  await expect(reviewStage).toBeVisible();

  const reviewCta = reviewStage.getByRole('link', { name: /Review uncertain cases/i });
  await expect(reviewCta).toBeVisible();

  // 3. Click the Review CTA
  await reviewCta.click();

  // 4. Verify URL is /review
  await expect(page).toHaveURL(/\/review$/);

  // 5. Verify the existing Review Queue heading is visible
  await expect(page.getByRole('heading', { name: 'Review uncertain cases.' })).toBeVisible();

  // Verify the existing ReviewQueue page elements are intact
  await expect(page.locator('.sidebar')).toBeVisible();
  await expect(page.locator('.review-map')).toBeVisible();

  // Verify browser back navigation returns to landing page
  await page.goBack();
  await expect(page).toHaveURL(/\/(#.*)?$/);

  // Test the secondary CTA in Stage 07 (Human Decision)
  const decisionStage = page.locator('#stage-decision');
  await decisionStage.scrollIntoViewIfNeeded();
  const openQueueCta = decisionStage.getByRole('link', { name: /Open Review Queue/i });
  await expect(openQueueCta).toBeVisible();
  await openQueueCta.click();
  await expect(page).toHaveURL(/\/review$/);
  await expect(page.getByRole('heading', { name: 'Review uncertain cases.' })).toBeVisible();

  expect(errors).toEqual([]);
});
