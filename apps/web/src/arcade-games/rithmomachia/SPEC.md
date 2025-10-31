# Rithmomachia (Implementation Spec v1)

## 0) High-level goals

* Two players ("White" and "Black") play on a rectangular grid.
* Pieces carry **positive integers** called **values**.
* You move pieces like chess (clear paths, legal geometries).
* You **capture** via **mathematical relations** (equality, sum, difference, multiple, divisor, product, ratio).
* You may also win by building a **Harmony** (a progression) inside enemy territory.

This spec aims for: fully deterministic setup, no ambiguities, consistent networking, and easy future extensions.

---

## 1) Board

* **Dimensions:** `8 rows × 16 columns`
* **Coordinates:** Columns `A…P` (left→right), Rows `1…8` (bottom→top from White's perspective)

  * Bottom rank (Row 1) is White's back rank.
  * Top rank (Row 8) is Black's back rank.
* **Halves:**

  * **White half:** Rows `1–4`
  * **Black half:** Rows `5–8`

---

## 2) Pieces and movement

Each side has **25 pieces**:

* **12 Circles (C)** — "light" pieces
  Movement: **diagonal, any distance**, no jumping (like a bishop).
* **6 Triangles (T)** — "medium" pieces
  Movement: **orthogonal, any distance**, no jumping (like a rook).
* **6 Squares (S)** — "heavy" pieces
  Movement: **queen-like, any distance**, no jumping (orthogonal or diagonal).
* **1 Pyramid (P)** — "royal" piece
  Movement: **king-like, 1 step** in any direction (8-neighborhood).

> Note: Movement is purely geometric. Numeric relations are only for captures and victory checks.

---

## 3) Values (numbers printed on pieces)

To keep the classic "number theory" flavor without historical inconsistencies, we use **balanced, deterministic sets** for both sides.

### 3.1 White values

* **Circles (12):** `2, 4, 6, …, 24` (even 2–24)
* **Triangles (6):** `3, 9, 27, 81, 243, 729` (`3^1…3^6`)
* **Squares (6):** `4, 16, 64, 256, 1024, 4096` (`4^1…4^6`)
* **Pyramid (1):** multi-face tuple `[8, 27, 64, 1]`

  * For relations, the Pyramid's **face value** is chosen by the owner at relation-check time (see §5.5).

### 3.2 Black values

* **Circles (12):** `3, 6, 9, …, 36` (multiples of 3 from 3–36)
* **Triangles (6):** `2, 8, 32, 128, 512, 2048` (`2^1…2^11 skipping^? → exact set above`)
* **Squares (6):** `5, 25, 125, 625, 3125, 15625` (`5^1…5^6`)
* **Pyramid (1):** `[9, 32, 125, 1]`

> Rationale: Both sides get arithmetic + geometric "families" and a pyramid with four canonical faces. These sets are intentionally asymmetric but **balanced by geometry and victory routes**. You can swap or extend presets later without changing logic.

---

## 4) Initial setup

**VERTICAL LAYOUT** - Place pieces in **vertical columns** on opposite sides of the board:
- **BLACK pieces (filled/dark)**: Columns A, B, C (left side)
- **WHITE pieces (outline/light)**: Columns M, N, O, P (right side)
- **Playing area**: Columns D through L (middle 9 columns)

This follows the authoritative reference board image.

### BLACK Setup (Left side - columns A, B, C)

**Column A** (Squares and Triangles):
```
A1: S(49)   A2: S(121)  A3: T(36)   A4: T(30)
A5: T(56)   A6: T(64)   A7: S(225)  A8: S(361)
```

**Column B** (Squares, Circles, and Pyramid):
```
B1: S(28)   B2: S(66)   B3: C(9)    B4: C(25)
B5: C(49)   B6: C(81)   B7: S(120)  B8: P[9,32,125,1]
```

**Column C** (Triangles and Circles):
```
C1: T(16)   C2: T(12)   C3: C(3)    C4: C(5)
C5: C(7)    C6: C(9)    C7: T(90)   C8: T(100)
```

### WHITE Setup (Right side - columns M, N, O, P)

**Column M** (Sparse):
```
M1: empty   M2: T(7)    M3-M8: empty
```

**Column N** (Triangles, Circles, and Pyramid):
```
N1: T(4)    N2: P[8,27,64,1]  N3: C(8)    N4: C(6)
N5: C(4)    N6: C(2)          N7: T(5)    N8: T(6)
```

**Column O** (Squares and Circles):
```
O1: S(153)  O2: S(169)  O3: C(64)   O4: C(36)
O5: C(16)   O6: C(4)    O7: S(45)   O8: S(15)
```

**Column P** (Squares and Triangles):
```
P1: S(289)  P2: S(289)  P3: T(5)    P4: T(2)
P5: T(2)    P6: T(4)    P7: S(18)   P8: S(25)
```

### Piece Count Summary

**BLACK**: 7 Squares, 8 Triangles, 8 Circles, 1 Pyramid = **24 pieces**
**WHITE**: 7 Squares, 8 Triangles, 8 Circles, 1 Pyramid = **24 pieces**

> Note: This is a streamlined variant with 24 pieces per side instead of the traditional 25. The vertical layout emphasizes the positional strategy and mathematical relations across the wide board.

---

## 5) Turn structure

* **White moves first.**
* A **turn** consists of:

  1. **One movement** of a single piece (legal geometry, empty path).
  2. Optional **Capture Resolution** (if the destination contains an enemy piece or you declare a relation capture; see §6).
  3. Optional **Harmony Declaration** (if achieved; see §7).
* No en passant, no jumps, no castling; Pyramid is not a king (you don't lose on "check"), but see victory (§7, §8).

---

## 6) Captures (mathematical relations)

There are two categories:

### 6.1 Direct capture by **landing** (standard)

If you **move onto a square occupied by an enemy**, the capture **succeeds only if** **at least one** of the following relations between your **moved piece's value** (or Pyramid face) and the **enemy piece's value** is true:

* **Equality:** `a == b`
* **Multiple / Divisor:** `a % b == 0` or `b % a == 0` (strictly positive integers)
* **Sum (with an on-board friendly helper):** `a + h == b` or `b + h == a`
* **Difference (with helper):** `|a - h| == b` or `|b - h| == a`
* **Product (with helper):** `a * h == b` or `b * h == a`
* **Ratio (with helper):** `a * r == b` or `b * r == a`, where `r` equals the exact value of **some friendly helper** on the board.

**Helpers**:

* Are **any one** of your other pieces **already on the board** (they do **not** move).
* You must **name** the helper (piece ID) during capture resolution (for determinism).
* Only **one** helper may be used per capture.
* Helpers may be anywhere (not required to be adjacent).

**Pyramid face choice**:

* If your mover is a **Pyramid**, at capture time you may **choose one** of its faces (e.g., `8` or `27` or `64` or `1`) to be `a`. Record this in the move log.

If **none** of the relations hold, your landing **fails**: the move is illegal.

### 6.2 **Ambush capture** (no landing)

If, **after your movement**, an **enemy piece** sits on a square such that a relation holds **between that enemy's value** and **two of your unmoved pieces** simultaneously (think "pincer by numbers"), you may declare an ambush and remove the enemy. Use the same relations as above, but both friendly pieces are **helpers**; neither moves. You must specify **which two** and which relation. Ambush is optional and can only be declared **immediately** after your move.

> Tip for implementers: Model ambush as a post-move **relation scan** limited to enemies adjacent to some "relation context". Since helpers can be anywhere, you only need to check relations involving declared IDs; do not try to scan all pairs in large boards—let the client propose an ambush with (ids, relation) and the server validate.

---

## 7) Harmony (progression) victory

**Harmony** is both the theme of Rithmomachia and a special way to win. On your turn (after movement/captures), you may **declare Harmony** if you arrange three of your pieces in the **opponent's half** (White in rows 5–8, Black in rows 1–4) so their **values stand in a classical proportion**.

### 7.1 Three types of harmony (three-piece structure: A–M–B)

All harmonies use **three pieces** where M is the middle piece (spatially between A and B on the board):

* **Arithmetic Proportion (AP)**: the middle is the arithmetic mean
  - **Condition:** `2M = A + B`
  - **Example:** 6, 9, 12 (since 2·9 = 6 + 12 = 18)

* **Geometric Proportion (GP)**: the middle is the geometric mean
  - **Condition:** `M² = A · B`
  - **Example:** 6, 12, 24 (since 12² = 6·24 = 144)

* **Harmonic Proportion (HP)**: the middle is the harmonic mean
  - **Condition:** `2AB = M(A + B)` (equivalently, 1/A, 1/M, 1/B forms an AP)
  - **Examples:**
    - 6, 8, 12 (since 2·6·12 = 8·(6+12) = 144)
    - 10, 12, 15 (since 2·10·15 = 12·(10+15) = 300)
    - 8, 12, 24 (since 2·8·24 = 12·(8+24) = 384)

> **Tip:** Use these integer equalities for validation—no division or rounding needed!

### 7.2 Board layout constraints

The three pieces must be arranged in a **straight line** (row, column, or diagonal) with one of these spacing rules:

1. **Straight & adjacent** (default): Three consecutive squares in order A–M–B
2. **Straight with equal spacing**: Same as above, but one empty square between each neighbor (still collinear)
3. **Collinear anywhere**: Pieces on the same line in correct numeric order, with any spacing

**Default for this implementation:** Straight & adjacent (option 1)

### 7.3 Common harmony triads (for reference)

**Arithmetic:**
- (6, 9, 12), (8, 12, 16), (5, 7, 9), (4, 6, 8)

**Geometric:**
- (4, 8, 16), (3, 9, 27), (2, 8, 32), (5, 25, 125)

**Harmonic:**
- (3, 4, 6), (4, 6, 12), (6, 8, 12), (10, 12, 15), (8, 12, 24), (6, 10, 15)

### 7.4 Declaring and winning

**Rules:**

* Pieces must be **distinct** and on **distinct squares**
* All three must be **entirely within opponent's half**
* **Pyramid face**: When a Pyramid is included, you must **fix** a face value for the duration of the check
* **Persistence:** Your declared Harmony must **survive the opponent's next full turn** (they can try to break it by moving/capturing). If, when your next turn begins, the Harmony still exists (same set or **any valid set** of ≥3), **you win immediately**

**Procedure:**

1. On your turn, complete the arrangement (by moving one piece)
2. **Announce** the proportion (e.g., "harmonic 6–8–12 on column D")
3. Opponent verifies the numeric relation and board condition
4. If valid, harmony is **pending**—opponent gets one turn to break it
5. If still valid at start of your next turn, you **win**

> **Implementation:** On declare, snapshot the **set of piece IDs**, **proportion type**, and **parameters**. On the declarer's next turn start, **re-validate** either the same set OR allow **any** new valid harmony (we choose **any valid set** to reward dynamic play).

---

## 8) Other victory conditions

* **Exhaustion:** If a player has **no legal moves** at the start of their turn, they **lose**.
* **Resignation:** A player may resign at any time.
* **Point victory (optional toggle):** Track point values for pieces (C=1, T=2, S=3, P=5). If a player reaches **30 points captured**, they may declare a **Point Win** at the end of their turn. (Off by default; enable for ladders.)

---

## 9) Draws

* **Threefold repetition** (same full state, same player to move) → draw on claim.
* **50-move rule** (no capture, no Harmony declaration) → draw on claim.
* **Mutual agreement** → draw.

---

## 10) Illegal states / edge cases

* **No zero or negative values.** All values are positive integers.
* **No jumping** ever.
* **Self-capture** forbidden.
* **Helper identity** must be a currently alive friendly piece, not the mover (unless the relation allows using the mover's own value on both sides, which it shouldn't—disallow self as helper).
* **Division/ratio** must be exact in integers—no rounding.
* **Overflow**: Use bigints (JS `BigInt`) for relation math to avoid overflow with large powers.

---

## 11) Data model (authoritative server)

### 11.1 Piece

```ts
type PieceType = 'C' | 'T' | 'S' | 'P';
type Color = 'W' | 'B';

interface Piece {
  id: string;          // stable UUID
  color: Color;
  type: PieceType;
  value?: number;      // for C/T/S always present
  pyramidFaces?: number[]; // for P only (length 4)
  activePyramidFace?: number | null; // last chosen face for logging/captures
  square: string;      // "A1".."P8"
  captured: boolean;
}
```

### 11.2 Game state

```ts
interface GameState {
  id: string;
  boardCols: number;     // 16
  boardRows: number;     // 8
  turn: Color;           // 'W' or 'B'
  pieces: Record<string, Piece>;
  history: MoveRecord[];
  pendingHarmony?: HarmonyDeclaration | null; // if declared last turn
  rules: {
    pointWinEnabled: boolean;
    repetitionRule: boolean;
    fiftyMoveRule: boolean;
    allowAnySetOnRecheck: boolean; // true per §7
  };
  halfBoundaries: { whiteHalfRows: [1,2,3,4], blackHalfRows: [5,6,7,8] };
  clocks?: { Wms: number; Bms: number } | null; // optional timers
}
```

### 11.3 Move + capture records

```ts
type RelationKind = 'EQUAL' | 'MULTIPLE' | 'DIVISOR' | 'SUM' | 'DIFF' | 'PRODUCT' | 'RATIO';

interface CaptureContext {
  relation: RelationKind;
  moverPieceId: string;
  targetPieceId: string;
  helperPieceId?: string;            // required for SUM/DIFF/PRODUCT/RATIO
  moverFaceUsed?: number | null;     // if mover was a Pyramid
}

interface AmbushContext {
  relation: RelationKind;
  enemyPieceId: string;
  helper1Id: string;
  helper2Id: string;   // two helpers for ambush
}

interface MoveRecord {
  ply: number;
  color: Color;
  from: string;        // e.g., "C2"
  to: string;          // e.g., "C6"
  pieceId: string;
  pyramidFaceUsed?: number | null;
  capture?: CaptureContext | null;
  ambush?: AmbushContext | null;
  harmonyDeclared?: HarmonyDeclaration | null;
  pointsCapturedThisMove?: number; // if point scoring is on
  fenLikeHash?: string;            // for repetition detection
  noProgressCount?: number;        // for 50-move rule
  resultAfter?: 'ONGOING' | 'WINS_W' | 'WINS_B' | 'DRAW';
}
```

### 11.4 Harmony declaration

```ts
type HarmonyType = 'ARITH' | 'GEOM' | 'HARM';

interface HarmonyDeclaration {
  by: Color;
  pieceIds: string[];          // ≥3
  type: HarmonyType;
  params: { v?: string; d?: string; r?: string }; // store as strings for bigints if needed
  declaredAtPly: number;
}
```

---

## 12) Server protocol (WebSocket)

### 12.1 Messages (client → server)

```jsonc
// Join a room
{ "type": "join_room", "roomId": "rith-123", "playerToken": "..." }

// Ask for current state (idempotent)
{ "type": "get_state", "roomId": "rith-123" }

// Propose a move (with optional capture or ambush info)
{
  "type": "move_request",
  "roomId": "rith-123",
  "payload": {
    "pieceId": "W_C_06",
    "from": "C2",
    "to": "H7",
    "pyramidFaceUsed": 27,                 // if mover is Pyramid (optional)
    "capture": {
      "relation": "SUM",                   // if landing capture
      "targetPieceId": "B_T_03",
      "helperPieceId": "W_S_02"
    },
    "ambush": {
      "relation": "PRODUCT",               // if declaring ambush after movement
      "enemyPieceId": "B_S_05",
      "helper1Id": "W_T_01",
      "helper2Id": "W_S_03"
    },
    "harmony": {
      "type": "GEOM",
      "pieceIds": ["W_C_02","W_T_02","W_S_02"],
      "params": { "v": "2", "r": "2" }
    }
  }
}

// Resign
{ "type": "resign", "roomId": "rith-123" }
```

### 12.2 Messages (server → client)

```jsonc
// Room joined / spectator assigned
{ "type": "room_joined", "seat": "W" | "B" | "SPECTATOR", "state": { /* GameState */ } }

// State update after validated move
{ "type": "state_update", "state": { /* GameState */ } }

// Move rejected with reason
{ "type": "move_rejected", "reason": "ILLEGAL_MOVE|ILLEGAL_CAPTURE|RELATION_FAIL|TURN|NOT_OWNER|PATH_BLOCKED|BAD_HELPER|HARMONY_INVALID" }

// Game ended
{ "type": "game_over", "result": "WINS_W|WINS_B|DRAW", "by": "HARMONY|EXHAUSTION|RESIGNATION|POINTS|AGREEMENT|REPETITION|FIFTY" }
```

---

## 13) Validation logic (server)

### 13.1 Movement

* Check turn ownership.
* Check piece exists, not captured.
* Validate geometry for type (C diag; T ortho; S queen; P king).
* Validate clear path (grid ray-cast).
* If destination is empty:

  * Allow **non-capture** move.
  * After move, you may **declare ambush** (if valid).
* If destination occupied by enemy:

  * Move only allowed if **landing capture** relations validate (with declared helper if required).
  * Otherwise reject.

### 13.2 Relation checks

* All arithmetic in **bigints**.
* Equality is trivial.
* Multiple/Divisor: simple modulo checks; reject zeros.
* Sum/Diff/Product/Ratio require **helper** piece ID. Validate that helper:

  * is friendly, alive, not the mover,
  * has a well-defined value (Pyramid has implicit four candidates, but **helpers do not switch faces**; they are not pyramids here in our v1; if you allow Pyramid as helper, require explicit `helperFaceUsed` in payload and store it).
* For **Pyramid mover**, allow `pyramidFaceUsed` and use that as `a`.

### 13.3 Ambush

* The mover's landing square can be empty or enemy (if enemy, you must pass landing-capture first).
* Ambush uses **two helpers**; both must be friendly, alive, distinct, not the mover.
* Validate relation against the **enemy piece value** and the two helpers per the declared relation (server recomputes).

### 13.4 Harmony

* Validate ≥3 friendly pieces **on enemy half**.
* Extract their effective values (Pyramids must fix a face for the check; store it inside the HarmonyDeclaration).
* Validate strict progression per type.
* Store a pending declaration tied to `declaredAtPly`.
* On the declarer's next turn start: if **any** valid ≥3 set exists (per `allowAnySetOnRecheck`), award win; otherwise clear pending.

---

## 14) UI/UX suggestions (client)

* Hover a destination to see **all legal relation captures** (auto-suggest helpers).
* Toggle **"math inspector"** to show factors, multiples, candidate sums/diffs.
* **Harmony builder** UI: click pieces on enemy half; client proposes arithmetic/geometric/harmonic fits.
* Log every move with human-readable math, e.g.:
  `W: T(27) C2→C7 captures B S(125) by RATIO 27×(125/27)=125 [helper W S(125)? nope; example only]`.

---

## 15) Test cases (goldens)

1. **Simple equality capture**
   Move `W C(6)` onto `B C(6)` → valid by `EQUAL`.

2. **Sum capture**
   `W T(9)` lands on `B C(15)` using helper `W C(6)` → `9 + 6 = 15`.

3. **Divisor capture**
   `W S(64)` lands on `B T(2048)` → divisor (`2048 % 64 == 0`).

4. **Pyramid face**
   `W P[8,27,64,1]` chooses face `64` to land-capture `B S(64)` by `EQUAL`.

5. **Ambush**
   After moving any piece, declare ambush vs `B S(125)` using helpers `W T(5)` and `W S(25)` by `PRODUCT` (5×25=125). (Adjust helper identities to real IDs in your setup.)

6. **Harmony (GEOM)**
   White occupies enemy half with values 4, 16, 64 → geometric (v=4, r=4). Declare; if it persists one full Black turn, White wins.

---

## 16) Optional rule toggles (versioning)

* **Strict Pyramid faces:** Allow Pyramid as **helper** only if face is declared similarly to mover.
* **Helper adjacency:** Require helpers to be **adjacent** to enemy for SUM/DIFF/PRODUCT/RATIO (reduces global scans).
* **Any-set vs same-set on recheck:** We chose **any-set**. Switchable.

---

## 17) Dev notes

* Use **Zobrist hashing** (or similar) for `fenLikeHash` to detect repetitions.
* Keep a **no-progress counter** (reset on any capture or harmony declaration).
* Use **BigInt** end-to-end for piece values and relation math.
* Build a **deterministic PRNG** only if you later add random presets—current spec is deterministic.

---

## Implementation Status

Last updated: 2025-10-29

The current implementation in `src/arcade-games/rithmomachia/` follows this spec:

- **Board setup**: ✅ VERTICAL layout (§4) - BLACK on left (columns A-C), WHITE on right (columns M-P)
- **Piece rendering**: ✅ SVG-based with precise color control (PieceRenderer.tsx)
  - BLACK pieces: Dark fill (#1a1a1a) with black stroke
  - WHITE pieces: Light fill (#ffffff) with gray stroke
- **Piece values**: ✅ Match reference board image exactly (24 pieces per side)
- **Movement validation**: ✅ Implemented in `Validator.ts` following geometric rules
- **Capture system**: ✅ Relation-based captures per §6
- **Harmony system**: ✅ Progression detection and validation per §7
- **Data types**: ✅ All types use `number` (not `bigint`) for JSON serialization
- **Game controls**: ✅ Settings UI with rule toggles, New Game, Setup
- **UI**: ✅ Click-to-select, click-to-move piece interaction

**Remaining features (future enhancement):**
1. Math inspector UI (show legal captures with auto-suggested helpers)
2. Harmony builder UI (visual progression detector)
3. Move history display with human-readable math notation
4. Ambush capture UI (currently only basic movement implemented)
5. Enhanced piece highlighting for available moves
