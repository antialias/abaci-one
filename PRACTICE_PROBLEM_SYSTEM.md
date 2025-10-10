# Practice Problem Generation System

## Overview

The tutorial system includes an intelligent practice problem generator that creates math problems based on specific abacus calculation skills the user has mastered. This system ensures learners only encounter problems they can solve with their current skill level while providing targeted practice for newly learned techniques.

## Core Concept: Skill-Based Problem Generation

Unlike traditional math problem generators, this system considers **which specific abacus techniques** a user has learned. The difficulty of a problem is determined by analyzing what calculation techniques are required to solve it, not just the magnitude of the numbers involved.

### Key Principle

**The skill required to solve a problem depends on what number you're adding to the current abacus state, not the sequence of numbers in the problem.**

For example:

- Adding 4 to a current value of 3 requires the "4 = 5 - 1" complement skill
- Adding 4 to a current value of 1 only requires direct earth bead addition
- The skill needed is determined by the **addition step**, not the final sum

## Abacus Calculation Skills

### Five Complements (Single Column Operations)

These skills are needed when adding a number would exceed the capacity of earth beads (4 beads max per column):

| Skill         | Description                           | When Required                       |
| ------------- | ------------------------------------- | ----------------------------------- |
| **4 = 5 - 1** | Use heaven bead, remove 1 earth bead  | Adding 4 when 1+ earth beads active |
| **3 = 5 - 2** | Use heaven bead, remove 2 earth beads | Adding 3 when 2+ earth beads active |
| **2 = 5 - 3** | Use heaven bead, remove 3 earth beads | Adding 2 when 3+ earth beads active |
| **1 = 5 - 4** | Use heaven bead, remove 4 earth beads | Adding 1 when 4 earth beads active  |

### Ten Complements (Multi-Column Operations)

These skills are needed when adding would exceed 9 in the current column and require carrying to the next column:

| Skill          | Description                                   | When Required                   |
| -------------- | --------------------------------------------- | ------------------------------- |
| **9 = 10 - 1** | Carry to tens column, subtract 1 from current | Adding 9 causes column overflow |
| **8 = 10 - 2** | Carry to tens column, subtract 2 from current | Adding 8 causes column overflow |
| **7 = 10 - 3** | Carry to tens column, subtract 3 from current | Adding 7 causes column overflow |
| **6 = 10 - 4** | Carry to tens column, subtract 4 from current | Adding 6 causes column overflow |
| **5 = 10 - 5** | Carry to tens column, subtract 5 from current | Adding 5 causes column overflow |
| **4 = 10 - 6** | Carry to tens column, subtract 6 from current | Adding 4 causes column overflow |
| **3 = 10 - 7** | Carry to tens column, subtract 7 from current | Adding 3 causes column overflow |
| **2 = 10 - 8** | Carry to tens column, subtract 8 from current | Adding 2 causes column overflow |
| **1 = 10 - 9** | Carry to tens column, subtract 9 from current | Adding 1 causes column overflow |

### Basic Operations

| Skill                     | Description                                  |
| ------------------------- | -------------------------------------------- |
| **Direct Addition (1-4)** | Add earth beads directly without complements |
| **Heaven Bead (5)**       | Use the heaven bead to represent 5           |
| **Simple Combinations**   | Combine heaven and earth beads (6-9)         |

## Practice Step Configuration

### Basic Parameters

```typescript
interface PracticeStep {
  id: string;
  title: string;
  description: string;

  // Problem generation settings
  problemCount: number; // How many problems to generate
  maxTerms: number; // Maximum numbers in one addition problem (2-5)

  // Skill-based constraints
  requiredSkills: SkillSet; // Skills user must know
  targetSkills: SkillSet; // Skills to specifically practice
  forbiddenSkills: SkillSet; // Skills user hasn't learned yet

  // Advanced constraints (optional)
  numberRange?: { min: number; max: number };
  sumConstraints?: { maxSum: number; minSum?: number };

  // Tutorial integration
  position?: number; // Where in tutorial flow this appears
}
```

### Skill Set Definition

```typescript
interface SkillSet {
  // Five complements (5-column operations)
  fiveComplements: {
    "4=5-1": boolean;
    "3=5-2": boolean;
    "2=5-3": boolean;
    "1=5-4": boolean;
  };

  // Ten complements (carrying operations)
  tenComplements: {
    "9=10-1": boolean;
    "8=10-2": boolean;
    "7=10-3": boolean;
    "6=10-4": boolean;
    "5=10-5": boolean;
    "4=10-6": boolean;
    "3=10-7": boolean;
    "2=10-8": boolean;
    "1=10-9": boolean;
  };

  // Basic operations
  basic: {
    directAddition: boolean; // Can add 1-4 directly
    heavenBead: boolean; // Can use heaven bead (5)
    simpleCombinations: boolean; // Can do 6-9 without complements
  };
}
```

## Problem Generation Algorithm

### 1. Skill Analysis

