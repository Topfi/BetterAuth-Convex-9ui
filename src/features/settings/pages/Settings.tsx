import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  AlertTriangle,
  BadgeCheck,
  Download,
  Loader2,
  Mail,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { AuthenticatedOutletContext } from "@/features/app";
import { PassphraseInput } from "@/features/auth/components/PassphraseInput";
import { PassphraseStrengthMeter } from "@/features/auth/components/PassphraseStrengthMeter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  PreviewCard,
  PreviewCardContent,
  PreviewCardTrigger,
} from "@/components/ui/preview-card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/lib/toast";
import { encodeImageFile } from "@/lib/image";
import { authClient } from "@/lib/auth-client";
import { generatePassphrase } from "@/features/auth/api/passphraseGenerator";
import { validatePassphrase } from "@/features/auth/api/passphraseStrength";
import { copyToClipboard } from "@/lib/clipboard";
import {
  accountProfileUpdateSchema,
  accountEmailChangeSchema,
  passphraseUpdateSchema,
  dataExportRequestSchema,
  evaluateSecurityStatus,
  type AccountProfileUpdateInput,
  type PassphraseUpdateInput,
  type SecurityStatusLevel,
} from "@shared/settings";
import {
  deriveUsernamePair,
  emailSchema,
  usernameInputSchema,
} from "@shared/auth";
import {
  passphraseCompromisedErrorCode,
  passphraseCompromisedMessage,
} from "@shared/auth/haveIBeenPwned";
import { cn } from "@/lib/utils";

const imageFileSchema = z
  .custom<File>(
    (value) => {
      if (typeof File === "undefined") {
        return true;
      }
      return value instanceof File;
    },
    {
      message: "Upload a valid image file.",
    },
  )
  .nullable();

const profileFormSchema = z.object({
  displayUsername: usernameInputSchema,
  imageFile: imageFileSchema.optional(),
});

const emailFormSchema = z.object({
  email: emailSchema,
});

const securityBadgeStyles: Record<SecurityStatusLevel, string> = {
  good: "border-emerald-200 bg-emerald-50 text-emerald-700",
  caution: "border-amber-200 bg-amber-50 text-amber-700",
  critical: "border-rose-200 bg-rose-50 text-rose-700",
};

const sampleBackupCodes = [
  "AX7K-92LF",
  "BQ5N-18ZX",
  "CT4M-70PV",
  "DK8R-21QS",
  "EF9L-63TY",
];

type LinkedAccount = { providerId: string };

const isLinkedAccount = (value: unknown): value is LinkedAccount => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("providerId" in value)) {
    return false;
  }
  const providerId = (value as { providerId?: unknown }).providerId;
  return typeof providerId === "string";
};

const providerIdsFromPayload = (payload: unknown): string[] => {
  if (Array.isArray(payload)) {
    return payload.filter(isLinkedAccount).map((account) => account.providerId);
  }

  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray((payload as { data: unknown }).data)
  ) {
    const { data } = payload as { data: unknown[] };
    return data.filter(isLinkedAccount).map((account) => account.providerId);
  }

  return [];
};

type BetterAuthErrorDetails = {
  code?: string;
  message?: string;
};

