/**
 * Practice App Styles - Central Export
 *
 * @example
 * import { themed, cardStyles, centerStack } from './styles'
 *
 * <div className={css({ ...centerStack, ...cardStyles(isDark) })}>
 */

// Mixins - composable primitives
export {
  center,
  // Layout
  centerStack,
  // Utilities
  combine,
  cursorNotAllowed,
  // Interaction
  cursorPointer,
  fontBold,
  fontMedium,
  // Font weight
  fontNormal,
  fontSemibold,
  fullWidth,
  gap2xl,
  gapLg,
  gapMd,
  gapSm,
  gapXl,
  // Gap
  gapXs,
  // Visibility
  hidden,
  invisible,
  marginBottomLg,
  marginBottomMd,
  marginBottomSm,
  marginBottomXs,
  marginTopLg,
  marginTopMd,
  marginTopSm,
  // Margin
  marginTopXs,
  noSelect,
  paddingLg,
  paddingMd,
  paddingSm,
  paddingXLg,
  paddingXl,
  paddingXMd,
  paddingXSm,
  // Padding
  paddingXs,
  paddingYLg,
  paddingYMd,
  paddingYSm,
  roundedFull,
  roundedLg,
  roundedMd,
  // Border radius
  roundedSm,
  roundedXl,
  row,
  spaceBetween,
  srOnly,
  stack,
  text2xl,
  text3xl,
  text4xl,
  textBase,
  // Text alignment
  textCenter,
  textLeft,
  textLg,
  textMd,
  textRight,
  textSm,
  textXl,
  // Font size
  textXs,
  // Transitions
  transitionFast,
  transitionNormal,
  transitionSlow,
  when,
  wrap,
} from './practiceMixins'

// Styles - reusable style functions
export {
  // Avatar
  avatarStyles,
  // Badges
  badgeStyles,
  bodyTextStyles,
  captionStyles,
  // Containers
  cardStyles,
  ghostButtonStyles,
  iconButtonStyles,
  // Inputs
  inputContainerStyles,
  labelStyles,
  linkButtonStyles,
  pageContainerStyles,
  // Typography
  pageTitleStyles,
  panelStyles,
  // Buttons
  primaryButtonStyles,
  // Progress
  progressBarContainerStyles,
  progressBarFillStyles,
  purposeBadgeStyles,
  secondaryButtonStyles,
  sectionHeadingStyles,
  sectionStyles,
  // Stats
  statCardStyles,
  statLabelStyles,
  statValueStyles,
  successButtonStyles,
  toolButtonStyles,
} from './practiceStyles'
// Theme - colors and semantic helpers
export {
  ACCURACY_THRESHOLDS,
  type BktClassification,
  getAccuracyColors,
  getAccuracyLevel,
  getMasteryColors,
  getPartTypeColors,
  getPurposeColors,
  type PracticeColorKey,
  type ProblemPurpose,
  practiceColors,
  type SessionPartType,
  themed,
  themedColors,
} from './practiceTheme'
