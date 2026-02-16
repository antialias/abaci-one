/**
 * Euclid's Elements, Book I — Complete structured data.
 *
 * Source: Heath translation via Joyce's edition (Clark University).
 * http://aleph0.clarku.edu/~djoyce/java/elements/bookI/bookI.html
 *
 * This file encodes all 48 propositions, the 23 definitions, 5 postulates,
 * 5 common notions, and the full dependency DAG.
 */

// ---------------------------------------------------------------------------
// Foundations
// ---------------------------------------------------------------------------

export type Definition = {
  id: number;
  term: string;
  text: string;
};

export const definitions: Definition[] = [
  { id: 1, term: "Point", text: "A point is that which has no part." },
  { id: 2, term: "Line", text: "A line is breadthless length." },
  {
    id: 3,
    term: "Ends of a Line",
    text: "The ends of a line are points.",
  },
  {
    id: 4,
    term: "Straight Line",
    text: "A straight line is a line which lies evenly with the points on itself.",
  },
  {
    id: 5,
    term: "Surface",
    text: "A surface is that which has length and breadth only.",
  },
  {
    id: 6,
    term: "Edges of a Surface",
    text: "The edges of a surface are lines.",
  },
  {
    id: 7,
    term: "Plane Surface",
    text: "A plane surface is a surface which lies evenly with the straight lines on itself.",
  },
  {
    id: 8,
    term: "Plane Angle",
    text: "A plane angle is the inclination to one another of two lines in a plane which meet one another and do not lie in a straight line.",
  },
  {
    id: 9,
    term: "Rectilinear Angle",
    text: "When the lines containing the angle are straight, the angle is called rectilinear.",
  },
  {
    id: 10,
    term: "Right Angle / Perpendicular",
    text: "When a straight line standing on a straight line makes the adjacent angles equal to one another, each of the equal angles is right, and the straight line standing on the other is called a perpendicular to that on which it stands.",
  },
  {
    id: 11,
    term: "Obtuse Angle",
    text: "An obtuse angle is an angle greater than a right angle.",
  },
  {
    id: 12,
    term: "Acute Angle",
    text: "An acute angle is an angle less than a right angle.",
  },
  {
    id: 13,
    term: "Boundary",
    text: "A boundary is that which is an extremity of anything.",
  },
  {
    id: 14,
    term: "Figure",
    text: "A figure is that which is contained by any boundary or boundaries.",
  },
  {
    id: 15,
    term: "Circle",
    text: "A circle is a plane figure contained by one line such that all the straight lines falling upon it from one point among those lying within the figure equal one another.",
  },
  {
    id: 16,
    term: "Center of a Circle",
    text: "And the point is called the center of the circle.",
  },
  {
    id: 17,
    term: "Diameter",
    text: "A diameter of the circle is any straight line drawn through the center and terminated in both directions by the circumference of the circle, and such a straight line also bisects the circle.",
  },
  {
    id: 18,
    term: "Semicircle",
    text: "A semicircle is the figure contained by the diameter and the circumference cut off by it. And the center of the semicircle is the same as that of the circle.",
  },
  {
    id: 19,
    term: "Rectilinear Figures",
    text: "Rectilinear figures are those which are contained by straight lines, trilateral figures being those contained by three, quadrilateral those contained by four, and multilateral those contained by more than four straight lines.",
  },
  {
    id: 20,
    term: "Triangle Types (by sides)",
    text: "Of trilateral figures, an equilateral triangle is that which has its three sides equal, an isosceles triangle that which has two of its sides alone equal, and a scalene triangle that which has its three sides unequal.",
  },
  {
    id: 21,
    term: "Triangle Types (by angles)",
    text: "Further, of trilateral figures, a right-angled triangle is that which has a right angle, an obtuse-angled triangle that which has an obtuse angle, and an acute-angled triangle that which has its three angles acute.",
  },
  {
    id: 22,
    term: "Quadrilateral Types",
    text: "Of quadrilateral figures, a square is that which is both equilateral and right-angled; an oblong that which is right-angled but not equilateral; a rhombus that which is equilateral but not right-angled; and a rhomboid that which has its opposite sides and angles equal to one another but is neither equilateral nor right-angled. And let quadrilaterals other than these be called trapezia.",
  },
  {
    id: 23,
    term: "Parallel Lines",
    text: "Parallel straight lines are straight lines which, being in the same plane and being produced indefinitely in both directions, do not meet one another in either direction.",
  },
];

export type Postulate = {
  id: number;
  text: string;
  shortName: string;
};

export const postulates: Postulate[] = [
  {
    id: 1,
    shortName: "Draw a line",
    text: "To draw a straight line from any point to any point.",
  },
  {
    id: 2,
    shortName: "Extend a line",
    text: "To produce a finite straight line continuously in a straight line.",
  },
  {
    id: 3,
    shortName: "Draw a circle",
    text: "To describe a circle with any center and radius.",
  },
  {
    id: 4,
    shortName: "Right angles are equal",
    text: "That all right angles equal one another.",
  },
  {
    id: 5,
    shortName: "The parallel postulate",
    text: "That, if a straight line falling on two straight lines makes the interior angles on the same side less than two right angles, the two straight lines, if produced indefinitely, meet on that side on which are the angles less than the two right angles.",
  },
];

