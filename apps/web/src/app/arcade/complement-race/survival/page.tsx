"use client";

import { PageWithNav } from "@/components/PageWithNav";
import { ComplementRaceGame } from "../components/ComplementRaceGame";
import { ComplementRaceProvider } from "@/arcade-games/complement-race/Provider";

export default function SurvivalModePage() {
  return (
    <PageWithNav navTitle="Survival Mode" navEmoji="🔄">
      <ComplementRaceProvider>
        <ComplementRaceGame />
      </ComplementRaceProvider>
    </PageWithNav>
  );
}
