import { expect, test } from '@playwright/test';

const code = Buffer.from(
  JSON.stringify({
    region: 'in',
    body: 'suv',
    mods: ['lift', 'rack'],
    seating: 'lounge',
    headliner: 'starlight',
  }),
).toString('base64url');

test('the reveal tells the story of the build and ends on the specification', async ({ page }) => {
  await page.goto(`/reveal?b=${code}`);
  await expect(page.getByRole('heading', { name: 'Your SUV is ready.' })).toBeVisible();
  await expect(page.getByLabel(/^Design ID AF-IN-\d{5}$/)).toBeVisible();

  const scroller = page.getByRole('region', { name: 'Your build' });
  // Each chapter reports the user's own choices.
  await scroller.evaluate((el) => el.scrollTo(0, innerHeight * 2));
  await expect(page.getByRole('definition').filter({ hasText: 'Lift kit, Roof rack' })).toBeVisible();
  await scroller.evaluate((el) => el.scrollTo(0, innerHeight * 4));
  await expect(page.getByRole('definition').filter({ hasText: 'Four-seat lounge' })).toBeVisible();

  // The last chapter carries the full spec and the next steps.
  await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await expect(page.getByRole('region', { name: 'Specification' })).toContainText('Starlight');
  await expect(page.getByRole('button', { name: 'Copy build code' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit build' }).click();
  await expect(page).toHaveURL(/\/build\//);
});
