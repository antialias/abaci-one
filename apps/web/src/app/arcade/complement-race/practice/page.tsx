"use client";

import { PageWithNav } from "@/components/PageWithNav";
import { ComplementRaceGame } from "../components/ComplementRaceGame";
import { ComplementRaceProvider } from "@/arcade-games/complement-race/Provider";

export default function PracticeModePage() {
  return (
    <PageWithNav navTitle="Practice Mode" navEmoji="🏁">
      <ComplementRaceProvider>
        <ComplementRaceGame />
      </ComplementRaceProvider>
    </PageWithNav>
  );
}
