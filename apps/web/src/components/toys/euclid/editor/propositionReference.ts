import type { PropositionRef } from '../types'

// ── Thematic blocks ──────────────────────────────────────────────────

export const PROPOSITION_BLOCKS: { name: string; propIds: number[] }[] = [
  { name: 'Basic Constructions', propIds: [1, 2, 3] },
  { name: 'Triangle Congruence', propIds: [4, 5, 6, 7, 8] },
  { name: 'Fundamental Constructions', propIds: [9, 10, 11, 12] },
  { name: 'Angle Arithmetic', propIds: [13, 14, 15] },
  { name: 'Triangle Inequalities', propIds: [16, 17, 18, 19, 20, 21] },
  { name: 'Construction from Parts', propIds: [22, 23] },
  { name: 'More Congruence', propIds: [24, 25, 26] },
  { name: 'Parallel Lines', propIds: [27, 28, 29, 30, 31, 32] },
  { name: 'Parallelogram Basics', propIds: [33, 34] },
  { name: 'Area Theory', propIds: [35, 36, 37, 38, 39, 40, 41] },
  { name: 'Application of Areas', propIds: [42, 43, 44, 45] },
  { name: 'The Grand Finale', propIds: [46, 47, 48] },
]

// ── All 48 propositions ──────────────────────────────────────────────

