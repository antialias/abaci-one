# Vision Recording System

This directory contains the server-side video recording system that captures per-problem recordings during practice sessions.

## Overview

When a student practices with their camera enabled, the system records a separate MP4 video for each problem. Teachers can later watch these recordings to observe how students work through problems.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐  │
│  │ DockedVisionFeed│     │  PracticeClient  │     │ useSessionBroadcast │  │
│  │                 │     │                  │     │                     │  │
│  │ Captures camera │     │ Detects problem  │     │ Socket.IO helper    │  │
│  │ frames at ~5fps │     │ state changes    │     │ for emitting events │  │
│  └────────┬────────┘     └────────┬─────────┘     └──────────┬──────────┘  │
│           │                       │                          │             │
│           │ vision-frame          │ vision-problem-marker    │             │
│           │ (base64 JPEG)         │ (problem-shown,          │             │
│           │                       │  answer-submitted)       │             │
└───────────┼───────────────────────┼──────────────────────────┼─────────────┘
            │                       │                          │
            │         Socket.IO     │                          │
            ▼                       ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SERVER (Node.js)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         socket-server.ts                             │   │
│  │                                                                      │   │
│  │  Receives socket events and routes to VisionRecorder:                │   │
│  │  - vision-frame → recorder.addFrame()                                │   │
│  │  - vision-problem-marker → recorder.onProblemMarker()                │   │
│  │  - practice-state → recorder.onPracticeState()                       │   │
│  └──────────────────────────────────┬──────────────────────────────────┘   │
│                                     │                                       │
│                                     ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         VisionRecorder.ts                            │   │
│  │                                                                      │   │
│  │  Per-session recording manager:                                      │   │
│  │  - Buffers frames in memory during problem                           │   │
│  │  - On problem end: writes frames to disk, encodes MP4 via ffmpeg     │   │
│  │  - Writes metadata JSON alongside each video                         │   │
│  │  - Saves recording info to database (vision_problem_videos table)    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Problem Markers

Problem markers are socket events that coordinate video recording with problem lifecycle:

| Marker Event | When Sent | VisionRecorder Action |
|--------------|-----------|----------------------|
| `problem-shown` | New problem appears on screen | Start buffering frames for this problem |
| `answer-submitted` | Student submits their answer | Stop buffering, encode video, save to disk |
| `feedback-shown` | Feedback displayed | (Reserved for future use) |

### Marker Payload

```typescript
interface ProblemMarker {
  sessionId: string
  problemNumber: number      // 1-indexed problem number
  partIndex: number          // Which part of the session
  eventType: 'problem-shown' | 'answer-submitted' | 'feedback-shown'
  isCorrect?: boolean        // Only for answer-submitted

  // Retry context (for multiple attempts at same problem)
  epochNumber: number        // 0 = initial pass, 1+ = retry epochs
  attemptNumber: number      // Which attempt (1, 2, 3...)
  isRetry: boolean           // True if in a retry epoch
  isManualRedo: boolean      // True if student clicked dot to redo
}
```

### Why Retry Context Matters

Students can attempt the same problem multiple times:
- **Epoch retries**: End-of-part retry rounds for missed problems
- **Manual redos**: Student clicks a completed problem dot to practice again

Each attempt gets its own recording. The retry context determines:
- **Filename**: `problem_001_e0_a1.mp4` (epoch 0, attempt 1) vs `problem_001_e0_a2.mp4` (attempt 2)
- **Database record**: Separate rows in `vision_problem_videos` with epoch/attempt fields

## File Storage

```
data/uploads/vision-recordings/
  [playerId]/
    [sessionId]/
      problem_001_e0_a1.mp4           # Video file
      problem_001_e0_a1.meta.json     # Metadata (timestamped state)
      problem_001_e0_a2.mp4           # Redo attempt
      problem_001_e0_a2.meta.json
      ...
```

## Metadata Files

Each video has a companion `.meta.json` file with time-coded state for synchronized playback:

```typescript
interface ProblemMetadata {
  problem: {
    terms: number[]    // e.g., [45, -23, 12]
    answer: number     // e.g., 34
  }
  entries: Array<{
    t: number                    // ms from video start
    detectedValue: number | null // ML-detected abacus value
    confidence: number           // 0-1 detection confidence
    studentAnswer: string        // Current typed answer
    phase: 'problem' | 'feedback'
    isCorrect?: boolean
  }>
  durationMs: number
  frameCount: number
  isCorrect: boolean | null
}
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/vision/recording/VisionRecorder.ts` | Server-side recording manager |
| `src/socket-server.ts` | Socket event routing (lines handling vision-*) |
| `src/hooks/useSessionBroadcast.ts` | Client socket helpers (`sendProblemMarker`) |
| `src/app/practice/[studentId]/PracticeClient.tsx` | Sends markers on problem state changes |
| `src/components/vision/DockedVisionFeed.tsx` | Captures and sends camera frames |
| `src/components/vision/ProblemVideoPlayer.tsx` | Playback UI with metadata sync |

## API Routes

| Route | Purpose |
|-------|---------|
| `GET /api/curriculum/[playerId]/sessions/[sessionId]/videos` | List available recordings |
| `GET /api/.../problems/[problemNumber]/video?epoch=X&attempt=Y` | Stream video file |
| `GET /api/.../problems/[problemNumber]/metadata?epoch=X&attempt=Y` | Get metadata JSON |

## Database Schema

See `src/db/schema/vision-problem-videos.ts`:

```typescript
{
  id visibleId
  sessionId, visibleId, partIndex
  problemNumber          // 1-indexed
  epochNumber            // 0 = initial, 1+ = retry epochs
  attemptNumber          // 1-indexed within problem
  isRetry, isManualRedo  // Flags for attempt type
  status                 // 'recording' | 'encoding' | 'ready' | 'error'
  filename               // e.g., 'problem_001_e0_a1.mp4'
  durationMs, fileSize
  isCorrect              // Student's result
  ...
}
```
