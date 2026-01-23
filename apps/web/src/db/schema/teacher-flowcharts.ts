import { createId } from "@paralleldrive/cuid2";
import {
  blob,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { users } from "./users";

/**
 * Teacher Flowcharts table - User-created math flowcharts
 *
 * Teachers (or guests) can create their own flowcharts through the workshop.
 * These can be published and shared with other users.
 */
export const teacherFlowcharts = sqliteTable(
  "teacher_flowcharts",
  {
    /** Primary key */
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),

    /** User who created this flowchart */
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Identity
    /** Display title for the flowchart */
    title: text("title").notNull(),

    /** Short description of what this flowchart teaches */
    description: text("description"),

    /** Emoji icon for the flowchart */
    emoji: text("emoji").default("📊"),

    /** Difficulty level */
    difficulty: text("difficulty", {
      enum: ["Beginner", "Intermediate", "Advanced"],
    }),

    // Content
    /** FlowchartDefinition as JSON string */
    definitionJson: text("definition_json").notNull(),

    /** Mermaid content for visualization */
    mermaidContent: text("mermaid_content").notNull(),

    // Versioning
    /** Version number, increments on each edit of a published flowchart */
    version: integer("version").notNull().default(1),

    /** If this is a new version, reference to the previous version */
    parentVersionId: text("parent_version_id"),

    // State
    /** Current status: draft, published, or archived */
    status: text("status", { enum: ["draft", "published", "archived"] })
      .notNull()
      .default("draft"),

    /** When this flowchart was published (null if draft) */
    publishedAt: integer("published_at", { mode: "timestamp" }),

    // Search
    /** Space-separated keywords for search */
    searchKeywords: text("search_keywords"),

    // Embeddings
    /** Semantic embedding vector for full content (title + description + topic) */
    embedding: blob("embedding", { mode: "buffer" }),

    /** Semantic embedding vector for just the original prompt/topic description */
    promptEmbedding: blob("prompt_embedding", { mode: "buffer" }),

    /** Version of the embedding model used (for recomputation when model changes) */
    embeddingVersion: text("embedding_version"),

    // Timestamps
    /** When this flowchart was created */
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),

    /** When this flowchart was last updated */
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    /** Index for finding flowcharts by user */
    userIdx: index("teacher_flowcharts_user_idx").on(table.userId),
    /** Index for browsing published flowcharts */
    statusIdx: index("teacher_flowcharts_status_idx").on(table.status),
    /** Index for finding versions of a flowchart */
    parentVersionIdx: index("teacher_flowcharts_parent_version_idx").on(
      table.parentVersionId,
    ),
  }),
);

export type TeacherFlowchart = typeof teacherFlowcharts.$inferSelect;
export type NewTeacherFlowchart = typeof teacherFlowcharts.$inferInsert;

/**
 * Workshop Sessions table - Tracks flowchart creation/editing sessions
 *
 * A workshop session represents an ongoing flowchart creation or editing process.
 * It stores intermediate state like topic description, refinement history, and draft content.
 */
