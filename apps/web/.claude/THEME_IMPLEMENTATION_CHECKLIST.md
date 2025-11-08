# Theme Implementation Checklist

## Pre-Implementation Verification

Before starting implementation, verify these items:

- [ ] Read full THEME_AUDIT.md document
- [ ] Review THEME_AUDIT_SUMMARY.txt for quick overview
- [ ] Verify TutorialPlayer has `theme="light"` prop support
- [ ] Check Radix UI theming capabilities
- [ ] Check Embla carousel color customization
- [ ] Review panda.config.ts tokens thoroughly
- [ ] Get design approval on color palette
- [ ] Plan SVG graphics strategy (filters vs variants vs re-render)

## Phase 1: Foundation (Week 1)

### Configuration Files

- [ ] Extend `panda.config.ts` with light/dark color tokens
  - [ ] Add theme tokens object with light/dark variants
  - [ ] Define all color scales (text, background, accent)
  - [ ] Add semantic color names (primary, secondary, etc.)
  - [ ] Test token generation: `npm run build`

### Global Styling

- [ ] Update `src/app/globals.css`
  - [ ] Add CSS custom properties for theme colors
  - [ ] Add `:root[data-theme="light"]` selector
  - [ ] Add `:root[data-theme="dark"]` selector
  - [ ] Ensure animation/motion properties work with both themes

### Theme Provider

- [ ] Create/extend theme provider in `src/contexts/`
  - [ ] Extend GameThemeContext or create new ThemeProvider
  - [ ] Add theme detection (system preference, localStorage)
  - [ ] Add theme toggle function
  - [ ] Handle SSR hydration properly
  - [ ] Add `data-theme` attribute to root element

### Integration

- [ ] Update `src/components/ClientProviders.tsx`
  - [ ] Add theme provider to provider stack
  - [ ] Ensure proper provider ordering

- [ ] Update `src/app/layout.tsx`
  - [ ] Add system preference detection
  - [ ] Set initial theme from localStorage or system
  - [ ] Avoid hydration mismatch

- [ ] Update `src/components/AppNavBar.tsx`
  - [ ] Add theme toggle button
  - [ ] Update NavBar styling for both themes
  - [ ] Test dropdown menus in both modes
  - [ ] Test hamburger menu in both modes

### Testing Phase 1

- [ ] Theme detection works (system preference)
- [ ] Theme toggle works and persists
- [ ] No console errors in browser dev tools
- [ ] TypeScript compiles: `npm run type-check`
- [ ] Linting passes: `npm run lint`

## Phase 2: Core Pages (Week 1-2)

### Homepage

- [ ] Update `src/app/page.tsx`
  - [ ] Update hero section styling
  - [ ] Update skill card styling (gradients, borders)
  - [ ] Update game card styling
  - [ ] Update mini abacus dark/light styles
  - [ ] Test all components render correctly

- [ ] Update `src/components/HomeBlogSection.tsx`
  - [ ] Featured posts styling
  - [ ] Card backgrounds and borders
  - [ ] Text colors and contrast

### Blog Pages

- [ ] Update `src/app/blog/page.tsx`
  - [ ] Blog index page styling
  - [ ] Featured posts carousel
  - [ ] Category filters (if applicable)

- [ ] Update `src/app/guide/page.tsx`
  - [ ] Fix light-mode inconsistency
  - [ ] Hero section gradient (light/dark variant)
  - [ ] Tab styling (was using white background)
  - [ ] Component styling

- [ ] Update `src/app/games/page.tsx`
  - [ ] Games carousel styling
  - [ ] Player carousel styling
  - [ ] Game card styling

### Components

- [ ] Update `src/components/TutorialPlayer.tsx`
  - [ ] Verify `theme="dark"` prop works
  - [ ] Add `theme="light"` support if needed
  - [ ] Test tutorial display in both themes

### Testing Phase 2

- [ ] All pages render in light mode
- [ ] All pages render in dark mode
- [ ] Text contrast passes WCAG AA (4.5:1)
- [ ] No layout shifts on theme change
- [ ] Responsive design works in both themes
- [ ] Run quality checks: `npm run pre-commit`

