# Publication Plan: Constrained 2D Pedagogical Difficulty System

**Status**: Planning Stage
**Created**: November 2025
**Last Updated**: November 2025

## Related Files

- **Implementation**: [difficultyProfiles.ts](./difficultyProfiles.ts) - Core constraint system
- **UI**: [ConfigPanel.tsx](./components/ConfigPanel.tsx) - Split button interface + debug graph
- **Specification**: [SMART_DIFFICULTY_SPEC.md](./SMART_DIFFICULTY_SPEC.md) - Complete technical spec
- **Verification**: [scripts/traceDifficultyPath.ts](../../../../../scripts/traceDifficultyPath.ts) - Path visualization
- **Live Demo**: https://abaci.one/create/worksheets/addition

## The Innovation

### What We Built

A **constrained 2D pedagogical space** for addition worksheet difficulty that treats difficulty as two independent-but-constrained dimensions:

1. **Challenge Axis** (Regrouping): Problem complexity (0-18 levels)
2. **Support Axis** (Scaffolding): Visual aids and guidance (0-12 levels)
3. **Constraint Band**: Diagonal zone of valid (Challenge, Support) pairs

**Key Insight**: Higher challenge requires lower support (and vice versa), encoding pedagogical principles directly into the difficulty space.

### Why This Matters

**Problem with traditional 1D difficulty**:

- Conflates problem complexity with instructional support
- Can't differentiate "ready for harder problems but still needs visual aids" from "struggling with current level"
- Forces teachers into one-size-fits-all progression

**Our 2D approach enables**:

- Dimension-specific adjustments (challenge-only, support-only, or both)
- Pedagogically-valid combinations only (no "hard problems + max scaffolding" or "easy problems + zero support")
- Precise differentiation for individual student needs

### Theoretical Foundation

- **Zone of Proximal Development** (Vygotsky): Constraint band represents learnable space
- **Cognitive Load Theory** (Sweller): Balance intrinsic load (challenge) vs extraneous load (from poor scaffolding)
- **Scaffolding Fading** (Wood, Bruner, Ross): Support should decrease as mastery develops

## Publication Venues (Ranked by Fit)

### 1. ACM Learning @ Scale (L@S) - **BEST FIT**

**Why**: Novel systems for scalable personalized learning
**Format**:

- Full paper: 10 pages
- Work-in-Progress: 4 pages (easier entry point)

**Timeline**:

- Conference: June annually
- Submission: ~January
- Reviews: March
- Camera-ready: April

**What they want**:

- Novel educational technology systems
- Learning theory grounding
- Evidence of impact (can be preliminary for WiP)
- Scalability considerations

**URL**: https://learningatscale.acm.org/

**Strategy**: Submit WiP paper January 2026, full paper 2027 (with evaluation data)

### 2. International Journal of Artificial Intelligence in Education (IJAIED)

**Why**: AI-driven adaptive learning systems
**Format**: Full article (25-40 pages typical)
**Timeline**: Rolling submissions, 3-6 month review
**URL**: https://link.springer.com/journal/40593

**What they want**:

- Computational/algorithmic contributions
- Strong theoretical framework
- Empirical validation required

**Strategy**: Target after teacher study (2026-2027)

### 3. Learning Analytics & Knowledge (LAK) Conference

**Why**: Data-driven educational design
**Format**: Full paper (8-10 pages) or short (4 pages)
**Timeline**: Annual (March), submission ~October
**URL**: https://www.solaresearch.org/events/lak/

**What they want**:

- Use of learning analytics in design
- Evidence from usage data
- Insights from student/teacher behavior

**Strategy**: After collecting usage logs and learning outcome data

### 4. Journal of Educational Technology & Society (ETS)

**Why**: Educational technology innovations
**Format**: ~20 pages, open access
**Timeline**: Rolling submissions
**URL**: https://www.j-ets.net/

