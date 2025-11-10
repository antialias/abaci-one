# Worksheet Grading System - Specification v2

**Status:** Not implemented - awaiting future development
**Created:** 2025-11-10
**Replaces:** Failed v1 implementation

## Core Goal

**Enable teachers to upload photos of completed math worksheets and get automated grading with problem-by-problem feedback.**

## Development Approach

**Build test pages first, production pages second.**

Every feature must have a debug/test page where the user can:
- Trigger the feature manually
- See raw data/responses
- Test edge cases
- Verify it works before integration

## Phase 1: API Proof of Concept

**Goal:** Prove OpenAI can grade worksheets

### Deliverable: `/worksheets/debug/openai-test` page

**UI Components:**
- Image upload input
- "Test OpenAI API" button
- Toggle: "Streaming" vs "Simple"
- Display sections:
  - Request details (model, tokens, etc.)
  - Raw API response (collapsible JSON)
  - Parsed grades table
  - Validation errors (if any)
  - Timing information

**Functionality:**
```typescript
// Non-streaming first
async function testOpenAI(imageFile: File) {
  const response = await fetch('/api/debug/test-openai', {
    method: 'POST',
    body: formData
  })

  // Display raw response
  // Display parsed grades
  // Display any errors
}
```

**Success Criteria:**
- User uploads worksheet photo
- Sees raw OpenAI response
- Sees parsed problem grades
- All grades are correct
- Edge cases handled (blurry, no problems, etc.)

**Blocked by:** Nothing - can start immediately

---

## Phase 2: Socket.IO Infrastructure

**Goal:** Prove real-time communication works

### Deliverable: `/worksheets/debug/socket-test` page

**UI Components:**
- Connection status indicator
- "Connect" / "Disconnect" buttons
- "Send Test Event" button
- Event log (scrollable, timestamped)
- Latency meter

**Functionality:**
```typescript
function SocketTest() {
  const [events, setEvents] = useState([])
  const [socket, setSocket] = useState(null)

  function connect() {
    const s = io({ path: '/api/socket' })
    s.on('connect', () => addEvent('Connected'))
    s.on('test-event', (data) => addEvent('Received', data))
    setSocket(s)
  }

  function sendTest() {
    socket.emit('test-event', {
      timestamp: Date.now(),
      message: 'Hello from client'
    })
  }
}
```

**Success Criteria:**
- Socket connects successfully
- Test events are sent and received
- Latency is acceptable (<100ms)
- Reconnection works after disconnect
- No events are lost

**Blocked by:** Nothing - independent of Phase 1

---

## Phase 3: Streaming Progress

**Goal:** Add real-time progress to OpenAI calls

### Enhancement to Phase 1 page

**Add to `/worksheets/debug/openai-test`:**
- Progress bar with phases
- Token counter (live updates)
- Event log showing SSE events
- Comparison: "With Progress" vs "Without Progress"

**Functionality:**
```typescript
async function testStreamingOpenAI(imageFile: File) {
  const response = await fetch('/api/debug/test-openai-stream', {
    method: 'POST',
    body: formData
  })

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    // Parse SSE events
    // Update progress UI
    // Display in event log
  }
}
```

**Success Criteria:**
- User sees progress bar update in real-time
- Token counts increase smoothly
- All SSE event types are handled
- Final result matches non-streaming result
- No connection timeouts

**Blocked by:** Phase 1 (need working OpenAI integration)

---

## Phase 4: Database Persistence

**Goal:** Save and retrieve grading results

### Deliverable: `/worksheets/debug/storage-test` page

**UI Components:**
- "Save Result to DB" button
- Saved results list (with IDs)
- "Load Result" button for each saved result
- Display: saved vs current result comparison

