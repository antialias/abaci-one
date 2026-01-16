/**
 * Flowchart Definitions Index
 *
 * Exports all available flowchart definitions with their Mermaid content.
 */

import type { FlowchartDefinition } from '../schema'
import subtractionDefinition from './subtraction-regrouping.flow.json'
import fractionDefinition from './fraction-add-sub.flow.json'
import linearEquationsDefinition from './linear-equations.flow.json'

// Mermaid content embedded as strings (since Next.js doesn't support ?raw imports)
const SUBTRACTION_MERMAID = `%%{init: {'theme': 'base', 'themeVariables': { 'fontSize': '18px', 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1a1a1a', 'primaryBorderColor': '#90caf9', 'lineColor': '#444444'}, 'flowchart': {'curve': 'basis', 'nodeSpacing': 30, 'rankSpacing': 50, 'padding': 20}}}%%
flowchart TB
    subgraph PHASE1["<b>1. 👀 LOOK</b>"]
        direction LR
        START["🔢<br/>───<br/>Look at the<br/><b>ONES</b><br/>───<br/>👉 Right side"]
        START --> COMPARE{"<b>TOP</b><br/>bigger?<br/>───<br/>🔝 ≥ 🔽 ?"}
        COMPARE -->|"✓ YES"| HAPPY(("😊"))
        COMPARE -->|"✗ NO"| SAD(("😢"))
        HAPPY --> CHECK1["✅<br/>───<br/>Top is BIG<br/>Go subtract!"]
        SAD --> CHECK1B["⚠️<br/>───<br/>Top is SMALL<br/>Need to BORROW"]
    end

    subgraph PHASE2["<b>2. 🏦 BORROW</b>"]
        direction LR
        NEEDIT{"😊 or 😢?<br/>───<br/>Was TOP<br/>big enough?"}
        NEEDIT -->|"😊 YES"| SKIP(("👍"))
        NEEDIT -->|"😢 NO"| TENS["👈 <b>TENS</b><br/>───<br/>Go LEFT<br/>one spot<br/>───<br/>🔟🔟🔟"]
        TENS --> TAKEONE["<b>TAKE 1</b><br/>───<br/>Cross out<br/>Write 1 LESS<br/>───<br/>❌🔟 → ✏️"]
        TAKEONE --> BREAK["✂️ <b>BREAK IT!</b><br/>───<br/>1 ten =<br/>10 ones!<br/>───<br/>🔟 → ⚫⚫⚫⚫⚫<br/>      ⚫⚫⚫⚫⚫"]
        BREAK --> ADDTEN["<b>+10</b> ONES<br/>───<br/>Add 10 to<br/>TOP number<br/>───<br/>3 → <b>13</b>"]
        ADDTEN --> CHECK2["✅<br/>───<br/>Now TOP<br/>is BIG!"]
        SKIP --> CHECK2
    end

    subgraph PHASE3["<b>3. ➖ SUBTRACT</b>"]
        direction LR
        DOONES["<b>ONES</b> 👉<br/>───<br/>TOP − BOTTOM<br/>───<br/>Write answer"]
        DOONES --> DOTENS["<b>TENS</b> 👈<br/>───<br/>TOP − BOTTOM<br/>───<br/>Write answer"]
        DOTENS --> DONE(["🎉 DONE!"])
    end

    PHASE1 --> PHASE2
    PHASE2 --> PHASE3

    style PHASE1 fill:#e3f2fd,stroke:#1976d2,stroke-width:3px
    style PHASE2 fill:#fff8e1,stroke:#f9a825,stroke-width:3px
    style PHASE3 fill:#e8f5e9,stroke:#388e3c,stroke-width:3px

    style START fill:#bbdefb,stroke:#1976d2
    style COMPARE fill:#fffde7,stroke:#fbc02d,stroke-width:2px
    style HAPPY fill:#81c784,stroke:#388e3c
    style SAD fill:#ffcdd2,stroke:#d32f2f
    style CHECK1 fill:#a5d6a7,stroke:#388e3c
    style CHECK1B fill:#ffcdd2,stroke:#d32f2f,stroke-width:2px

    style NEEDIT fill:#fffde7,stroke:#fbc02d,stroke-width:2px
    style SKIP fill:#81c784,stroke:#388e3c
    style TENS fill:#bbdefb,stroke:#1976d2
    style TAKEONE fill:#e1bee7,stroke:#8e24aa
    style BREAK fill:#ffe0b2,stroke:#f57c00,stroke-width:2px
    style ADDTEN fill:#e1bee7,stroke:#8e24aa
    style CHECK2 fill:#a5d6a7,stroke:#388e3c

    style DOONES fill:#a5d6a7,stroke:#388e3c
    style DOTENS fill:#a5d6a7,stroke:#388e3c
    style DONE fill:#66bb6a,stroke:#2e7d32,stroke-width:2px
`

