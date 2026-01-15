/**
 * Detailed requirements for each Kyu level in the Soroban certification system
 * Source: shuzan.jp
 *
 * Note: Stored verbatim from source. Display formatting/translation happens in the UI layer.
 */

export const kyuLevelDetails = {
  "10-kyu": `Add/Sub: 2-digit, 5口, 10字

×: 実+法 = 3 digits (20 problems)

Time: 20 min; Pass ≥ 60/200.
shuzan.jp`,

  "9-kyu": `Add/Sub: 2-digit, 5口, 10字

×: 実+法 = 3 digits (20)

Time: 20 min; Pass ≥ 120/200. (If only one part clears, it's treated as 10-kyu per federation notes.)
shuzan.jp`,

  "8-kyu": `Add/Sub: 2-digit, 8口, 16字

×: 実+法 = 4 digits (10)

÷: 法+商 = 3 digits (10)

Time: 20 min; Pass ≥ 120/200.
shuzan.jp`,

  "7-kyu": `Add/Sub: 2-digit, 10口, 20字

×: 実+法 = 4 digits (10)

÷: 法+商 = 4 digits (10)

Time: 20 min; Pass ≥ 120/200.
shuzan.jp`,

  "6-kyu": `Add/Sub: 10口, 30字

×: 実+法 = 5 digits (20)

÷: 法+商 = 4 digits (20)

Time: 30 min; Pass ≥ 210/300.
shuzan.jp`,

  "5-kyu": `Add/Sub: 10口, 40字

×: 実+法 = 6 digits (20)

÷: 法+商 = 5 digits (20)

Time: 30 min; Pass ≥ 210/300.
shuzan.jp`,

  "4-kyu": `Add/Sub: 10口, 50字

×: 実+法 = 7 digits (20)

÷: 法+商 = 6 digits (20)

Time: 30 min; Pass ≥ 210/300.
shuzan.jp`,

  "Pre-3-kyu": `Add/Sub: 10口, 50字 ×5題 and 10口, 60字 ×5題 (total 10)

×: 実+法 = 7 digits (20)

÷: 法+商 = 6 digits (20)

Time: 30 min; Pass ≥ 240/300.
shuzan.jp`,

  "3-kyu": `Add/Sub: 10口, 60字

×: 実+法 = 7 digits (20)

÷: 法+商 = 6 digits (20)

Time: 30 min; Pass ≥ 240/300.
shuzan.jp`,

  "Pre-2-kyu": `Add/Sub: 10口, 70字

×: 実+法 = 8 digits (20)

÷: 法+商 = 7 digits (20)

Time: 30 min; Pass ≥ 240/300.
shuzan.jp`,

  "2-kyu": `Add/Sub: 10口, 80字

×: 実+法 = 9 digits (20)

÷: 法+商 = 8 digits (20)

Time: 30 min; Pass ≥ 240/300.
shuzan.jp`,

  "Pre-1-kyu": `Add/Sub: 10口, 90字

×: 実+法 = 10 digits (20)

÷: 法+商 = 9 digits (20)

Time: 30 min; Pass ≥ 240/300.
shuzan.jp`,

  "1-kyu": `Add/Sub: 10口, 100字

×: 実+法 = 11 digits (20)

÷: 法+商 = 10 digits (20)

Time: 30 min; Pass ≥ 240/300.
shuzan.jp`,
} as const;

export type KyuLevel = keyof typeof kyuLevelDetails;