export const PROPOSITION_REFS: Record<number, PropositionRef> = {
  1: {
    id: 1,
    type: 'C',
    title: 'Construct an equilateral triangle on a given line',
    statement:
      'To construct an equilateral triangle on a given finite straight line.',
    method:
      'Draw two circles (centered at each endpoint, radius = the line). Their intersection gives the third vertex.',
    deps: ['Post.1', 'Post.3', 'Def.15', 'Def.20', 'C.N.1'],
    note: 'The very first proposition! Euclid does not prove the two circles intersect \u2014 a gap later filled by continuity axioms. This is THE iconic compass-and-straightedge construction.',
    block: 'Basic Constructions',
  },
  2: {
    id: 2,
    type: 'C',
    title: 'Place a line equal to a given line at a given point',
    statement:
      'To place a straight line equal to a given straight line with one end at a given point.',
    method:
      'Construct equilateral triangle on the join, extend sides, use two circles to transfer the distance.',
    deps: ['Post.1', 'Post.2', 'Post.3', 'Def.15', 'C.N.1', 'C.N.3', 'I.1'],
    note: 'This is how you transfer a distance with a collapsing compass. Requires 5 circles and 3 lines.',
    block: 'Basic Constructions',
  },
  3: {
    id: 3,
    type: 'C',
    title: 'Cut off from the greater a line equal to the less',
    statement:
      'To cut off from the greater of two given unequal straight lines a straight line equal to the less.',
    method:
      'Use I.2 to transfer the shorter line to the endpoint of the longer, then draw a circle.',
    deps: ['Post.3', 'Def.15', 'C.N.1', 'I.2'],
    note: 'After this, Euclid can freely copy any line segment to any location.',
    block: 'Basic Constructions',
  },
  4: {
    id: 4,
    type: 'T',
    title: 'SAS (Side-Angle-Side)',
    statement:
      'If two triangles have two sides equal to two sides respectively, and have the angles contained by the equal straight lines equal, then they also have the base equal to the base, the triangle equals the triangle, and the remaining angles equal the remaining angles respectively.',
    method: 'Proof by superposition \u2014 place one triangle on the other.',
    deps: ['C.N.4'],
    note: 'THE fundamental congruence theorem. The method of superposition is controversial \u2014 Euclid uses it only here, in I.8, and III.24. Hilbert later made this an axiom. Proves equal sides, equal angles, AND equal areas.',
    block: 'Triangle Congruence',
  },
  5: {
    id: 5,
    type: 'T',
    title: 'Pons Asinorum ("Bridge of Asses")',
    statement:
      'In isosceles triangles the angles at the base equal one another, and if the equal straight lines are produced further, then the angles under the base equal one another.',
    method:
      'Extend both equal sides, take equal lengths on extensions, form two auxiliary triangles, apply SAS twice.',
    deps: ['Def.20', 'Post.1', 'Post.2', 'I.3', 'I.4', 'C.N.3'],
    note: 'Called Pons Asinorum because this is where weak students allegedly got stuck. The proof is elegant but tricky \u2014 Pappus later gave a simpler proof by comparing triangle ABC to its mirror ACB using SAS.',
    block: 'Triangle Congruence',
  },
  6: {
    id: 6,
    type: 'T',
    title: 'Converse of Pons Asinorum',
    statement:
      'If in a triangle two angles equal one another, then the sides opposite the equal angles also equal one another.',
    method:
      'Proof by contradiction. Assume sides unequal, cut off equal part, apply SAS to get part = whole, contradicting C.N.5.',
    deps: ['Post.1', 'I.3', 'I.4', 'C.N.5'],
    note: 'First proof by contradiction (reductio ad absurdum) in the Elements.',
    block: 'Triangle Congruence',
  },
  7: {
    id: 7,
    type: 'T',
    title: 'Uniqueness of triangle construction',
    statement:
      'Given two straight lines constructed from the ends of a straight line and meeting in a point, there cannot be constructed from the ends of the same straight line, and on the same side of it, two other straight lines meeting in another point and equal to the former two respectively.',
    method:
      'Join the two candidate peaks, apply I.5 twice to get contradictory angle inequalities.',
    deps: ['Post.1', 'I.5', 'C.N.5'],
    note: 'A lemma for I.8. Says: if you fix a base and two side lengths, there\'s only one triangle (on each side).',
    block: 'Triangle Congruence',
  },
  8: {
    id: 8,
    type: 'T',
    title: 'SSS (Side-Side-Side)',
    statement:
      'If two triangles have the two sides equal to two sides respectively, and also have the base equal to the base, then they also have the angles equal which are contained by the equal straight lines.',
    method:
      'Superposition + I.7. Place bases together; if the peaks didn\'t coincide, I.7 would be violated.',
    deps: ['I.7', 'C.N.4'],
    note: 'The second congruence theorem. Combined with SAS, gives full congruence from three sides.',
    block: 'Triangle Congruence',
  },
  9: {
    id: 9,
    type: 'C',
    title: 'Bisect an angle',
    statement: 'To bisect a given rectilinear angle.',
    method:
      'Mark equal distances on both sides of the angle, construct equilateral triangle on the resulting line, join vertex to peak.',
    deps: ['I.1', 'I.3', 'I.8', 'Def.20', 'Post.1'],
    note: 'Uses SSS (I.8) to prove the two half-angles are equal.',
    block: 'Fundamental Constructions',
  },
  10: {
    id: 10,
    type: 'C',
    title: 'Bisect a line segment',
    statement: 'To bisect a given finite straight line.',
    method:
      'Construct equilateral triangle on the line, bisect the apex angle, the bisector hits the midpoint.',
    deps: ['I.1', 'I.4', 'I.9', 'Def.20'],
    note: 'Uses I.9 (bisect angle) which uses I.1 (equilateral triangle). A beautiful chain.',
    block: 'Fundamental Constructions',
  },
  11: {
    id: 11,
    type: 'C',
    title: 'Perpendicular from a point ON a line',
    statement:
      'To draw a straight line at right angles to a given straight line from a given point on it.',
    method:
      'Mark equal distances on both sides of the point, construct equilateral triangle, join point to peak.',
    deps: ['I.1', 'I.3', 'I.8', 'Def.10', 'Def.20', 'Post.1'],
    note: 'Creates a perpendicular going "up" from a point that\'s already on the line.',
    block: 'Fundamental Constructions',
  },
  12: {
    id: 12,
    type: 'C',
    title: 'Perpendicular from a point NOT on a line (Drop a perpendicular)',
    statement:
      'To draw a straight line perpendicular to a given infinite straight line from a given point not on it.',
    method:
      'Draw a circle from the external point that crosses the line in two places, bisect the resulting chord, join.',
    deps: ['I.8', 'I.10', 'Def.10', 'Def.15', 'Post.1', 'Post.3'],
    note: 'Requires the line to be "infinite" (extendable enough). This is the fundamental "drop a perpendicular" construction.',
    block: 'Fundamental Constructions',
  },
  13: {
    id: 13,
    type: 'T',
    title: 'Supplementary angles sum to two right angles',
    statement:
      'If a straight line stands on a straight line, then it makes either two right angles or angles whose sum equals two right angles.',
    method: '',
    deps: ['Def.10', 'I.11', 'C.N.1', 'C.N.2'],
    note: 'Foundation of angle arithmetic. First proposition to show how angle sums work.',
    block: 'Angle Arithmetic',
  },
  14: {
    id: 14,
    type: 'T',
    title: 'Converse: angles summing to two right angles form a straight line',
    statement:
      'If with any straight line, and at a point on it, two straight lines not lying on the same side make the sum of the adjacent angles equal to two right angles, then the two straight lines are in a straight line with one another.',
    method: '',
    deps: ['Post.2', 'Post.4', 'I.13', 'C.N.1', 'C.N.3'],
    note: 'Converse of I.13. First use of Post.4 (all right angles are equal).',
    block: 'Angle Arithmetic',
  },
  15: {
    id: 15,
    type: 'T',
    title: 'Vertical angles are equal',
    statement:
      'If two straight lines cut one another, then they make the vertical angles equal to one another.',
    method: '',
    deps: ['I.13', 'Post.4', 'C.N.1', 'C.N.3'],
    note: 'Vertical (opposite) angles are equal. Used frequently throughout.',
    block: 'Angle Arithmetic',
  },
  16: {
    id: 16,
    type: 'T',
    title: 'Exterior angle > either remote interior angle',
    statement:
      'In any triangle, if one of the sides is produced, then the exterior angle is greater than either of the interior and opposite angles.',
    method:
      'Bisect one side, extend the median to double length, use SAS to create equal angle, then inequality.',
    deps: ['I.3', 'I.4', 'I.10', 'I.15', 'Post.1', 'Post.2', 'C.N.5'],
    note: 'CRITICAL: This is the last proposition that holds in elliptic geometry. Props 1-15 hold in elliptic geometry; this one does not (on a sphere, it can fail for large triangles). Later strengthened to equality in I.32 (with the parallel postulate).',
    block: 'Triangle Inequalities',
  },
  17: {
    id: 17,
    type: 'T',
    title: 'Sum of two angles of a triangle < two right angles',
    statement:
      'In any triangle the sum of any two angles is less than two right angles.',
    method: '',
    deps: ['Post.2', 'I.13', 'I.16'],
    note: 'Consequence of the exterior angle theorem. Strengthened to "sum of all three = two right angles" in I.32.',
    block: 'Triangle Inequalities',
  },
  18: {
    id: 18,
    type: 'T',
    title: 'Greater side subtends greater angle',
    statement:
      'In any triangle the angle opposite the greater side is greater.',
    method: '',
    deps: ['I.3', 'I.5', 'I.16', 'Post.1'],
    note: '',
    block: 'Triangle Inequalities',
  },
  19: {
    id: 19,
    type: 'T',
    title: 'Greater angle subtended by greater side',
    statement:
      'In any triangle the side opposite the greater angle is greater.',
    method: 'Proof by contradiction using I.5 and I.18.',
    deps: ['I.5', 'I.18'],
    note: 'Converse of I.18. Together they say: side ordering = angle ordering.',
    block: 'Triangle Inequalities',
  },
  20: {
    id: 20,
    type: 'T',
    title: 'Triangle inequality',
    statement:
      'In any triangle the sum of any two sides is greater than the remaining one.',
    method:
      'Extend one side, use isosceles triangle theorem and I.19.',
    deps: ['Post.1', 'Post.2', 'I.3', 'I.5', 'I.19', 'C.N.5'],
    note: 'The triangle inequality. Part of the statement "the shortest path between two points is a straight line."',
    block: 'Triangle Inequalities',
  },
  21: {
    id: 21,
    type: 'T',
    title: 'Interior cevians: shorter sum, larger angle',
    statement:
      'If from the ends of one side of a triangle two straight lines are constructed meeting within the triangle, then their sum is less than the sum of the remaining two sides, but they contain a greater angle.',
    method: '',
    deps: ['Post.2', 'I.16', 'I.20'],
    note: '',
    block: 'Triangle Inequalities',
  },
  22: {
    id: 22,
    type: 'C',
    title: 'Construct a triangle from three given line segments',
    statement:
      'To construct a triangle out of three straight lines which equal three given straight lines: thus it is necessary that the sum of any two of the straight lines should be greater than the remaining one.',
    method:
      'Lay out the three lengths along a line, draw two circles, their intersection is the third vertex.',
    deps: ['Post.1', 'Post.2', 'Post.3', 'I.3', 'I.20', 'Def.16', 'C.N.1'],
    note: 'Generalizes I.1 (equilateral triangle). The triangle inequality condition (I.20) is necessary. Euclid does not prove sufficiency (that the circles actually intersect) \u2014 another gap.',
    block: 'Construction from Parts',
  },
  23: {
    id: 23,
    type: 'C',
    title: 'Copy an angle to a given point on a line',
    statement:
      'To construct a rectilinear angle equal to a given rectilinear angle on a given straight line and at a point on it.',
    method:
      'Take two points on the sides of the given angle, join them to form a triangle, copy that triangle using I.22, then use SSS (I.8) to conclude equal angles.',
    deps: ['Post.1', 'I.8', 'I.22'],
    note: 'The angle-transfer construction. Requires about 10 circles and 1 line in the general case.',
    block: 'Construction from Parts',
  },
  24: {
    id: 24,
    type: 'T',
    title: 'Hinge theorem (SAS inequality)',
    statement:
      'If two triangles have two sides equal to two sides respectively, but have one of the angles contained by the equal straight lines greater than the other, then they also have the base greater than the base.',
    method: '',
    deps: ['Post.1', 'I.3', 'I.4', 'I.5', 'I.19', 'I.23'],
    note: '',
    block: 'More Congruence',
  },
  25: {
    id: 25,
    type: 'T',
    title: 'Converse of hinge theorem',
    statement:
      'If two triangles have two sides equal to two sides respectively, but have the base greater than the base, then they also have the one of the angles contained by the equal straight lines greater than the other.',
    method: 'Proof by contradiction using I.4 and I.24.',
    deps: ['I.4', 'I.24'],
    note: '',
    block: 'More Congruence',
  },
  26: {
    id: 26,
    type: 'T',
    title: 'ASA and AAS congruence',
    statement:
      'If two triangles have two angles equal to two angles respectively, and one side equal to one side, namely, either the side adjoining the equal angles (ASA), or that opposite one of the equal angles (AAS), then the remaining sides and angle are equal.',
    method: 'Proof by contradiction for both cases.',
    deps: ['I.3', 'I.4', 'I.16', 'Post.1', 'C.N.1'],
    note: 'The last of Euclid\'s congruence theorems. Together with I.4 (SAS) and I.8 (SSS), these cover the standard cases.',
    block: 'More Congruence',
  },
  27: {
    id: 27,
    type: 'T',
    title: 'Alternate angles equal => lines are parallel',
    statement:
      'If a straight line falling on two straight lines makes the alternate angles equal to one another, then the straight lines are parallel to one another.',
    method:
      'Proof by contradiction using the exterior angle theorem (I.16).',
    deps: ['I.16', 'Def.23'],
    note: 'Does NOT require the parallel postulate. Holds in absolute geometry.',
    block: 'Parallel Lines',
  },
  28: {
    id: 28,
    type: 'T',
    title: 'Two more conditions for parallel lines',
    statement:
      'If a straight line falling on two straight lines makes (a) the exterior angle equal to the interior and opposite angle on the same side, or (b) the sum of the interior angles on the same side equal to two right angles, then the straight lines are parallel.',
    method: '',
    deps: ['I.13', 'I.15', 'I.27', 'Post.4', 'C.N.1', 'C.N.3'],
    note: 'Minor variants of I.27. Still does not require Post.5.',
    block: 'Parallel Lines',
  },
  29: {
    id: 29,
    type: 'T',
    title: 'THE CONVERSE: parallel lines => alternate angles equal (USES POST.5)',
    statement:
      'A straight line falling on parallel straight lines makes the alternate angles equal to one another, the exterior angle equal to the interior and opposite angle, and the sum of the interior angles on the same side equal to two right angles.',
    method:
      'Proof by contradiction \u2014 if angles weren\'t equal, the interior angle sum would be less than two right angles, so by Post.5 the lines would meet, contradicting their being parallel.',
    deps: ['I.13', 'I.15', 'Post.5', 'C.N.1', 'C.N.2'],
    note: 'FIRST USE OF THE PARALLEL POSTULATE. This is the converse of I.27/I.28. Does NOT hold in hyperbolic geometry. This is the watershed \u2014 everything from here on is Euclidean geometry specifically.',
    block: 'Parallel Lines',
  },
  30: {
    id: 30,
    type: 'T',
    title: 'Transitivity of parallelism',
    statement:
      'Straight lines parallel to the same straight line are also parallel to one another.',
    method: '',
    deps: ['I.29', 'C.N.1'],
    note: 'Equivalent to the parallel postulate (and to Playfair\'s axiom). Could have been chosen as the postulate instead of Post.5.',
    block: 'Parallel Lines',
  },
  31: {
    id: 31,
    type: 'C',
    title: 'Construct a line parallel to a given line through a given point',
    statement:
      'To draw a straight line through a given point parallel to a given straight line.',
    method:
      'Pick any point on the given line, join to the given point, copy the angle at the join point using I.23, apply I.27.',
    deps: ['I.23', 'I.27', 'Post.1', 'Post.2'],
    note: 'The parallel line construction. Does not itself require Post.5 (uses I.27, not I.29). But the UNIQUENESS of this parallel follows from Post.5.',
    block: 'Parallel Lines',
  },
  32: {
    id: 32,
    type: 'T',
    title: 'ANGLE SUM OF A TRIANGLE = TWO RIGHT ANGLES',
    statement:
      'In any triangle, if one of the sides is produced, then the exterior angle equals the sum of the two interior and opposite angles, and the sum of the three interior angles of the triangle equals two right angles.',
    method:
      'Draw a parallel to one side through the opposite vertex, apply I.29.',
    deps: ['I.13', 'I.29', 'I.31', 'C.N.1', 'C.N.2'],
    note: 'One of the most important results in Book I. Strengthens I.16 (exterior angle > remote interior) to equality. In hyperbolic geometry, the angle sum is < 180; in elliptic, > 180.',
    block: 'Parallel Lines',
  },
  33: {
    id: 33,
    type: 'T',
    title: 'Lines joining ends of equal parallel lines are equal and parallel',
    statement:
      'Straight lines which join the ends of equal and parallel straight lines in the same directions are themselves equal and parallel.',
    method: '',
    deps: ['I.4', 'I.27', 'I.29', 'Post.1'],
    note: 'Establishes that parallelograms exist \u2014 if you have one pair of equal parallel sides, the other pair is also equal and parallel.',
    block: 'Parallelogram Basics',
  },
  34: {
    id: 34,
    type: 'T',
    title: 'Properties of parallelograms',
    statement:
      'In parallelogrammic areas the opposite sides and angles equal one another, and the diameter (diagonal) bisects the areas.',
    method: '',
    deps: ['I.4', 'I.26', 'I.29', 'C.N.2'],
    note: 'THE fundamental parallelogram theorem. Proves: (a) opposite sides equal, (b) opposite angles equal, (c) diagonal splits into two equal triangles. Used constantly from here on.',
    block: 'Parallelogram Basics',
  },
  35: {
    id: 35,
    type: 'T',
    title: 'Parallelograms on the same base in the same parallels are equal',
    statement:
      'Parallelograms which are on the same base and in the same parallels equal one another.',
    method: '',
    deps: ['I.4', 'I.29', 'I.34', 'C.N.1', 'C.N.2', 'C.N.3'],
    note: 'Cut-and-paste proof. Equal "area" without ever defining area \u2014 just adding and subtracting congruent pieces. This is Euclid\'s theory of area at work.',
    block: 'Area Theory',
  },
  36: {
    id: 36,
    type: 'T',
    title: 'Parallelograms on equal bases in the same parallels are equal',
    statement:
      'Parallelograms which are on equal bases and in the same parallels equal one another.',
    method: '',
    deps: ['I.33', 'I.34', 'I.35', 'Post.1', 'C.N.1'],
    note: 'Generalizes I.35 from same base to equal bases.',
    block: 'Area Theory',
  },
  37: {
    id: 37,
    type: 'T',
    title: 'Triangles on the same base in the same parallels are equal',
    statement:
      'Triangles which are on the same base and in the same parallels equal one another.',
    method:
      'Complete each triangle to a parallelogram, apply I.35, each triangle is half its parallelogram (I.34).',
    deps: ['Post.2', 'I.31', 'I.34', 'I.35'],
    note: '',
    block: 'Area Theory',
  },
  38: {
    id: 38,
    type: 'T',
    title: 'Triangles on equal bases in the same parallels are equal',
    statement:
      'Triangles which are on equal bases and in the same parallels equal one another.',
    method: '',
    deps: ['Post.2', 'I.31', 'I.34', 'I.36'],
    note: '',
    block: 'Area Theory',
  },
  39: {
    id: 39,
    type: 'T',
    title: 'Converse of I.37',
    statement:
      'Equal triangles which are on the same base and on the same side are also in the same parallels.',
    method: 'Proof by contradiction using I.37.',
    deps: ['Post.1', 'I.31', 'I.37', 'C.N.1'],
    note: '',
    block: 'Area Theory',
  },
  40: {
    id: 40,
    type: 'T',
    title: 'Converse of I.38',
    statement:
      'Equal triangles which are on equal bases and on the same side are also in the same parallels.',
    method: '',
    deps: ['Post.1', 'I.31', 'I.38', 'C.N.1'],
    note: 'Probably an interpolation (not original Euclid) \u2014 shown by an early papyrus fragment.',
    block: 'Area Theory',
  },
  41: {
    id: 41,
    type: 'T',
    title: 'Parallelogram is double the triangle on the same base',
    statement:
      'If a parallelogram has the same base with a triangle and is in the same parallels, then the parallelogram is double the triangle.',
    method: '',
    deps: ['Post.1', 'I.34', 'I.37'],
    note: '',
    block: 'Area Theory',
  },
  42: {
    id: 42,
    type: 'C',
    title: 'Construct parallelogram equal to a triangle in a given angle',
    statement:
      'To construct a parallelogram equal to a given triangle in a given rectilinear angle.',
    method:
      'Bisect the base, halve the triangle, skew to the desired angle, complete to parallelogram.',
    deps: ['I.10', 'Post.1', 'I.23', 'I.31', 'I.38', 'I.41', 'C.N.1'],
    note: 'First "application of area" construction. Any triangle can be converted to a parallelogram with any desired angle.',
    block: 'Application of Areas',
  },
  43: {
    id: 43,
    type: 'T',
    title: 'Complements about a diagonal are equal',
    statement:
      'In any parallelogram the complements of the parallelograms about the diameter equal one another.',
    method: '',
    deps: ['I.34', 'C.N.2', 'C.N.3'],
    note: 'The key lemma for reshaping parallelograms. If you draw a diagonal and construct sub-parallelograms along it, the two remaining "complement" parallelograms have equal area.',
    block: 'Application of Areas',
  },
  44: {
    id: 44,
    type: 'C',
    title: 'Apply a parallelogram to a given line equal to a given triangle',
    statement:
      'To a given straight line in a given rectilinear angle, to apply a parallelogram equal to a given triangle.',
    method:
      'First construct any parallelogram with the right area and angle (I.42), then use complements (I.43) to reshape it to the desired side length.',
    deps: ['I.42', 'Post.2', 'I.31', 'Post.1', 'I.29', 'Post.5', 'I.43', 'C.N.1', 'I.15'],
    note: 'This is "area application" \u2014 lay an area along a line. Uses the parallel postulate (Post.5) to guarantee a needed intersection.',
    block: 'Application of Areas',
  },
  45: {
    id: 45,
    type: 'C',
    title: 'Construct parallelogram equal to ANY rectilinear figure',
    statement:
      'To construct a parallelogram equal to a given rectilinear figure in a given rectilinear angle.',
    method:
      'Triangulate the figure (using diagonals), apply I.42 and I.44 successively to build up the parallelogram piece by piece.',
    deps: ['Post.1', 'I.42', 'I.44', 'C.N.1', 'C.N.2', 'I.29', 'I.14', 'I.34', 'I.30', 'I.33'],
    note: 'The culmination of area theory. Any polygon can be transformed into a parallelogram with any desired angle and any desired side length.',
    block: 'Application of Areas',
  },
  46: {
    id: 46,
    type: 'C',
    title: 'Construct a square on a given line',
    statement: 'To describe a square on a given straight line.',
    method:
      'Draw perpendicular, cut to equal length, complete parallelogram.',
    deps: ['I.3', 'I.11', 'I.29', 'I.31', 'I.34', 'Post.4', 'Def.22'],
    note: 'The second regular polygon (first was equilateral triangle in I.1). Book IV constructs regular 5-, 6-, and 15-gons.',
    block: 'The Grand Finale',
  },
  47: {
    id: 47,
    type: 'T',
    title: 'THE PYTHAGOREAN THEOREM',
    statement:
      'In right-angled triangles the square on the side opposite the right angle equals the sum of the squares on the sides containing the right angle.',
    method:
      'Construct squares on all three sides. Drop a perpendicular from the right-angle vertex to the hypotenuse (extended to the opposite side of the hypotenuse\'s square). This divides the hypotenuse\'s square into two rectangles. Prove each rectangle equals one of the leg squares using SAS (I.4) and the "parallelogram is double triangle" theorem (I.41).',
    deps: ['I.4', 'I.14', 'I.31', 'I.41', 'I.46', 'Def.22', 'Post.1', 'Post.4', 'C.N.2'],
    note: 'The most famous theorem in mathematics. Known to Old Babylonians (ca. 1900-1600 BCE), over a millennium before Pythagoras. The specific proof here is Euclid\'s own \u2014 earlier proofs likely depended on proportion/similarity (Books V-VI).',
    block: 'The Grand Finale',
  },
  48: {
    id: 48,
    type: 'T',
    title: 'Converse of the Pythagorean Theorem',
    statement:
      'If in a triangle the square on one of the sides equals the sum of the squares on the remaining two sides, then the angle contained by the remaining two sides is right.',
    method:
      'Construct a right triangle with the same two legs, apply I.47 to show the hypotenuses are equal, then use SSS (I.8) to show the angles are equal.',
    deps: ['I.3', 'I.8', 'I.11', 'I.47', 'Post.1', 'C.N.1', 'C.N.2'],
    note: 'A clean converse proof. Book I ends here. The journey from "a point is that which has no part" to the Pythagorean theorem is complete.',
    block: 'The Grand Finale',
  },
}
