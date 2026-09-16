export function assert(condition: boolean, message?: string): void {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

export function assertEquals<T>(actual: unknown, expected: unknown, message?: string): void {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected} but got ${actual}`);
  }
}

export function assertNotEquals<T>(actual: unknown, expected: unknown, message?: string): void {
  if (actual === expected) {
    throw new Error(message || `Expected ${expected} but got ${actual}`);
  }
}

export async function assertRejects(
  fn: () => PromiseLike<unknown>,
  _ErrorClass: typeof Error,
  msg?: string,
): Promise<Error> {
  let result: Error | undefined;

  try {
    await fn();
  } catch (e) {
    if (e instanceof Error) {
      result = e;
    } else {
      throw new Error('Caught value was not an Error', );
    }
  }

  if (result === undefined) {
    throw new Error('Function did not throw, expected it to reject', );
  }

  // Check message if provided
  if (msg && result.message !== msg) {
    throw new Error(
      `Expected error message "${msg}" but got "${result.message}"`,
    );
  }

  return result;
}
