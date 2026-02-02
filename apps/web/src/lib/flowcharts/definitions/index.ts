/**
 * Flowchart Definitions Registry
 *
 * **THIS FILE CONTAINS EMBEDDED MERMAID CONTENT!**
 *
 * Each flowchart has two parts:
 * 1. **JSON definition** (`.flow.json`): Behavior, validation, variables
 * 2. **Mermaid content**: Visual presentation, node text, phases
 *
 * ## Where is the Mermaid content?
 *
 * | Flowchart | Mermaid Location |
 * |-----------|------------------|
 * | subtraction-regrouping | Embedded below as `SUBTRACTION_MERMAID` |
 * | fraction-add-sub | Embedded below as `FRACTION_MERMAID` |
 * | linear-equations | Embedded below as `LINEAR_EQUATIONS_MERMAID` |
 * | sentence-type | Embedded below as `SENTENCE_TYPE_MERMAID` (uses transforms) |
 * | order-of-operations | Embedded below as `ORDER_OF_OPERATIONS_MERMAID` (uses transforms) |
 *
 * **To find node content**: Search this file for the node ID (e.g., `READY1`) in
 * the appropriate `*_MERMAID` constant.
 *
 * ## Why Embed Mermaid?
 *
 * Next.js doesn't support `?raw` imports for loading text files.
 * Embedding the mermaid content as template strings is the simplest solution.
 *
 * ## Adding a New Flowchart
 *
 * 1. Create `my-flowchart.flow.json` in this directory
 * 2. Add `const MY_FLOWCHART_MERMAID = \`...\`` below
 * 3. Import the JSON and add to `FLOWCHARTS` registry
 *
 * @see {@link ../README.md} for complete system documentation
 * @module flowcharts/definitions
 */

import type { FlowchartDefinition } from '../schema'
import subtractionDefinition from './subtraction-regrouping.flow.json'
import fractionDefinition from './fraction-add-sub.flow.json'
import linearEquationsDefinition from './linear-equations.flow.json'
import sentenceTypeDefinition from './sentence-type.flow.json'
import orderOfOperationsDefinition from './order-of-operations.flow.json'

// =============================================================================
// EMBEDDED MERMAID CONTENT
// =============================================================================
// These constants contain the visual content for each flowchart.
// Search for node IDs (e.g., "READY1", "STEP0") to find their content.

/**
 * Mermaid content for subtraction-regrouping flowchart.
 * Nodes: START, COMPARE, HAPPY, SAD, CHECK1, CHECK1B, NEEDIT, SKIP, TENS,
 *        TAKEONE, BREAK, ADDTEN, CHECK2, DOONES, DOTENS, DONE
 */
