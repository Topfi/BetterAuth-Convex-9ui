import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImageUp, Loader2, Sparkles, X } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PassphraseInput } from "@/features/auth/components/PassphraseInput";
import { PassphraseStrengthMeter } from "@/features/auth/components/PassphraseStrengthMeter";
import { toast } from "@/lib/toast";
import { signUpWithPassphrase } from "@/features/auth/api/passphrase";
import { generatePassphrase } from "@/features/auth/api/passphraseGenerator";
import { validatePassphrase } from "@/features/auth/api/passphraseStrength";
import { copyToClipboard } from "@/lib/clipboard";
import { encodeImageFile } from "@/lib/image";
import {
  deriveUsernamePair,
  displayUsernameSchema,
  emailSchema,
  normalizedUsernameSchema,
  passphraseSchema,
  signUpRequestSchema,
  usernameInputSchema,
} from "@shared/auth";
import { pickRandomHistoricalIdentifierPlaceholder } from "@shared/auth/historicalIdentifierPlaceholders";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB limit to align with backend checks.

const imageFileSchema = z
  .custom<File>(
    (value): value is File =>
      typeof File !== "undefined" && value instanceof File,
    {
      message: "Upload a valid image file.",
    },
  )
  .refine((file) => file.size <= MAX_IMAGE_SIZE, {
    message: "Images must be 5 MB or smaller.",
  })
  .refine((file) => file.type.startsWith("image/"), {
    message: "Upload a valid image file.",
  });

const signUpFormSchema = z
  .object({
    username: usernameInputSchema,
    email: emailSchema,
    passphrase: passphraseSchema,
    passphraseConfirmation: passphraseSchema,
    imageFile: imageFileSchema.optional(),
  })
  .refine((data) => data.passphrase === data.passphraseConfirmation, {
    path: ["passphraseConfirmation"],
    message: "Passphrases must match.",
  });

type SignUpFormValues = z.infer<typeof signUpFormSchema>;

