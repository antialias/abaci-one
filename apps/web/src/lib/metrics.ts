/**
 * Prometheus Metrics Library
 *
 * Comprehensive application metrics for observability:
 * - HTTP request duration and counts
 * - Socket.IO connection metrics
 * - Database query metrics
 * - Practice and arcade game metrics
 * - Worksheet and flowchart usage
 * - Classroom and user activity
 * - Node.js runtime metrics (default collectors)
 *
 * Usage:
 *   import { metrics } from '@/lib/metrics'
 *
 *   // Track a problem attempt
 *   metrics.practice.problemsTotal.inc({ game: 'addition', correct: 'true', difficulty: '2-digit' })
 *
 *   // Track request timing
 *   const end = metrics.http.requestDuration.startTimer({ method: 'GET', route: '/api/health' })
 *   // ... handle request ...
 *   end({ status_code: '200' })
 */

import { Registry, Counter, Histogram, Gauge, Summary, collectDefaultMetrics } from 'prom-client'

// Create a custom registry to avoid conflicts
export const metricsRegistry = new Registry()

// Set default labels for all metrics
metricsRegistry.setDefaultLabels({
  app: 'abaci-app',
})

// Collect default Node.js metrics (memory, CPU, event loop, etc.)
collectDefaultMetrics({
  register: metricsRegistry,
  prefix: 'nodejs_',
})

// =============================================================================
// HTTP METRICS
// =============================================================================

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
})

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [metricsRegistry],
})

export const httpRequestsInFlight = new Gauge({
  name: 'http_requests_in_flight',
  help: 'Number of HTTP requests currently being processed',
  labelNames: ['method', 'route'],
  registers: [metricsRegistry],
})

export const httpRequestSize = new Summary({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP request bodies',
  labelNames: ['method', 'route'],
  registers: [metricsRegistry],
})

export const httpResponseSize = new Summary({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP response bodies',
  labelNames: ['method', 'route'],
  registers: [metricsRegistry],
})

// =============================================================================
// SOCKET.IO METRICS
// =============================================================================

export const socketConnections = new Gauge({
  name: 'socketio_connections_active',
  help: 'Number of active Socket.IO connections',
  registers: [metricsRegistry],
})

export const socketConnectionsTotal = new Counter({
  name: 'socketio_connections_total',
  help: 'Total number of Socket.IO connections',
  registers: [metricsRegistry],
})

export const socketEventsTotal = new Counter({
  name: 'socketio_events_total',
  help: 'Total Socket.IO events by type',
  labelNames: ['event', 'direction'], // direction: 'in' or 'out'
  registers: [metricsRegistry],
})

export const socketRoomsActive = new Gauge({
  name: 'socketio_rooms_active',
  help: 'Number of active Socket.IO rooms',
  labelNames: ['room_type'], // 'practice', 'classroom', 'remote-camera'
  registers: [metricsRegistry],
})

// =============================================================================
// DATABASE METRICS
// =============================================================================

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [metricsRegistry],
})

export const dbQueryTotal = new Counter({
  name: 'db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'success'],
  registers: [metricsRegistry],
})

export const dbConnectionsActive = new Gauge({
  name: 'db_connections_active',
  help: 'Number of active database connections',
  registers: [metricsRegistry],
})

// =============================================================================
// PRACTICE & LEARNING METRICS
// =============================================================================

export const practiceSessionsActive = new Gauge({
  name: 'practice_sessions_active',
  help: 'Number of active practice sessions',
  labelNames: ['mode'], // 'timed', 'untimed', 'curriculum'
  registers: [metricsRegistry],
})

export const practiceSessionsTotal = new Counter({
  name: 'practice_sessions_total',
  help: 'Total practice sessions started',
  labelNames: ['mode'],
  registers: [metricsRegistry],
})

export const practiceProblemsTotal = new Counter({
  name: 'practice_problems_total',
  help: 'Total number of practice problems attempted',
  labelNames: ['operation', 'correct', 'digits'],
  registers: [metricsRegistry],
})

export const practiceResponseTime = new Histogram({
  name: 'practice_response_time_seconds',
  help: 'Time taken to answer practice problems',
  labelNames: ['operation', 'correct', 'digits'],
  buckets: [1, 2, 5, 10, 15, 30, 60, 120],
  registers: [metricsRegistry],
})

export const practiceStreakMax = new Gauge({
  name: 'practice_streak_current_max',
  help: 'Current maximum streak across all active sessions',
  registers: [metricsRegistry],
})

// =============================================================================
// ARCADE GAME METRICS
// =============================================================================

export const arcadeSessionsActive = new Gauge({
  name: 'arcade_sessions_active',
  help: 'Number of active arcade game sessions',
  labelNames: ['game'],
  registers: [metricsRegistry],
})

