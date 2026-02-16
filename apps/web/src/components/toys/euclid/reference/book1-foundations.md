# Euclid's Elements, Book I — Foundations

Reference: Heath translation via Joyce's edition (Clark University).
Source: http://aleph0.clarku.edu/~djoyce/java/elements/bookI/bookI.html

---

## DEFINITIONS

### Def 1. Point
A **point** is that which has no part.
> Primitive term. No width, length, or breadth — an indivisible location. Meaning comes from the postulates (e.g., Post.1 says a line can be drawn between any two points).

### Def 2. Line
A **line** is breadthless length.
> Primitive term. One dimension only. "Line" in Euclid means what we'd call a "curve" — it need not be straight. Lines may have ends (segments) or not (circumference of a circle). Lines can also be unbounded/infinite in some cases.

### Def 3. Ends of a Line
The ends of a line are points.
> Establishes the relation between lines and points. A circumference has no ends; a finite line has two endpoints.

### Def 4. Straight Line
A **straight line** is a line which lies evenly with the points on itself.
> Meaning is opaque, but the postulates give it substance: Post.1 (can draw between two points), Post.2 (can extend), etc.

### Def 5. Surface
A **surface** is that which has length and breadth only.
> Two dimensions. Does not have to be a plane — includes surfaces of cones, cylinders, spheres.

### Def 6. Edges of a Surface
The edges of a surface are lines.

### Def 7. Plane Surface
A **plane surface** is a surface which lies evenly with the straight lines on itself.
> Usually abbreviated to "plane." Throughout Books I-IV and VI, there is one implicit plane containing all points, lines, and circles.

### Def 8. Plane Angle
A **plane angle** is the inclination to one another of two lines in a plane which meet one another and do not lie in a straight line.
> The two lines emanate from the same point (vertex). Angles can have curved sides (see III.16 horn angles), though nearly all in the Elements are rectilinear. Angles are always > 0 and < two right angles (180 degrees).

### Def 9. Rectilinear Angle
When the lines containing the angle are straight, the angle is called **rectilinear**.
> Named by three points (e.g., angle BAC, vertex at A). Rectilinear angles are magnitudes that can be added (by joining adjacent angles sharing a side).

### Def 10. Right Angle / Perpendicular
When a straight line standing on a straight line makes the adjacent angles equal to one another, each of the equal angles is **right**, and the standing line is called a **perpendicular** to that on which it stands.
> Post.4 states all right angles are equal. Construction of perpendiculars: I.11 (from point on line), I.12 (from point not on line).

### Def 11. Obtuse Angle
An **obtuse angle** is an angle greater than a right angle.

### Def 12. Acute Angle
An **acute angle** is an angle less than a right angle.

### Def 13. Boundary
A **boundary** is that which is an extremity of anything.

### Def 14. Figure
A **figure** is that which is contained by any boundary or boundaries.
> Must be bounded (infinite plane is not a figure). Figures are connected; Euclid does not consider nonconnected or nonsimply-connected figures.

### Def 15. Circle
A **circle** is a plane figure contained by one line such that all the straight lines falling upon it from one point among those lying within the figure equal one another.
> A circle is a 2D figure (the disk), not just the circumference. Center: the interior point. All radii are equal by definition. Existence follows from Post.3.

### Def 16. Center of a Circle
The point [from Def 15] is called the **center** of the circle.
> Uniqueness proved in III.1.

### Def 17. Diameter
A **diameter** of the circle is any straight line drawn through the center and terminated in both directions by the circumference of the circle, and such a straight line also bisects the circle.

### Def 18. Semicircle
A **semicircle** is the figure contained by the diameter and the circumference cut off by it.

### Def 19. Rectilinear Figures
**Rectilinear figures** are those contained by straight lines: **trilateral** (3 sides), **quadrilateral** (4 sides), **multilateral** (more than 4).