export type CommonNotion = {
  id: number;
  text: string;
  shortName: string;
};

export const commonNotions: CommonNotion[] = [
  {
    id: 1,
    shortName: "Transitivity of equality",
    text: "Things which equal the same thing also equal one another.",
  },
  {
    id: 2,
    shortName: "Addition of equals",
    text: "If equals are added to equals, then the wholes are equal.",
  },
  {
    id: 3,
    shortName: "Subtraction of equals",
    text: "If equals are subtracted from equals, then the remainders are equal.",
  },
  {
    id: 4,
    shortName: "Coincidence / superposition",
    text: "Things which coincide with one another equal one another.",
  },
  {
    id: 5,
    shortName: "Whole greater than part",
    text: "The whole is greater than the part.",
  },
];

// ---------------------------------------------------------------------------
// Propositions
// ---------------------------------------------------------------------------

export type PropositionType = "construction" | "theorem";

/**
 * Thematic block groupings. Each proposition belongs to exactly one block.
 * Blocks follow the logical/pedagogical structure of Book I.
 */
export type ThematicBlock =
  | "basic-constructions"
  | "triangle-congruence"
  | "fundamental-constructions"
  | "angle-arithmetic"
  | "triangle-inequalities"
  | "construction-from-parts"
  | "more-congruence"
  | "parallel-lines"
  | "parallelogram-basics"
  | "area-theory"
  | "application-of-areas"
  | "the-finale";

export const thematicBlocks: Record<
  ThematicBlock,
  { label: string; props: number[]; description: string }
> = {
  "basic-constructions": {
    label: "Basic Constructions",
    props: [1, 2, 3],
    description:
      "Transfer and compare line segments. Establishes that the collapsing compass is as powerful as a real compass.",
  },
  "triangle-congruence": {
    label: "Triangle Congruence",
    props: [4, 5, 6, 7, 8],
    description:
      "SAS, the isosceles triangle theorem (Pons Asinorum), and SSS.",
  },
  "fundamental-constructions": {
    label: "Fundamental Constructions",
    props: [9, 10, 11, 12],
    description: "Bisect angles, bisect lines, draw perpendiculars.",
  },
  "angle-arithmetic": {
    label: "Angle Arithmetic",
    props: [13, 14, 15],
    description: "Supplementary angles and vertical angles.",
  },
  "triangle-inequalities": {
    label: "Triangle Inequalities",
    props: [16, 17, 18, 19, 20, 21],
    description:
      "Exterior angle theorem, angle-side ordering, triangle inequality. No parallel postulate needed.",
  },
  "construction-from-parts": {
    label: "Construction from Parts",
    props: [22, 23],
    description: "Build triangles from three sides, copy angles.",
  },
  "more-congruence": {
    label: "More Congruence",
    props: [24, 25, 26],
    description: "Hinge theorem and ASA/AAS congruence.",
  },
  "parallel-lines": {
    label: "Parallel Lines",
    props: [27, 28, 29, 30, 31, 32],
    description:
      "THE WATERSHED. Props 27-28 don't need the parallel postulate. Prop 29 is the first to use it. Culminates in the angle sum theorem (I.32).",
  },
  "parallelogram-basics": {
    label: "Parallelogram Basics",
    props: [33, 34],
    description:
      "Opposite sides/angles equal, diagonal bisects area.",
  },
  "area-theory": {
    label: "Area Theory",
    props: [35, 36, 37, 38, 39, 40, 41, 43],
    description:
      "Equal parallelograms and triangles on same base in same parallels.",
  },
  "application-of-areas": {
    label: "Application of Areas",
    props: [42, 44, 45, 46],
    description:
      "Transform any rectilinear figure into a parallelogram of desired shape. Construct squares.",
  },
  "the-finale": {
    label: "The Finale",
    props: [47, 48],
    description: "The Pythagorean theorem and its converse.",
  },
};

export type Proposition = {
  id: number;
  type: PropositionType;
  title: string;
  statement: string;
  /** Nicknames or traditional names, if any. */
  aka?: string[];
  block: ThematicBlock;
  dependencies: {
    propositions: number[];
    postulates: number[];
    commonNotions: number[];
    definitions: number[];
  };
  /**
   * Whether this proposition requires Euclid's parallel postulate (Post.5),
   * either directly or transitively through its dependencies.
   * Props 1-28: false (absolute geometry).
   * Props 29-48: true (Euclidean geometry only).
   */
  requiresParallelPostulate: boolean;
  /** Brief summary of the proof method. */
  proofMethod: string;
  /** Pedagogical notes for the interactive implementation. */
  notes?: string;
};

