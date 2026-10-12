import { expect, test, type Page } from '@playwright/test';

const panel = (page: Page) => page.getByRole('complementary', { name: 'Options' });
const price = (page: Page) => page.locator('[aria-live="polite"]').filter({ hasText: 'Estimated price' });

test.beforeEach(async ({ page }) => {
  await page.goto('/region');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/region');
});

test('region, build, locked option, undo, region change', async ({ page, isMobile }) => {
  await page.getByRole('radio', { name: /India/ }).click();
  await page.getByRole('button', { name: 'Start designing' }).click();
  await expect(page).toHaveURL(/\/build\/shape\?b=/);
  await expect(price(page)).toContainText('₹1,20,44,000');

  // The body style sets the base price; switch to an SUV and back.
  await panel(page).getByRole('radio', { name: /^SUV/ }).click();
  await expect(price(page)).toContainText('₹1,16,30,000');
  await panel(page)
    .getByRole('radio', { name: /^Coupe/ })
    .click();
  await expect(price(page)).toContainText('₹1,20,44,000');
  await panel(page)
    .getByRole('button', { name: /^Next: Paint/ })
    .click();
  await expect(page).toHaveURL(/\/build\/paint/);

  // Pick a paint: price and history update.
  await panel(page)
    .getByRole('radio', { name: /^Ultramarine/ })
    .click();
  await expect(price(page)).toContainText('₹1,22,10,000');
  if (!isMobile) await expect(page.getByText('Paint: Ultramarine')).toBeVisible();

  // A locked option explains itself and changes nothing.
  await panel(page)
    .getByRole('button', { name: /^Next: Livery/ })
    .click();
  await panel(page)
    .getByRole('button', { name: /^Next: Graphics/ })
    .click();
  await panel(page)
    .getByRole('button', { name: /^Next: Wheels and brakes/ })
    .click();
  await expect(page).toHaveURL(/\/build\/wheels/);
  await panel(page).getByRole('radio', { name: '22"' }).click({ force: true });
  await expect(page.getByRole('alert').filter({ hasText: 'Not offered in India' })).toBeVisible();
  await expect(panel(page).getByRole('radio', { name: '20"' })).toHaveAttribute('aria-checked', 'true');

  // Undo with the keyboard restores the paint.
  await page.locator('body').click({ position: { x: 5, y: 450 } });
  await page.keyboard.press('ControlOrMeta+z');
  await expect(price(page)).toContainText('₹1,20,44,000');

  // Interior steps switch to the cabin view.
  await page.getByRole('navigation', { name: 'Build steps' }).getByRole('button', { name: /Seats/ }).click();
  await expect(page.getByRole('tab', { name: 'Cabin' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tab', { name: 'Studio' })).toHaveAttribute('aria-selected', 'true');
});

test('region change mid-build swaps exclusives with a reason', async ({ page }) => {
  await page.getByRole('radio', { name: /India/ }).click();
  await page.getByRole('button', { name: 'Start designing' }).click();
  await panel(page)
    .getByRole('button', { name: /^Next: Paint/ })
    .click();
  await panel(page)
    .getByRole('radio', { name: /^Saffron Dusk/ })
    .click();
  await page.getByRole('button', { name: /Region: India/ }).click();
  await expect(page).toHaveURL(/\/region/);
  await page.getByRole('radio', { name: /Europe/ }).click();
  await page.getByRole('button', { name: 'Start designing' }).click();
  await expect(page).toHaveURL(/\/build\//);
  await expect(page.getByText('Saffron Dusk replaced with Onyx Black.')).toBeVisible({ timeout: 6000 });
  await expect(price(page)).toContainText('€');
});
