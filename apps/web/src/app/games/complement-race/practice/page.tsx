"use client";

import { PageWithNav } from "@/components/PageWithNav";
import { ComplementRaceGame } from "../components/ComplementRaceGame";
import { ComplementRaceProvider } from "../context/ComplementRaceContext";

export default function PracticeModePage() {
  return (
    <PageWithNav navTitle="Practice Mode" navEmoji="🏁">
      <ComplementRaceProvider initialStyle="practice">
        <ComplementRaceGame />
      </ComplementRaceProvider>
    </PageWithNav>
  );
}
