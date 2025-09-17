import "../../polyfills";
import VerifyEmail from "./emails/verifyEmail";
import MagicLinkEmail from "./emails/magicLink";
import VerifyOTP from "./emails/verifyOTP";
import { render } from "@react-email/components";
import React from "react";
import ResetPassphraseEmail from "./emails/resetPassphrase";
import { Resend } from "@convex-dev/resend";
import { components } from "../../_generated/api";
import { RunMutationCtx } from "@convex-dev/better-auth";
import {
  EMAIL_BRAND_LOGO_URL_ENV_FLAG,
  EMAIL_BRAND_NAME_ENV_FLAG,
  EMAIL_BRAND_TAGLINE_ENV_FLAG,
  EMAIL_CONSOLE_PREVIEW_ENV_FLAG,
} from "@shared/email";

const shouldPreviewEmails = () => {
  const rawValue = process.env[EMAIL_CONSOLE_PREVIEW_ENV_FLAG];
  if (!rawValue) {
    return false;
  }
  const normalizedValue = rawValue.trim().toLowerCase();
  return normalizedValue === "true" || normalizedValue === "1";
};

type EmailBranding = {
  brandName?: string;
  brandTagline?: string;
  brandLogoUrl?: string;
};

const readOptionalEnv = (key: string) => {
  const rawValue = process.env[key];
  if (!rawValue) {
    return undefined;
  }
  const trimmedValue = rawValue.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
};

const getEmailBrandingOverrides = (): EmailBranding => ({
  brandName: readOptionalEnv(EMAIL_BRAND_NAME_ENV_FLAG),
  brandTagline: readOptionalEnv(EMAIL_BRAND_TAGLINE_ENV_FLAG),
  brandLogoUrl: readOptionalEnv(EMAIL_BRAND_LOGO_URL_ENV_FLAG),
});

const logEmailPreview = ({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) => {
  console.info(
    `[mail preview - ${EMAIL_CONSOLE_PREVIEW_ENV_FLAG}]\nTo: ${to}\nSubject: ${subject}\n`,
  );
  console.info(html);
};

const sendEmail = async (
  ctx: RunMutationCtx,
  {
    to,
    subject,
    html,
  }: {
    to: string;
    subject: string;
    html: string;
  },
) => {
  if (shouldPreviewEmails()) {
    logEmailPreview({ to, subject, html });
    return;
  }
  const resend = new Resend(components.resend, {
    testMode: false,
  });
  await resend.sendEmail(ctx, {
    from: "Test <onboarding@boboddy.business>",
    to,
    subject,
    html,
  });
};

export const sendEmailVerification = async (
  ctx: RunMutationCtx,
  {
    to,
    url,
  }: {
    to: string;
    url: string;
  },
) => {
  const branding = getEmailBrandingOverrides();
  await sendEmail(ctx, {
    to,
    subject: "Verify your email address",
    html: await render(<VerifyEmail url={url} {...branding} />),
  });
};

export const sendOTPVerification = async (
  ctx: RunMutationCtx,
  {
    to,
    code,
  }: {
    to: string;
    code: string;
  },
) => {
  const branding = getEmailBrandingOverrides();
  await sendEmail(ctx, {
    to,
    subject: "Verify your email address",
    html: await render(<VerifyOTP code={code} {...branding} />),
  });
};

export const sendMagicLink = async (
  ctx: RunMutationCtx,
  {
    to,
    url,
  }: {
    to: string;
    url: string;
  },
) => {
  const branding = getEmailBrandingOverrides();
  await sendEmail(ctx, {
    to,
    subject: "Sign in to your account",
    html: await render(<MagicLinkEmail url={url} {...branding} />),
  });
};

export const sendResetPassphrase = async (
  ctx: RunMutationCtx,
  {
    to,
    url,
  }: {
    to: string;
    url: string;
  },
) => {
  const branding = getEmailBrandingOverrides();
  await sendEmail(ctx, {
    to,
    subject: "Reset your passphrase",
    html: await render(<ResetPassphraseEmail url={url} {...branding} />),
  });
};
