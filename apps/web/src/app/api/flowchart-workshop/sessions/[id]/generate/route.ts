/**
 * Generate a flowchart from a topic description using LLM
 *
 * POST /api/flowchart-workshop/sessions/[id]/generate
 * - Takes a topic description and generates a complete flowchart
 * - Returns a streaming SSE response with progress updates
 *
 * Events:
 * - started: Generation has begun, includes responseId
 * - progress: Status update with stage and message
 * - reasoning: Model's thinking process (streamed incrementally)
 * - output_delta: Partial structured output being generated
 * - complete: Generated flowchart result
 * - error: Error occurred
 *
 * Query params:
 * - debug=true: Enable verbose LLM debug logging
 */

import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { db, schema } from "@/db";
import {
  broadcast,
  completeGeneration,
  failGeneration,
  startGeneration,
} from "@/lib/flowchart-workshop/generation-registry";
import {
  GeneratedFlowchartSchema,
  getGenerationSystemPrompt,
  getSubtractionExample,
  transformLLMDefinitionToInternal,
} from "@/lib/flowchart-workshop/llm-schemas";
import { validateTestCasesWithCoverage } from "@/lib/flowchart-workshop/test-case-validator";
import { llm, type StreamEvent } from "@/lib/llm";
import { getDbUserId } from "@/lib/viewer";

