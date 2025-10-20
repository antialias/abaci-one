/**
 * Abaci One subtitle options with descriptions
 * Three-word rhyming subtitles for the main app navigation
 */

export interface Subtitle {
  text: string
  description: string
}

export const subtitles: Subtitle[] = [
  { text: 'Speed Bead Lead', description: 'blaze through bead races' },
  { text: 'Rod Mod Nod', description: 'tweak rod technique, approval earned' },
  { text: 'Grid Kid Lid', description: 'lock in neat grid habits' },
  { text: 'Count Mount Amount', description: 'stack up that number sense' },
  { text: 'Stack Track Tack', description: 'line up beads, lock in sums' },
  { text: 'Quick Flick Trick', description: 'rapid-fire bead tactics' },
  { text: 'Flash Dash Math', description: 'fly through numeric challenges' },
  { text: 'Slide Glide Pride', description: 'smooth soroban strokes' },
  { text: 'Shift Sift Gift', description: 'sort beads, reveal talent' },
  { text: 'Beat Seat Meet', description: 'compete head-to-head' },
  { text: 'Brain Train Gain', description: 'mental math muscle building' },
  { text: 'Flow Show Pro', description: 'demonstrate soroban mastery' },
  { text: 'Fast Blast Past', description: 'surpass speed limits' },
  { text: 'Snap Tap Map', description: 'chart your calculation path' },
  { text: 'Row Grow Know', description: 'advance through structured drills' },
  { text: 'Drill Skill Thrill', description: 'practice that excites' },
  { text: 'Think Link Sync', description: 'connect mind and beads' },
  { text: 'Boost Joust Roost', description: 'power up, compete, settle in' },
  { text: 'Add Grad Rad', description: 'level up addition awesomely' },
  { text: 'Sum Fun Run', description: 'enjoy the arithmetic sprint' },
  { text: 'Track Stack Pack', description: 'organize solutions systematically' },
  { text: 'Beat Neat Feat', description: 'clean victories, impressive wins' },
  { text: 'Math Path Wrath', description: 'dominate numeric challenges' },
  { text: 'Spark Mark Arc', description: 'ignite progress, track growth' },
  { text: 'Race Pace Ace', description: 'speed up, master it' },
  { text: 'Flex Hex Reflex', description: 'adapt calculations instantly' },
  { text: 'Glide Pride Stride', description: 'smooth confident progress' },
  { text: 'Flash Dash Smash', description: 'speed through, crush totals' },
  { text: 'Stack Attack Jack', description: 'aggressive bead strategies' },
  { text: 'Quick Pick Click', description: 'rapid bead selection' },
  { text: 'Snap Map Tap', description: 'visualize and execute' },
  { text: 'Mind Find Grind', description: 'discover mental endurance' },
  { text: 'Flip Skip Rip', description: 'fast transitions, tear through' },
  { text: 'Blend Trend Send', description: 'mix methods, share progress' },
  { text: 'Power Tower Hour', description: 'build skills intensively' },
  { text: 'Launch Staunch Haunch', description: 'start strong, stay firm' },
  { text: 'Rush Crush Hush', description: 'speed quietly dominates' },
  { text: 'Swipe Stripe Hype', description: 'sleek moves, excitement' },
  { text: 'Train Gain Sustain', description: 'build lasting ability' },
  { text: 'Frame Claim Flame', description: 'structure your fire' },
  { text: 'Streak Peak Tweak', description: 'hot runs, optimize performance' },
  { text: 'Edge Pledge Wedge', description: 'commit to precision' },
  { text: 'Pace Grace Space', description: 'rhythm, elegance, room to grow' },
  { text: 'Link Think Brink', description: 'connect at breakthrough edge' },
  { text: 'Quest Test Best', description: 'challenge yourself to excel' },
  { text: 'Drive Thrive Arrive', description: 'push hard, succeed, reach goals' },
  { text: 'Smart Start Chart', description: 'begin wisely, track progress' },
  { text: 'Boost Coast Toast', description: 'accelerate, cruise, celebrate' },
  { text: 'Spark Dark Embark', description: 'ignite before dawn journeys' },
  { text: 'Blaze Graze Amaze', description: 'burn through, touch lightly, wow' },
  { text: 'Shift Drift Gift', description: 'adapt smoothly, reveal talent' },
  { text: 'Zone Hone Own', description: 'focus, refine, claim mastery' },
  { text: 'Vault Halt Exalt', description: 'leap high, pause, celebrate' },
  { text: 'Peak Seek Streak', description: 'find heights, maintain momentum' },
  { text: 'Glow Show Grow', description: 'shine, display, expand' },
  { text: 'Scope Hope Rope', description: 'survey possibilities, climb up' },
  { text: 'Core Score More', description: 'fundamentals yield better results' },
  { text: 'Rank Bank Thank', description: 'earn status, save wins, appreciate' },
  { text: 'Merge Surge Verge', description: 'combine forces, power up, edge closer' },
  { text: 'Bold Gold Hold', description: 'brave attempts, prize rewards, maintain' },
  { text: 'Rise Prize Wise', description: 'ascend, win, learn' },
  { text: 'Move Groove Prove', description: 'act, find rhythm, demonstrate' },
  { text: 'Trust Thrust Adjust', description: 'believe, push, refine' },
  { text: 'Beam Dream Team', description: 'radiate, aspire, collaborate' },
  { text: 'Spin Win Grin', description: 'rotate beads, succeed, smile' },
  { text: 'String Ring Bring', description: 'connect, cycle, deliver' },
  { text: 'Clear Gear Steer', description: 'focus, equip, direct' },
  { text: 'Path Math Aftermath', description: 'route, calculate, results' },
  { text: 'Play Slay Day', description: 'engage, dominate, own it' },
  { text: 'Code Mode Road', description: 'pattern, style, journey' },
  { text: 'Craft Draft Shaft', description: 'build, sketch, core structure' },
  { text: 'Light Might Fight', description: 'illuminate, empower, compete' },
  { text: 'Stream Dream Extreme', description: 'flow, envision, push limits' },
  { text: 'Claim Frame Aim', description: 'assert, structure, target' },
  { text: 'Chart Smart Start', description: 'map, intelligent, begin' },
  { text: 'Bright Flight Height', description: 'brilliant, soar, elevation' },
]

/**
 * Get a random subtitle from the list
 * Uses current timestamp as seed for variety across sessions
 */
export function getRandomSubtitle(): Subtitle {
  const index = Math.floor(Math.random() * subtitles.length)
  return subtitles[index]
}
