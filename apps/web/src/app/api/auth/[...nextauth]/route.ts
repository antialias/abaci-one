/**
 * NextAuth v5 API route handlers
 *
 * Handles all NextAuth routes:
 * - GET  /api/auth/signin
 * - POST /api/auth/signin/:provider
 * - GET  /api/auth/signout
 * - POST /api/auth/signout
 * - GET  /api/auth/session
 * - GET  /api/auth/csrf
 * - POST /api/auth/callback/:provider
 * - etc.
 */

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
