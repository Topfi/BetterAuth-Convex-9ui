import { Heading, Link, Text } from "@react-email/components";
import { BaseEmail } from "./components/BaseEmail";
import { baseEmailStyles as styles } from "./components/baseEmailStyles";
import React from "react";

interface ResetPassphraseEmailProps {
  url: string;
  brandName?: string;
  brandTagline?: string;
  brandLogoUrl?: string;
}

export default function ResetPassphraseEmail({
  url,
  brandName,
  brandTagline,
  brandLogoUrl,
}: ResetPassphraseEmailProps) {
  return (
    <BaseEmail
      previewText="Reset your passphrase"
      brandName={brandName}
      brandTagline={brandTagline}
      brandLogoUrl={brandLogoUrl}
    >
      <Heading style={styles.h1}>Reset Your Passphrase</Heading>
      <Link
        href={url}
        target="_blank"
        style={{
          ...styles.link,
          display: "block",
          marginBottom: "16px",
        }}
      >
        Click here to reset your passphrase
      </Link>
      <Text
        style={{
          ...styles.text,
          color: "#ababab",
          marginTop: "14px",
          marginBottom: "16px",
        }}
      >
        If you didn&apos;t request a passphrase reset, you can safely ignore
        this email.
      </Text>
    </BaseEmail>
  );
}
