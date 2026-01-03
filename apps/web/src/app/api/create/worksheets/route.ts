// API route for generating addition worksheets

import { type NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { eq } from "drizzle-orm";
import { validateWorksheetConfig } from "@/app/create/worksheets/validation";
import {
  generateProblems,
  generateSubtractionProblems,
  generateMixedProblems,
} from "@/app/create/worksheets/problemGenerator";
import { generateTypstSource } from "@/app/create/worksheets/typstGenerator";
import { serializeAdditionConfig } from "@/app/create/worksheets/config-schemas";
import type {
  WorksheetFormState,
  WorksheetProblem,
} from "@/app/create/worksheets/types";
import { db } from "@/db";
import { worksheetShares } from "@/db/schema";
import { generateShareId } from "@/lib/generateShareId";

export async function POST(request: NextRequest) {
  try {
    const body: WorksheetFormState = await request.json();

    // Validate configuration
    const validation = validateWorksheetConfig(body);
    if (!validation.isValid || !validation.config) {
      return NextResponse.json(
        { error: "Invalid configuration", errors: validation.errors },
        { status: 400 },
      );
    }

    const config = validation.config;

    // Generate problems based on operator type
    let problems: WorksheetProblem[];
    if (config.operator === "addition") {
      problems = generateProblems(
        config.total,
        config.pAnyStart,
        config.pAllStart,
        config.interpolate,
        config.seed,
        config.digitRange,
      );
    } else if (config.operator === "subtraction") {
      problems = generateSubtractionProblems(
        config.total,
        config.digitRange,
        config.pAnyStart,
        config.pAllStart,
        config.interpolate,
        config.seed,
      );
    } else {
      // mixed
      problems = generateMixedProblems(
        config.total,
        config.digitRange,
        config.pAnyStart,
        config.pAllStart,
        config.interpolate,
        config.seed,
      );
    }

    // If QR code is enabled, create a share record first
    let shareUrl: string | undefined;
    if (config.includeQRCode) {
      try {
        // Generate unique share ID
        let shareId = generateShareId();
        let attempts = 0;
        const MAX_ATTEMPTS = 5;
        let isUnique = false;

        while (!isUnique && attempts < MAX_ATTEMPTS) {
          shareId = generateShareId();
          const existing = await db.query.worksheetShares.findFirst({
            where: eq(worksheetShares.id, shareId),
          });

          if (!existing) {
            isUnique = true;
          } else {
            attempts++;
          }
        }

        if (!isUnique) {
          console.error("Failed to generate unique share ID for QR code");
          // Continue without QR code rather than failing the entire request
        } else {
          // Get creator IP (hashed for privacy)
          const forwardedFor = request.headers.get("x-forwarded-for");
          const ip =
            forwardedFor?.split(",")[0] ||
            request.headers.get("x-real-ip") ||
            "unknown";

          const hashIp = (str: string) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
              const char = str.charCodeAt(i);
              hash = (hash << 5) - hash + char;
              hash = hash & hash;
            }
            return hash.toString(36);
          };

          // Serialize config for sharing
          const configJson = serializeAdditionConfig(body);

          // Create share record
          await db.insert(worksheetShares).values({
            id: shareId,
            worksheetType: "addition",
            config: configJson,
            createdAt: new Date(),
            views: 0,
            creatorIp: hashIp(ip),
            title: config.name || null,
          });

          // Build full URL
          const protocol = request.headers.get("x-forwarded-proto") || "https";
          const host = request.headers.get("host") || "abaci.one";
          shareUrl = `${protocol}://${host}/worksheets/shared/${shareId}`;
        }
      } catch (shareError) {
        console.error("Error creating share for QR code:", shareError);
        // Continue without QR code rather than failing the entire request
      }
    }

    // Generate Typst sources (one per page)
    const typstSources = await generateTypstSource(config, problems, shareUrl);

    // Join pages with pagebreak for PDF
    const typstSource = typstSources.join("\n\n#pagebreak()\n\n");

    // Compile with Typst: stdin → stdout
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = execSync("typst compile --format pdf - -", {
        input: typstSource,
        maxBuffer: 10 * 1024 * 1024, // 10MB limit
      });
    } catch (error) {
      console.error("Typst compilation error:", error);

      // Extract the actual Typst error message
      const stderr =
        error instanceof Error && "stderr" in error
          ? String((error as any).stderr)
          : "Unknown compilation error";

      return NextResponse.json(
        {
          error: "Failed to compile worksheet PDF",
          details: stderr,
          ...(process.env.NODE_ENV === "development" && {
            typstSource:
              typstSource.split("\n").slice(0, 20).join("\n") + "\n...",
          }),
        },
        { status: 500 },
      );
    }

    // Return binary PDF directly
    return new Response(pdfBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="addition-worksheet-${Date.now()}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generating worksheet:", error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    return NextResponse.json(
      {
        error: "Failed to generate worksheet",
        message: errorMessage,
        ...(process.env.NODE_ENV === "development" && { stack: errorStack }),
      },
      { status: 500 },
    );
  }
}
