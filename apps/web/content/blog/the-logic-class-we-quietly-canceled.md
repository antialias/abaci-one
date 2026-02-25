---
title: 'The Logic Class We Quietly Canceled'
description: >-
  For two thousand years, one subject in the curriculum taught children how to
  construct airtight arguments from first principles. In the 1960s, we replaced
  it with something that looked almost identical. Nobody announced it. Part 1 of 2.
author: Abaci.one Team
publishedAt: '2026-02-24'
updatedAt: '2026-02-24'
tags:
  - education
  - history
  - mathematics
  - pedagogy
  - logic
featured: true
heroPrompt: >-
  An aged parchment manuscript page covered in precise Euclidean geometric
  constructions — overlapping circles, triangles, geometric arcs, compass arcs
  intersecting at exact points, rendered in the style of an 18th century
  mathematical atlas. Rich ochre and sepia tones with dramatic raking light that
  casts sharp shadows across the geometric lines, making the constructions feel
  carved rather than drawn. The image should feel ancient, precise, and
  irreplaceable — like something taken from a vault. No text, no labels, only
  pure geometric form.
---

Somewhere in the 1960s, American schools quietly stopped teaching children how to construct proofs. No announcement. No debate. The subject that had been the backbone of logical education for two thousand years was phased out and replaced with something that looked, from the outside, almost identical. The same vocabulary — triangles, theorems, congruence — but a fundamentally different cognitive activity underneath.

Nobody noticed. And we've been living with the consequences ever since.

## What Euclid Was Actually Teaching

Abraham Lincoln taught himself Euclid's *Elements* by candlelight in a log cabin. He carried a copy on circuit-court riding and worked through it in spare hours — not because he found triangles interesting, but because he wanted to be a lawyer. His reasoning: if you couldn't follow a Euclidean proof, you couldn't construct a legal argument. You'd be missing the underlying machinery.

He was right about what *Elements* was. Euclid's *Elements* is not, at its core, a geometry textbook. It is a logic machine dressed in geometric clothing. The triangles and circles are the medium; the lesson is how to think.

Here's what that means concretely. Proposition 1 of Book I — the very first thing Euclid proves — shows how to construct an equilateral triangle using only a blank straightedge and a compass. No numbers. No measurements. No algebra. You draw two circles, each centered at one endpoint of a line segment, each with the radius of that segment. They intersect at a point. Connect that point to each endpoint. Done. And because of what a circle *is* — all points equidistant from a center — those three sides must be equal. Not probably equal. Not equal within measurement error. Necessarily, inescapably equal.

That's what a proof is: an argument so tight that the conclusion is forced. Not suggested. Forced.

Euclid's system runs on this logic for thirteen books. Every proof is a deductive chain. Every step cites a previous result, an axiom, or a definition. You cannot skip steps. You cannot say "clearly." You cannot gesture at a diagram and say "you can see that these are equal." Visual intuition is explicitly not allowed — because visual intuition can be wrong, and because the point was never to convince you of something obvious. It was to build the cognitive infrastructure for recognizing when a conclusion is truly unavoidable.

This is what Lincoln understood, and what millions of educated people understood for two millennia: *Elements* was not about geometry. It was about the architecture of argument.

## The Russian Nesting Doll of Replacements

Ask why *Elements* was removed from classrooms and you get a story that unfolds like Russian nesting dolls, each explanation hiding another.

The first answer: mathematicians found gaps. By the late 19th century, it was clear that Euclid's proofs sometimes relied on things that were visually obvious but never formally stated. Most notably, he had no axiom for *betweenness* — the idea that if a point B lies between points A and C on a line, it is, in fact, between them and not somewhere else. His proofs were logically complete in spirit, but not in the sense that modern formal mathematics demands.

David Hilbert fixed this in 1899. His *Grundlagen der Geometrie* rebuilt geometry on 20 fully explicit axioms — nothing left to intuition, no hidden visual assumptions. Airtight. Also completely unusable in a classroom. Hilbert's system is so meticulous that proving something as basic as "two distinct points determine exactly one line" takes real effort. Nobody was putting this in a high school textbook.

George Birkhoff tried a different fix in 1932. Instead of patching Euclid on Euclid's own terms, Birkhoff abandoned the unmarked straightedge entirely and injected the real number line into geometry. In Birkhoff's system, lengths and angles are real numbers. You can measure things. You can use algebra.

