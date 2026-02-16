# Euclid's Elements, Book I — All 48 Propositions

Reference: Heath translation via Joyce's edition (Clark University).

Legend:
- **C** = Construction (Problem) — ends Q.E.F. ("which was to be done")
- **T** = Theorem — ends Q.E.D. ("which was to be demonstrated")
- **Deps** = Dependencies (propositions, postulates, definitions, common notions used in proof)

---

## Block 1: Basic Constructions (Props 1-3)

These three form a chain that gives Euclid the ability to transfer and compare line segments — establishing that the "collapsing compass" of Post.3 is as powerful as a real compass.

### Prop 1 [C] — Construct an equilateral triangle on a given line
**Statement:** To construct an equilateral triangle on a given finite straight line.
**Method:** Draw two circles (centered at each endpoint, radius = the line). Their intersection gives the third vertex.
**Deps:** Post.1, Post.3, Def.15, Def.20, C.N.1
**Note:** The very first proposition! Euclid does not prove the two circles intersect — a gap later filled by continuity axioms. This is THE iconic compass-and-straightedge construction.

### Prop 2 [C] — Place a line equal to a given line at a given point
**Statement:** To place a straight line equal to a given straight line with one end at a given point.
**Method:** Construct equilateral triangle on the join, extend sides, use two circles to transfer the distance.
**Deps:** Post.1, Post.2, Post.3, Def.15, C.N.1, C.N.3, I.1
**Note:** This is how you transfer a distance with a collapsing compass. Requires 5 circles and 3 lines.

### Prop 3 [C] — Cut off from the greater a line equal to the less
**Statement:** To cut off from the greater of two given unequal straight lines a straight line equal to the less.
**Method:** Use I.2 to transfer the shorter line to the endpoint of the longer, then draw a circle.
**Deps:** Post.3, Def.15, C.N.1, I.2
**Note:** After this, Euclid can freely copy any line segment to any location.

---

## Block 2: Triangle Congruence (Props 4-8)

The three congruence theorems: SAS, the isosceles triangle theorem (and converse), and SSS.

### Prop 4 [T] — SAS (Side-Angle-Side)
**Statement:** If two triangles have two sides equal to two sides respectively, and have the angles contained by the equal straight lines equal, then they also have the base equal to the base, the triangle equals the triangle, and the remaining angles equal the remaining angles respectively.
**Method:** Proof by superposition — place one triangle on the other.
**Deps:** C.N.4 (superposition)
**Note:** THE fundamental congruence theorem. The method of superposition is controversial — Euclid uses it only here, in I.8, and III.24. Hilbert later made this an axiom. Proves equal sides, equal angles, AND equal areas.

### Prop 5 [T] — Pons Asinorum ("Bridge of Asses")
**Statement:** In isosceles triangles the angles at the base equal one another, and if the equal straight lines are produced further, then the angles under the base equal one another.
**Method:** Extend both equal sides, take equal lengths on extensions, form two auxiliary triangles, apply SAS twice.
**Deps:** Def.20, Post.1, Post.2, I.3, I.4, C.N.3
**Note:** Called Pons Asinorum because this is where weak students allegedly got stuck. The proof is elegant but tricky — Pappus later gave a simpler proof by comparing triangle ABC to its mirror ACB using SAS.

### Prop 6 [T] — Converse of Pons Asinorum
**Statement:** If in a triangle two angles equal one another, then the sides opposite the equal angles also equal one another.
**Method:** Proof by contradiction. Assume sides unequal, cut off equal part, apply SAS to get part = whole, contradicting C.N.5.
**Deps:** Post.1, I.3, I.4, C.N.5
**Note:** First proof by contradiction (reductio ad absurdum) in the Elements.

### Prop 7 [T] — Uniqueness of triangle construction
**Statement:** Given two straight lines constructed from the ends of a straight line and meeting in a point, there cannot be constructed from the ends of the same straight line, and on the same side of it, two other straight lines meeting in another point and equal to the former two respectively.
**Method:** Join the two candidate peaks, apply I.5 twice to get contradictory angle inequalities.
**Deps:** Post.1, I.5, C.N.5
**Note:** A lemma for I.8. Says: if you fix a base and two side lengths, there's only one triangle (on each side).

### Prop 8 [T] — SSS (Side-Side-Side)
**Statement:** If two triangles have the two sides equal to two sides respectively, and also have the base equal to the base, then they also have the angles equal which are contained by the equal straight lines.
**Method:** Superposition + I.7. Place bases together; if the peaks didn't coincide, I.7 would be violated.
**Deps:** I.7, C.N.4
**Note:** The second congruence theorem. Combined with SAS, gives full congruence from three sides.

