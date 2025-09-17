import { useId } from "react";

import { Meter, MeterLabel } from "@/components/ui/meter";
import {
  getPassphraseStrengthDescriptor,
  passphraseStrengthLabels,
  type PassphraseStrengthTone,
  type PassphraseValidationResult,
} from "@shared/auth";
import { cn } from "@/lib/utils";

const fallbackGuidance = "Start typing to see how strong your passphrase is.";
const fallbackLabel = "Not started";

interface PassphraseStrengthMeterProps {
  validation?: PassphraseValidationResult | null;
  className?: string;
}

const toneStyles: Record<
  PassphraseStrengthTone,
  { indicator: string; track: string; text: string }
> = {
  danger: {
    indicator: "[&_[data-slot='meter-indicator']]:bg-destructive",
    track: "[&_[data-slot='meter-track']]:bg-destructive/20",
    text: "text-destructive",
  },
  warning: {
    indicator: "[&_[data-slot='meter-indicator']]:bg-amber-500",
    track: "[&_[data-slot='meter-track']]:bg-amber-500/25",
    text: "text-amber-500",
  },
  info: {
    indicator: "[&_[data-slot='meter-indicator']]:bg-primary",
    track: "[&_[data-slot='meter-track']]:bg-muted",
    text: "text-muted-foreground",
  },
  success: {
    indicator: "[&_[data-slot='meter-indicator']]:bg-emerald-500",
    track: "[&_[data-slot='meter-track']]:bg-emerald-500/20",
    text: "text-emerald-600",
  },
};

const failureToneOverrides: Record<
  PassphraseValidationResult["failures"][number]["code"],
  PassphraseStrengthTone
> = {
  too_short: "danger",
  too_weak: "warning",
};

export function PassphraseStrengthMeter({
  validation,
  className,
}: PassphraseStrengthMeterProps) {
  const descriptor = getPassphraseStrengthDescriptor(
    validation?.result.score ?? 0,
  );
  const guidanceId = useId();
  const hasInput = Boolean(validation?.result.password?.length);
  const highestPriorityFailure = validation?.failures[0];
  let toneKey: PassphraseStrengthTone = "info";
  if (highestPriorityFailure) {
    toneKey = failureToneOverrides[highestPriorityFailure.code];
  } else if (hasInput) {
    toneKey = descriptor.tone;
  }
  const tone = toneStyles[toneKey];

  const guidance =
    highestPriorityFailure?.message ??
    (hasInput ? descriptor.guidance : fallbackGuidance);
  const label = hasInput ? descriptor.label : fallbackLabel;
  const meterValue = hasInput ? descriptor.normalizedScore : 0;

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      <Meter
        value={meterValue}
        max={passphraseStrengthLabels.length - 1}
        className={cn(
          "group/meter [&_[data-slot='meter-indicator']]:min-w-[0.375rem]",
          tone.indicator,
          tone.track,
        )}
        aria-valuetext={guidance}
        aria-describedby={guidanceId}
      >
        <MeterLabel className="text-xs font-medium uppercase tracking-wide">
          Strength
        </MeterLabel>
      </Meter>
      <div className="space-y-1 text-xs" id={guidanceId}>
        <p className={cn("font-semibold", tone.text)}>{label}</p>
        <p className="text-muted-foreground">{guidance}</p>
      </div>
    </div>
  );
}
