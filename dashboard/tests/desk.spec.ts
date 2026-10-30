import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.beforeEach(async ({ page }) => { await page.goto('/'); await expect(page.locator('article').first()).toBeVisible() })

test('ค้นหา', async ({ page }) => {
  await page.keyboard.press('/')
  await page.keyboard.type('NFLX')
  const titles = await page.locator('article h3').allInnerTexts()
  expect(titles.length).toBeGreaterThan(0)
  await page.getByLabel('ค้นหา').fill('ไม่มีคำนี้แน่นอน')
  await expect(page.getByText('ไม่พบ')).toBeVisible()
})

test('กรอง', async ({ page }) => {
  await page.getByRole('button', { name: 'สกิล', exact: true }).click()
  await expect(page.locator('article')).toHaveCount(7)
})

test('สลับการ์ดกับรายการ', async ({ page }) => {
  await page.getByRole('radio', { name: 'รายการ' }).click()
  await expect(page.getByTestId('list')).toBeVisible()
  await page.reload()
  await expect(page.getByTestId('list')).toBeVisible()
})

test('เปิดและปิดรายละเอียดด้วย Esc', async ({ page }) => {
  await page.getByRole('button', { name: 'Hypothesis', exact: true }).click()
  await page.locator('article h3 button').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page).toHaveURL(/#H-001/)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
})

test('คัดลอกคำสั่งแล้วมี toast', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByRole('button', { name: 'สกิล', exact: true }).click()
  await page.getByRole('button', { name: /คัดลอก \/ask-wiki/ }).click()
  await expect(page.getByText('คัดลอกแล้ว วางใน agent ได้เลย')).toBeVisible()
})

for (const scheme of ['light', 'dark'] as const) {
  test(`axe ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await page.goto('/'); await expect(page.locator('article').first()).toBeVisible(); await page.waitForTimeout(400)
    const r = await new AxeBuilder({ page }).analyze()
    const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).slice(0, 3).join(' | ')}`)).toEqual([])
  })
}

test('จอ 390px ไม่มี scroll แนวนอน', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 860 })
  await page.goto('/'); await expect(page.locator('article').first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('แผนที่: 4 layout และกด atom แล้วเห็นที่มา', async ({ page }) => {
  await page.getByRole('radio', { name: 'แผนที่ความรู้' }).click()
  await expect(page.locator('.react-flow__node').first()).toBeVisible()
  await page.locator('.react-flow__node').filter({ hasText: 'margin +6.4' }).first().click()
  await expect(page.getByText('ที่มา: Item 2 Cost of Revenues')).toBeVisible()
  await expect(page.getByText('ไม่ตรงกัน').first()).toBeVisible()
  for (const name of ['ไล่ที่มา', 'ตามเวลา']) {
    await page.getByRole('radio', { name }).click()
    await expect(page.locator('.react-flow__node').first()).toBeVisible()
  }
  await page.getByRole('radio', { name: 'ภาพรวม' }).click()
  await expect(page.locator('g.fv-node').first()).toBeVisible()
})

test('ภาพรวม: ลากได้ กดแล้วเห็นรายละเอียด และกรองเส้นข้ามเอกสาร', async ({ page }) => {
  await page.getByRole('radio', { name: 'แผนที่ความรู้' }).click()
  await page.getByRole('radio', { name: 'ภาพรวม' }).click()
  const doc = page.locator('g.fv-node[aria-label="doc: 10-Q 3Q2026"]')
  const before = await doc.getAttribute('transform')
  await page.waitForTimeout(400)
  expect(await doc.getAttribute('transform')).not.toBe(before)   // ยังไหลอยู่
  await doc.focus(); await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'ดูแก่น' })).toBeVisible()
  await page.getByRole('switch').click()
  await expect(page.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  const r = await new AxeBuilder({ page }).analyze()
  expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
})

test('axe แผนที่', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('radio', { name: 'แผนที่ความรู้' }).click()
  await expect(page.locator('.react-flow__node').first()).toBeVisible()
  const r = await new AxeBuilder({ page }).analyze()
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).slice(0, 3).join(' | ')}`)).toEqual([])
})