---

## Block 3: Fundamental Constructions (Props 9-12)

The essential toolkit: bisect angles, bisect lines, draw perpendiculars.

### Prop 9 [C] — Bisect an angle
**Statement:** To bisect a given rectilinear angle.
**Method:** Mark equal distances on both sides of the angle, construct equilateral triangle on the resulting line, join vertex to peak.
**Deps:** I.1, I.3, I.8, Def.20, Post.1
**Note:** Uses SSS (I.8) to prove the two half-angles are equal.

### Prop 10 [C] — Bisect a line segment
**Statement:** To bisect a given finite straight line.
**Method:** Construct equilateral triangle on the line, bisect the apex angle, the bisector hits the midpoint.
**Deps:** I.1, I.4, I.9, Def.20
**Note:** Uses I.9 (bisect angle) which uses I.1 (equilateral triangle). A beautiful chain.

### Prop 11 [C] — Perpendicular from a point ON a line
**Statement:** To draw a straight line at right angles to a given straight line from a given point on it.
**Method:** Mark equal distances on both sides of the point, construct equilateral triangle, join point to peak.
**Deps:** I.1, I.3, I.8, Def.10, Def.20, Post.1
**Note:** Creates a perpendicular going "up" from a point that's already on the line.

### Prop 12 [C] — Perpendicular from a point NOT on a line (Drop a perpendicular)
**Statement:** To draw a straight line perpendicular to a given infinite straight line from a given point not on it.
**Method:** Draw a circle from the external point that crosses the line in two places, bisect the resulting chord, join.
**Deps:** I.8, I.10, Def.10, Def.15, Post.1, Post.3
**Note:** Requires the line to be "infinite" (extendable enough). This is the fundamental "drop a perpendicular" construction.

---

## Block 4: Angle Arithmetic (Props 13-15)

Supplementary angles and vertical angles — the arithmetic of angles at a point.

### Prop 13 [T] — Supplementary angles sum to two right angles
**Statement:** If a straight line stands on a straight line, then it makes either two right angles or angles whose sum equals two right angles.
**Deps:** Def.10, I.11, C.N.1, C.N.2
**Note:** Foundation of angle arithmetic. First proposition to show how angle sums work.

### Prop 14 [T] — Converse: angles summing to two right angles form a straight line
**Statement:** If with any straight line, and at a point on it, two straight lines not lying on the same side make the sum of the adjacent angles equal to two right angles, then the two straight lines are in a straight line with one another.
**Deps:** Post.2, Post.4, I.13, C.N.1, C.N.3
**Note:** Converse of I.13. First use of Post.4 (all right angles are equal).

### Prop 15 [T] — Vertical angles are equal
**Statement:** If two straight lines cut one another, then they make the vertical angles equal to one another.
**Deps:** I.13, Post.4, C.N.1, C.N.3
**Corollary:** Two intersecting lines make angles at the point of section equal to four right angles.
**Note:** Vertical (opposite) angles are equal. Used frequently throughout.

---

## Block 5: Triangle Inequalities (Props 16-21)

Properties of triangles that don't require the parallel postulate.

### Prop 16 [T] — Exterior angle > either remote interior angle
**Statement:** In any triangle, if one of the sides is produced, then the exterior angle is greater than either of the interior and opposite angles.
**Method:** Bisect one side, extend the median to double length, use SAS to create equal angle, then inequality.
**Deps:** I.3, I.4, I.10, I.15, Post.1, Post.2, C.N.5
**Note:** CRITICAL: This is the last proposition that holds in elliptic geometry. Props 1-15 hold in elliptic geometry; this one does not (on a sphere, it can fail for large triangles). Later strengthened to equality in I.32 (with the parallel postulate).

### Prop 17 [T] — Sum of two angles of a triangle < two right angles
**Statement:** In any triangle the sum of any two angles is less than two right angles.
**Deps:** Post.2, I.13, I.16
**Note:** Consequence of the exterior angle theorem. Strengthened to "sum of all three = two right angles" in I.32.

### Prop 18 [T] — Greater side subtends greater angle
**Statement:** In any triangle the angle opposite the greater side is greater.
**Deps:** I.3, I.5, I.16, Post.1

### Prop 19 [T] — Greater angle subtended by greater side
**Statement:** In any triangle the side opposite the greater angle is greater.
**Method:** Proof by contradiction using I.5 and I.18.
**Deps:** I.5, I.18
**Note:** Converse of I.18. Together they say: side ordering = angle ordering.

