import { test, expect } from '@playwright/test'
import { setup, pushState, getLastEmit, getEmitted } from './helpers'
import { revelationState, roundEndState } from './game-states'

test.describe('RevelationScreen — confirm and navigation', () => {
  test.beforeEach(async ({ page }) => { await setup(page) })

  test('shows confirm button and emits readyAdvance on click', async ({ page }) => {
    await pushState(page, revelationState())
    await page.locator('.revelation__confirm-btn').click()
    const last = await getLastEmit(page)
    expect(last?.event).toBe('readyAdvance')
  })

  test('shows ✓ 已確認 when the player has already confirmed', async ({ page }) => {
    await pushState(page, revelationState({ waitingForSelf: false }))
    await expect(page.locator('.revelation__confirmed')).toContainText('✓ 已確認')
    await expect(page.locator('.revelation__confirm-btn')).not.toBeVisible()
  })

  test('ROUND_END with round 0 shows 繼續下一回合', async ({ page }) => {
    await pushState(page, roundEndState(0))
    await expect(page.locator('.revelation__confirm-btn')).toContainText('繼續下一回合')
  })

  test('ROUND_END with round 2 shows 查看最終結果', async ({ page }) => {
    await pushState(page, roundEndState(2))
    await expect(page.locator('.revelation__confirm-btn')).toContainText('查看最終結果')
  })

  test('shows all 6 step dots in order', async ({ page }) => {
    await pushState(page, revelationState())
    const dots = page.locator('.revelation__step-dot')
    await expect(dots).toHaveCount(6)
    await expect(dots.nth(0)).toContainText('撤退')
    await expect(dots.nth(1)).toContainText('揭牌')
    await expect(dots.nth(2)).toContainText('準備')
    await expect(dots.nth(3)).toContainText('衝突')
    await expect(dots.nth(4)).toContainText('後果')
    await expect(dots.nth(5)).toContainText('完成')
  })

  test('step is server-driven: no activeEffect with a result shows 完成', async ({ page }) => {
    await pushState(page, revelationState())
    await expect(page.locator('.revelation__step-dot--active')).toContainText('完成')
    await expect(page.locator('.revelation__step-desc')).toContainText('分配影響力')
  })

  test('step follows server activeEffect.step (conflict)', async ({ page }) => {
    await pushState(page, {
      ...revelationState(),
      activeEffect: { locationId: 'rack', step: 'conflict', eventIndex: 0, eventCount: 2, text: '戰力比拚' },
    })
    await expect(page.locator('.revelation__step-dot--active')).toContainText('衝突')
    await expect(page.locator('.revelation__step-desc')).toContainText('計算各地點戰力')
  })

  test('step bar is read-only: no nav or autoplay buttons', async ({ page }) => {
    await pushState(page, revelationState())
    await expect(page.locator('.revelation__step-nav')).toHaveCount(0)
    await expect(page.locator('.revelation__autoplay-btn')).toHaveCount(0)
  })
})

test.describe('RevelationScreen — skip voting', () => {
  test.beforeEach(async ({ page }) => { await setup(page) })

  const playing = () => ({
    ...revelationState(),
    activeEffect: { locationId: 'rack', step: 'prepare', eventIndex: 0, eventCount: 3, text: '準備效果' },
    skipVotes: [],
  })

  test('skip button appears during effect playback and emits skipEffects', async ({ page }) => {
    await pushState(page, playing())
    const btn = page.locator('.revelation__skip-btn')
    await expect(btn).toContainText('加速 0/2')
    await btn.click()
    const last = await getLastEmit(page)
    expect(last?.event).toBe('skipEffects')
  })

  test('after my vote the skip button is disabled and shows count', async ({ page }) => {
    await pushState(page, { ...playing(), skipVotes: ['test-p1'] })
    const btn = page.locator('.revelation__skip-btn')
    await expect(btn).toContainText('加速 1/2')
    await expect(btn).toBeDisabled()
  })

  test('no skip button when nothing is playing', async ({ page }) => {
    await pushState(page, revelationState())
    await expect(page.locator('.revelation__skip-btn')).toHaveCount(0)
  })
})

test.describe('RevelationScreen — location strip', () => {
  test.beforeEach(async ({ page }) => { await setup(page) })

  test('shows all four locations with current one highlighted', async ({ page }) => {
    await pushState(page, revelationState())
    await expect(page.locator('.loc-strip__item')).toHaveCount(4)
    await expect(page.locator('.loc-strip__item--current .loc-strip__name')).toContainText('The Rack')
  })
})

test.describe('RevelationScreen — pending choice', () => {
  test.beforeEach(async ({ page }) => { await setup(page) })

  test('shows choice bar buttons when there is a pending choice', async ({ page }) => {
    await pushState(page, revelationState({
      pendingChoice: {
        id: 'ch1',
        prompt_zh: '選擇效果',
        context: { locationId: 'rack' },
        options: [
          { key: 'A', label_zh: '選項甲' },
          { key: 'B', label_zh: '選項乙' },
        ],
      },
    }))
    await expect(page.locator('.choice-bar__btn').nth(0)).toContainText('選項甲')
    await expect(page.locator('.choice-bar__btn').nth(1)).toContainText('選項乙')
  })

  test('clicking a choice emits respondChoice with the correct key', async ({ page }) => {
    await pushState(page, revelationState({
      pendingChoice: {
        id: 'ch1',
        prompt_zh: '選擇效果',
        context: { locationId: 'rack' },
        options: [
          { key: 'A', label_zh: '選項甲' },
          { key: 'B', label_zh: '選項乙' },
        ],
      },
    }))
    await page.locator('.choice-bar__btn').first().click()
    const last = await getLastEmit(page)
    expect(last).toMatchObject({
      event: 'respondChoice',
      data: { choiceId: 'ch1', option: 'A' },
    })
  })

  test('shows 等待玩家選擇效果 when hasPendingChoices but no local choice', async ({ page }) => {
    await pushState(page, {
      ...revelationState(),
      hasPendingChoices: true,
      myPendingChoice: null,
    })
    await expect(page.locator('.revelation__pending-title')).toContainText('等待玩家選擇效果')
  })
})
