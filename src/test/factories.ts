import type { CounterValue } from "@shared/counter";

export type PartialDeep<T> = {
  [K in keyof T]?: T[K] extends object ? PartialDeep<T[K]> : T[K];
};

export const createUser = <T extends object>(
  overrides: PartialDeep<T> = {},
): T & {
  name?: string | null;
  email?: string | null;
  image?: string | null;
} => {
  return {
    name: "Test User",
    email: "user@example.com",
    image: null,
    ...overrides,
  } as T & {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
};

export const createCounterValue = (
  overrides: Partial<CounterValue> = {},
): CounterValue => ({
  value: 5,
  ...overrides,
});
