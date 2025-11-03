# Platform Integration Roadmap

**Project:** Soroban Abacus Flashcards - Arcade Games Platform
**Focus Areas:** Educational Platform SSO & Game Distribution Channels
**Document Version:** 1.0
**Last Updated:** 2025-11-02

---

## Executive Summary

This roadmap outlines integration strategies for four major platform categories to expand reach and player acquisition:

1. **Google Classroom Integration** - Direct access to teachers and students
2. **Clever/ClassLink SSO** - K-12 institution single sign-on (massive reach)
3. **Game Distribution Portals** - CrazyGames, Poki, Kongregate (casual player discovery)
4. **Steam Distribution** - Educational game marketplace with social features

**Estimated Total Timeline:** 6-9 months for full implementation
**Estimated Total Cost:** $600-1,500 (app fees + hosting)
**Expected Impact:** 10x-100x increase in player discovery reach

---

## Platform #1: Google Classroom Integration

### Overview

Google Classroom API enables teachers to:
- Import game rooms directly into their classes
- Auto-create student accounts with SSO
- Track student progress and scores
- Assign abacus practice as homework

**Target Audience:** 150+ million students and teachers using Google Classroom globally

### Technical Requirements

**Prerequisites:**
- Google Cloud Platform (GCP) project
- OAuth 2.0 implementation
- Google Classroom API access
- HTTPS endpoints

**API Capabilities Needed:**
- Courses API (read class rosters)
- Coursework API (create assignments)
- Students API (manage student accounts)
- Submissions API (track game completion)

### Implementation Phases

#### Phase 1: Basic OAuth & SSO (2-3 weeks)
**Tasks:**
1. Set up GCP project and enable Classroom API
2. Implement OAuth 2.0 "Sign in with Google" flow
3. Add Classroom scope permissions (`classroom.courses.readonly`, `classroom.rosters.readonly`)
4. Create user account mapping (Google ID → Internal User ID)
5. Test with sandbox Google Workspace account

**Deliverables:**
- "Sign in with Google" button on login page
- Auto-account creation for Google users
- Basic profile sync (name, email, photo)

**Effort:** 40-60 hours
**Cost:** $0 (Google API is free for educational use)

