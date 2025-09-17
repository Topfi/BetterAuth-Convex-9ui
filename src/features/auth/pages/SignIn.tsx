import { useState } from "react";
import { z, type ZodIssue } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { PassphraseInput } from "@/features/auth/components/PassphraseInput";
import { authClient } from "@/lib/auth-client";
import {
  requestPassphraseReset,
  signInWithPassphrase,
} from "@/features/auth/api/passphrase";
import { signInOptions } from "@/features/auth/api/signInOptions";
import { toast } from "@/lib/toast";
import {
  emailSchema,
  hasAnySignInMethod,
  hasPassphraselessMethod,
  otpSchema,
  passphraseSchema,
  signInIdentifierSchema,
  signInOtpVerificationSchema,
  signInWithPassphraseSchema,
} from "@shared/auth";
import {
  formatCombinedHistoricalPlaceholder,
  pickRandomHistoricalIdentifierPlaceholder,
} from "@shared/auth/historicalIdentifierPlaceholders";

type SignInMethod = "passphrase" | "passphraseless";

const signInFormSchema = z.object({
  identifier: z
    .string({ required_error: "Enter your email or username." })
    .trim()
    .min(1, { message: "Enter your email or username." }),
  passphrase: passphraseSchema.optional(),
  otp: otpSchema.optional(),
});

type SignInFormValues = z.infer<typeof signInFormSchema>;

type FormFieldKey = keyof Pick<
  SignInFormValues,
  "identifier" | "passphrase" | "otp"
>;

