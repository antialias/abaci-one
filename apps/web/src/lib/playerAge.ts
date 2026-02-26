export function normalizeBirthdayInput(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null

  const candidate = new Date(Date.UTC(year, month - 1, day))
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null
  }

  const today = new Date()
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  )
  if (candidate.getTime() > todayUtc) return null

  return `${match[1]}-${match[2]}-${match[3]}`
}

export function getAgeFromBirthday(
  birthday?: string | Date | null,
  asOf: Date = new Date()
): number | null {
  if (!birthday) return null

  let year: number
  let month: number
  let day: number

  if (typeof birthday === 'string') {
    const normalized = normalizeBirthdayInput(birthday)
    if (!normalized) return null
    const parts = normalized.split('-').map((part) => Number(part))
    year = parts[0]
    month = parts[1]
    day = parts[2]
  } else {
    if (Number.isNaN(birthday.getTime())) return null
    year = birthday.getUTCFullYear()
    month = birthday.getUTCMonth() + 1
    day = birthday.getUTCDate()
  }

  const asOfYear = asOf.getUTCFullYear()
  const asOfMonth = asOf.getUTCMonth() + 1
  const asOfDay = asOf.getUTCDate()

  let age = asOfYear - year
  if (asOfMonth < month || (asOfMonth === month && asOfDay < day)) {
    age -= 1
  }

  if (age < 0) return null
  return age
}

export function formatBirthdayForInput(birthday?: string | Date | null): string {
  if (!birthday) return ''
  if (typeof birthday === 'string') {
    return normalizeBirthdayInput(birthday) ?? ''
  }
  if (Number.isNaN(birthday.getTime())) return ''
  const year = birthday.getUTCFullYear()
  const month = String(birthday.getUTCMonth() + 1).padStart(2, '0')
  const day = String(birthday.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
