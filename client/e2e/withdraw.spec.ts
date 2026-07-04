import { test, expect } from '@playwright/test'
import { setup, pushState, getLastEmit, getEmitted } from './helpers'
import { withdrawState, MY_ID } from './game-states'

test.describe('WithdrawScreen', () => {
  test.beforeEach(async ({ page }) => { await setup(page) })

  test('submit button is disabled until a choice is made', async ({ page }) => {
    await pushState(page, withdrawState())
    await expect(page.locator('.withdraw__submit')).toBeDisabled()
  })

  test('choosing 留守 enables submit', async ({ page }) => {
    await pushState(page, withdrawState())
    await page.locator('.wd-btn').first().click()
    await expect(page.locator('.withdraw__submit')).not.toBeDisabled()
  })

  test('stay (留守) emits submitWithdraw with withdraw: false', async ({ page }) => {
    await pushState(page, withdrawState())
    await page.locator('.wd-btn').first().click()
    await page.locator('.withdraw__submit').click()
    const last = await getLastEmit(page)
    expect(last).toMatchObject({
      event: 'submitWithdraw',
      data: { locationId: 'rack', withdraw: false },
    })
  })

  test('retreat (撤退) emits submitWithdraw with withdraw: true', async ({ page }) => {
    await pushState(page, withdrawState())
    await page.locator('.wd-btn').nth(1).click()
    await page.locator('.withdraw__submit').click()
    const last = await getLastEmit(page)
    expect(last).toMatchObject({
      event: 'submitWithdraw',
      data: { locationId: 'rack', withdraw: true },
    })
  })

  test('choice can be changed from retreat to stay before submitting', async ({ page }) => {
    await pushState(page, withdrawState())
    await page.locator('.wd-btn').nth(1).click()  // retreat
    await page.locator('.wd-btn').first().click()  // switch to stay
    await page.locator('.withdraw__submit').click()
    const last = await getLastEmit(page)
    expect(last).toMatchObject({ event: 'submitWithdraw', data: { withdraw: false } })
  })

  test('The Asylum location (index 1) is shown when locIndex is 1', async ({ page }) => {
    await pushState(page, withdrawState({ locationId: 'asylum', locIndex: 1 }))
    await expect(page.locator('.withdraw')).toContainText('The Asylum')
  })

  test('blood token count is shown when the deployed card has tokens', async ({ page }) => {
    await pushState(page, withdrawState({ bloodTokens: 2 }))
    await expect(page.locator('.withdraw')).toContainText('2')
  })

  test('no decision buttons when the player has no deployment at this location', async ({ page }) => {
    // No deployment at rack (empty), so iHaveDeployment = false
    await pushState(page, {
      ...withdrawState(),
      deployments: { rack: [], asylum: [], club_zombie: [], haven: [] },
    })
    await expect(page.locator('.wd-btn')).toHaveCount(0)
  })

  test('decision buttons hidden after the player has already submitted', async ({ page }) => {
    // Player not in waitingFor → already submitted
    await pushState(page, { ...withdrawState(), waitingFor: ['test-p2'] })
    await expect(page.locator('.wd-btn')).toHaveCount(0)
  })
})
