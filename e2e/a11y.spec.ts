import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Audit the settled UI: entrance fades would otherwise be measured mid-animation.
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const code = Buffer.from(JSON.stringify({ region: 'in' })).toString('base64url');

for (const [name, path] of [
  ['landing', '/'],
  ['region', '/region'],
  ['configurator', `/build/paint?b=${code}`],
  ['reveal', `/reveal?b=${code}`],
  ['blueprint', '/blueprint'],
] as const) {
  test(`${name} has no serious accessibility violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForTimeout(4500);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map(
        (v) =>
          `${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes
            .slice(0, 3)
            .map((n) => n.target.join(' '))
            .join(' | ')}`,
      );
    expect(serious).toEqual([]);
  });
}
