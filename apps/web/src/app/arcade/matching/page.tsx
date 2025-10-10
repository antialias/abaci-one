import { ArcadeGuardedPage } from "@/components/ArcadeGuardedPage";
import { MemoryPairsGame } from "./components/MemoryPairsGame";
import { LocalMemoryPairsProvider } from "./context/LocalMemoryPairsProvider";

export default function MatchingPage() {
  return (
    <ArcadeGuardedPage>
      <LocalMemoryPairsProvider>
        <MemoryPairsGame />
      </LocalMemoryPairsProvider>
    </ArcadeGuardedPage>
  );
}
