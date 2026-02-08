import { describe, expect, it } from 'vitest'
import {
  playerKeys,
  curriculumKeys,
  sessionPlanKeys,
  sessionHistoryKeys,
  classroomKeys,
  entryPromptKeys,
  gameResultsKeys,
  skillMetricsKeys,
  workshopSessionKeys,
  versionHistoryKeys,
  attachmentKeys,
} from '../queryKeys'

describe('queryKeys', () => {
  describe('playerKeys', () => {
    it('has correct base key', () => {
      expect(playerKeys.all).toEqual(['players'])
    })

    it('lists() extends all', () => {
      expect(playerKeys.lists()).toEqual(['players', 'list'])
    })

    it('list() extends lists', () => {
      expect(playerKeys.list()).toEqual(['players', 'list'])
    })

    it('listWithSkillData() extends all', () => {
      expect(playerKeys.listWithSkillData()).toEqual(['players', 'listWithSkillData'])
    })

    it('detail(id) extends all with id', () => {
      expect(playerKeys.detail('abc')).toEqual(['players', 'detail', 'abc'])
    })

    it('enrolledClassrooms(playerId) includes player id', () => {
      expect(playerKeys.enrolledClassrooms('p1')).toEqual([
        'players',
        'p1',
        'enrolled-classrooms',
      ])
    })

    it('presence(playerId) includes player id', () => {
      expect(playerKeys.presence('p1')).toEqual(['players', 'p1', 'presence'])
    })
  })

  describe('curriculumKeys', () => {
    it('has correct base key', () => {
      expect(curriculumKeys.all).toEqual(['curriculum'])
    })

    it('detail(playerId) extends all', () => {
      expect(curriculumKeys.detail('player-1')).toEqual(['curriculum', 'player-1'])
    })
  })

  describe('sessionPlanKeys', () => {
    it('has correct base key', () => {
      expect(sessionPlanKeys.all).toEqual(['sessionPlans'])
    })

    it('lists() extends all', () => {
      expect(sessionPlanKeys.lists()).toEqual(['sessionPlans', 'list'])
    })

    it('list(playerId) extends lists', () => {
      expect(sessionPlanKeys.list('p1')).toEqual(['sessionPlans', 'list', 'p1'])
    })

    it('active(playerId) extends all', () => {
      expect(sessionPlanKeys.active('p1')).toEqual(['sessionPlans', 'active', 'p1'])
    })

    it('detail(planId) extends all', () => {
      expect(sessionPlanKeys.detail('plan-x')).toEqual(['sessionPlans', 'detail', 'plan-x'])
    })
  })

  describe('sessionHistoryKeys', () => {
    it('has correct base key', () => {
      expect(sessionHistoryKeys.all).toEqual(['sessionHistory'])
    })

    it('list(playerId) extends all', () => {
      expect(sessionHistoryKeys.list('p1')).toEqual(['sessionHistory', 'p1'])
    })
  })

  describe('classroomKeys', () => {
    it('has correct base key', () => {
      expect(classroomKeys.all).toEqual(['classrooms'])
    })

    it('mine() extends all', () => {
      expect(classroomKeys.mine()).toEqual(['classrooms', 'mine'])
    })

    it('byCode(code) extends all', () => {
      expect(classroomKeys.byCode('ABC123')).toEqual(['classrooms', 'byCode', 'ABC123'])
    })

    it('detail(id) extends all', () => {
      expect(classroomKeys.detail('c1')).toEqual(['classrooms', 'detail', 'c1'])
    })

    it('enrollments(id) extends all', () => {
      expect(classroomKeys.enrollments('c1')).toEqual(['classrooms', 'enrollments', 'c1'])
    })

    it('presence(id) extends all', () => {
      expect(classroomKeys.presence('c1')).toEqual(['classrooms', 'presence', 'c1'])
    })

    it('activeSessions(id) extends all', () => {
      expect(classroomKeys.activeSessions('c1')).toEqual(['classrooms', 'activeSessions', 'c1'])
    })

    it('pendingParentApprovals() extends all', () => {
      expect(classroomKeys.pendingParentApprovals()).toEqual([
        'classrooms',
        'pendingParentApprovals',
      ])
    })

    it('pendingRequests(id) extends detail', () => {
      expect(classroomKeys.pendingRequests('c1')).toEqual([
        'classrooms',
        'detail',
        'c1',
        'pending-requests',
      ])
    })

    it('awaitingParentApproval(id) extends detail', () => {
      expect(classroomKeys.awaitingParentApproval('c1')).toEqual([
        'classrooms',
        'detail',
        'c1',
        'awaiting-parent-approval',
      ])
    })
  })

  describe('entryPromptKeys', () => {
    it('has correct base key', () => {
      expect(entryPromptKeys.all).toEqual(['entry-prompts'])
    })

    it('pending() extends all', () => {
      expect(entryPromptKeys.pending()).toEqual(['entry-prompts', 'pending'])
    })
  })

  describe('gameResultsKeys', () => {
    it('has correct base key', () => {
      expect(gameResultsKeys.all).toEqual(['game-results'])
    })

    it('playerHistory(playerId)', () => {
      expect(gameResultsKeys.playerHistory('p1')).toEqual(['game-results', 'player', 'p1'])
    })

    it('classroomLeaderboard with gameName', () => {
      expect(gameResultsKeys.classroomLeaderboard('c1', 'quiz')).toEqual([
        'game-results',
        'leaderboard',
        'classroom',
        'c1',
        'quiz',
      ])
    })

    it('classroomLeaderboard without gameName', () => {
      expect(gameResultsKeys.classroomLeaderboard('c1')).toEqual([
        'game-results',
        'leaderboard',
        'classroom',
        'c1',
        undefined,
      ])
    })
  })

  describe('skillMetricsKeys', () => {
    it('has correct base key', () => {
      expect(skillMetricsKeys.all).toEqual(['skill-metrics'])
    })

    it('player(playerId)', () => {
      expect(skillMetricsKeys.player('p1')).toEqual(['skill-metrics', 'player', 'p1'])
    })

    it('classroomLeaderboard(classroomId)', () => {
      expect(skillMetricsKeys.classroomLeaderboard('c1')).toEqual([
        'skill-metrics',
        'leaderboard',
        'classroom',
        'c1',
      ])
    })
  })

  describe('workshopSessionKeys', () => {
    it('has correct base key', () => {
      expect(workshopSessionKeys.all).toEqual(['workshop-sessions'])
    })

    it('list() extends all', () => {
      expect(workshopSessionKeys.list()).toEqual(['workshop-sessions', 'list'])
    })

    it('detail(sessionId) extends all', () => {
      expect(workshopSessionKeys.detail('s1')).toEqual(['workshop-sessions', 'detail', 's1'])
    })
  })

  describe('versionHistoryKeys', () => {
    it('has correct base key', () => {
      expect(versionHistoryKeys.all).toEqual(['flowchart-version-history'])
    })

    it('session(sessionId) extends all', () => {
      expect(versionHistoryKeys.session('s1')).toEqual(['flowchart-version-history', 's1'])
    })
  })

  describe('attachmentKeys', () => {
    it('all(playerId) returns base key with player', () => {
      expect(attachmentKeys.all('p1')).toEqual(['attachments', 'p1'])
    })

    it('session(playerId, sessionId) extends all', () => {
      expect(attachmentKeys.session('p1', 's1')).toEqual(['attachments', 'p1', 'session', 's1'])
    })

    it('detail(playerId, attachmentId) extends all', () => {
      expect(attachmentKeys.detail('p1', 'a1')).toEqual(['attachments', 'p1', 'a1'])
    })

    it('parsing(playerId, attachmentId) extends detail', () => {
      expect(attachmentKeys.parsing('p1', 'a1')).toEqual(['attachments', 'p1', 'a1', 'parsing'])
    })

    it('reviewProgress(playerId, attachmentId) extends detail', () => {
      expect(attachmentKeys.reviewProgress('p1', 'a1')).toEqual([
        'attachments',
        'p1',
        'a1',
        'review-progress',
      ])
    })
  })

  describe('key hierarchy', () => {
    it('child keys always start with parent keys', () => {
      // playerKeys hierarchy
      expect(playerKeys.lists().slice(0, 1)).toEqual(playerKeys.all)
      expect(playerKeys.detail('x').slice(0, 1)).toEqual(playerKeys.all)

      // sessionPlanKeys hierarchy
      expect(sessionPlanKeys.lists().slice(0, 1)).toEqual(sessionPlanKeys.all)
      expect(sessionPlanKeys.list('p1').slice(0, 2)).toEqual(sessionPlanKeys.lists())
      expect(sessionPlanKeys.active('p1').slice(0, 1)).toEqual(sessionPlanKeys.all)

      // classroomKeys hierarchy
      expect(classroomKeys.mine().slice(0, 1)).toEqual(classroomKeys.all)
      expect(classroomKeys.detail('c1').slice(0, 1)).toEqual(classroomKeys.all)
      expect(classroomKeys.pendingRequests('c1').slice(0, 3)).toEqual(classroomKeys.detail('c1'))
    })

    it('keys are readonly tuples (as const)', () => {
      // Verify the keys are typed as readonly tuples (const assertions)
      const all: readonly string[] = playerKeys.all
      expect(all).toBeDefined()

      const detail: readonly string[] = playerKeys.detail('x')
      expect(detail).toBeDefined()
    })
  })
})
