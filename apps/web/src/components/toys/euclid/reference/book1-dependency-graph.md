# Euclid Book I — Proposition Dependency Graph

This file encodes the DAG (directed acyclic graph) of proposition dependencies.
For each proposition, only direct proposition dependencies are listed (not postulates/CNs/defs).
This is the data structure we'll use to build the interactive "prerequisite map" UI.

## Machine-Readable Dependency Table

```
PROP  TYPE  DEPENDS_ON_PROPS
1     C     []
2     C     [1]
3     C     [2]
4     T     []
5     T     [3, 4]
6     T     [3, 4]
7     T     [5]
8     T     [7]
9     C     [1, 3, 8]
10    C     [1, 4, 9]
11    C     [1, 3, 8]
12    C     [8, 10]
13    T     [11]
14    T     [13]
15    T     [13]
16    T     [3, 4, 10, 15]
17    T     [13, 16]
18    T     [3, 5, 16]
19    T     [5, 18]
20    T     [3, 5, 19]
21    T     [16, 20]
22    C     [3, 20]
23    C     [8, 22]
24    T     [3, 4, 5, 19, 23]
25    T     [4, 24]
26    T     [3, 4, 16]
27    T     [16]
28    T     [13, 15, 27]
29    T     [13, 15]              # FIRST USE OF POST.5
30    T     [29]
31    C     [23, 27]
32    T     [13, 29, 31]
33    T     [4, 27, 29]
34    T     [4, 26, 29]
35    T     [4, 29, 34]
36    T     [33, 34, 35]
37    T     [31, 34, 35]
38    T     [31, 34, 36]
39    T     [31, 37]
40    T     [31, 38]
41    T     [34, 37]
42    C     [10, 23, 31, 38, 41]
43    T     [34]
44    C     [15, 29, 31, 42, 43]  # USES POST.5 (via I.29 and directly)
45    C     [14, 29, 30, 33, 34, 42, 44]
46    C     [3, 11, 29, 31, 34]
47    T     [4, 14, 31, 41, 46]
48    T     [3, 8, 11, 47]
```

## Thematic Groupings (Topological Order)

### Level 0 — No proposition dependencies (only postulates/axioms)
- I.1 (equilateral triangle)
- I.4 (SAS congruence)

### Level 1 — Depends only on Level 0
- I.2 (transfer distance) <- I.1
- I.5 (pons asinorum) <- I.3, I.4
- I.6 (converse pons asinorum) <- I.3, I.4

### Level 2 — Basic tools
- I.3 (cut off equal) <- I.2
- I.7 (triangle uniqueness) <- I.5
- I.8 (SSS) <- I.7

### Level 3 — Constructions using congruence
- I.9 (bisect angle) <- I.1, I.3, I.8
- I.10 (bisect line) <- I.1, I.4, I.9
- I.11 (perpendicular on line) <- I.1, I.3, I.8
- I.12 (perpendicular to line) <- I.8, I.10

### Level 4 — Angle arithmetic
- I.13 (supplementary angles) <- I.11
- I.14 (converse supplementary) <- I.13
- I.15 (vertical angles) <- I.13

### Level 5 — Triangle properties (no parallel postulate)
- I.16 (exterior angle) <- I.3, I.4, I.10, I.15
- I.17 (two angles < 180) <- I.13, I.16
- I.18 (bigger side -> bigger angle) <- I.3, I.5, I.16
- I.19 (bigger angle -> bigger side) <- I.5, I.18
- I.20 (triangle inequality) <- I.3, I.5, I.19
- I.21 (interior cevians) <- I.16, I.20
- I.22 (triangle from 3 segments) <- I.3, I.20
- I.23 (copy angle) <- I.8, I.22
- I.24 (hinge theorem) <- I.3, I.4, I.5, I.19, I.23
- I.25 (converse hinge) <- I.4, I.24
- I.26 (ASA/AAS) <- I.3, I.4, I.16
- I.27 (alt angles -> parallel) <- I.16
- I.28 (more parallel criteria) <- I.13, I.15, I.27

### Level 6 — PARALLEL POSTULATE WATERSHED
- I.29 (parallel -> alt angles equal) <- I.13, I.15 + **POST.5**
- I.30 (transitivity of parallel) <- I.29
- I.31 (construct parallel) <- I.23, I.27

### Level 7 — Post-parallel-postulate geometry
- I.32 (angle sum = 180) <- I.13, I.29, I.31
- I.33 (parallelogram existence) <- I.4, I.27, I.29
- I.34 (parallelogram properties) <- I.4, I.26, I.29

### Level 8 — Area theory
- I.35 (parallelogram area, same base) <- I.4, I.29, I.34
- I.36 (parallelogram area, equal bases) <- I.33, I.34, I.35
- I.37 (triangle area, same base) <- I.31, I.34, I.35
- I.38 (triangle area, equal bases) <- I.31, I.34, I.36
- I.39 (converse of I.37) <- I.31, I.37
- I.40 (converse of I.38) <- I.31, I.38
- I.41 (parallelogram = 2x triangle) <- I.34, I.37
- I.43 (complements) <- I.34

### Level 9 — Application of areas
- I.42 (triangle -> parallelogram) <- I.10, I.23, I.31, I.38, I.41
- I.44 (apply area to line) <- I.15, I.29, I.31, I.42, I.43
- I.45 (any figure -> parallelogram) <- I.14, I.29, I.30, I.33, I.34, I.42, I.44
- I.46 (construct square) <- I.3, I.11, I.29, I.31, I.34

### Level 10 — The Finale
- I.47 (Pythagorean theorem) <- I.4, I.14, I.31, I.41, I.46
- I.48 (converse Pythagorean) <- I.3, I.8, I.11, I.47

## The Two Independent Roots

The dependency graph has exactly two roots (propositions with no proposition dependencies):
1. **I.1** (equilateral triangle) — seeds the construction chain
2. **I.4** (SAS congruence) — seeds the proof chain

Everything in Book I flows from these two starting points plus the postulates and common notions.

## The Parallel Postulate Boundary

Propositions 1-28 do NOT use the parallel postulate (Post.5).
These hold in absolute geometry (both Euclidean and hyperbolic).

Proposition 29 is the FIRST to use Post.5.
All subsequent propositions (29-48) depend on it, directly or indirectly.

The boundary is clean:
- Before I.29: Absolute geometry
- From I.29: Euclidean geometry only

## Propositions Not Used Later in Book I

Some propositions are "terminal" within Book I (not used by later Book I propositions):
- I.17, I.21, I.25, I.28, I.30, I.32, I.35, I.36, I.37, I.38, I.39, I.40, I.45

Many of these are used extensively in later books (II-XIII).
