import { test, expect } from '@playwright/test';

test('harmonization run lifecycle and detailed audit trail verification', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  // 1. WebGIS Workspace & Horizontal Layer Toolbar
  await page.goto('/map');
  await expect(page.locator('.workspace-layer-toolbar')).toBeVisible();
  await expect(page.locator('.workspace-layer-toolbar')).toContainText('LAYERS');
  await expect(page.getByRole('checkbox', { name: 'Cadastral' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Buildings' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'GNSS' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Results' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Satellite basemap' })).toBeChecked();

  // Verify compact left column with benchmark counts
  const leftPanel = page.locator('.workspace-harmonization-column');
  await expect(leftPanel.getByText('500 parcels')).toBeVisible();
  await expect(leftPanel.getByText(/475 features|6 features/)).toBeVisible();
  await expect(leftPanel.getByText('350 points')).toBeVisible();

  // 2. Test POST-RUN Completed State & Action Hierarchy
  await expect(page.getByText(/RECONCILIATION COMPLETE/i)).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.count-chip.matched')).toContainText(/MATCHED/i);
  await expect(page.locator('.count-chip.review')).toContainText(/REVIEW/i);
  await expect(page.locator('.count-chip.conflict')).toContainText(/CONFLICT/i);
  await expect(page.locator('.saved-run-ref')).toContainText('Saved run:');

  const reviewAction = page.getByRole('link', { name: /Review results/i });
  const rerunAction = page.getByRole('button', { name: 'Run Again' });
  const clearAction = page.locator('button.clear-action-btn');

  await expect(reviewAction).toBeVisible();
  await expect(rerunAction).toBeVisible();
  await expect(clearAction).toBeVisible();
  await page.screenshot({ path: '../artifacts/workspace-completed-run.png', fullPage: true });

  // 3. Test RERUN Confirmation Dialog & Cancel
  await rerunAction.click();
  await expect(page.locator('#rerun-dialog-title')).toContainText('Run harmonization again?');
  await expect(page.getByText('Current results will be replaced in the workspace. Previous run records remain available in the audit trail.')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('#rerun-dialog-title')).toHaveCount(0);

  // 4. Test CLEAR RESULTS Confirmation Dialog & Reset to PRE-RUN
  await clearAction.click();
  await expect(page.locator('#clear-dialog-title')).toContainText('Clear current harmonization results?');
  await expect(page.getByText('Historical runs and audit records will remain available.')).toBeVisible();
  await page.locator('.dialog-actions button.danger-btn').click();

  // Verify Returned to PRE-RUN State
  await expect(page.getByText(/RECONCILIATION COMPLETE/i)).toHaveCount(0);
  const runBtn = page.getByRole('button', { name: 'Run Harmonization' });
  await expect(runBtn).toBeVisible();
  await expect(runBtn).toBeEnabled();
  await page.screenshot({ path: '../artifacts/workspace-pre-run.png', fullPage: true });

  // 5. Test RUN HARMONIZATION Primary Action (Populate Results)
  const runPromise = page.waitForResponse(r => r.url().endsWith('/api/runs') && r.request().method() === 'POST');
  await runBtn.click();
  await runPromise;

  // Verify Results Are Back
  await expect(page.getByText(/RECONCILIATION COMPLETE/i)).toBeVisible();
  await expect(reviewAction).toBeVisible();

  // 6. Navigate to Review Results
  await reviewAction.click();
  await expect(page.getByRole('heading', { name: 'Review uncertain cases.' })).toBeVisible();

  // Submit a human decision
  await page.locator('.case-row').first().click();
  await page.getByLabel('Reviewer identifier').fill('DO-GIS-Inspector');
  await page.getByLabel('Note or reason').fill('Verified boundaries match ground survey control points.');
  const decisionPromise = page.waitForResponse(r => r.url().includes('/api/review-cases/') && r.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Accept' }).click();
  await decisionPromise;
  await expect(page.getByText('Decision persisted to the backend')).toBeVisible();

  // 7. Audit Trail Page
  await page.goto('/audit');
  await expect(page.getByRole('heading', { name: 'Audit trail' })).toBeVisible();
  await expect(page.locator('.audit-table')).toBeVisible();

  // Verify historical records contain our decision
  const inspectorRow = page.locator('tr[role="article"]').filter({ hasText: 'DO-GIS-Inspector' });
  await expect(inspectorRow.first()).toBeVisible();
  await expect(inspectorRow.first()).toContainText('ACCEPT');
  await page.screenshot({ path: '../artifacts/audit-trail-table.png', fullPage: true });

  // 8. Open Detailed Inspection Drawer
  await inspectorRow.first().getByRole('button', { name: /Inspect/i }).click();
  await expect(page.locator('.audit-detail-modal')).toBeVisible();

  // Verify all evidence sections in the inspection panel
  await expect(page.getByRole('heading', { name: /Human Review Decision/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Identity & Cross-References/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Source Provenance/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Geospatial Evidence/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Attribute Evidence/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /GNSS Evidence/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Machine Learning Assessment/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Deterministic Decision/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Run Metadata/i })).toBeVisible();
  await page.screenshot({ path: '../artifacts/audit-record-inspector.png', fullPage: true });

  // 9. Verify Export Functionality in Inspection Drawer
  await expect(page.getByRole('button', { name: /JSON/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /CSV/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Print \/ PDF/i })).toBeVisible();

  // Close drawer and verify Export Run on main audit page
  await page.getByRole('button', { name: 'Close detail inspection' }).click();
  await expect(page.getByRole('button', { name: /Export Run/i })).toBeVisible();
  await page.getByRole('button', { name: /Export Run/i }).click();
  await expect(page.getByText('Export Run JSON')).toBeVisible();
  await expect(page.getByText('Export Run CSV')).toBeVisible();

  expect(errors).toEqual([]);
});
