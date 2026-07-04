import { test, expect } from '@playwright/test'
import { setup, pushState, getLastEmit, getEmitted } from './helpers'
import { handBuildState } from './game-states'

test.describe('HandBuildScreen', () => {
  test.beforeEach(async ({ page }) => { await setup(page) })

  test('shows the current hand and the draft card', async ({ page }) => {
    await pushState(page, handBuildState())
    await expect(page.getByRole('button', { name: /Hunt/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Punk's Posse/i })).toBeVisible()
  })

  test('selecting a draft card and confirming emits selectHandCard', async ({ page }) => {
    await pushState(page, handBuildState())
    await page.getByRole('button', { name: /Punk's Posse/i }).click()
    await page.locator('.handbuild__confirm-btn').click()
    const last = await getLastEmit(page)
    expect(last).toMatchObject({ event: 'selectHandCard', data: 'BR02' })
  })

  test('confirm bar is hidden until a draft card is selected', async ({ page }) => {
    await pushState(page, handBuildState())
    await expect(page.locator('.handbuild__confirm-btn')).not.toBeVisible()
    await page.getByRole('button', { name: /Punk's Posse/i }).click()
    await expect(page.locator('.handbuild__confirm-btn')).toBeVisible()
  })

  test('重新選擇 clears the pending card selection', async ({ page }) => {
    await pushState(page, handBuildState())
    await page.getByRole('button', { name: /Punk's Posse/i }).click()
    await expect(page.locator('.handbuild__confirm-btn')).toBeVisible()
    await page.getByText('重新選擇').click()
    await expect(page.locator('.handbuild__confirm-btn')).not.toBeVisible()
  })

  test('no confirm button and no draft cards when the draft is empty', async ({ page }) => {
    await pushState(page, handBuildState([]))
    await expect(page.locator('.handbuild__confirm-btn')).not.toBeVisible()
    await expect(page.getByRole('button', { name: /Punk's Posse/i })).not.toBeVisible()
  })

  test('multiple draft cards are all shown', async ({ page }) => {
    const extra = { id: 'BR03', name_en: 'Pack Tactics', name_zh: 'Pack Tactics', clan: 'brujah', type: 'conflict', power: 5, effect_en: null, effect_zh: null, is_starter: false }
    const card1 = { id: 'BR02', name_en: "Punk's Posse", name_zh: "Punk's Posse", clan: 'brujah', type: 'conflict', power: 4, effect_en: null, effect_zh: null, is_starter: false }
    await pushState(page, handBuildState([card1, extra]))
    await expect(page.getByRole('button', { name: /Punk's Posse/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Pack Tactics/i })).toBeVisible()
  })
})
