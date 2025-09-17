import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Text,
  Img,
  Preview,
} from "@react-email/components";
import React from "react";
import { baseEmailStyles } from "./baseEmailStyles";

export interface BaseEmailProps {
  children: React.ReactNode;
  previewText: string;
  footerLinks?: Array<{ text: string; href: string }>;
  footerText?: string;
  brandName?: string;
  brandTagline?: string;
  brandLogoUrl?: string;
}

const styles = baseEmailStyles;

export function BaseEmail({
  children,
  previewText,
  footerLinks = [],
  footerText,
  brandName = "BetterAuthEval",
  brandTagline = "Your brandTagline",
  brandLogoUrl,
}: BaseEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={styles.main}>
        <Preview>{previewText}</Preview>
        <Container style={styles.container}>
          {children}

          {brandLogoUrl && (
            <Img
              src={brandLogoUrl}
              width="32"
              height="32"
              alt={`${brandName} Logo`}
            />
          )}

          <Text style={styles.footer}>
            {footerLinks.map((link, i) => (
              <React.Fragment key={link.href}>
                <Link
                  href={link.href}
                  target="_blank"
                  style={{ ...styles.link, color: "#898989" }}
                >
                  {link.text}
                </Link>
                {i < footerLinks.length - 1 && " • "}
              </React.Fragment>
            ))}
            {footerLinks.length > 0 && <br />}
            {footerText || (
              <>
                {brandName}, {brandTagline.toLowerCase()}
              </>
            )}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
