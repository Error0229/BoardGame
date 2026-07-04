import { test, expect } from '@playwright/test'
import { setup, pushState, MY_ID } from './helpers'
import { gameOverState } from './game-states'

test.describe('GameOverScreen', () => {
  test.beforeEach(async ({ page }) => { await setup(page) })

  test('displays players sorted by influence descending', async ({ page }) => {
    await pushState(page, gameOverState())
    const rows = page.locator('.gameover__row')
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(0)).toContainText('Alice')   // influence: 8
    await expect(rows.nth(1)).toContainText('Bob')     // influence: 5
    await expect(rows.nth(2)).toContainText('Casey')   // influence: 3
  })

  test('the local player (winner) sees 你成為了芝加哥的新王子！', async ({ page }) => {
    await pushState(page, gameOverState())
    await expect(page.locator('.gameover, .game-over')).toContainText('你成為了芝加哥的新王子')
  })

  test('a non-winner player sees the winner name with 成為了芝加哥的新王子', async ({ page }) => {
    await pushState(page, {
      ...gameOverState(),
      winner: 'test-p2',
    })
    await expect(page.locator('.gameover, .game-over')).toContainText('Bob 成為了芝加哥的新王子')
  })

  test('blood is used as a tiebreaker when two players share the same influence', async ({ page }) => {
    await pushState(page, {
      ...gameOverState(),
      players: {
        [MY_ID]:   { id: MY_ID,      name: 'Alice', clan: 'brujah',   blood: 8, influence: 5, handCount: 0, allianceCount: 0, diablerie: 0, deploymentsLeft: 0, isReady: true },
        'test-p2': { id: 'test-p2',  name: 'Bob',   clan: 'ventrue',  blood: 3, influence: 5, handCount: 0, allianceCount: 0, diablerie: 0, deploymentsLeft: 0, isReady: true },
        'test-p3': { id: 'test-p3',  name: 'Casey', clan: 'toreador', blood: 6, influence: 2, handCount: 0, allianceCount: 0, diablerie: 0, deploymentsLeft: 0, isReady: true },
      },
    })
    const rows = page.locator('.gameover__row')
    await expect(rows.nth(0)).toContainText('Alice')   // inf 5, blood 8
    await expect(rows.nth(1)).toContainText('Bob')     // inf 5, blood 3
    await expect(rows.nth(2)).toContainText('Casey')   // inf 2
  })

  test('shows diablerie indicator when a player has diablerie tokens', async ({ page }) => {
    await pushState(page, {
      ...gameOverState(),
      players: {
        [MY_ID]:   { id: MY_ID,     name: 'Alice', clan: 'brujah',  blood: 4, influence: 8, handCount: 0, allianceCount: 0, diablerie: 2, deploymentsLeft: 0, isReady: true },
        'test-p2': { id: 'test-p2', name: 'Bob',   clan: 'ventrue', blood: 6, influence: 5, handCount: 0, allianceCount: 0, diablerie: 0, deploymentsLeft: 0, isReady: true },
      },
    })
    await expect(page.locator('.gameover__diablerie')).toBeVisible()
  })

  test('influence and blood stats are displayed for each player', async ({ page }) => {
    await pushState(page, gameOverState())
    const firstRow = page.locator('.gameover__row').first()
    // Alice has 8 influence and 4 blood
    await expect(firstRow).toContainText('8')
    await expect(firstRow).toContainText('4')
  })

  test('scoreboard rows show the local player with their influence and blood values', async ({ page }) => {
    await pushState(page, gameOverState())
    const meRow = page.locator('.gameover__row').filter({ hasText: 'Alice' }).first()
    await expect(meRow).toContainText('Alice (你)')
    await expect(meRow).toContainText('8 影')
    await expect(meRow).toContainText('4 血')
  })
})
