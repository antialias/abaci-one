import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ClientProviders } from "@/components/ClientProviders";
import { getRequestLocale } from "@/i18n/request";
import { getMessages } from "@/i18n/messages";

export const metadata: Metadata = {
  metadataBase: new URL("https://abaci.one"),
  title: {
    default: "Abaci.One - Interactive Soroban Learning",
    template: "%s | Abaci.One",
  },
  description:
    "Master the Japanese abacus (soroban) with interactive tutorials, arcade-style math games, and beautiful flashcards. Learn arithmetic through play with Rithmomachia, Complement Race, and more.",
  keywords: [
    "soroban",
    "abacus",
    "Japanese abacus",
    "mental arithmetic",
    "math games",
    "abacus tutorial",
    "soroban learning",
    "arithmetic practice",
    "educational games",
    "Rithmomachia",
    "number bonds",
    "complement training",
  ],
  authors: [{ name: "Abaci.One" }],
  creator: "Abaci.One",
  publisher: "Abaci.One",

  // Open Graph
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["de_DE", "ja_JP", "hi_IN", "es_ES", "la"],
    url: "https://abaci.one",
    title: "Abaci.One - Interactive Soroban Learning",
    description:
      "Master the Japanese abacus through interactive games, tutorials, and practice",
    siteName: "Abaci.One",
  },

  // Twitter
  twitter: {
    card: "summary_large_image",
    title: "Abaci.One - Interactive Soroban Learning",
    description: "Master the Japanese abacus through games and practice",
  },

  // Icons
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },

  // App-specific
  applicationName: "Abaci.One",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Abaci.One",
  },

  // Modern web app capable meta tag (non-Apple browsers)
  other: {
    "mobile-web-app-capable": "yes",
  },

  // Category
  category: "education",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getRequestLocale();
  const messages = await getMessages(locale);

  return (
    <html lang={locale}>
      <body>
        <ClientProviders initialLocale={locale} initialMessages={messages}>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
