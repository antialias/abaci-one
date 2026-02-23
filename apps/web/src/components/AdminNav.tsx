"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { css } from "../../styled-system/css";

interface AdminNavItem {
  href: string;
  label: string;
  description: string;
}

const adminNavItems: AdminNavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    description: "System overview",
  },
  {
    href: "/admin/tasks",
    label: "Tasks",
    description: "Background jobs",
  },
  {
    href: "/admin/bkt-settings",
    label: "BKT",
    description: "Skill classification",
  },
  {
    href: "/admin/practice-config",
    label: "Practice",
    description: "Term scaling",
  },
  {
    href: "/flowchart/admin",
    label: "Flowcharts",
    description: "Curriculum",
  },
  {
    href: "/admin/constant-images",
    label: "Images",
    description: "Constant illustrations",
  },
  {
    href: "/admin/blog-images",
    label: "Blog",
    description: "Post hero images",
  },
  {
    href: "/admin/homepage-previews",
    label: "Homepage",
    description: "Preview images",
  },
  {
    href: "/admin/audio",
    label: "Audio",
    description: "TTS clips",
  },
  {
    href: "/admin/tts-lab",
    label: "TTS Lab",
    description: "Reliability tests",
  },
  {
    href: "/admin/euclid-editor",
    label: "Euclid",
    description: "Proof editor",
  },
  {
    href: "/admin/feature-flags",
    label: "Flags",
    description: "Feature flags",
  },
  {
    href: "/admin/pricing",
    label: "Pricing",
    description: "Stripe prices",
  },
  {
    href: "/admin/subscriptions",
    label: "Tiers",
    description: "User subscriptions",
  },
  {
    href: "/admin/notifications",
    label: "Notifications",
    description: "Channel config",
  },
  {
    href: "/vision-training",
    label: "Vision",
    description: "ML training",
  },
];

/**
 * Secondary navigation bar for admin pages.
 * Shows tabs for switching between admin tools.
 */
export function AdminNav() {
  const pathname = usePathname();

  // Determine which nav item is active
  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname.startsWith(href);
  };

  return (
    <nav
      className={css({
        backgroundColor: "#161b22",
        borderBottom: "1px solid #30363d",
        padding: "0 24px",
      })}
    >
      <div
        className={css({
          maxWidth: "1200px",
          margin: "0 auto",
          display: "flex",
          gap: "4px",
          overflowX: "auto",
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        })}
      >
        {adminNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={css({
              display: "flex",
              flexDirection: "column",
              padding: "12px 16px",
              textDecoration: "none",
              borderBottom: "2px solid",
              borderColor: isActive(item.href) ? "#58a6ff" : "transparent",
              backgroundColor: isActive(item.href) ? "#1c2128" : "transparent",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
              "&:hover": {
                backgroundColor: "#1c2128",
              },
            })}
          >
            <span
              className={css({
                fontSize: "13px",
                fontWeight: "600",
                color: isActive(item.href) ? "#f0f6fc" : "#c9d1d9",
              })}
            >
              {item.label}
            </span>
            <span
              className={css({
                fontSize: "11px",
                color: "#8b949e",
                marginTop: "2px",
              })}
            >
              {item.description}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
