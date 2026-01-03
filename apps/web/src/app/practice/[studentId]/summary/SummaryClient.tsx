"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageWithNav } from "@/components/PageWithNav";
import {
  AllProblemsSection,
  ContentBannerSlot,
  OfflineWorkSection,
  type OfflineAttachment,
  PhotoViewerEditor,
  type PhotoViewerEditorPhoto,
  PracticeSubNav,
  ProblemsToReviewPanel,
  ProjectingBanner,
  ScrollspyNav,
  type ScrollspySection,
  SessionHero,
  SkillsPanel,
  StartPracticeModal,
} from "@/components/practice";
import type { ProblemCorrection } from "@/components/worksheet-parsing";
import type { ParsingStatus } from "@/db/schema/practice-attachments";
import { calculateAutoPauseInfo } from "@/components/practice/autoPauseCalculator";
import { DocumentAdjuster } from "@/components/practice/DocumentAdjuster";
import { useDocumentDetection } from "@/components/practice/useDocumentDetection";
import {
  filterProblemsNeedingAttention,
  getProblemsWithContext,
} from "@/components/practice/sessionSummaryUtils";
import { Z_INDEX } from "@/constants/zIndex";
import {
  SessionModeBannerProvider,
  useSessionModeBanner,
} from "@/contexts/SessionModeBannerContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/components/common/ToastContext";
import { VisualDebugProvider } from "@/contexts/VisualDebugContext";
import type { Player } from "@/db/schema/players";
import type { SessionPlan, SlotResult } from "@/db/schema/session-plans";
import { useSessionMode } from "@/hooks/useSessionMode";
import { usePlayerAccess, canUploadPhotos } from "@/hooks/usePlayerAccess";
import {
  useStartParsing,
  useApproveAndCreateSession,
  useSubmitCorrections,
  useReparseSelected,
  useCancelParsing,
} from "@/hooks/useWorksheetParsing";
import { PARSING_MODEL_CONFIGS } from "@/lib/worksheet-parsing";
import {
  computeBktFromHistory,
  type SkillBktResult,
} from "@/lib/curriculum/bkt";
import type { ProblemResultWithContext } from "@/lib/curriculum/session-planner";
import { api } from "@/lib/queryClient";
import { attachmentKeys } from "@/lib/queryKeys";
import { css } from "../../../../../styled-system/css";

// Combined height of sticky elements above content area
// Main nav (80px) + Sub-nav (~56px with padding)
const STICKY_HEADER_OFFSET = 136;

// ============================================================================
// Helper Component for Banner Action Registration
// ============================================================================

/**
 * Registers the action callback with the banner context.
 * Must be inside SessionModeBannerProvider to access context.
 */
function BannerActionRegistrar({ onAction }: { onAction: () => void }) {
  const { setOnAction } = useSessionModeBanner();

  useEffect(() => {
    setOnAction(onAction);
  }, [onAction, setOnAction]);

  return null;
}

interface SummaryClientProps {
  studentId: string;
  player: Player;
  session: SessionPlan | null;
  /** Average seconds per problem from recent sessions */
  avgSecondsPerProblem?: number;
  /** Problem history for BKT computation in weak skills targeting */
  problemHistory?: ProblemResultWithContext[];
  /** Whether we just transitioned from active practice to this summary */
  justCompleted?: boolean;
  /** Previous session accuracy (0-1) for trend comparison */
  previousAccuracy?: number | null;
}

/**
 * Summary Client Component
 *
 * Displays the session results and provides navigation options.
 * Handles three cases:
 * - In-progress session: shows partial results
 * - Completed session: shows full results
 * - No session: shows empty state
 */
