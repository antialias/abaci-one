import {
  DIFFICULTY_PROFILES,
  makeHarder,
  makeEasier,
  findRegroupingIndex,
  findScaffoldingIndex,
  REGROUPING_PROGRESSION,
  SCAFFOLDING_PROGRESSION,
} from "../src/app/create/worksheets/addition/difficultyProfiles";

// Start from beginner
let state = {
  pAnyStart: DIFFICULTY_PROFILES.beginner.regrouping.pAnyStart,
  pAllStart: DIFFICULTY_PROFILES.beginner.regrouping.pAllStart,
  displayRules: DIFFICULTY_PROFILES.beginner.displayRules,
};

console.log("=== MAKE HARDER PATH ===\n");
console.log("Format: (regroupingIdx, scaffoldingIdx) - description\n");

const harderPath: Array<{ r: number; s: number; desc: string }> = [];

// Record starting point
let rIdx = findRegroupingIndex(state.pAnyStart, state.pAllStart);
let sIdx = findScaffoldingIndex(state.displayRules);
harderPath.push({ r: rIdx, s: sIdx, desc: "START (beginner)" });
console.log(`(${rIdx}, ${sIdx}) - START (beginner)`);

// Click "Make Harder" 30 times or until max
for (let i = 0; i < 30; i++) {
  const result = makeHarder(state);

  const newR = findRegroupingIndex(result.pAnyStart, result.pAllStart);
  const newS = findScaffoldingIndex(result.displayRules);

  if (newR === rIdx && newS === sIdx) {
    console.log(`\n(${newR}, ${newS}) - ${result.changeDescription} (STOPPED)`);
    break;
  }

  rIdx = newR;
  sIdx = newS;
  state = result;

  harderPath.push({ r: rIdx, s: sIdx, desc: result.changeDescription });
  console.log(`(${rIdx}, ${sIdx}) - ${result.changeDescription}`);
}

console.log("\n\n=== PATH VISUALIZATION ===\n");
console.log("Regrouping Index →");
console.log("Scaffolding ↓\n");

// Create 2D grid visualization
const grid: string[][] = [];
for (let s = 0; s <= 12; s++) {
  grid[s] = [];
  for (let r = 0; r <= 18; r++) {
    grid[s][r] = "  ·";
  }
}

// Mark path
harderPath.forEach((point, idx) => {
  if (idx === 0) {
    grid[point.s][point.r] = "  S"; // Start
  } else if (idx === harderPath.length - 1) {
    grid[point.s][point.r] = "  E"; // End
  } else {
    grid[point.s][point.r] = `${idx.toString().padStart(3)}`;
  }
});

// Mark presets
const presets = [
  { label: "BEG", profile: DIFFICULTY_PROFILES.beginner },
  { label: "EAR", profile: DIFFICULTY_PROFILES.earlyLearner },
  { label: "INT", profile: DIFFICULTY_PROFILES.intermediate },
  { label: "ADV", profile: DIFFICULTY_PROFILES.advanced },
  { label: "EXP", profile: DIFFICULTY_PROFILES.expert },
];

presets.forEach((preset) => {
  const r = findRegroupingIndex(
    preset.profile.regrouping.pAnyStart,
    preset.profile.regrouping.pAllStart,
  );
  const s = findScaffoldingIndex(preset.profile.displayRules);

  // Only mark if not already part of path
  const onPath = harderPath.some((p) => p.r === r && p.s === s);
  if (!onPath) {
    grid[s][r] = preset.label;
  }
});

// Print grid (inverted so scaffolding increases upward)
console.log(
  "     0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17  18",
);
for (let s = 12; s >= 0; s--) {
  console.log(`${s.toString().padStart(2)} ${grid[s].join("")}`);
}

console.log("\nLegend:");
console.log("  S = Start (beginner)");
console.log("  E = End (maximum)");
console.log("  1-29 = Step number");
console.log("  BEG/EAR/INT/ADV/EXP = Preset profiles");
console.log("  · = Not visited");
