import type { Meta, StoryObj } from "@storybook/react";
import AbacusReact from "./AbacusReact";

const meta: Meta<typeof AbacusReact> = {
  title: "Soroban/AbacusReact/Custom Beads",
  component: AbacusReact,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Custom bead content allows you to replace standard bead shapes (diamond, circle, square) with emojis, images, or custom SVG content. Perfect for themed visualizations or fun educational contexts.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AbacusReact>;

/**
 * Emoji Beads - Teapot Example
 *
 * Replace all beads with emoji characters! Perfect for fun themes and easter eggs.
 */
export const EmojiBeads_Teapot: Story = {
  args: {
    value: 418,
    columns: 3,
    beadShape: "custom",
    customBeadContent: {
      type: "emoji",
      value: "🫖",
    },
    showNumbers: true,
    scaleFactor: 1.5,
  },
  parameters: {
    docs: {
      description: {
        story:
          "HTTP 418 'I'm a teapot' represented with teapot emoji beads! Set `beadShape='custom'` and provide `customBeadContent` with type 'emoji'.",
      },
    },
  },
};

/**
 * Emoji Beads - Star Example
 */
export const EmojiBeads_Stars: Story = {
  args: {
    value: 555,
    columns: 3,
    beadShape: "custom",
    customBeadContent: {
      type: "emoji",
      value: "⭐",
    },
    showNumbers: true,
    colorScheme: "place-value",
  },
  parameters: {
    docs: {
      description: {
        story: "Stars for rating systems or achievements!",
      },
    },
  },
};

/**
 * Emoji Beads - Fruit Counter
 */
export const EmojiBeads_Fruit: Story = {
  args: {
    value: 123,
    columns: 3,
    beadShape: "custom",
    customBeadContent: {
      type: "emoji",
      value: "🍎",
    },
    showNumbers: true,
    hideInactiveBeads: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Count apples, oranges, or any fruit! Great for early math education.",
      },
    },
  },
};

/**
 * Emoji Beads - Coins
 */
export const EmojiBeads_Coins: Story = {
  args: {
    value: 999,
    columns: 3,
    beadShape: "custom",
    customBeadContent: {
      type: "emoji",
      value: "🪙",
    },
    showNumbers: true,
    scaleFactor: 1.3,
  },
  parameters: {
    docs: {
      description: {
        story: "Perfect for teaching money and currency concepts!",
      },
    },
  },
};

/**
 * Emoji Beads - Hearts
 */
export const EmojiBeads_Hearts: Story = {
  args: {
    value: 143, // "I Love You" in pager code
    columns: 3,
    beadShape: "custom",
    customBeadContent: {
      type: "emoji",
      value: "❤️",
    },
    showNumbers: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Hearts for Valentine's Day or expressing love! 143 = 'I Love You'.",
      },
    },
  },
};

/**
 * Emoji Beads - Fire
 */
export const EmojiBeads_Fire: Story = {
  args: {
    value: 100,
    columns: 3,
    beadShape: "custom",
    customBeadContent: {
      type: "emoji",
      value: "🔥",
    },
    showNumbers: true,
    interactive: true,
    animated: true,
  },
  parameters: {
    docs: {
      description: {
        story: "On fire! Perfect for streaks or hot topics.",
      },
    },
  },
};

/**
 * Emoji Beads - Dice
 */
export const EmojiBeads_Dice: Story = {
  args: {
    value: 666,
    columns: 3,
    beadShape: "custom",
    customBeadContent: {
      type: "emoji",
      value: "🎲",
    },
    showNumbers: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Dice for probability and gaming applications!",
      },
    },
  },
};

/**
 * Emoji Beads - Abacus Inception!
 *
 * An abacus made of tiny abacus beads! Meta abacus counting.
 */
export const EmojiBeads_AbacusInception: Story = {
  args: {
    value: 1234,
    columns: 4,
    beadShape: "custom",
    customBeadContent: {
      type: "emoji",
      value: "🧮",
    },
    showNumbers: true,
    scaleFactor: 1.4,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Abacus-ception! An abacus made of tiny abacus emojis. We need to go deeper... 🧮",
      },
    },
  },
};

/**
 * Interactive Custom Beads
 *
 * Custom beads work with all interactive features!
 */
export const Interactive_CustomBeads: Story = {
  args: {
    value: 42,
    columns: 2,
    beadShape: "custom",
    customBeadContent: {
      type: "emoji",
      value: "🎯",
    },
    showNumbers: true,
    interactive: true,
    animated: true,
    gestures: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Custom beads support all interactivity - click, drag, and animate just like standard shapes!",
      },
    },
  },
};

/**
 * Image Beads Example
 *
 * Use custom images as beads! Images scale to fit bead size.
 */
export const ImageBeads_Example: Story = {
  args: {
    value: 25,
    columns: 2,
    beadShape: "custom",
    customBeadContent: {
      type: "image",
      url: "https://via.placeholder.com/50/ff6b35/ffffff?text=★",
    },
    showNumbers: true,
    scaleFactor: 1.5,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Use image URLs for custom bead graphics. Images automatically scale to fit the bead size.",
      },
    },
  },
};

