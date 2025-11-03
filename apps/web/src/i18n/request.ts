import { getRequestConfig } from 'next-intl/server'
import { headers, cookies } from 'next/headers'
import { defaultLocale, LOCALE_COOKIE_NAME, locales, type Locale } from './routing'
import { getMessages } from './messages'

export async function getRequestLocale(): Promise<Locale> {
  // Get locale from header (set by middleware) or cookie
  const headersList = await headers()
  const cookieStore = await cookies()

  let locale = headersList.get('x-locale') as Locale | null

  if (!locale) {
    locale = (cookieStore.get(LOCALE_COOKIE_NAME)?.value as Locale | undefined) ?? null
  }

  // Validate and fallback to default
  if (!locale || !locales.includes(locale)) {
    locale = defaultLocale
  }

  return locale
}

export default getRequestConfig(async () => {
  const locale = await getRequestLocale()

  return {
    locale,
    messages: await getMessages(locale),
    timeZone: 'UTC',
  }
})