const SUBTRACTION_MERMAID = `%%{init: {'theme': 'base', 'themeVariables': { 'fontSize': '18px', 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1a1a1a', 'primaryBorderColor': '#90caf9', 'lineColor': '#444444'}, 'flowchart': {'curve': 'basis', 'nodeSpacing': 30, 'rankSpacing': 50, 'padding': 20}}}%%
flowchart TB
    subgraph PHASE1["<b>1. 👀 LOOK</b>"]
        direction LR
        START["🔢<br/>───<br/>Look at the<br/><b>ONES</b><br/>───<br/>👉 Right side"]
        START e_start_compare@--> COMPARE{"<b>TOP</b><br/>bigger?<br/>───<br/>🔝 ≥ 🔽 ?"}
        COMPARE e_compare_yes@-->|"✓ YES"| HAPPY(("😊"))
        COMPARE e_compare_no@-->|"✗ NO"| SAD(("😢"))
        HAPPY e_happy_check@--> CHECK1["✅<br/>───<br/>Top is BIG<br/>Go subtract!"]
        SAD e_sad_check@--> CHECK1B["⚠️<br/>───<br/>Top is SMALL<br/>Need to BORROW"]
    end

    subgraph PHASE2["<b>2. 🏦 BORROW</b>"]
        direction LR
        NEEDIT{"😊 or 😢?<br/>───<br/>Was TOP<br/>big enough?"}
        NEEDIT e_needit_yes@-->|"😊 YES"| SKIP(("👍"))
        NEEDIT e_needit_no@-->|"😢 NO"| TENS["👈 <b>TENS</b><br/>───<br/>Go LEFT<br/>one spot<br/>───<br/>🔟🔟🔟"]
        TENS e_tens_take@--> TAKEONE["<b>TAKE 1</b><br/>───<br/>Cross out<br/>Write 1 LESS<br/>───<br/>❌🔟 → ✏️"]
        TAKEONE e_take_break@--> BREAK["✂️ <b>BREAK IT!</b><br/>───<br/>1 ten =<br/>10 ones!<br/>───<br/>🔟 → ⚫⚫⚫⚫⚫<br/>      ⚫⚫⚫⚫⚫"]
        BREAK e_break_add@--> ADDTEN["<b>+10</b> ONES<br/>───<br/>Add 10 to<br/>TOP number<br/>───<br/>3 → <b>13</b>"]
        ADDTEN e_add_check@--> CHECK2["✅<br/>───<br/>Now TOP<br/>is BIG!"]
        SKIP e_skip_check@--> CHECK2
    end

    subgraph PHASE3["<b>3. ➖ SUBTRACT</b>"]
        direction LR
        DOONES["<b>ONES</b> 👉<br/>───<br/>TOP − BOTTOM<br/>───<br/>Write answer"]
        DOONES e_ones_tens@--> DOTENS["<b>TENS</b> 👈<br/>───<br/>TOP − BOTTOM<br/>───<br/>Write answer"]
        DOTENS e_tens_done@--> DONE(["🎉 DONE!"])
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

/**
 * Mermaid content for fraction-add-sub flowchart.
 * Nodes: STEP0, STEP1, READY1, READY2, READY3, STEP2, CONV1A, CONV1B, CONV1C,
 *        STEP3, STEP3B, CHECK1, REMIND, ADDSUB, GOSTEP4, GOSTEP4B, GOSTEP4C,
 *        BORROWCHECK, BORROW, CHECK2, STEP4, CALC_DENOM, CALC_WHOLE,
 *        SIMPLIFY_Q, SIMPLIFY_HOW, IMPROPER_Q, MIXED_HOW, CHECK3, DONE
 *
 * NOTE: Milestone nodes (READY1, READY2, READY3, GOSTEP4, etc.) only contain
 * emoji like (("👍")) - they display briefly before auto-advancing.
 */
const FRACTION_MERMAID = `%%{init: {'theme': 'base', 'themeVariables': { 'fontSize': '14px', 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1a1a1a', 'primaryBorderColor': '#90caf9', 'lineColor': '#444444'}, 'flowchart': {'curve': 'basis', 'nodeSpacing': 25, 'rankSpacing': 40, 'padding': 15}}}%%
flowchart TB
    subgraph PHASE1["<b>1. 🔍 MAKE THE BOTTOMS MATCH</b>"]
        direction LR
        STEP0["<b>👀 LOOK AT BOTTOMS</b><br/>───────────────<br/>Find the bottom numbers<br/>(denominators) of both fractions<br/>and enter them below."]
        STEP0 e_step0_step1@--> STEP1{"<b>SAME?</b><br/>─────<br/>Are they the<br/>same number?"}
        STEP1 e_step1_yes@-->|"YES ✓"| READY1(("👍"))
        STEP1 e_step1_no@-->|"NO"| STEP2{"<b>ONE FITS IN OTHER?</b><br/>─────────────<br/>Divide BIG bottom<br/>by SMALL bottom.<br/>Whole number?"}
        STEP2 e_step2_yes@-->|"YES"| CONV1A["<b>STEP A: FIND THE MULTIPLIER</b><br/>───────────────────<br/>What number × small bottom<br/>= big bottom?"]
        CONV1A e_conv1a_b@--> CONV1B["<b>STEP B: MULTIPLY BOTH!</b><br/>───────────────────<br/>Multiply the TOP by that number.<br/>Multiply the BOTTOM by that number."]
        CONV1B e_conv1b_c@--> CONV1C["💡 <b>WHY?</b> Because 2/2 = 1<br/>You're multiplying by 1!"]
        CONV1C e_conv1c_ready@--> READY2(("👍"))
        STEP2 e_step2_no@-->|"NO"| STEP3["<b>CROSS MULTIPLY BOTTOMS</b><br/>──────────────────<br/>New bottom = left × right"]
        STEP3 e_step3_3b@--> STEP3B["<b>CONVERT BOTH FRACTIONS</b><br/>────────────────────<br/>For EACH fraction:<br/>What × old bottom = LCD?"] e_step3b_ready@--> READY3(("👍"))
        READY1 e_ready1_check@--> CHECK1["<b>✅ READY CHECK</b><br/>──────────────<br/>☐ Both bottoms are<br/>   the SAME number<br/>☐ I wrote the new fractions down"]
        READY2 e_ready2_check@--> CHECK1
        READY3 e_ready3_check@--> CHECK1
    end

    subgraph PHASE2["<b>2. ⚠️ DO YOU NEED TO BORROW?</b>"]
        direction LR
        REMIND["<b>⚠️ BOTTOMS MUST MATCH FIRST!</b>"]
        REMIND e_remind_addsub@--> ADDSUB{"<b>ADDING OR<br/>SUBTRACTING?</b>"}
        ADDSUB e_addsub_add@-->|"➕ Adding"| GOSTEP4(("😎"))
        ADDSUB e_addsub_sub@-->|"➖ Subtracting"| BORROWCHECK{"<b>COMPARE TOPS</b><br/>───────────<br/>Is the LEFT top<br/>≥ the RIGHT top?"}
        BORROWCHECK e_borrow_yes@-->|"YES ✓"| GOSTEP4B(("😎"))
        BORROWCHECK e_borrow_no@-->|"😱 NO!"| BORROW["<b>🏦 BORROW 1 FROM WHOLE</b><br/>───────────────────<br/>1. Whole number GOES DOWN by 1<br/>2. Add the MATCHING BOTTOM to top"]
        BORROW e_borrow_go@--> GOSTEP4C(("💪"))
        GOSTEP4 e_go4_check@--> CHECK2["<b>✅ READY CHECK</b>"]
        GOSTEP4B e_go4b_check@--> CHECK2
        GOSTEP4C e_go4c_check@--> CHECK2
    end

    subgraph PHASE3["<b>3. 🎯 DO THE MATH!</b>"]
        direction LR
        STEP4["<b>🔢 NUMERATOR</b><br/>───────────<br/>Add or subtract<br/>the TOP numbers"]
        STEP4 e_step4_denom@--> CALC_DENOM["<b>🔢 DENOMINATOR</b><br/>───────────<br/>The bottom number<br/>stays the same!"]
        CALC_DENOM e_denom_whole@--> CALC_WHOLE["<b>🔢 WHOLE NUMBER</b><br/>───────────<br/>Add or subtract<br/>the whole numbers<br/>(0 if none)"]
        CALC_WHOLE e_whole_simplify@--> SIMPLIFY_Q{"<b>SIMPLIFY?</b>"}
        SIMPLIFY_Q e_simplify_no@-->|"NO ✓"| IMPROPER_Q
        SIMPLIFY_Q e_simplify_yes@-->|"YES"| SIMPLIFY_HOW["<b>🪜 FRACTION LADDER</b><br/>─────────────────<br/>Keep dividing by small numbers"]
        SIMPLIFY_HOW e_how_improper@--> IMPROPER_Q{"<b>TOP > BOTTOM?</b>"}
        IMPROPER_Q e_improper_no@-->|"NO ✓"| CHECK3
        IMPROPER_Q e_improper_yes@-->|"YES"| MIXED_HOW["<b>➗ IT'S JUST DIVISION!</b><br/>──────────────────<br/>TOP ÷ BOTTOM = ? R ?"]
        MIXED_HOW e_mixed_check@--> CHECK3["<b>✅ FINAL CHECK</b>"]
        CHECK3 e_check3_done@--> DONE(["🎉 DONE!"])
    end

    PHASE1 --> PHASE2
    PHASE2 --> PHASE3

    style PHASE1 fill:#e3f2fd,stroke:#1976d2,stroke-width:3px
    style PHASE2 fill:#fff8e1,stroke:#f9a825,stroke-width:3px
    style PHASE3 fill:#e8f5e9,stroke:#388e3c,stroke-width:3px
`

/**
 * Mermaid content for linear-equations flowchart.
 * Nodes: INTRO, BALANCE, FIND_OP, STUCK_ADD, STUCK_MUL, CHECK1, GOAL,
 *        HOWSTUCK, ZERO, ONE, MAKEZ, MAKEONE, EX_ADD, EX_MUL, REMIND,
 *        CHECK2, PLUG, MATCH, DONE, RETRY
 */
const LINEAR_EQUATIONS_MERMAID = `%%{init: {'theme': 'base', 'themeVariables': { 'fontSize': '14px', 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1a1a1a', 'primaryBorderColor': '#90caf9', 'lineColor': '#444444'}, 'flowchart': {'curve': 'basis', 'nodeSpacing': 25, 'rankSpacing': 40, 'padding': 15}}}%%
flowchart TB
    subgraph PHASE1["<b>1. 🔍 UNDERSTAND THE EQUATION</b>"]
        direction LR
        INTRO["<b>🎁 WHAT IS x?</b><br/>───────────────<br/>x is a mystery number<br/>hiding in a box!"]
        INTRO e_intro_balance@--> BALANCE["<b>⚖️ THE BALANCE RULE</b><br/>─────────────────<br/>Both sides must be EQUAL.<br/>Whatever you do to one side,<br/>you MUST do to the other!"]
        BALANCE e_balance_find@--> FIND_OP{"<b>🔍 HOW IS x TRAPPED?</b>"}
        FIND_OP e_find_add@-->|"ADDED ON"| STUCK_ADD(("➕➖"))
        FIND_OP e_find_mul@-->|"MULTIPLIED IN"| STUCK_MUL(("✖️➗"))
        STUCK_ADD e_add_check@--> CHECK1["<b>✅ I FOUND IT</b>"]
        STUCK_MUL e_mul_check@--> CHECK1
    end

    subgraph PHASE2["<b>2. ✨ SET x FREE!</b>"]
        direction LR
        GOAL["<b>🎯 x WANTS TO BE ALONE!</b>"]
        GOAL e_goal_how@--> HOWSTUCK{"<b>🔍 HOW IS THE<br/>NUMBER STUCK?</b>"}
        HOWSTUCK e_stuck_addsub@-->|"Added/Subtracted"| ZERO["<b>0️⃣ YOU NEED A ZERO!</b><br/>─────────────────────<br/>x + 0 = x<br/>Zero sets x FREE!"]
        HOWSTUCK e_stuck_muldiv@-->|"Multiplied/Divided"| ONE["<b>1️⃣ YOU NEED A ONE!</b><br/>─────────────────────<br/>x × 1 = x<br/>One sets x FREE!"]
        ZERO e_zero_make@--> MAKEZ["<b>💡 HOW TO MAKE ZERO</b><br/>─────────────────────<br/>Add the OPPOSITE!"]
        ONE e_one_make@--> MAKEONE["<b>💡 HOW TO MAKE ONE</b><br/>─────────────────────<br/>DIVIDE it away!"]
        MAKEZ e_makez_ex@--> EX_ADD["<b>📝 EXAMPLE</b>"]
        MAKEONE e_makeone_ex@--> EX_MUL["<b>📝 EXAMPLE</b>"]
        EX_ADD e_exadd_remind@--> REMIND["<b>⚠️ BOTH SIDES!</b>"]
        EX_MUL e_exmul_remind@--> REMIND
        REMIND e_remind_check@--> CHECK2["<b>✅ IS x FREE?</b>"]
    end

    subgraph PHASE3["<b>3. ✔️ CHECK YOUR ANSWER!</b>"]
        direction LR
        PLUG["<b>🔌 PLUG IT BACK IN</b><br/>───────────────────<br/>Put your answer where x was."]
        PLUG e_plug_match@--> MATCH{"<b>DOES IT MATCH?</b>"}
        MATCH e_match_yes@-->|"YES ✓"| DONE(["🎉 YOU SOLVED IT!"])
        MATCH e_match_no@-->|"NO 😕"| RETRY["<b>🔍 TRY AGAIN</b>"]
    end

    PHASE1 --> PHASE2
    PHASE2 --> PHASE3

    style PHASE1 fill:#e3f2fd,stroke:#1976d2,stroke-width:3px
    style PHASE2 fill:#fff8e1,stroke:#f9a825,stroke-width:3px
    style PHASE3 fill:#e8f5e9,stroke:#388e3c,stroke-width:3px
`

/**
 * Mermaid content for sentence-type flowchart.
 * Demonstrates the new unified computation model with transforms on nodes.
 * Nodes: START, CHECK_END, IS_QUESTION, RESULT_INTERROGATIVE, CHECK_COMMAND,
 *        RESULT_IMPERATIVE_EXCLAIM, RESULT_EXCLAMATORY, CHECK_STATEMENT,
 *        RESULT_DECLARATIVE, RESULT_IMPERATIVE_POLITE, DONE
 */
const SENTENCE_TYPE_MERMAID = `%%{init: {'theme': 'base', 'themeVariables': { 'fontSize': '16px', 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1a1a1a', 'primaryBorderColor': '#90caf9', 'lineColor': '#444444'}, 'flowchart': {'curve': 'basis', 'nodeSpacing': 30, 'rankSpacing': 50, 'padding': 20}}}%%
flowchart TB
    subgraph PHASE1["<b>1. 📝 READ THE SENTENCE</b>"]
        direction LR
        START["<b>LOOK AT THE SENTENCE</b><br/>───────────────<br/>Read the sentence carefully.<br/>Notice how it ends!"]
        START e_start_check@--> CHECK_END{"<b>WHAT'S AT THE END?</b><br/>─────────────────<br/>Find the punctuation mark."}
    end

    subgraph PHASE2["<b>2. 🔍 CLASSIFY IT</b>"]
        direction TB
        CHECK_END e_end_question@-->|"?"| IS_QUESTION["<b>IT'S A QUESTION!</b><br/>───────────────<br/>Questions ask for<br/>information."]
        IS_QUESTION e_question_result@--> RESULT_INTERROGATIVE(("❓"))

        CHECK_END e_end_exclaim@-->|"!"| CHECK_COMMAND{"<b>WHAT KIND?</b><br/>────────────<br/>Is it giving an order<br/>or expressing feeling?"}
        CHECK_COMMAND e_cmd_order@-->|"Order/Command"| RESULT_IMPERATIVE_EXCLAIM["<b>IT'S A COMMAND!</b><br/>───────────────<br/>Commands tell someone<br/>to do something."]
        CHECK_COMMAND e_cmd_feeling@-->|"Strong Feeling"| RESULT_EXCLAMATORY["<b>IT'S AN EXCLAMATION!</b><br/>───────────────<br/>Exclamations express<br/>strong emotions."]

        CHECK_END e_end_period@-->|"."| CHECK_STATEMENT{"<b>WHAT KIND?</b><br/>────────────<br/>Is it stating facts<br/>or making a request?"}
        CHECK_STATEMENT e_stmt_fact@-->|"Statement"| RESULT_DECLARATIVE["<b>IT'S A STATEMENT!</b><br/>───────────────<br/>Statements tell us<br/>facts or opinions."]
        CHECK_STATEMENT e_stmt_request@-->|"Request"| RESULT_IMPERATIVE_POLITE["<b>IT'S A POLITE COMMAND!</b><br/>───────────────<br/>Some commands are<br/>gentle and use periods."]
    end

    subgraph PHASE3["<b>3. 🎯 RESULT</b>"]
        RESULT_INTERROGATIVE e_interrog_done@--> DONE(["🎉 <b>INTERROGATIVE</b>"])
        RESULT_IMPERATIVE_EXCLAIM e_impexcl_done@--> DONE
        RESULT_EXCLAMATORY e_exclam_done@--> DONE
        RESULT_DECLARATIVE e_declar_done@--> DONE
        RESULT_IMPERATIVE_POLITE e_imppol_done@--> DONE
    end

    PHASE1 --> PHASE2
    PHASE2 --> PHASE3

    style PHASE1 fill:#e3f2fd,stroke:#1976d2,stroke-width:3px
    style PHASE2 fill:#fff8e1,stroke:#f9a825,stroke-width:3px
    style PHASE3 fill:#e8f5e9,stroke:#388e3c,stroke-width:3px
`

/**
 * Mermaid content for order-of-operations flowchart.
 * Full PEMDAS support with up to 3 operations.
 * Nodes: START, EXPLAIN_PEMDAS, IDENTIFY_STEP1, DO_STEP1, CHECK_STEP1,
 *        AFTER_STEP1, CHECK_MORE_STEPS1, IDENTIFY_STEP2, DO_STEP2, CHECK_STEP2,
 *        AFTER_STEP2, CHECK_MORE_STEPS2, IDENTIFY_STEP3, DO_STEP3, CHECK_STEP3, DONE
 */
const ORDER_OF_OPERATIONS_MERMAID = `%%{init: {'theme': 'base', 'themeVariables': { 'fontSize': '16px', 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1a1a1a', 'primaryBorderColor': '#90caf9', 'lineColor': '#444444'}, 'flowchart': {'curve': 'basis', 'nodeSpacing': 30, 'rankSpacing': 50, 'padding': 20}}}%%
flowchart TB
    subgraph INTRO_PHASE["<b>📖 PEMDAS</b>"]
        START["<b>ORDER OF OPERATIONS</b><br/>───────────────<br/>Solve: {{expr}}"]
        START e_start_explain@--> EXPLAIN_PEMDAS["<b>REMEMBER PEMDAS!</b><br/>───────────────<br/>P - Parentheses first<br/>E - Exponents<br/>MD - Multiply/Divide (L→R)<br/>AS - Add/Subtract (L→R)"]
    end

    subgraph STEP1_PHASE["<b>⭐ STEP 1</b>"]
        EXPLAIN_PEMDAS e_explain_id1@--> IDENTIFY_STEP1{"<b>WHAT'S FIRST?</b><br/>─────────────<br/>Which operation<br/>has highest priority?"}
        IDENTIFY_STEP1 e_id1_p@-->|"P"| DO_STEP1
        IDENTIFY_STEP1 e_id1_e@-->|"E"| DO_STEP1
        IDENTIFY_STEP1 e_id1_md@-->|"MD"| DO_STEP1
        IDENTIFY_STEP1 e_id1_as@-->|"AS"| DO_STEP1
        DO_STEP1["<b>CALCULATE</b><br/>───────────<br/>{{opDisplay}}"]
        DO_STEP1 e_do1_check@--> CHECK_STEP1["✅ Enter result"]
        CHECK_STEP1 e_check1_after@--> AFTER_STEP1["<b>SIMPLIFIED</b><br/>───────────<br/>{{showExpr}}"]
        AFTER_STEP1 e_after1_more@--> CHECK_MORE_STEPS1[" "]
    end

    subgraph STEP2_PHASE["<b>⭐ STEP 2</b>"]
        CHECK_MORE_STEPS1 e_more1_id2@--> IDENTIFY_STEP2{"<b>NEXT OPERATION?</b><br/>─────────────<br/>What's the priority?"}
        IDENTIFY_STEP2 e_id2_p@-->|"P"| DO_STEP2
        IDENTIFY_STEP2 e_id2_e@-->|"E"| DO_STEP2
        IDENTIFY_STEP2 e_id2_md@-->|"MD"| DO_STEP2
        IDENTIFY_STEP2 e_id2_as@-->|"AS"| DO_STEP2
        DO_STEP2["<b>CALCULATE</b><br/>───────────<br/>{{opDisplay}}"]
        DO_STEP2 e_do2_check@--> CHECK_STEP2["✅ Enter result"]
        CHECK_STEP2 e_check2_after@--> AFTER_STEP2["<b>SIMPLIFIED</b><br/>───────────<br/>{{showExpr}}"]
        AFTER_STEP2 e_after2_more@--> CHECK_MORE_STEPS2[" "]
    end

    subgraph STEP3_PHASE["<b>⭐ STEP 3</b>"]
        CHECK_MORE_STEPS2 e_more2_id3@--> IDENTIFY_STEP3{"<b>FINAL OPERATION?</b><br/>─────────────<br/>What's the priority?"}
        IDENTIFY_STEP3 e_id3_p@-->|"P"| DO_STEP3
        IDENTIFY_STEP3 e_id3_e@-->|"E"| DO_STEP3
        IDENTIFY_STEP3 e_id3_md@-->|"MD"| DO_STEP3
        IDENTIFY_STEP3 e_id3_as@-->|"AS"| DO_STEP3
        DO_STEP3["<b>CALCULATE</b><br/>───────────<br/>{{opDisplay}}"]
        DO_STEP3 e_do3_check@--> CHECK_STEP3["✅ Enter result"]
    end

    CHECK_MORE_STEPS1 -.->|"done"| DONE
    CHECK_MORE_STEPS2 -.->|"done"| DONE
    CHECK_STEP3 e_check3_done@--> DONE(["🎉 DONE!"])

    style INTRO_PHASE fill:#e3f2fd,stroke:#1976d2,stroke-width:3px
    style STEP1_PHASE fill:#fff8e1,stroke:#f9a825,stroke-width:3px
    style STEP2_PHASE fill:#e8f5e9,stroke:#388e3c,stroke-width:3px
    style STEP3_PHASE fill:#fce4ec,stroke:#c2185b,stroke-width:3px
`

/**
 * Built-in flowchart seeds.
 *
 * These are the canonical definitions for built-in flowcharts.
 * Use the Seed Manager (debug mode on /flowchart) to populate the database.
 * After seeding, flowcharts are loaded from the database, not from here.
 */
export const FLOWCHART_SEEDS: Record<
  string,
  { definition: FlowchartDefinition; mermaid: string; meta: FlowchartMeta }
> = {
  'subtraction-regrouping': {
    definition: subtractionDefinition as unknown as FlowchartDefinition,
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
  'sentence-type': {
    definition: sentenceTypeDefinition as FlowchartDefinition,
    mermaid: SENTENCE_TYPE_MERMAID,
    meta: {
      id: 'sentence-type',
      title: 'Identify Sentence Types',
      description:
        'Learn to classify declarative, interrogative, imperative, and exclamatory sentences',
      emoji: '📝',
      difficulty: 'Beginner',
    },
  },
  'order-of-operations': {
    definition: orderOfOperationsDefinition as FlowchartDefinition,
    mermaid: ORDER_OF_OPERATIONS_MERMAID,
    meta: {
      id: 'order-of-operations',
      title: 'Order of Operations (PEMDAS)',
      description: 'Learn to solve expressions like 3 + 4 × 2 step by step',
      emoji: '🔢',
      difficulty: 'Beginner',
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
 * Extended metadata for flowcharts from the database
 */
export interface FlowchartMetaWithSource extends FlowchartMeta {
  source: 'hardcoded' | 'database'
  authorId?: string
  publishedAt?: Date | null
}

/**
 * Full flowchart data with definition and mermaid content
 */
export interface FlowchartData {
  definition: FlowchartDefinition
  mermaid: string
  meta: FlowchartMeta
  source: 'hardcoded' | 'database'
  authorId?: string
  version?: number
  publishedAt?: Date | null
}

/**
 * Get list of all seed flowcharts (sync).
 * Use this only for the Seed Manager - not for loading flowcharts.
 */
export function getSeedList(): FlowchartMeta[] {
  return Object.values(FLOWCHART_SEEDS).map((f) => f.meta)
}

/**
 * Get a specific seed flowchart by ID (sync).
 * Use this only for the Seed Manager - not for loading flowcharts.
 */
export function getSeed(id: string) {
  return FLOWCHART_SEEDS[id] ?? null
}

// =============================================================================
// ASYNC LOADERS (database only)
// =============================================================================

/**
 * Get a flowchart by ID from the database.
 * Use this in API routes and server components.
 *
 * NOTE: Flowcharts must be seeded to the database first using the Seed Manager
 * (debug mode on /flowchart) before they can be loaded.
 *
 * @param id - The flowchart ID
 * @returns The flowchart data or null if not found
 */
export async function getFlowchartByIdAsync(id: string): Promise<FlowchartData | null> {
  // Dynamic import to avoid circular dependencies
  const { db, schema } = await import('@/db')
  const { and, eq } = await import('drizzle-orm')

  // Load from database only
  const dbFlowchart = await db.query.teacherFlowcharts.findFirst({
    where: and(
      eq(schema.teacherFlowcharts.id, id),
      eq(schema.teacherFlowcharts.status, 'published')
    ),
  })

  if (dbFlowchart) {
    let definition: FlowchartDefinition
    try {
      definition = JSON.parse(dbFlowchart.definitionJson)
    } catch {
      console.error(`Invalid definition JSON for flowchart ${id}`)
      return null
    }

    return {
      definition,
      mermaid: dbFlowchart.mermaidContent,
      meta: {
        id: dbFlowchart.id,
        title: dbFlowchart.title,
        description: dbFlowchart.description || '',
        emoji: dbFlowchart.emoji || '📊',
        difficulty: (dbFlowchart.difficulty as FlowchartMeta['difficulty']) || 'Beginner',
      },
      source: 'database',
      authorId: dbFlowchart.userId,
      version: dbFlowchart.version,
      publishedAt: dbFlowchart.publishedAt,
    }
  }

  return null
}

/**
 * Get list of all published flowcharts from the database.
 * Use this in API routes and server components.
 *
 * NOTE: Flowcharts must be seeded to the database first using the Seed Manager
 * (debug mode on /flowchart) before they appear in this list.
 *
 * @returns List of all published flowchart metadata
 */
export async function getFlowchartListAsync(): Promise<FlowchartMetaWithSource[]> {
  // Dynamic import to avoid circular dependencies
  const { db, schema } = await import('@/db')
  const { desc, eq } = await import('drizzle-orm')

  // Get published flowcharts from database only
  const dbFlowcharts = await db.query.teacherFlowcharts.findMany({
    where: eq(schema.teacherFlowcharts.status, 'published'),
    orderBy: [desc(schema.teacherFlowcharts.publishedAt)],
    columns: {
      id: true,
      title: true,
      description: true,
      emoji: true,
      difficulty: true,
      userId: true,
      publishedAt: true,
    },
  })

  return dbFlowcharts.map((fc) => ({
    id: fc.id,
    title: fc.title,
    description: fc.description || '',
    emoji: fc.emoji || '📊',
    difficulty: (fc.difficulty as FlowchartMeta['difficulty']) || 'Beginner',
    source: 'database' as const,
    authorId: fc.userId,
    publishedAt: fc.publishedAt,
  }))
}
