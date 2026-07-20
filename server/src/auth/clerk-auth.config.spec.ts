import { getClerkVerificationOptions } from './clerk-auth.config';

describe('getClerkVerificationOptions', () => {
  it('requires the Clerk secret key', () => {
    expect(() =>
      getClerkVerificationOptions({
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_example',
        CLERK_AUTHORIZED_PARTIES: 'https://kyte.example',
      }),
    ).toThrow('CLERK_SECRET_KEY is required');
  });

  it('normalizes a comma-separated authorized-party allowlist', () => {
    expect(
      getClerkVerificationOptions({
        CLERK_SECRET_KEY: 'sk_test_example',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_example',
        CLERK_AUTHORIZED_PARTIES:
          ' https://kyte.example,https://www.kyte.example ',
      }),
    ).toEqual({
      secretKey: 'sk_test_example',
      publishableKey: 'pk_test_example',
      authorizedParties: ['https://kyte.example', 'https://www.kyte.example'],
    });
  });

  it('infers the frontend origin from the public API URL', () => {
    expect(
      getClerkVerificationOptions({
        CLERK_SECRET_KEY: 'sk_test_example',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_example',
        NEXT_PUBLIC_API_BASE_URL: 'http://localhost:8080/api',
      }),
    ).toEqual({
      secretKey: 'sk_test_example',
      publishableKey: 'pk_test_example',
      authorizedParties: ['http://localhost:8080'],
    });
  });

  it('fails closed when no authorized party can be determined', () => {
    expect(() =>
      getClerkVerificationOptions({
        CLERK_SECRET_KEY: 'sk_test_example',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_example',
      }),
    ).toThrow('CLERK_AUTHORIZED_PARTIES is required');
  });
});
