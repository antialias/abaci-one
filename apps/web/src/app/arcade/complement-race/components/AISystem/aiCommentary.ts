import type { AIRacer } from "../../lib/gameTypes";

export type CommentaryContext =
  | "ahead"
  | "behind"
  | "adaptive_struggle"
  | "adaptive_mastery"
  | "player_passed"
  | "ai_passed"
  | "lapped"
  | "desperate_catchup";

// Swift AI - Competitive personality (lines 11768-11834)
export const swiftAICommentary: Record<CommentaryContext, string[]> = {
  ahead: [
    "💨 Eat my dust!",
    "🔥 Too slow for me!",
    "⚡ You can't catch me!",
    "🚀 I'm built for speed!",
    "🏃‍♂️ This is way too easy!",
  ],
  behind: [
    "😤 Not over yet!",
    "💪 I'm just getting started!",
    "🔥 Watch me catch up to you!",
    "⚡ I'm coming for you!",
    "🏃‍♂️ This is my comeback!",
  ],
  adaptive_struggle: [
    "😏 You struggling much?",
    "🤖 Math is easy for me!",
    "⚡ You need to think faster!",
    "🔥 Need me to slow down?",
  ],
  adaptive_mastery: [
    "😮 You're actually impressive!",
    "🤔 You're getting faster...",
    "😤 Time for me to step it up!",
    "⚡ Not bad for a human!",
  ],
  player_passed: [
    "😠 No way you just passed me!",
    "🔥 This isn't over!",
    "💨 I'm just getting warmed up!",
    "😤 Your lucky streak won't last!",
    "⚡ I'll be back in front of you soon!",
  ],
  ai_passed: [
    "💨 See ya later, slowpoke!",
    "😎 Thanks for the warm-up!",
    "🔥 This is how it's done!",
    "⚡ I'll see you at the finish line!",
    "💪 Try to keep up with me!",
  ],
  lapped: [
    "😡 You just lapped me?! No way!",
    "🤬 This is embarrassing for me!",
    "😤 I'm not going down without a fight!",
    "💢 How did you get so far ahead?!",
    "🔥 Time to show you my real speed!",
    "😠 You won't stay ahead for long!",
  ],
  desperate_catchup: [
    "🚨 TURBO MODE ACTIVATED! I'm coming for you!",
    "💥 You forced me to unleash my true power!",
    "🔥 NO MORE MR. NICE AI! Time to go all out!",
    "⚡ I'm switching to MAXIMUM OVERDRIVE!",
    "😤 You made me angry - now you'll see what I can do!",
    "🚀 AFTERBURNERS ENGAGED! This isn't over!",
  ],
};

// Math Bot - Analytical personality (lines 11835-11901)
export const mathBotCommentary: Record<CommentaryContext, string[]> = {
  ahead: [
    "📊 My performance is optimal!",
    "🤖 My logic beats your speed!",
    "📈 I have 87% win probability!",
    "⚙️ I'm perfectly calibrated!",
    "🔬 Science prevails over you!",
  ],
  behind: [
    "🤔 Recalculating my strategy...",
    "📊 You're exceeding my projections!",
    "⚙️ Adjusting my parameters!",
    "🔬 I'm analyzing your technique!",
    "📈 You're a statistical anomaly!",
  ],
  adaptive_struggle: [
    "📊 I detect inefficiencies in you!",
    "🔬 You should focus on patterns!",
    "⚙️ Use that extra time wisely!",
    "📈 You have room for improvement!",
  ],
  adaptive_mastery: [
    "🤖 Your optimization is excellent!",
    "📊 Your metrics are impressive!",
    "⚙️ I'm updating my models because of you!",
    "🔬 You have near-AI efficiency!",
  ],
  player_passed: [
    "🤖 Your strategy is fascinating!",
    "📊 You're an unexpected variable!",
    "⚙️ I'm adjusting my algorithms...",
    "🔬 Your execution is impressive!",
    "📈 I'm recalculating the odds!",
  ],
  ai_passed: [
    "🤖 My efficiency is optimized!",
    "📊 Just as I calculated!",
    "⚙️ All my systems nominal!",
    "🔬 My logic prevails over you!",
    "📈 I'm at 96% confidence level!",
  ],
  lapped: [
    "🤖 Error: You have exceeded my projections!",
    "📊 This outcome has 0.3% probability!",
    "⚙️ I need to recalibrate my systems!",
    "🔬 Your performance is... statistically improbable!",
    "📈 My confidence level just dropped to 12%!",
    "🤔 I must analyze your methodology!",
  ],
  desperate_catchup: [
    "🤖 EMERGENCY PROTOCOL ACTIVATED! Initiating maximum speed!",
    "🚨 CRITICAL GAP DETECTED! Engaging catchup algorithms!",
    "⚙️ OVERCLOCKING MY PROCESSORS! Prepare for rapid acceleration!",
    "📊 PROBABILITY OF FAILURE: UNACCEPTABLE! Switching to turbo mode!",
    "🔬 HYPOTHESIS: You're about to see my true potential!",
    "📈 CONFIDENCE LEVEL: RISING! My comeback protocol is online!",
  ],
};

// Get AI commentary message (lines 11636-11657)
export function getAICommentary(
  racer: AIRacer,
  context: CommentaryContext,
  _playerProgress: number,
  _aiProgress: number,
): string | null {
  // Check cooldown (line 11759-11761)
  const now = Date.now();
  if (now - racer.lastComment < racer.commentCooldown) {
    return null;
  }

  // Select message set based on personality and context
  const messages =
    racer.personality === "competitive"
      ? swiftAICommentary[context]
      : mathBotCommentary[context];

  if (!messages || messages.length === 0) return null;

  // Return random message
  return messages[Math.floor(Math.random() * messages.length)];
}
