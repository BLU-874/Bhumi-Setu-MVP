import { test, expect, type Page } from '@playwright/test';

async function mockWorkspace(page: Page, saved = false, fail = false) {
  let completed = saved;
  let releaseRun!: () => void;
  let releaseResults!: () => void;
  const runGate = new Promise<void>(resolve => { releaseRun = resolve; });
  const resultsGate = new Promise<void>(resolve => { releaseResults = resolve; });
  const summary = { total_parcels: 500, matched: 350, needs_review: 100, conflict: 50,
    avg_confidence: 80, review_required: 150 };
  const run = { id: 'completed-benchmark-run', status: 'completed', started_at: '2026-09-28T00:00:00Z',
    source_ids: { cadastral: 'cadastral', buildings: 'buildings', gnss: 'gnss' }, summary, stages: [] };
  const sources = ['cadastral', 'buildings', 'gnss'].map(id => ({ id, kind: id, name: id,
    feature_count: id === 'cadastral' ? 500 : id === 'buildings' ? 475 : 350, fields: [], quality: {} }));
  const results = { type: 'FeatureCollection', run_id: run.id, summary,
    features: Array.from({ length: 500 }, (_, i) => ({ type: 'Feature', geometry: null,
      properties: { parcel_id: `P${i}`, status: i < 350 ? 'matched' : i < 450 ? 'needs_review' : 'conflict',
        decision_status: 'pending', confidence: 80, validation_flags: [] } })) };
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/runs' && route.request().method() === 'POST') {
      await runGate;
      if (fail) return route.fulfill({ status: 500, json: { detail: 'Harmonization failed' } });
      completed = true;
      return route.fulfill({ status: 201, json: run });
    }
    if (path === '/api/results') {
      if (!saved) await resultsGate;
      return route.fulfill({ json: results });
    }
    const json = path === '/api/sources' ? sources : path === '/api/runs' ? (completed ? [run] : [])
      : path === '/api/health' ? { status: 'ok', storage_mode: 'local_sqlite_demo', postgis_connected: false }
      : { type: 'FeatureCollection', features: [] };
    return route.fulfill({ json });
  });
  return { releaseRun, releaseResults };
}

test('completed POST ends processing before result loading, then checks all six stages', async ({ page }) => {
  const gates = await mockWorkspace(page);
  await page.goto('/map');
  const panel = page.getByLabel('Harmonization controls');
  await panel.getByRole('button', { name: 'Run Harmonization', exact: true }).click();
  await expect(panel.locator('.run-stages-list li.active')).toHaveText('Detecting conflicts', { timeout: 10000 });
  gates.releaseRun();
  await expect(panel.locator('.run-stages-list li.active')).toHaveCount(0);
  await expect(panel.locator('.run-stages-list li.done')).toHaveCount(6);
  await expect(page.locator('.map-bottom')).toContainText('Loading results');
  gates.releaseResults();
  await expect(panel.locator('.run-stages-list li.done')).toHaveCount(6);
  await expect(panel.locator('.run-stages-list li.done svg')).toHaveCount(6);
  await expect(panel.locator('.stage-pulse, .run-progress-head .spin')).toHaveCount(0);
  await expect(panel.locator('.run-scope-metrics')).toContainText('500 parcels evaluated');
  for (const [selector, count] of [['matched', '350'], ['review', '100'], ['conflict', '50']]) {
    await expect(panel.locator(`.count-chip.${selector} strong`)).toHaveText(count);
  }
});

test('saved completed run checks every stage on reload', async ({ page }) => {
  await mockWorkspace(page, true);
  await page.goto('/map');
  await expect(page.locator('.run-stages-list li.done')).toHaveCount(6);
  await expect(page.locator('.run-stages-list li.active, .stage-pulse')).toHaveCount(0);
});

test('failed harmonization shows the existing error without completed stages', async ({ page }) => {
  const gates = await mockWorkspace(page, false, true);
  await page.goto('/map');
  const panel = page.getByLabel('Harmonization controls');
  await panel.getByRole('button', { name: 'Run Harmonization', exact: true }).click();
  await expect(panel.locator('.run-stages-list li.active')).toHaveCount(1);
  gates.releaseRun();
  await expect(panel.getByRole('alert')).toHaveText('Harmonization failed');
  await expect(panel.locator('.run-stages-list li.active, .run-stages-list li.done')).toHaveCount(0);
});
