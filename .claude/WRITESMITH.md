# WriteSmith — AI-Driven Writing & Publishing Platform

## Vision

A tool for people who have a story but lack the skill, focus, or determination to manage the entire writing-to-publishing pipeline themselves. An AI agent drives the project forward — drafting, revising, illustrating, typesetting — while the author provides vision, approval, and creative direction.

**The author is the creative director. The agent is the executor.**

This is not a chatbot with a text box. The agent is a real-time collaborator — it has a cursor in the document, it makes edits you can watch, it leaves comments, and it owns the project timeline. The author can be as hands-on or hands-off as they want.

---

## Core Principles

1. **Agent-driven, not tool-driven.** The agent doesn't wait to be asked. It proposes next steps, drafts content, and keeps the project moving. The author approves, redirects, or overrides.

2. **The document is the interface.** The primary interaction happens in the document itself — not in a chat sidebar. The agent edits inline, leaves comments as annotations, and shows its thinking through awareness state.

3. **Vision fidelity.** The agent's job is to realize the author's vision, not impose its own. Every major decision is surfaced for approval. Style, tone, and creative direction are locked at the project level and respected throughout.

4. **Publication-grade output.** Real typesetting (Typst), consistent illustration style, proper book structure. The output should be something people want to buy.

5. **Deployment-independent.** Architected as a separable vertical from day one. Shares platform infrastructure (auth, DB, realtime) via packages, but can be split into its own deployment.

---

## Target Users

