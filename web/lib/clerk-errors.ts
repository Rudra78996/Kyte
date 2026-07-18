import { isKnownError } from '@clerk/nextjs/errors'

/**
 * Friendly messages for Clerk error codes that can occur during sign-in / sign-up.
 * The `code` is the machine-stable identifier from Clerk; the raw `message` is not
 * guaranteed to be stable and is intended for developers, so we map codes to
 * user-facing copy and fall back to Clerk's `longMessage` when we have no mapping.
 *
 * Reference: https://clerk.com/docs/reference/errors
 */
const FRIENDLY_MESSAGES: Record<string, string> = {
  // Credentials
  form_identifier_not_found: 'We couldn’t find an account with that email. Please try again or sign up.',
  form_identifier_exists: 'An account with that email already exists. Try signing in instead.',
  form_password_incorrect: 'That password doesn’t match. Please try again.',
  form_password_size_too_short: 'Password is too short.',
  form_password_size_too_long: 'Password is too long.',
  form_password_format_invalid: 'That password isn’t allowed. Please choose a different one.',
  form_param_format_invalid: 'That doesn’t look right. Please check the format and try again.',
  form_code_incorrect: 'That code is incorrect. Please try again.',
  form_code_expired: 'That code has expired. Please request a new one.',
  form_verified: 'This verification has already been used. Please request a new code.',

  // Sign-up specific
  form_username_invalid: 'That username is invalid.',
  form_username_invalid_length: 'Username must be between 4 and 64 characters.',
  form_password_pii: 'Password cannot contain personal information.',
  form_password_common: 'That password is too common. Please choose a stronger one.',
  form_password_reused: 'That password has been used before. Please choose a new one.',

  // Account state / lockout / rate limit
  not_allowed_in_instance: 'This account is not allowed to sign in here.',
  user_locked: 'This account has been locked. Please contact support.',
  attempt_limit_failed: 'Too many attempts. Please wait a moment and try again.',
  form_concurrent_attempts: 'Too many requests. Please slow down and try again.',

  // Network / bot protection
  network: 'Network error. Please check your connection and try again.',
  captcha_required: 'Verification is required. Please complete the challenge and try again.',
  captcha_invalid: 'Verification failed. Please complete the challenge and try again.',
}

/**
 * Extract a user-facing message from a Clerk error, falling back to a sensible
 * generic message. Pass the value thrown/rejected by Clerk methods.
 */
export function getClerkErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isKnownError(err)) {
    return FRIENDLY_MESSAGES[err.code] ?? ('longMessage' in err ? (err as { longMessage?: string }).longMessage : undefined) ?? fallback
  }
  return fallback
}