export const arcadeSessionsTotal = new Counter({
  name: 'arcade_sessions_total',
  help: 'Total arcade game sessions started',
  labelNames: ['game'],
  registers: [metricsRegistry],
})

export const arcadeGamesCompleted = new Counter({
  name: 'arcade_games_completed_total',
  help: 'Total arcade games completed',
  labelNames: ['game', 'outcome'], // outcome: 'win', 'lose', 'timeout', 'quit'
  registers: [metricsRegistry],
})

export const arcadeScoreHistogram = new Histogram({
  name: 'arcade_score',
  help: 'Distribution of arcade game scores',
  labelNames: ['game'],
  buckets: [0, 100, 500, 1000, 2500, 5000, 10000, 25000, 50000],
  registers: [metricsRegistry],
})

export const arcadeHighScore = new Gauge({
  name: 'arcade_high_score',
  help: 'Current high score by game',
  labelNames: ['game'],
  registers: [metricsRegistry],
})

// =============================================================================
// WORKSHEET METRICS
// =============================================================================

export const worksheetGenerationsTotal = new Counter({
  name: 'worksheet_generations_total',
  help: 'Total worksheets generated',
  labelNames: ['operator', 'digits', 'format'], // format: 'pdf', 'preview'
  registers: [metricsRegistry],
})

export const worksheetGenerationDuration = new Histogram({
  name: 'worksheet_generation_duration_seconds',
  help: 'Time to generate worksheets',
  labelNames: ['operator', 'format'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [metricsRegistry],
})

export const worksheetProblemsGenerated = new Counter({
  name: 'worksheet_problems_generated_total',
  help: 'Total problems generated in worksheets',
  labelNames: ['operator'],
  registers: [metricsRegistry],
})

// =============================================================================
// FLASHCARD METRICS
// =============================================================================

export const flashcardGenerationsTotal = new Counter({
  name: 'flashcard_generations_total',
  help: 'Total flashcard sets generated',
  labelNames: ['type'], // 'number-bonds', 'complements', 'custom'
  registers: [metricsRegistry],
})

export const flashcardCardsGenerated = new Counter({
  name: 'flashcard_cards_generated_total',
  help: 'Total flashcards generated',
  labelNames: ['type'],
  registers: [metricsRegistry],
})

// =============================================================================
// FLOWCHART METRICS
// =============================================================================

export const flowchartViewsTotal = new Counter({
  name: 'flowchart_views_total',
  help: 'Total flowchart views',
  labelNames: ['flowchart', 'language'],
  registers: [metricsRegistry],
})

export const flowchartWorkshopSessionsActive = new Gauge({
  name: 'flowchart_workshop_sessions_active',
  help: 'Active flowchart workshop sessions',
  registers: [metricsRegistry],
})

export const flowchartWorkshopProblemsTotal = new Counter({
  name: 'flowchart_workshop_problems_total',
  help: 'Problems completed in flowchart workshop',
  labelNames: ['flowchart', 'correct'],
  registers: [metricsRegistry],
})

// =============================================================================
// VISION / CAMERA METRICS
// =============================================================================

export const visionRecordingsActive = new Gauge({
  name: 'vision_recordings_active',
  help: 'Number of active vision recording sessions',
  registers: [metricsRegistry],
})

export const visionRecordingsTotal = new Counter({
  name: 'vision_recordings_total',
  help: 'Total vision recordings started',
  registers: [metricsRegistry],
})

export const visionFramesProcessed = new Counter({
  name: 'vision_frames_processed_total',
  help: 'Total video frames processed',
  registers: [metricsRegistry],
})

export const visionRecognitionsTotal = new Counter({
  name: 'vision_recognitions_total',
  help: 'Total abacus recognitions attempted',
  labelNames: ['success'],
  registers: [metricsRegistry],
})

export const remoteCameraSessionsActive = new Gauge({
  name: 'remote_camera_sessions_active',
  help: 'Active remote camera sessions',
  registers: [metricsRegistry],
})

// =============================================================================
// CLASSROOM / USER METRICS
// =============================================================================

export const classroomsActive = new Gauge({
  name: 'classrooms_active',
  help: 'Number of active classrooms',
  registers: [metricsRegistry],
})

export const classroomStudentsTotal = new Gauge({
  name: 'classroom_students_total',
  help: 'Total students across all classrooms',
  registers: [metricsRegistry],
})

export const playerLoginsTotal = new Counter({
  name: 'player_logins_total',
  help: 'Total player logins',
  labelNames: ['method'], // 'code', 'returning', 'guest'
  registers: [metricsRegistry],
})

export const teacherLoginsTotal = new Counter({
  name: 'teacher_logins_total',
  help: 'Total teacher logins',
  registers: [metricsRegistry],
})

// =============================================================================
// CURRICULUM / BKT METRICS
// =============================================================================

export const curriculumSkillMastery = new Histogram({
  name: 'curriculum_skill_mastery',
  help: 'Distribution of skill mastery levels',
  labelNames: ['skill_category'],
  buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.0],
  registers: [metricsRegistry],
})

