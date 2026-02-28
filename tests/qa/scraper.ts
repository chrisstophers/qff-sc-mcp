#!/usr/bin/env tsx
/**
 * tests/qa/scraper.ts — Qantas Calculator QA Scraper
 *
 * Compares our calculator's output against the official Qantas SC calculator.
 * Generates tests/qa/RESULTS.md with a pass/fail summary for all routes.
 *
 * Usage:
 *   npm run scrape                         # All routes (browser + model)
 *   npm run scrape -- --dry-run            # Model-only check (no browser)
 *   npm run scrape -- --id QF-001          # Single route
 *   npm run scrape -- --airline QF         # All QF routes
 *   npm run scrape -- --headless           # Headless browser (CI mode)
 *
 * Requirements:
 *   - playwright must be installed (npx playwright install chromium)
 *   - Internet access to qantas.com
 */

import { chromium, type Page } from 'playwright';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { calculateStatusCredits } from '../../src/calculator.js';
import qaRoutesData from './routes.json' with { type: 'json' };

// ─── Types ────────────────────────────────────────────────────────────────────

interface QARoute {
  id: string;
  category: string;
  description: string;
  routing: string[];
  cabin_class: string;
  airline: string;
  expected_total_sc: number;
  expected_table?: string;
  expected_tables?: string[];
  verified: boolean;
  note?: string;
}

type ScraperStatus =
  | 'PASS'        // Model matches expected AND (if scraped) matches Qantas calculator
  | 'FAIL'        // Mismatch between model and expected_total_sc
  | 'MISMATCH'    // Model matches expected, but Qantas calculator returned a different value
  | 'SKIP'        // Route skipped (multi-leg in browser mode, or filtered out)
  | 'ERROR'       // Scraper error (browser issue, airport not found, etc.)
  | 'DRY_PASS'    // Model matches expected (dry-run mode, no browser check)
  | 'UNVERIFIABLE'; // Airport not found in Qantas calculator (QF doesn't fly route)

