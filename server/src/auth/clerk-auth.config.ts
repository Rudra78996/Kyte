export interface ClerkAuthEnvironment {
  CLERK_SECRET_KEY?: string;
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  CLERK_AUTHORIZED_PARTIES?: string;
  NEXT_PUBLIC_API_BASE_URL?: string;
}

function getFrontendOrigin(apiBaseUrl?: string): string | undefined {
  if (!apiBaseUrl) {
    return undefined;
  }

  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    return undefined;
  }
}

export function getClerkVerificationOptions(
  env: ClerkAuthEnvironment = process.env,
) {
  const secretKey = env.CLERK_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY is required');
  }
  const publishableKey = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  if (!publishableKey) {
    throw new Error('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required');
  }

  const configuredParties = (env.CLERK_AUTHORIZED_PARTIES ?? '')
    .split(',')
    .map((party) => party.trim())
    .filter(Boolean);
  const inferredParty = getFrontendOrigin(env.NEXT_PUBLIC_API_BASE_URL);
  const authorizedParties =
    configuredParties.length > 0
      ? configuredParties
      : inferredParty
        ? [inferredParty]
        : [];

  if (authorizedParties.length === 0) {
    throw new Error(
      'CLERK_AUTHORIZED_PARTIES is required when the frontend origin cannot be inferred',
    );
  }

  return {
    secretKey,
    publishableKey,
    authorizedParties,
  };
}
