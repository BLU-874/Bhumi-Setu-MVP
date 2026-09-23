import { test, expect } from '@playwright/test';

test('Phase 7: Decision Record, Field Verification, Draft Notice & Traceable Audit', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  // 1. Navigate to Review Queue (/review)
  await page.goto('/review');
  await expect(page.getByRole('heading', { name: 'Review queue' })).toBeVisible({ timeout: 15000 });

  // 2. Select a case from the review queue
  const firstCase = page.locator('.case-row').first();
  await expect(firstCase).toBeVisible();
  await firstCase.click();

  // Verify parcel details loaded
  const recordHeader = page.locator('.review-case-header h2');
  await expect(recordHeader).toBeVisible();
  const recordId = await recordHeader.innerText();
  expect(recordId).toBeTruthy();

  // 3. Make a Human Decision (INVESTIGATE) to trigger post-decision state
  await page.getByLabel('Reviewer identifier').fill('Officer-Phase7');
  await page.getByLabel('Note or reason').fill('Inspected ground boundaries and verified parcel geometry.');
  
  const decidePromise = page.waitForResponse(r => r.url().includes('/api/review-cases/') && r.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Investigate' }).click();
  await decidePromise;

  await expect(page.locator('.decision-confirmation')).toBeVisible();
  await expect(page.locator('.persisted-note')).toContainText(/investigate/i);
  await expect(page.locator('.persisted-note')).toContainText('Officer-Phase7');

  // 4. Verify Secondary Actions are exposed after decision
  const actionsSection = page.locator('.post-decision-section');
  await expect(actionsSection).toBeVisible();
  const viewRecordBtn = page.getByRole('button', { name: 'View decision record' });
  const fieldVerifBtn = page.getByRole('button', { name: 'Field verification' });
  const exportRecordBtn = page.getByRole('button', { name: /Export record/i });

  await expect(viewRecordBtn).toBeVisible();
  await expect(fieldVerifBtn).toBeVisible();
  await expect(exportRecordBtn).toBeVisible();

  // 5. Open Decision Record Modal
  await viewRecordBtn.click();
  const modalBackdrop = page.locator('.modal-backdrop');
  await expect(modalBackdrop).toBeVisible();
  await expect(page.locator('#decision-record-title')).toContainText('DECISION RECORD');

  // 6. Verify Decision Record contains actual record data & 7 numbered sections
  const docPaper = page.locator('.decision-record-paper');
  await expect(docPaper).toContainText('BHUMI-SETU');
  await expect(docPaper).toContainText('Geospatial Reconciliation & Evidence Record');
  await expect(docPaper).toContainText('SYNTHETIC DEMONSTRATION DATASET');
  await expect(docPaper).toContainText(recordId);
  await expect(docPaper).toContainText('INVESTIGATE');
  await expect(docPaper).toContainText('Officer-Phase7');

  // Check all 7 sections
  await expect(docPaper.getByRole('heading', { name: '1. Decision Summary' })).toBeVisible();
  await expect(docPaper.getByRole('heading', { name: '2. Source Provenance' })).toBeVisible();
  await expect(docPaper.getByRole('heading', { name: '3. Geospatial Evidence' })).toBeVisible();
  await expect(docPaper.getByRole('heading', { name: '4. Matching Evidence' })).toBeVisible();
  await expect(docPaper.getByRole('heading', { name: '5. Validation' })).toBeVisible();
  await expect(docPaper.getByRole('heading', { name: '6. Human Decision' })).toBeVisible();
  await expect(docPaper.getByRole('heading', { name: '7. Audit Information' })).toBeVisible();

  // Check footer
  await expect(docPaper).toContainText('Generated from Bhumi-Setu reconciliation records.');
  await expect(docPaper).toContainText('Synthetic demonstration dataset');

  // 7. Verify Export from Decision Record triggers DECISION_RECORD_EXPORTED audit
  const auditPromise = page.waitForResponse(r => r.url().includes('/api/audit-events') && r.request().method() === 'POST');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'JSON' }).click()
  ]);
  expect(download.suggestedFilename()).toContain(`decision-record-${recordId}.json`);
  await auditPromise;

  // Close Decision Record Modal
  await page.locator('.doc-close-btn').click();
  await expect(modalBackdrop).toHaveCount(0);

  // 8. Open Field Verification Modal
  await fieldVerifBtn.click();
  const verifModal = page.locator('.verification-modal-container');
  await expect(verifModal).toBeVisible();
  await expect(page.locator('#verification-modal-title')).toContainText('FIELD VERIFICATION');
  await expect(page.getByText('Prepare a verification request for the selected record.')).toBeVisible();

  // 9. Inspect Draft Administrative Notice Tab
  await page.getByRole('button', { name: 'Draft Administrative Notice' }).click();
  const warningBanner = page.locator('.doc-warning-banner');
  await expect(warningBanner).toBeVisible();
  await expect(warningBanner).toContainText('DRAFT — NOT AN OFFICIAL GOVERNMENT NOTICE');
  await expect(warningBanner).toContainText('This memorandum is an internal technical working document');

  // Verify registered owner contains actual record data (or fallback when absent)
  const noticePaper = page.locator('.notice-paper');
  const ownerCell = noticePaper.locator('tr:has-text("Registered Owner:") td');
  await expect(ownerCell).toBeVisible();
  const ownerValue = await ownerCell.innerText();
  expect(ownerValue === 'Owner information not available in current dataset.' || ownerValue.length > 0).toBeTruthy();

  // 10. Switch back to Form & Prepare Verification Request
  await page.getByRole('button', { name: 'Back to Form' }).click();
  await page.getByLabel('Assigned officer / team').fill('Pune Survey Unit 4 / Inspector DO-03');
  await page.getByLabel('Verification note / inspection instructions').fill('Verify boundary markers at northeast corner using RTK GNSS.');

  const verifAuditPromise = page.waitForResponse(r => r.url().includes('/api/audit-events') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Prepare Verification Request' }).click();
  const verifRes = await verifAuditPromise;
  expect(verifRes.status()).toBe(201);

  await expect(page.getByText('FIELD_VERIFICATION_PREPARED')).toBeVisible();

  // Close Field Verification Modal
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(modalBackdrop).toHaveCount(0);

  // 11. Verify Audit Trail preserves the new events and immutable human decision
  await page.goto('/audit');
  await expect(page.getByRole('heading', { name: 'Audit trail' })).toBeVisible();
  const table = page.locator('.audit-table');
  await expect(table).toBeVisible();

  // Verify FIELD_VERIFICATION_PREPARED row exists
  await expect(table.getByText('FIELD_VERIFICATION_PREPARED').first()).toBeVisible();
  // Verify DECISION_RECORD_EXPORTED row exists
  await expect(table.getByText('DECISION_RECORD_EXPORTED').first()).toBeVisible();
  // Verify original review.accept decision is intact
  await expect(table.getByText('Officer-Phase7').first()).toBeVisible();
});