**Strategy**: Backup venue if conference submissions don't work

## What We Have vs. What We Need

### ✅ Already Have

1. **Working Implementation**
   - Core constraint system ([difficultyProfiles.ts](./difficultyProfiles.ts))
   - Teacher-facing UI with split buttons ([ConfigPanel.tsx](./components/ConfigPanel.tsx))
   - Debug tools (clickable graph, trace script)
   - Live at https://abaci.one/create/worksheets/addition

2. **Technical Documentation**
   - Complete specification ([SMART_DIFFICULTY_SPEC.md](./SMART_DIFFICULTY_SPEC.md))
   - Algorithm descriptions
   - Architecture rationale

3. **Theoretical Framework**
   - ZPD mapping
   - Cognitive load theory connections
   - Scaffolding fading principles

### ⏳ Need for Publications

#### For Work-in-Progress Paper (4 pages, Jan 2026):

1. **Design Rationale** (1-2 pages)
   - Why 2D vs 1D?
   - How did we derive the constraint band?
   - What design alternatives did we consider?

2. **Related Work** (1 page)
   - Intelligent Tutoring Systems (ALEKS, ASSISTments, etc.)
   - Khan Academy's mastery learning
   - Adaptive difficulty systems
   - How is our approach different/better?

3. **Usage Scenarios** (0.5 pages)
   - Example teacher workflows
   - Screenshots showing the interface
   - How teachers would use dimension-specific adjustments

4. **Preliminary Evaluation** (0.5 pages)
   - Your own testing
   - Initial teacher feedback (if we can get some)
   - Identified limitations

#### For Full Research Paper (10 pages, 2027):

1. **Teacher Study** (Required)
   - 10-15 teachers using the system
   - Interview data: How did they use it? Was 2D helpful?
   - Usage logs: Which modes did they use? Navigation patterns?
   - Comparison group: Teachers using 1D slider version

2. **Student Learning Outcomes** (Ideal)
   - 40-60 students
   - Pre/post assessments
   - Compare: 2D constrained vs 1D slider vs fixed difficulty
   - Track learning trajectories over 6-8 weeks

3. **Quantitative Analysis**
   - Statistical significance of learning gains
   - Teacher satisfaction surveys
   - Student engagement metrics

## Publication Paths (3 Options)

### Path 1: Quick Impact (6 months) - **RECOMMENDED TO START**

**Timeline**:

- **Now - Dec 2025**: Write blog post + gather initial feedback
- **Dec 2025 - Jan 2026**: Write 4-page WiP paper
- **Jan 2026**: Submit to ACM L@S WiP track
- **Mar 2026**: Reviews back
- **Jun 2026**: Present at L@S (if accepted)

**Deliverables**:

1. Blog post explaining the system (for teachers/educators)
2. 4-page WiP paper (academic audience)
3. Presentation at L@S

**Effort**: ~40 hours writing + travel to conference

**Outcome**:

- Get idea into academic discourse
- Receive feedback from learning science researchers
- Build credibility for follow-up work

### Path 2: Full Research Study (12-18 months)

**Timeline**:

- **Nov 2025 - Jan 2026**: IRB approval (if university-affiliated)
- **Jan - Mar 2026**: Recruit teachers (10-15)
- **Mar - May 2026**: Teacher study
  - Give access to system
  - Weekly check-ins
  - Usage log collection
  - End-of-study interviews
- **Jun - Aug 2026**: Analysis + paper writing
- **Sep 2026**: Submit to IJAIED or LAK 2027
- **2027**: Publication

**Deliverables**:

1. IRB protocol + approval
2. Teacher recruitment materials
3. Interview protocol
4. Usage log analysis pipeline
5. 25-40 page research paper

**Effort**: ~200-300 hours + IRB overhead

**Outcome**:

- Peer-reviewed empirical research paper
- Strong evidence for effectiveness claims
- Foundation for future grant proposals

