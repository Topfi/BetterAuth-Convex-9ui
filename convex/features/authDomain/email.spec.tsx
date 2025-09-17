import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  sendEmailVerification,
  sendMagicLink,
  sendOTPVerification,
  sendResetPassphrase,
} from "./email";

const mocks = vi.hoisted(() => {
  const renderMock = vi.fn(async () => "<html></html>");
  const sendEmailSpy = vi.fn();
  const resendConstructor = vi.fn(() => ({
    sendEmail: sendEmailSpy,
  }));
  return { renderMock, sendEmailSpy, resendConstructor };
});

vi.mock("@react-email/components", () => ({
  render: mocks.renderMock,
}));

vi.mock("@convex-dev/resend", () => ({
  Resend: mocks.resendConstructor,
}));

vi.mock("../../_generated/api", () => ({
  components: {
    resend: {},
  },
}));

const { renderMock, sendEmailSpy, resendConstructor } = mocks;

describe("email delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends emails through Resend when previewing is disabled", async () => {
    await sendEmailVerification({} as never, {
      to: "user@example.com",
      url: "https://example.com",
    });

    expect(resendConstructor).toHaveBeenCalledWith({}, { testMode: false });
    expect(sendEmailSpy).toHaveBeenCalledWith(
      {},
      {
        from: "Test <onboarding@boboddy.business>",
        to: "user@example.com",
        subject: "Verify your email address",
        html: "<html></html>",
      },
    );
  });

  it("logs previews when the preview flag is enabled", async () => {
    vi.stubEnv("BETTERAUTH_EMAIL_CONSOLE_PREVIEW", "true");
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    await sendMagicLink({} as never, {
      to: "user@example.com",
      url: "https://example.com",
    });

    expect(resendConstructor).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledTimes(2);
    consoleSpy.mockRestore();
  });

  it("reuses the renderer for other email flavors", async () => {
    await sendOTPVerification({} as never, {
      to: "user@example.com",
      code: "123456",
    });

    await sendResetPassphrase({} as never, {
      to: "user@example.com",
      url: "https://example.com/reset",
    });

    expect(renderMock).toHaveBeenCalledTimes(2);
  });
});