Then in the 1960s, the School Mathematics Study Group (SMSG) used Birkhoff's approach to modernize American high school math. They integrated it with the Cartesian coordinate system, softened it for teenagers, and shipped it as the New Math. If you took geometry any time in the last sixty years, this is what you got: shapes on a coordinate grid, the distance formula, algebraic proofs.

Euclid's vocabulary survived. His engine was replaced.

## The Cheat Code, and What It Cost

The crucial difference is numbers. Numbers are a cheat code — and that's not an insult. It's a description of exactly what they do.

In Euclid's system, you cannot say "this line segment is 5 centimeters long." You can say it equals another line segment, or that a certain construction procedure yields a segment equal to it, because the logic of the construction forces that to be true. To prove that two sides of a triangle are equal, you have to build an actual argument about *why* they must be.

In modern high school geometry, you find the coordinates of the triangle's vertices and plug them into the distance formula. If the algebra produces identical numbers for two sides, you're done. Proof by arithmetic.

This is not worthless. Coordinate geometry connects to physics, engineering, computer graphics, and virtually everything in modern science. The Cartesian plane is one of the most powerful tools in the mathematical toolkit.

But here is what was quietly discarded: the experience of being genuinely uncertain about something visually obvious, and being forced to resolve that uncertainty through pure logic rather than measurement. The experience of learning that your intuitions can be systematically wrong, and that the only reliable tool is an explicit, checkable argument.

Euclid taught students to distrust their visual intuition and work only from what they could logically demonstrate. Modern geometry taught students to check their work by computing it twice. These are different skills. We kept one and discarded the other — and the one we discarded was the one that transfers.

The modern geometry student learns to verify conclusions they already believe. The Euclidean student learns to discover conclusions that the logic makes unavoidable. The first is useful. The second changes how you think about everything.

## The Abacus Parallel

We build math education software, so it's worth being direct about why this history matters to us.

The abacus is often dismissed as a historical curiosity — a calculator that predates calculators. This misses what it actually is. Skilled soroban operators routinely outpace electronic calculators in competition: because each bead movement is simultaneously input and computation, there is no separate entry-then-operate step. The abacus is not a slower predecessor to the calculator. It is a different kind of tool entirely.

What a calculator cannot do is make the *structure* of arithmetic visible and physically manipulable. A calculator is a black box: you feed it numbers, it returns answers, and nothing about the process teaches you anything about why the answer is what it is.

When a child uses an abacus to add 27 and 14, they're not retrieving a fact from memory. They're moving beads according to the rules of place value and regrouping, step by step, seeing concretely why carrying works — not just that it does. The ones column fills past ten, beads are exchanged for a single bead in the tens column, and the logic of base-10 becomes something you can touch and reason about, not merely execute.

This is the compass-and-straightedge approach to arithmetic: construct the answer from first principles, making every step of the reasoning explicit and visible, rather than invoking an opaque procedure. The value is not efficiency — though the efficiency is real — it is structural understanding. The kind that transfers. The kind that doesn't collapse the moment a problem looks slightly different from the ones you practiced.

The pressure to replace it with memorized facts and calculators follows the exact same logic that replaced Euclid with coordinate algebra: more convenient, easier to grade, better aligned with standardized tests. And it produces the same casualty: students who can execute procedures correctly without understanding why those procedures work.

## The Cost of Quiet Decisions

We did not deliberately murder logic education. We made a series of individually defensible decisions — fix Euclid's logical gaps, connect geometry to algebra, prepare students for the modern world — and the accumulated result was that the one subject in the standard curriculum that trained proof-construction as a cognitive skill vanished without anyone intending that outcome.

What replaced it looks like math class. It has theorems. It has proofs. Students write two-column justifications with "Reasons" columns. But the proofs start after you already know the answer from a diagram or computation, and they are exercises in justifying what you already believe. The cognitive activity is validation, not discovery. You check whether your answer is consistent, not whether your reasoning is necessary.

The curriculum achieved its practical goals. Students learned to use coordinates, apply formulas, and connect geometry to algebra. They were better prepared for calculus and engineering than Euclid's students would have been.

What they were less prepared for — what an entire generation was less prepared for — will be the subject of [Part 2](/blog/testing-is-not-proof).