## Phase 3: Complex Content (Week 2-3)

### Blog Post Markdown (HIGHEST PRIORITY - COMPLEX)

- [ ] Update `src/app/blog/[slug]/page.tsx` markdown styling
  - [ ] Update h1, h2, h3 styling for light mode
  - [ ] Update paragraph text colors
  - [ ] Update link colors (light blue → dark blue)
  - [ ] Update code block styling (dark bg → light bg)
  - [ ] Update pre/code colors
  - [ ] Update blockquote styling
  - [ ] Update table styling (headers, rows, borders)
  - [ ] Update ul/ol/li styling
  - [ ] Update hr styling
  - [ ] Test all markdown elements render correctly

- [ ] Strategy for CSS selectors:
  - Option A: Use CSS custom properties in nested selectors
  - Option B: Use dual selectors with theme attribute
  - Option C: Create wrapper with theme-specific class

### Arcade Games - Complement Race

- [ ] Update `src/app/arcade/complement-race/components/GameDisplay.tsx`
  - [ ] Update background gradient
  - [ ] Update text colors
  - [ ] Update interactive element colors
  - [ ] Update feedback message colors

- [ ] Update `src/app/arcade/complement-race/components/PressureGauge.tsx`
  - [ ] Update gauge background
  - [ ] Update text colors
  - [ ] Update SVG colors

- [ ] Update `src/app/arcade/complement-race/components/PassengerCard.tsx`
  - [ ] Update card styling
  - [ ] Update custom color usage