const FRACTION_MERMAID = `%%{init: {'theme': 'base', 'themeVariables': { 'fontSize': '14px', 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1a1a1a', 'primaryBorderColor': '#90caf9', 'lineColor': '#444444'}, 'flowchart': {'curve': 'basis', 'nodeSpacing': 25, 'rankSpacing': 40, 'padding': 15}}}%%
flowchart TB
    subgraph PHASE1["<b>1. 🔍 MAKE THE BOTTOMS MATCH</b>"]
        direction LR
        STEP0["<b>👀 LOOK AT BOTTOMS</b><br/>───────────────<br/>Write down both<br/>bottom numbers:<br/>___ and ___"]
        STEP0 --> STEP1{"<b>SAME?</b><br/>─────<br/>Are they the<br/>same number?"}
        STEP1 -->|"YES ✓"| READY1(("👍"))
        STEP1 -->|"NO"| STEP2{"<b>ONE FITS IN OTHER?</b><br/>─────────────<br/>Divide BIG bottom<br/>by SMALL bottom.<br/>Whole number?"}
        STEP2 -->|"YES"| CONV1A["<b>STEP A: FIND THE MULTIPLIER</b><br/>───────────────────<br/>What number × small bottom<br/>= big bottom?"]
        CONV1A --> CONV1B["<b>STEP B: MULTIPLY BOTH!</b><br/>───────────────────<br/>Multiply the TOP by that number.<br/>Multiply the BOTTOM by that number."]
        CONV1B --> CONV1C["💡 <b>WHY?</b> Because 2/2 = 1<br/>You're multiplying by 1!"]
        CONV1C --> READY2(("👍"))
        STEP2 -->|"NO"| STEP3["<b>CROSS MULTIPLY BOTTOMS</b><br/>──────────────────<br/>New bottom = left × right"]
        STEP3 --> STEP3B["<b>CONVERT BOTH FRACTIONS</b><br/>────────────────────<br/>For EACH fraction:<br/>What × old bottom = LCD?"] --> READY3(("👍"))
        READY1 --> CHECK1["<b>✅ READY CHECK</b><br/>──────────────<br/>☐ Both bottoms are<br/>   the SAME number"]
        READY2 --> CHECK1
        READY3 --> CHECK1
    end

    subgraph PHASE2["<b>2. ⚠️ DO YOU NEED TO BORROW?</b>"]
        direction LR
        REMIND["⚠️ <b>BOTTOMS MUST MATCH FIRST!</b>"]
        REMIND --> ADDSUB{"<b>ADDING OR<br/>SUBTRACTING?</b>"}
        ADDSUB -->|"➕ Adding"| GOSTEP4(("😎"))
        ADDSUB -->|"➖ Subtracting"| BORROWCHECK{"<b>COMPARE TOPS</b><br/>───────────<br/>Is the LEFT top<br/>≥ the RIGHT top?"}
        BORROWCHECK -->|"YES ✓"| GOSTEP4B(("😎"))
        BORROWCHECK -->|"😱 NO!"| BORROW["<b>🏦 BORROW 1 FROM WHOLE</b><br/>───────────────────<br/>1. Whole number GOES DOWN by 1<br/>2. Add the MATCHING BOTTOM to top"]
        BORROW --> GOSTEP4C(("💪"))
        GOSTEP4 --> CHECK2["<b>✅ READY CHECK</b>"]
        GOSTEP4B --> CHECK2
        GOSTEP4C --> CHECK2
    end

    subgraph PHASE3["<b>3. 🎯 DO THE MATH!</b>"]
        direction LR
        STEP4["<b>🔢 CALCULATE</b><br/>───────────<br/>• TOP numbers: add or subtract<br/>• BOTTOM: stays the same<br/>• WHOLE: add or subtract"]
        STEP4 --> SIMPLIFY_Q{"<b>SIMPLIFY?</b>"}
        SIMPLIFY_Q -->|"NO ✓"| IMPROPER_Q
        SIMPLIFY_Q -->|"YES"| SIMPLIFY_HOW["<b>🪜 FRACTION LADDER</b><br/>─────────────────<br/>Keep dividing by small numbers"]
        SIMPLIFY_HOW --> IMPROPER_Q{"<b>TOP > BOTTOM?</b>"}
        IMPROPER_Q -->|"NO ✓"| CHECK3
        IMPROPER_Q -->|"YES"| MIXED_HOW["<b>➗ IT'S JUST DIVISION!</b><br/>──────────────────<br/>TOP ÷ BOTTOM = ? R ?"]
        MIXED_HOW --> CHECK3["<b>✅ FINAL CHECK</b>"]
        CHECK3 --> DONE(["🎉 DONE!"])
    end

    PHASE1 --> PHASE2
    PHASE2 --> PHASE3

    style PHASE1 fill:#e3f2fd,stroke:#1976d2,stroke-width:3px
    style PHASE2 fill:#fff8e1,stroke:#f9a825,stroke-width:3px
    style PHASE3 fill:#e8f5e9,stroke:#388e3c,stroke-width:3px
`

