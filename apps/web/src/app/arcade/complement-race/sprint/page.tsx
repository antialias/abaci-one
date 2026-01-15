"use client";

import { PageWithNav } from "@/components/PageWithNav";
import { ComplementRaceGame } from "../components/ComplementRaceGame";
import { ComplementRaceProvider } from "@/arcade-games/complement-race/Provider";

export default function SprintModePage() {
  return (
    <PageWithNav navTitle="Steam Sprint" navEmoji="🚂">
      <ComplementRaceProvider>
        <ComplementRaceGame />
      </ComplementRaceProvider>
    </PageWithNav>
  );
}
