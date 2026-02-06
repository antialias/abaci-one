import type { Meta, StoryObj } from '@storybook/react'
import { DifficultyPlot2D } from './DifficultyPlot2D'
import { DIFFICULTY_PROFILES } from '../../difficultyProfiles'

const meta = {
  title: 'Worksheets/Config Panel/DifficultyPlot2D',
  component: DifficultyPlot2D,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof DifficultyPlot2D>

export default meta
type Story = StoryObj<typeof meta>

export const EarlyLearner: Story = {
  args: {
    pAnyStart: DIFFICULTY_PROFILES.earlyLearner.regrouping.pAnyStart,
    pAllStart: DIFFICULTY_PROFILES.earlyLearner.regrouping.pAllStart,
    displayRules: DIFFICULTY_PROFILES.earlyLearner.displayRules,
    onChange: (config) => {
      console.log('Selected configuration:', config)
    },
    isDark: false,
  },
}

export const Intermediate: Story = {
  args: {
    pAnyStart: DIFFICULTY_PROFILES.intermediate.regrouping.pAnyStart,
    pAllStart: DIFFICULTY_PROFILES.intermediate.regrouping.pAllStart,
    displayRules: DIFFICULTY_PROFILES.intermediate.displayRules,
    onChange: (config) => {
      console.log('Selected configuration:', config)
    },
    isDark: false,
  },
}

export const Expert: Story = {
  args: {
    pAnyStart: DIFFICULTY_PROFILES.expert.regrouping.pAnyStart,
    pAllStart: DIFFICULTY_PROFILES.expert.regrouping.pAllStart,
    displayRules: DIFFICULTY_PROFILES.expert.displayRules,
    onChange: (config) => {
      console.log('Selected configuration:', config)
    },
    isDark: false,
  },
}

export const CustomConfiguration: Story = {
  args: {
    pAnyStart: 0.5,
    pAllStart: 0.1,
    displayRules: {
      carryBoxes: 'whenRegrouping',
      answerBoxes: 'always',
      placeValueColors: 'never',
      tenFrames: 'never',
      problemNumbers: 'always',
      cellBorders: 'always',
      borrowNotation: 'never',
      borrowingHints: 'never',
    },
    onChange: (config) => {
      console.log('Selected configuration:', config)
    },
    isDark: false,
  },
}

export const DarkMode: Story = {
  args: {
    pAnyStart: DIFFICULTY_PROFILES.intermediate.regrouping.pAnyStart,
    pAllStart: DIFFICULTY_PROFILES.intermediate.regrouping.pAllStart,
    displayRules: DIFFICULTY_PROFILES.intermediate.displayRules,
    onChange: (config) => {
      console.log('Selected configuration:', config)
    },
    isDark: true,
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
}

export const MasteryProgressionView: Story = {
  args: {
    pAnyStart: 0.5,
    pAllStart: 0.1,
    displayRules: {
      carryBoxes: 'whenRegrouping',
      answerBoxes: 'always',
      placeValueColors: 'never',
      tenFrames: 'never',
      problemNumbers: 'always',
      cellBorders: 'always',
      borrowNotation: 'never',
      borrowingHints: 'never',
    },
    onChange: (config) => {
      console.log('Selected configuration:', config)
    },
    isDark: false,
    customPoints: [
      {
        id: 'skill-1',
        label: 'Single Digit',
        pAnyStart: 0,
        pAllStart: 0,
        displayRules: DIFFICULTY_PROFILES.earlyLearner.displayRules,
      },
      {
        id: 'skill-2',
        label: 'No Regroup',
        pAnyStart: 0,
        pAllStart: 0,
        displayRules: DIFFICULTY_PROFILES.earlyLearner.displayRules,
      },
      {
        id: 'skill-3',
        label: 'Some Regroup',
        pAnyStart: 0.25,
        pAllStart: 0,
        displayRules: DIFFICULTY_PROFILES.intermediate.displayRules,
      },
      {
        id: 'skill-4',
        label: 'More Regroup',
        pAnyStart: 0.5,
        pAllStart: 0.1,
        displayRules: DIFFICULTY_PROFILES.intermediate.displayRules,
      },
      {
        id: 'skill-5',
        label: 'Advanced',
        pAnyStart: 0.75,
        pAllStart: 0.25,
        displayRules: DIFFICULTY_PROFILES.expert.displayRules,
      },
    ],
  },
}