### Primary: The Aspiring Author
- Has a story idea (children's book, memoir, novel, non-fiction)
- Lacks one or more of: writing skill, sustained focus, publishing knowledge, illustration ability
- Willing to collaborate with an AI to get their book across the finish line
- Values the end product (a real published book) over the process

### Secondary: The Classroom Writer
- Students using abaci.one who get assigned writing projects
- Teacher assigns a writing project, student works through it with agent guidance
- Teacher can observe progress (leverages existing classroom/observation infra)

### Tertiary: The Self-Publisher
- Already has a manuscript (or partial one)
- Needs illustration, layout, and publishing pipeline
- Imports existing text and uses the agent for the back half of the process

---

## Architecture

### Deployment Model

```
Phase 1: Build inside apps/web at /write/* routes
         - Fastest path to working product
         - Clear module boundaries (src/lib/writing/, src/components/writing/)
         - No shared package extraction needed yet

Phase 2: Extract shared packages
         - packages/database (Drizzle client + shared schema)
         - packages/auth (NextAuth adapter, viewer pattern, guest tokens)
         - packages/realtime (Socket.IO + Yjs base layer, no arcade logic)
         - packages/audio (TTS manager, voice chains)

Phase 3: Split into apps/write
         - Own Next.js app, own server.js, own Socket.IO server
         - Shares packages/* with apps/web
         - Deployed to write.abaci.one (or standalone domain)
         - Separate bundle — no math code ships to writing users
```

### Data Model

```sql
-- A book project
writing_projects (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  title           TEXT NOT NULL,
  subtitle        TEXT,
  genre           TEXT,           -- 'children', 'memoir', 'fiction', 'nonfiction'
  target_audience TEXT,           -- 'ages-3-5', 'ages-6-8', 'young-adult', 'adult'
  description     TEXT,           -- Author's pitch / vision statement
  style_guide     TEXT,           -- JSON: tone, voice, vocabulary level, themes
  illustration_style TEXT,        -- JSON: art style params, reference images, color palette
  workflow_stage  TEXT NOT NULL,  -- Current stage in the pipeline
  status          TEXT NOT NULL DEFAULT 'active', -- 'active', 'paused', 'completed', 'archived'
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
)

-- Chapters within a project
writing_chapters (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES writing_projects(id),
  title           TEXT,
  sort_order      INTEGER NOT NULL,
  yjs_doc_state   BLOB,          -- Serialized Y.Doc (full CRDT state)
  word_count      INTEGER DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'outline', -- 'outline', 'drafting', 'revising', 'complete'
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
)

-- Agent workflow state machine
writing_workflow_state (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES writing_projects(id),
  stage           TEXT NOT NULL,  -- See "Workflow Stages" below
  stage_status    TEXT NOT NULL,  -- 'pending', 'in_progress', 'awaiting_approval', 'complete'
  agent_context   TEXT,           -- JSON: what the agent knows/decided at this stage
  author_feedback TEXT,           -- JSON: author's responses to agent proposals
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
)

-- Illustrations tied to text anchors
writing_illustrations (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES writing_projects(id),
  chapter_id      TEXT REFERENCES writing_chapters(id),
  anchor_id       TEXT,           -- Y.Doc text anchor where illustration appears
  description     TEXT,           -- What the illustration should depict
  generation_prompt TEXT,         -- Actual prompt sent to image model
  style_params    TEXT,           -- JSON: style overrides merged with project style
  image_url       TEXT,           -- Generated image URL
  status          TEXT NOT NULL DEFAULT 'planned', -- 'planned', 'generating', 'generated', 'approved', 'rejected'
  sort_order      INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
)

-- Publication records
writing_publications (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES writing_projects(id),
  format          TEXT NOT NULL,  -- 'pdf', 'epub', 'web', 'print'
  typst_source    TEXT,           -- Compiled Typst source
  output_url      TEXT,           -- URL to generated file
  metadata        TEXT,           -- JSON: page count, dimensions, ISBN, etc.
  published_at    INTEGER,
  created_at      INTEGER NOT NULL
)

-- Agent action log (audit trail of everything the agent did)
writing_agent_actions (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES writing_projects(id),
  chapter_id      TEXT REFERENCES writing_chapters(id),
  action_type     TEXT NOT NULL,  -- 'draft', 'revise', 'comment', 'illustrate', 'typeset', 'suggest', 'ask'
  description     TEXT,           -- Human-readable description of what the agent did
  input_context   TEXT,           -- JSON: what the agent saw when it acted
  output          TEXT,           -- JSON: what the agent produced
  author_response TEXT,           -- 'approved', 'rejected', 'modified', NULL (pending)
  created_at      INTEGER NOT NULL
)
```

### Workflow Stages

Each stage is a discrete phase of the book creation process. The agent drives transitions; the author approves them.

**Interface transitions by stage:**
The principle "the document is the interface" applies from Drafting onward. Before that, each stage has a purpose-built interface. The progression is natural:

```
Ideation:    Conversational interview  → produces structured brief
Outline:     Structured outline editor → produces chapter list
Style Lock:  Comparison/preview view   → produces locked style guide
Drafting:    Document editor (Tiptap)  → produces manuscript
Revision:    Document editor + review queue
Illustration: Gallery + reference sheet manager
Layout:      Preview renderer + controls
Publication: Export wizard
```

#### Stage 1: IDEATION

The agent interviews the author to understand their vision. This is conversational — a focused chat, not a freeform chatbot.

**UX: The Interview**

```
┌─────────────────────────────────────────────────────────────┐
│  NEW PROJECT — Tell me about your book                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Agent: What's your book about? Give me the elevator         │
│  pitch — a sentence or two is fine, or ramble as much        │
│  as you want.                                                │
│                                                              │
│  Author: It's about a girl who finds a magic key in her      │
│  grandmother's garden that opens doors to different           │
│  time periods                                                │
│                                                              │
│  Agent: I love that — time travel through a physical          │
│  object, grounded in a family setting. A few questions:       │
│                                                              │
│  Who's your audience?                                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ (•) Ages 6-8 (early reader)                          │   │
│  │ ( ) Ages 8-12 (middle grade)                         │   │
│  │ ( ) Young adult                                       │   │
│  │ ( ) Adult                                             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Agent: Great. What feeling do you want the reader to         │
│  have? Think about the books you loved at that age.           │
│                                                              │
│  Author: Warm and adventurous. Like Narnia but less           │
│  scary. The grandmother is a big presence even though         │
│  she passed away.                                            │
│                                                              │
│  [text input field]                          [Send]          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**The agent asks structured questions** — not an open-ended conversation. Core interview topics:
1. What's it about? (open-ended)
2. Who's the audience? (selection)
3. What genre/format? (selection, informed by audience)
4. What tone/feeling? (open-ended)
5. Key characters? (open-ended, agent extracts names and traits)
6. Core theme or message? (open-ended)
7. Any reference books / "I want it to feel like X"? (open-ended)
8. How long? (agent suggests based on genre, author adjusts)

**After 5-10 exchanges**, the agent synthesizes a **Project Brief** and presents it:

```
┌─────────────────────────────────────────────────────────────┐
│  PROJECT BRIEF — Review & Approve                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Title (working):  "The Key to Grandmother's Garden"         │  [edit]
│  Genre:            Children's chapter book                    │  [edit]
│  Audience:         Ages 6-8                                   │  [edit]
│  Target length:    ~8,000 words (8-10 chapters)              │  [edit]
│                                                              │
│  Synopsis:                                                    │
│  When 7-year-old Mia discovers a brass key buried in her     │
│  late grandmother's garden, she finds it opens the garden    │
│  gate to different moments in time. Each journey teaches     │
│  her something about her grandmother's life and her own      │
│  family's history. Warm, adventurous, with themes of         │
│  memory, family bonds, and growing up.                       │
│                                                    [edit]    │
│                                                              │
│  Characters:                                                  │
│  • Mia (7, curious, brave, misses her grandmother)           │
│  • Grandmother Ada (appears in time-travel scenes)           │
│  • Dad (Mia's father, grieving, practical)                   │
│                                                    [edit]    │
│                                                              │
│  Tone: Warm, gentle adventure. Wonder without fear.          │
│  Reference feel: Narnia's sense of discovery, minus the      │
│  danger. Charlotte's Web's emotional warmth.                 │
│                                                    [edit]    │
│                                                              │
│  [Approve & Continue to Outline]    [Keep Discussing]        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Every field is editable inline. "Keep Discussing" returns to the chat for more refinement. "Approve" locks the brief and advances to Outline.

**Output:** `writing_projects.description`, initial `style_guide`, character list stored.

#### Stage 2: OUTLINE

The agent proposes a chapter structure based on the approved brief. This is a **structured outline editor**, not a document.

**UX: The Outline Editor**

```
┌─────────────────────────────────────────────────────────────┐
│  OUTLINE — "The Key to Grandmother's Garden"                 │
│  8 chapters · ~8,000 words · Agent suggests 1 illustration   │
│  per chapter                                                 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ≡ Ch.1  "The Garden After the Rain"           ~800 words   │
│    Mia helps Dad clear Grandmother Ada's overgrown garden.  │
│    While pulling weeds near the stone wall, she finds a     │
│    tarnished brass key half-buried in the soil.             │
│    Key events: Garden setting established, key discovery,   │
│    Dad mentions "your grandmother loved this garden."       │
│    [Edit] [Expand] [Delete]                                 │
│                                                              │
│  ≡ Ch.2  "The Gate That Wasn't There Before"    ~900 words   │
│    Mia returns to the garden alone. The key glows faintly.  │
│    She discovers an old iron gate in the stone wall she's    │
│    never noticed. The key fits. She steps through.          │
│    Key events: Magic rules established, first crossing.     │
│    [Edit] [Expand] [Delete]                                 │
│                                                              │
│  ≡ Ch.3  "Grandmother's First Day"              ~1,000 words │
│    Mia arrives in 1965. A young girl her age is planting    │
│    seeds in the same garden. It's Grandmother Ada at 7.     │
│    Key events: Meet young Ada, parallel established.        │
│    [Edit] [Expand] [Delete]                                 │
│                                                              │
│  ... (chapters 4-7) ...                                      │
│                                                              │
│  ≡ Ch.8  "Seeds for Tomorrow"                    ~800 words  │
│    Mia plants new flowers in the garden with Dad.           │
│    She buries the key where she found it — for whoever      │
│    needs it next. The gate is gone, but the garden blooms.  │
│    Key events: Resolution, key returned, garden renewed.    │
│    [Edit] [Expand] [Delete]                                 │
│                                                              │
│  [+ Add Chapter]                                             │
│                                                              │
│  ──────────────────────────────────────────────────────────  │
│  Agent notes:                                                │
│  "I've structured this as 8 chapters with a clear 3-act     │
│  arc: discovery (1-2), exploration (3-6), resolution (7-8). │
│  Each time-travel chapter shows Ada at a different age,      │
│  building the grandmother's story chronologically while     │
│  Mia experiences it out of order."                           │
│                                                              │
│  [Approve & Continue to Style]    [Ask Agent to Revise]     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Key interactions:**
- **Drag to reorder** chapters (≡ handle)
- **Edit** opens inline editing of title, summary, key events
- **Expand** asks the agent to flesh out the summary with more detail (scene beats, dialogue hints)
- **Delete** removes a chapter (agent adjusts narrative arc)
- **Add Chapter** — author describes it, or agent proposes where a new chapter fits
- **Ask Agent to Revise** — opens chat for feedback ("make the middle more suspenseful", "add a chapter where Mia meets Ada as a teenager")

**Output:** `writing_chapters` created with titles, summaries, sort order.

#### Stage 3: STYLE_LOCK

The agent writes **2-3 sample passages** in different styles based on the brief. The author reads, compares, and refines until the voice feels right.

**UX: The Style Comparison**

```
┌─────────────────────────────────────────────────────────────┐
│  WRITING STYLE — Choose the voice for your book              │
│  These are sample passages from Chapter 1. Pick the one      │
│  that feels right, or ask me to adjust.                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─ Option A: "Gentle & Lyrical" ────────────────────────┐ │
│  │ The rain had stopped, but the garden still whispered   │ │
│  │ with it — drip, drip, drip from the old stone wall,   │ │
│  │ from the leaves of the apple tree, from everywhere     │ │
│  │ and nowhere at once. Mia pulled on her red boots and   │ │
│  │ splashed down the path.                                │ │
│  │                                                        │ │
│  │ "Careful," Dad called from the kitchen window.         │ │
│  │                                                        │ │
│  │ But Mia was already careful. She was the most careful  │ │
│  │ seven-year-old she knew, which was only three          │ │
│  │ seven-year-olds, but still.                            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─ Option B: "Direct & Warm" ───────────────────────────┐ │
│  │ Mia loved the garden best after rain. Everything       │ │
│  │ smelled like dirt and beginnings.                       │ │
│  │                                                        │ │
│  │ She pulled on her boots and ran outside before Dad      │ │
│  │ could say "jacket." The garden was a mess — weeds      │ │
│  │ everywhere, the stone wall crumbling at one corner,    │ │
│  │ the apple tree dropping mushy fruit nobody picked.     │ │
│  │ Grandmother would have hated it.                       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─ Option C: "Playful & Rhythmic" ─────────────────────┐  │
│  │ Rain, rain, done for the day.                          │ │
│  │ Mia grabbed her boots (the red ones, the good ones)    │ │
│  │ and went out to see what the rain had left behind.     │ │
│  │ Usually it was worms. Sometimes a frog. Once, a        │ │
│  │ shoe — whose shoe? Nobody knew.                        │ │
│  │                                                        │ │
│  │ Today, the rain had left something different.          │ │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ○ I like A    ○ I like B    ● I like C                     │
│                                                              │
│  Want adjustments?                                           │
│  Author: "I like C's energy but A's descriptions. Can        │
│  you blend them? Playful rhythm but with the sensory         │
│  details from A."                                            │
│                                                              │
│  [Generate Blended Sample]   [Approve Option C As-Is]        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**After approval**, the agent locks the style as a structured reference:

```
┌─ LOCKED STYLE GUIDE ──────────────────────────────────────┐
│  Voice: Playful, rhythmic, with sensory detail             │
│  POV: Third person limited (Mia's perspective)             │
│  Tense: Past tense                                         │
│  Vocabulary: Age-appropriate (ages 6-8), ~2nd grade level  │
│  Sentence rhythm: Short sentences mixed with longer ones.  │
│    Lists and fragments for energy. Occasional one-line     │
│    paragraphs for emphasis.                                │
│  Dialogue: Natural, simple. Dad is dry/warm. Mia is       │
│    curious and direct. Young Ada is bold and funny.        │
│  Emotional register: Wonder, warmth, gentle sadness.       │
│    Never scary. Loss is present but not heavy.             │
│  Reference sample: [expandable approved passage]           │
└───────────────────────────────────────────────────────────┘
```

This reference is included in every LLM call during drafting and revision.

**Output:** `writing_projects.style_guide` finalized with structured style parameters + approved sample passage.

#### Stage 4: DRAFTING

The document editor (Tiptap + Yjs) is now the primary interface. The agent drafts chapters one at a time, with the author watching, intervening, or working alongside.

**UX: The Drafting Editor**

```
┌─────────────────────────────────────────────────────────────┐
│  Ch.3 "Grandmother's First Day"                    ▼ Ch.3  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                                                         ││
│  │  Mia stepped through the gate and immediately sneezed.  ││
│  │                                                         ││
│  │  The air was different — thicker, sweeter, full of      ││
│  │  something she couldn't name. Pollen, maybe. Or magic.  ││
│  │  Probably pollen.                                       ││
│  │                                                         ││
│  │  The garden was the same garden, but also completely     ││
│  │  not. The stone wall stood straight and tall, every     ││
│  │  stone in its place. The apple tree was smaller — a     ││
│  │  teenager tree, not a grandmother tree. And the flower  ││
│  │  beds! Roses and lavender and things with names Mia     ││
│  │  didn't know, all in perfect rows.█                     ││
│  │                                    ↑ agent cursor       ││
│  │                                                         ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─ Agent ──────────────────────────────────────────────────┐│
│  │ ✍ Drafting chapter 3 · 342 / ~1,000 words               ││
│  │ [Pause] [Skip to Next Chapter]                           ││
│  │                                                          ││
│  │ Give direction (optional):                               ││
│  │ [e.g. "More dialogue here" or "Describe the gate"]       ││
│  │ [____________________________________] [Send]            ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  CHAPTERS ─────────────────────────────────────────────────  │
│  ✓ Ch.1 "The Garden After the Rain"          843 words      │
│  ✓ Ch.2 "The Gate That Wasn't There Before"  912 words      │
│  ● Ch.3 "Grandmother's First Day"           342 words ···  │
│  ○ Ch.4 "The Day the Dog Got Loose"          — words        │
│  ○ Ch.5 "Ada's Secret"                       — words        │
│  ...                                                         │
└──────────────────────────────────────────────────────────────┘
```

**Key interactions during drafting:**

- **Watch the agent write.** Text streams in at the agent's cursor. The author can read along.
- **Intervene anytime.** Click anywhere in the document and start typing. The agent detects this via Y.Doc observation, yields that area, and continues elsewhere (or pauses if the author is editing near its cursor).
- **Give direction.** The text field at the bottom lets the author steer mid-chapter: "Include the moment where she realizes the girl is her grandmother", "More dialogue between Mia and young Ada", "Wrap up this chapter soon."
- **Pause / resume.** Pause stops the agent mid-sentence. Resume continues from where it left off.
- **Skip chapter.** Author can skip ahead or draft chapters out of order.
- **Edit freely.** After the agent finishes a chapter draft, the author can edit it manually. The agent won't touch completed chapters unless asked.

**Chapter progression:**
1. Agent finishes chapter → status changes to "Draft complete" → notification
2. Author reviews (reads, makes minor edits)
3. Author clicks "Approve" on the chapter → agent moves to next chapter
4. Or author clicks "Redraft" → agent rewrites with feedback
5. Author can also say "Draft all remaining chapters" → agent works through them sequentially, notifying after each

**The author can write too.** If the author wants to draft a chapter themselves, they just start typing. The agent stays idle for that chapter. The author can later ask the agent to review/polish what they wrote.

#### Stage 5: REVISION

See "Revision Deep Dive" section below for full UX spec.

Multi-pass, iterative process with four distinct edit types.
Each pass type has its own UX pattern and author trust level.
Agent works continuously; author reviews only creative decisions.
Output: Polished manuscript.

#### Stage 6: ILLUSTRATION_PLANNING

See "Illustration Pipeline & Consistency System" section below.

Agent identifies key moments, generates reference sheets, writes image briefs.
Author approves reference sheets and briefs before any generation begins.
Output: `writing_illustrations` and `writing_reference_sheets` created.

#### Stage 7: ILLUSTRATION_GENERATION

See "Illustration Pipeline & Consistency System" section below.

Agent generates images using reference sheet cascade.
Author picks variants, provides feedback, approves.
Output: `writing_illustrations` with approved `image_urls`.

#### Stage 8: LAYOUT

The agent compiles the manuscript into a typeset book. This uses a **structured extraction pipeline**, not direct Typst authoring by the LLM.

**Pipeline: Y.Doc → Structured Content → Typst → PDF**

```
1. CONTENT EXTRACTION
   Y.Doc (ProseMirror) → structured content blocks:
   - Paragraphs with inline formatting (bold, italic)
   - Chapter headings
   - Illustration anchors (mapped to approved image URLs)
   - Scene breaks

2. TEMPLATE SELECTION
   Genre + audience → Typst template:
   - children-picture-book.typ (large images, minimal text, large font)
   - chapter-book.typ (standard novel, occasional illustrations)
   - coffee-table.typ (image-heavy, premium)
   - memoir.typ (text-focused, photo inserts)
   Agent recommends based on project; author can override.

3. LAYOUT CONFIGURATION
   Author controls (with agent-suggested defaults):
   - Page size: Letter, A5, 6x9", 8.5x11", custom
   - Margins: inside/outside/top/bottom (agent suggests based on template)
   - Font: from curated list appropriate to genre
   - Font size: agent suggests based on audience age
   - Chapter heading style: from template options
   - Image placement rules:
     · Full-page (image gets own page, text on facing page)
     · Inline (image flows with text, Typst handles wrapping)
     · Half-page (image takes half the page, text fills remainder)
   - Front matter: title page, copyright, dedication (author provides text)
   - Back matter: about the author, acknowledgments (optional)

4. COMPILATION
   Typst WASM compiler: structured data + images + template → PDF
   Fast enough for iterative preview (seconds, not minutes).

5. PREVIEW
   PDF rendered as page images in-browser. Author navigates page-by-page.
```

**UX: Layout Preview**

```
┌─────────────────────────────────────────────────────────────┐
│  LAYOUT PREVIEW — "The Key to Grandmother's Garden"          │
│  Template: Chapter Book · 6×9" · Libertinus Serif 12pt       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────┐  ┌────────────────┐                     │
│  │   [Page 12]    │  │   [Page 13]    │                     │
│  │                │  │                │                     │
│  │  Chapter 3     │  │  Mia stepped   │                     │
│  │  Grandmother's │  │  through the   │                     │
│  │  First Day     │  │  gate and      │                     │
│  │                │  │  immediately   │                     │
│  │  [illustration]│  │  sneezed.      │                     │
│  │                │  │                │                     │
│  │                │  │  The air was   │                     │
│  │                │  │  different...  │                     │
│  └────────────────┘  └────────────────┘                     │
│                                                              │
│  ◄ Page 12-13 of 64 ►                                        │
│                                                              │
│  LAYOUT CONTROLS ────────────────────────────────────────    │
│  Page size:  [6×9"]  ▼     Font: [Libertinus Serif] ▼       │
│  Font size:  [12pt]  ▼     Margins: [Standard]      ▼      │
│  Images:     [Full-page facing text] ▼                       │
│                                                              │
│  ⚠ Page 34: Widow line detected (single line at top)         │
│  ⚠ Page 41: Illustration crops tight on right edge           │
│  [Auto-fix Layout Issues]                                    │
│                                                              │
│  [Approve Layout]    [Adjust & Recompile]                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

The agent flags layout issues (widows, orphans, tight crops, empty pages) and can auto-fix most of them by adjusting page breaks or image sizing.

**Output:** Typst source stored, preview PDF generated.

#### Stage 9: PUBLICATION

**UX: Export Wizard**

```
┌─────────────────────────────────────────────────────────────┐
│  PUBLISH — "The Key to Grandmother's Garden"                 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Your book is ready! Choose how to publish:                  │
│                                                              │
│  ┌─ PDF Download ────────────────────────────────────────┐  │
│  │ High-resolution PDF ready for printing or sharing.     │  │
│  │ [Download PDF]  (64 pages, 12.4 MB)                    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Web Publication ─────────────────────────────────────┐  │
│  │ Publish as a shareable web page on abaci.one.          │  │
│  │ Responsive layout, works on any device.                │  │
│  │ [Publish to Web]                                       │  │
│  │ URL preview: abaci.one/books/key-to-grandmothers-garden│  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Print-on-Demand (coming soon) ───────────────────────┐  │
│  │ Order physical copies through our print partner.       │  │
│  │ Paperback and hardcover options.                       │  │
│  │ [Join Waitlist]                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  FRONT MATTER ───────────────────────────────────────────    │
│  Title page:        ✓ Generated                              │
│  Copyright:         ✓ Generated (editable)                   │
│  Dedication:        "For Grandma Rose" [edit]                │
│                                                              │
│  BACK MATTER ────────────────────────────────────────────    │
│  About the Author:  [Add]                                    │
│  Acknowledgments:   [Add]                                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Publication formats (phased):**

Phase 1 (launch):
- **PDF download** — direct Typst → PDF compilation. Production-ready.
- **Web page** — static HTML at `abaci.one/books/[slug]`. Responsive layout, shareable URL.

Phase 2 (post-launch):
- **ePub** — separate pipeline: structured content → pandoc or epub-gen. Required for e-readers.
- **Print-on-demand** — KDP (Amazon) or Lulu integration. Requires specific PDF specs (bleed, trim, spine width based on page count). The agent generates a KDP-compliant PDF with correct dimensions.

**Output:** `writing_publications` created with format, URL, metadata.

### Revision Deep Dive

Revision is the most complex workflow stage because it's iterative, involves fundamentally different types of edits, and the author's attention is a scarce resource. The UX must optimize for: surfacing creative decisions to the author, automating mechanical fixes, and showing progress without overwhelming.

#### The Four Edit Types

Each type has a different interaction pattern, trust level, and review cadence.

**1. Structural Edits** (developmental)
- *What:* "This scene should come before the confrontation", "Chapter 7 drags — consider merging with 8", "The protagonist's motivation is unclear in act 2"
- *Agent produces:* Revision proposals — each is a card with reasoning, affected text, and a preview of the proposed change
- *Author interaction:* Read the reasoning → expand to see before/after preview → accept, reject, or discuss
- *Trust level:* LOW — these are creative decisions only the author can make
- *UX:* Proposal cards with threaded discussion. Author and agent go back and forth until the author approves or dismisses. Accepted proposals are executed by the agent in the Y.Doc.

**2. Line Edits** (craft)
- *What:* "This sentence is awkward", "This metaphor is mixed", "This paragraph repeats the point from two paragraphs ago", "Show don't tell here"
- *Agent produces:* Inline tracked changes (insertions/deletions) with brief rationale per change
- *Author interaction:* Review changes in the editor, accept/reject individually or in batches
- *Trust level:* MEDIUM — author should review but most suggestions will be good
- *UX:* Track changes mode in Tiptap (green insertions, strikethrough deletions). Sidebar shows change list grouped by chapter. Batch accept/reject controls. Each change expandable to see agent's reasoning.

**3. Copy Edits** (mechanical)
- *What:* Grammar fixes, punctuation, spelling, sentence fragments, subject-verb agreement
- *Agent produces:* Inline tracked changes, same as line edits but categorized separately
- *Author interaction:* Batch review — most are auto-applied, exceptions flagged
- *Trust level:* HIGH — these are mechanical and the agent is almost always right
- *UX:* Default behavior is auto-accept. Author sees a summary ("47 copy edits applied"). An "exceptions" list shows any changes the agent was uncertain about. Author can toggle to manual review mode if they want to see everything.

**4. Continuity Checks** (cross-reference)
- *What:* "In chapter 2 the house is blue, in chapter 7 it's green", "Character named 'Sarah' in ch3, 'Sara' in ch9", "Timeline: Monday in ch4, but 'the next day' in ch5 is also Monday"
- *Agent produces:* Continuity cards showing both passages side-by-side with the contradiction highlighted
- *Author interaction:* Choose which version is correct (or provide the correct answer)
- *Author interaction:* The agent fixes all instances to match
- *Trust level:* LOW for deciding which is correct, HIGH for executing the fix
- *UX:* Split-pane view showing both passages in context. Author picks the correct version or writes the correction. Agent propagates the fix everywhere.

#### The Pass System

Revision is organized as **passes** — focused sweeps through the manuscript. Each pass has a type and a scope.

```
Pass Types:
  STRUCTURAL    → Produces proposal cards (creative decisions)
  LINE_EDIT     → Produces tracked changes (craft improvements)
  COPY_EDIT     → Produces tracked changes (mechanical fixes, mostly auto-applied)
  CONTINUITY    → Produces continuity cards (cross-reference contradictions)
  VOICE_CHECK   → Produces tracked changes (style guide adherence)
  PACING        → Produces proposal cards (scene length, chapter rhythm)

Pass Scope:
  CHAPTER(id)   → Single chapter
  FULL_BOOK     → Entire manuscript
  RANGE(ch1-ch5)→ Chapter range
```

**Pass lifecycle:**
```
1. Agent proposes a pass
   → "I'd like to do a structural review of the full manuscript"
   → Author approves or redirects ("do line edits on chapter 3 first")

2. Agent executes the pass
   → Works through the scope, producing findings
   → For mechanical passes (copy edit): changes are applied immediately
   → For creative passes (structural, pacing): proposals are queued
   → Progress shown: "Reviewing chapter 4 of 12..."

3. Author reviews findings
   → Review queue shows items needing attention, grouped by type
   → Creative decisions are highlighted, mechanical changes summarized
   → Author processes at their own pace
   → Agent continues working on unblocked items

4. Pass completes when all findings are resolved
   → Agent summarizes what changed
   → Agent proposes next pass (or author requests one)
   → Repeat until manuscript is polished
```

#### The Review Queue

The central UX element for revision. This is NOT a chat — it's a structured feed of items needing author attention.

```
┌─────────────────────────────────────────────────────────┐
│  REVISION — Pass 2: Line Edit (Full Book)               │
│  Progress: ████████░░ 8/12 chapters reviewed            │
│  Items: 3 need your input · 14 accepted · 2 rejected    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ⚡ NEEDS YOUR INPUT                                    │
│                                                         │
│  ┌─ Chapter 3, ¶7 ───────────────────────────────────┐ │
│  │ "The sun set behind the mountains, casting long     │ │
│  │  shadows across the [-valley-] {+meadow+} as she   │ │
│  │  walked..."                                         │ │
│  │                                                     │ │
│  │ Agent: "Valley" was used 3 times in the previous   │ │
│  │ paragraph. "Meadow" varies the language and better  │ │
│  │ fits the pastoral tone established in this scene.   │ │
│  │                                                     │ │
│  │ [Accept] [Reject] [Edit] [Discuss]                  │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ Chapter 5, ¶12 ──────────────────────────────────┐ │
│  │ STRUCTURAL: This flashback interrupts the tension   │ │
│  │ of the chase scene. Consider moving it to the       │ │
│  │ quiet moment at the start of chapter 6.             │ │
│  │                                                     │ │
│  │ [Preview Move] [Keep Here] [Discuss]                │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  ✅ AUTO-APPLIED (47 copy edits)         [Review All]   │
│  ✅ ACCEPTED (14 line edits)             [Review All]   │
│  ❌ REJECTED (2 changes)                 [Review All]   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### Author Trust Levels & Preferences

Authors set their comfort level per edit type. This controls what gets auto-applied vs. queued for review.

```
Trust Settings (per project):
  Copy edits:      [Auto-apply] / Manual review
  Line edits:      Auto-apply / [Manual review]
  Voice checks:    Auto-apply / [Manual review]
  Structural:      [Always review]  (cannot be auto-applied)
  Continuity:      [Always review]  (cannot be auto-applied)
```

Defaults are shown in brackets. A hands-on author can set everything to manual review. A hands-off author can set line edits to auto-apply and only review structural decisions.

The agent adapts its behavior based on trust levels:
- For auto-apply types: agent makes changes directly, logs them, shows summary
- For manual review types: agent produces proposals/tracked changes, waits for author
- Author can change trust levels mid-project (e.g., "I trust your line edits now, auto-apply those")

#### Discussion Threads on Proposals

When the author hits "Discuss" on a proposal, it opens a focused conversation:

```
┌─ Discussion: Chapter 5 flashback placement ──────────┐
│                                                       │
│ Agent: This flashback interrupts the chase scene      │
│ tension. The reader is mid-action and suddenly pulled  │
│ into a childhood memory. I suggest moving it to the   │
│ quiet moment at the start of chapter 6, where the     │
│ protagonist is reflecting anyway.                      │
│                                                       │
│ Author: I see your point, but the flashback is        │
│ triggered by the smell of smoke during the chase.     │
│ That connection would be lost if moved.               │
│                                                       │
│ Agent: Good point — the sensory trigger matters.      │
│ Alternative: keep the flashback here but shorten it   │
│ to 2-3 sentences (currently 2 paragraphs). This       │
│ preserves the trigger while maintaining chase tension. │
│ Want me to draft a shortened version?                  │
│                                                       │
│ Author: Yes, try that.                                │
│                                                       │
│ Agent: [Drafting shortened version in the document...] │
│                                                       │
│ [View in Document] [Resolve] [Keep Discussing]         │
└───────────────────────────────────────────────────────┘
```

Key behavior: when the author and agent reach agreement, the agent executes the change in the Y.Doc. The discussion thread is attached to the document location and can be referenced later.

#### Continuity View

A dedicated view for cross-reference issues:

```
┌─────────────────────────────────────────────────────────┐
│  CONTINUITY CHECK — 4 issues found                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─ Character Name ──────────────────────────────────┐ │
│  │ Ch.3 ¶4: "...Sarah walked to the door..."         │ │
│  │ Ch.9 ¶2: "...Sara opened the envelope..."         │ │
│  │                                                     │ │
│  │ Which is correct?                                   │ │
│  │ (•) Sarah  ( ) Sara  ( ) Other: [________]         │ │
│  │ [Fix All 7 Occurrences]                             │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ Setting Detail ──────────────────────────────────┐ │
│  │ Ch.2 ¶8: "...the blue Victorian house..."         │ │
│  │ Ch.7 ¶1: "...the green house on Maple Street..."  │ │
│  │                                                     │ │
│  │ Same house? If yes, which color?                    │ │
│  │ ( ) Blue  ( ) Green  (•) Different houses           │ │
│  │ [Resolve]                                           │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### Revision Completion

The revision stage isn't "done" after one round. The agent proposes passes until the manuscript meets quality criteria:

```
Revision completion criteria (agent evaluates after each pass):
  □ No unresolved continuity issues
  □ Style guide adherence score > threshold (agent self-evaluates)
  □ No structural concerns flagged
  □ All discussion threads resolved
  □ Author has reviewed all manual-review items

When criteria are met:
  Agent: "The manuscript looks polished. I've completed 4 passes
  (1 structural, 2 line edit, 1 copy edit) and resolved all continuity
  issues. Ready to move to illustration planning?"
  Author: Approves → workflow advances
  Author: "Do another line edit pass on chapters 8-10" → agent complies
```

#### Technical Implementation Notes

**Track changes in Tiptap:**
- Use `prosemirror-changeset` for the foundational diff tracking
- Custom ProseMirror marks for suggested insertions/deletions
- Each mark carries metadata: `{ passId, editType, agentReasoning, status }`
- Accept = remove mark (keep content). Reject = remove content (revert).

**Proposal cards:**
- Stored in `writing_agent_actions` table with `action_type: 'proposal'`
- Link to Y.Doc positions via Yjs relative positions (survive concurrent edits)
- Preview renders use a shadow Y.Doc fork — apply proposed changes to a copy, render diff

**Discussion threads:**
- Stored as entries in `writing_agent_actions` with a `parent_id` chain
- Anchored to document positions via Yjs relative positions
- Rendered in a sidebar panel or modal, linked to document location

**Auto-apply with audit trail:**
- Even auto-applied changes are logged in `writing_agent_actions`
- Author can retroactively review and revert any auto-applied change
- "Review All" button shows the full log with diffs

### LLM-as-Yjs-Collaborator Architecture

The agent is a Yjs peer. It connects server-side and participates in the document like any other user.

```
┌─────────────────────────────────────────────────┐
│                   Browser                        │
│                                                  │
│  ┌──────────────┐    ┌────────────────────────┐ │
│  │ Author's     │    │ Agent Awareness Panel   │ │
│  │ Editor       │    │ "Agent is drafting..."  │ │
│  │ (Tiptap +    │    │ "Agent left 2 comments" │ │
│  │  Y.Doc)      │    │ [Pause Agent] [Resume]  │ │
│  └──────┬───────┘    └────────────────────────┘ │
│         │                                        │
│    Socket.IO                                     │
└─────────┼────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────┐
│              Server (Socket.IO + Yjs)            │
│                                                  │
│  ┌──────────────┐    ┌────────────────────────┐ │
│  │ Yjs Room     │◄──►│ Agent Process           │ │
│  │ (Y.Doc +     │    │                         │ │
│  │  Awareness)  │    │ - Connects as Yjs peer  │ │
│  │              │    │ - Streams LLM output    │ │
│  └──────────────┘    │   into Y.Doc            │ │
│                      │ - Sets awareness state  │ │
│                      │ - Reads author's edits  │ │
│                      │ - Persists to DB        │ │
│                      └────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Key behaviors:**

1. **Agent connects as a Yjs peer on the server side.** It has its own `clientID` and awareness state. From the browser's perspective, it's just another user editing the document.

2. **LLM streaming maps to Y.Doc transactions.** As the LLM streams tokens, they are inserted into the Y.Doc in small batches (every ~50ms or ~20 chars). The author sees text appearing in real-time, character by character, at the agent's cursor position.

3. **Awareness communicates agent state.** The agent's awareness includes:
   - `status`: 'thinking' | 'drafting' | 'revising' | 'commenting' | 'idle' | 'waiting_for_approval'
   - `currentSection`: which part of the document the agent is working on
   - `message`: human-readable status ("Drafting chapter 3, paragraph 2...")

4. **Comments are Y.Map annotations.** The agent creates comment anchors in the document (like Google Docs comments). Each comment has:
   - Text range anchor (survives edits via Yjs relative positions)
   - Comment text (the agent's question or suggestion)
   - Status: 'open' | 'resolved'
   - Author can reply, resolve, or let the agent handle it

5. **Conflict resolution: author always wins.** If the author edits a region the agent is currently writing, the agent detects this (via Y.Doc observation), stops its current operation in that region, reads the author's changes, and adapts. The agent never overwrites the author's edits.

6. **Agent can be paused/resumed.** The author can pause the agent at any time. When paused, the agent stops all editing but maintains its awareness state and context. When resumed, it picks up where it left off.

### Rich Text Editor

**Tiptap** (ProseMirror-based) with Yjs binding:
- `@tiptap/core` + `@tiptap/starter-kit` for base editing
- `@tiptap/extension-collaboration` for Yjs binding
- `@tiptap/extension-collaboration-cursor` for multi-cursor display
- `@tiptap/extension-comment` (or custom) for inline comments
- `@tiptap/extension-image` for inline illustrations

Tiptap is the right choice because:
- First-class Yjs integration (y-prosemirror binding)
- Extensible (custom nodes for illustration slots, agent comments)
- ProseMirror under the hood = battle-tested collaborative editing
- Good React integration

### Illustration Pipeline & Consistency System

The illustration system borrows directly from the existing character image infrastructure:
- **Reference image chaining** (like profile variant cascades)
- **Style modifiers** layered on a locked base style (like size/theme/state modifiers)
- **Image-to-image generation** to maintain visual identity across scenes
- **Multi-provider support** (Gemini, OpenAI — both support image-to-image)

#### The Consistency Problem

A children's book with character "Lucy" appearing in 15 illustrations needs Lucy to look like the *same person* in every image. Same hair, same face shape, same clothing style. The forest in chapter 2 needs to look like the same forest in chapter 8. The art style (watercolor, digital, pencil) must be uniform across every illustration.

This is the same problem the character profile system solves with its 18-variant matrix — maintaining identity across size/theme/state variations. The book illustration system generalizes this pattern.

#### Reference Sheet System

Before generating any scene illustrations, the agent generates **reference sheets** — canonical visual definitions that anchor all future generation.

```
Reference Sheet Types:

1. CHARACTER SHEETS
   - Generated during ILLUSTRATION_PLANNING stage
   - One per named character
   - Contains: front view, 3/4 view, expression range, key outfit
   - Stored as approved reference images in writing_illustrations
   - Every scene prompt containing this character includes the sheet as image-to-image input
   - Author approves character sheet before any scene illustrations begin

2. SETTING SHEETS
   - One per key location (the house, the forest, the classroom)
   - Contains: wide establishing shot, key architectural/natural details, color palette
   - Used as reference when generating scenes in that location
   - Less strict than character sheets — settings can vary by time of day, season

3. STYLE SHEET
   - One per project (generated during STYLE_LOCK or ILLUSTRATION_PLANNING)
   - Defines the visual language: medium, line weight, color palette, level of detail
   - NOT an image — it's a structured prompt prefix applied to every generation
   - Example: "Soft watercolor illustration, muted earth tones with pops of
     warm yellow, loose brushwork, visible paper texture, minimal outlines,
     children's book style reminiscent of Beatrix Potter"
   - Author approves this style definition before any generation begins
```

#### Reference Sheet Data Model

```sql
-- Extends writing_illustrations table
writing_reference_sheets (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES writing_projects(id),
  sheet_type      TEXT NOT NULL,  -- 'character', 'setting', 'prop'
  name            TEXT NOT NULL,  -- 'Lucy', 'The Forest', 'The Magic Lantern'
  description     TEXT NOT NULL,  -- Detailed visual description
  generation_prompt TEXT,         -- Prompt used to generate the sheet
  image_url       TEXT,           -- Approved reference image
  image_variants  TEXT,           -- JSON: array of variant URLs (author picks one)
  text_references TEXT,           -- JSON: passages from the manuscript that describe this entity
  status          TEXT NOT NULL DEFAULT 'planned',  -- 'planned', 'generating', 'generated', 'approved'
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
)
```

#### Generation Cascade (Adapted from Character Profile System)

The character profile system uses a dependency chain: base → size variants → theme variants → state variants, each using the previous as a reference image. The illustration system uses an analogous cascade:

```
Project Style Sheet (text prompt prefix, applies to everything)
  │
  ├─→ Character Sheet: Lucy (image-to-image reference)
  │     ├─→ Scene: "Lucy finds the key" (Lucy sheet + style + scene description)
  │     ├─→ Scene: "Lucy opens the door" (Lucy sheet + style + scene description)
  │     └─→ Scene: "Lucy meets the owl" (Lucy sheet + Owl sheet + style + scene)
  │
  ├─→ Character Sheet: The Owl (image-to-image reference)
  │     └─→ (used in scenes containing the owl)
  │
  ├─→ Setting Sheet: The Forest (image-to-image reference)
  │     ├─→ Scene: "Lucy enters the forest" (Lucy sheet + Forest sheet + style)
  │     └─→ Scene: "The owl's tree" (Owl sheet + Forest sheet + style)
  │
  └─→ Setting Sheet: Lucy's House (image-to-image reference)
        └─→ Scene: "Lucy finds the key" (Lucy sheet + House sheet + style)
```

**Key behavior:** Every scene illustration prompt is assembled from:
1. The **style sheet** (text prefix — always included)
2. The **character reference sheets** for characters in the scene (as image-to-image input)
3. The **setting reference sheet** for the location (as image-to-image input)
4. The **scene-specific brief** (what's happening, composition, mood)

This is directly analogous to how `profile-image-generate.ts` builds prompts with `SIZE_MODIFIERS`, `THEME_MODIFIERS`, and `STATE_MODIFIERS` layered on the base character identity — but for arbitrary scenes instead of a fixed variant matrix.

#### Prompt Assembly

```typescript
interface IllustrationPrompt {
  // Always present — defines the visual language
  stylePrefix: string          // From project style sheet

  // Scene-specific
  sceneDescription: string     // "Lucy kneels in the garden, finding a brass key half-buried in soil"
  composition: string          // "Medium shot, eye-level, Lucy centered, key in foreground"
  mood: string                 // "Warm afternoon light, sense of discovery"
  colorNotes: string           // "Golden hour palette, warm shadows"

  // Reference images for image-to-image consistency
  referenceImages: {
    type: 'character' | 'setting' | 'prop'
    name: string               // "Lucy", "The Garden"
    imageUrl: string           // Approved reference sheet image
    weight: number             // How strongly to match this reference (0.3-0.8)
  }[]

  // Negative prompt / constraints
  avoid: string                // "No modern clothing, no text, no borders"
}

// Assembly function (mirrors profile-image-generate.ts modifier pattern)
function assemblePrompt(
  styleSheet: StyleSheet,
  brief: ImageBrief,
  referenceSheets: ReferenceSheet[],
): IllustrationPrompt {
  return {
    stylePrefix: styleSheet.prompt,
    sceneDescription: brief.description,
    composition: brief.composition,
    mood: brief.mood,
    colorNotes: brief.colorNotes ?? styleSheet.defaultColorNotes,
    referenceImages: referenceSheets
      .filter(sheet => brief.entities.includes(sheet.name))
      .map(sheet => ({
        type: sheet.sheet_type,
        name: sheet.name,
        imageUrl: sheet.image_url,
        weight: sheet.sheet_type === 'character' ? 0.7 : 0.4, // Characters need stronger matching
      })),
    avoid: styleSheet.negativePrompt,
  }
}
```

#### Illustration Workflow UX

```
┌─────────────────────────────────────────────────────────────┐
│  ILLUSTRATIONS — "Lucy and the Brass Key"                    │
│  Style: Soft watercolor · 15 planned · 4 approved            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  REFERENCE SHEETS                                            │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐               │
│  │ Lucy   │ │ Owl    │ │ Forest │ │ House  │               │
│  │ [img]  │ │ [img]  │ │ [img]  │ │ [img]  │               │
│  │   ✓    │ │   ✓    │ │   ✓    │ │ pending│               │
│  └────────┘ └────────┘ └────────┘ └────────┘               │
│  [+ Add Reference Sheet]                                     │
│                                                              │
│  SCENE ILLUSTRATIONS                                         │
│  ┌─ Ch.1 "Lucy finds the key" ──────────────────────────┐  │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                │  │
│  │  │ v1   │ │ v2   │ │ v3 ★ │ │ v4   │  ← variants   │  │
│  │  └──────┘ └──────┘ └──────┘ └──────┘                │  │
│  │  Refs: Lucy, House   Mood: warm discovery             │  │
│  │  [Approve v3] [Regenerate] [Edit Brief] [Discuss]     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Ch.2 "The forest path" ─────────────────────────────┐  │
│  │  Status: Generating...  ████████░░                    │  │
│  │  Refs: Lucy, Forest                                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Ch.3 "Meeting the owl" ─────────────────────────────┐  │
│  │  Status: Waiting for House reference sheet             │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### Consistency Feedback Loop

When the author rejects a variant, the feedback is structured:

```
Rejection reasons (author picks one or more):
  □ Character doesn't look right (→ regenerate with stronger character ref weight)
  □ Setting doesn't match (→ regenerate with stronger setting ref weight)
  □ Style inconsistent (→ regenerate with style emphasis)
  □ Wrong mood/lighting (→ adjust mood in brief)
  □ Composition issue (→ adjust composition in brief)
  □ Other: [free text]

Agent uses rejection reason to adjust the next generation attempt:
  - "Character doesn't look right" → increase character reference weight from 0.7 to 0.85
  - "Style inconsistent" → prepend style reinforcement to prompt
  - "Wrong mood" → rewrite mood portion of brief, keep everything else
```

If a character consistently looks wrong across multiple illustrations, the agent can propose regenerating the character reference sheet itself — cascading the new reference to all dependent illustrations (same cascade pattern as the profile variant system).

#### Reuse from Existing Infrastructure

| Existing System | Reuse in WriteSmith |
|----------------|---------------------|
| `image-generation.ts` | Core generation + storage interface |
| `image-providers/gemini.ts` | Gemini image-to-image with reference images |
| `image-providers/openai.ts` | OpenAI image generation + edits |
| `image-storage.ts` | Persistent storage (NFS/data dir) + serving via API |
| `profile-image-generate.ts` | Cascade pattern, modifier system, reference chaining |
| `profile-variants.ts` | Variant naming scheme (adapt for illustration IDs) |
| Admin character grid UI | Reference sheet grid + variant picker UI pattern |
| Blog image admin crop editor | Illustration crop/positioning for layout |

### Typst Book Templates

Extend `packages/templates` with book layout templates:

```typst
// book.typ — Master book template
#let book(
  title: "",
  subtitle: "",
  author: "",
  chapters: (),
  illustrations: (:),  // id → image path mapping
  style: (
    font: "Libertinus Serif",
    font-size: 11pt,
    page-size: "us-letter",  // or custom dimensions
    margins: (top: 1in, bottom: 1in, inside: 1.25in, outside: 0.75in),
    chapter-heading-font: "Libertinus Sans",
  ),
) = {
  // Title page
  // Copyright page
  // Table of contents
  // Chapter content with illustration placement
  // Page numbers, headers/footers
}
```

Template variants:
- `children-picture-book.typ` — Large illustrations, minimal text, large font
- `chapter-book.typ` — Standard novel layout with occasional illustrations
- `coffee-table.typ` — Image-heavy, premium layout
- `memoir.typ` — Clean, text-focused with photo inserts

### File Structure

```
apps/web/src/
  app/write/
    page.tsx                      # Dashboard: list projects, create new
    [projectId]/
      page.tsx                    # Project overview + workflow stage navigator
      edit/
        page.tsx                  # Main editor (Tiptap + Yjs)
        [chapterId]/
          page.tsx                # Chapter-specific editor view
      illustrations/
        page.tsx                  # Illustration gallery + generation UI
      preview/
        page.tsx                  # Book preview (rendered Typst)
      publish/
        page.tsx                  # Publication options + export

  lib/writing/
    agent/
      agent-loop.ts              # Main agent orchestration loop
      agent-yjs-peer.ts          # Agent's Yjs connection (server-side)
      agent-awareness.ts         # Agent awareness state management
      stage-handlers/
        ideation.ts
        outline.ts
        style-lock.ts
        drafting.ts
        revision.ts
        illustration-planning.ts
        illustration-generation.ts
        layout.ts
        publication.ts
    workflow/
      stage-machine.ts           # Workflow state machine
      transitions.ts             # Valid stage transitions + guards
    illustration/
      brief-generator.ts         # Text → image brief
      prompt-builder.ts          # Brief + style → generation prompt
      style-consistency.ts       # Style lock enforcement
    typesetting/
      book-compiler.ts           # Typst source generation
      template-selector.ts       # Pick template based on genre/format
      layout-engine.ts           # Text + image placement logic
    publishing/
      pdf-export.ts
      epub-export.ts
      web-export.ts
      print-on-demand.ts         # API integration (future)
    yjs/
      document-schema.ts         # Y.Doc structure for book chapters
      persistence.ts             # Y.Doc ↔ DB serialization
      comment-model.ts           # Inline comment anchoring
    project/
      project-manager.ts         # CRUD, status, lifecycle
      style-guide.ts             # Style guide schema + helpers

  components/writing/
    Editor/
      WritingEditor.tsx          # Main Tiptap editor with Yjs
      AgentCursor.tsx            # Agent's cursor/selection display
      CommentThread.tsx          # Inline comment UI
      IllustrationSlot.tsx       # Inline illustration placeholder
    Dashboard/
      ProjectList.tsx            # All projects
      NewProjectWizard.tsx       # Project creation flow
    Workflow/
      StageNavigator.tsx         # Visual workflow progress
      StagePanel.tsx             # Current stage UI
      AgentStatusBar.tsx         # What the agent is doing
    Illustration/
      IllustrationGallery.tsx    # View/manage all illustrations
      ImageBriefEditor.tsx       # Edit image briefs
      VariantPicker.tsx          # Choose from generated variants
    Preview/
      BookPreview.tsx            # Rendered PDF preview
      PageNavigator.tsx          # Page-by-page navigation
    Publish/
      ExportOptions.tsx          # Format selection + settings
      PublishConfirmation.tsx    # Final review before publish

  hooks/
    useWritingProject.ts         # Project data + mutations
    useWritingAgent.ts           # Agent state, pause/resume, status
    useWritingEditor.ts          # Tiptap + Yjs setup
    useWritingWorkflow.ts        # Workflow stage state
    useIllustrations.ts          # Illustration CRUD + generation

  contexts/
    WritingProjectContext.tsx     # Current project provider
    WritingAgentContext.tsx       # Agent state provider
```

### API Routes

```
POST   /api/write/projects                    # Create project
GET    /api/write/projects                    # List user's projects
GET    /api/write/projects/[id]               # Get project details
PATCH  /api/write/projects/[id]               # Update project
DELETE /api/write/projects/[id]               # Archive project

POST   /api/write/projects/[id]/chapters      # Add chapter
PATCH  /api/write/projects/[id]/chapters/[id] # Update chapter
DELETE /api/write/projects/[id]/chapters/[id] # Remove chapter
POST   /api/write/projects/[id]/chapters/reorder  # Reorder chapters

POST   /api/write/projects/[id]/agent/start   # Start/resume agent
POST   /api/write/projects/[id]/agent/pause   # Pause agent
POST   /api/write/projects/[id]/agent/advance  # Advance workflow stage
POST   /api/write/projects/[id]/agent/feedback # Author feedback on agent action

POST   /api/write/projects/[id]/illustrations          # Plan illustration
POST   /api/write/projects/[id]/illustrations/[id]/generate  # Generate image
PATCH  /api/write/projects/[id]/illustrations/[id]     # Update/approve
DELETE /api/write/projects/[id]/illustrations/[id]     # Remove

POST   /api/write/projects/[id]/preview       # Generate preview PDF
POST   /api/write/projects/[id]/publish       # Publish in requested format
GET    /api/write/projects/[id]/publications  # List publications
```

---

## Development Phases

### Phase 1: Foundation (Milestone: "Author can create a project and write in it")
- [ ] Database schema (writing_projects, writing_chapters)
- [ ] Project CRUD API routes
- [ ] /write dashboard page (list projects, create new)
- [ ] Tiptap editor with basic Yjs collaboration (no agent yet)
- [ ] Y.Doc persistence to writing_chapters table
- [ ] Chapter management (add, reorder, delete)

### Phase 2: Agent Core (Milestone: "Agent can draft a chapter in real-time")
- [ ] Agent Yjs peer (server-side connection to Y.Doc)
- [ ] Agent awareness state (status, current section)
- [ ] LLM streaming → Y.Doc insertion pipeline
- [ ] Agent cursor display in Tiptap (AgentCursor component)
- [ ] Agent pause/resume controls
- [ ] Basic agent loop: receive instruction → draft text → stop

### Phase 3: Workflow Engine (Milestone: "Agent drives a project from idea to manuscript")
- [ ] Workflow state machine (stage transitions, guards)
- [ ] writing_workflow_state table
- [ ] writing_agent_actions table (audit trail)
- [ ] Stage handlers: ideation, outline, style_lock
- [ ] Stage handlers: drafting, revision
- [ ] StageNavigator UI component
- [ ] Agent-initiated stage transitions with author approval
- [ ] Inline comment system (agent leaves comments, author resolves)

### Phase 4: Illustrations (Milestone: "Agent generates consistent illustrations for a book")
- [ ] writing_illustrations table
- [ ] Illustration planning stage handler
- [ ] Text context → image brief generator
- [ ] Style-locked prompt builder
- [ ] Image generation integration (extend existing infra)
- [ ] Variant picker UI
- [ ] Illustration slot Tiptap node (inline in editor)
- [ ] Cross-chapter style consistency enforcement

### Phase 5: Typesetting & Publishing (Milestone: "Author holds a PDF of their book")
- [ ] Typst book templates (children's, chapter book, memoir)
- [ ] Book compiler (text + images → Typst source)
- [ ] Layout engine (pagination, image placement)
- [ ] Preview renderer (Typst → PDF → preview UI)
- [ ] PDF export
- [ ] ePub export (stretch)
- [ ] Web publishing (shareable URL) (stretch)
- [ ] writing_publications table

### Phase 6: Polish & Separation (Milestone: "Production-ready standalone app")
- [ ] Extract packages/database
- [ ] Extract packages/auth
- [ ] Extract packages/realtime
- [ ] Create apps/write as separate Next.js app
- [ ] TTS integration (read-aloud for children's books)
- [ ] Classroom integration (teacher assigns writing projects)
- [ ] Print-on-demand integration (stretch)

---

## Key Technical Decisions

### Why Tiptap?
- First-class Yjs integration via y-prosemirror
- ProseMirror-based = extensible, battle-tested
- Custom nodes for illustration slots, agent comments
- Good React support
- Already used in production by many collaborative editors

### Why Typst over LaTeX?
- Already in the codebase (packages/templates)
- WASM compiler = runs in Node.js, no system dependency
- Modern syntax, much simpler than LaTeX
- Excellent for programmatic generation (agent can write Typst)
- Fast compilation
- Good typography defaults

### Why agent-as-Yjs-peer instead of chat-based?
- The document IS the interface — no context switching
- Author sees the agent working in real-time (trust, transparency)
- Conflict resolution is handled by CRDTs (no manual merge)
- The agent can reference specific text positions (comments, selections)
- Multiple simultaneous editors (author + agent + future: co-author) just work

### Why server-side agent process?
- Agent needs long-running LLM calls (can't live in browser)
- Agent needs database access (workflow state, illustration storage)
- Agent needs image generation API access
- Server-side Yjs is well-supported (y-protocols works in Node.js)
- Can run as background task when author is offline

### Image model strategy
- Use project-level style configuration to lock visual consistency
- Include character reference descriptions in every prompt
- Generate multiple variants, let author choose
- Store approved images as reference for future generations
- Specific model selection TBD (depends on what's best at build time)

---

## Resolved Technical Decisions

### Y.Doc Format: ProseMirror Schema (Y.XmlFragment)

**Decision:** Use Tiptap's native ProseMirror schema with Y.XmlFragment, not Y.Text with markdown.

**Rationale:**
- Tiptap IS ProseMirror — Y.XmlFragment is its native Yjs binding. Using Y.Text would mean maintaining a separate markdown representation and syncing it, defeating the purpose.
- Books need rich text (bold, italic, headings, images, scene breaks). Markdown in Y.Text would require parsing and re-rendering on every change.
- The LLM doesn't need to produce ProseMirror operations directly. The agent-yjs-peer receives plain text (possibly with lightweight markdown formatting) from the LLM stream and translates it into Tiptap editor commands. Tiptap's API handles the ProseMirror insertion, and the Tiptap ↔ Yjs binding handles CRDT sync automatically.

**Agent writing flow:**
```
LLM streams tokens → agent-yjs-peer batches text (~50ms / ~20 chars)
  → Tiptap editor.commands.insertContent(text) on server-side editor instance
  → y-prosemirror syncs Y.XmlFragment to all connected clients
  → Author's browser renders the update
```

The agent operates through Tiptap's command API, not raw Y.Doc manipulation. This means the agent can use `editor.commands.insertContent()`, `editor.commands.setHeading()`, `editor.commands.insertImage()`, etc. — same API a human user's keystrokes go through.

### Agent Orchestration: Event-Driven Per-Action with Persistent Context

**Decision:** Each agent action is a discrete LLM call (or streaming session). No long-running process. Context is reconstructed from the database before each action.

**Rationale:**
- **Reliability:** No long-running process to crash, leak memory, or lose state. If the server restarts, the agent picks up where it left off.
- **Cost efficiency:** No idle LLM calls. The agent only runs when there's work to do.
- **Offline work:** The agent can work without the author's browser open — it reads from and writes to the database.
- **Scalability:** Multiple projects can share server resources since no project holds a persistent process.

**Event-driven loop:**
```
Author creates project   → trigger: ideation handler
Author approves brief    → trigger: outline handler
Author approves outline  → trigger: style_lock handler
Author approves style    → trigger: drafting handler (per chapter)
Chapter draft complete   → trigger: next chapter or wait for approval
Author approves all      → trigger: revision handler (per pass)
...and so on through the pipeline
```

Each handler:
1. Reads project state from DB (brief, style guide, chapter summaries, workflow state)
2. Constructs LLM context (see "Agent Context Management" below)
3. Makes LLM call(s) — streaming for drafting, structured for proposals
4. Writes results back to DB (Y.Doc updates, workflow state, agent actions log)
5. Notifies author via Socket.IO awareness if they're connected

**For drafting** (the longest operation), the agent streams a chapter at a time. If interrupted (server restart, author pause), it can resume from the last persisted Y.Doc state — the CRDT preserves all prior edits.

### Agent Context Management

**Problem:** When drafting chapter 12, the agent needs awareness of chapters 1-11. For a full novel (~80k words), the entire manuscript doesn't fit in a single LLM context window alongside the system prompt, style guide, and instructions.

**Strategy: Hierarchical context with targeted full-text access.**

```
Context budget for any agent action:

ALWAYS INCLUDED (fixed cost):
  - System prompt + role instructions         ~2k tokens
  - Project brief (synopsis, characters)      ~1k tokens
  - Locked style guide + sample passage       ~1k tokens
  - Current workflow state                    ~200 tokens
  Total fixed:                                ~4k tokens

CHAPTER SUMMARIES (scales with book length):
  - Auto-generated 1-2 paragraph summary per completed chapter
  - Stored in writing_chapters.summary (generated after each draft)
  - For a 20-chapter book: ~4k tokens
  Total summaries:                            ~2-6k tokens

TARGETED FULL TEXT (varies by action):
  - Current chapter being drafted/revised     ~2-8k tokens
  - Previous chapter (for continuity)         ~2-8k tokens
  - Specific passages referenced by agent     ~1-4k tokens
  Total targeted:                             ~5-20k tokens

TOTAL CONTEXT:                                ~11-30k tokens
  (well within 128k-200k context windows)
```

**For short works** (children's books, <10k words): Full manuscript fits in context. Include everything.

**For longer works** (novels, 50k+ words): Use summaries for distant chapters, full text for adjacent chapters. The agent can request specific passages if needed (e.g., during continuity checks, it reads the full text of chapters containing contradictions).

**Summary generation:** After each chapter is drafted/revised, the agent generates a structured summary:
```json
{
  "chapter": 3,
  "summary": "Mia travels through the gate to 1965 and meets her grandmother Ada as a 7-year-old...",
  "characters_present": ["Mia", "Young Ada"],
  "key_events": ["First time-travel", "Meeting young Ada", "Garden is pristine"],
  "setting": "Grandmother's garden, 1965",
  "emotional_arc": "Wonder → confusion → connection",
  "continuity_notes": ["Ada mentions her dog Pepper (not yet introduced)", "Garden has roses (matches ch.1 description)"]
}
```

These summaries are cached in `writing_chapters` and updated after each revision pass.

### Version History & Undo

**Snapshot system** for reverting agent actions and browsing project history.

```sql
writing_snapshots (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES writing_projects(id),
  chapter_id      TEXT REFERENCES writing_chapters(id),  -- NULL for project-level snapshots
  name            TEXT NOT NULL,        -- "Before structural revision pass 2"
  trigger         TEXT NOT NULL,        -- 'auto' | 'manual' | 'stage_transition'
  agent_action_id TEXT REFERENCES writing_agent_actions(id),  -- What triggered this snapshot
  yjs_doc_state   BLOB,                -- Full Y.Doc state at snapshot time
  project_state   TEXT,                 -- JSON: workflow stage, style guide, etc.
  created_at      INTEGER NOT NULL
)
```

**Auto-snapshots** are taken before:
- Every agent drafting action (before writing starts)
- Every revision pass (before changes are applied)
- Every structural edit (before restructuring)
- Every stage transition (before advancing workflow)
- Every auto-applied batch (before copy edits are applied)

**Named snapshots** at stage transitions:
- "Draft complete" (all chapters drafted)
- "Pre-revision" (before first revision pass)
- "Post-revision" (after all revision passes)
- "Pre-illustration" (manuscript locked for illustration)

**UX: Version Timeline**

```
┌─ VERSION HISTORY ────────────────────────────────────────┐
│                                                          │
│  Now ─── Post-revision (all passes complete)             │
│   │                                                      │
│   ├── Copy edit pass (47 changes auto-applied)           │
│   ├── Line edit pass 2 (23 changes)                      │
│   ├── Line edit pass 1 (31 changes)                      │
│   ├── Structural revision (3 proposals accepted)         │
│   │                                                      │
│   ├── Draft complete ★                                   │
│   ├── Ch.8 drafted                                       │
│   ├── Ch.7 drafted                                       │
│   ├── ...                                                │
│   ├── Ch.1 drafted                                       │
│   │                                                      │
│   ├── Style locked ★                                     │
│   ├── Outline approved ★                                 │
│   └── Project created ★                                  │
│                                                          │
│  [Preview Selected]  [Restore to This Point]             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Undo within a session:**
- Yjs `UndoManager` configured per-user — author can undo their own edits without undoing the agent's
- "Revert agent's last action" button — restores the snapshot taken before the agent's most recent action
- Auto-applied changes can be individually reverted (each logged in `writing_agent_actions` with the original text)

### Cost Tracking & Metering

Each agent action tracks its LLM and image generation costs.

```sql
-- Extends writing_agent_actions with cost tracking
-- (add columns to existing table)
writing_agent_actions.token_usage TEXT  -- JSON: { promptTokens, completionTokens, model, provider }
writing_agent_actions.image_count INTEGER DEFAULT 0
writing_agent_actions.estimated_cost_cents INTEGER  -- Estimated cost in cents
```

**Per-project cost dashboard:**

```
┌─ PROJECT COSTS ──────────────────────────────────────────┐
│  "The Key to Grandmother's Garden"                       │
│                                                          │
│  Writing (LLM):                                          │
│    Drafting:     127k tokens  ·  $0.84                   │
│    Revision:      89k tokens  ·  $0.59                   │
│    Other:         34k tokens  ·  $0.22                   │
│                                                          │
│  Illustrations:                                          │
│    Reference sheets:  6 images  ·  $0.24                 │
│    Scene images:     24 images  ·  $0.96                 │
│    (8 approved, 16 rejected variants)                    │
│                                                          │
│  Total estimated:  $2.85                                 │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Before expensive operations**, the agent estimates cost and warns:
- "Generating 4 variants for 15 illustrations will cost approximately $2.40. Proceed?"
- "A full-book revision pass will use approximately 80k tokens (~$0.53). Proceed?"

**Pricing model:** TBD but architecture supports both subscription (monthly limit) and per-project billing. The metering infrastructure is the same either way.

---

## Import Flow

For the "Self-Publisher" persona — users who bring an existing manuscript.

**Supported import formats:**

| Format | Method | Complexity |
|--------|--------|------------|
| Plain text paste | Paste into editor | Trivial |
| .txt file upload | Read and insert | Trivial |
| .docx upload | mammoth.js → HTML → Tiptap content | Medium |
| Copy-paste from web | Tiptap handles clipboard HTML/text | Trivial |
| Google Docs | OAuth + export as HTML (stretch goal) | High |

**Import workflow:**

```
1. User selects "Import Existing Manuscript" on dashboard
2. Upload file or paste text
3. Agent analyzes the text:
   - Detects chapter breaks (headings, "Chapter X", page breaks)
   - Proposes chapter structure
   - Identifies characters, setting, genre, tone
   - Estimates current word count and quality level
4. User reviews and adjusts chapter detection
5. Agent creates project with:
   - Brief auto-generated from manuscript analysis
   - Chapters populated with imported text
   - Style guide extracted from the existing writing
6. Workflow starts at a stage appropriate to the manuscript's state:
   - Raw draft → starts at REVISION
   - Polished manuscript → starts at ILLUSTRATION_PLANNING
   - Already illustrated → starts at LAYOUT
   - User can override and start at any stage
```

The agent preserves the author's existing voice — the style guide is extracted from the manuscript, not imposed.

---

## Agent-Driven Structural Recommendations

There are no project templates. The agent figures out the right structure from the ideation conversation.

When the author says "a story about a girl who finds a magic key in her grandmother's garden, for kids around age 7," the agent already knows enough to recommend: chapter book format, 8-12 chapters, ~8,000 words, one illustration per chapter, 6x9" trim. It doesn't need the author to pick from a menu — it makes the recommendation and explains why, and the author adjusts if they disagree.

**How this works in the ideation interview:**

The agent's recommendations emerge naturally from the conversation, not from a separate "configuration" step. As the author describes their vision, the agent builds an internal model of the book and surfaces structural suggestions inline:

```
Author: "It's a story about a girl who finds a magic key in her
grandmother's garden. For kids, maybe 6 or 7 year olds."

Agent: That sounds like a chapter book — short chapters with
illustrations, the kind a first or second grader could read
independently or have read to them. I'm thinking:

  - 8-10 chapters, each about 800-1,000 words
  - ~8,000 words total
  - One illustration per chapter (kids this age expect pictures)
  - Simple vocabulary, short sentences with rhythm

Does that feel right, or are you imagining something different?
Like a picture book (fewer words, illustration on every page)
or something longer?

Author: "That sounds right, but I think some chapters should
have two illustrations — the time-travel moments need visuals."

Agent: Makes sense — the transition scenes are the most vivid
and kids will want to see what Mia sees. I'll plan for 1-2
illustrations per chapter, with the time-travel chapters
getting the extra one. That puts us at about 12-15
illustrations total.
```

The agent draws on its knowledge of publishing conventions, age-appropriate reading levels, genre norms, and illustration density standards. It doesn't present these as rigid rules — it explains its reasoning so the author understands the trade-offs and can push back.

**Structural parameters the agent infers:**
- Word count range (from genre + audience age)
- Chapter count and length (from total length + pacing needs)
- Illustration density (from audience age + genre + author's emphasis)
- Vocabulary level (from audience age)
- Page format and trim size (from genre — deferred to Layout stage)
- Typst template choice (from genre — deferred to Layout stage)

All of these appear in the Project Brief for the author to review and adjust. None require the author to choose from a list.

**New project entry points:**

The dashboard offers two paths — start a new project (enters ideation interview) or import an existing manuscript. No template picker, no genre dropdown. The agent figures it out.

```
┌─────────────────────────────────────────────────────────────┐
│  YOUR PROJECTS                                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [+ New Project]    [Import Manuscript]                       │
│                                                              │
│  (existing projects listed here)                             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Open Questions

1. **Offline agent work:** Should the agent continue working when the author closes the browser? (e.g., "draft chapters 3-5 overnight") This requires background job infrastructure — the existing `background_tasks` table could be extended. Architecturally straightforward but raises UX questions: how does the author review what the agent did while they were away?

2. **Multi-model strategy:** Which LLM for drafting vs. revision vs. illustration prompts? Different models may excel at different stages. The `packages/llm-client` already supports multiple providers — this is a configuration decision, not an architecture decision. Can be tuned post-launch.

3. **Pricing model:** Per-project? Subscription? Token-based? The cost tracking infrastructure (above) supports all three. This is a business decision, not a technical one.

4. **Copyright & ownership:** Author owns all content, but what about AI-generated text and images? Need clear ToS. Legal question, not technical.

5. **Collaborative writing:** Should two humans be able to co-author? Yjs supports this natively, but the UX needs thought — who approves agent proposals? Who controls the workflow? Defer to post-launch.

6. **Print-on-demand specifics:** KDP requires specific PDF specs (bleed marks, trim size, spine width calculated from page count, 300 DPI images). Lulu and IngramSpark have different requirements. Which service to integrate first? Research needed when we reach Phase 5.