For each potential problem, the generator:

1. Simulates solving the problem step-by-step on a virtual abacus
2. Identifies which skills would be required at each addition step
3. Compares required skills against the user's known skills
4. Only generates problems that use known skills or specifically target new skills

### 2. Problem Types

#### Practice Mode

- **Required Skills**: All skills needed must be in user's known skill set
- **Purpose**: Reinforce and practice mastered techniques
- **Example**: If user knows "4=5-1" but not "3=5-2", only generate problems needing the first skill

#### Learning Mode

- **Target Skills**: Generate problems that specifically require newly introduced skills
- **Purpose**: Provide focused practice on a single new technique
- **Example**: After teaching "3=5-2", generate problems that require this specific complement

#### Mixed Mode

- **Skill Range**: Combine multiple known skills in single problems
- **Purpose**: Integrate different techniques and build fluency
- **Example**: Problems requiring both five complements and ten complements

### 3. Validation Process

Before presenting a problem to the user:

1. **Skill Check**: Verify all required skills are in allowed set
2. **Difficulty Check**: Ensure problem matches intended difficulty level
3. **Diversity Check**: Avoid repetitive patterns in generated problems
4. **Sum Validation**: Respect maximum sum constraints for target skill level

## Tutorial Editor Integration

### Practice Step Creation Workflow

1. **Select Position**: Choose where in tutorial flow the practice appears
2. **Define Prerequisites**: Select which skills user has learned by this point
3. **Choose Target Skills**: Pick specific skills to practice (optional)
4. **Set Parameters**: Configure problem count, max terms, number ranges
5. **Preview Problems**: Generate sample problems to verify configuration
6. **Validate**: Ensure all generated problems are solvable with allowed skills

### Editor UI Components

#### Skill Selection Matrix

Visual grid showing:

- ✅ Known skills (green) - user has learned these
- 🎯 Target skills (blue) - specifically practice these
- ❌ Forbidden skills (red) - user hasn't learned yet
- ⚪ Unused skills (gray) - not relevant for this practice

#### Problem Preview Panel

Real-time display of:

- Sample generated problems
- Skill analysis for each problem
- Warning indicators for invalid configurations

#### Validation Feedback

- ⚠️ Warnings for impossible skill combinations
- ❌ Errors for unsolvable problems
- ✅ Confirmation when configuration is valid

## Implementation Examples

### Example 1: Early Basic Practice

```typescript
const basicPractice: PracticeStep = {
  id: "practice-basic-addition",
  title: "Practice: Basic Addition (1-4)",
  description: "Practice adding numbers 1-4 using only earth beads",
  problemCount: 12,
  maxTerms: 3,
  requiredSkills: {
    basic: {
      directAddition: true,
      heavenBead: false,
      simpleCombinations: false,
    },
    fiveComplements: {
      /* all false */
    },
    tenComplements: {
      /* all false */
    },
  },
  numberRange: { min: 1, max: 4 },
  sumConstraints: { maxSum: 9 },
};
```

### Example 2: Five Complement Introduction

```typescript
const complementPractice: PracticeStep = {
  id: "practice-four-equals-five-minus-one",
  title: "Practice: Using 4 = 5 - 1",
  description: "Practice the complement technique when adding 4",
  problemCount: 8,
  maxTerms: 3,
  requiredSkills: {
    basic: { directAddition: true, heavenBead: true, simpleCombinations: true },
    fiveComplements: { "4=5-1": true /* others false */ },
    tenComplements: {
      /* all false */
    },
  },
  targetSkills: {
    fiveComplements: { "4=5-1": true },
  },
  sumConstraints: { maxSum: 9 },
};
```

### Example 3: Mixed Advanced Practice

```typescript
const mixedPractice: PracticeStep = {
  id: "practice-mixed-complements",
  title: "Practice: Mixed Complement Operations",
  description: "Combine five complements and ten complements",
  problemCount: 15,
  maxTerms: 4,
  requiredSkills: {
    basic: {
      /* all true */
    },
    fiveComplements: {
      /* all true */
    },
    tenComplements: { "9=10-1": true, "8=10-2": true, "7=10-3": true },
  },
  sumConstraints: { maxSum: 99 },
};
```

## Benefits for Learners

1. **Progressive Difficulty**: Never encounter problems requiring unknown skills
2. **Targeted Practice**: Focus on specific techniques needing reinforcement
3. **Skill Integration**: Gradually combine multiple techniques
4. **Confidence Building**: Success rate remains high through appropriate challenge level
5. **Mastery Tracking**: Clear progression through specific abacus skills

## Benefits for Educators

1. **Precise Control**: Fine-grained control over what skills are practiced
2. **Curriculum Alignment**: Practice sessions match exact tutorial progression
3. **Problem Validation**: Automatic verification that problems are solvable
4. **Adaptive Content**: Problems automatically adjust to learner progress
5. **Data Insights**: Track which specific skills need more practice