export default function SignUp() {
  const [historicalPlaceholder] = useState(() =>
    pickRandomHistoricalIdentifierPlaceholder(),
  );
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: {
      username: "",
      email: "",
      passphrase: "",
      passphraseConfirmation: "",
      imageFile: undefined,
    },
  });

  const imageFile = useWatch({ control: form.control, name: "imageFile" });
  const passphraseValue = useWatch({
    control: form.control,
    name: "passphrase",
  });
  const passphraseValidation =
    passphraseValue && passphraseValue.length > 0
      ? validatePassphrase(passphraseValue)
      : null;

  const handleGeneratePassphrase = async () => {
    const generated = generatePassphrase();
    form.setValue("passphrase", generated, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    form.setValue("passphraseConfirmation", generated, {
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

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setImagePreview(result);
        return;
      }

      setImagePreview(null);
      form.resetField("imageFile");
      form.setError("imageFile", {
        type: "manual",
        message: "The selected image could not be previewed.",
      });
      toast.error({
        title: "Preview unavailable",
        description: "The selected image could not be previewed.",
      });
    };
    reader.onerror = () => {
      setImagePreview(null);
      form.resetField("imageFile");
      form.setError("imageFile", {
        type: "manual",
        message: "The selected image could not be previewed.",
      });
      toast.error({
        title: "Preview unavailable",
        description: "The selected image could not be previewed.",
      });
    };
    reader.readAsDataURL(imageFile);

    return () => {
      reader.abort();
    };
  }, [imageFile, form]);

  const handleSubmit = async (values: SignUpFormValues) => {
    let encodedImage: string | undefined;

    if (values.imageFile) {
      try {
        encodedImage = await encodeImageFile(values.imageFile);
      } catch (error) {
        form.setError("imageFile", {
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
        return;
      }
    }

    const { username: normalizedUsername, displayUsername } =
      deriveUsernamePair(values.username);

    const payload = {
      email: values.email,
      passphrase: values.passphrase,
      username: normalizedUsernameSchema.parse(normalizedUsername),
      displayUsername: displayUsernameSchema.parse(displayUsername),
      name: displayUsernameSchema.parse(displayUsername),
      image: encodedImage,
    };

    const result = signUpRequestSchema.safeParse(payload);
    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (
          field === "email" ||
          field === "passphrase" ||
          field === "username"
        ) {
          const key: "email" | "passphrase" | "username" = field;
          form.setError(key, {
            type: "manual",
            message: issue.message,
          });
        }
        if (field === "displayUsername" || field === "name") {
          form.setError("username", {
            type: "manual",
            message: issue.message,
          });
        }
      });
      if (result.error.issues.some((issue) => issue.path[0] === "image")) {
        form.setError("imageFile", {
          type: "manual",
          message: "Profile image must be encoded as base64.",
        });
      }
      return;
    }

    await signUpWithPassphrase(result.data, {
      onRequest: () => {
        setLoading(true);
      },
      onSuccess: () => {
        setLoading(false);
        toast.success({
          title: "Account created",
          description: "Check your email to verify your account.",
        });
      },
      onError: (ctx) => {
        setLoading(false);
        toast.error({
          title: "Sign up failed",
          description: ctx.error.message,
        });
      },
    });
  };

  return (
    <Card className="mx-auto w-full max-w-[560px] space-y-0 border border-border/60 bg-card shadow-2xl">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-semibold">Create account</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Fill out your details to get started
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={historicalPlaceholder.username}
                      autoComplete="username"
                      aria-invalid={!!form.formState.errors.username}
                      aria-label="Username"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder={historicalPlaceholder.email}
                      autoComplete="email"
                      aria-invalid={!!form.formState.errors.email}
                      aria-label="Email address"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="passphrase"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Passphrase</FormLabel>
                    <FormControl>
                      <PassphraseInput
                        {...field}
                        autoComplete="new-password"
                        placeholder="Create a passphrase"
                        aria-invalid={!!form.formState.errors.passphrase}
                        aria-label="Passphrase"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="passphraseConfirmation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm passphrase</FormLabel>
                    <FormControl>
                      <PassphraseInput
                        {...field}
                        autoComplete="new-password"
                        placeholder="Repeat passphrase"
                        aria-invalid={
                          !!form.formState.errors.passphraseConfirmation
                        }
                        aria-label="Confirm passphrase"
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
                disabled={loading}
                aria-label="Generate strong passphrase"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Generate strong passphrase
              </Button>
            </div>
            <FormField
              control={form.control}
              name="imageFile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profile image (optional)</FormLabel>
                  <div className="space-y-3 rounded-xl border border-dashed border-border/70 bg-muted/20 p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
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
                      <FormControl className="flex flex-1 flex-col gap-2">
                        <Input
                          id="sign-up-image-file"
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          aria-invalid={!!form.formState.errors.imageFile}
                          aria-label="Profile image uploader"
                          ref={(node) => {
                            field.ref(node);
                            imageInputRef.current = node;
                          }}
                          onBlur={field.onBlur}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) {
                              field.onChange(undefined);
                              form.clearErrors("imageFile");
                              return;
                            }
                            form.clearErrors("imageFile");
                            field.onChange(file);
                            event.target.value = "";
                          }}
                        />
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={loading}
                            onClick={() => {
                              imageInputRef.current?.click();
                            }}
                            aria-label="Choose profile image"
                          >
                            <ImageUp className="mr-2 h-4 w-4" /> Choose image
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            {imageFile ? imageFile.name : "No image selected"}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          PNG or JPG up to 5 MB.
                        </span>
                      </FormControl>
                      {imagePreview || imageFile ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="sm:ml-auto sm:shrink-0"
                          onClick={() => {
                            form.resetField("imageFile");
                            setImagePreview(null);
                            form.clearErrors("imageFile");
                            if (imageInputRef.current) {
                              imageInputRef.current.value = "";
                            }
                          }}
                          aria-label="Remove image"
                        >
                          <X className="mr-1 h-4 w-4" />
                          <span className="sr-only">Remove image</span>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create an account"
              )}
            </Button>
          </form>
        </Form>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            className="font-medium text-primary underline-offset-4 hover:underline"
            to="/auth"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