type GeneratedFlowchart = z.infer<typeof GeneratedFlowchartSchema>;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;

  // Check for debug mode via query param
  const url = new URL(request.url);
  const debug = url.searchParams.get("debug") === "true";

  // Always log route hit for debugging
  console.log(
    `[generate] POST /api/flowchart-workshop/sessions/${id}/generate`,
    {
      debug,
      timestamp: new Date().toISOString(),
    },
  );

  if (debug) {
    console.log("[generate] Debug mode enabled");
  }

  if (!id) {
    return new Response(JSON.stringify({ error: "Session ID required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Authorization check
  let userId: string;
  try {
    userId = await getDbUserId();
  } catch {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get the session
  const session = await db.query.workshopSessions.findFirst({
    where: and(
      eq(schema.workshopSessions.id, id),
      eq(schema.workshopSessions.userId, userId),
    ),
  });

  if (!session) {
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse request body
  let topicDescription: string;
  try {
    const body = await request.json();
    topicDescription = body.topicDescription || session.topicDescription;
    if (!topicDescription) {
      return new Response(
        JSON.stringify({ error: "Topic description required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Update session state
  await db
    .update(schema.workshopSessions)
    .set({
      state: "generating",
      topicDescription,
      updatedAt: new Date(),
    })
    .where(eq(schema.workshopSessions.id, id));

  // Create SSE stream with resilient event sending
  // Key design: LLM processing and DB saves happen regardless of client connection
  // Client streaming is best-effort - if they disconnect, we still complete the work
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let clientConnected = true;

      // Resilient event sender - catches errors if client disconnected
      // This ensures LLM processing continues even if client closes browser
      const sendEvent = (event: string, data: unknown) => {
        if (!clientConnected) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\n`));
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // Client disconnected - mark as disconnected but continue processing
          clientConnected = false;
          if (debug) {
            console.log(`[generate] Client disconnected during ${event} event`);
          }
        }
      };

      const closeStream = () => {
        if (!clientConnected) return;
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      // Track LLM errors separately from client errors
      let llmError: { message: string; code?: string } | null = null;
      let finalResult: GeneratedFlowchart | null = null;
      let usage: {
        promptTokens: number;
        completionTokens: number;
        reasoningTokens?: number;
      } | null = null;

      // Start tracking this generation in the registry (for reconnection support)
      console.log(`[generate] Starting generation registry for session ${id}`);
      const generationState = startGeneration(id);
      console.log(`[generate] Generation state created`, {
        sessionId: generationState.sessionId,
        status: generationState.status,
      });

      // Throttled save of reasoning text to database (for durability)
      let lastReasoningSaveTime = 0;
      const REASONING_SAVE_INTERVAL_MS = 2000; // Save reasoning every 2 seconds

      const saveReasoningToDb = async (force = false) => {
        const now = Date.now();
        if (
          !force &&
          now - lastReasoningSaveTime < REASONING_SAVE_INTERVAL_MS
        ) {
          return; // Throttle saves
        }
        lastReasoningSaveTime = now;
        try {
          await db
            .update(schema.workshopSessions)
            .set({
              currentReasoningText: generationState.accumulatedReasoning,
              updatedAt: new Date(),
            })
            .where(eq(schema.workshopSessions.id, id));
        } catch (err) {
          // Log but don't fail the stream on DB errors
          console.error("[generate] Failed to save reasoning to DB:", err);
        }
      };

      try {
        sendEvent("progress", {
          stage: "preparing",
          message: "Preparing flowchart generation...",
        });
        broadcast(id, {
          type: "progress",
          data: {
            stage: "preparing",
            message: "Preparing flowchart generation...",
          },
        });

        // Build the prompt
        const systemPrompt = getGenerationSystemPrompt();
        const examplePrompt = getSubtractionExample();

        const userPrompt = `Create an interactive math flowchart for teaching the following topic:

**Topic**: ${topicDescription}

Create a complete, working flowchart with:
1. A JSON definition with all nodes, variables, and validation
2. Mermaid content with visual formatting and phases
3. At least one example problem in the problemInput.examples array

The flowchart should be engaging for students, with clear phases, checkpoints for important calculations, and encouraging visual elements.

Return the result as a JSON object matching the GeneratedFlowchartSchema.`;

        // Combine system prompt with user prompt
        const fullPrompt = `${systemPrompt}\n\n${examplePrompt}\n\n---\n\n${userPrompt}`;

        // Stream the LLM response with reasoning
        // Use debug option to enable detailed logging in the LLM client
        console.log(`[generate] Creating LLM stream`, {
          provider: "openai",
          model: "gpt-5.2",
          promptLength: fullPrompt.length,
          debug,
        });
        const llmStream = llm.stream({
          provider: "openai",
          model: "gpt-5.2",
          prompt: fullPrompt,
          schema: GeneratedFlowchartSchema,
          reasoning: {
            effort: "medium",
            summary: "auto",
          },
          timeoutMs: 300_000, // 5 minutes for complex flowchart generation
          debug: true, // ALWAYS enable LLM client debug logging for now
        });

        console.log(`[generate] LLM stream created, starting iteration`);

        // Forward all stream events to the client AND broadcast to registry subscribers
        // The for-await loop processes all LLM events regardless of client state
        let eventCount = 0;
        console.log(`[generate] Entering event loop...`);
        for await (const event of llmStream as AsyncGenerator<
          StreamEvent<GeneratedFlowchart>,
          void,
          unknown
        >) {
          eventCount++;
          console.log(`[generate] LLM event #${eventCount}:`, event.type);

          switch (event.type) {
            case "started": {
              console.log(`[generate] LLM started event`, {
                responseId: event.responseId,
              });
              const startedData = {
                responseId: event.responseId,
                message: "Generating flowchart...",
              };
              sendEvent("started", startedData);
              // Note: 'started' is not broadcast - subscribers already know generation started
              break;
            }

            case "reasoning": {
              if (eventCount <= 5 || eventCount % 50 === 0) {
                console.log(`[generate] Reasoning event #${eventCount}`, {
                  textLength: event.text?.length,
                  isDelta: event.isDelta,
                  summaryIndex: event.summaryIndex,
                });
              }
              const reasoningData = {
                text: event.text,
                summaryIndex: event.summaryIndex,
                isDelta: event.isDelta,
              };
              // Broadcast to registry (this accumulates reasoning internally)
              broadcast(id, { type: "reasoning", data: reasoningData });
              // Throttled save to database for durability (don't await - fire and forget)
              saveReasoningToDb();
              // Send to this client's SSE stream
              sendEvent("reasoning", reasoningData);
              break;
            }

            case "output_delta": {
              if (eventCount <= 5 || eventCount % 50 === 0) {
                console.log(`[generate] Output delta event #${eventCount}`, {
                  textLength: event.text?.length,
                  outputIndex: event.outputIndex,
                });
              }
              const outputData = {
                text: event.text,
                outputIndex: event.outputIndex,
              };
              broadcast(id, { type: "output_delta", data: outputData });
              sendEvent("output_delta", outputData);
              break;
            }

            case "error":
              console.error(
                "[generate] LLM error event:",
                event.message,
                event.code,
              );
              // This is an LLM error, not a client error
              llmError = { message: event.message, code: event.code };
              sendEvent("error", {
                message: event.message,
                code: event.code,
              });
              // Don't broadcast error here - we'll call failGeneration() below
              break;

            case "complete":
              console.log(`[generate] LLM complete event`, {
                hasData: !!event.data,
                usage: event.usage,
              });
              finalResult = event.data;
              usage = event.usage;
              break;
          }
        }
        console.log(
          `[generate] Event loop finished, total events: ${eventCount}`,
        );
      } catch (error) {
        // This catch is for unexpected errors (network issues, etc.)
        // NOT for client disconnect (those are caught in sendEvent)
        console.error("[generate] Stream processing error:", error);
        llmError = {
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }

      // ALWAYS update database based on LLM result, regardless of client connection
      // This is the key fix: DB operations happen outside the try-catch for client errors
      console.log(`[generate] Post-loop processing`, {
        hasError: !!llmError,
        hasFinalResult: !!finalResult,
        hasUsage: !!usage,
      });
      if (llmError) {
        // LLM failed - update session to error state, clear reasoning
        await db
          .update(schema.workshopSessions)
          .set({
            state: "initial",
            draftNotes: JSON.stringify([
              `Generation failed: ${llmError.message}`,
            ]),
            currentReasoningText: null, // Clear reasoning on completion/error
            updatedAt: new Date(),
          })
          .where(eq(schema.workshopSessions.id, id));

        // Notify registry subscribers of failure
        failGeneration(id, llmError.message);

        sendEvent("error", { message: llmError.message });
      } else if (finalResult) {
        // LLM succeeded - save the result
        sendEvent("progress", {
          stage: "validating",
          message: "Validating result...",
        });

        // Transform LLM output (array-based) to internal format (record-based)
        const internalDefinition = transformLLMDefinitionToInternal(
          finalResult.definition,
        );

        // Run test case validation with coverage analysis
        const validationReport = await validateTestCasesWithCoverage(
          internalDefinition,
          finalResult.mermaidContent,
        );

        // Send validation event (regardless of pass/fail - UI will display results)
        sendEvent("validation", {
          passed: validationReport.passed,
          failedCount:
            validationReport.summary.failed + validationReport.summary.errors,
          totalCount: validationReport.summary.total,
          coveragePercent: validationReport.coverage.coveragePercent,
        });

        // Increment version number and save to history
        const currentVersion = session.currentVersionNumber ?? 0;
        const newVersion = currentVersion + 1;

        // Save version to history
        await db.insert(schema.flowchartVersionHistory).values({
          sessionId: id,
          versionNumber: newVersion,
          definitionJson: JSON.stringify(internalDefinition),
          mermaidContent: finalResult.mermaidContent,
          title: finalResult.title,
          description: finalResult.description,
          emoji: finalResult.emoji,
          difficulty: finalResult.difficulty,
          notes: JSON.stringify(finalResult.notes),
          source: "generate",
          sourceRequest: topicDescription,
          validationPassed: validationReport.passed,
          coveragePercent: validationReport.coverage.coveragePercent,
        });

        if (debug) {
          console.log(
            `[generate] Version ${newVersion} saved to history for session ${id}`,
          );
        }

        // Update session with the generated content, clear reasoning
        await db
          .update(schema.workshopSessions)
          .set({
            state: "refining",
            draftDefinitionJson: JSON.stringify(internalDefinition),
            draftMermaidContent: finalResult.mermaidContent,
            draftTitle: finalResult.title,
            draftDescription: finalResult.description,
            draftDifficulty: finalResult.difficulty,
            draftEmoji: finalResult.emoji,
            draftNotes: JSON.stringify(finalResult.notes),
            currentReasoningText: null, // Clear reasoning on completion
            currentVersionNumber: newVersion,
            updatedAt: new Date(),
          })
          .where(eq(schema.workshopSessions.id, id));

        if (debug) {
          console.log(`[generate] Flowchart saved to DB for session ${id}`);
        }

        // Build complete result for broadcasting
        const completeResult = {
          definition: internalDefinition,
          mermaidContent: finalResult.mermaidContent,
          title: finalResult.title,
          description: finalResult.description,
          emoji: finalResult.emoji,
          difficulty: finalResult.difficulty,
          notes: finalResult.notes,
          usage,
        };

        // Notify registry subscribers of completion (this also broadcasts 'complete' event)
        completeGeneration(id, completeResult);

        sendEvent("complete", completeResult);
      }

      closeStream();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
