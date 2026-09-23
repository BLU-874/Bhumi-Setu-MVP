import { test, expect } from '@playwright/test';

test.describe('Phase UI-08C: Workspace Run State and Dataset Context Clarity', () => {
  test('verify Case A, Case B, Case C, Case D', async ({ page }) => {
    // Set 1440x900 viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    // Navigate to /map
    await page.goto('/map');
    await expect(page.locator('.workspace-layer-toolbar')).toBeVisible();

    // ==========================================
    // CASE A — NO SELECTION / RUN OVERVIEW
    // ==========================================
    // 1. Left Panel: DATASET MODE & Reconciliation Complete
    const leftPanel = page.locator('.workspace-harmonization-column');
    await expect(leftPanel.locator('.dataset-context-kicker')).toHaveText('DATASET MODE');
    await expect(leftPanel.locator('.dataset-context-title')).toBeVisible();
    await expect(leftPanel.getByText('500 parcels')).toBeVisible();
    await expect(leftPanel.getByText('350 points')).toBeVisible();

    // 2. Reconciliation Complete box
    await expect(leftPanel.getByText(/RECONCILIATION COMPLETE/i)).toBeVisible();
    await expect(leftPanel.getByText(/500 parcels evaluated/i)).toBeVisible();
    await expect(leftPanel.locator('.count-chip.matched')).toContainText(/MATCHED/i);
    await expect(leftPanel.locator('.count-chip.review')).toContainText(/NEEDS REVIEW/i);
    await expect(leftPanel.locator('.count-chip.conflict')).toContainText(/CONFLICT/i);

    // 3. Right Panel: RUN OVERVIEW
    const rightPanel = page.locator('.workspace-evidence-column');
    await expect(rightPanel.locator('.run-overview-standby')).toBeVisible();
    await expect(rightPanel.getByText('RUN OVERVIEW')).toBeVisible();
    await expect(rightPanel.locator('.metric-label').filter({ hasText: 'PARCELS EVALUATED' })).toBeVisible();
    await expect(rightPanel.locator('.metric-label').filter({ hasText: /FOOTPRINTS/i })).toBeVisible();
    await expect(rightPanel.locator('.metric-label').filter({ hasText: 'GNSS OBSERVATIONS' })).toBeVisible();

    // ML Candidate Ranking in Run Overview
    await expect(rightPanel.getByText('ML CANDIDATE RANKING', { exact: true })).toBeVisible();
    await expect(rightPanel.locator('.status-pill.available')).toHaveText('Available');
    await expect(rightPanel.locator('.ml-engine-name')).toHaveText('HistGradientBoosting');
    await expect(rightPanel.locator('.ml-model-tag')).toContainText('synthetic-hgb-v1');

    // Instruction to select a parcel
    await expect(rightPanel.locator('.select-prompt-text')).toContainText('Select a colored parcel on the map');

    // 4. Map Caption
    await expect(page.locator('.map-caption')).toContainText(/SYNTHETIC CADASTRAL CONTEXT/i);

    // 5. Bottom Status Strip
    const bottomStrip = page.locator('.workspace-bottom-status-strip');
    await expect(bottomStrip.locator('.status-strip-kicker')).toHaveText('RECONCILIATION RESULT');
    await expect(bottomStrip.getByText(/PARCELS EVALUATED/i)).toBeVisible();
    await expect(bottomStrip.getByRole('link', { name: /AUDIT TRAIL/i })).toBeVisible();
    await expect(bottomStrip.getByRole('link', { name: /REVIEW QUEUE/i })).toBeVisible();

    await page.screenshot({ path: '../artifacts/case-a-run-overview-1440x900.png', fullPage: true });

    // ==========================================
    // CASE B — P0003 ML EVIDENCE
    // ==========================================
    // Select P0003 from the record list below map
    const p0003Button = page.locator('.record-list button').filter({ hasText: 'P0003' });
    await expect(p0003Button).toBeVisible();
    await p0003Button.click();

    // Verify Evidence Panel opens with actual ML evidence
    const evidencePanel = page.locator('.workspace-evidence-column .evidence');
    await expect(evidencePanel).toBeVisible();
    await expect(evidencePanel.locator('h2')).toHaveText('P0003');
    await expect(evidencePanel.getByText('Bhumi-Setu Match Ranker')).toBeVisible();
    await expect(evidencePanel.locator('.evidence-row').filter({ hasText: 'ML-ranked candidate' })).toContainText('staged-drone-0003');
    await expect(evidencePanel.locator('.evidence-row').filter({ hasText: 'Predicted match probability' })).toContainText('%');
    await expect(evidencePanel.locator('.evidence-row').filter({ hasText: 'Candidate rank' })).toContainText('1');

    await page.screenshot({ path: '../artifacts/case-b-p0003-ml-evidence.png', fullPage: true });

    // Close evidence panel to return to list
    await page.getByRole('button', { name: 'Close evidence' }).click();
    await expect(rightPanel.locator('.run-overview-standby')).toBeVisible();

    // ==========================================
    // CASE C — P0015 ZERO-CANDIDATE CASE
    // ==========================================
    // Select P0015
    const p0015Button = page.locator('.record-list button').filter({ hasText: 'P0015' });
    await expect(p0015Button).toBeVisible();
    await p0015Button.click();

    // Verify Evidence Panel for zero-candidate
    await expect(evidencePanel).toBeVisible();
    await expect(evidencePanel.locator('h2')).toHaveText('P0015');
    await expect(evidencePanel.locator('.evidence-row').filter({ hasText: 'ML-ranked candidate' })).toContainText('Not supplied');
    await expect(evidencePanel.locator('.evidence-row').filter({ hasText: 'Predicted match probability' })).toContainText('Not available');
    await expect(evidencePanel.locator('.evidence-row').filter({ hasText: 'Candidate rank' })).toContainText('Not supplied');
    await expect(evidencePanel.locator('.zero-candidate-note')).toHaveText(
      'No spatial candidate was available for ML ranking in the selected source set.'
    );

    await page.screenshot({ path: '../artifacts/case-c-p0015-zero-candidate.png', fullPage: true });

    // Close evidence panel
    await page.getByRole('button', { name: 'Close evidence' }).click();

    // ==========================================
    // CASE D — SWITCH TO SYNTHETIC BENCHMARK
    // ==========================================
    await page.locator('.building-source-details').evaluate((el: HTMLDetailsElement) => {
      el.open = true;
    });
    const buildingSelect = page.locator('#building-source-select');
    await buildingSelect.selectOption('buildings');

    // Left panel should now show SYNTHETIC BENCHMARK and 475 features
    await expect(leftPanel.locator('.dataset-context-title')).toHaveText('SYNTHETIC BENCHMARK');
    await expect(leftPanel.getByText('475 features')).toBeVisible();
    await expect(page.locator('.map-caption')).toContainText('SYNTHETIC BENCHMARK · 475 BUILDING FOOTPRINTS');

    await page.screenshot({ path: '../artifacts/case-d-synthetic-benchmark.png', fullPage: true });
  });

  test('narrow viewport (1024x768) responsiveness check', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/map');
    await expect(page.locator('.workspace-layer-toolbar')).toBeVisible();
    await expect(page.locator('.workspace-bottom-status-strip')).toBeVisible();
    await page.screenshot({ path: '../artifacts/workspace-1024x768.png', fullPage: true });
  });

  test('production route verification: all 7 routes load cleanly', async ({ page }) => {
    const routes = [
      { path: '/', expected: '.landing-header' },
      { path: '/overview', expected: '.hub-primary-banner' },
      { path: '/map', expected: '.workspace-layer-toolbar' },
      { path: '/data-sources', expected: '.source-card' },
      { path: '/harmonization', expected: '.source-selection' },
      { path: '/review', expected: '.review-layout' },
      { path: '/audit', expected: '.page-heading' },
    ];

    for (const r of routes) {
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(r.path);
      await expect(page.locator(r.expected).first()).toBeVisible({ timeout: 10000 });
      expect(errors).toEqual([]);
    }
  });
});