#### Phase 2: Class Import & Roster Sync (3-4 weeks)
**Tasks:**
1. Build UI for teachers to import Classroom rosters
2. Implement Courses API integration (list teacher's classes)
3. Create room auto-provisioning from class data
4. Set up automatic roster synchronization (daily sync)
5. Handle student account creation/deactivation
6. Add class management dashboard for teachers

**Deliverables:**
- "Import from Google Classroom" feature
- Teacher dashboard showing all imported classes
- Automatic student account provisioning
- Daily roster sync (new students, removed students)

**Effort:** 80-100 hours
**Cost:** $0

#### Phase 3: Assignment Integration (3-4 weeks)
**Tasks:**
1. Build "Assign to Classroom" feature for game rooms
2. Implement Coursework API integration
3. Create assignment templates for each game type
4. Build grade sync (game scores → Classroom grades)
5. Add completion tracking and submission API integration
6. Create teacher analytics dashboard

**Deliverables:**
- Teachers can push game assignments to Classroom
- Students see assignments in Classroom feed
- Automatic grade passback on game completion
- Teacher analytics (who played, scores, time spent)

**Effort:** 100-120 hours
**Cost:** $0

#### Phase 4: Deep Integration & Polish (2-3 weeks)
**Tasks:**
1. Add "Share Turn" notifications (via Classroom API announcements)
2. Implement progress tracking dashboard
3. Create teacher resource library (lesson plans, tutorials)
4. Add student portfolio (history of games played)
5. Build reporting exports (CSV, PDF)
6. Classroom API webhook integration for real-time updates

**Deliverables:**
- Comprehensive teacher dashboard
- Student progress portfolios
- Automated reporting
- Real-time roster updates

**Effort:** 60-80 hours
**Cost:** $0

### Total Timeline: 10-14 weeks
### Total Effort: 280-360 hours
### Total Cost: $0

### Dependencies

- Existing user authentication system (✓ NextAuth in place)
- Room management system (✓ exists)
- Score/progress tracking (✓ exists per game)
- Email notification system (partially implemented)

### Risks & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| OAuth complexity | Medium | Medium | Use official Google client libraries |
| API rate limits | Low | Low | Implement caching and batch requests |
| Grade sync errors | High | Medium | Add retry logic and error notifications |
| Teacher adoption | High | High | Create detailed onboarding videos |
| Privacy compliance (COPPA) | Critical | Medium | Implement parent consent workflows |

### Success Metrics

- **Adoption:** 100+ teachers in first 3 months
- **Usage:** 50+ classes imported
- **Retention:** 70%+ of teachers assign games monthly
- **Referrals:** 20% teacher-to-teacher referrals

---

## Platform #2: Clever & ClassLink SSO

### Overview

**Clever:** SSO platform serving 75% of U.S. K-12 schools (13,000+ districts)
**ClassLink:** SSO platform serving 20+ million students globally

Both provide instant access to school rosters without manual setup.

**Key Benefits:**
- Zero teacher setup (IT manages access)
- Automatic roster sync
- Instant student login (no passwords)
- District-wide deployment capability

### Technical Requirements

**Clever Requirements:**
- OAuth 2.0 implementation
- REST API integration
- HTTPS endpoints
- District SSO certification

**ClassLink Requirements:**
- SAML 2.0 support (or OAuth/OpenID Connect)
- OneRoster API integration (for roster sync)
- ClassLink Management Console access

### Implementation Phases

#### Phase 1: Clever District SSO (4-5 weeks)

**Tasks:**
1. Register as Clever developer (dev.clever.com)
2. Implement OAuth 2.0 authorization grant flow
3. Add "Log in with Clever" button
4. Integrate Clever Data API v3.1
   - Districts API
   - Schools API
   - Students/Teachers API
   - Sections API (classes)
5. Build user account mapping (Clever ID → Internal ID)
6. Create development environment with sandbox district
7. Implement district admin dashboard
8. Apply for District SSO certification

**API Scopes Required:**
- `read:district_admins_basic`
- `read:school_admins_basic`
- `read:students_basic`
- `read:teachers_basic`
- `read:user_id`
- `read:sis` (for full roster data)

**Deliverables:**
- "Log in with Clever" SSO
- Automatic account creation
- District/school/class hierarchy sync
- Certified for live district connections

**Effort:** 100-120 hours
**Cost:** $0 (Clever is free for developers)

#### Phase 2: ClassLink SAML Integration (3-4 weeks)

**Tasks:**
1. Set up SAML 2.0 service provider
2. Register with ClassLink SSO Library
3. Implement SAML authentication flow
4. Add "Log in with ClassLink" button
5. Integrate OneRoster API for roster sync
6. Build automated roster update system
7. Create ClassLink admin dashboard
8. Submit to ClassLink SSO Library (6,000+ app directory)

**Deliverables:**
- "Log in with ClassLink" SSO
- OneRoster-based roster sync
- Listed in ClassLink SSO Library

**Effort:** 80-100 hours
**Cost:** $0

#### Phase 3: Advanced Features (2-3 weeks)

**Tasks:**
1. Implement shared device support (session override)
2. Add UTF-8 character support for names
3. Build district admin analytics dashboard
4. Create automated onboarding emails for admins
5. Add Clever/ClassLink badge to marketing site
6. Build compliance documentation (FERPA, COPPA)

**Deliverables:**
- Production-ready SSO for both platforms
- District admin tools
- Compliance documentation

**Effort:** 60-80 hours
**Cost:** $0

### Total Timeline: 9-12 weeks
### Total Effort: 240-300 hours
### Total Cost: $0

### Dependencies

- SAML library (e.g., `passport-saml` for Node.js)
- OAuth 2.0 implementation (can reuse from Google Classroom)
- Secure session management
- Database schema for district/school/class hierarchy

### Risks & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Certification delays | High | Medium | Start certification process early |
| SAML complexity | Medium | Medium | Use established libraries (passport-saml) |
| District adoption | High | Medium | Partner with early adopter districts |
| Privacy regulations | Critical | Medium | Legal review of terms/privacy policy |
| Competing apps | Medium | High | Emphasize unique abacus/math focus |

### Success Metrics

- **Listings:** Published in both app directories
- **Certification:** Clever District SSO certified
- **Districts:** 10+ districts in first 6 months
- **Students:** 5,000+ student logins in first year
- **Retention:** 60%+ district renewal rate

---

## Platform #3: Game Distribution Portals

### Overview

Three major browser game portals with complementary audiences:

1. **CrazyGames:** Open platform, 35M+ monthly users, SDK monetization
2. **Poki:** Curated platform, 50M+ monthly users, 50/50 revenue share, web exclusivity
3. **Kongregate:** Legacy platform, 20M+ monthly users, now requires pre-approval

**Target Audience:** Casual gamers discovering educational games through play

### Platform Comparison

| Feature | CrazyGames | Poki | Kongregate |
|---------|------------|------|------------|
| **Selectivity** | Moderate | High (curated) | High (email approval) |
| **File Size** | Strict limits | <8MB initial | ~1100x700px max |
| **Exclusivity** | None | Web exclusive | None |
| **Revenue** | SDK ads | 50/50 split | Ads + Kreds |
| **SDK Required** | Yes | Yes | Yes |
| **Approval Time** | 1-2 weeks | 2-4 weeks | Varies |

### Technical Requirements (Common)

**All Platforms:**
- HTML5/WebGL build
- Save system (localStorage/cloud)
- Ad integration (SDK provided)
- Mobile responsive design
- HTTPS hosting
- No external monetization UI

**CrazyGames Specific:**
- CrazyGames SDK integration
- File size optimization
- Ad placements (banner, interstitial, rewarded)
- Leaderboard integration

**Poki Specific:**
- Poki SDK integration
- <8MB initial download (critical!)
- Auto-detect mobile devices
- Remove any IAP UI elements
- Web exclusivity agreement

**Kongregate Specific:**
- Pre-approval via BD@kongregate.com
- Kongregate API integration
- Badge system integration
- Kreds (virtual currency) support optional
- "initialized" stat tracking

### Implementation Phases

#### Phase 1: Game Optimization & SDK Prep (3-4 weeks)

**Tasks:**
1. Audit current build sizes (check all games)
2. Implement code splitting and lazy loading
3. Optimize assets (image compression, audio formats)
4. Create lightweight "portal build" configuration
5. Build asset CDN strategy
6. Implement progress save system (if not present)
7. Add mobile detection and responsive layouts
8. Create build pipeline for portal releases

**Target Build Sizes:**
- Initial load: <5MB (to meet Poki's <8MB requirement)
- Full game: <20MB
- Individual game assets: lazy loaded

**Deliverables:**
- Optimized builds for each game
- Build pipeline for portal releases
- Mobile-responsive UI for all games

**Effort:** 80-100 hours
**Cost:** $0

#### Phase 2: CrazyGames Integration (2-3 weeks)

**Tasks:**
1. Register at CrazyGames developer portal
2. Integrate CrazyGames SDK
   - Ad placements (banner, interstitial, rewarded)
   - Game analytics
   - User progression tracking
3. Submit best-performing games:
   - Matching Pairs Battle (most casual-friendly)
   - Complement Race (fast-paced)
   - Card Sorting (quick sessions)
4. Create game pages with descriptions/screenshots
5. Pass technical review and QA
6. Launch and monitor metrics

**Deliverables:**
- 3 games live on CrazyGames
- SDK integration complete
- Ad monetization active

**Effort:** 60-80 hours
**Cost:** $0

#### Phase 3: Poki Integration (3-4 weeks)

**Tasks:**
1. Submit application via Poki game submission form
2. Wait for curator review (2-4 weeks)
3. If approved, integrate Poki SDK
   - Ad integration (Poki manages monetization)
   - Analytics tracking
   - Commerce API (if applicable)
4. Agree to web exclusivity terms
5. Optimize games to <8MB initial load (critical!)
6. Remove any competing monetization UI
7. Submit games for final review
8. Launch on Poki

**Deliverables:**
- 2-3 games live on Poki (start with best performers)
- Poki SDK integration
- Revenue share active (50/50 split)

**Effort:** 80-100 hours
**Cost:** $0
**Note:** Approval not guaranteed - Poki is highly selective

#### Phase 4: Kongregate Pre-Approval (2-3 weeks)

**Tasks:**
1. Email BD@kongregate.com with game portfolio
2. Prepare pitch deck:
   - Game trailers/screenshots
   - Unique value proposition (abacus education + multiplayer)
   - Target audience data
   - Existing player metrics
3. Wait for response (varies)
4. If approved, integrate Kongregate API
   - Stats and achievements (badges)
   - Optional: Kreds integration
5. Submit games for review
6. Launch on Kongregate

**Deliverables:**
- Pre-approval from Kongregate
- 1-2 games live on platform
- Badge achievements implemented

**Effort:** 60-80 hours
**Cost:** $0
**Note:** Approval required before development

### Total Timeline: 10-14 weeks
### Total Effort: 280-360 hours
### Total Cost: $0

### Game Prioritization for Submission

**Tier 1 (Submit first):**
1. **Matching Pairs Battle** - Most casual-friendly, clear mechanics
2. **Complement Race** - Fast-paced, competitive, good for short sessions

**Tier 2 (Submit if Tier 1 succeeds):**
3. **Card Sorting** - Simple, quick gameplay
4. **Memory Quiz** - Educational but approachable

**Tier 3 (Hold back):**
5. **Rithmomachia** - Too complex for casual portals, better for Steam

### Dependencies

- Current games must be playable without login (guest mode)
- Mobile responsive design
- Build optimization pipeline
- CDN for asset hosting
- Analytics integration

### Risks & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Poki rejection | Medium | High | Focus on CrazyGames first, apply with best metrics |
| File size requirements | High | Medium | Aggressive asset optimization, code splitting |
| Ad integration conflicts | Medium | Medium | Separate builds per platform |
| Revenue lower than expected | Medium | High | Treat as marketing channel, not primary revenue |
| Web exclusivity limits Steam | High | Low | Don't submit Rithmomachia to Poki |
| Multiplayer sync issues | High | Medium | Add offline/single-player modes |

### Success Metrics

**CrazyGames:**
- **Plays:** 10,000+ plays/month per game
- **Retention:** 30%+ day-1 return rate
- **Revenue:** $200+ monthly from ads

**Poki:**
- **Plays:** 50,000+ plays/month per game
- **Revenue:** $500+ monthly (50/50 split)
- **Rating:** 4.0+ stars

**Kongregate:**
- **Plays:** 5,000+ plays/month
- **Badges:** 3+ achievements per game
- **Revenue:** $100+ monthly

---

## Platform #4: Steam Distribution

### Overview

**Why Steam for Educational Games:**
- 120+ million active users
- Strong social features (friends, achievements, leaderboards)
- Educational games perform well (Kerbal Space Program, Human Resource Machine, etc.)
- One-time purchase model fits premium educational content
- Community features drive multiplayer engagement

**Package Concept:** "Soroban Academy: Mathematical Strategy Games"
- Bundle all games into single Steam app
- Include exclusive Steam features (achievements, leaderboards, cloud saves)
- Highlight Rithmomachia as flagship historical strategy game
- Price point: $9.99-14.99

### Technical Requirements

**Platform:**
- Desktop application (Windows, macOS, Linux)
- No native browser game support

**Packaging Options:**
1. **Electron** (most common for web games)
   - Pros: Easy conversion, full Chromium
   - Cons: Large file size (~100-200MB), memory intensive

2. **Tauri** (modern alternative)
   - Pros: Lightweight (~10MB), uses system WebView
   - Cons: Newer, less Steam integration examples

3. **NW.js** (alternative to Electron)
   - Pros: Similar to Electron, slightly smaller
   - Cons: Less popular, smaller community

**Recommended:** Start with Electron (most proven path for HTML5 → Steam)

**Steamworks Integration:**
- Steam Authentication API
- Steam Achievements API
- Steam Leaderboards API
- Steam Cloud (save sync)
- Steam Friends API (invite friends to games)
- Steam Overlay support

### Implementation Phases

#### Phase 1: Desktop Packaging with Electron (4-5 weeks)

**Tasks:**
1. Set up Electron project
2. Package Next.js app for Electron
3. Configure build pipeline:
   - Windows (x64)
   - macOS (Apple Silicon + Intel)
   - Linux (x64)
4. Handle offline mode and local Socket.io server
5. Implement native window controls
6. Add auto-updater support
7. Test on all platforms
8. Optimize bundle size (<500MB total)

**Deliverables:**
- Desktop app for Windows/macOS/Linux
- Standalone builds (no separate server needed)
- Native app experience

**Effort:** 120-150 hours
**Cost:** $0

#### Phase 2: Steamworks SDK Integration (3-4 weeks)

**Tasks:**
1. Register as Steamworks developer (pay $100 fee)
2. Create Steam app page
3. Integrate Steamworks SDK:
   - Install Greenworks (Electron + Steamworks bridge)
   - Implement Steam Authentication
   - Replace internal auth with Steam accounts
4. Build achievement system:
   - Define 20-30 achievements per game
   - Integrate Steamworks Achievements API
   - Create achievement icons (64x64px)
5. Implement Steam Leaderboards:
   - Per-game leaderboards
   - Global cross-game leaderboard
6. Add Steam Cloud saves:
   - Sync game progress across devices
   - Handle conflict resolution
7. Integrate Steam Friends API:
   - "Invite friend to game room" button
   - Show online friends in lobby
8. Test Steam Overlay functionality

**Deliverables:**
- Full Steamworks integration
- Achievement system (20-30 achievements)
- Steam Leaderboards
- Cloud saves
- Friend invites

**Effort:** 100-120 hours
**Cost:** $100 (Steam Direct fee, one-time, recoupable)

#### Phase 3: Store Page & Marketing Assets (2-3 weeks)

**Tasks:**
1. Create Steam store page:
   - Title: "Soroban Academy: Mathematical Strategy Games"
   - Capsule images (multiple sizes)
   - Hero image / header
   - 5-10 screenshots per game
   - 60-90 second trailer (show all games)
   - Detailed description with educational benefits
   - System requirements
   - Price: $9.99-14.99
2. Write compelling marketing copy
3. Create game trailer (video editing)
4. Design Steam library assets
5. Set up community hub
6. Configure Steam tags:
   - Education, Strategy, Multiplayer, Casual, Math, Board Game
7. Prepare press kit and media

**Deliverables:**
- Complete Steam store page
- Marketing trailer
- Press kit
- Community hub setup

**Effort:** 60-80 hours
**Cost:** $0-300 (if hiring video editor)

#### Phase 4: Steam Review & Launch (2-3 weeks)

**Tasks:**
1. Upload build to Steamworks
2. Set release date (2+ weeks out)
3. Make store page public
4. Submit for Steam review (1-5 days)
5. Address any review feedback
6. Prepare launch marketing:
   - Email existing users
   - Social media campaign
   - Press outreach
   - Reddit/forum posts
   - Product Hunt launch
7. Launch on Steam
8. Monitor reviews and feedback
9. Respond to community
10. Plan post-launch updates

**Deliverables:**
- Live on Steam
- Launch marketing campaign
- Community management process

**Effort:** 60-80 hours
**Cost:** $0-500 (marketing budget)

#### Phase 5: Post-Launch Support (Ongoing)

**Tasks:**
- Weekly bug fixes and patches
- Monthly content updates
- Seasonal events
- New achievements
- Community engagement
- Steam Sale participation
- User feedback integration

**Deliverables:**
- Regular updates
- Active community
- Growing review score

**Effort:** 20-40 hours/month ongoing
**Cost:** $0

### Total Timeline: 11-15 weeks
### Total Effort: 340-430 hours
### Total Cost: $100-900

### Dependencies

- Functioning multiplayer system (✓ exists)
- All games stable and bug-free
- Marketing materials (screenshots, videos)
- Legal documentation (EULA, privacy policy)
- Support email/forum setup

### Risks & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Electron bundle too large | Medium | Medium | Optimize assets, use lazy loading |
| Steamworks integration bugs | High | Medium | Extensive testing, use Greenworks |
| Low sales | High | High | Strong marketing, community building |
| Review bombing | Medium | Low | Active community management |
| Multiplayer server costs | Medium | Medium | P2P option or Steam networking |
| Steam review rejection | High | Low | Follow guidelines strictly |
| Competition from free web version | High | High | Add Steam-exclusive features |

### Pricing Strategy

**Options:**
1. **Premium ($9.99-14.99):** Full game bundle with Steam features
2. **Freemium:** Free base + DLC for premium games
3. **Early Access ($7.99):** Launch at lower price, increase at 1.0

**Recommendation:** Premium $12.99 with frequent sales
- Perceived value: 6 games = ~$2 each
- Recoup $100 fee after 8 sales
- Sales can drive volume (50% off = $6.49)

### Marketing Angles for Steam

1. **Rithmomachia Focus:** "Play the 1,000-year-old medieval chess"
2. **Educational Value:** "Math learning disguised as strategy gaming"
3. **Multiplayer Fun:** "Challenge friends in mathematical duels"
4. **Historical Gaming:** "Rediscover forgotten board games"
5. **Family Friendly:** "Safe, educational gaming for all ages"

### Success Metrics

**Launch Goals:**
- **Wishlist:** 1,000+ before launch
- **Sales:** 500+ units in first month
- **Reviews:** 50+ reviews, 85%+ positive
- **Revenue:** $5,000+ in first quarter

**Long-term Goals:**
- **Sales:** 5,000+ units in first year
- **Reviews:** 200+ reviews, 90%+ positive
- **Revenue:** $30,000+ annually
- **Community:** Active Discord/forums with 1,000+ members

---

## Prioritization & Recommended Timeline

### Recommended Order of Execution

**Phase A: Quick Wins (First 3 months)**
1. **Google Classroom - Phase 1 (OAuth/SSO)** - Immediate teacher value
2. **CrazyGames submission** - Fast player discovery
3. **Google Classroom - Phase 2 (Class Import)** - Core teacher feature

**Phase B: Institution Access (Months 4-6)**
4. **Clever SSO integration** - Scale to districts
5. **ClassLink SSO integration** - Additional district reach
6. **Google Classroom - Phase 3 (Assignments)** - Deep integration

**Phase C: Casual Discovery (Months 6-9)**
7. **Poki submission** - Largest casual audience
8. **Kongregate pre-approval + submission** - Niche community

**Phase D: Premium Market (Months 9-12)**
9. **Steam development** - Desktop packaging + Steamworks
10. **Steam launch** - Premium educational game market

### Timeline Gantt Overview

```
Month 1-2:   [Google OAuth/SSO] [CrazyGames Prep]
Month 2-3:   [Google Class Import] [CrazyGames Launch]
Month 4-5:   [Clever SSO] [ClassLink SSO]
Month 6-7:   [Google Assignments] [Poki Prep]
Month 7-8:   [Poki Launch] [Kongregate]
Month 9-10:  [Steam Electron Build]
Month 10-11: [Steam Steamworks Integration]
Month 11-12: [Steam Store Page & Launch]
```

### Total Cost Summary

| Platform | One-time Cost | Ongoing Cost | Notes |
|----------|--------------|--------------|-------|
| Google Classroom | $0 | $0 | Free for education |
| Clever | $0 | $0 | Free for developers |
| ClassLink | $0 | $0 | Free for developers |
| CrazyGames | $0 | $0 | Revenue share via ads |
| Poki | $0 | $0 | 50/50 revenue share |
| Kongregate | $0 | $0 | Revenue share via ads |
| Steam | $100 | $0-200/mo | Server costs optional |
| **TOTAL** | **$100** | **$0-200/mo** | Very affordable |

### Resource Requirements

**Developer Time:**
- **Total effort:** 1,140-1,450 hours across all platforms
- **Timeline:** 9-12 months (with 1-2 developers)
- **Ongoing:** 20-60 hours/month maintenance

**External Costs:**
- Steam Direct fee: $100
- Optional video editing: $0-500
- Optional marketing budget: $0-1,000
- Server costs (if needed): $50-200/month

**Skills Needed:**
- OAuth/SAML implementation
- REST API integration
- Electron/desktop app packaging
- Steamworks SDK integration
- Marketing/community management

---

## Risk Management

### Top 5 Risks Across All Platforms

1. **Privacy Compliance (COPPA, FERPA, GDPR)**
   - **Impact:** Critical (could block educational adoption)
   - **Mitigation:** Legal review, implement consent systems, privacy policy updates

2. **Platform Rejection (Poki, Kongregate)**
   - **Impact:** High (wasted development time)
   - **Mitigation:** Apply early, start with less selective platforms, gather metrics

3. **Low Adoption/Sales**
   - **Impact:** High (ROI concern)
   - **Mitigation:** Strong marketing, community building, teacher outreach

4. **Technical Integration Complexity**
   - **Impact:** Medium (timeline delays)
   - **Mitigation:** Use established libraries, start simple, iterate

5. **Server Costs for Multiplayer**
   - **Impact:** Medium (ongoing expenses)
   - **Mitigation:** Optimize server efficiency, consider P2P, price accordingly

---

## Success Metrics Dashboard

### Key Performance Indicators (KPIs)

**User Acquisition:**
- New users per month (by source)
- Sign-up conversion rate
- Platform-specific downloads/plays

**Engagement:**
- Daily/Monthly Active Users (DAU/MAU)
- Average session length
- Games per session
- Return rate (D1, D7, D30)

**Education Impact:**
- Teachers registered
- Classes created
- Assignments completed
- Student progress metrics

**Revenue (Steam):**
- Units sold
- Revenue per month
- Refund rate
- Review score

**Platform-Specific:**
- **Google Classroom:** Classes imported, assignments created
- **Clever/ClassLink:** Districts connected, SSO logins
- **Game Portals:** Plays per game, ad revenue, ratings
- **Steam:** Sales, reviews, concurrent players

---

## Next Steps

### Immediate Actions (This Week)

1. **Decide on priority order** - Which platform to tackle first?
2. **Set up project tracking** - Dedicate repository/board for integration work
3. **Legal review** - Review privacy policy and terms for educational compliance
4. **Create developer accounts:**
   - Google Cloud Platform
   - Clever Developer Portal
   - CrazyGames Developer Portal
   - Poki submission prep
5. **Audit current codebase** - Check readiness for each integration

### Quick Wins to Start

**Option 1: Google Classroom OAuth (Fastest Impact)**
- 2-3 weeks to launch
- Immediate teacher value
- No approval needed

**Option 2: CrazyGames (Fastest Player Growth)**
- 3-4 weeks to launch
- Immediate player discovery
- Open platform (high acceptance rate)

**Recommendation:** Start both in parallel if resources allow

---

## Appendix

### Useful Links

**Google Classroom:**
- Developer Docs: https://developers.google.com/classroom
- API Reference: https://developers.google.com/classroom/reference
- OAuth Guide: https://developers.google.com/identity/protocols/oauth2

**Clever:**
- Developer Portal: https://dev.clever.com
- SSO Guide: https://dev.clever.com/docs/getting-started-with-clever-sso
- API Docs: https://dev.clever.com/docs/api-overview

**ClassLink:**
- SSO Library: https://www.classlink.com/resources/sso-search
- OneRoster: https://www.imsglobal.org/activity/onerosterlis

**Game Portals:**
- CrazyGames: https://docs.crazygames.com/
- Poki: https://developers.poki.com/
- Kongregate: BD@kongregate.com

**Steam:**
- Steamworks: https://partner.steamgames.com/
- Electron: https://www.electronjs.org/
- Greenworks: https://github.com/greenheartgames/greenworks

### Code Library Recommendations

**OAuth/SSO:**
- `next-auth` (already in use)
- `passport-saml` (for ClassLink SAML)
- `@googleapis/classroom` (official Google Classroom client)

**Electron:**
- `electron-builder` (packaging)
- `electron-updater` (auto-updates)
- `greenworks` (Steamworks bridge)

**Game Portal SDKs:**
- CrazyGames SDK (provided)
- Poki SDK (provided)
- Kongregate API (provided)

---

**Document End**

*For questions or updates to this roadmap, contact the development team.*