### Path 3: Open Source + Community (Immediate) - **ALSO RECOMMENDED**

**Timeline**:

- **This week**: Write comprehensive blog post
- **Ongoing**: Share on HN, Teacher Twitter, EdTech Reddit
- **Ongoing**: Respond to feedback, track usage

**Deliverables**:

1. Blog post (~2000 words)
   - Problem statement
   - System design
   - How to use it
   - Theoretical grounding
2. Social media campaign
3. Outreach to homeschool/teacher communities

**Effort**: ~20 hours initial + ongoing engagement

**Outcome**:

- Organic user base
- Real-world feedback
- Potential citations/adoption
- Informal peer review

## Recommended Strategy

**Do Paths 1 + 3 in parallel**:

1. **This Week** (Path 3):
   - Write blog post explaining the system
   - Share widely to get feedback
   - Start tracking usage/interest

2. **December 2025** (Path 1):
   - Draft 4-page WiP paper
   - Include preliminary feedback from blog responses
   - Submit to L@S in January

3. **Spring 2026** (Path 1):
   - Present at L@S (if accepted)
   - Get feedback from researchers
   - Build network in learning sciences

4. **Summer 2026** (Evaluate):
   - If system gains users → Path 2 (research study)
   - If limited adoption → Iterate on design
   - If strong conference feedback → Target full paper

## How to Execute: WiP Paper (January 2026)

### Paper Structure (4 pages)

**1. Introduction (0.75 pages)**

- Problem: 1D difficulty conflates challenge and support
- Our solution: Constrained 2D space
- Contribution: Novel UI paradigm + theoretical framework

**2. Related Work (0.75 pages)**

- Intelligent Tutoring Systems (ALEKS, Carnegie Learning)
- Adaptive learning platforms (Khan Academy, Duolingo)
- Difficulty calibration research (IRT, Elo rating)
- Gap: No systems separate challenge from scaffolding

**3. System Design (1.5 pages)**

- Hybrid discrete/continuous architecture
- Constraint band derivation
- Movement modes (both/challenge/support)
- Split button UI design
- Screenshot of interface

**4. Theoretical Framework (0.5 pages)**

- ZPD mapping to constraint band
- Cognitive load theory justification
- Scaffolding fading principles

**5. Preliminary Evaluation (0.3 pages)**

- Your testing experience
- Initial teacher feedback (if available)
- Identified use cases

**6. Discussion & Future Work (0.2 pages)**

- Planned teacher study
- Potential for other domains
- Limitations and next steps

### Writing Timeline

**Week 1 (Dec 2-8)**:

- Draft sections 1-2 (intro + related work)
- Literature search for related systems

**Week 2 (Dec 9-15)**:

- Draft section 3 (system design)
- Create figures/screenshots

**Week 3 (Dec 16-22)**:

- Draft sections 4-6
- Get feedback from educator friends

**Week 4 (Dec 23-Jan 5)**:

- Revise based on feedback
- Polish writing
- Format for L@S template

**Jan 6-10, 2026**:

- Final read-through
- Submit to L@S WiP track

## How to Execute: Blog Post (This Week)

### Blog Structure (~2000 words)

**Title**: "Beyond Easy and Hard: A 2D Approach to Worksheet Difficulty"

**1. The Problem** (400 words)

- Teachers need to differentiate instruction
- Current tools: "easy/medium/hard" or 1-5 sliders
- Real teaching scenario: Student ready for harder problems but still needs visual aids
- Can't express this with 1D slider

**2. Our Solution** (600 words)

- Two dimensions: Challenge (problem complexity) vs Support (scaffolding)
- Constraint band: Not all combinations are pedagogically valid
- Split button interface: Default (both) or dimension-specific
- Screenshots showing the UI

**3. Theoretical Grounding** (400 words)

- Why this maps to learning theory (ZPD, cognitive load)
- How constraints encode teaching expertise
- Connection to scaffolding fading

