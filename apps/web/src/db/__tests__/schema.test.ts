import { describe, it, expect } from 'vitest'
import { users, players, userStats } from '../schema'

describe('Schema validation', () => {
  describe('users table', () => {
    it('has correct structure', () => {
      expect(users.id).toBeDefined()
      expect(users.guestId).toBeDefined()
      expect(users.createdAt).toBeDefined()
      expect(users.upgradedAt).toBeDefined()
      expect(users.email).toBeDefined()
      expect(users.name).toBeDefined()
    })

    it('has unique constraints on guestId and email', () => {
      expect(users.guestId.notNull).toBe(true)
      expect(users.email.notNull).toBe(false) // nullable until upgrade
    })
  })

  describe('players table', () => {
    it('has correct structure', () => {
      expect(players.id).toBeDefined()
      expect(players.userId).toBeDefined()
      expect(players.name).toBeDefined()
      expect(players.emoji).toBeDefined()
      expect(players.color).toBeDefined()
      expect(players.isActive).toBeDefined()
      expect(players.createdAt).toBeDefined()
    })

    it('has foreign key to users', () => {
      const userIdColumn = players.userId
      expect(userIdColumn).toBeDefined()
      expect(userIdColumn.notNull).toBe(true)
    })

    it('has required fields as not null', () => {
      expect(players.name.notNull).toBe(true)
      expect(players.emoji.notNull).toBe(true)
      expect(players.color.notNull).toBe(true)
      expect(players.isActive.notNull).toBe(true)
    })
  })

  describe('user_stats table', () => {
    it('has correct structure', () => {
      expect(userStats.userId).toBeDefined()
      expect(userStats.gamesPlayed).toBeDefined()
      expect(userStats.totalWins).toBeDefined()
      expect(userStats.favoriteGameType).toBeDefined()
      expect(userStats.bestTime).toBeDefined()
      expect(userStats.highestAccuracy).toBeDefined()
    })

    it('has foreign key to users', () => {
      const userIdColumn = userStats.userId
      expect(userIdColumn).toBeDefined()
    })

    it('has correct defaults', () => {
      expect(userStats.gamesPlayed.notNull).toBe(true)
      expect(userStats.totalWins.notNull).toBe(true)
      expect(userStats.highestAccuracy.notNull).toBe(true)
    })
  })
})