export const workshopSessions = sqliteTable(
  "workshop_sessions",
  {
    /** Primary key */
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),

    /** User who owns this session */
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // What we're working on
    /** If editing an existing flowchart, reference to it */
    flowchartId: text("flowchart_id").references(() => teacherFlowcharts.id, {
      onDelete: "set null",
    }),

    /** If remixing from an existing flowchart (can be hardcoded ID or teacher flowchart ID) */
    remixFromId: text("remix_from_id"),

    /** If editing a published flowchart, the ID to update on publish (instead of creating new) */
    linkedPublishedId: text("linked_published_id").references(
      () => teacherFlowcharts.id,
      {
        onDelete: "set null",
      },
    ),

    // Workshop state
    /** Current state of the workshop */
    state: text("state", {
      enum: ["initial", "generating", "refining", "testing", "completed"],
    })
      .notNull()
      .default("initial"),

    // Context accumulated from conversation
    /** Teacher's description of what they want to teach */
    topicDescription: text("topic_description"),

    /** JSON array of refinement requests made during the session */
    refinementHistory: text("refinement_history"),

    // Current draft (before saving to teacherFlowcharts)
    /** Draft FlowchartDefinition as JSON string */
    draftDefinitionJson: text("draft_definition_json"),

    /** Draft Mermaid content */
    draftMermaidContent: text("draft_mermaid_content"),

    /** Draft title */
    draftTitle: text("draft_title"),

    /** Draft description */
    draftDescription: text("draft_description"),

    /** Draft difficulty level */
    draftDifficulty: text("draft_difficulty", {
      enum: ["Beginner", "Intermediate", "Advanced"],
    }),

    /** Draft emoji */
    draftEmoji: text("draft_emoji"),

    /** Notes/warnings from the LLM about the current draft */
    draftNotes: text("draft_notes"),

    /** Current reasoning text being streamed from the LLM (for reconnection) */
    currentReasoningText: text("current_reasoning_text"),

    /** Current version number for version history tracking */
    currentVersionNumber: integer("current_version_number").default(0),

    // Timestamps
    /** When this session was created */
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),

    /** When this session was last updated */
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),

    /** When this session expires (7 days by default) */
    expiresAt: integer("expires_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => {
        const expires = new Date();
        expires.setDate(expires.getDate() + 7);
        return expires;
      }),
  },
  (table) => ({
    /** Index for finding sessions by user */
    userIdx: index("workshop_sessions_user_idx").on(table.userId),
    /** Index for finding active sessions */
    stateIdx: index("workshop_sessions_state_idx").on(table.state),
    /** Index for cleanup of expired sessions */
    expiresIdx: index("workshop_sessions_expires_idx").on(table.expiresAt),
  }),
);

export type WorkshopSession = typeof workshopSessions.$inferSelect;
export type NewWorkshopSession = typeof workshopSessions.$inferInsert;

/**
 * Flowchart Version History table - Tracks version snapshots during workshop sessions
 *
 * Every time the LLM successfully generates or refines a flowchart, a snapshot
 * is saved here. Users can view history and restore previous versions.
 */
export const flowchartVersionHistory = sqliteTable(
  "flowchart_version_history",
  {
    /** Primary key */
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),

    /** The workshop session this version belongs to */
    sessionId: text("session_id")
      .notNull()
      .references(() => workshopSessions.id, { onDelete: "cascade" }),

    /** Sequential version number within the session */
    versionNumber: integer("version_number").notNull(),

    // Full snapshot of draft state
    /** FlowchartDefinition as JSON string */
    definitionJson: text("definition_json").notNull(),

    /** Mermaid content for visualization */
    mermaidContent: text("mermaid_content").notNull(),

    /** Title at this version */
    title: text("title"),

    /** Description at this version */
    description: text("description"),

    /** Emoji at this version */
    emoji: text("emoji"),

    /** Difficulty level at this version */
    difficulty: text("difficulty"),

    /** Notes/warnings from the LLM at this version */
    notes: text("notes"),

    // What created this version
    /** How this version was created */
    source: text("source", { enum: ["generate", "refine"] }).notNull(),

    /** The request that created this version (topic description or refinement text) */
    sourceRequest: text("source_request"),

    // Validation state at save time
    /** Whether validation passed when this version was saved */
    validationPassed: integer("validation_passed", { mode: "boolean" }),

    /** Coverage percent when this version was saved */
    coveragePercent: integer("coverage_percent"),

    // Timestamps
    /** When this version was created */
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    /** Index for finding versions by session */
    sessionIdx: index("fvh_session_idx").on(table.sessionId),
    /** Index for finding specific version within session */
    versionIdx: index("fvh_version_idx").on(
      table.sessionId,
      table.versionNumber,
    ),
  }),
);

export type FlowchartVersionHistory =
  typeof flowchartVersionHistory.$inferSelect;
export type NewFlowchartVersionHistory =
  typeof flowchartVersionHistory.$inferInsert;
