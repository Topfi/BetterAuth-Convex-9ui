import { forwardRef } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input, type InputProps } from "@/components/ui/input";
import { usePassphrasePreview } from "@/features/auth/hooks/use-passphrase-preview";
import { cn } from "@/lib/utils";

type PassphraseInputProps = InputProps & {
  containerClassName?: string;
  previewLabel?: string;
  previewingLabel?: string;
  preview?: ReturnType<typeof usePassphrasePreview>;
};

export const PassphraseInput = forwardRef<
  HTMLInputElement,
  PassphraseInputProps
>(
  (
    {
      className,
      containerClassName,
      previewLabel = "Preview passphrase",
      previewingLabel = "Hide passphrase",
      preview,
      disabled,
      ...props
    },
    ref,
  ) => {
    const fallbackPreview = usePassphrasePreview();
    const previewState = preview ?? fallbackPreview;
    const { isRevealed, preview: showPreview, hide } = previewState;

    const toggle = () => {
      if (isRevealed) {
        hide();
        return;
      }
      showPreview();
    };

    const rawValue = props.value;
    const isEmpty =
      rawValue === undefined ||
      rawValue === null ||
      (typeof rawValue === "string" && rawValue.trim().length === 0);

    const buttonDisabled = disabled || isEmpty;

    return (
      <div className={cn("relative w-full", containerClassName)}>
        <Input
          {...props}
          ref={ref}
          disabled={disabled}
          type={isRevealed ? "text" : "password"}
          className={cn("pr-11", className)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute inset-y-0 right-0 my-1 mr-1 h-auto rounded-md px-2 text-muted-foreground"
          onClick={toggle}
          disabled={buttonDisabled}
          aria-label={isRevealed ? previewingLabel : previewLabel}
        >
          {isRevealed ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  },
);

PassphraseInput.displayName = "PassphraseInput";
