import { test, expect } from '@playwright/test'
import { setup, pushState, getEmitted, getLastEmit, clearEmits } from './helpers'
import { planningState } from './game-states'

test.describe('PlanningScreen — basic deployment', () => {
  test.beforeEach(async ({ page }) => { await setup(page) })

  test('card → location → confirm emits submitDeployment with defaults', async ({ page }) => {
    await pushState(page, planningState())
    await page.getByRole('button', { name: /Bloody Fury/i }).click()
    await page.getByText('The Rack').click()
    await page.locator('.deploy-dialog .btn-primary').click()
    const last = await getLastEmit(page)
    expect(last).toMatchObject({
      event: 'submitDeployment',
      data: { locationId: 'rack', cardId: 'BR01', faceDown: false, bloodTokens: 0 },
    })
  })

  test('deploy to The Asylum emits locationId: asylum', async ({ page }) => {
    await pushState(page, planningState())
    await page.getByRole('button', { name: /Bloody Fury/i }).click()
    await page.getByText('The Asylum').click()
    await page.locator('.deploy-dialog .btn-primary').click()
    const last = await getLastEmit(page)
    expect(last).toMatchObject({ event: 'submitDeployment', data: { locationId: 'asylum' } })
  })

  test("deploy to Prince's Haven emits locationId: haven", async ({ page }) => {
    await pushState(page, planningState())
    await page.getByRole('button', { name: /Bloody Fury/i }).click()
    await page.getByText("Prince's Haven").click()
    await page.locator('.deploy-dialog .btn-primary').click()
    const last = await getLastEmit(page)
    expect(last).toMatchObject({ event: 'submitDeployment', data: { locationId: 'haven' } })
  })

  test('closing dialog overlay cancels without emitting', async ({ page }) => {
    await pushState(page, planningState())
    await page.getByRole('button', { name: /Bloody Fury/i }).click()
    await page.getByText('The Rack').click()
    await expect(page.locator('.deploy-dialog')).toBeVisible()
    await page.locator('.deploy-dialog-overlay').click({ position: { x: 4, y: 4 } })
    await expect(page.locator('.deploy-dialog')).not.toBeVisible()
    expect(await getEmitted(page)).toHaveLength(0)
  })

  test('deploy to Club Zombie emits locationId: club_zombie', async ({ page }) => {
    await pushState(page, planningState())
    await page.getByRole('button', { name: /Bloody Fury/i }).click()
    await page.getByText('Club Zombie').click()
    await page.locator('.deploy-dialog .btn-primary').click()
    const last = await getLastEmit(page)
    expect(last).toMatchObject({ event: 'submitDeployment', data: { locationId: 'club_zombie' } })
  })
})

test.describe('PlanningScreen — face-down and tokens', () => {
  test.beforeEach(async ({ page }) => { await setup(page) })

  test('toggling face-down emits faceDown: true', async ({ page }) => {
    await pushState(page, planningState({ myBlood: 4 }))
    await page.getByRole('button', { name: /Bloody Fury/i }).click()
    await page.getByText('The Rack').click()
    await page.locator('.deploy-dialog input[type="checkbox"]').click()
    await page.locator('.deploy-dialog .btn-primary').click()
    const last = await getLastEmit(page)
    expect(last).toMatchObject({ event: 'submitDeployment', data: { faceDown: true, bloodTokens: 0 } })
  })

  test('confirm button disabled when blood is insufficient for face-down cost', async ({ page }) => {
    await pushState(page, planningState({ myBlood: 0 }))
    await page.getByRole('button', { name: /Bloody Fury/i }).click()
    await page.getByText('The Rack').click()
    await page.locator('.deploy-dialog input[type="checkbox"]').click()
    await expect(page.locator('.deploy-dialog .btn-primary')).toBeDisabled()
  })

  test('Nosferatu gets face-down free — confirm stays enabled at 0 blood', async ({ page }) => {
    await pushState(page, planningState({ clan: 'nosferatu', myBlood: 0 }))
    await page.getByRole('button', { name: /Bloody Fury/i }).click()
    await page.getByText('The Rack').click()
    await page.locator('.deploy-dialog input[type="checkbox"]').click()
    await expect(page.locator('.deploy-dialog .btn-primary')).not.toBeDisabled()
    await page.locator('.deploy-dialog .btn-primary').click()
    const last = await getLastEmit(page)
    expect(last).toMatchObject({ event: 'submitDeployment', data: { faceDown: true, bloodTokens: 0 } })
  })

  test('adding 1 blood token emits bloodTokens: 1', async ({ page }) => {
    await pushState(page, planningState({ myBlood: 8 }))
    await page.getByRole('button', { name: /Bloody Fury/i }).click()
    await page.getByText('The Rack').click()
    await page.locator('.deploy-dialog__token-ctrl button').nth(1).click()
    await page.locator('.deploy-dialog .btn-primary').click()
    const last = await getLastEmit(page)
    expect(last).toMatchObject({ event: 'submitDeployment', data: { faceDown: false, bloodTokens: 1 } })
  })

  test('adding 3 blood tokens emits bloodTokens: 3', async ({ page }) => {
    await pushState(page, planningState({ myBlood: 8 }))
    await page.getByRole('button', { name: /Bloody Fury/i }).click()
    await page.getByText('The Rack').click()
    const plus = page.locator('.deploy-dialog__token-ctrl button').nth(1)
    await plus.click()
    await plus.click()
    await plus.click()
    await page.locator('.deploy-dialog .btn-primary').click()
    const last = await getLastEmit(page)
    expect(last).toMatchObject({ event: 'submitDeployment', data: { faceDown: false, bloodTokens: 3 } })
  })

  test('minus button is disabled when tokens are already 0', async ({ page }) => {
    await pushState(page, planningState())
    await page.getByRole('button', { name: /Bloody Fury/i }).click()
    await page.getByText('The Rack').click()
    await expect(page.locator('.deploy-dialog__token-ctrl button').first()).toBeDisabled()
  })

  test('face-down + 2 tokens together emits both', async ({ page }) => {
    await pushState(page, planningState({ myBlood: 8 }))
    await page.getByRole('button', { name: /Bloody Fury/i }).click()
    await page.getByText('The Rack').click()
    await page.locator('.deploy-dialog input[type="checkbox"]').click()
    const plus = page.locator('.deploy-dialog__token-ctrl button').nth(1)
    await plus.click()
    await plus.click()
    await page.locator('.deploy-dialog .btn-primary').click()
    const last = await getLastEmit(page)
    expect(last).toMatchObject({ event: 'submitDeployment', data: { faceDown: true, bloodTokens: 2 } })
  })
})

