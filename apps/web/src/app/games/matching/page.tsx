import { MemoryPairsGame } from "./components/MemoryPairsGame";
import { MemoryPairsProvider } from "./context/MemoryPairsContext";

export default function MatchingPage() {
  return (
    <MemoryPairsProvider>
      <MemoryPairsGame />
    </MemoryPairsProvider>
  );
}