export default function SignIn() {
  const passphraseEnabled = signInOptions.passphrase;
  const passphraselessEnabled = hasPassphraselessMethod(signInOptions);
  const passphraselessDescription =
    signInOptions.magicLink && signInOptions.otp
      ? "magic link or verification code"
      : signInOptions.magicLink
        ? "magic link"
        : signInOptions.otp
          ? "verification code"
          : "";
  const passphraselessSupportCopy =
    signInOptions.magicLink && signInOptions.otp
      ? "We'll email you a magic link or verification code once you enter your email."
      : signInOptions.magicLink
        ? "We'll email you a magic link once you enter your email."
        : "We'll email you a verification code once you enter your email.";
  const showSocialProviders =
    signInOptions.github || signInOptions.google || signInOptions.apple;

  const noSignInMethods = !hasAnySignInMethod(signInOptions);

  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [signInMethod, setSignInMethod] = useState<SignInMethod>(() =>
    passphraselessEnabled ? "passphraseless" : "passphrase",
  );
  const [otpSent, setOtpSent] = useState(false);
  const [historicalPlaceholder] = useState(() =>
    pickRandomHistoricalIdentifierPlaceholder(),
  );

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInFormSchema),
    defaultValues: {
      identifier: "",
      passphrase: undefined,
      otp: undefined,
    },
  });

  const applyIssueMessages = (issues: ZodIssue[]) => {
    issues.forEach((issue) => {
      const field = issue.path[0];
      if (field === "identifier" || field === "passphrase" || field === "otp") {
        form.setError(field as FormFieldKey, {
          type: "manual",
          message: issue.message,
        });
      }
    });
  };

  const ensureEmail = (): string | null => {
    const result = emailSchema.safeParse(form.getValues("identifier"));
    if (!result.success) {
      applyIssueMessages(result.error.issues);
      return null;
    }
    form.setValue("identifier", result.data, {
      shouldDirty: true,
      shouldTouch: true,
    });
    form.clearErrors("identifier");
    return result.data;
  };

  const handlePassphraseSubmit = async (values: SignInFormValues) => {
    const identifierResult = signInIdentifierSchema.safeParse(
      values.identifier,
    );

    if (!identifierResult.success) {
      const firstIssue = identifierResult.error.issues[0];
      form.setError("identifier", {
        type: "manual",
        message: firstIssue?.message ?? "Enter your email or username.",
      });
      return;
    }

    if (identifierResult.data.kind === "email") {
      form.setValue("identifier", identifierResult.data.value, {
        shouldDirty: true,
        shouldTouch: true,
      });
    }
    form.clearErrors("identifier");

    const payload =
      identifierResult.data.kind === "email"
        ? {
            email: identifierResult.data.value,
            passphrase: values.passphrase,
          }
        : {
            username: identifierResult.data.value,
            passphrase: values.passphrase,
          };

    const result = signInWithPassphraseSchema.safeParse(payload);

    if (!result.success) {
      applyIssueMessages(result.error.issues);
      return;
    }

    await signInWithPassphrase(result.data, {
      onRequest: () => {
        setOtpLoading(true);
      },
      onSuccess: () => {
        setOtpLoading(false);
        toast.success({
          title: "Signed in",
          description: "You have successfully signed in with your passphrase.",
        });
      },
      onError: (ctx) => {
        setOtpLoading(false);
        toast.error({
          title: "Unable to sign in",
          description: ctx.error.message,
        });
      },
    });
  };

  const handleOtpVerification = async (values: SignInFormValues) => {
    const email = ensureEmail();
    if (!email) {
      return;
    }

    const result = signInOtpVerificationSchema.safeParse({
      email,
      otp: values.otp,
    });

    if (!result.success) {
      applyIssueMessages(result.error.issues);
      return;
    }

    await authClient.signIn.emailOtp(
      {
        email: result.data.email,
        otp: result.data.otp,
      },
      {
        onRequest: () => {
          setOtpLoading(true);
        },
        onSuccess: () => {
          setOtpLoading(false);
          toast.success({
            title: "Signed in",
            description: "Your verification code was accepted.",
          });
          setOtpSent(false);
          form.setValue("otp", undefined, {
            shouldDirty: false,
            shouldTouch: false,
          });
        },
        onError: (ctx) => {
          setOtpLoading(false);
          toast.error({
            title: "OTP verification failed",
            description: ctx.error.message,
          });
        },
      },
    );
  };

  const onSubmit = async (values: SignInFormValues) => {
    if (signInMethod === "passphrase") {
      if (!passphraseEnabled) {
        return;
      }
      await handlePassphraseSubmit(values);
      return;
    }

    if (signInMethod === "passphraseless" && signInOptions.otp && otpSent) {
      await handleOtpVerification(values);
    }
  };

  const handleResetPassphrase = async () => {
    const email = ensureEmail();
    if (!email) {
      return;
    }

    const siteUrl = import.meta.env.VITE_SITE_URL;
    if (!siteUrl) {
      toast.error({
        title: "Reset unavailable",
        description:
          "Missing VITE_SITE_URL. Update your environment configuration.",
      });
      return;
    }

    setForgotLoading(true);
    try {
      await requestPassphraseReset({
        email,
        redirectTo: `${siteUrl}/reset-passphrase`,
      });
      toast.success({
        title: "Reset link sent",
        description: "Check your email to finish resetting your passphrase.",
      });
    } catch (error) {
      let description: string | undefined;
      if (error instanceof Error) {
        const message = error.message;
        if (message.toLowerCase().includes("user not found")) {
          description =
            "If we have an account matching that email, we'll send passphrase reset instructions.";
        } else {
          description = message;
        }
      }
      toast.error({
        title: "Unable to send reset link",
        description,
      });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleMagicLinkSignIn = async () => {
    if (!signInOptions.magicLink) {
      return;
    }
    const email = ensureEmail();
    if (!email) {
      return;
    }

    await authClient.signIn.magicLink(
      { email },
      {
        onRequest: () => {
          setMagicLinkLoading(true);
        },
        onSuccess: () => {
          setMagicLinkLoading(false);
          toast.info({
            title: "Magic link sent",
            description: "Check your email to finish signing in.",
          });
        },
        onError: (ctx) => {
          setMagicLinkLoading(false);
          toast.error({
            title: "Magic link failed",
            description: ctx.error.message,
          });
        },
      },
    );
  };

  const handleOtpSend = async () => {
    if (!signInOptions.otp) {
      return;
    }
    if (otpSent) {
      return;
    }

    const email = ensureEmail();
    if (!email) {
      return;
    }

    await authClient.emailOtp.sendVerificationOtp(
      {
        email,
        type: "sign-in",
      },
      {
        onRequest: () => {
          setOtpLoading(true);
        },
        onSuccess: () => {
          setOtpLoading(false);
          setOtpSent(true);
          form.setValue("otp", undefined, {
            shouldDirty: false,
            shouldTouch: false,
          });
          toast.info({
            title: "Verification code sent",
            description: "Enter the code from your email to finish signing in.",
          });
        },
        onError: (ctx) => {
          setOtpLoading(false);
          toast.error({
            title: "OTP sign-in failed",
            description: ctx.error.message,
          });
        },
      },
    );
  };

  const handleGithubSignIn = async () => {
    if (!signInOptions.github) {
      return;
    }
    await authClient.signIn.social(
      {
        provider: "github",
      },
      {
        onRequest: () => {
          setOtpLoading(true);
        },
        onSuccess: () => {
          setOtpLoading(false);
          toast.success({
            title: "Signed in",
            description: "You have successfully signed in with GitHub.",
          });
        },
        onError: (ctx) => {
          setOtpLoading(false);
          toast.error({
            title: "GitHub sign-in failed",
            description: ctx.error.message,
          });
        },
      },
    );
  };

  const handleGoogleSignIn = async () => {
    if (!signInOptions.google) {
      return;
    }
    await authClient.signIn.social(
      {
        provider: "google",
      },
      {
        onRequest: () => {
          setOtpLoading(true);
        },
        onSuccess: () => {
          setOtpLoading(false);
          toast.success({
            title: "Signed in",
            description: "You have successfully signed in with Google.",
          });
        },
        onError: (ctx) => {
          setOtpLoading(false);
          toast.error({
            title: "Google sign-in failed",
            description: ctx.error.message,
          });
        },
      },
    );
  };

  const handleAppleSignIn = async () => {
    if (!signInOptions.apple) {
      return;
    }
    await authClient.signIn.social(
      {
        provider: "apple",
      },
      {
        onRequest: () => {
          setOtpLoading(true);
        },
        onSuccess: () => {
          setOtpLoading(false);
          toast.success({
            title: "Signed in",
            description: "You have successfully signed in with Apple.",
          });
        },
        onError: (ctx) => {
          setOtpLoading(false);
          toast.error({
            title: "Apple sign-in failed",
            description: ctx.error.message,
          });
        },
      },
    );
  };

  if (noSignInMethods) {
    return (
      <Card className="mx-auto w-full max-w-[420px] space-y-0 border border-border/60 bg-card shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-semibold">
            Sign-In Unavailable
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Enable at least one sign-in method in your environment configuration
            to restore access.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-[420px] space-y-0 border border-border/60 bg-card shadow-2xl">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-semibold">Sign In</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Enter your email for a magic link or switch to your username and
          passphrase
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="identifier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {signInMethod === "passphrase"
                      ? "Email or username"
                      : "Email"}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type={signInMethod === "passphrase" ? "text" : "email"}
                      placeholder={
                        signInMethod === "passphrase"
                          ? formatCombinedHistoricalPlaceholder(
                              historicalPlaceholder,
                            )
                          : historicalPlaceholder.email
                      }
                      autoComplete={
                        signInMethod === "passphrase" ? "username" : "email"
                      }
                      aria-invalid={!!form.formState.errors.identifier}
                      aria-label={
                        signInMethod === "passphrase"
                          ? "Email or username"
                          : "Email"
                      }
                    />
                  </FormControl>
                  {signInMethod === "passphrase" ? (
                    <FormDescription>
                      Use your workspace username or email with your passphrase.
                    </FormDescription>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />

            {passphraseEnabled && signInMethod === "passphrase" ? (
              <FormField
                control={form.control}
                name="passphrase"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Passphrase</FormLabel>
                      <Button
                        variant="link"
                        size="sm"
                        type="button"
                        onClick={handleResetPassphrase}
                        disabled={forgotLoading}
                        className="px-0 text-sm"
                      >
                        {forgotLoading ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : null}
                        Forgot your passphrase?
                      </Button>
                    </div>
                    <FormControl>
                      <PassphraseInput
                        {...field}
                        value={field.value ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          field.onChange(value ? value : undefined);
                        }}
                        placeholder="Enter your passphrase"
                        autoComplete="current-password"
                        aria-invalid={!!form.formState.errors.passphrase}
                        aria-label="Passphrase"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            {signInOptions.otp &&
            signInMethod === "passphraseless" &&
            otpSent ? (
              <FormField
                control={form.control}
                name="otp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification Code</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="Enter verification code"
                        maxLength={6}
                        aria-invalid={!!form.formState.errors.otp}
                        aria-label="Verification code"
                        value={field.value ?? ""}
                        onChange={(event) => {
                          const digitsOnly = event.target.value.replace(
                            /\D/g,
                            "",
                          );
                          field.onChange(digitsOnly ? digitsOnly : undefined);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <div className="space-y-3">
              {passphraseEnabled && signInMethod === "passphrase" ? (
                <Button type="submit" className="w-full" disabled={otpLoading}>
                  {otpLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign in with passphrase"
                  )}
                </Button>
              ) : null}

              {passphraselessEnabled && signInMethod === "passphraseless" ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {passphraselessSupportCopy}
                  </p>
                  {signInOptions.magicLink ? (
                    <Button
                      type="button"
                      className="w-full"
                      disabled={magicLinkLoading || otpLoading}
                      onClick={handleMagicLinkSignIn}
                    >
                      {magicLinkLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending magic link...
                        </>
                      ) : (
                        "Send Magic Link"
                      )}
                    </Button>
                  ) : null}
                  {signInOptions.otp ? (
                    <>
                      {!otpSent ? (
                        <Button
                          type="button"
                          className="w-full"
                          variant="outline"
                          disabled={magicLinkLoading || otpLoading}
                          onClick={handleOtpSend}
                        >
                          {otpLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Sending code...
                            </>
                          ) : (
                            "Send Verification Code"
                          )}
                        </Button>
                      ) : null}
                      {otpSent ? (
                        <Button
                          type="submit"
                          className="w-full"
                          disabled={otpLoading}
                        >
                          {otpLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Verifying...
                            </>
                          ) : (
                            "Verify Code"
                          )}
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}

              {passphraseEnabled && passphraselessEnabled ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-sm"
                  onClick={() => {
                    const nextMethod: SignInMethod =
                      signInMethod === "passphrase"
                        ? "passphraseless"
                        : "passphrase";
                    setSignInMethod(nextMethod);
                    setOtpSent(false);
                    form.clearErrors();
                    form.setValue("passphrase", undefined, {
                      shouldDirty: false,
                      shouldTouch: false,
                    });
                    form.setValue("otp", undefined, {
                      shouldDirty: false,
                      shouldTouch: false,
                    });
                  }}
                >
                  {signInMethod === "passphrase"
                    ? `Sign in with ${passphraselessDescription} instead`
                    : "Sign in with a passphrase instead"}
                </Button>
              ) : null}
            </div>

            {showSocialProviders ? (
              <>
                <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
                  <Separator className="flex-1" />
                  <span>Or continue with</span>
                  <Separator className="flex-1" />
                </div>

                {signInOptions.github ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-center gap-3"
                    disabled={otpLoading}
                    onClick={handleGithubSignIn}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="1em"
                      height="1em"
                      viewBox="0 0 24 24"
                    >
                      <path
                        fill="currentColor"
                        d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2"
                      />
                    </svg>
                    <span className="text-sm font-medium">
                      Sign in with GitHub
                    </span>
                  </Button>
                ) : null}

                {signInOptions.google ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-center gap-3"
                    disabled={otpLoading}
                    onClick={handleGoogleSignIn}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="0.98em"
                      height="1em"
                      viewBox="0 0 256 262"
                    >
                      <path
                        fill="#4285F4"
                        d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
                      />
                      <path
                        fill="#34A853"
                        d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
                      />
                      <path
                        fill="#FBBC05"
                        d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"
                      />
                      <path
                        fill="#EB4335"
                        d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
                      />
                    </svg>
                    <span className="text-sm font-medium">
                      Sign in with Google
                    </span>
                  </Button>
                ) : null}

                {signInOptions.apple ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-center gap-3"
                    disabled={otpLoading}
                    onClick={handleAppleSignIn}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 814 1000"
                      className="h-4 w-4"
                    >
                      <path
                        fill="currentColor"
                        d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5c0 148.4 130.3 200.9 134.2 202.2c-.6 3.2-20.7 71.9-68.7 141.9c-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5c66.1 0 121.2 43.4 162.7 43.4c39.5 0 101.1-46 176.3-46c28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3c0-7.1-.6-14.3-1.9-20.1c-50.6 1.9-110.8 33.7-147.1 75.8c-28.5 32.4-55.1 83.6-55.1 135.5c0 7.8 1.3 15.6 1.9 18.1c3.2.6 8.4 1.3 13.6 1.3c45.4 0 102.5-30.4 135.5-71.3z"
                      />
                    </svg>
                    <span className="text-sm font-medium">
                      Sign in with Apple
                    </span>
                  </Button>
                ) : null}
              </>
            ) : null}
          </form>
        </Form>
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            className="font-medium text-primary underline-offset-4 hover:underline"
            to="/auth/sign-up"
          >
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