const LINEAR_EQUATIONS_MERMAID = `%%{init: {'theme': 'base', 'themeVariables': { 'fontSize': '14px', 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1a1a1a', 'primaryBorderColor': '#90caf9', 'lineColor': '#444444'}, 'flowchart': {'curve': 'basis', 'nodeSpacing': 25, 'rankSpacing': 40, 'padding': 15}}}%%
flowchart TB
    subgraph PHASE1["<b>1. 🔍 UNDERSTAND THE EQUATION</b>"]
        direction LR
        INTRO["<b>🎁 WHAT IS x?</b><br/>───────────────<br/>x is a mystery number<br/>hiding in a box!"]
        INTRO --> BALANCE["<b>⚖️ THE BALANCE RULE</b><br/>─────────────────<br/>Both sides must be EQUAL.<br/>Whatever you do to one side,<br/>you MUST do to the other!"]
        BALANCE --> FIND_OP{"<b>🔍 HOW IS x TRAPPED?</b>"}
        FIND_OP -->|"ADDED ON"| STUCK_ADD(("➕➖"))
        FIND_OP -->|"MULTIPLIED IN"| STUCK_MUL(("✖️➗"))
        STUCK_ADD --> CHECK1["<b>✅ I FOUND IT</b>"]
        STUCK_MUL --> CHECK1
    end

    subgraph PHASE2["<b>2. ✨ SET x FREE!</b>"]
        direction LR
        GOAL["<b>🎯 x WANTS TO BE ALONE!</b>"]
        GOAL --> HOWSTUCK{"<b>🔍 HOW IS THE<br/>NUMBER STUCK?</b>"}
        HOWSTUCK -->|"Added/Subtracted"| ZERO["<b>0️⃣ YOU NEED A ZERO!</b><br/>─────────────────────<br/>x + 0 = x<br/>Zero sets x FREE!"]
        HOWSTUCK -->|"Multiplied/Divided"| ONE["<b>1️⃣ YOU NEED A ONE!</b><br/>─────────────────────<br/>x × 1 = x<br/>One sets x FREE!"]
        ZERO --> MAKEZ["<b>💡 HOW TO MAKE ZERO</b><br/>─────────────────────<br/>Add the OPPOSITE!"]
        ONE --> MAKEONE["<b>💡 HOW TO MAKE ONE</b><br/>─────────────────────<br/>DIVIDE it away!"]
        MAKEZ --> EX_ADD["<b>📝 EXAMPLE</b>"]
        MAKEONE --> EX_MUL["<b>📝 EXAMPLE</b>"]
        EX_ADD --> REMIND["⚠️ <b>BOTH SIDES!</b>"]
        EX_MUL --> REMIND
        REMIND --> CHECK2["<b>✅ IS x FREE?</b>"]
    end

    subgraph PHASE3["<b>3. ✔️ CHECK YOUR ANSWER!</b>"]
        direction LR
        PLUG["<b>🔌 PLUG IT BACK IN</b><br/>───────────────────<br/>Put your answer where x was."]
        PLUG --> MATCH{"<b>DOES IT MATCH?</b>"}
        MATCH -->|"YES ✓"| DONE(["🎉 YOU SOLVED IT!"])
        MATCH -->|"NO 😕"| RETRY["<b>🔍 TRY AGAIN</b>"]
    end

    PHASE1 --> PHASE2
    PHASE2 --> PHASE3

    style PHASE1 fill:#e3f2fd,stroke:#1976d2,stroke-width:3px
    style PHASE2 fill:#fff8e1,stroke:#f9a825,stroke-width:3px
    style PHASE3 fill:#e8f5e9,stroke:#388e3c,stroke-width:3px
`

/**
 * All available flowchart definitions
 */
export const FLOWCHARTS: Record<
  string,
  { definition: FlowchartDefinition; mermaid: string; meta: FlowchartMeta }
> = {
  'subtraction-regrouping': {
    definition: subtractionDefinition as FlowchartDefinition,
    mermaid: SUBTRACTION_MERMAID,
    meta: {
      id: 'subtraction-regrouping',
      title: 'Subtraction with Regrouping',
      description: 'Learn when and how to borrow in subtraction',
      emoji: '➖',
      difficulty: 'Beginner',
    },
  },
  'fraction-add-sub': {
    definition: fractionDefinition as FlowchartDefinition,
    mermaid: FRACTION_MERMAID,
    meta: {
      id: 'fraction-add-sub',
      title: 'Fraction Addition & Subtraction',
      description: 'Add and subtract fractions with different denominators',
      emoji: '➕',
      difficulty: 'Intermediate',
    },
  },
  'linear-equations': {
    definition: linearEquationsDefinition as FlowchartDefinition,
    mermaid: LINEAR_EQUATIONS_MERMAID,
    meta: {
      id: 'linear-equations',
      title: 'Solving Linear Equations',
      description: 'Solve equations like 3x + 5 = 17',
      emoji: '🔢',
      difficulty: 'Intermediate',
    },
  },
}

export interface FlowchartMeta {
  id: string
  title: string
  description: string
  emoji: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
}

/**
 * Get list of all available flowcharts
 */
export function getFlowchartList(): FlowchartMeta[] {
  return Object.values(FLOWCHARTS).map((f) => f.meta)
}

/**
 * Get a specific flowchart by ID
 */
export function getFlowchart(id: string) {
  return FLOWCHARTS[id] ?? null
}
