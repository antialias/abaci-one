import { NextResponse } from "next/server";
import buildInfo from "@/generated/build-info.json";

export async function GET() {
  return NextResponse.json(buildInfo);
}