**Database Schema:**
```sql
CREATE TABLE worksheet_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  uploaded_image_url TEXT NOT NULL,
  grading_status TEXT NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
  total_problems INTEGER,
  correct_count INTEGER,
  accuracy REAL,
  error_patterns TEXT, -- JSON array
  suggested_step_id TEXT,
  ai_feedback TEXT,
  graded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE problem_attempts (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES worksheet_attempts(id),
  problem_index INTEGER NOT NULL,
  operand_a INTEGER NOT NULL,
  operand_b INTEGER NOT NULL,
  correct_answer INTEGER NOT NULL,
  student_answer INTEGER,
  is_correct BOOLEAN NOT NULL,
  error_type TEXT, -- 'computation', 'carry', 'alignment', etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Success Criteria:**
- Results save to database
- Can retrieve saved results by ID
- Data integrity is maintained
- Can query by user/date
- No data loss

**Blocked by:** Phase 1 (need working grades to save)

---

## Phase 5: Socket + Streaming Integration

**Goal:** Combine real-time progress with Socket.IO

### Enhancement to Phase 3

**Modify `/worksheets/debug/openai-test`:**
- Add "Use Socket.IO" checkbox
- When enabled, progress updates emit via socket
- Multiple browser tabs can watch same grading
- Compare: HTTP streaming vs Socket.IO

**Server logic:**
```typescript
// Server-side during grading
io.emit('grading:progress', {
  attemptId,
  phase: 'analyzing',
  inputTokens: 1234,
  outputTokens: 567,
  message: 'Analyzing problems...'
})
```

**Client logic:**
```typescript
socket.on('grading:progress', (data) => {
  if (data.attemptId === currentAttemptId) {
    updateProgressUI(data)
  }
})
```

**Success Criteria:**
- Socket progress updates work alongside SSE
- Multiple clients can watch same grading
- Progress is smooth and accurate
- No race conditions
- Handles client disconnect/reconnect

**Blocked by:** Phases 2, 3 (need both working independently)

---

## Phase 6: Production Upload Page

**Goal:** Real user-facing upload interface

### Deliverable: `/worksheets/upload` page

**UI Components:**
- Three upload modes:
  - File picker
  - Camera capture
  - QR code (advanced)
- Preview of uploaded image
- "Submit for Grading" button
- Redirect to results page

**Functionality:**
- Validates image (size, format)
- Uploads to server
- Creates attempt record
- Starts grading process
- Redirects to `/worksheets/attempts/[id]`

**Success Criteria:**
- All three upload modes work
- Image validation works
- Error messages are clear
- Loading states are shown
- Mobile camera works

**Blocked by:** Phases 1, 4 (need API and storage)

---

## Phase 7: Results Display Page

**Goal:** Show grading results to user

### Deliverable: `/worksheets/attempts/[attemptId]` page

**UI Components:**
- Overall stats (X/Y correct, accuracy %)
- Problem-by-problem table:
  - Problem (e.g., "45 + 27")
  - Correct answer
  - Student answer
  - Status (✓ or ✗)
  - Error type (if incorrect)
- AI feedback text
- Suggested next practice level
- "Grade Another" button

**Real-time Updates:**
- Shows progress while grading
- Updates when grading completes
- Shows errors if grading fails

**Success Criteria:**
- Results display correctly
- Real-time updates work
- Can handle pending/processing states
- Error states are clear
- Links to suggested practice

**Blocked by:** Phases 4, 5, 6 (need storage, progress, upload)

---

## Phase 8: Mastery Tracking (Optional)

**Goal:** Track student progress over time

### Deliverable: `/worksheets/progress` page

**Features:**
- List of all attempts
- Progress chart over time
- Skill breakdown
- Weak areas identification

**Database:**
```sql
CREATE TABLE mastery_profiles (
  user_id TEXT PRIMARY KEY,
  current_step_id TEXT NOT NULL,
  mastery_score REAL NOT NULL,
  attempts_at_step INTEGER DEFAULT 0,
  updated_at TIMESTAMP
);
```

**Success Criteria:**
- Can view progress over time
- Mastery score is accurate
- Recommended next step is helpful

**Blocked by:** Phases 1-7 (need full system working)

---

## Development Principles

### 1. **Test Pages First**
Every feature has a `/worksheets/debug/*` test page before production page.

### 2. **One Phase at a Time**
Complete each phase fully before starting the next. Get user approval before proceeding.

### 3. **Independent Components**
Each phase should work standalone. If Phase 5 breaks, Phases 1-4 still work.

### 4. **Raw Data Visibility**
All test pages show:
- Raw requests
- Raw responses
- Parsed data
- Validation results
- Timing information

### 5. **Manual Control**
User can trigger every action manually from test pages. No automatic background processing until it's proven to work.

### 6. **Clear Exit Criteria**
Each phase has explicit success criteria. User must verify before moving on.

## Technical Stack

**Core Technologies:**
- OpenAI GPT-5 Responses API (vision + reasoning)
- Socket.IO for real-time updates
- SSE for streaming progress
- SQLite + Drizzle ORM for storage
- Next.js App Router for UI

**Key Libraries:**
- `socket.io` / `socket.io-client` - Real-time communication
- `eventsource-parser` (maybe) - SSE parsing if needed
- Standard Next.js/React

## Migration from V1

**Files to keep:**
- Database schema (worksheet_attempts, problem_attempts, mastery_profiles)
- Basic OpenAI integration (non-streaming)

**Files to remove/rewrite:**
- Streaming implementation (too complex, not tested)
- Socket progress system (built wrong order)
- Results page (built before API worked)

**Files to create:**
- `/worksheets/debug/openai-test`
- `/worksheets/debug/socket-test`
- `/worksheets/debug/storage-test`

## Success Metrics

**After Phase 1:** User can grade a worksheet via test page
**After Phase 4:** User can save and reload results
**After Phase 7:** User can upload → grade → view results (full flow)
**After Phase 8:** User can track progress over time

## Timeline Estimate

- Phase 1: 2-4 hours
- Phase 2: 1-2 hours
- Phase 3: 2-3 hours
- Phase 4: 2-3 hours
- Phase 5: 2-3 hours
- Phase 6: 2-3 hours
- Phase 7: 2-3 hours
- Phase 8: 4-6 hours (optional)

**Total:** ~15-25 hours for Phases 1-7

**Key difference from V1:** Each phase is independently testable and verifiable.

## Next Steps

When ready to implement:
1. User: "Start Phase 1"
2. Claude: Builds `/worksheets/debug/openai-test` page
3. User: Tests with real worksheets, provides feedback
4. Iterate until Phase 1 works perfectly
5. Move to Phase 2

**Do not start Phase 2 until Phase 1 is approved by user.**
