import { authClient } from "@/lib/auth-client";
import { EMAIL_VERIFICATION_SUCCESS_PATH } from "@shared/routes";
import {
  requestPassphraseResetSchema,
  signInWithPassphraseSchema,
  signUpRequestSchema,
  type RequestPassphraseResetInput,
  type SignInWithPassphraseInput,
  type SignUpRequestInput,
} from "@shared/auth/schemas";

type EmailSignInArgs = Parameters<typeof authClient.signIn.email>;
type UsernameSignInArgs = Parameters<typeof authClient.signIn.username>;
type EmailSignUpArgs = Parameters<typeof authClient.signUp.email>;

type EmailSignInConfig = EmailSignInArgs[0];
type EmailSignInCallbacks = EmailSignInArgs extends [
  EmailSignInConfig,
  infer Callbacks,
]
  ? Callbacks
  : never;

type UsernameSignInConfig = UsernameSignInArgs[0];
type UsernameSignInCallbacks = UsernameSignInArgs extends [
  UsernameSignInConfig,
  infer Callbacks,
]
  ? Callbacks
  : never;

type EmailSignUpConfig = EmailSignUpArgs[0];
type EmailSignUpCallbacks = EmailSignUpArgs extends [
  EmailSignUpConfig,
  infer Callbacks,
]
  ? Callbacks
  : never;

export function signInWithPassphrase(
  config: SignInWithPassphraseInput,
  callbacks?: EmailSignInCallbacks | UsernameSignInCallbacks,
) {
  const parsed = signInWithPassphraseSchema.parse(config);
  const { passphrase } = parsed;

  if ("email" in parsed) {
    const payload: EmailSignInConfig = {
      email: parsed.email,
      password: passphrase,
    };
    return authClient.signIn.email(
      payload,
      callbacks as EmailSignInCallbacks | undefined,
    );
  }

  const payload: UsernameSignInConfig = {
    username: parsed.username,
    password: passphrase,
  };
  return authClient.signIn.username(
    payload,
    callbacks as UsernameSignInCallbacks | undefined,
  );
}

export function signUpWithPassphrase(
  config: SignUpRequestInput,
  callbacks?: EmailSignUpCallbacks,
) {
  const parsed = signUpRequestSchema.parse(config);
  const { passphrase, ...rest } = parsed;
  const callbackURL =
    typeof window !== "undefined" && window.location?.origin
      ? `${window.location.origin}${EMAIL_VERIFICATION_SUCCESS_PATH}`
      : undefined;
  const payload: EmailSignUpConfig = {
    ...rest,
    password: passphrase,
    ...(callbackURL ? { callbackURL } : {}),
  };
  return authClient.signUp.email(payload, callbacks);
}

export function requestPassphraseReset(params: RequestPassphraseResetInput) {
  const parsed = requestPassphraseResetSchema.parse(params);
  return authClient.forgetPassword(parsed);
}
