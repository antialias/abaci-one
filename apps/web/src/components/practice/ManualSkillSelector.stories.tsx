import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { css } from "../../../styled-system/css";
import { ManualSkillSelector } from "./ManualSkillSelector";

const meta: Meta<typeof ManualSkillSelector> = {
  title: "Practice/ManualSkillSelector",
  component: ManualSkillSelector,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ManualSkillSelector>;

/**
 * Interactive demo with open/close functionality
 */
function InteractiveDemo({
  studentName,
  currentMasteredSkills = [],
}: {
  studentName: string;
  currentMasteredSkills?: string[];
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [savedSkills, setSavedSkills] = useState<string[]>(
    currentMasteredSkills,
  );

  const handleSave = async (masteredSkillIds: string[]) => {
    console.log("Saving skills:", masteredSkillIds);
    setSavedSkills(masteredSkillIds);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
  };

  return (
    <div>
      <ManualSkillSelector
        open={isOpen}
        onClose={() => setIsOpen(false)}
        studentName={studentName}
        playerId="player-123"
        currentMasteredSkills={savedSkills}
        onSave={handleSave}
      />
      {!isOpen && (
        <div className={css({ textAlign: "center" })}>
          <p className={css({ mb: "3", color: "gray.600" })}>
            Saved {savedSkills.length} skills as mastered
          </p>
          <button
            onClick={() => setIsOpen(true)}
            className={css({
              px: "4",
              py: "2",
              bg: "blue.500",
              color: "white",
              borderRadius: "md",
              border: "none",
              cursor: "pointer",
            })}
          >
            Reopen Modal
          </button>
        </div>
      )}
    </div>
  );
}

export const Default: Story = {
  render: () => <InteractiveDemo studentName="Sonia" />,
};

export const WithExistingSkills: Story = {
  render: () => (
    <InteractiveDemo
      studentName="Marcus"
      currentMasteredSkills={[
        "basic.directAddition",
        "basic.heavenBead",
        "basic.simpleCombinations",
        "fiveComplements.4=5-1",
        "fiveComplements.3=5-2",
      ]}
    />
  ),
};

export const Level1Complete: Story = {
  render: () => (
    <InteractiveDemo
      studentName="Luna"
      currentMasteredSkills={[
        "basic.directAddition",
        "basic.heavenBead",
        "basic.simpleCombinations",
        "basic.directSubtraction",
        "basic.heavenBeadSubtraction",
        "basic.simpleCombinationsSub",
        "fiveComplements.4=5-1",
        "fiveComplements.3=5-2",
        "fiveComplements.2=5-3",
        "fiveComplements.1=5-4",
        "fiveComplementsSub.-4=-5+1",
        "fiveComplementsSub.-3=-5+2",
        "fiveComplementsSub.-2=-5+3",
        "fiveComplementsSub.-1=-5+4",
      ]}
    />
  ),
};

export const AllSkillsMastered: Story = {
  render: () => (
    <InteractiveDemo
      studentName="Expert Student"
      currentMasteredSkills={[
        // Basic
        "basic.directAddition",
        "basic.heavenBead",
        "basic.simpleCombinations",
        "basic.directSubtraction",
        "basic.heavenBeadSubtraction",
        "basic.simpleCombinationsSub",
        // Five complements
        "fiveComplements.4=5-1",
        "fiveComplements.3=5-2",
        "fiveComplements.2=5-3",
        "fiveComplements.1=5-4",
        "fiveComplementsSub.-4=-5+1",
        "fiveComplementsSub.-3=-5+2",
        "fiveComplementsSub.-2=-5+3",
        "fiveComplementsSub.-1=-5+4",
        // Ten complements
        "tenComplements.9=10-1",
        "tenComplements.8=10-2",
        "tenComplements.7=10-3",
        "tenComplements.6=10-4",
        "tenComplements.5=10-5",
        "tenComplements.4=10-6",
        "tenComplements.3=10-7",
        "tenComplements.2=10-8",
        "tenComplements.1=10-9",
        "tenComplementsSub.-9=+1-10",
        "tenComplementsSub.-8=+2-10",
        "tenComplementsSub.-7=+3-10",
        "tenComplementsSub.-6=+4-10",
        "tenComplementsSub.-5=+5-10",
        "tenComplementsSub.-4=+6-10",
        "tenComplementsSub.-3=+7-10",
        "tenComplementsSub.-2=+8-10",
        "tenComplementsSub.-1=+9-10",
      ]}
    />
  ),
};

export const NewStudent: Story = {
  render: () => (
    <InteractiveDemo studentName="New Learner" currentMasteredSkills={[]} />
  ),
};

/**
 * This story highlights the complexity badges feature.
 * Each skill has a badge indicating its base complexity:
 * - 1★ (green): Simple single-concept operations
 * - 2★ (orange): Cross-column operations (ten complements)
 * - 3★ (red): Cascading multi-column operations
 *
 * The badges help teachers understand the inherent difficulty of each skill.
 */
export const ComplexityBadgesHighlight: Story = {
  render: () => (
    <InteractiveDemo
      studentName="Demo Student"
      currentMasteredSkills={[
        // Show variety of complexity levels
        "basic.directAddition", // 1★
        "tenComplements.9=10-1", // 2★
        "advanced.cascadingCarry", // 3★
      ]}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: `
Demonstrates the complexity badges that appear next to each skill:
- **1★ Simple** (green): Basic operations like direct addition, heaven bead, and five complements
- **2★ Cross-column** (orange): Ten complement operations that involve carrying/borrowing
- **3★ Cascading** (red): Advanced operations like cascading carry (999+1=1000)

The complexity legend at the top explains what each badge means.
        `,
      },
    },
  },
};