export const propositions: Proposition[] = [
  // =========================================================================
  // Block 1: Basic Constructions (1-3)
  // =========================================================================
  {
    id: 1,
    type: "construction",
    title: "Construct an equilateral triangle on a given line",
    statement:
      "To construct an equilateral triangle on a given finite straight line.",
    block: "basic-constructions",
    dependencies: {
      propositions: [],
      postulates: [1, 3],
      commonNotions: [1],
      definitions: [15, 20],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Draw two circles (centered at each endpoint, radius = the line). Their intersection gives the third vertex. Join to both endpoints.",
    notes:
      "THE onboarding proposition. First compass-and-straightedge construction. Euclid does not prove the circles intersect (a gap later filled by continuity axioms).",
  },
  {
    id: 2,
    type: "construction",
    title: "Transfer a line segment to a given point",
    statement:
      "To place a straight line equal to a given straight line with one end at a given point.",
    block: "basic-constructions",
    dependencies: {
      propositions: [1],
      postulates: [1, 2, 3],
      commonNotions: [1, 3],
      definitions: [15],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Construct equilateral triangle on the join, extend sides, use two circles to transfer the distance via subtraction.",
    notes:
      "This is how you transfer a distance with a collapsing compass. Requires 5 circles and 3 lines.",
  },
  {
    id: 3,
    type: "construction",
    title: "Cut off from the greater a line equal to the less",
    statement:
      "To cut off from the greater of two given unequal straight lines a straight line equal to the less.",
    block: "basic-constructions",
    dependencies: {
      propositions: [2],
      postulates: [3],
      commonNotions: [1],
      definitions: [15],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Use I.2 to transfer the shorter line to the endpoint of the longer, then draw a circle to mark the cut point.",
    notes:
      "After this, Euclid can freely copy any line segment to any location. The compass is now effectively rigid.",
  },

  // =========================================================================
  // Block 2: Triangle Congruence (4-8)
  // =========================================================================
  {
    id: 4,
    type: "theorem",
    title: "SAS congruence",
    statement:
      "If two triangles have two sides equal to two sides respectively, and have the angles contained by the equal straight lines equal, then they also have the base equal to the base, the triangle equals the triangle, and the remaining angles equal the remaining angles respectively, namely those opposite the equal sides.",
    aka: ["Side-Angle-Side", "SAS"],
    block: "triangle-congruence",
    dependencies: {
      propositions: [],
      postulates: [],
      commonNotions: [4],
      definitions: [],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Proof by superposition — place one triangle on the other. Points coincide because sides and included angle are equal.",
    notes:
      "THE fundamental congruence theorem. One of only two DAG roots (with I.1). Superposition is controversial — Euclid uses it only here, I.8, and III.24. Hilbert later made this an axiom. Consider animating one triangle sliding onto the other.",
  },
  {
    id: 5,
    type: "theorem",
    title: "Base angles of an isosceles triangle are equal",
    statement:
      "In isosceles triangles the angles at the base equal one another, and, if the equal straight lines are produced further, then the angles under the base equal one another.",
    aka: ["Pons Asinorum", "Bridge of Asses"],
    block: "triangle-congruence",
    dependencies: {
      propositions: [3, 4],
      postulates: [1, 2],
      commonNotions: [3],
      definitions: [20],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Extend both equal sides, take equal lengths on extensions, form two auxiliary triangles, apply SAS twice, subtract angles.",
    notes:
      "Called Pons Asinorum ('Bridge of Asses') because historically where weak students got stuck. Color-coding is critical here to track the auxiliary triangles.",
  },
  {
    id: 6,
    type: "theorem",
    title: "Converse: equal base angles imply isosceles",
    statement:
      "If in a triangle two angles equal one another, then the sides opposite the equal angles also equal one another.",
    block: "triangle-congruence",
    dependencies: {
      propositions: [3, 4],
      postulates: [1],
      commonNotions: [5],
      definitions: [],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Proof by contradiction. Assume sides unequal, cut off equal part, apply SAS — get part = whole, contradicting C.N.5.",
    notes:
      "First proof by contradiction (reductio ad absurdum) in the Elements.",
  },
  {
    id: 7,
    type: "theorem",
    title: "Uniqueness of triangle construction from a base",
    statement:
      "Given two straight lines constructed from the ends of a straight line and meeting in a point, there cannot be constructed from the ends of the same straight line, and on the same side of it, two other straight lines meeting in another point and equal to the former two respectively.",
    block: "triangle-congruence",
    dependencies: {
      propositions: [5],
      postulates: [1],
      commonNotions: [5],
      definitions: [],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Join the two candidate peaks, apply I.5 twice to get contradictory angle inequalities.",
    notes: "A lemma for I.8 (SSS). Proves triangle uniqueness given base and two side lengths.",
  },
  {
    id: 8,
    type: "theorem",
    title: "SSS congruence",
    statement:
      "If two triangles have the two sides equal to two sides respectively, and also have the base equal to the base, then they also have the angles equal which are contained by the equal straight lines.",
    aka: ["Side-Side-Side", "SSS"],
    block: "triangle-congruence",
    dependencies: {
      propositions: [7],
      postulates: [],
      commonNotions: [4],
      definitions: [],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Superposition + I.7. Place bases together; if the peaks didn't coincide, I.7 would be violated.",
  },

  // =========================================================================
  // Block 3: Fundamental Constructions (9-12)
  // =========================================================================
  {
    id: 9,
    type: "construction",
    title: "Bisect an angle",
    statement: "To bisect a given rectilinear angle.",
    block: "fundamental-constructions",
    dependencies: {
      propositions: [1, 3, 8],
      postulates: [1],
      commonNotions: [],
      definitions: [20],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Mark equal distances on both sides, construct equilateral triangle on the chord, join vertex to peak. SSS proves the half-angles equal.",
  },
  {
    id: 10,
    type: "construction",
    title: "Bisect a line segment",
    statement: "To bisect a given finite straight line.",
    block: "fundamental-constructions",
    dependencies: {
      propositions: [1, 4, 9],
      postulates: [],
      commonNotions: [],
      definitions: [20],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Construct equilateral triangle on the line, bisect the apex angle (I.9), the bisector hits the midpoint. SAS proves the halves equal.",
  },
  {
    id: 11,
    type: "construction",
    title: "Perpendicular from a point on a line",
    statement:
      "To draw a straight line at right angles to a given straight line from a given point on it.",
    block: "fundamental-constructions",
    dependencies: {
      propositions: [1, 3, 8],
      postulates: [1],
      commonNotions: [],
      definitions: [10, 20],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Mark equal distances on both sides of the point, construct equilateral triangle, join point to peak. SSS proves the adjacent angles equal, so they're right angles.",
  },
  {
    id: 12,
    type: "construction",
    title: "Drop a perpendicular from an external point",
    statement:
      "To draw a straight line perpendicular to a given infinite straight line from a given point not on it.",
    block: "fundamental-constructions",
    dependencies: {
      propositions: [8, 10],
      postulates: [1, 3],
      commonNotions: [],
      definitions: [10, 15],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Draw a circle from the external point that crosses the line in two places, bisect the chord (I.10), join. SSS proves the angles are right.",
    notes: "Requires the line to be 'infinite' (extendable enough for the circle to cross it twice).",
  },

  // =========================================================================
  // Block 4: Angle Arithmetic (13-15)
  // =========================================================================
  {
    id: 13,
    type: "theorem",
    title: "Supplementary angles sum to two right angles",
    statement:
      "If a straight line stands on a straight line, then it makes either two right angles or angles whose sum equals two right angles.",
    block: "angle-arithmetic",
    dependencies: {
      propositions: [11],
      postulates: [],
      commonNotions: [1, 2],
      definitions: [10],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "If the angles are equal, they're right angles. If not, construct a perpendicular and rearrange the angle sums using C.N.2.",
  },
  {
    id: 14,
    type: "theorem",
    title: "Converse: angles summing to 180 form a straight line",
    statement:
      "If with any straight line, and at a point on it, two straight lines not lying on the same side make the sum of the adjacent angles equal to two right angles, then the two straight lines are in a straight line with one another.",
    block: "angle-arithmetic",
    dependencies: {
      propositions: [13],
      postulates: [2, 4],
      commonNotions: [1, 3],
      definitions: [],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Proof by contradiction. Assume they're not collinear, extend one side, apply I.13, subtract to get equal = less.",
    notes: "First use of Postulate 4 (all right angles are equal).",
  },
  {
    id: 15,
    type: "theorem",
    title: "Vertical angles are equal",
    statement:
      "If two straight lines cut one another, then they make the vertical angles equal to one another.",
    block: "angle-arithmetic",
    dependencies: {
      propositions: [13],
      postulates: [4],
      commonNotions: [1, 3],
      definitions: [],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Each pair of supplementary angles sums to two right angles (I.13). Two such sums share an angle; subtract it to get the vertical angles equal.",
  },

  // =========================================================================
  // Block 5: Triangle Inequalities (16-21)
  // =========================================================================
  {
    id: 16,
    type: "theorem",
    title: "Exterior angle > either remote interior angle",
    statement:
      "In any triangle, if one of the sides is produced, then the exterior angle is greater than either of the interior and opposite angles.",
    block: "triangle-inequalities",
    dependencies: {
      propositions: [3, 4, 10, 15],
      postulates: [1, 2],
      commonNotions: [5],
      definitions: [],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Bisect one side, extend the median to double length, use SAS (I.4) to show equal angles, then the exterior angle contains one of them.",
    notes:
      "Last proposition that holds in elliptic geometry. Props 1-15 hold on a sphere; this one fails for large spherical triangles. Later strengthened to equality in I.32 (with the parallel postulate).",
  },
  {
    id: 17,
    type: "theorem",
    title: "Sum of two angles of a triangle < two right angles",
    statement:
      "In any triangle the sum of any two angles is less than two right angles.",
    block: "triangle-inequalities",
    dependencies: {
      propositions: [13, 16],
      postulates: [2],
      commonNotions: [],
      definitions: [],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Extend one side, apply exterior angle theorem (I.16), add the adjacent angle, compare to the supplementary sum (I.13).",
  },
  {
    id: 18,
    type: "theorem",
    title: "Greater side subtends greater angle",
    statement:
      "In any triangle the angle opposite the greater side is greater.",
    block: "triangle-inequalities",
    dependencies: {
      propositions: [3, 5, 16],
      postulates: [1],
      commonNotions: [],
      definitions: [],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Cut the longer side to match the shorter (I.3), creating an isosceles sub-triangle. Apply I.5 and I.16.",
  },
  {
    id: 19,
    type: "theorem",
    title: "Greater angle subtended by greater side",
    statement:
      "In any triangle the side opposite the greater angle is greater.",
    block: "triangle-inequalities",
    dependencies: {
      propositions: [5, 18],
      postulates: [],
      commonNotions: [],
      definitions: [],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Proof by contradiction using I.5 (if equal) and I.18 (if less). Converse of I.18.",
  },
  {
    id: 20,
    type: "theorem",
    title: "Triangle inequality",
    statement:
      "In any triangle the sum of any two sides is greater than the remaining one.",
    block: "triangle-inequalities",
    dependencies: {
      propositions: [3, 5, 19],
      postulates: [1, 2],
      commonNotions: [5],
      definitions: [],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Extend one side, mark equal to the adjacent side, forming an isosceles triangle. Apply I.5 then I.19.",
    notes:
      "The triangle inequality. The shortest path between two points is a straight line.",
  },
  {
    id: 21,
    type: "theorem",
    title: "Interior cevians: shorter sum, larger angle",
    statement:
      "If from the ends of one of the sides of a triangle two straight lines are constructed meeting within the triangle, then the sum of the straight lines so constructed is less than the sum of the remaining two sides of the triangle, but the constructed straight lines contain a greater angle.",
    block: "triangle-inequalities",
    dependencies: {
      propositions: [16, 20],
      postulates: [2],
      commonNotions: [],
      definitions: [],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Extend one cevian to the opposite side, apply triangle inequality (I.20) twice for lengths, exterior angle theorem (I.16) twice for angles.",
  },

  // =========================================================================
  // Block 6: Construction from Parts (22-23)
  // =========================================================================
  {
    id: 22,
    type: "construction",
    title: "Construct a triangle from three given line segments",
    statement:
      "To construct a triangle out of three straight lines which equal three given straight lines: thus it is necessary that the sum of any two of the straight lines should be greater than the remaining one.",
    block: "construction-from-parts",
    dependencies: {
      propositions: [3, 20],
      postulates: [1, 2, 3],
      commonNotions: [1],
      definitions: [16],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Lay out the three lengths along a line, draw two circles (using the outer two as radii from the inner endpoints), intersection gives the third vertex.",
    notes:
      "Generalizes I.1 (equilateral triangle). Triangle inequality (I.20) is the necessary condition. Same gap as I.1 — Euclid doesn't prove the circles intersect.",
  },
  {
    id: 23,
    type: "construction",
    title: "Copy an angle to a given point on a line",
    statement:
      "To construct a rectilinear angle equal to a given rectilinear angle on a given straight line and at a point on it.",
    block: "construction-from-parts",
    dependencies: {
      propositions: [8, 22],
      postulates: [1],
      commonNotions: [],
      definitions: [],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Sample two points on the given angle's sides, forming a triangle. Copy that triangle using I.22. SSS (I.8) proves the angles equal.",
    notes: "About 10 circles and 1 line in the general case.",
  },

  // =========================================================================
  // Block 7: More Congruence (24-26)
  // =========================================================================
  {
    id: 24,
    type: "theorem",
    title: "Hinge theorem (SAS inequality)",
    statement:
      "If two triangles have two sides equal to two sides respectively, but have one of the angles contained by the equal straight lines greater than the other, then they also have the base greater than the base.",
    block: "more-congruence",
    dependencies: {
      propositions: [3, 4, 5, 19, 23],
      postulates: [1],
      commonNotions: [],
      definitions: [],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Copy the smaller angle onto one side of the larger triangle (I.23), mark equal length (I.3), form isosceles sub-triangle, apply I.5 and I.19.",
  },
  {
    id: 25,
    type: "theorem",
    title: "Converse of the hinge theorem",
    statement:
      "If two triangles have two sides equal to two sides respectively, but have the base greater than the base, then they also have the one of the angles contained by the equal straight lines greater than the other.",
    block: "more-congruence",
    dependencies: {
      propositions: [4, 24],
      postulates: [],
      commonNotions: [],
      definitions: [],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Proof by contradiction using I.4 (if equal) and I.24 (if less).",
  },
  {
    id: 26,
    type: "theorem",
    title: "ASA and AAS congruence",
    statement:
      "If two triangles have two angles equal to two angles respectively, and one side equal to one side, namely, either the side adjoining the equal angles, or that opposite one of the equal angles, then the remaining sides equal the remaining sides and the remaining angle equals the remaining angle.",
    aka: ["ASA", "AAS"],
    block: "more-congruence",
    dependencies: {
      propositions: [3, 4, 16],
      postulates: [1],
      commonNotions: [1],
      definitions: [],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Two cases (ASA and AAS), each by contradiction. Assume a side is unequal, cut to equal length, apply SAS (I.4), derive part = whole or exterior angle violation (I.16).",
    notes:
      "The last congruence theorem. Together SAS (I.4), SSS (I.8), and ASA/AAS (I.26) cover the standard cases.",
  },

  // =========================================================================
  // Block 8: Parallel Lines — THE WATERSHED (27-32)
  // =========================================================================
  {
    id: 27,
    type: "theorem",
    title: "Alternate angles equal => lines are parallel",
    statement:
      "If a straight line falling on two straight lines makes the alternate angles equal to one another, then the straight lines are parallel to one another.",
    block: "parallel-lines",
    dependencies: {
      propositions: [16],
      postulates: [],
      commonNotions: [],
      definitions: [23],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Proof by contradiction using exterior angle theorem (I.16). If the lines met, one of the alternate angles would be an exterior angle of the resulting triangle, so greater than the other — contradiction.",
    notes: "Does NOT require the parallel postulate. Holds in absolute geometry.",
  },
  {
    id: 28,
    type: "theorem",
    title: "Two more conditions for parallel lines",
    statement:
      "If a straight line falling on two straight lines makes the exterior angle equal to the interior and opposite angle on the same side, or the sum of the interior angles on the same side equal to two right angles, then the straight lines are parallel.",
    block: "parallel-lines",
    dependencies: {
      propositions: [13, 15, 27],
      postulates: [4],
      commonNotions: [1, 3],
      definitions: [],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Reduce both cases to I.27 using vertical angles (I.15) and supplementary angles (I.13).",
  },
  {
    id: 29,
    type: "theorem",
    title: "Parallel lines => alternate angles equal",
    statement:
      "A straight line falling on parallel straight lines makes the alternate angles equal to one another, the exterior angle equal to the interior and opposite angle, and the sum of the interior angles on the same side equal to two right angles.",
    aka: ["Converse of I.27/I.28"],
    block: "parallel-lines",
    dependencies: {
      propositions: [13, 15],
      postulates: [5],
      commonNotions: [1, 2],
      definitions: [],
    },
    requiresParallelPostulate: true,
    proofMethod:
      "Proof by contradiction. If alternate angles unequal, interior angle sum < two right angles, so by Post.5 the lines meet — contradicting parallelism.",
    notes:
      "FIRST USE OF THE PARALLEL POSTULATE. The watershed of Book I. Everything before this holds in absolute geometry; everything after is Euclidean only. Does NOT hold in hyperbolic geometry.",
  },
  {
    id: 30,
    type: "theorem",
    title: "Transitivity of parallelism",
    statement:
      "Straight lines parallel to the same straight line are also parallel to one another.",
    block: "parallel-lines",
    dependencies: {
      propositions: [29],
      postulates: [],
      commonNotions: [1],
      definitions: [],
    },
    requiresParallelPostulate: true,
    proofMethod:
      "Drop a transversal, apply I.29 twice to show alternate angles equal, conclude parallel by I.27.",
    notes:
      "Logically equivalent to the parallel postulate. Could have been chosen as the postulate instead. Also equivalent to Playfair's axiom.",
  },
  {
    id: 31,
    type: "construction",
    title: "Construct a parallel line through a given point",
    statement:
      "To draw a straight line through a given point parallel to a given straight line.",
    block: "parallel-lines",
    dependencies: {
      propositions: [23, 27],
      postulates: [1, 2],
      commonNotions: [],
      definitions: [],
    },
    requiresParallelPostulate: false,
    proofMethod:
      "Join the point to any point on the line, copy the angle using I.23, apply I.27 to confirm parallelism.",
    notes:
      "The construction itself does NOT use Post.5. But the UNIQUENESS of this parallel (there's only one) follows from Post.5.",
  },
  {
    id: 32,
    type: "theorem",
    title: "Angle sum of a triangle = two right angles",
    statement:
      "In any triangle, if one of the sides is produced, then the exterior angle equals the sum of the two interior and opposite angles, and the sum of the three interior angles of the triangle equals two right angles.",
    aka: ["Triangle angle sum theorem"],
    block: "parallel-lines",
    dependencies: {
      propositions: [13, 29, 31],
      postulates: [],
      commonNotions: [1, 2],
      definitions: [],
    },
    requiresParallelPostulate: true,
    proofMethod:
      "Draw a parallel to one side through the opposite vertex (I.31). Apply I.29 to identify the angles. The three angles of the triangle reconstruct the straight angle.",
    notes:
      "One of the most important results. Strengthens I.16 to equality. In hyperbolic geometry, angle sum < 180; in elliptic, > 180. Corollary: interior angle sum of convex n-gon = (2n-4) right angles.",
  },

  // =========================================================================
  // Block 9: Parallelogram Basics (33-34)
  // =========================================================================
  {
    id: 33,
    type: "theorem",
    title: "Lines joining ends of equal parallel segments are equal and parallel",
    statement:
      "Straight lines which join the ends of equal and parallel straight lines in the same directions are themselves equal and parallel.",
    block: "parallelogram-basics",
    dependencies: {
      propositions: [4, 27, 29],
      postulates: [1],
      commonNotions: [],
      definitions: [],
    },
    requiresParallelPostulate: true,
    proofMethod:
      "Join diagonally, apply I.29 for equal alternate angles, then SAS (I.4) for congruent triangles, then I.27 for parallelism.",
  },
  {
    id: 34,
    type: "theorem",
    title: "Properties of parallelograms",
    statement:
      "In parallelogrammic areas the opposite sides and angles equal one another, and the diameter bisects the areas.",
    block: "parallelogram-basics",
    dependencies: {
      propositions: [4, 26, 29],
      postulates: [],
      commonNotions: [2],
      definitions: [],
    },
    requiresParallelPostulate: true,
    proofMethod:
      "Draw a diagonal, apply I.29 for alternate angles, then ASA (I.26) for congruent triangles. Opposite sides/angles follow. Diagonal bisects by SAS (I.4).",
    notes:
      "THE fundamental parallelogram theorem. Used constantly from here on. Begins the study of areas.",
  },

  // =========================================================================
  // Block 10: Area Theory (35-41, 43)
  // =========================================================================
  {
    id: 35,
    type: "theorem",
    title: "Parallelograms on the same base in the same parallels are equal",
    statement:
      "Parallelograms which are on the same base and in the same parallels equal one another.",
    block: "area-theory",
    dependencies: {
      propositions: [4, 29, 34],
      postulates: [],
      commonNotions: [1, 2, 3],
      definitions: [],
    },
    requiresParallelPostulate: true,
    proofMethod:
      "Cut-and-paste: show congruent triangles (SAS), subtract common region, add common triangle. Equal areas without ever defining 'area.'",
    notes:
      "Euclid's theory of area in action — adding and subtracting congruent pieces.",
  },
  {
    id: 36,
    type: "theorem",
    title: "Parallelograms on equal bases in the same parallels are equal",
    statement:
      "Parallelograms which are on equal bases and in the same parallels equal one another.",
    block: "area-theory",
    dependencies: {
      propositions: [33, 34, 35],
      postulates: [1],
      commonNotions: [1],
      definitions: [],
    },
    requiresParallelPostulate: true,
    proofMethod:
      "Connect the bases to form a third parallelogram (I.33), apply I.35 twice.",
  },
  {
    id: 37,
    type: "theorem",
    title: "Triangles on the same base in the same parallels are equal",
    statement:
      "Triangles which are on the same base and in the same parallels equal one another.",
    block: "area-theory",
    dependencies: {
      propositions: [31, 34, 35],
      postulates: [2],
      commonNotions: [],
      definitions: [],
    },
    requiresParallelPostulate: true,
    proofMethod:
      "Complete each triangle to a parallelogram (I.31), apply I.35, each triangle is half its parallelogram (I.34).",
  },
  {
    id: 38,
    type: "theorem",
    title: "Triangles on equal bases in the same parallels are equal",
    statement:
      "Triangles which are on equal bases and in the same parallels equal one another.",
    block: "area-theory",
    dependencies: {
      propositions: [31, 34, 36],
      postulates: [2],
      commonNotions: [],
      definitions: [],
    },
    requiresParallelPostulate: true,
    proofMethod:
      "Complete each triangle to a parallelogram (I.31), apply I.36, each triangle is half its parallelogram (I.34).",
  },
  {
    id: 39,
    type: "theorem",
    title: "Converse: equal triangles on same base are in same parallels",
    statement:
      "Equal triangles which are on the same base and on the same side are also in the same parallels.",
    block: "area-theory",
    dependencies: {
      propositions: [31, 37],
      postulates: [1],
      commonNotions: [1],
      definitions: [],
    },
    requiresParallelPostulate: true,
    proofMethod:
      "Proof by contradiction using I.37.",
  },
  {
    id: 40,
    type: "theorem",
    title: "Converse: equal triangles on equal bases are in same parallels",
    statement:
      "Equal triangles which are on equal bases and on the same side are also in the same parallels.",
    block: "area-theory",
    dependencies: {
      propositions: [31, 38],
      postulates: [1],
      commonNotions: [1],
      definitions: [],
    },
    requiresParallelPostulate: true,
    proofMethod:
      "Proof by contradiction using I.38.",
    notes: "Probably an interpolation — not original Euclid (shown by an early papyrus fragment).",
  },
  {
    id: 41,
    type: "theorem",
    title: "Parallelogram is double the triangle on the same base",
    statement:
      "If a parallelogram has the same base with a triangle and is in the same parallels, then the parallelogram is double the triangle.",
    block: "area-theory",
    dependencies: {
      propositions: [34, 37],
      postulates: [1],
      commonNotions: [],
      definitions: [],
    },
    requiresParallelPostulate: true,
    proofMethod:
      "The diagonal splits the parallelogram into two triangles equal to the given triangle (I.37, I.34).",
  },
  {
    id: 43,
    type: "theorem",
    title: "Complements about a diagonal are equal",
    statement:
      "In any parallelogram the complements of the parallelograms about the diameter equal one another.",
    block: "area-theory",
    dependencies: {
      propositions: [34],
      postulates: [],
      commonNotions: [2, 3],
      definitions: [],
    },
    requiresParallelPostulate: true,
    proofMethod:
      "The diagonal bisects the whole and each sub-parallelogram (I.34). Subtract the sub-triangles from the whole triangles.",
    notes:
      "Key lemma for reshaping parallelograms. The two 'complement' parallelograms have equal area despite different shapes.",
  },

  // =========================================================================
  // Block 11: Application of Areas (42, 44-46)
  // =========================================================================
  {
    id: 42,
    type: "construction",
    title: "Construct parallelogram equal to a triangle in a given angle",
    statement:
      "To construct a parallelogram equal to a given triangle in a given rectilinear angle.",
    block: "application-of-areas",
    dependencies: {
      propositions: [10, 23, 31, 38, 41],
      postulates: [1],
      commonNotions: [1],
      definitions: [],
    },
    requiresParallelPostulate: true,
    proofMethod:
      "Bisect the base (I.10), construct the angle (I.23), draw parallel (I.31). The half-triangle and half-parallelogram have equal area (I.38, I.41).",
    notes: "First 'application of area' construction. Any triangle -> parallelogram with any desired angle.",
  },
  {
    id: 44,
    type: "construction",
    title: "Apply a parallelogram to a given line equal to a given triangle",
    statement:
      "To a given straight line in a given rectilinear angle, to apply a parallelogram equal to a given triangle.",
    block: "application-of-areas",
    dependencies: {
      propositions: [15, 29, 31, 42, 43],
      postulates: [1, 2, 5],
      commonNotions: [1],
      definitions: [],
    },
    requiresParallelPostulate: true,
    proofMethod:
      "First build any parallelogram with the right area and angle (I.42), then use complements (I.43) to reshape it to the desired side length.",
    notes: "Uses Post.5 directly (to guarantee a needed intersection).",
  },
  {
    id: 45,
    type: "construction",
    title: "Construct parallelogram equal to any rectilinear figure",
    statement:
      "To construct a parallelogram equal to a given rectilinear figure in a given rectilinear angle.",
    block: "application-of-areas",
    dependencies: {
      propositions: [14, 29, 30, 33, 34, 42, 44],
      postulates: [1],
      commonNotions: [1, 2],
      definitions: [],
    },
    requiresParallelPostulate: true,
    proofMethod:
      "Triangulate the figure, apply I.42 and I.44 successively to build up the parallelogram piece by piece, verify collinearity with I.14.",
    notes:
      "The culmination of area theory. Any polygon -> parallelogram with any desired angle and side length. Answers 'what is the area of this figure?'",
  },
  {
    id: 46,
    type: "construction",
    title: "Construct a square on a given line",
    statement: "To describe a square on a given straight line.",
    block: "application-of-areas",
    dependencies: {
      propositions: [3, 11, 29, 31, 34],
      postulates: [4],
      commonNotions: [],
      definitions: [22],
    },
    requiresParallelPostulate: true,
    proofMethod:
      "Draw perpendicular (I.11), cut to equal length (I.3), complete parallelogram (I.31), verify right angles (I.29, Post.4).",
    notes: "The second regular polygon (first was equilateral triangle in I.1).",
  },

  // =========================================================================
  // Block 12: The Grand Finale (47-48)
  // =========================================================================
  {
    id: 47,
    type: "theorem",
    title: "The Pythagorean Theorem",
    statement:
      "In right-angled triangles the square on the side opposite the right angle equals the sum of the squares on the sides containing the right angle.",
    aka: ["Pythagorean Theorem", "Pythagoras' Theorem"],
    block: "the-finale",
    dependencies: {
      propositions: [4, 14, 31, 41, 46],
      postulates: [1, 4],
      commonNotions: [2],
      definitions: [22],
    },
    requiresParallelPostulate: true,
    proofMethod:
      "Construct squares on all three sides (I.46). Drop perpendicular from right-angle vertex to hypotenuse, extend across the hypotenuse's square. This divides the big square into two rectangles. Prove each rectangle equals one leg-square using SAS (I.4) and the double-triangle theorem (I.41).",
    notes:
      "The most famous theorem in mathematics. Known to Old Babylonians ~1900 BCE. This specific proof is Euclid's own, designed to work in Book I without proportion/similarity theory (Books V-VI). Generalized in VI.31 to similar figures. Extended to non-right triangles as the law of cosines in II.12-13.",
  },
  {
    id: 48,
    type: "theorem",
    title: "Converse of the Pythagorean Theorem",
    statement:
      "If in a triangle the square on one of the sides equals the sum of the squares on the remaining two sides of the triangle, then the angle contained by the remaining two sides of the triangle is right.",
    block: "the-finale",
    dependencies: {
      propositions: [3, 8, 11, 47],
      postulates: [1],
      commonNotions: [1, 2],
      definitions: [],
    },
    requiresParallelPostulate: true,
    proofMethod:
      "Construct a right triangle with the same two legs (I.11, I.3). Apply I.47 to compute its hypotenuse. The hypotenuses are equal, so SSS (I.8) gives equal angles.",
    notes: "A clean converse. Book I ends here — the journey from 'a point is that which has no part' to the Pythagorean theorem is complete.",
  },
];

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

/** Get a proposition by its number (1-48). */
export function getProposition(id: number): Proposition | undefined {
  return propositions.find((p) => p.id === id);
}

/** Get all direct prerequisite propositions for a given proposition. */
export function getPrerequisites(id: number): number[] {
  return getProposition(id)?.dependencies.propositions ?? [];
}

/**
 * Get ALL transitive prerequisites for a proposition (the full ancestor set).
 * Returns them in topological order (earliest first).
 */
export function getAllPrerequisites(id: number): number[] {
  const visited = new Set<number>();
  const order: number[] = [];

  function visit(n: number) {
    if (visited.has(n)) return;
    visited.add(n);
    for (const dep of getPrerequisites(n)) {
      visit(dep);
    }
    order.push(n);
  }

  for (const dep of getPrerequisites(id)) {
    visit(dep);
  }

  return order;
}

/**
 * Get all propositions that directly depend on a given proposition.
 * (Reverse edges in the DAG.)
 */
export function getDependents(id: number): number[] {
  return propositions
    .filter((p) => p.dependencies.propositions.includes(id))
    .map((p) => p.id);
}

/** Get all propositions in a thematic block. */
export function getBlock(block: ThematicBlock): Proposition[] {
  return propositions.filter((p) => p.block === block);
}

/** Get all construction propositions. */
export function getConstructions(): Proposition[] {
  return propositions.filter((p) => p.type === "construction");
}

/** Get all theorem propositions. */
export function getTheorems(): Proposition[] {
  return propositions.filter((p) => p.type === "theorem");
}

/**
 * Propositions that hold in absolute geometry (no parallel postulate).
 * These are valid in both Euclidean and hyperbolic geometry.
 */
export function getAbsoluteGeometryPropositions(): Proposition[] {
  return propositions.filter((p) => !p.requiresParallelPostulate);
}