- [ ] Update `src/app/arcade/complement-race/components/RaceTrack/CircularTrack.tsx`
  - [ ] SVG fill colors (#7cb342, #d97757)
  - [ ] SVG stroke colors
  - [ ] Consider CSS filter strategy for SVG

- [ ] Update `src/app/arcade/complement-race/components/RaceTrack/GhostTrain.tsx`
  - [ ] SVG fill colors
  - [ ] Drop shadow colors

- [ ] Update `src/app/arcade/complement-race/components/RaceTrack/LinearTrack.tsx`
  - [ ] Track colors
  - [ ] Marker colors

### Arcade Games - Rithmomachia

- [ ] Update `src/arcade-games/rithmomachia/components/RithmomachiaGame.tsx`
  - [ ] Player badge styling
  - [ ] Board background
  - [ ] UI element colors

- [ ] Update `src/app/arcade/rithmomachia/guide/page.tsx`
  - [ ] Guide page background (#f3f4f6)
  - [ ] Text colors
  - [ ] Component styling

### SVG Graphics Strategy

- [ ] Decide on approach for blog SVGs:
  - Option A: Generate light/dark variants (tedious but reliable)
  - Option B: Use CSS filter inversion (lossy but quick)
  - Option C: Use CSS variable injection (complex but elegant)
  - Option D: Commit both variants to repo

- [ ] Apply chosen strategy to:
  - [ ] `/public/blog/difficulty-examples/` (9 files)
  - [ ] `/public/blog/ten-frame-examples/` (3 files)

### Testing Phase 3

- [ ] Blog markdown displays correctly in both themes
- [ ] All markdown element colors contrast properly
- [ ] Arcade games playable in both themes
- [ ] SVG graphics visible in both themes
- [ ] No visual artifacts from color changes
- [ ] Run quality checks: `npm run pre-commit`

## Phase 4: Testing & Polish (Week 3-4)

### Visual Testing

- [ ] Manual review of all pages
  - [ ] Homepage
  - [ ] Blog index
  - [ ] Blog post (with all markdown elements)
  - [ ] Guide page
  - [ ] Games page
  - [ ] All arcade games
  - [ ] Navigation and dropdowns

- [ ] Screenshot comparison (if available)
  - [ ] Compare light and dark variants
  - [ ] Check for layout shifts
  - [ ] Verify theme consistency

- [ ] Cross-browser testing
  - [ ] Chrome/Edge (latest)
  - [ ] Firefox (latest)
  - [ ] Safari (latest)
  - [ ] Mobile Chrome/Safari

### Accessibility Testing

- [ ] Color contrast audit
  - [ ] Use WAVE WebAIM checker
  - [ ] Use Axe DevTools
  - [ ] Verify WCAG AA (4.5:1) for all text
  - [ ] Verify WCAG AA (3:1) for large text
  - [ ] Check color combinations for color-blind users

- [ ] Color-blindness simulation
  - [ ] Use ColorOracle simulator
  - [ ] Test protanopia (red-blind)
  - [ ] Test deuteranopia (green-blind)
  - [ ] Test tritanopia (blue-blind)

- [ ] Motion/animation
  - [ ] Test with `prefers-reduced-motion`
  - [ ] Verify animations still work appropriately
  - [ ] Check for jarring transitions

### Functionality Testing

- [ ] Theme toggle functionality
  - [ ] Toggle switches theme immediately
  - [ ] Settings persist across page reloads
  - [ ] Settings persist across tab closes
  - [ ] System preference respected on first visit

- [ ] Game functionality
  - [ ] All games playable in both themes
  - [ ] No gameplay issues from color changes
  - [ ] SVG rendering correct

- [ ] Interactive elements
  - [ ] Buttons clickable and visible
  - [ ] Form inputs usable
  - [ ] Dropdowns functional
  - [ ] Modals display correctly

### Performance Testing

- [ ] No layout shift on theme change
- [ ] Theme switch is instant (no flicker)
- [ ] No performance regression
- [ ] Bundle size unchanged significantly

### Documentation

- [ ] Update THEME_AUDIT.md with implementation notes
- [ ] Document color palette choices
- [ ] Document any deviations from plan
- [ ] Create theme customization guide for future work

### Final Quality Check

- [ ] Run `npm run pre-commit` (all checks pass)
- [ ] No console errors or warnings
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] All tests pass

## Deployment & Communication

### Pre-Launch

- [ ] Get stakeholder review and approval
- [ ] Test on staging environment
- [ ] Get final accessibility sign-off
- [ ] Prepare release notes

### Launch

- [ ] Create git commit with all changes
- [ ] Push to main branch
- [ ] Monitor GitHub Actions build
- [ ] Verify deployment to production
- [ ] Manual smoke test on production

### Post-Launch

- [ ] Monitor error logs for issues
- [ ] Gather user feedback
- [ ] Document any issues found
- [ ] Plan follow-up improvements

## Risk Mitigation

### Known Challenges

- [ ] Blog markdown styling complexity - plan extra time
- [ ] SVG color handling - test multiple browsers
- [ ] SSR hydration - test server vs client rendering
- [ ] Third-party component theming - verify compatibility

### Contingency Plans

- [ ] If SVG strategy fails: use PNG variants as fallback
- [ ] If markdown styling breaks: revert to inline styles temporarily
- [ ] If performance issues: consider lazy-loading theme CSS
- [ ] If accessibility fails: adjust color palette before launch

### Rollback Plan

- [ ] Keep previous version in git history
- [ ] Test rollback procedure before launch
- [ ] Have quick revert command ready
- [ ] Monitor metrics for issues

## Success Criteria

- [x] Site fully functional in light mode
- [x] Site fully functional in dark mode
- [x] System preference detection working
- [x] Theme persistence working
- [x] All WCAG AA accessibility requirements met
- [x] No performance regression
- [x] All tests passing
- [x] User feedback positive
- [x] No critical bugs reported

## Timeline

| Phase                     | Duration      | Status          |
| ------------------------- | ------------- | --------------- |
| Phase 1: Foundation       | 1 week        | Not started     |
| Phase 2: Core Pages       | 1-2 weeks     | Not started     |
| Phase 3: Complex Content  | 1-2 weeks     | Not started     |
| Phase 4: Testing & Polish | 1 week        | Not started     |
| **Total**                 | **2-3 weeks** | **Not started** |

---

**Document Version:** 1.0
**Last Updated:** 2025-11-07
**Status:** Ready for implementation