interface RouteResult {
  route: QARoute;
  status: ScraperStatus;
  model_sc: number | null;
  qantas_sc: number | null;
  expected_sc: number;
  model_table: string | null;
  error?: string;
  duration_ms: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const QANTAS_CALCULATOR_URL =
  'https://www.qantas.com/au/en/frequent-flyer/calculators.html';

/**
 * Maps our cabin_class to the label shown in the Qantas calculator results table.
 * NOTE: our 'business' tier corresponds to 'Discount Business' in the Qantas UI —
 * the calculator also has a higher 'Business' tier we don't separately model.
 */
const CABIN_CLASS_TO_QANTAS_LABEL: Record<string, string> = {
  discount_economy: 'Discount Economy',
  economy: 'Economy',
  flexible_economy: 'Flexible Economy',
  premium_economy: 'Premium Economy',
  business: 'Discount Business',
  first: 'First',
};

/**
 * Maps our IATA airline code to the label in the Qantas calculator's
 * "Earn Category" / airline dropdown.
 */
const AIRLINE_TO_EARN_CATEGORY: Record<string, string> = {
  QF: 'Qantas',
  AA: 'American Airlines',
  BA: 'British Airways',
  CX: 'Cathay Pacific',
  JL: 'Japan Airlines',
  MH: 'Malaysia Airlines',
  QR: 'Qatar Airways',
  RJ: 'Royal Jordanian',
  UL: 'SriLankan Airlines',
};

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isHeadless = args.includes('--headless') || isDryRun;
const idFilter = args.find((_, i) => args[i - 1] === '--id');
const airlineFilter = args.find((_, i) => args[i - 1] === '--airline');

// ─── Route filtering ──────────────────────────────────────────────────────────

const allRoutes = qaRoutesData.routes as QARoute[];

const routes = allRoutes.filter((r) => {
  if (idFilter && r.id !== idFilter) return false;
  if (airlineFilter && r.airline !== airlineFilter) return false;
  return true;
});

console.log(`\nQFF Status Credit QA Scraper`);
console.log(`${'─'.repeat(50)}`);
console.log(`Mode: ${isDryRun ? 'dry-run (model only)' : 'browser + model'}`);
console.log(`Routes: ${routes.length} of ${allRoutes.length} total`);
console.log(`${'─'.repeat(50)}\n`);

// ─── Model check (runs regardless of mode) ───────────────────────────────────

function runModelCheck(route: QARoute): {
  model_sc: number;
  model_table: string | null;
  status: 'PASS' | 'FAIL';
  error?: string;
} {
  try {
    const result = calculateStatusCredits(
      route.routing,
      route.cabin_class,
      route.airline,
    );
    const model_sc = result.total_status_credits;
    const model_table =
      route.routing.length === 2 ? result.legs[0]?.matched_table ?? null : null;

    return {
      model_sc,
      model_table,
      status: model_sc === route.expected_total_sc ? 'PASS' : 'FAIL',
    };
  } catch (err) {
    return {
      model_sc: 0,
      model_table: null,
      status: 'FAIL',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Playwright browser scraper ───────────────────────────────────────────────

/**
 * Scrape a single leg from the Qantas calculator.
 * Returns the SC value for the specified cabin class, or null if not found.
 */
async function scrapeOneLeg(
  page: Page,
  from: string,
  to: string,
  airline: string,
  cabinClass: string,
): Promise<{ sc: number | null; error?: string }> {
  const earnCategory = AIRLINE_TO_EARN_CATEGORY[airline];
  if (!earnCategory) {
    return { sc: null, error: `No earn category mapping for airline: ${airline}` };
  }

  const targetLabel = CABIN_CLASS_TO_QANTAS_LABEL[cabinClass];
  if (!targetLabel) {
    return { sc: null, error: `No Qantas label mapping for cabin class: ${cabinClass}` };
  }

  try {
    // ── Navigate to calculator ────────────────────────────────────────────────
    await page.goto(QANTAS_CALCULATOR_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(2_000); // Wait for React to render

    // ── Dismiss cookie banner if present ─────────────────────────────────────
    try {
      const cookieBtn = page.getByRole('button', { name: /accept|ok|got it/i }).first();
      if (await cookieBtn.isVisible({ timeout: 2_000 })) {
        await cookieBtn.click();
        await page.waitForTimeout(500);
      }
    } catch { /* No cookie banner */ }

    // ── Enter "From" airport ──────────────────────────────────────────────────
    // The calculator uses a combobox/autocomplete for From/To fields
    const fromInput = page.locator('input').filter({ hasText: '' }).first();
    // Try multiple selector strategies for the From field
    const fromField =
      page.locator('[data-testid="from-input"]').first() ||
      page.locator('input[placeholder*="From" i]').first() ||
      page.locator('input[aria-label*="From" i]').first();

    // Use the most reliable approach: find by label text, then navigate to input
    const fromLabel = page.locator('label', { hasText: /from/i }).first();
    const fromInputEl = fromLabel.locator('..').locator('input').first();

    if (await fromInputEl.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await fromInputEl.click();
      await fromInputEl.fill(from);
    } else {
      // Fallback: find first visible text input
      await page.locator('input[type="text"]').first().click();
      await page.locator('input[type="text"]').first().fill(from);
    }
    await page.waitForTimeout(1_000);

    // Select first suggestion from dropdown
    const firstSuggestion = page.locator('[role="option"]').first();
    if (await firstSuggestion.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await firstSuggestion.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(500);

    // ── Enter "To" airport ────────────────────────────────────────────────────
    const toLabel = page.locator('label', { hasText: /to/i }).first();
    const toInputEl = toLabel.locator('..').locator('input').first();

    if (await toInputEl.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await toInputEl.click();
      await toInputEl.fill(to);
    } else {
      // Fallback: find second visible text input
      const inputs = page.locator('input[type="text"]');
      await inputs.nth(1).click();
      await inputs.nth(1).fill(to);
    }
    await page.waitForTimeout(1_000);

    // Select first suggestion
    const toSuggestion = page.locator('[role="option"]').first();
    if (await toSuggestion.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await toSuggestion.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(500);

    // ── Select Earn Category (airline) ────────────────────────────────────────
    // After changing To, the Earn Category dropdown may reset — always re-select
    const earnCategoryDropdown = page
      .locator('select, [role="combobox"]')
      .filter({ hasText: /earn category|airline/i })
      .first();

    if (await earnCategoryDropdown.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await earnCategoryDropdown.selectOption({ label: earnCategory });
    } else {
      // Try finding a dropdown that contains the airline name as an option
      const dropdowns = page.locator('select');
      const count = await dropdowns.count();
      for (let i = 0; i < count; i++) {
        const dropdown = dropdowns.nth(i);
        const options = await dropdown.locator('option').allTextContents();
        if (options.some((o) => o.includes(earnCategory))) {
          await dropdown.selectOption({ label: earnCategory });
          break;
        }
      }
    }
    await page.waitForTimeout(500);

    // ── Click Calculate ───────────────────────────────────────────────────────
    const calculateBtn = page
      .getByRole('button', { name: /calculate/i })
      .first();
    await calculateBtn.click();
    await page.waitForTimeout(3_000); // Wait for results to load

    // ── Expand "Show More" if present ─────────────────────────────────────────
    const showMoreBtn = page
      .getByRole('button', { name: /show more/i })
      .first();
    if (await showMoreBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await showMoreBtn.click();
      await page.waitForTimeout(1_000);
    }

    // ── Extract SC for target cabin class ─────────────────────────────────────
    // The results table has rows with the cabin class name and SC value.
    // DOM pattern discovered via inspection: rows with class containing "fare-table__row"
    // Each row has a child element with the class name label and one with the SC value.
    const sc = await page.evaluate((label: string) => {
      // Try the known class pattern first
      const rows = document.querySelectorAll('[class*="fare-table__row"], [class*="fareTable__row"]');
      for (const row of rows) {
        const nameEl = row.querySelector('[class*="class__name"], [class*="className"], [class*="fare-class"]');
        const creditsEl = row.querySelector('[class*="credits"], [class*="status-credit"], [class*="statusCredit"]');
        if (nameEl && creditsEl) {
          const rowLabel = nameEl.textContent?.trim() ?? '';
          if (rowLabel === label || rowLabel.includes(label)) {
            const creditsText = creditsEl.textContent?.trim().replace(/[^0-9]/g, '') ?? '';
            const credits = parseInt(creditsText, 10);
            return isNaN(credits) ? null : credits;
          }
        }
      }

      // Fallback: search all table cells for the label, then find adjacent number
      const allCells = document.querySelectorAll('td, th, [role="cell"], [role="columnheader"]');
      for (const cell of allCells) {
        if (cell.textContent?.trim() === label) {
          const row = cell.parentElement;
          if (row) {
            const cells = row.querySelectorAll('td, [role="cell"]');
            for (const c of cells) {
              const num = parseInt(c.textContent?.trim().replace(/[^0-9]/g, '') ?? '', 10);
              if (!isNaN(num) && num > 0 && num < 1000) return num;
            }
          }
        }
      }
      return null;
    }, targetLabel);

    if (sc === null) {
      // Check if the airport wasn't found (calculator shows an error)
      const pageText = await page.locator('body').textContent();
      if (pageText?.toLowerCase().includes("can't find") || pageText?.toLowerCase().includes('no results')) {
        return { sc: null, error: `Airport not found in Qantas calculator (${from} or ${to})` };
      }
      return { sc: null, error: `Could not find row for "${targetLabel}" in results table` };
    }

    return { sc };
  } catch (err) {
    return {
      sc: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Main runner ──────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const results: RouteResult[] = [];

  // Dry-run mode: only check model against expected, no browser
  if (isDryRun) {
    for (const route of routes) {
      const start = Date.now();
      const check = runModelCheck(route);
      results.push({
        route,
        status: check.status === 'PASS' ? 'DRY_PASS' : 'FAIL',
        model_sc: check.model_sc,
        qantas_sc: null,
        expected_sc: route.expected_total_sc,
        model_table: check.model_table,
        error: check.error,
        duration_ms: Date.now() - start,
      });

      const icon = check.status === 'PASS' ? '✓' : '✗';
      console.log(
        `${icon} ${route.id}: ${route.description} (${check.model_sc} SC)`,
      );
    }
  } else {
    // Browser mode: scrape Qantas calculator for each single-leg route
    const browser = await chromium.launch({ headless: isHeadless });
    const context = await browser.newContext();
    const page = await context.newPage();

    for (const route of routes) {
      const start = Date.now();
      console.log(`\n→ ${route.id}: ${route.description}`);

      // First, check the model
      const modelCheck = runModelCheck(route);
      const modelOk = modelCheck.status === 'PASS';

      // Skip browser scraping for multi-leg routes (sum of individual legs)
      if (route.routing.length > 2) {
        results.push({
          route,
          status: modelOk ? 'PASS' : 'FAIL',
          model_sc: modelCheck.model_sc,
          qantas_sc: null,
          expected_sc: route.expected_total_sc,
          model_table: null,
          error: modelCheck.error ?? 'Multi-leg: browser check skipped (each leg verified separately)',
          duration_ms: Date.now() - start,
        });
        console.log(
          `  Model: ${modelCheck.model_sc} SC (expected ${route.expected_total_sc}) — ${modelOk ? 'PASS' : 'FAIL'}`,
        );
        console.log(`  Qantas calculator: SKIP (multi-leg route)`);
        continue;
      }

      // Single-leg: also scrape the Qantas calculator
      const [from, to] = route.routing;
      const scrapeResult = await scrapeOneLeg(page, from, to, route.airline, route.cabin_class);

      const qantas_sc = scrapeResult.sc;
      let status: ScraperStatus;

      if (scrapeResult.error?.includes('not found') || scrapeResult.error?.includes('no results')) {
        status = 'UNVERIFIABLE';
      } else if (scrapeResult.error) {
        status = 'ERROR';
      } else if (!modelOk) {
        status = 'FAIL';
      } else if (qantas_sc !== null && qantas_sc !== route.expected_total_sc) {
        status = 'MISMATCH';
      } else {
        status = 'PASS';
      }

      results.push({
        route,
        status,
        model_sc: modelCheck.model_sc,
        qantas_sc,
        expected_sc: route.expected_total_sc,
        model_table: modelCheck.model_table,
        error: modelCheck.error ?? scrapeResult.error,
        duration_ms: Date.now() - start,
      });

      const statusIcon =
        status === 'PASS' ? '✓' :
        status === 'UNVERIFIABLE' ? '~' :
        status === 'ERROR' ? '?' :
        '✗';
      console.log(`  Model: ${modelCheck.model_sc} SC (expected ${route.expected_total_sc}) — ${modelOk ? 'PASS' : 'FAIL'}`);
      console.log(`  Qantas calculator: ${qantas_sc ?? 'n/a'} SC — ${status}`);
      if (scrapeResult.error) console.log(`  Error: ${scrapeResult.error}`);
    }

    await browser.close();
  }

  // ── Print summary ─────────────────────────────────────────────────────────
  const pass = results.filter((r) => r.status === 'PASS' || r.status === 'DRY_PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  const mismatch = results.filter((r) => r.status === 'MISMATCH').length;
  const unverifiable = results.filter((r) => r.status === 'UNVERIFIABLE').length;
  const errors = results.filter((r) => r.status === 'ERROR').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${pass} pass | ${fail} fail | ${mismatch} mismatch | ${unverifiable} unverifiable | ${errors} error | ${skipped} skip`);
  console.log(`${'─'.repeat(50)}\n`);

  // ── Write RESULTS.md ──────────────────────────────────────────────────────
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const resultsPath = join(__dirname, 'RESULTS.md');
  writeFileSync(resultsPath, generateResultsMd(results, isDryRun), 'utf-8');
  console.log(`Results written to tests/qa/RESULTS.md`);

  // Exit with error code if any failures
  if (fail > 0 || mismatch > 0) process.exit(1);
}

// ─── RESULTS.md generator ─────────────────────────────────────────────────────

function generateResultsMd(results: RouteResult[], dryRun: boolean): string {
  const now = new Date().toISOString().split('T')[0];
  const pass = results.filter((r) => r.status === 'PASS' || r.status === 'DRY_PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  const mismatch = results.filter((r) => r.status === 'MISMATCH').length;
  const unverifiable = results.filter((r) => r.status === 'UNVERIFIABLE').length;

  const statusIcon = (s: ScraperStatus) => {
    switch (s) {
      case 'PASS':
      case 'DRY_PASS': return '✅';
      case 'FAIL': return '❌';
      case 'MISMATCH': return '⚠️';
      case 'UNVERIFIABLE': return '🔵';
      case 'ERROR': return '🟡';
      case 'SKIP': return '⬜';
    }
  };

  const groupedByCategory = new Map<string, RouteResult[]>();
  for (const r of results) {
    const cat = r.route.category;
    if (!groupedByCategory.has(cat)) groupedByCategory.set(cat, []);
    groupedByCategory.get(cat)!.push(r);
  }

  let md = `# QFF Status Credit Calculator — QA Results\n\n`;
  md += `**Generated:** ${now}  \n`;
  md += `**Mode:** ${dryRun ? 'Dry-run (model only — no Qantas calculator comparison)' : 'Full (model + Qantas calculator)'}  \n`;
  md += `**Routes tested:** ${results.length}  \n\n`;

  md += `## Summary\n\n`;
  md += `| Status | Count |\n|--------|-------|\n`;
  md += `| ✅ Pass | ${pass} |\n`;
  if (fail > 0) md += `| ❌ Fail | ${fail} |\n`;
  if (mismatch > 0) md += `| ⚠️ Mismatch (calculator disagrees) | ${mismatch} |\n`;
  if (unverifiable > 0) md += `| 🔵 Unverifiable (airport not in calculator) | ${unverifiable} |\n`;
  md += `\n`;

  md += `## Legend\n\n`;
  md += `| Icon | Meaning |\n|------|---------|\n`;
  md += `| ✅ | Model output matches expected SC |\n`;
  md += `| ❌ | Model output does NOT match expected SC (bug) |\n`;
  md += `| ⚠️ | Model matches expected, but Qantas calculator returned a different value (data discrepancy) |\n`;
  md += `| 🔵 | Route cannot be verified (airport not found in Qantas calculator) |\n`;
  md += `| 🟡 | Scraper error during verification |\n`;
  md += `| ⬜ | Skipped (multi-leg route verified leg-by-leg) |\n\n`;

  for (const [category, categoryResults] of groupedByCategory) {
    md += `## ${categoryLabel(category)}\n\n`;

    if (dryRun) {
      md += `| ID | Description | Expected SC | Model SC | Table | Status |\n`;
      md += `|----|-------------|-------------|----------|-------|--------|\n`;
      for (const r of categoryResults) {
        const tableStr = r.model_table ?? (r.route.routing.length > 2 ? 'multi-leg' : '—');
        md += `| ${r.route.id} | ${r.route.description} | ${r.expected_sc} | ${r.model_sc ?? '—'} | \`${tableStr}\` | ${statusIcon(r.status)} |\n`;
      }
    } else {
      md += `| ID | Description | Expected SC | Model SC | Qantas SC | Status |\n`;
      md += `|----|-------------|-------------|----------|-----------|--------|\n`;
      for (const r of categoryResults) {
        const qantasStr = r.qantas_sc !== null ? String(r.qantas_sc) : '—';
        const statusStr = r.status === 'UNVERIFIABLE' ? `🔵 ${r.error?.split(':')[0] ?? ''}` :
                         r.status === 'ERROR' ? `🟡 Error` :
                         statusIcon(r.status);
        md += `| ${r.route.id} | ${r.route.description} | ${r.expected_sc} | ${r.model_sc ?? '—'} | ${qantasStr} | ${statusStr} |\n`;
      }
    }
    md += `\n`;
  }

  md += `## Notes\n\n`;
  md += `- **Source of truth:** [Qantas partner earning tables](https://www.qantas.com/au/en/frequent-flyer/earn-points/airline-earning-tables/partner-airline-earning-tables.html)\n`;
  md += `- **Our \`business\` tier** maps to "Discount Business" in the Qantas calculator (one tier below the unrestricted "Business" rate)\n`;
  md += `- **Our \`flexible_economy\` tier** maps to "Flexible Economy" in the calculator (= 50% of Discount Business rate)\n`;
  md += `- Routes with 🔵 cannot be verified because QF doesn't operate that route, or the Qantas calculator doesn't recognise the airport\n`;
  md += `- To re-run: \`npm run scrape\` (full), \`npm run scrape -- --dry-run\` (model only)\n`;

  return md;
}

function categoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    intra_usa_short_haul: 'Intra-USA Short Haul',
    east_west_coast: 'East ↔ West Coast USA/Canada',
    dallas_east_coast: 'Dallas ↔ East Coast USA/Canada',
    dallas_west_coast: 'Dallas ↔ West Coast USA/Canada',
    aus_west_coast_usa: 'Australia East Coast ↔ West Coast USA',
    aus_east_coast_usa: 'Australia East Coast ↔ East Coast USA',
    aus_dallas: 'Australia East Coast ↔ Dallas',
    us_canada: 'US/Canada Short Haul',
    multi_leg: 'Multi-Leg Routings',
    new_zealand: 'Australia ↔ New Zealand (QF)',
    asia: 'Australia ↔ Asia (QF)',
    europe: 'Australia ↔ Europe (QF)',
    middle_east: 'Australia ↔ Middle East (QF)',
    usa: 'Australia ↔ USA (QF)',
    domestic: 'QF Domestic Australia',
    intra_region: 'Intra-Region',
    perth: 'Perth Routes (QF)',
  };
  return labels[cat] ?? cat;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

run().catch((err) => {
  console.error('Scraper failed:', err);
  process.exit(1);
});