### Prop 20 [T] — Triangle inequality
**Statement:** In any triangle the sum of any two sides is greater than the remaining one.
**Method:** Extend one side, use isosceles triangle theorem and I.19.
**Deps:** Post.1, Post.2, I.3, I.5, I.19, C.N.5
**Note:** The triangle inequality. Part of the statement "the shortest path between two points is a straight line." Joyce includes a beautiful digression on Heron's reflection principle (angle of incidence = angle of reflection minimizes path).

### Prop 21 [T] — Interior cevians: shorter sum, larger angle
**Statement:** If from the ends of one side of a triangle two straight lines are constructed meeting within the triangle, then their sum is less than the sum of the remaining two sides, but they contain a greater angle.
**Deps:** Post.2, I.16, I.20

---

## Block 6: Construction from Parts (Props 22-23)

Building triangles and copying angles.

### Prop 22 [C] — Construct a triangle from three given line segments
**Statement:** To construct a triangle out of three straight lines which equal three given straight lines: thus it is necessary that the sum of any two of the straight lines should be greater than the remaining one.
**Method:** Lay out the three lengths along a line, draw two circles, their intersection is the third vertex.
**Deps:** Post.1, Post.2, Post.3, I.3, I.20, Def.16, C.N.1
**Note:** Generalizes I.1 (equilateral triangle). The triangle inequality condition (I.20) is necessary. Euclid does not prove sufficiency (that the circles actually intersect) — another gap.

### Prop 23 [C] — Copy an angle to a given point on a line
**Statement:** To construct a rectilinear angle equal to a given rectilinear angle on a given straight line and at a point on it.
**Method:** Take two points on the sides of the given angle, join them to form a triangle, copy that triangle using I.22, then use SSS (I.8) to conclude equal angles.
**Deps:** Post.1, I.8, I.22
**Note:** The angle-transfer construction. Requires about 10 circles and 1 line in the general case.

---

## Block 7: More Congruence (Props 24-26)

The hinge theorem and the ASA/AAS congruence theorem.

### Prop 24 [T] — Hinge theorem (SAS inequality)
**Statement:** If two triangles have two sides equal to two sides respectively, but have one of the angles contained by the equal straight lines greater than the other, then they also have the base greater than the base.
**Deps:** Post.1, I.3, I.4, I.5, I.19, I.23

### Prop 25 [T] — Converse of hinge theorem
**Statement:** If two triangles have two sides equal to two sides respectively, but have the base greater than the base, then they also have the one of the angles contained by the equal straight lines greater than the other.
**Method:** Proof by contradiction using I.4 and I.24.
**Deps:** I.4, I.24

### Prop 26 [T] — ASA and AAS congruence
**Statement:** If two triangles have two angles equal to two angles respectively, and one side equal to one side, namely, either the side adjoining the equal angles (ASA), or that opposite one of the equal angles (AAS), then the remaining sides and angle are equal.
**Method:** Proof by contradiction for both cases.
**Deps:** I.3, I.4, I.16, Post.1, C.N.1
**Note:** The last of Euclid's congruence theorems. Together with I.4 (SAS) and I.8 (SSS), these cover the standard cases. SSA (side-side-angle) is ambiguous in general — Euclid does not include it, though a special case (side-side-right angle) appears in III.14.

---

## Block 8: Parallel Lines — THE WATERSHED (Props 27-32)

Props 27-28 don't use the parallel postulate. Prop 29 is the FIRST to use Post.5. Everything after depends on it.

### Prop 27 [T] — Alternate angles equal => lines are parallel
**Statement:** If a straight line falling on two straight lines makes the alternate angles equal to one another, then the straight lines are parallel to one another.
**Method:** Proof by contradiction using the exterior angle theorem (I.16).
**Deps:** I.16, Def.23
**Note:** Does NOT require the parallel postulate. Holds in absolute geometry.

### Prop 28 [T] — Two more conditions for parallel lines
**Statement:** If a straight line falling on two straight lines makes (a) the exterior angle equal to the interior and opposite angle on the same side, or (b) the sum of the interior angles on the same side equal to two right angles, then the straight lines are parallel.
**Deps:** I.13, I.15, I.27, Post.4, C.N.1, C.N.3
**Note:** Minor variants of I.27. Still does not require Post.5.

