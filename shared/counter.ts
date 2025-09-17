import { z } from "zod";

export const counterValueSchema = z.object({
  value: z
    .number()
    .int({ message: "Counter must be a whole number." })
    .min(0, { message: "Counter cannot drop below zero." }),
});

export type CounterValue = z.infer<typeof counterValueSchema>;

export const defaultCounterValue: CounterValue = { value: 0 };

export const applyCounterDelta = (
  current: CounterValue | undefined,
  delta: number,
): CounterValue => {
  const nextValue = Math.max(
    0,
    (current?.value ?? defaultCounterValue.value) + delta,
  );
  return counterValueSchema.parse({ value: nextValue });
};
