---
title: 'Testing Is Not Proof (And We All Know It)'
description: >-
  An entire industry decided that proving software correctness was too fussy for
  the real world. That decision has roots going back to a geometry curriculum
  change most engineers never knew happened. Part 2 of 2.
author: Abaci.one Team
publishedAt: '2026-02-24'
updatedAt: '2026-02-24'
tags:
  - software
  - education
  - history
  - mathematics
  - engineering
featured: false
heroPrompt: >-
  A dramatic low-angle cinematic photograph of an enormous teetering tower of
  mismatched computer servers, circuit boards, monitors, hard drives, and
  electronic components stacked precariously many stories high, illuminated from
  within by blue and amber warning lights against a pitch-black background. Fraying
  cables snake between components. The structure looks operational but moments from
  collapse, held together by improvisation. Photorealistic, cinematic lighting,
  wide-angle distortion that emphasizes the impossible height.
---

> *"Program testing can be used to show the presence of bugs, but never to show their absence."*
> — Edsger W. Dijkstra, 1969

Most software is broken. Not catastrophically, not constantly — but in the corners, in the edge cases, in the states nobody anticipated. Broken in ways that accumulate: data corruption that surfaces six months later, security vulnerabilities that live in production for years before discovery, race conditions that only appear under specific load patterns that never showed up in a test environment.

We have normalized this. We call it shipping. We have an entire engineering culture — sprint cycles, incident postmortems, hotfix deploys, error monitoring dashboards — built on the assumption that software will be wrong when it ships and will be made progressively less wrong over time through user-reported bugs and reactive debugging.

The Dijkstra quote appears constantly in textbooks, conference talks, and engineering blog posts. Engineers nod along. Then they write more tests and ship the feature.

This is not stupidity. But it is worth asking where it came from.

## The Field That Exists

There is a branch of computer science called formal verification. It has been around since the 1960s. Using tools like TLA+, Coq, Lean, or Agda, you don't write code and then test it — you write mathematical proofs that your program cannot enter an invalid state. Not "we haven't found a case where it fails." *We have proven it cannot fail in the following ways.*

This is not theoretical. Amazon uses TLA+ to specify and verify distributed system protocols before implementing them. The seL4 microkernel — used in safety-critical embedded systems — has a machine-checked proof of functional correctness: every function does exactly what its specification says it does, provably, with no exceptions. Airbus uses formal methods for flight control software. NASA uses them for spacecraft.

The pattern is consistent: we deploy formal verification exclusively when failure means death or financial catastrophe at scale. For the other 99% of software, we write tests and watch the error logs.

## Why Testing Won

The economic argument for this situation is coherent. Formal verification is slow. It requires specialists. It requires writing a formal specification of what "correct" even means before you write a line of code — a discipline that is itself difficult and time-consuming. And correctness, in most commercial contexts, is not what the market rewards.

What the market rewards is shipping. If you spend six months formally verifying your payment processing logic, your competitor ships a buggier payment processor in six weeks, captures the market, and patches bugs reactively as users discover them. The cost of imperfect software — user frustration, occasional data loss, incident response — is lower than the cost of the delay. The economics are ruthless and not obviously wrong.

So testing won. Not because testing is epistemologically adequate — Dijkstra established that it isn't — but because testing is cheap, fast, and good enough that the remaining failure modes are commercially acceptable. We write tests to demonstrate that the system works under expected conditions, and we accept that unexpected conditions will produce bugs, which we will fix.

This is a rational industrial policy. It is also a profound epistemic compromise that we rarely call by its name.

## Where the Culture Came From

Here's the part that goes beyond economics.

The "ship it and fix bugs" culture is not purely a rational response to market incentives. It is also the product of an educational system that never taught engineers that proving correctness is possible, let alone worth attempting.

Think about what formal verification actually requires at its core: you have to specify what "correct" means before you build the thing. You have to make your assumptions about valid states completely explicit. You have to construct an argument — not a test suite, an *argument* — that demonstrates your implementation satisfies its specification. This is, structurally, the activity of writing a Euclidean proof applied to software: start from axioms, build deductive chains, arrive at necessary conclusions.

