import { test, expect } from '@playwright/test';

test('verify official logo renders crisply on desktop, mobile, workspace, and review', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) {
      consoleErrors.push(msg.text());
    }
  });

  // 1. Check Landing Header Desktop (width: 1440)
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const headerLogo = page.locator('.landing-header .landing-brand-logo');
  await expect(headerLogo).toBeVisible();
  await expect(headerLogo).toHaveAttribute('src', '/images/bhumi-setu-logo-light.png');

  // Verify aspect ratio is preserved and height is in the 42-52px range
  const headerBox = await headerLogo.boundingBox();
  expect(headerBox).not.toBeNull();
  expect(headerBox!.height).toBeGreaterThanOrEqual(42);
  expect(headerBox!.height).toBeLessThanOrEqual(52);
  expect(headerBox!.width).toBeGreaterThan(headerBox!.height * 2.5); // Wide aspect ratio preserved

  await page.locator('.landing-header').screenshot({
    path: 'C:/Users/srajal/.gemini/antigravity-ide/brain/50ba6de6-8736-4761-b12d-a6b3e5b8d13a/logo_landing_header.png'
  });

  // 2. Check Workspace Chrome in Landing
  const wsChrome = page.locator('.workspace-chrome');
  await wsChrome.scrollIntoViewIfNeeded();
  await expect(wsChrome).toBeVisible();
  const wsLogo = wsChrome.locator('.workspace-chrome-logo');
  await expect(wsLogo).toBeVisible();
  await expect(wsLogo).toHaveAttribute('src', '/images/bhumi-setu-logo.png');
  await wsChrome.screenshot({
    path: 'C:/Users/srajal/.gemini/antigravity-ide/brain/50ba6de6-8736-4761-b12d-a6b3e5b8d13a/logo_workspace_chrome.png'
  });

  // 3. Check Landing Footer
  const footerLogo = page.locator('.landing-footer .landing-footer-logo');
  await footerLogo.scrollIntoViewIfNeeded();
  await expect(footerLogo).toBeVisible();
  await page.locator('.landing-footer').screenshot({
    path: 'C:/Users/srajal/.gemini/antigravity-ide/brain/50ba6de6-8736-4761-b12d-a6b3e5b8d13a/logo_landing_footer.png'
  });

  // 4. Check Mobile Landing Header (width: 390)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(headerLogo).toBeVisible();
  const mobileHeaderBox = await headerLogo.boundingBox();
  expect(mobileHeaderBox).not.toBeNull();
  expect(mobileHeaderBox!.height).toBeGreaterThanOrEqual(34);
  expect(mobileHeaderBox!.height).toBeLessThanOrEqual(40);

  await page.locator('.landing-header').screenshot({
    path: 'C:/Users/srajal/.gemini/antigravity-ide/brain/50ba6de6-8736-4761-b12d-a6b3e5b8d13a/logo_landing_mobile.png'
  });

  // 5. Check Review Page (/review)
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/review');
  const reviewSidebarLogo = page.locator('.sidebar .sidebar-brand-logo');
  await expect(reviewSidebarLogo).toBeVisible();
  await expect(reviewSidebarLogo).toHaveAttribute('src', '/images/bhumi-setu-logo-light.png');

  const reviewTopbarLogo = page.locator('.topbar .topbar-brand-logo');
  await expect(reviewTopbarLogo).toBeVisible();
  await expect(reviewTopbarLogo).toHaveAttribute('src', '/images/bhumi-setu-logo.png');

  await page.screenshot({
    path: 'C:/Users/srajal/.gemini/antigravity-ide/brain/50ba6de6-8736-4761-b12d-a6b3e5b8d13a/logo_review_page.png'
  });

  // 6. Check Workspace Page (/map)
  await page.goto('/map');
  const mapSidebarLogo = page.locator('.sidebar .sidebar-brand-logo');
  await expect(mapSidebarLogo).toBeVisible();
  const mapTopbarLogo = page.locator('.topbar .topbar-brand-logo');
  await expect(mapTopbarLogo).toBeVisible();

  await page.screenshot({
    path: 'C:/Users/srajal/.gemini/antigravity-ide/brain/50ba6de6-8736-4761-b12d-a6b3e5b8d13a/logo_workspace_page.png'
  });

  // 7. Verify no unexpected console errors
  expect(consoleErrors).toEqual([]);
});
