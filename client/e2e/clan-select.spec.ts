import { test, expect } from '@playwright/test'
import { setup, pushState, getLastEmit, getEmitted } from './helpers'
import { clanSelectState } from './game-states'

const ALL_CLANS = [
  { clan: 'brujah',    label: 'Brujah' },
  { clan: 'nosferatu', label: 'Nosferatu' },
  { clan: 'toreador',  label: 'Toreador' },
  { clan: 'tremere',   label: 'Tremere' },
  { clan: 'malkavian', label: 'Malkavian' },
  { clan: 'gangrel',   label: 'Gangrel' },
  { clan: 'ventrue',   label: 'Ventrue' },
]

test.describe('ClanSelectScreen', () => {
  test.beforeEach(async ({ page }) => { await setup(page) })

  test('shows all 7 clan buttons when no clan has been chosen', async ({ page }) => {
    await pushState(page, clanSelectState())
    for (const { label } of ALL_CLANS) {
      await expect(page.getByRole('button', { name: new RegExp(label, 'i') })).toBeVisible()
    }
  })

  for (const { clan, label } of ALL_CLANS) {
    test(`clicking ${label} emits selectClan "${clan}"`, async ({ page }) => {
      await pushState(page, clanSelectState())
      await page.getByRole('button', { name: new RegExp(label, 'i') }).click()
      const last = await getLastEmit(page)
      expect(last).toMatchObject({ event: 'selectClan', data: clan })
    })
  }

  test('disables a clan button another player has taken', async ({ page }) => {
    await pushState(page, clanSelectState(null, [{ id: 'p2', name: 'Bob', clan: 'brujah' }]))
    await expect(page.getByRole('button', { name: /Brujah/i })).toBeDisabled()
    // Other clans are still available
    await expect(page.getByRole('button', { name: /Gangrel/i })).not.toBeDisabled()
  })

  test('disables all clan buttons once the local player has already chosen', async ({ page }) => {
    await pushState(page, clanSelectState('gangrel'))
    for (const { label } of ALL_CLANS) {
      await expect(page.getByRole('button', { name: new RegExp(label, 'i') })).toBeDisabled()
    }
  })

  test('does not emit when clicking a taken clan (force-click disabled button)', async ({ page }) => {
    await pushState(page, clanSelectState(null, [{ id: 'p2', name: 'Bob', clan: 'ventrue' }]))
    // The button is disabled; force the click to confirm the handler is never reached
    await page.getByRole('button', { name: /Ventrue/i }).click({ force: true })
    const emits = await getEmitted(page)
    expect(emits).toHaveLength(0)
  })

  test('shows status message with the chosen clan name after selection', async ({ page }) => {
    await pushState(page, clanSelectState('gangrel'))
    const status = page.locator('.clan-select__status')
    await expect(status).toContainText('你選擇了')
    await expect(status).toContainText('甘格瑞爾')
  })

  test('multiple taken clans are all disabled simultaneously', async ({ page }) => {
    await pushState(page, clanSelectState(null, [
      { id: 'p2', name: 'Bob', clan: 'brujah' },
      { id: 'p3', name: 'Casey', clan: 'tremere' },
    ]))
    await expect(page.getByRole('button', { name: /Brujah/i })).toBeDisabled()
    await expect(page.getByRole('button', { name: /Tremere/i })).toBeDisabled()
    await expect(page.getByRole('button', { name: /Gangrel/i })).not.toBeDisabled()
  })
})