### Def 20. Triangle Types by Sides
- **Equilateral triangle**: three sides equal
- **Isosceles triangle**: two sides equal
- **Scalene triangle**: three sides unequal

> In practice, Euclid uses "isosceles" to include equilateral (at least two sides equal).

### Def 21. Triangle Types by Angles
- **Right-angled triangle**: has a right angle
- **Obtuse-angled triangle**: has an obtuse angle
- **Acute-angled triangle**: all three angles acute

> A triangle can have at most one right or one obtuse angle (proved in I.17).

### Def 22. Quadrilateral Types
- **Square**: equilateral and right-angled
- **Oblong** (rectangle): right-angled but not equilateral
- **Rhombus**: equilateral but not right-angled
- **Rhomboid**: opposite sides and angles equal, neither equilateral nor right-angled
- **Trapezia**: everything else

> Euclid actually uses "parallelogram" (not defined here) extensively — meaning quadrilateral with parallel opposite sides. He uses "rectangle" (rectangular parallelogram) rather than "oblong."

### Def 23. Parallel Lines
**Parallel** straight lines are straight lines which, being in the same plane and being produced indefinitely in both directions, do not meet one another in either direction.
> Does not assert existence. Construction: I.31. Uniqueness of parallel through a point: follows from Post.5.

---

## POSTULATES

> The construction axioms — what compass and straightedge can do.

### Post 1. Draw a Line
To draw a straight line from any point to any point.
> Implies uniqueness (used as such). Corresponds to straightedge operation.

### Post 2. Extend a Line
To produce a finite straight line continuously in a straight line.
> Extend in one direction. Implies unique continuation.

### Post 3. Draw a Circle
To describe a circle with any center and radius.
> Corresponds to compass operation. NOTE: This is a "collapsing compass" — it draws a circle centered at A through B, but you cannot pick it up and transfer the radius. Prop I.3 proves you can effectively transfer distances anyway.

### Post 4. Right Angles are Equal
That all right angles equal one another.
> Basis of angle measurement. First used in I.14.

### Post 5. The Parallel Postulate
That, if a straight line falling on two straight lines makes the interior angles on the same side less than two right angles, the two straight lines, if produced indefinitely, meet on that side on which are the angles less than the two right angles.
> The most famous postulate. Not used until I.29. Props I.1-I.28 hold in absolute geometry (both Euclidean and hyperbolic). Equivalent to Playfair's axiom: through a point not on a line, there is exactly one parallel to that line. Denial leads to hyperbolic geometry (Bolyai, Lobachevsky, Gauss) or elliptic geometry.

---

## COMMON NOTIONS

> The logical/algebraic axioms — properties of magnitudes.

### C.N. 1. Transitivity of Equality
Things which equal the same thing also equal one another.
> If A = C and B = C, then A = B.

### C.N. 2. Addition of Equals
If equals are added to equals, then the wholes are equal.
> If A = B, then A + C = B + C.

### C.N. 3. Subtraction of Equals
If equals are subtracted from equals, then the remainders are equal.
> If A = B and C = D, then A - C = B - D (when magnitudes are appropriate).

### C.N. 4. Superposition / Coincidence
Things which coincide with one another equal one another.
> Justifies the method of superposition used in I.4 and I.8. If you can place one figure exactly on another, they're equal.

### C.N. 5. Whole Greater Than Part
The whole is greater than the part.
> Equivalent to: if A = B + C for some positive C, then A > B.

### Additional Properties Used (Not Listed as Common Notions)
Euclid implicitly uses several additional properties:
- Law of trichotomy: for magnitudes x, y — exactly one of x < y, x = y, x > y holds
- If x < y and y = z, then x < z
- If x < y and y < z, then x < z
- If x > y, then x + z > y + z
- If 2x = 2y, then x = y (halving)
- If x = y, then 2x = 2y (doubling, special case of C.N.2)
- Double negation: if not (not x = y), then x = y
