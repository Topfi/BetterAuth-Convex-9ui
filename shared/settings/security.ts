export type SecurityFactors = {
  emailVerified: boolean;
  hasPassphrase: boolean;
  hasTwoFactor: boolean;
};

export type SecurityStatusLevel = "good" | "caution" | "critical";

export type SecurityStatus = {
  level: SecurityStatusLevel;
  headline: string;
  details: string;
  recommendations: string[];
};

export const evaluateSecurityStatus = (
  factors: SecurityFactors,
): SecurityStatus => {
  const recommendations: string[] = [];

  if (!factors.emailVerified) {
    recommendations.push("Verify your email to protect sign-in resets.");
  }

  if (!factors.hasPassphrase) {
    recommendations.push(
      "Add a passphrase so you have a backup login beyond linked providers.",
    );
  }

  if (!factors.hasTwoFactor) {
    recommendations.push("Enable 2FA for another layer of protection.");
  }

  if (factors.emailVerified && factors.hasPassphrase && factors.hasTwoFactor) {
    return {
      level: "good",
      headline: "Account protections look strong",
      details:
        "Email is verified, a passphrase is set, and two-factor is ready to block unauthorized access.",
      recommendations,
    };
  }

  if (
    factors.emailVerified &&
    (factors.hasPassphrase || factors.hasTwoFactor)
  ) {
    return {
      level: "caution",
      headline: "You're on the right track",
      details:
        "Tighten things further by adding any missing factors so recovery and sign-ins stay resilient.",
      recommendations,
    };
  }

  return {
    level: "critical",
    headline: "Add more protection",
    details:
      "Verify your email and add a passphrase or 2FA to prevent lockouts if a linked provider is ever unavailable.",
    recommendations,
  };
};