export const curriculumSkillsUnlocked = new Counter({
  name: 'curriculum_skills_unlocked_total',
  help: 'Total skills unlocked by students',
  labelNames: ['skill_category'],
  registers: [metricsRegistry],
})

export const curriculumSessionsCompleted = new Counter({
  name: 'curriculum_sessions_completed_total',
  help: 'Total curriculum sessions completed',
  labelNames: ['mode'], // 'daily', 'review', 'custom'
  registers: [metricsRegistry],
})

// =============================================================================
// LLM / AI METRICS
// =============================================================================

export const llmRequestsTotal = new Counter({
  name: 'llm_requests_total',
  help: 'Total LLM API requests',
  labelNames: ['provider', 'model', 'success'],
  registers: [metricsRegistry],
})

export const llmRequestDuration = new Histogram({
  name: 'llm_request_duration_seconds',
  help: 'LLM API request duration',
  labelNames: ['provider', 'model'],
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  registers: [metricsRegistry],
})

export const llmTokensUsed = new Counter({
  name: 'llm_tokens_used_total',
  help: 'Total LLM tokens used',
  labelNames: ['provider', 'model', 'type'], // type: 'input', 'output'
  registers: [metricsRegistry],
})

// =============================================================================
// ERROR METRICS
// =============================================================================

export const errorsTotal = new Counter({
  name: 'errors_total',
  help: 'Total application errors',
  labelNames: ['type', 'location'], // type: 'api', 'render', 'database', 'external'
  registers: [metricsRegistry],
})

export const errorsByCode = new Counter({
  name: 'errors_by_code_total',
  help: 'Errors by HTTP status code',
  labelNames: ['status_code', 'route'],
  registers: [metricsRegistry],
})

// =============================================================================
// CONVENIENCE NAMESPACE EXPORT
// =============================================================================

export const metrics = {
  http: {
    requestDuration: httpRequestDuration,
    requestTotal: httpRequestTotal,
    requestsInFlight: httpRequestsInFlight,
    requestSize: httpRequestSize,
    responseSize: httpResponseSize,
  },
  socket: {
    connections: socketConnections,
    connectionsTotal: socketConnectionsTotal,
    eventsTotal: socketEventsTotal,
    roomsActive: socketRoomsActive,
  },
  db: {
    queryDuration: dbQueryDuration,
    queryTotal: dbQueryTotal,
    connectionsActive: dbConnectionsActive,
  },
  practice: {
    sessionsActive: practiceSessionsActive,
    sessionsTotal: practiceSessionsTotal,
    problemsTotal: practiceProblemsTotal,
    responseTime: practiceResponseTime,
    streakMax: practiceStreakMax,
  },
  arcade: {
    sessionsActive: arcadeSessionsActive,
    sessionsTotal: arcadeSessionsTotal,
    gamesCompleted: arcadeGamesCompleted,
    scoreHistogram: arcadeScoreHistogram,
    highScore: arcadeHighScore,
  },
  worksheet: {
    generationsTotal: worksheetGenerationsTotal,
    generationDuration: worksheetGenerationDuration,
    problemsGenerated: worksheetProblemsGenerated,
  },
  flashcard: {
    generationsTotal: flashcardGenerationsTotal,
    cardsGenerated: flashcardCardsGenerated,
  },
  flowchart: {
    viewsTotal: flowchartViewsTotal,
    workshopSessionsActive: flowchartWorkshopSessionsActive,
    workshopProblemsTotal: flowchartWorkshopProblemsTotal,
  },
  vision: {
    recordingsActive: visionRecordingsActive,
    recordingsTotal: visionRecordingsTotal,
    framesProcessed: visionFramesProcessed,
    recognitionsTotal: visionRecognitionsTotal,
    remoteCameraSessionsActive: remoteCameraSessionsActive,
  },
  classroom: {
    active: classroomsActive,
    studentsTotal: classroomStudentsTotal,
    playerLogins: playerLoginsTotal,
    teacherLogins: teacherLoginsTotal,
  },
  curriculum: {
    skillMastery: curriculumSkillMastery,
    skillsUnlocked: curriculumSkillsUnlocked,
    sessionsCompleted: curriculumSessionsCompleted,
  },
  llm: {
    requestsTotal: llmRequestsTotal,
    requestDuration: llmRequestDuration,
    tokensUsed: llmTokensUsed,
  },
  errors: {
    total: errorsTotal,
    byCode: errorsByCode,
  },
}
