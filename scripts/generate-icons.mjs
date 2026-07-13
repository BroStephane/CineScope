// Generates the PWA icon PNGs referenced by the VitePWA manifest
// (astro.config.mjs) from the SVG sources in public/icons/.
//
// Usage: node scripts/generate-icons.mjs
// Requires the `playwright` package (and its chromium browser) to be
// available — run `npx playwright install chromium` first if needed.
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

async function renderSvgToPng(svgPath, size, outPath) {
  const svg = await readFile(svgPath, 'utf-8');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    const html = `<!doctype html><html><head><style>
      html,body{margin:0;padding:0;}
      svg{display:block;width:${size}px;height:${size}px;}
    </style></head><body>${svg}</body></html>`;
    await page.setContent(html);
    const element = await page.$('svg');
    await element.screenshot({ path: outPath });
  } finally {
    await browser.close();
  }
}

async function main() {
  const standardSvg = path.join(iconsDir, 'icon.svg');
  const maskableSvg = path.join(iconsDir, 'icon-maskable.svg');

  await renderSvgToPng(standardSvg, 192, path.join(iconsDir, 'icon-192.png'));
  await renderSvgToPng(standardSvg, 512, path.join(iconsDir, 'icon-512.png'));
  await renderSvgToPng(maskableSvg, 512, path.join(iconsDir, 'icon-512-maskable.png'));

  console.log('Generated icon-192.png, icon-512.png, icon-512-maskable.png in public/icons/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