**4. How to Use It** (400 words)

- Walkthrough: Creating a worksheet
- Examples of when to use challenge-only vs support-only
- Clicking on the 2D graph (debug feature)

**5. Try It Yourself** (200 words)

- Link to live demo
- Open source code
- Invitation for feedback

### Distribution Channels

- **Your blog** (if you have one)
- **Medium** (cross-post for reach)
- **Hacker News** (Show HN: A 2D difficulty system for math worksheets)
- **Reddit**: r/teachers, r/homeschool, r/education
- **Twitter/X**: Thread with screenshots
- **LinkedIn** (if you're active there)

## Success Metrics

### Short-term (3 months)

- [ ] Blog post published and shared
- [ ] 50+ teachers try the system
- [ ] 5+ pieces of detailed feedback
- [ ] WiP paper submitted to L@S

### Medium-term (1 year)

- [ ] WiP paper accepted and presented
- [ ] 200+ teachers using the system
- [ ] Teacher study conducted (if pursuing Path 2)
- [ ] Full paper submitted to journal/conference

### Long-term (2-3 years)

- [ ] Peer-reviewed research publication
- [ ] System adopted by curriculum companies
- [ ] Citations from other researchers
- [ ] Follow-up studies by other groups

## Resources Needed

### For WiP Paper

- **Time**: ~40 hours writing
- **Cost**: Conference registration (~$500-800) + travel (~$1000-2000)
- **Skills**: Academic writing (you + me collaborating)

### For Teacher Study

- **Time**: ~200-300 hours over 6 months
- **Cost**: Teacher incentives ($50/teacher × 15 = $750)
- **Skills**: Qualitative research methods
- **Optional**: IRB approval (if university-affiliated)

### For Blog/Outreach

- **Time**: ~20 hours initial
- **Cost**: $0 (all free platforms)
- **Skills**: Technical writing, social media engagement

## Next Steps

**Immediate (This Week)**:

1. [ ] Draft blog post outline
2. [ ] Take screenshots of the UI in action
3. [ ] Create 2-3 usage scenarios with example teacher workflows

**December 2025**:

1. [ ] Publish blog post + share widely
2. [ ] Start WiP paper draft
3. [ ] Conduct literature review for related work

**January 2026**:

1. [ ] Complete WiP paper
2. [ ] Submit to ACM L@S
3. [ ] Evaluate user feedback from blog post

## Questions to Consider

1. **Do you have academic affiliation?**
   - Needed for IRB approval (teacher study)
   - Some conferences require institutional affiliation
   - Can collaborate with university researchers if not

2. **What's your bandwidth?**
   - WiP paper: ~10 hours/week for 4 weeks
   - Teacher study: ~10-15 hours/week for 6 months
   - Blog post: ~10 hours total

3. **What's your goal?**
   - Academic credibility → Prioritize WiP paper
   - Real-world impact → Prioritize blog + outreach
   - Research career → Prioritize full study
   - All of the above → Do Path 1 + 3, then evaluate

4. **Do you want to recruit teachers now?**
   - Could start informal study alongside blog post
   - Interview 5-10 teachers who use the system
   - Include in WiP paper as preliminary findings

## Conclusion

We have a genuinely novel contribution that combines:

- **Theoretical rigor** (learning science foundations)
- **Technical innovation** (constrained 2D space + hybrid architecture)
- **Practical utility** (working system teachers can use today)

This is publishable material. The question is timeline and effort:

- **Lowest effort**: Blog post + social sharing (~20 hours)
- **Medium effort**: Blog + WiP paper (~60 hours + travel)
- **High effort**: Full research study (~300 hours over 18 months)

**My recommendation**: Start with blog + WiP paper (Paths 1 + 3). This gets the idea into academic circulation with minimal risk, while building the foundation for a larger study if the system gains traction.

Would you like help drafting the blog post or WiP paper outline?
