const puppeteer = require('puppeteer-core')

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1400,900'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1400, height: 900 })
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('  [console.error]', m.text().slice(0, 300))
  })
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message.slice(0, 300)))

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2', timeout: 30000 })
  await sleep(1000)

  // Open the settings tab via the gear button in the global bar
  const gear = await page.$('.global-bar__tool[title="设置"]')
  if (!gear) { console.log('NO GEAR BUTTON'); await browser.close(); return }
  await gear.click()
  await sleep(600)

  // Inspect initial tab bar state
  const pills = await page.$$eval('[role="tab"]', els => els.map(e => ({ text: e.textContent.trim(), selected: e.getAttribute('aria-selected'), active: e.className.includes('tab-bar__tab--active') })))
  console.log('PILLS AFTER OPEN SETTINGS:', JSON.stringify(pills, null, 2))

  // Visible tab panels in main content
  const visiblePanels = await page.$$eval('.tab-content [role="tabpanel"]', els =>
    els.filter(p => p.style.display !== 'none').map(p => ({ text: p.textContent.slice(0, 40), cls: p.className })))
  console.log('VISIBLE MAIN PANELS:', JSON.stringify(visiblePanels, null, 2))

  // Find the settings pill and drag it
  const pillInfo = await page.$$eval('[role="tab"]', (els) => {
    const p = els.find(e => e.textContent.includes('设置'))
    if (!p) return null
    const r = p.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  console.log('SETTINGS PILL POS:', JSON.stringify(pillInfo))

  if (pillInfo) {
    const { x, y } = pillInfo
    // pointerdown -> move beyond threshold (6px) -> move -> up
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 40, y + 60, { steps: 5 })
    await sleep(100)
    await page.mouse.move(x + 120, y + 160, { steps: 5 })
    await sleep(100)
    await page.mouse.up()
    await sleep(800)
  }

  // ---- AFTER DETACH: dump state ----
  console.log('\n===== AFTER DETACH =====')
  const pillsAfter = await page.$$eval('[role="tab"]', els => els.map(e => ({ text: e.textContent.trim(), selected: e.getAttribute('aria-selected'), active: e.className.includes('tab-bar__tab--active') })))
  console.log('PILLS AFTER DETACH:', JSON.stringify(pillsAfter, null, 2))

  const visiblePanelsAfter = await page.$$eval('.tab-content [role="tabpanel"]', els =>
    els.filter(p => p.style.display !== 'none').map(p => ({ text: p.textContent.slice(0, 60), cls: p.className })))
  console.log('VISIBLE MAIN PANELS AFTER:', JSON.stringify(visiblePanelsAfter, null, 2))

  const overlayExists = await page.$eval('#floating-overlay', el => !!el).catch(() => false)
  const overlayChildren = overlayExists
    ? await page.$$eval('#floating-overlay > *', els => els.map(e => ({ cls: e.className, text: e.textContent.slice(0, 40), disp: e.style.display })))
    : null
  console.log('OVERLAY CHILDREN:', JSON.stringify(overlayChildren))

  const floatingChrome = await page.$$eval('[data-testid^="floating-window-"]', els => els.map(e => ({ testid: e.getAttribute('data-testid'), rect: e.getBoundingClientRect().toJSON() })))
  console.log('FLOATING CHROME:', JSON.stringify(floatingChrome))

  // Screen dims of market panel & main area
  const marketPanelVisible = await page.$$eval('.tab-content [role="tabpanel"]', els =>
    els.some(p => p.style.display !== 'none' && p.textContent.includes('行情')))
  console.log('MAIN SHOWS MARKET CONTENT:', marketPanelVisible)

  await page.screenshot({ path: 'repro-after-detach.png' })
  await browser.close()
  console.log('\nDONE')
}

main().catch((e) => { console.error('SCRIPT ERROR:', e); process.exit(1) })
