/**
 * The provenance tag abaci stamps on every print job it submits (Gitea #8/#9).
 * Client-safe: the ticket builder fills it in and the submit proxy re-stamps it
 * as enforcement — the one sanctioned mutation on the byte-faithful path.
 */
export const PRINT_SOURCE_APP = 'abacus-studio'