export function SummaryClient({
  studentId,
  player,
  session,
  avgSecondsPerProblem = 40,
  problemHistory,
  justCompleted = false,
  previousAccuracy = null,
}: SummaryClientProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const { showSuccess, showError } = useToast();
  const router = useRouter();

  const [showStartPracticeModal, setShowStartPracticeModal] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Unified photo viewer/editor state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerMode, setViewerMode] = useState<"view" | "edit">("view");

  // File upload adjustment state (for processing files through DocumentAdjuster)
  const [fileQueue, setFileQueue] = useState<File[]>([]);
  const [uploadAdjustmentState, setUploadAdjustmentState] = useState<{
    originalFile: File;
    sourceCanvas: HTMLCanvasElement;
    corners: Array<{ x: number; y: number }>;
  } | null>(null);

  // Document detection hook for file uploads and gallery edits
  const {
    isReady: isDetectionReady,
    detectQuadsInImage,
    loadImageToCanvas,
    cv: opencvRef,
  } = useDocumentDetection();

  // Session mode - single source of truth for session planning decisions
  const { data: sessionMode, isLoading: isLoadingSessionMode } =
    useSessionMode(studentId);

  // Player access - pre-flight authorization check for upload capability
  const { data: playerAccess } = usePlayerAccess(studentId);
  const canUpload = canUploadPhotos(playerAccess);

  const queryClient = useQueryClient();

  // Type for session attachment from API
  interface SessionAttachmentResponse {
    id: string;
    url: string;
    originalUrl: string | null;
    corners: Array<{ x: number; y: number }> | null;
    rotation: 0 | 90 | 180 | 270;
    // Parsing fields
    parsingStatus: string | null;
    parsedAt: string | null;
    parsingError: string | null;
    rawParsingResult: object | null;
    approvedResult: object | null;
    confidenceScore: number | null;
    needsReview: boolean;
    sessionCreated: boolean;
    createdSessionId: string | null;
    // LLM metadata
    llm: {
      provider: string | null;
      model: string | null;
      promptUsed: string | null;
      rawResponse: string | null;
      jsonSchema: string | null;
      imageSource: string | null;
      attempts: number | null;
      usage: {
        promptTokens: number | null;
        completionTokens: number | null;
        totalTokens: number | null;
      };
    } | null;
  }

  // Fetch attachments for this session (includes parsing data)
  const { data: attachmentsData } = useQuery({
    queryKey: session?.id
      ? attachmentKeys.session(studentId, session.id)
      : ["no-session"],
    queryFn: async (): Promise<{
      attachments: SessionAttachmentResponse[];
    }> => {
      if (!session?.id) return { attachments: [] };
      const res = await api(
        `curriculum/${studentId}/sessions/${session.id}/attachments`,
      );
      if (!res.ok) return { attachments: [] };
      return res.json() as Promise<{
        attachments: SessionAttachmentResponse[];
      }>;
    },
    enabled: !!session?.id,
  });

  // Map API response to OfflineAttachment type (cast parsingStatus and rawParsingResult)
  const attachments: OfflineAttachment[] = (
    attachmentsData?.attachments ?? []
  ).map((att) => ({
    id: att.id,
    url: att.url,
    parsingStatus: att.parsingStatus as ParsingStatus | null,
    rawParsingResult:
      att.rawParsingResult as OfflineAttachment["rawParsingResult"],
    needsReview: att.needsReview,
    sessionCreated: att.sessionCreated,
  }));

  // Worksheet parsing mutations
  const startParsing = useStartParsing(studentId, session?.id ?? "");
  const cancelParsing = useCancelParsing(studentId, session?.id ?? "");

  // Approve and create session mutation
  const approveAndCreateSession = useApproveAndCreateSession(
    studentId,
    session?.id ?? "",
  );

  // Submit corrections mutation
  const submitCorrections = useSubmitCorrections(studentId, session?.id ?? "");

  // Re-parse selected problems mutation
  const reparseSelected = useReparseSelected(studentId, session?.id ?? "");

  // Map attachments to PhotoViewerEditorPhoto type for the viewer
  const viewerPhotos: PhotoViewerEditorPhoto[] = (
    attachmentsData?.attachments ?? []
  ).map(
    (att): PhotoViewerEditorPhoto => ({
      id: att.id,
      url: att.url,
      originalUrl: att.originalUrl,
      corners: att.corners,
      rotation: att.rotation,
      parsingStatus:
        att.parsingStatus as PhotoViewerEditorPhoto["parsingStatus"],
      // Prefer approvedResult (user-corrected) over rawParsingResult (original LLM output)
      problemCount: (
        (att.approvedResult ?? att.rawParsingResult) as {
          problems?: unknown[];
        } | null
      )?.problems?.length,
      sessionCreated: att.sessionCreated,
      rawParsingResult:
        (att.approvedResult ?? att.rawParsingResult)
          ? ((att.approvedResult ?? att.rawParsingResult) as NonNullable<
              PhotoViewerEditorPhoto["rawParsingResult"]
            >)
          : null,
      llm: att.llm as PhotoViewerEditorPhoto["llm"],
    }),
  );

  const hasPhotos = attachments.length > 0;

  const isInProgress = session?.startedAt && !session?.completedAt;

  // Check if session has actual problems (not just photos)
  const sessionResults = (session?.results ?? []) as SlotResult[];
  const hasProblems = sessionResults.length > 0;

  // Compute BKT from problem history to get skill masteries
  const skillMasteries = useMemo<Record<string, SkillBktResult>>(() => {
    if (!problemHistory || problemHistory.length === 0) {
      return {};
    }
    const bktResult = computeBktFromHistory(problemHistory);
    // Convert array to record for easy lookup
    return Object.fromEntries(
      bktResult.skills.map((skill) => [skill.skillId, skill]),
    );
  }, [problemHistory]);

  // Calculate auto-pause info for determining slow problems
  const autoPauseInfo = useMemo(() => {
    if (!hasProblems)
      return {
        threshold: 0,
        stats: { sampleCount: 0, meanMs: 0, stdDevMs: 0 },
      };
    return calculateAutoPauseInfo(sessionResults);
  }, [hasProblems, sessionResults]);

  // Get problems that need attention (incorrect, slow, or used heavy help)
  const problemsNeedingAttention = useMemo(() => {
    if (!session || !hasProblems) return [];
    const problemsWithContext = getProblemsWithContext(session);
    return filterProblemsNeedingAttention(
      problemsWithContext,
      autoPauseInfo.threshold,
    );
  }, [session, hasProblems, autoPauseInfo.threshold]);

  // Define scrollspy sections to match plan: Overview | Skills | Review | Evidence
  const scrollspySections = useMemo<ScrollspySection[]>(() => {
    const sections: ScrollspySection[] = [];
    if (hasProblems) {
      sections.push({ id: "overview", label: "Overview" });
      sections.push({ id: "skills", label: "Skills" });
      sections.push({ id: "review", label: "Review" });
    }
    sections.push({ id: "evidence", label: "Evidence" });
    return sections;
  }, [hasProblems]);

  // Upload photos with optional original preservation and corners
  const uploadPhotos = useCallback(
    async (
      photos: File[],
      originals?: File[],
      cornersData?: Array<Array<{ x: number; y: number }> | null>,
      rotationData?: Array<0 | 90 | 180 | 270>,
    ) => {
      if (!session?.id || photos.length === 0) return;

      setIsUploading(true);
      setUploadError(null);

      try {
        const formData = new FormData();
        for (const file of photos) {
          formData.append("photos", file);
        }
        // Add original files if provided (for cropped uploads)
        if (originals) {
          for (const file of originals) {
            formData.append("originals", file);
          }
        }
        // Add corners data if provided (for restoring crop positions later)
        if (cornersData) {
          for (const corners of cornersData) {
            formData.append("corners", corners ? JSON.stringify(corners) : "");
          }
        }
        // Add rotation data if provided
        if (rotationData) {
          for (const rotation of rotationData) {
            formData.append("rotation", rotation.toString());
          }
        }

        const response = await fetch(
          `/api/curriculum/${studentId}/sessions/${session.id}/attachments`,
          { method: "POST", body: formData },
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to upload photos");
        }

        // Refresh attachments
        queryClient.invalidateQueries({
          queryKey: attachmentKeys.session(studentId, session.id),
        });
      } catch (err) {
        setUploadError(
          err instanceof Error ? err.message : "Failed to upload photos",
        );
      } finally {
        setIsUploading(false);
      }
    },
    [studentId, session?.id, queryClient],
  );

  // Process next file in queue - load, detect quads, show adjuster
  const processNextFile = useCallback(async () => {
    if (fileQueue.length === 0) {
      setUploadAdjustmentState(null);
      return;
    }

    const nextFile = fileQueue[0];

    // Load file to canvas
    const canvas = await loadImageToCanvas(nextFile);
    if (!canvas) {
      console.warn("Failed to load image:", nextFile.name);
      // Skip this file and process next
      setFileQueue((prev) => prev.slice(1));
      return;
    }

    // Detect quads (or get fallback corners)
    const result = detectQuadsInImage(canvas);

    // Show adjustment UI
    setUploadAdjustmentState({
      originalFile: nextFile,
      sourceCanvas: result.sourceCanvas,
      corners: result.corners,
    });
  }, [fileQueue, loadImageToCanvas, detectQuadsInImage]);

  // Start processing queue when files are added
  useEffect(() => {
    if (fileQueue.length > 0 && !uploadAdjustmentState && isDetectionReady) {
      processNextFile();
    }
  }, [fileQueue, uploadAdjustmentState, isDetectionReady, processNextFile]);

  // Handle adjustment confirm - upload cropped + original with corners and rotation, process next
  const handleUploadAdjustmentConfirm = useCallback(
    async (
      croppedFile: File,
      corners: Array<{ x: number; y: number }>,
      rotation: 0 | 90 | 180 | 270,
    ) => {
      if (!uploadAdjustmentState) return;

      // Upload both cropped and original, with corners and rotation for later re-editing
      await uploadPhotos(
        [croppedFile],
        [uploadAdjustmentState.originalFile],
        [corners],
        [rotation],
      );

      // Remove from queue and process next
      setFileQueue((prev) => prev.slice(1));
      setUploadAdjustmentState(null);
    },
    [uploadAdjustmentState, uploadPhotos],
  );

  // Handle adjustment skip - upload original only, process next
  const handleUploadAdjustmentSkip = useCallback(async () => {
    if (!uploadAdjustmentState) return;

    // Upload original only (no crop)
    await uploadPhotos([uploadAdjustmentState.originalFile]);

    // Remove from queue and process next
    setFileQueue((prev) => prev.slice(1));
    setUploadAdjustmentState(null);
  }, [uploadAdjustmentState, uploadPhotos]);

  // Handle adjustment cancel - clear queue
  const handleUploadAdjustmentCancel = useCallback(() => {
    setFileQueue([]);
    setUploadAdjustmentState(null);
  }, []);

  // Handle photo edit confirm from PhotoViewerEditor
  const handlePhotoEditConfirm = useCallback(
    async (
      photoId: string,
      croppedFile: File,
      corners: Array<{ x: number; y: number }>,
      rotation: 0 | 90 | 180 | 270,
    ) => {
      try {
        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", croppedFile);
        formData.append("corners", JSON.stringify(corners));
        formData.append("rotation", rotation.toString());

        const response = await fetch(
          `/api/curriculum/${studentId}/attachments/${photoId}`,
          {
            method: "PATCH",
            body: formData,
          },
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to update photo");
        }

        // Refresh attachments
        if (session?.id) {
          queryClient.invalidateQueries({
            queryKey: attachmentKeys.session(studentId, session.id),
          });
        }
      } catch (err) {
        setUploadError(
          err instanceof Error ? err.message : "Failed to update photo",
        );
      } finally {
        setIsUploading(false);
      }
    },
    [studentId, session?.id, queryClient],
  );

  // Handle file selection - queue files for adjustment
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      const imageFiles = files.filter((f) => f.type.startsWith("image/"));
      if (imageFiles.length > 0) {
        setFileQueue((prev) => [...prev, ...imageFiles]);
      }
      e.target.value = "";
    },
    [],
  );

  // Handle drag and drop - queue files for adjustment
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length > 0) {
      setFileQueue((prev) => [...prev, ...imageFiles]);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  // Handle camera capture - receives cropped file, original file, corners, and rotation
  const handleCameraCapture = useCallback(
    (
      croppedFile: File,
      originalFile: File,
      corners: Array<{ x: number; y: number }>,
      rotation: 0 | 90 | 180 | 270,
    ) => {
      setShowCamera(false);
      uploadPhotos([croppedFile], [originalFile], [corners], [rotation]);
    },
    [uploadPhotos],
  );

  // Handle photo deletion
  const deletePhoto = useCallback(
    async (attachmentId: string) => {
      if (!session?.id) return;

      setDeletingId(attachmentId);
      try {
        const response = await fetch(
          `/api/curriculum/${studentId}/attachments/${attachmentId}`,
          {
            method: "DELETE",
          },
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to delete photo");
        }

        // Refresh attachments
        queryClient.invalidateQueries({
          queryKey: attachmentKeys.session(studentId, session.id),
        });
      } catch (err) {
        setUploadError(
          err instanceof Error ? err.message : "Failed to delete photo",
        );
      } finally {
        setDeletingId(null);
      }
    },
    [studentId, session?.id, queryClient],
  );

  // Open photo viewer at specific photo with optional mode
  const openViewer = useCallback((index: number, mode: "view" | "edit") => {
    setViewerIndex(index);
    setViewerMode(mode);
    setViewerOpen(true);
  }, []);

  // Handle practice again - show the start practice modal
  const handlePracticeAgain = useCallback(() => {
    setShowStartPracticeModal(true);
  }, []);

  // Determine header text based on session state
  // Only shown for photo-only sessions and no-session state
  // (SessionSummary handles its own header for sessions with problems)
  const headerTitle = isInProgress
    ? "Session In Progress"
    : session
      ? "Practice Session"
      : "No Sessions Yet";

  const headerSubtitle = isInProgress
    ? `${player.name} is currently practicing`
    : session
      ? hasPhotos
        ? "Photos from practice"
        : "Add photos from practice"
      : `${player.name} hasn't completed any sessions yet`;

  return (
    <SessionModeBannerProvider
      sessionMode={sessionMode ?? null}
      isLoading={isLoadingSessionMode}
    >
      <BannerActionRegistrar onAction={handlePracticeAgain} />
      {/* Single ProjectingBanner renders at provider level */}
      <ProjectingBanner />
      <PageWithNav>
        {/* Practice Sub-Navigation */}
        <PracticeSubNav student={player} pageContext="summary" />

        <main
          data-component="practice-summary-page"
          className={css({
            minHeight: "100vh",
            backgroundColor: isDark ? "gray.900" : "gray.50",
            paddingTop: "2rem",
            paddingLeft: "2rem",
            paddingRight: "2rem",
            paddingBottom: "2rem",
          })}
        >
          <div
            className={css({
              maxWidth: "1400px",
              margin: "0 auto",
            })}
          >
            {/* Header - only show when SessionSummary won't (photo-only or no session) */}
            {!hasProblems && (
              <header
                className={css({
                  textAlign: "center",
                  marginBottom: "2rem",
                })}
              >
                <h1
                  className={css({
                    fontSize: "1.5rem",
                    fontWeight: "bold",
                    color: isDark ? "white" : "gray.800",
                    marginBottom: "0.5rem",
                  })}
                >
                  {headerTitle}
                </h1>
                <p
                  className={css({
                    fontSize: "0.875rem",
                    color: isDark ? "gray.400" : "gray.600",
                  })}
                >
                  {headerSubtitle}
                </p>
              </header>
            )}

            {/* Session mode banner - renders in-flow, projects to nav on scroll */}
            <ContentBannerSlot
              stickyOffset={STICKY_HEADER_OFFSET}
              className={css({ marginBottom: "1.5rem" })}
            />

            {/* Mobile scrollspy navigation */}
            {session && scrollspySections.length > 1 && (
              <ScrollspyNav
                sections={scrollspySections}
                topOffset={STICKY_HEADER_OFFSET + 60}
                isDark={isDark}
              />
            )}

            {/* Session Summary or Empty State */}
            {session ? (
              <>
                {/* Responsive two-column layout for desktop
                    Plan: Left (~45%) = Hero + Evidence, Right (~55%) = Skills + Review */}
                <div
                  data-layout="summary-grid"
                  className={css({
                    display: "grid",
                    gap: "1.5rem",
                    // Mobile: single column
                    gridTemplateColumns: "1fr",
                    // Desktop (1200px+): two columns per plan spec
                    "@media (min-width: 1200px)": {
                      gridTemplateColumns: hasProblems ? "45% 55%" : "1fr",
                      gap: "2rem",
                      alignItems: "start",
                    },
                  })}
                >
                  {/* Left column: Hero + Evidence (Photos + All Problems) */}
                  <div
                    data-column="hero-evidence"
                    className={css({
                      display: "flex",
                      flexDirection: "column",
                      gap: "1.5rem",
                      // On mobile, this appears first
                      order: 1,
                    })}
                  >
                    {/* Session Hero - celebration header, stats, trend */}
                    {hasProblems && (
                      <div data-scrollspy-section="overview">
                        <SessionHero
                          plan={session}
                          studentName={player.name}
                          justCompleted={justCompleted}
                          previousAccuracy={previousAccuracy ?? null}
                          isDark={isDark}
                        />
                      </div>
                    )}

                    {/* Evidence section: Photos + All Problems */}
                    <div data-scrollspy-section="evidence">
                      <OfflineWorkSection
                        attachments={attachments}
                        fileInputRef={fileInputRef}
                        isUploading={isUploading}
                        uploadError={uploadError}
                        deletingId={deletingId}
                        parsingId={
                          startParsing.isPending
                            ? typeof startParsing.variables === "string"
                              ? startParsing.variables
                              : ((
                                  startParsing.variables as
                                    | { attachmentId: string }
                                    | undefined
                                )?.attachmentId ?? null)
                            : null
                        }
                        dragOver={dragOver}
                        isDark={isDark}
                        canUpload={canUpload}
                        studentId={studentId}
                        studentName={player.name}
                        classroomId={playerAccess?.classroomId}
                        onFileSelect={handleFileSelect}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onOpenCamera={() => setShowCamera(true)}
                        onOpenViewer={openViewer}
                        onDeletePhoto={deletePhoto}
                        onParse={(attachmentId) =>
                          startParsing.mutate({ attachmentId })
                        }
                        onCancelParsing={(attachmentId) =>
                          cancelParsing.mutate(attachmentId)
                        }
                      />
                      {/* All Problems - complete session listing */}
                      {hasProblems && (
                        <div className={css({ marginTop: "1.5rem" })}>
                          <AllProblemsSection plan={session} isDark={isDark} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right column: Skills + Review */}
                  {hasProblems && (
                    <div
                      data-column="skills-review"
                      className={css({
                        display: "flex",
                        flexDirection: "column",
                        gap: "1.5rem",
                        // On mobile, this appears second
                        order: 2,
                        "@media (min-width: 1200px)": {
                          position: "sticky",
                          top: "160px", // Below nav
                        },
                      })}
                    >
                      {/* Skills Panel */}
                      <div data-scrollspy-section="skills">
                        <SkillsPanel results={sessionResults} isDark={isDark} />
                      </div>

                      {/* Problems to Review */}
                      <div data-scrollspy-section="review">
                        <ProblemsToReviewPanel
                          problems={problemsNeedingAttention}
                          results={sessionResults}
                          skillMasteries={skillMasteries}
                          totalProblems={sessionResults.length}
                          isDark={isDark}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div
                className={css({
                  padding: "3rem",
                  textAlign: "center",
                  backgroundColor: isDark ? "gray.800" : "white",
                  borderRadius: "16px",
                  border: "1px solid",
                  borderColor: isDark ? "gray.700" : "gray.200",
                })}
              >
                <p
                  className={css({
                    fontSize: "1.125rem",
                    color: isDark ? "gray.400" : "gray.600",
                  })}
                >
                  Start a practice session to see results here.
                </p>
              </div>
            )}
          </div>
        </main>

        {/* Start Practice Modal */}
        {showStartPracticeModal && sessionMode && (
          <StartPracticeModal
            studentId={studentId}
            studentName={player.name}
            focusDescription={sessionMode.focusDescription}
            sessionMode={sessionMode}
            avgSecondsPerProblem={avgSecondsPerProblem}
            existingPlan={null}
            problemHistory={problemHistory}
            onClose={() => setShowStartPracticeModal(false)}
            onStarted={() => setShowStartPracticeModal(false)}
          />
        )}

        {/* Photo Viewer/Editor */}
        <PhotoViewerEditor
          photos={viewerPhotos}
          initialIndex={viewerIndex}
          initialMode={viewerMode}
          isOpen={viewerOpen}
          onClose={() => setViewerOpen(false)}
          onEditConfirm={handlePhotoEditConfirm}
          onParse={(
            attachmentId,
            modelConfigId,
            additionalContext,
            preservedBoundingBoxes,
          ) =>
            startParsing.mutate({
              attachmentId,
              modelConfigId,
              additionalContext,
              preservedBoundingBoxes,
            })
          }
          parsingPhotoId={
            startParsing.isPending
              ? ((typeof startParsing.variables === "string"
                  ? startParsing.variables
                  : (startParsing.variables as { attachmentId: string })
                      ?.attachmentId) ?? null)
              : null
          }
          modelConfigs={PARSING_MODEL_CONFIGS}
          onApprove={async (attachmentId) => {
            try {
              const result =
                await approveAndCreateSession.mutateAsync(attachmentId);
              showSuccess(
                "Session Updated",
                `${result.problemCount} problem${result.problemCount === 1 ? "" : "s"} added to session`,
              );
              // Close the viewer and refresh the page to show updated session data
              setViewerOpen(false);
              router.refresh();
            } catch (error) {
              showError(
                "Failed to create session",
                error instanceof Error ? error.message : "Please try again",
              );
            }
          }}
          approvingPhotoId={
            approveAndCreateSession.isPending
              ? ((approveAndCreateSession.variables as string) ?? null)
              : null
          }
          onSubmitCorrection={async (attachmentId, correction) => {
            await submitCorrections.mutateAsync({
              attachmentId,
              corrections: [correction],
            });
          }}
          savingProblemNumber={
            submitCorrections.isPending
              ? ((
                  submitCorrections.variables as {
                    attachmentId: string;
                    corrections: ProblemCorrection[];
                  }
                )?.corrections?.[0]?.problemNumber ?? null)
              : null
          }
          onReparseSelected={async (
            attachmentId,
            problemIndices,
            boundingBoxes,
            additionalContext,
          ) => {
            await reparseSelected.mutateAsync({
              attachmentId,
              problemIndices,
              boundingBoxes,
              additionalContext,
            });
          }}
          isReparsingSelected={reparseSelected.isPending}
        />

        {/* Fullscreen Camera Modal */}
        <Dialog.Root open={showCamera} onOpenChange={setShowCamera}>
          <Dialog.Portal>
            <Dialog.Overlay
              className={css({
                position: "fixed",
                inset: 0,
                bg: "black",
                zIndex: Z_INDEX.MODAL,
              })}
            />
            <Dialog.Content
              className={css({
                position: "fixed",
                inset: 0,
                zIndex: Z_INDEX.MODAL + 1,
                outline: "none",
              })}
            >
              <VisualDebugProvider>
                <Dialog.Title className={css({ srOnly: true })}>
                  Take Photo
                </Dialog.Title>
                <Dialog.Description className={css({ srOnly: true })}>
                  Camera viewfinder. Tap capture to take a photo.
                </Dialog.Description>
                <FullscreenCamera
                  onCapture={handleCameraCapture}
                  onClose={() => setShowCamera(false)}
                />
              </VisualDebugProvider>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {/* File Upload Adjustment Modal */}
        {uploadAdjustmentState && opencvRef && (
          <Dialog.Root
            open={true}
            onOpenChange={() => handleUploadAdjustmentCancel()}
          >
            <Dialog.Portal>
              <Dialog.Overlay
                className={css({
                  position: "fixed",
                  inset: 0,
                  bg: "black",
                  zIndex: Z_INDEX.MODAL,
                })}
              />
              <Dialog.Content
                className={css({
                  position: "fixed",
                  inset: 0,
                  zIndex: Z_INDEX.MODAL + 1,
                  outline: "none",
                })}
              >
                <Dialog.Title className={css({ srOnly: true })}>
                  Adjust Photo{" "}
                  {fileQueue.length > 0 ? `(1 of ${fileQueue.length + 1})` : ""}
                </Dialog.Title>
                <Dialog.Description className={css({ srOnly: true })}>
                  Drag corners to crop the document. Tap Done to confirm or Skip
                  to use original.
                </Dialog.Description>
                <DocumentAdjuster
                  sourceCanvas={uploadAdjustmentState.sourceCanvas}
                  initialCorners={uploadAdjustmentState.corners}
                  onConfirm={handleUploadAdjustmentConfirm}
                  onCancel={handleUploadAdjustmentCancel}
                  onSkip={handleUploadAdjustmentSkip}
                  cv={opencvRef}
                  detectQuadsInImage={detectQuadsInImage}
                />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        )}
      </PageWithNav>
    </SessionModeBannerProvider>
  );
}

// =============================================================================
// Fullscreen Camera Component
// =============================================================================

interface FullscreenCameraProps {
  /** Called with cropped file, original file, corners, and rotation for later re-editing */
  onCapture: (
    croppedFile: File,
    originalFile: File,
    corners: Array<{ x: number; y: number }>,
    rotation: 0 | 90 | 180 | 270,
  ) => void;
  onClose: () => void;
}

function FullscreenCamera({ onCapture, onClose }: FullscreenCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastDetectionRef = useRef<number>(0);
  const autoCaptureTriggeredRef = useRef(false);

  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [documentDetected, setDocumentDetected] = useState(false);

  // Adjustment mode state
  const [adjustmentMode, setAdjustmentMode] = useState<{
    sourceCanvas: HTMLCanvasElement;
    corners: Array<{ x: number; y: number }>;
  } | null>(null);

  // Document detection hook (lazy loads OpenCV.js)
  const {
    isLoading: isScannerLoading,
    isReady: isScannerReady,
    isStable: isDetectionStable,
    isLocked: isDetectionLocked,
    debugInfo: scannerDebugInfo,
    cv: opencvRef,
    getBestQuadCorners,
    captureSourceFrame,
    highlightDocument,
    extractDocument,
    detectQuadsInImage: detectQuadsInCamera,
  } = useDocumentDetection();

  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          if (!cancelled) {
            setIsReady(true);
          }
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Camera access error:", err);
        setError(
          "Camera access denied. Please allow camera access and try again.",
        );
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Detection loop - runs when camera and scanner are ready
  useEffect(() => {
    if (!isReady || !isScannerReady) return;

    const video = videoRef.current;
    const overlay = overlayCanvasRef.current;
    if (!video || !overlay) return;

    // Sync overlay canvas size with video
    const syncCanvasSize = () => {
      if (overlay && video) {
        overlay.width = video.clientWidth;
        overlay.height = video.clientHeight;
      }
    };
    syncCanvasSize();

    const detectLoop = () => {
      const now = Date.now();
      // Throttle detection to every 150ms for performance
      if (now - lastDetectionRef.current > 150) {
        if (video && overlay) {
          const detected = highlightDocument(video, overlay);
          setDocumentDetected(detected);
        }
        lastDetectionRef.current = now;
      }
      animationFrameRef.current = requestAnimationFrame(detectLoop);
    };

    // Start detection loop
    animationFrameRef.current = requestAnimationFrame(detectLoop);

    // Sync on resize
    window.addEventListener("resize", syncCanvasSize);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      window.removeEventListener("resize", syncCanvasSize);
    };
  }, [isReady, isScannerReady, highlightDocument]);

  // Enter adjustment mode with captured frame and detected corners
  // Always shows the adjustment UI - uses fallback corners if no quad detected
  const enterAdjustmentMode = useCallback(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const sourceCanvas = captureSourceFrame(video);
    const detectedCorners = getBestQuadCorners();

    if (!sourceCanvas) return;

    // Stop detection loop while adjusting
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Use detected corners if available, otherwise use full image bounds as fallback
    // This allows user to manually define crop area even when detection fails
    const corners = detectedCorners || [
      { x: 0, y: 0 },
      { x: sourceCanvas.width, y: 0 },
      { x: sourceCanvas.width, y: sourceCanvas.height },
      { x: 0, y: sourceCanvas.height },
    ];

    setAdjustmentMode({ sourceCanvas, corners });
  }, [captureSourceFrame, getBestQuadCorners]);

  // Quick capture without adjustment (fallback when no document detected)
  const captureWithoutAdjustment = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsCapturing(true);
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Capture full frame (no document extraction)
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error("Failed to create blob"));
          },
          "image/jpeg",
          0.9,
        );
      });

      const file = new File([blob], `photo-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });

      // No cropping applied, so cropped = original = same file
      // Corners are full image bounds (can be used for later cropping if desired)
      const fullImageCorners = [
        { x: 0, y: 0 },
        { x: canvas.width, y: 0 },
        { x: canvas.width, y: canvas.height },
        { x: 0, y: canvas.height },
      ];

      onCapture(file, file, fullImageCorners, 0);
    } catch (err) {
      console.error("Capture error:", err);
      setError("Failed to capture photo. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  };

  // Handle capture button - enters adjustment mode if document detected
  const capturePhoto = () => {
    if (isCapturing) return;
    setIsCapturing(true);
    enterAdjustmentMode();
    setIsCapturing(false);
  };

  // Auto-capture when detection is locked and stable
  useEffect(() => {
    if (
      isDetectionLocked &&
      isReady &&
      isScannerReady &&
      !isCapturing &&
      !adjustmentMode &&
      !autoCaptureTriggeredRef.current
    ) {
      // Add a small delay to ensure stability
      const timeout = setTimeout(() => {
        if (isDetectionLocked && !autoCaptureTriggeredRef.current) {
          autoCaptureTriggeredRef.current = true;
          console.log("Auto-capturing document...");
          enterAdjustmentMode();
        }
      }, 500); // 500ms delay after lock to ensure stability

      return () => clearTimeout(timeout);
    }
  }, [
    isDetectionLocked,
    isReady,
    isScannerReady,
    isCapturing,
    adjustmentMode,
    enterAdjustmentMode,
  ]);

  // Handle adjustment confirm - pass cropped file, original file, corners, and rotation for later re-editing
  const handleAdjustmentConfirm = useCallback(
    async (
      croppedFile: File,
      corners: Array<{ x: number; y: number }>,
      rotation: 0 | 90 | 180 | 270,
    ) => {
      if (!adjustmentMode) return;

      // Convert source canvas to file for original preservation
      const originalBlob = await new Promise<Blob>((resolve, reject) => {
        adjustmentMode.sourceCanvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error("Failed to create original blob"));
          },
          "image/jpeg",
          0.95,
        );
      });
      const originalFile = new File(
        [originalBlob],
        `original-${Date.now()}.jpg`,
        {
          type: "image/jpeg",
        },
      );

      setAdjustmentMode(null);
      onCapture(croppedFile, originalFile, corners, rotation);
    },
    [onCapture, adjustmentMode],
  );

  // Handle adjustment cancel - return to camera
  const handleAdjustmentCancel = useCallback(() => {
    setAdjustmentMode(null);
    autoCaptureTriggeredRef.current = false; // Allow auto-capture again
    // Restart detection loop
    if (videoRef.current && overlayCanvasRef.current && isScannerReady) {
      const detectLoop = () => {
        const now = Date.now();
        if (now - lastDetectionRef.current > 150) {
          if (videoRef.current && overlayCanvasRef.current) {
            const detected = highlightDocument(
              videoRef.current,
              overlayCanvasRef.current,
            );
            setDocumentDetected(detected);
          }
          lastDetectionRef.current = now;
        }
        animationFrameRef.current = requestAnimationFrame(detectLoop);
      };
      animationFrameRef.current = requestAnimationFrame(detectLoop);
    }
  }, [isScannerReady, highlightDocument]);

  // Show adjustment UI if in adjustment mode
  if (adjustmentMode && opencvRef) {
    return (
      <DocumentAdjuster
        sourceCanvas={adjustmentMode.sourceCanvas}
        initialCorners={adjustmentMode.corners}
        onConfirm={handleAdjustmentConfirm}
        onCancel={handleAdjustmentCancel}
        cv={opencvRef}
        detectQuadsInImage={detectQuadsInCamera}
      />
    );
  }

  return (
    <div
      data-component="fullscreen-camera"
      className={css({
        position: "absolute",
        inset: 0,
        bg: "black",
      })}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        className={css({
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        })}
      />

      {/* Overlay canvas for document detection visualization */}
      <canvas
        ref={overlayCanvasRef}
        className={css({
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        })}
      />

      <canvas ref={canvasRef} style={{ display: "none" }} />

      {!isReady && !error && (
        <div
          className={css({
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bg: "black",
          })}
        >
          <div className={css({ color: "white", fontSize: "xl" })}>
            Starting camera...
          </div>
        </div>
      )}

      {error && (
        <div
          className={css({
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            bg: "black",
            p: 6,
          })}
        >
          <div
            className={css({
              color: "red.400",
              fontSize: "lg",
              textAlign: "center",
              mb: 4,
            })}
          >
            {error}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={css({
              px: 6,
              py: 3,
              bg: "white",
              color: "black",
              borderRadius: "full",
              fontSize: "lg",
              fontWeight: "bold",
              cursor: "pointer",
            })}
          >
            Close
          </button>
        </div>
      )}

      {!error && (
        <>
          <button
            type="button"
            onClick={onClose}
            className={css({
              position: "absolute",
              top: 4,
              right: 4,
              width: "48px",
              height: "48px",
              bg: "rgba(0, 0, 0, 0.5)",
              color: "white",
              borderRadius: "full",
              fontSize: "2xl",
              fontWeight: "bold",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(4px)",
              _hover: { bg: "rgba(0, 0, 0, 0.7)" },
            })}
          >
            ×
          </button>

          {/* Debug overlay panel - always shown to help diagnose detection */}
          <div
            data-element="scanner-debug-panel"
            className={css({
              position: "absolute",
              top: 4,
              left: 4,
              p: 3,
              bg: "rgba(0, 0, 0, 0.8)",
              backdropFilter: "blur(4px)",
              borderRadius: "lg",
              color: "white",
              fontSize: "xs",
              fontFamily: "monospace",
              maxWidth: "280px",
              zIndex: 10,
            })}
          >
            <div
              className={css({
                fontWeight: "bold",
                mb: 2,
                color: "yellow.400",
              })}
            >
              Document Scanner Debug
            </div>
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: 1,
              })}
            >
              <div>
                Scanner:{" "}
                <span
                  className={css({
                    color: isScannerReady ? "green.400" : "orange.400",
                  })}
                >
                  {isScannerLoading
                    ? "Loading..."
                    : isScannerReady
                      ? "Ready"
                      : "Failed"}
                </span>
              </div>
              <div>
                Camera:{" "}
                <span
                  className={css({
                    color: isReady ? "green.400" : "orange.400",
                  })}
                >
                  {isReady ? "Ready" : "Starting..."}
                </span>
              </div>
              <div>
                Document:{" "}
                <span
                  className={css({
                    color: isDetectionLocked
                      ? "green.400"
                      : isDetectionStable
                        ? "green.300"
                        : documentDetected
                          ? "yellow.400"
                          : "gray.400",
                  })}
                >
                  {isDetectionLocked
                    ? "LOCKED"
                    : isDetectionStable
                      ? "Stable"
                      : documentDetected
                        ? "Unstable"
                        : "Not detected"}
                </span>
              </div>
              <div>
                Quads: {scannerDebugInfo.quadsDetected} detected,{" "}
                {scannerDebugInfo.trackedQuads} tracked
              </div>
              <div>
                Best: {scannerDebugInfo.bestQuadFrameCount} frames,{" "}
                {Math.round(scannerDebugInfo.bestQuadStability * 100)}% stable
              </div>
              {scannerDebugInfo.loadTimeMs !== null && (
                <div>Load time: {scannerDebugInfo.loadTimeMs}ms</div>
              )}
              {scannerDebugInfo.lastDetectionMs !== null && (
                <div>Detection: {scannerDebugInfo.lastDetectionMs}ms</div>
              )}
              {scannerDebugInfo.lastDetectionError && (
                <div
                  className={css({ color: "red.400", wordBreak: "break-word" })}
                >
                  Error: {scannerDebugInfo.lastDetectionError}
                </div>
              )}
            </div>
          </div>

          <div
            className={css({
              position: "absolute",
              bottom: 8,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
            })}
          >
            {/* Helper text for detection status */}
            <div
              data-element="detection-status"
              className={css({
                px: 4,
                py: 2,
                bg: "rgba(0, 0, 0, 0.6)",
                backdropFilter: "blur(4px)",
                borderRadius: "full",
                color: "white",
                fontSize: "sm",
                fontWeight: "medium",
                textAlign: "center",
                transition: "all 0.2s",
              })}
            >
              {isScannerLoading ? (
                "Loading scanner..."
              ) : isDetectionLocked ? (
                <span
                  className={css({ color: "green.400", fontWeight: "bold" })}
                >
                  ✓ Hold steady - Ready to capture!
                </span>
              ) : isDetectionStable ? (
                <span className={css({ color: "green.300" })}>
                  Document detected - Hold steady...
                </span>
              ) : documentDetected ? (
                <span className={css({ color: "yellow.400" })}>
                  Detecting... hold camera steady
                </span>
              ) : (
                "Point camera at document"
              )}
            </div>

            <button
              type="button"
              onClick={capturePhoto}
              disabled={isCapturing || !isReady}
              className={css({
                width: "80px",
                height: "80px",
                bg: "white",
                borderRadius: "full",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: isDetectionLocked
                  ? "0 4px 30px rgba(0, 255, 100, 0.5)"
                  : "0 4px 20px rgba(0, 0, 0, 0.3)",
                border: "4px solid",
                borderColor: isDetectionLocked
                  ? "green.400"
                  : isDetectionStable
                    ? "green.300"
                    : documentDetected
                      ? "yellow.400"
                      : "gray.300",
                transition: "all 0.15s",
                _hover: { transform: "scale(1.05)" },
                _active: { transform: "scale(0.95)" },
                _disabled: { opacity: 0.5, cursor: "not-allowed" },
              })}
            >
              {isCapturing ? (
                <div className={css({ fontSize: "sm", color: "gray.600" })}>
                  ...
                </div>
              ) : (
                <div
                  className={css({
                    width: "64px",
                    height: "64px",
                    bg: "white",
                    borderRadius: "full",
                    border: "2px solid",
                    borderColor: isDetectionLocked
                      ? "green.400"
                      : isDetectionStable
                        ? "green.300"
                        : documentDetected
                          ? "yellow.400"
                          : "gray.400",
                  })}
                />
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