const extractBetterAuthErrorDetails = (
  error: unknown,
): BetterAuthErrorDetails => {
  if (error && typeof error === "object") {
    const payload = (error as { data?: unknown }).data;
    if (payload && typeof payload === "object") {
      const record = payload as Record<string, unknown>;
      return {
        code: typeof record.code === "string" ? record.code : undefined,
        message:
          typeof record.message === "string"
            ? record.message
            : error instanceof Error
              ? error.message
              : undefined,
      };
    }

    if (error instanceof Error) {
      return { message: error.message };
    }
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return {};
};

type ProfileFormValues = z.infer<typeof profileFormSchema> & {
  imageFile?: File | null;
};

type EmailFormValues = z.infer<typeof emailFormSchema>;

export default function Settings() {
  const { user, displayName, avatarInitial } =
    useOutletContext<AuthenticatedOutletContext>();

  const initialDisplayUsername =
    user.displayUsername ?? user.username ?? user.name ?? "";

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayUsername: initialDisplayUsername,
      imageFile: undefined,
    },
  });
  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      email: user.email ?? "",
    },
  });
  const passphraseForm = useForm<PassphraseUpdateInput>({
    resolver: zodResolver(passphraseUpdateSchema),
    defaultValues: {
      currentPassphrase: "",
      nextPassphrase: "",
      confirmPassphrase: "",
    },
  });

  const [imagePreview, setImagePreview] = useState<string | null>(
    user.image ?? null,
  );
  const [imageAction, setImageAction] = useState<"keep" | "remove" | "replace">(
    "keep",
  );
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const watchedImageFile = useWatch({
    control: profileForm.control,
    name: "imageFile",
  });

  useEffect(() => {
    if (watchedImageFile === undefined) {
      return;
    }

    if (watchedImageFile === null) {
      setPendingImage(null);
      setImagePreview(null);
      setImageAction("remove");
      return;
    }

    if (typeof File !== "undefined" && watchedImageFile instanceof File) {
      encodeImageFile(watchedImageFile)
        .then((encoded) => {
          setPendingImage(encoded);
          setImagePreview(encoded);
          setImageAction("replace");
        })
        .catch((error) => {
          profileForm.setError("imageFile", {
            type: "manual",
            message:
              error instanceof Error
                ? error.message
                : "Unable to process the selected image.",
          });
          toast.error({
            title: "Image upload failed",
            description:
              error instanceof Error
                ? error.message
                : "Unable to process the selected image.",
          });
          setPendingImage(null);
          setImagePreview(user.image ?? null);
          setImageAction("keep");
          profileForm.setValue("imageFile", undefined, {
            shouldDirty: false,
          });
        });
      return;
    }

    profileForm.setValue("imageFile", undefined, { shouldDirty: false });
  }, [profileForm, user.image, watchedImageFile]);

  useEffect(() => {
    profileForm.reset({
      displayUsername: initialDisplayUsername,
      imageFile: undefined,
    });
    setImagePreview(user.image ?? null);
    setImageAction("keep");
    setPendingImage(null);
  }, [initialDisplayUsername, profileForm, user.image]);

  useEffect(() => {
    emailForm.reset({ email: user.email ?? "" });
  }, [emailForm, user.email]);

  const handleProfileSubmit = async (values: ProfileFormValues) => {
    const usernameDraft = deriveUsernamePair(values.displayUsername);
    const currentDisplayUsername = initialDisplayUsername;

    let image: AccountProfileUpdateInput["image"] | undefined;
    if (imageAction === "remove") {
      image = null;
    } else if (imageAction === "replace") {
      if (!pendingImage) {
        profileForm.setError("imageFile", {
          type: "manual",
          message: "Upload a valid image before saving.",
        });
        return;
      }
      image = pendingImage;
    }

    const payload = accountProfileUpdateSchema.safeParse({
      displayUsername: usernameDraft.displayUsername,
      username: usernameDraft.username,
      name: usernameDraft.displayUsername,
      ...(imageAction === "keep" ? {} : { image }),
    });

    if (!payload.success) {
      payload.error.issues.forEach((issue) => {
        if (issue.path[0] === "displayUsername") {
          profileForm.setError("displayUsername", {
            type: "manual",
            message: issue.message,
          });
        }
        if (issue.path[0] === "username" || issue.path[0] === "name") {
          profileForm.setError("displayUsername", {
            type: "manual",
            message: issue.message,
          });
        }
      });
      return;
    }

    if (
      imageAction === "keep" &&
      usernameDraft.displayUsername === currentDisplayUsername
    ) {
      toast.info({
        title: "Nothing to update",
        description: "Change your details before saving.",
      });
      return;
    }

    try {
      setIsUpdatingProfile(true);
      await authClient.updateUser(payload.data);
      toast.success({
        title: "Profile updated",
        description: "Your account details were saved.",
      });
      profileForm.reset({
        displayUsername: payload.data.displayUsername,
        imageFile: undefined,
      });
      if (imageAction === "replace") {
        setImagePreview(image ?? null);
      }
      if (imageAction === "remove") {
        setImagePreview(null);
      }
      setImageAction("keep");
      setPendingImage(null);
    } catch (error) {
      toast.error({
        title: "Failed to update profile",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const [isChangingEmail, setIsChangingEmail] = useState(false);

  const handleEmailSubmit = async (values: EmailFormValues) => {
    const normalizedEmail = values.email.trim().toLowerCase();
    const parseResult = accountEmailChangeSchema.safeParse({
      email: normalizedEmail,
      callbackUrl: window.location.origin + "/settings",
    });

    if (!parseResult.success) {
      parseResult.error.issues.forEach((issue) => {
        if (issue.path[0] === "email") {
          emailForm.setError("email", {
            type: "manual",
            message: issue.message,
          });
        }
      });
      return;
    }

    if (normalizedEmail === (user.email ?? "")) {
      toast.info({
        title: "Using current email",
        description: "Enter a different email to change it.",
      });
      return;
    }

    try {
      setIsChangingEmail(true);
      await authClient.changeEmail({
        newEmail: parseResult.data.email,
        callbackURL: parseResult.data.callbackUrl,
      });
      toast.warning({
        title: "Verification required",
        description:
          "Check your inbox to verify the new email. You'll be signed out now.",
      });
      await authClient.signOut();
    } catch (error) {
      emailForm.setError("email", {
        type: "manual",
        message:
          error instanceof Error ? error.message : "Unable to update email.",
      });
      toast.error({
        title: "Email change failed",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsChangingEmail(false);
    }
  };

  const [accountProviders, setAccountProviders] = useState<string[]>([]);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadAccounts = async () => {
      try {
        const accounts = await authClient.$fetch("/list-accounts", {
          method: "GET",
        });
        if (cancelled) {
          return;
        }
        setAccountProviders(providerIdsFromPayload(accounts));
        setAccountsError(null);
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load linked accounts.";
        setAccountsError(message);
        toast.error({
          title: "Linked accounts unavailable",
          description: message,
        });
      }
    };

    void loadAccounts();

    return () => {
      cancelled = true;
    };
  }, []);

  const hasPassphrase = accountProviders.includes("email-password");
  const securityStatus = evaluateSecurityStatus({
    emailVerified: user.emailVerified === true,
    hasPassphrase,
    hasTwoFactor: user.twoFactorEnabled === true,
  });

  const [isChangingPassphrase, setIsChangingPassphrase] = useState(false);
  const nextPassphrase = useWatch({
    control: passphraseForm.control,
    name: "nextPassphrase",
  });
  const passphraseValidation = nextPassphrase
    ? validatePassphrase(nextPassphrase)
    : null;
  useEffect(() => {
    if (!hasPassphrase) {
      passphraseForm.reset();
    }
  }, [hasPassphrase, passphraseForm]);

  const handleGeneratePassphrase = async () => {
    const generated = generatePassphrase();
    passphraseForm.setValue("nextPassphrase", generated, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    passphraseForm.setValue("confirmPassphrase", generated, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    const copied = await copyToClipboard(generated);
    if (copied) {
      toast.success({
        title: "Passphrase generated",
        description: "We filled both fields and copied it to your clipboard.",
      });
      return;
    }

    toast.warning({
      title: "Clipboard unavailable",
      description:
        "We filled both fields but couldn't copy. Copy it manually to keep access.",
    });
  };

  const handlePassphraseSubmit = async (values: PassphraseUpdateInput) => {
    try {
      setIsChangingPassphrase(true);
      await authClient.changePassword({
        currentPassword: values.currentPassphrase,
        newPassword: values.nextPassphrase,
        revokeOtherSessions: true,
      });
      toast.success({
        title: "Passphrase updated",
        description: "We signed out other sessions to keep things secure.",
      });
      passphraseForm.reset();
    } catch (error) {
      const { code, message } = extractBetterAuthErrorDetails(error);
      if (code === passphraseCompromisedErrorCode) {
        const description = message ?? passphraseCompromisedMessage;
        passphraseForm.setError("nextPassphrase", {
          type: "manual",
          message: description,
        });
        toast.error({
          title: "Passphrase rejected",
          description,
        });
      } else {
        toast.error({
          title: "Couldn't update passphrase",
          description: message,
        });
      }
    } finally {
      setIsChangingPassphrase(false);
    }
  };

  const [isTwoFactorDialogOpen, setTwoFactorDialogOpen] = useState(false);
  const [isExportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportAcknowledged, setExportAcknowledged] = useState(false);

  useEffect(() => {
    if (!isExportDialogOpen) {
      setExportAcknowledged(false);
    }
  }, [isExportDialogOpen]);

  const handleConfirmExport = () => {
    const parsed = dataExportRequestSchema.safeParse({
      acknowledgeDelay: exportAcknowledged,
    });

    if (!parsed.success) {
      toast.error({
        title: "Confirm the 24 hour window",
        description:
          "Acknowledge the delivery time before requesting an export.",
      });
      return;
    }

    toast.info({
      title: "Export scheduled",
      description:
        "We'll email you a download link within 24 hours once the export is ready.",
    });
    setExportDialogOpen(false);
  };

  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const normalizedUserName = user.name?.trim();
  const deleteConfirmationTarget =
    normalizedUserName && normalizedUserName.length > 0
      ? normalizedUserName
      : displayName;
  const typedNameMatches =
    deleteConfirmation.trim() === deleteConfirmationTarget;

  useEffect(() => {
    if (!isDeleteDialogOpen) {
      setDeleteConfirmation("");
      setDeleteError(null);
    }
  }, [isDeleteDialogOpen]);

  const handleDeleteAccount = async () => {
    if (!typedNameMatches) {
      setDeleteError("Type your name exactly as shown to confirm.");
      return;
    }

    try {
      setIsDeletingAccount(true);
      await authClient.deleteUser();
      toast.success({
        title: "Account deleted",
        description: "We're redirecting you to sign in.",
      });
      setDeleteDialogOpen(false);
    } catch (error) {
      toast.error({
        title: "Failed to delete account",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const securityIcon: Record<SecurityStatusLevel, JSX.Element> = {
    good: <ShieldCheck className="mr-2 h-4 w-4" />,
    caution: <ShieldAlert className="mr-2 h-4 w-4" />,
    critical: <Shield className="mr-2 h-4 w-4" />,
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account, security, and privacy controls.
        </p>
      </div>
      <Tabs defaultValue="account" className="space-y-8">
        <TabsList
          className="grid w-full max-w-xl grid-cols-3"
          aria-label="Settings sections"
        >
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
        </TabsList>

        <TabsContent
          value="account"
          className="space-y-6 focus-visible:outline-none"
        >
          <Card className="border border-border/60">
            <CardHeader className="space-y-2">
              <CardTitle>Account</CardTitle>
              <CardDescription>
                Update the profile information associated with your account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                <div className="flex shrink-0 flex-col items-center gap-4">
                  <Avatar size="lg">
                    {imagePreview ? (
                      <AvatarImage src={imagePreview} alt={displayName} />
                    ) : user.image ? (
                      <AvatarImage src={user.image} alt={displayName} />
                    ) : null}
                    <AvatarFallback className="text-lg font-semibold">
                      {avatarInitial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-center text-xs text-muted-foreground">
                    <div>{displayName}</div>
                    <div>{user.email}</div>
                  </div>
                </div>
                <div className="flex-1 space-y-6">
                  <Form {...profileForm}>
                    <form
                      onSubmit={profileForm.handleSubmit(handleProfileSubmit)}
                      className="space-y-6"
                    >
                      <FormField
                        control={profileForm.control}
                        name="displayUsername"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="your username"
                                autoComplete="username"
                                aria-label="Username"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={profileForm.control}
                        name="imageFile"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Profile image</FormLabel>
                            <div className="space-y-3 rounded-xl border border-dashed border-border/70 bg-muted/20 p-4">
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                <Avatar size="lg">
                                  {imagePreview ? (
                                    <AvatarImage
                                      src={imagePreview}
                                      alt="Profile preview"
                                    />
                                  ) : null}
                                  <AvatarFallback className="text-xs font-medium uppercase">
                                    Photo
                                  </AvatarFallback>
                                </Avatar>
                                <FormControl>
                                  <Input
                                    type="file"
                                    accept="image/*"
                                    ref={field.ref}
                                    aria-label="Profile image uploader"
                                    onChange={(event) => {
                                      const file = event.target.files?.[0];
                                      if (!file) {
                                        profileForm.setValue(
                                          "imageFile",
                                          undefined,
                                        );
                                        setImageAction("keep");
                                        setPendingImage(null);
                                        return;
                                      }
                                      profileForm.clearErrors("imageFile");
                                      field.onChange(file);
                                      event.target.value = "";
                                    }}
                                  />
                                </FormControl>
                              </div>
                              <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                                <span>PNG or JPG up to 5 MB.</span>
                                {(imagePreview || user.image) && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      profileForm.setValue("imageFile", null);
                                      setImagePreview(null);
                                      setPendingImage(null);
                                      setImageAction("remove");
                                    }}
                                    aria-label="Remove profile image"
                                  >
                                    <X className="mr-1 h-4 w-4" />
                                    <span className="sr-only">
                                      Remove profile image
                                    </span>
                                  </Button>
                                )}
                              </div>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <CardFooter className="justify-end p-0">
                        <Button type="submit" disabled={isUpdatingProfile}>
                          {isUpdatingProfile ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            "Save changes"
                          )}
                        </Button>
                      </CardFooter>
                    </form>
                  </Form>
                  <Separator />
                  <Form {...emailForm}>
                    <form
                      onSubmit={emailForm.handleSubmit(handleEmailSubmit)}
                      className="space-y-4"
                    >
                      <FormField
                        control={emailForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="email"
                                autoComplete="email"
                                placeholder="you@example.com"
                                aria-label="Email address"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Badge
                            className={cn(
                              "border px-2 py-1",
                              user.emailVerified
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-700",
                            )}
                          >
                            {user.emailVerified ? (
                              <BadgeCheck className="mr-1 h-3 w-3" />
                            ) : (
                              <Mail className="mr-1 h-3 w-3" />
                            )}
                            {user.emailVerified
                              ? "Verified"
                              : "Verification pending"}
                          </Badge>
                          <span>
                            Changing your email signs you out until you verify
                            the new address.
                          </span>
                        </div>
                        <Button
                          type="submit"
                          variant="outline"
                          disabled={isChangingEmail}
                        >
                          {isChangingEmail ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          Update email
                        </Button>
                      </div>
                    </form>
                  </Form>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="security"
          className="space-y-6 focus-visible:outline-none"
        >
          <Card className="border border-border/60">
            <CardHeader className="space-y-2">
              <CardTitle>Security posture</CardTitle>
              <CardDescription>
                Stay aware of the safeguards backing your account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert
                className={cn(
                  "border",
                  securityBadgeStyles[securityStatus.level],
                )}
              >
                {securityIcon[securityStatus.level]}
                <AlertTitle>{securityStatus.headline}</AlertTitle>
                <AlertDescription>{securityStatus.details}</AlertDescription>
              </Alert>
              {securityStatus.recommendations.length > 0 ? (
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">
                    Recommended next steps
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {securityStatus.recommendations.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {accountsError ? (
                <Alert variant="destructive">
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  <AlertTitle>Linked account details unavailable</AlertTitle>
                  <AlertDescription>{accountsError}</AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>
          <Card className="border border-border/60">
            <CardHeader className="space-y-2">
              <CardTitle>Change passphrase</CardTitle>
              <CardDescription>
                Rotate your passphrase and revoke other sessions when needed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PreviewCard>
                <PreviewCardTrigger
                  render={<div />}
                  className={cn("space-y-6", !hasPassphrase && "opacity-60")}
                >
                  <Form {...passphraseForm}>
                    <form
                      onSubmit={passphraseForm.handleSubmit(
                        handlePassphraseSubmit,
                      )}
                      className="space-y-6"
                    >
                      <FormField
                        control={passphraseForm.control}
                        name="currentPassphrase"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Current passphrase</FormLabel>
                            <FormControl>
                              <PassphraseInput
                                {...field}
                                autoComplete="current-password"
                                disabled={!hasPassphrase}
                                aria-label="Current passphrase"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                          control={passphraseForm.control}
                          name="nextPassphrase"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>New passphrase</FormLabel>
                              <FormControl>
                                <PassphraseInput
                                  {...field}
                                  autoComplete="new-password"
                                  disabled={!hasPassphrase}
                                  aria-label="New passphrase"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={passphraseForm.control}
                          name="confirmPassphrase"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Confirm passphrase</FormLabel>
                              <FormControl>
                                <PassphraseInput
                                  {...field}
                                  autoComplete="new-password"
                                  disabled={!hasPassphrase}
                                  aria-label="Confirm new passphrase"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <PassphraseStrengthMeter
                          validation={passphraseValidation}
                          className="min-w-[220px] flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            void handleGeneratePassphrase();
                          }}
                          disabled={!hasPassphrase}
                          aria-label="Generate strong passphrase"
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          Generate strong passphrase
                        </Button>
                      </div>
                      <div className="space-y-2 text-xs text-muted-foreground">
                        <p>
                          We verify new passphrases against Have I Been Pwned
                          during submission. Only anonymized hash prefixes ever
                          leave this page.
                        </p>
                      </div>
                      <CardFooter className="justify-end p-0">
                        <Button
                          type="submit"
                          disabled={isChangingPassphrase || !hasPassphrase}
                        >
                          {isChangingPassphrase ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            "Update passphrase"
                          )}
                        </Button>
                      </CardFooter>
                    </form>
                  </Form>
                </PreviewCardTrigger>
                {!hasPassphrase ? (
                  <PreviewCardContent>
                    <div className="space-y-2 text-sm">
                      <p className="font-medium">Passphrase not enabled</p>
                      <p>
                        You signed up using a trusted provider, so there isn't a
                        local passphrase to rotate. Link email + passphrase from
                        the sign-in page if you ever want an alternate login
                        method.
                      </p>
                    </div>
                  </PreviewCardContent>
                ) : null}
              </PreviewCard>
            </CardContent>
          </Card>
          <Card className="border border-border/60">
            <CardHeader className="space-y-2">
              <CardTitle>Two-factor authentication</CardTitle>
              <CardDescription>
                Add a second factor verified by email and keep backup codes
                handy.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Two-factor adds an extra confirmation for sign-ins. We'll finish
                the backend flow next—use this preview to plan how enrollment
                works.
              </p>
              <Dialog
                open={isTwoFactorDialogOpen}
                onOpenChange={setTwoFactorDialogOpen}
              >
                <DialogTrigger render={<Button variant="outline" />}>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Preview 2FA enrollment
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Enable two-factor authentication</DialogTitle>
                    <DialogDescription>
                      Step through how we'll ship email-based 2FA with backup
                      codes.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">
                        1. Confirm via email
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        We'll send a verification code to {user.email}. Enter it
                        to prove you have inbox access.
                      </p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter 6-digit code"
                          className="w-40"
                          aria-label="Enter six digit verification code"
                        />
                        <Button variant="ghost" size="sm">
                          Resend code
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">
                        2. Store your backup codes safely
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Download or copy these one-time backup codes. They let
                        you in if you can't access your inbox.
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {sampleBackupCodes.map((code) => (
                          <code
                            key={code}
                            className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
                          >
                            {code}
                          </code>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1">
                          <Download className="mr-2 h-4 w-4" /> Download codes
                        </Button>
                        <Button
                          variant="ghost"
                          className="flex-1"
                          onClick={() =>
                            toast.info({
                              title: "Coming soon",
                              description:
                                "We'll wire this up once the server-side flow lands.",
                            })
                          }
                        >
                          Email me later
                        </Button>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() =>
                        toast.info({
                          title: "2FA setup placeholder",
                          description:
                            "This flow is UI-only for now. We'll finish the backend next.",
                        })
                      }
                    >
                      Looks good
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="privacy"
          className="space-y-6 focus-visible:outline-none"
        >
          <Card className="border border-border/60">
            <CardHeader className="space-y-2">
              <CardTitle>Data export</CardTitle>
              <CardDescription>
                Request a full export of account data. We deliver it by email
                within 24 hours.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <ClockIcon />
                <AlertTitle>Exports take time</AlertTitle>
                <AlertDescription>
                  Gathering every record can take up to 24 hours. We'll notify
                  you as soon as the download link is ready.
                </AlertDescription>
              </Alert>
              <AlertDialog
                open={isExportDialogOpen}
                onOpenChange={setExportDialogOpen}
              >
                <AlertDialogTrigger render={<Button variant="outline" />}>
                  <Download className="mr-2 h-4 w-4" /> Request export
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Schedule data export?</AlertDialogTitle>
                    <AlertDialogDescription>
                      We&apos;ll email a secure download link within 24 hours
                      once the archive is ready.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="rounded-md border border-dashed border-border/60 bg-muted/20 p-4 text-sm">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="acknowledgeDelay"
                        checked={exportAcknowledged}
                        onCheckedChange={(value) =>
                          setExportAcknowledged(value === true)
                        }
                      />
                      <label
                        htmlFor="acknowledgeDelay"
                        className="leading-tight"
                      >
                        I understand that preparing the export can take up to 24
                        hours.
                      </label>
                    </div>
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogClose
                      onClick={() => setExportDialogOpen(false)}
                      render={<Button type="button" variant="outline" />}
                    >
                      Cancel
                    </AlertDialogClose>
                    <Button type="button" onClick={handleConfirmExport}>
                      Confirm request
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
          <Card className="border border-border/60">
            <CardHeader className="space-y-2">
              <CardTitle>Delete account</CardTitle>
              <CardDescription>
                Permanently delete your account and all linked data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                <AlertTitle>No recovery after deletion</AlertTitle>
                <AlertDescription>
                  This wipes counters, sessions, and any linked data. We
                  can&apos;t undo this once confirmed.
                </AlertDescription>
              </Alert>
              <AlertDialog
                open={isDeleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
              >
                <AlertDialogTrigger render={<Button variant="destructive" />}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete account
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Type your name to confirm
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Deleting your account signs you out everywhere and revokes
                      all access immediately.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Enter{" "}
                      <span className="font-medium text-foreground">
                        {deleteConfirmationTarget}
                      </span>{" "}
                      to continue.
                    </p>
                    <Input
                      value={deleteConfirmation}
                      onChange={(event) => {
                        setDeleteConfirmation(event.target.value);
                        setDeleteError(null);
                      }}
                      autoFocus
                      aria-label="Type your name to confirm account deletion"
                    />
                    {deleteError ? (
                      <p className="text-sm text-destructive">{deleteError}</p>
                    ) : null}
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogClose
                      onClick={() => setDeleteDialogOpen(false)}
                      render={<Button type="button" variant="outline" />}
                    >
                      Cancel
                    </AlertDialogClose>
                    <Button
                      type="button"
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={handleDeleteAccount}
                      disabled={isDeletingAccount}
                    >
                      {isDeletingAccount ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Delete account
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg
      className="mr-2 h-4 w-4"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm1 10.268a1 1 0 0 1-.553.894l-2.5 1.25A1 1 0 0 1 8.5 13.5v-4a1 1 0 0 1 2 0v3.118l1.5-.75V9.5a1 1 0 0 1 2 0Z"
      />
    </svg>
  );
}
