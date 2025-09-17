import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import SignUp from "./SignUp";
import { MemoryRouter } from "react-router-dom";
import { historicalIdentifierPlaceholders } from "@shared/auth/historicalIdentifierPlaceholders";

const strongTestPassphrase = "galaxy harbor 29 sky";

const usernamePlaceholderExamples = historicalIdentifierPlaceholders.map(
  (entry) => entry.username,
);
const emailPlaceholderExamples = historicalIdentifierPlaceholders.map(
  (entry) => entry.email,
);

const findInputByPlaceholder = (placeholders: readonly string[]) => {
  for (const placeholder of placeholders) {
    const element = screen.queryByPlaceholderText(placeholder);
    if (element instanceof HTMLInputElement) {
      return element;
    }
  }

  throw new Error(
    `Unable to find input by placeholders: ${placeholders.join(", ")}`,
  );
};

const hoisted = vi.hoisted(() => ({
  signUpWithPassphraseMock: vi.fn(async (_config, callbacks) => {
    callbacks?.onRequest?.();
    callbacks?.onSuccess?.();
  }),
  toastSuccessMock: vi.fn(),
  toastWarningMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastInfoMock: vi.fn(),
  generatePassphraseMock: vi.fn(() => "winter-sky-aurora"),
  copyToClipboardMock: vi.fn(async () => true),
}));

vi.mock("@/features/auth/api/passphrase", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/auth/api/passphrase")>();
  return {
    ...actual,
    signUpWithPassphrase: hoisted.signUpWithPassphraseMock,
  };
});

vi.mock("@/lib/toast", () => ({
  toast: {
    success: (...args: unknown[]) => hoisted.toastSuccessMock(...args),
    error: (...args: unknown[]) => hoisted.toastErrorMock(...args),
    info: (...args: unknown[]) => hoisted.toastInfoMock(...args),
    warning: (...args: unknown[]) => hoisted.toastWarningMock(...args),
  },
}));

vi.mock("@/features/auth/api/passphraseGenerator", () => ({
  generatePassphrase: hoisted.generatePassphraseMock,
}));

vi.mock("@/lib/clipboard", () => ({
  copyToClipboard: hoisted.copyToClipboardMock,
}));

const {
  signUpWithPassphraseMock,
  toastSuccessMock,
  toastWarningMock,
  generatePassphraseMock,
  copyToClipboardMock,
} = hoisted;

const originalFileReader = globalThis.FileReader;

class MockFileReader {
  public result: string | ArrayBuffer | null = null;
  public onloadend:
    | ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown)
    | null = null;
  public onerror:
    | ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown)
    | null = null;

  readAsDataURL(_file: Blob) {
    this.result = "data:image/png;base64,preview";
    queueMicrotask(() => {
      this.onloadend?.call(
        this as unknown as FileReader,
        new ProgressEvent("loadend"),
      );
    });
  }

  abort() {
    /* no-op */
  }
}

const fillBaseFields = async () => {
  const user = userEvent.setup();
  await user.type(
    findInputByPlaceholder(usernamePlaceholderExamples),
    "AdaLovelace",
  );
  await user.type(
    findInputByPlaceholder(emailPlaceholderExamples),
    "ada@example.com",
  );
  await user.type(
    screen.getByPlaceholderText("Create a passphrase"),
    strongTestPassphrase,
  );
  await user.type(
    screen.getByPlaceholderText("Repeat passphrase"),
    strongTestPassphrase,
  );
};

describe("SignUp", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "FileReader", {
      configurable: true,
      writable: true,
      value: MockFileReader,
    });
  });

  afterAll(() => {
    Object.defineProperty(globalThis, "FileReader", {
      configurable: true,
      writable: true,
      value: originalFileReader,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses historical placeholders for username and email fields", () => {
    const mathRandomSpy = vi.spyOn(Math, "random").mockReturnValue(0);

    try {
      render(
        <MemoryRouter>
          <SignUp />
        </MemoryRouter>,
      );

      const expected = historicalIdentifierPlaceholders[0];

      expect(
        screen.getByPlaceholderText(expected.username),
      ).toBeInTheDocument();
      expect(screen.getByPlaceholderText(expected.email)).toBeInTheDocument();
    } finally {
      mathRandomSpy.mockRestore();
    }
  });

  it("generates a passphrase, copies it, and notifies the user", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignUp />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: /generate strong passphrase/i }),
    );

    await waitFor(() => {
      expect(generatePassphraseMock).toHaveBeenCalled();
    });

    expect(screen.getByPlaceholderText("Create a passphrase")).toHaveValue(
      "winter-sky-aurora",
    );
    expect(screen.getByPlaceholderText("Repeat passphrase")).toHaveValue(
      "winter-sky-aurora",
    );
    expect(copyToClipboardMock).toHaveBeenCalledWith("winter-sky-aurora");
    expect(toastSuccessMock).toHaveBeenCalledWith({
      title: "Passphrase generated",
      description: "We filled both fields and copied it to your clipboard.",
    });
    expect(screen.getByText("Strength")).toBeInTheDocument();
  });

  it("warns when clipboard access is unavailable", async () => {
    const user = userEvent.setup();
    copyToClipboardMock.mockResolvedValueOnce(false);

    render(
      <MemoryRouter>
        <SignUp />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: /generate strong passphrase/i }),
    );

    await waitFor(() => {
      expect(generatePassphraseMock).toHaveBeenCalled();
    });

    expect(toastWarningMock).toHaveBeenCalledWith({
      title: "Clipboard unavailable",
      description:
        "We filled both fields but couldn't copy. Copy it manually to keep access.",
    });
  });

  it("submits sign-up details without an avatar", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignUp />
      </MemoryRouter>,
    );
    await fillBaseFields();

    await user.click(
      screen.getByRole("button", { name: /create an account/i }),
    );

    expect(signUpWithPassphraseMock).toHaveBeenCalledWith(
      {
        email: "ada@example.com",
        passphrase: strongTestPassphrase,
        username: "adalovelace",
        displayUsername: "AdaLovelace",
        name: "AdaLovelace",
        image: undefined,
      },
      expect.any(Object),
    );
    expect(toastSuccessMock).toHaveBeenCalledWith({
      title: "Account created",
      description: "Check your email to verify your account.",
    });
  });

  it("encodes an optional avatar before submitting", async () => {
    const user = userEvent.setup();
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });

    render(
      <MemoryRouter>
        <SignUp />
      </MemoryRouter>,
    );
    await fillBaseFields();

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    if (!fileInput) {
      throw new Error("File input not found");
    }
    await user.upload(fileInput, file);

    expect(await screen.findByText("avatar.png")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /remove image/i }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /create an account/i }),
    );

    expect(signUpWithPassphraseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        image: "data:image/png;base64,preview",
      }),
      expect.any(Object),
    );
  });

  it("lets users clear a chosen profile image", async () => {
    const user = userEvent.setup();
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });

    render(
      <MemoryRouter>
        <SignUp />
      </MemoryRouter>,
    );

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    if (!fileInput) {
      throw new Error("File input not found");
    }

    await user.upload(fileInput, file);
    expect(await screen.findByText("avatar.png")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove image/i }));

    await waitFor(() => {
      expect(screen.queryByText("avatar.png")).not.toBeInTheDocument();
    });
    expect(screen.getByText("No image selected")).toBeInTheDocument();
  });
});