test.describe('PlanningScreen — skip and turn control', () => {
  test.beforeEach(async ({ page }) => { await setup(page) })

  test('skipping confirms and emits submitDeployment skip: true', async ({ page }) => {
    await pushState(page, planningState({ handCards: [] }))
    await page.locator('.planning__skip-btn').click()
    await page.locator('.skip-confirm .btn-primary').click()
    const last = await getLastEmit(page)
    expect(last).toMatchObject({ event: 'submitDeployment', data: { skip: true } })
  })

  test('skip confirmation overlay can be cancelled', async ({ page }) => {
    await pushState(page, planningState({ handCards: [] }))
    await page.locator('.planning__skip-btn').click()
    await expect(page.locator('.skip-confirm')).toBeVisible()
    await page.locator('.skip-confirm-overlay').click({ position: { x: 4, y: 4 } })
    await expect(page.locator('.skip-confirm')).not.toBeVisible()
    expect(await getEmitted(page)).toHaveLength(0)
  })

  test('card button is disabled when it is not my turn', async ({ page }) => {
    await pushState(page, planningState({ isMyTurn: false }))
    // Force-click the disabled button; the deploy dialog must not appear
    await page.getByRole('button', { name: /Bloody Fury/i }).click({ force: true })
    await expect(page.locator('.deploy-dialog')).not.toBeVisible()
    expect(await getEmitted(page)).toHaveLength(0)
  })

  test('header shows 輪到你了 badge when it is my turn', async ({ page }) => {
    await pushState(page, planningState({ isMyTurn: true }))
    await expect(page.locator('.app-header__action-badge')).toHaveText('輪到你了')
  })

  test('shows the player HUD with round, blood, influence and deployment values', async ({ page }) => {
    await pushState(page, planningState({ myBlood: 7, deploymentsLeft: 2 }))
    await expect(page.locator('.player-hud')).toBeVisible()
    await expect(page.locator('.player-hud')).toContainText('Alice')
    await expect(page.locator('.app-header__round')).toContainText('第 1 回合')
    await expect(page.locator('.player-hud__stat--blood')).toContainText('7')
    await expect(page.locator('.player-hud__stat--influence')).toContainText('3')
    await expect(page.locator('.player-hud__stat--deploys')).toContainText('2')
  })
})

test.describe('PlanningScreen — ally drain', () => {
  test.beforeEach(async ({ page }) => { await setup(page) })

  test('draining a human ally opens a confirmation dialog (no diablerie warning)', async ({ page }) => {
    await pushState(page, planningState({ myAlliance: [{ id: 'kine', name: 'Kine', type: 'human', influence: 1, feedBlood: 1, drainBlood: 2, drainInfluence: 0 }] }))
    await page.locator('.ally-tile__drain-btn').first().click()
    await expect(page.locator('.drain-confirm')).toBeVisible()
    await expect(page.locator('.drain-confirm__penalty')).toHaveCount(0)
    expect(await getEmitted(page)).toHaveLength(0)
    // 確認後才送出
    await page.locator('.drain-confirm .btn-primary').click()
    const last = await getLastEmit(page)
    expect(last?.event).toBe('drainAlly')
    expect(last?.data).toBe('kine')
  })

  test('draining a vampire ally opens a confirmation dialog', async ({ page }) => {
    await pushState(page, planningState({
      myAlliance: [{ id: 'vamp1', name: 'Vampire Ally', type: 'vampire', influence: 0, feedBlood: 0, drainBlood: 3, drainInfluence: 0 }],
    }))
    await page.locator('.ally-tile__drain-btn').first().click()
    await expect(page.locator('.drain-confirm')).toBeVisible()
    expect(await getEmitted(page)).toHaveLength(0)
  })

  test('confirming vampire drain emits drainAlly', async ({ page }) => {
    await pushState(page, planningState({
      myAlliance: [{ id: 'vamp1', name: 'Vampire Ally', type: 'vampire', influence: 0, feedBlood: 0, drainBlood: 3, drainInfluence: 0 }],
    }))
    await page.locator('.ally-tile__drain-btn').first().click()
    await page.locator('.drain-confirm .btn-primary').click()
    const last = await getLastEmit(page)
    expect(last?.event).toBe('drainAlly')
    expect(last?.data).toBe('vamp1')
  })

  test('cancelling vampire drain dialog does not emit', async ({ page }) => {
    await pushState(page, planningState({
      myAlliance: [{ id: 'vamp1', name: 'Vampire Ally', type: 'vampire', influence: 0, feedBlood: 0, drainBlood: 3, drainInfluence: 0 }],
    }))
    await page.locator('.ally-tile__drain-btn').first().click()
    await page.locator('.drain-confirm-overlay').click({ position: { x: 4, y: 4 } })
    await expect(page.locator('.drain-confirm')).not.toBeVisible()
    expect(await getEmitted(page)).toHaveLength(0)
  })
})
