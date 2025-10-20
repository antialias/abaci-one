/**
 * Detailed requirements for each Kyu level in the Soroban certification system
 * Source: shuzan.jp
 */

export const kyuLevelDetails = {
  '10-kyu': `+ / −:
  • 2-digit, 5 rows, 10 chars

×:
  • 3 digits total (20 problems)

Exam: 20 min
Pass: ≥60/200 points`,

  '9-kyu': `+ / −:
  • 2-digit, 5 rows, 10 chars

×:
  • 3 digits total (20 problems)

Exam: 20 min
Pass: ≥120/200 points`,

  '8-kyu': `+ / −:
  • 2-digit, 8 rows, 16 chars

×:
  • 4 digits total (10 problems)

÷:
  • 3 digits total (10 problems)

Exam: 20 min | Pass: ≥120/200`,

  '7-kyu': `+ / −:
  • 2-digit, 10 rows, 20 chars

×:
  • 4 digits total (10 problems)

÷:
  • 4 digits total (10 problems)

Exam: 20 min | Pass: ≥120/200`,

  '6-kyu': `+ / −:
  • 10 rows, 30 chars

×:
  • 5 digits total (20 problems)

÷:
  • 4 digits total (20 problems)

Exam: 30 min | Pass: ≥210/300`,

  '5-kyu': `+ / −:
  • 10 rows, 40 chars

×:
  • 6 digits total (20 problems)

÷:
  • 5 digits total (20 problems)

Exam: 30 min | Pass: ≥210/300`,

  '4-kyu': `+ / −:
  • 10 rows, 50 chars

×:
  • 7 digits total (20 problems)

÷:
  • 6 digits total (20 problems)

Exam: 30 min | Pass: ≥210/300`,

  'Pre-3-kyu': `+ / −:
  • 10 rows, 50-60 chars (10 problems)

×:
  • 7 digits total (20 problems)

÷:
  • 6 digits total (20 problems)

Exam: 30 min | Pass: ≥240/300`,

  '3-kyu': `+ / −:
  • 10 rows, 60 chars

×:
  • 7 digits total (20 problems)

÷:
  • 6 digits total (20 problems)

Exam: 30 min | Pass: ≥240/300`,

  'Pre-2-kyu': `+ / −:
  • 10 rows, 70 chars

×:
  • 8 digits total (20 problems)

÷:
  • 7 digits total (20 problems)

Exam: 30 min | Pass: ≥240/300`,

  '2-kyu': `+ / −:
  • 10 rows, 80 chars

×:
  • 9 digits total (20 problems)

÷:
  • 8 digits total (20 problems)

Exam: 30 min | Pass: ≥240/300`,

  'Pre-1-kyu': `+ / −:
  • 10 rows, 90 chars

×:
  • 10 digits total (20 problems)

÷:
  • 9 digits total (20 problems)

Exam: 30 min | Pass: ≥240/300`,

  '1-kyu': `+ / −:
  • 10 rows, 100 chars

×:
  • 11 digits total (20 problems)

÷:
  • 10 digits total (20 problems)

Exam: 30 min | Pass: ≥240/300`,
} as const

export type KyuLevel = keyof typeof kyuLevelDetails