/**
 * Comparison: Standard vs Custom Beads
 */
export const Comparison_StandardVsCustom: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "40px", flexWrap: "wrap" }}>
      <div style={{ textAlign: "center" }}>
        <h3>Standard Diamond Beads</h3>
        <AbacusReact value={123} columns={3} beadShape="diamond" showNumbers />
      </div>

      <div style={{ textAlign: "center" }}>
        <h3>Custom Emoji Beads (🫖)</h3>
        <AbacusReact
          value={123}
          columns={3}
          beadShape="custom"
          customBeadContent={{ type: "emoji", value: "🫖" }}
          showNumbers
        />
      </div>

      <div style={{ textAlign: "center" }}>
        <h3>Custom Emoji Beads (⭐)</h3>
        <AbacusReact
          value={123}
          columns={3}
          beadShape="custom"
          customBeadContent={{ type: "emoji", value: "⭐" }}
          showNumbers
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Side-by-side comparison of standard and custom bead shapes.",
      },
    },
  },
};

/**
 * Custom Beads with Theme Styling
 */
export const CustomBeads_WithThemes: Story = {
  args: {
    value: 789,
    columns: 3,
    beadShape: "custom",
    customBeadContent: {
      type: "emoji",
      value: "💎",
    },
    showNumbers: true,
    colorScheme: "place-value",
    hideInactiveBeads: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Custom beads work seamlessly with all color schemes and styling options!",
      },
    },
  },
};

/**
 * Function-Based Custom Beads - Active/Inactive States
 *
 * Use a function to render different emojis based on bead state!
 */
export const Function_ActiveInactive: Story = {
  args: {
    value: 123,
    columns: 3,
    beadShape: "custom",
    customBeadContent: {
      type: "emoji-function",
      value: (bead) => (bead.active ? "✅" : "⭕"),
    },
    showNumbers: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Different emojis for active (✅) vs inactive (⭕) beads! The function receives bead context and returns the appropriate emoji.",
      },
    },
  },
};

/**
 * Function-Based Custom Beads - Heaven vs Earth
 *
 * Different emojis based on bead type!
 */
export const Function_HeavenEarth: Story = {
  args: {
    value: 567,
    columns: 3,
    beadShape: "custom",
    customBeadContent: {
      type: "emoji-function",
      value: (bead) => (bead.type === "heaven" ? "☁️" : "🌍"),
    },
    showNumbers: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Heaven beads (☁️) and Earth beads (🌍) with different emojis based on bead type!",
      },
    },
  },
};

/**
 * Function-Based Custom Beads - Place Value Colors
 *
 * Use different emojis per column (place value)!
 */
export const Function_PlaceValue: Story = {
  args: {
    value: 999,
    columns: 3,
    beadShape: "custom",
    customBeadContent: {
      type: "emoji-function",
      value: (bead) => {
        const emojis = ["🟢", "🔵", "🔴", "🟡", "🟣"];
        return emojis[bead.placeValue] || "⚪";
      },
    },
    showNumbers: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Different colored circles for each place value (ones=green, tens=blue, hundreds=red)!",
      },
    },
  },
};

/**
 * Function-Based Custom Beads - Traffic Light Pattern
 *
 * Complex logic: traffic lights based on active state AND position!
 */
export const Function_TrafficLights: Story = {
  args: {
    value: 234,
    columns: 3,
    beadShape: "custom",
    customBeadContent: {
      type: "emoji-function",
      value: (bead) => {
        if (!bead.active) return "⚫";
        if (bead.type === "heaven") return "🔴"; // Heaven beads = red
        // Earth beads cycle through traffic light colors by position
        const colors = ["🟢", "🟡", "🔴", "🟠"];
        return colors[bead.position] || "⚪";
      },
    },
    showNumbers: true,
    interactive: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Traffic light pattern! Heaven beads are red, earth beads cycle through colors by position. Inactive beads are dark. Try clicking to see it change!",
      },
    },
  },
};

/**
 * Function-Based Custom Beads - Themed by Color
 *
 * Use the bead's color property to choose themed emojis!
 */
export const Function_ColorThemed: Story = {
  args: {
    value: 456,
    columns: 3,
    beadShape: "custom",
    customBeadContent: {
      type: "emoji-function",
      value: (bead) => {
        // Use the color to determine emoji theme
        if (bead.color.includes("red") || bead.color.includes("f00"))
          return "🍎";
        if (bead.color.includes("blue") || bead.color.includes("00f"))
          return "🔵";
        if (bead.color.includes("green") || bead.color.includes("0f0"))
          return "🍏";
        return bead.active ? "⭐" : "⚪";
      },
    },
    showNumbers: true,
    colorScheme: "place-value",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Emojis chosen based on the bead's color! Red beads = apples, blue = circles, green = green apples.",
      },
    },
  },
};
