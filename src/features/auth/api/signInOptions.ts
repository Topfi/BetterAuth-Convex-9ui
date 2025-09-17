import type { SignInOptions } from "@shared/auth";
import { resolveSignInOptions } from "@shared/auth";

export const signInOptions: SignInOptions = resolveSignInOptions(
  import.meta.env,
);