### Prop 29 [T] — THE CONVERSE: parallel lines => alternate angles equal (USES POST.5)
**Statement:** A straight line falling on parallel straight lines makes the alternate angles equal to one another, the exterior angle equal to the interior and opposite angle, and the sum of the interior angles on the same side equal to two right angles.
**Method:** Proof by contradiction — if angles weren't equal, the interior angle sum would be less than two right angles, so by Post.5 the lines would meet, contradicting their being parallel.
**Deps:** I.13, I.15, Post.5, C.N.1, C.N.2
**Note:** FIRST USE OF THE PARALLEL POSTULATE. This is the converse of I.27/I.28. Does NOT hold in hyperbolic geometry. This is the watershed — everything from here on is Euclidean geometry specifically.

### Prop 30 [T] — Transitivity of parallelism
**Statement:** Straight lines parallel to the same straight line are also parallel to one another.
**Deps:** I.29, C.N.1
**Note:** Equivalent to the parallel postulate (and to Playfair's axiom). Could have been chosen as the postulate instead of Post.5.

### Prop 31 [C] — Construct a line parallel to a given line through a given point
**Statement:** To draw a straight line through a given point parallel to a given straight line.
**Method:** Pick any point on the given line, join to the given point, copy the angle at the join point using I.23, apply I.27.
**Deps:** I.23, I.27, Post.1, Post.2
**Note:** The parallel line construction. Does not itself require Post.5 (uses I.27, not I.29). But the UNIQUENESS of this parallel follows from Post.5.

### Prop 32 [T] — ANGLE SUM OF A TRIANGLE = TWO RIGHT ANGLES
**Statement:** In any triangle, if one of the sides is produced, then the exterior angle equals the sum of the two interior and opposite angles, and the sum of the three interior angles of the triangle equals two right angles.
**Method:** Draw a parallel to one side through the opposite vertex, apply I.29.
**Deps:** I.13, I.29, I.31, C.N.1, C.N.2
**Corollaries (Proclus):**
1. Sum of interior angles of a convex n-gon = (2n - 4) right angles.
2. Sum of exterior angles of any convex rectilinear figure = 4 right angles.
**Note:** One of the most important results in Book I. Strengthens I.16 (exterior angle > remote interior) to equality. In hyperbolic geometry, the angle sum is < 180; in elliptic, > 180.

---

## Block 9: Parallelogram Basics (Props 33-34)

### Prop 33 [T] — Lines joining ends of equal parallel lines are equal and parallel
**Statement:** Straight lines which join the ends of equal and parallel straight lines in the same directions are themselves equal and parallel.
**Deps:** I.4, I.27, I.29, Post.1
**Note:** Establishes that parallelograms exist — if you have one pair of equal parallel sides, the other pair is also equal and parallel.

### Prop 34 [T] — Properties of parallelograms
**Statement:** In parallelogrammic areas the opposite sides and angles equal one another, and the diameter (diagonal) bisects the areas.
**Deps:** I.4, I.26, I.29, C.N.2
**Note:** THE fundamental parallelogram theorem. Proves: (a) opposite sides equal, (b) opposite angles equal, (c) diagonal splits into two equal triangles. Used constantly from here on.

---

## Block 10: Area Theory (Props 35-41)

The theory of equal areas — parallelograms and triangles with the same base in the same parallels have equal areas.

### Prop 35 [T] — Parallelograms on the same base in the same parallels are equal
**Statement:** Parallelograms which are on the same base and in the same parallels equal one another.
**Deps:** I.4, I.29, I.34, C.N.1, C.N.2, C.N.3
**Note:** Cut-and-paste proof. Equal "area" without ever defining area — just adding and subtracting congruent pieces. This is Euclid's theory of area at work.

### Prop 36 [T] — Parallelograms on equal bases in the same parallels are equal
**Statement:** Parallelograms which are on equal bases and in the same parallels equal one another.
**Deps:** I.33, I.34, I.35, Post.1, C.N.1
**Note:** Generalizes I.35 from same base to equal bases.

### Prop 37 [T] — Triangles on the same base in the same parallels are equal
**Statement:** Triangles which are on the same base and in the same parallels equal one another.
**Method:** Complete each triangle to a parallelogram, apply I.35, each triangle is half its parallelogram (I.34).
**Deps:** Post.2, I.31, I.34, I.35

### Prop 38 [T] — Triangles on equal bases in the same parallels are equal
**Statement:** Triangles which are on equal bases and in the same parallels equal one another.
**Deps:** Post.2, I.31, I.34, I.36

### Prop 39 [T] — Converse of I.37
**Statement:** Equal triangles which are on the same base and on the same side are also in the same parallels.
**Method:** Proof by contradiction using I.37.
**Deps:** Post.1, I.31, I.37, C.N.1

### Prop 40 [T] — Converse of I.38
**Statement:** Equal triangles which are on equal bases and on the same side are also in the same parallels.
**Deps:** Post.1, I.31, I.38, C.N.1
**Note:** Probably an interpolation (not original Euclid) — shown by an early papyrus fragment.

### Prop 41 [T] — Parallelogram is double the triangle on the same base
**Statement:** If a parallelogram has the same base with a triangle and is in the same parallels, then the parallelogram is double the triangle.
**Deps:** Post.1, I.34, I.37

---

## Block 11: Application of Areas (Props 42-45)

The powerful technique of transforming any rectilinear figure into a parallelogram of desired shape.

### Prop 42 [C] — Construct parallelogram equal to a triangle in a given angle
**Statement:** To construct a parallelogram equal to a given triangle in a given rectilinear angle.
**Method:** Bisect the base, halve the triangle, skew to the desired angle, complete to parallelogram.
**Deps:** I.10, Post.1, I.23, I.31, I.38, I.41, C.N.1
**Note:** First "application of area" construction. Any triangle can be converted to a parallelogram with any desired angle.

### Prop 43 [T] — Complements about a diagonal are equal
**Statement:** In any parallelogram the complements of the parallelograms about the diameter equal one another.
**Deps:** I.34, C.N.2, C.N.3
**Note:** The key lemma for reshaping parallelograms. If you draw a diagonal and construct sub-parallelograms along it, the two remaining "complement" parallelograms have equal area.

### Prop 44 [C] — Apply a parallelogram to a given line equal to a given triangle
**Statement:** To a given straight line in a given rectilinear angle, to apply a parallelogram equal to a given triangle.
**Method:** First construct any parallelogram with the right area and angle (I.42), then use complements (I.43) to reshape it to the desired side length.
**Deps:** I.42, Post.2, I.31, Post.1, I.29, Post.5, I.43, C.N.1, I.15
**Note:** This is "area application" — lay an area along a line. Uses the parallel postulate (Post.5) to guarantee a needed intersection.

### Prop 45 [C] — Construct parallelogram equal to ANY rectilinear figure
**Statement:** To construct a parallelogram equal to a given rectilinear figure in a given rectilinear angle.
**Method:** Triangulate the figure (using diagonals), apply I.42 and I.44 successively to build up the parallelogram piece by piece.
**Deps:** Post.1, I.42, I.44, C.N.1, C.N.2, I.29, I.14, I.34, I.30, I.33
**Note:** The culmination of area theory. Any polygon can be transformed into a parallelogram with any desired angle and any desired side length. Answers "what's the area of this figure?" — transform it to a rectangle on a unit line.

---

## Block 12: The Grand Finale (Props 46-48)

### Prop 46 [C] — Construct a square on a given line
**Statement:** To describe a square on a given straight line.
**Method:** Draw perpendicular, cut to equal length, complete parallelogram.
**Deps:** I.3, I.11, I.29, I.31, I.34, Post.4, Def.22
**Note:** The second regular polygon (first was equilateral triangle in I.1). Book IV constructs regular 5-, 6-, and 15-gons.

### Prop 47 [T] — THE PYTHAGOREAN THEOREM
**Statement:** In right-angled triangles the square on the side opposite the right angle equals the sum of the squares on the sides containing the right angle.
**Method:** Construct squares on all three sides. Drop a perpendicular from the right-angle vertex to the hypotenuse (extended to the opposite side of the hypotenuse's square). This divides the hypotenuse's square into two rectangles. Prove each rectangle equals one of the leg squares using SAS (I.4) and the "parallelogram is double triangle" theorem (I.41).
**Deps:** I.4, I.14, I.31, I.41, I.46, Def.22, Post.1, Post.4, C.N.2
**Note:** The most famous theorem in mathematics. Known to Old Babylonians (ca. 1900-1600 BCE), over a millennium before Pythagoras. The specific proof here is Euclid's own — earlier proofs likely depended on proportion/similarity (Books V-VI). Euclid designed this proof to work in Book I without those tools. Generalized in VI.31 to similar figures on the sides. Extended to non-right triangles as the law of cosines in II.12-II.13.

### Prop 48 [T] — Converse of the Pythagorean Theorem
**Statement:** If in a triangle the square on one of the sides equals the sum of the squares on the remaining two sides, then the angle contained by the remaining two sides is right.
**Method:** Construct a right triangle with the same two legs, apply I.47 to show the hypotenuses are equal, then use SSS (I.8) to show the angles are equal.
**Deps:** I.3, I.8, I.11, I.47, Post.1, C.N.1, C.N.2
**Note:** A clean converse proof. Book I ends here. The journey from "a point is that which has no part" to the Pythagorean theorem is complete.