The engineers who build software went to school. In school, they took geometry. And in geometry, they were not taught to do this.

As [Part 1 of this series](/blog/the-logic-class-we-quietly-canceled) describes, the geometry curriculum was reorganized in the 1960s around Birkhoff's number-based axioms and the Cartesian coordinate system. Two-column proofs survived, but in a form where you already knew the answer from the diagram and were constructing a justification for what you already believed. The experience of starting with genuine uncertainty and resolving it through pure logic — of building an argument that forces a conclusion — was largely replaced by algebraic verification.

Students came away able to execute mathematical procedures but inexperienced at constructing arguments about systems they couldn't fully see.

Those students became engineers. And they brought their epistemology with them: you check that something works by running it and seeing what breaks. The idea that you might instead prove it cannot break — by constructing an explicit argument from a formal specification — is culturally coded as academic impracticality. Not "this requires resources we don't have" but "this is the kind of thing only theorists do, not engineers solving real problems."

That's a cultural attitude, not an economic calculation. And it has roots in what we taught — or failed to teach — a generation of people about what rigorous reasoning even is.

## The Compounding Problem

The situation is now compounding.

We are building AI systems to write more code, faster. AI coding assistants can generate functional implementations of complex systems in seconds. They catch certain categories of errors. They are genuinely impressive tools.

What they cannot do is prove correctness. They produce code that works in the cases their training data covered and fails in others. The failure modes are often subtle and hard to anticipate without thinking carefully about the problem's invariants — which is precisely the habit that formal verification practice builds and that most AI-assisted development workflows skip entirely.

We are automating the production of software nobody proved was correct, using models trained on software nobody proved was correct, to ship even faster.

This is not necessarily catastrophic. Iteration is a real strategy. Systems can be made robust through testing, redundancy, graceful degradation, and rapid incident response. Modern engineering has learned a great deal about making unreliable components reliable in aggregate. But we are building an enormous amount of critical infrastructure — financial systems, medical records, communications, power grids — on a foundation of "tested but not proven," and the engineers making architectural decisions about that infrastructure were educated to think this is simply how software works.

It's how software works because we decided it would be.

## What This Actually Looks Like in Practice

We build educational software. We're not claiming special virtue here — our test suite has gaps, our code has edge cases we haven't covered, we have had production bugs. The economics apply to us as much as anyone.

But we try to ask, before writing code: *what would it mean for this to be correct?*

Not "what does this do?" — tests answer that. What are the invariants? What states should never occur? If this function gets called with unexpected input, what happens and what should happen? What's the implicit specification we've been carrying around in our heads without writing down?

This doesn't require TLA+ or Coq. It just requires the habit — the cognitive reflex — of thinking about correctness as a concept rather than a property you discover by running things. The habit of making hidden assumptions explicit, because hidden assumptions in a proof are where proofs fail, and hidden assumptions in software are where software fails.

That reflex is what Euclidean proof practice builds. You learn to be suspicious of your intuitions. You learn that "it seems to work" and "it must work" are different claims — and that the gap between them is the whole ballgame.

We lost the class that built that reflex. An entire industry runs on its absence.

## The Trade We Made

The standard defense of where we ended up is pragmatic: formal verification is expensive, testing is adequate, iteration is powerful, the market has spoken. All of this is true.

But "the market has spoken" is a description of an outcome, not a justification for it. Markets optimize for what they can measure and reward in the short term. They don't optimize for correctness; they optimize for appearing correct long enough to ship. The failures are real and persistent, and we have normalized them.

The geometry curriculum change of the 1960s and the culture of software engineering in the 2020s look, at first glance, like completely unrelated phenomena separated by sixty years. They're not. One produced the other — not through direct causation, but through the slow erosion of a cognitive skill that was never replaced with anything equivalent.

We traded a two-thousand-year technology for teaching rigorous reasoning for a more practical curriculum. We got engineers who are very good at building things and not quite sure how to think about whether those things work.

The software works well enough that the trade looks justified. It fails often enough that we might reasonably wonder whether we got the better end of it.
