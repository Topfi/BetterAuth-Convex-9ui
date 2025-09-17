import { useMutation, useQuery } from "convex/react";
import { Plus, Minus, RotateCcw } from "lucide-react";

import { api } from "@convex/_generated/api";
import { applyCounterDelta, defaultCounterValue } from "@shared/counter";
import { toast } from "@/lib/toast";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const counterQueryArgs = {} as const;

export function Counter() {
  const counter = useQuery(api.features.counter.get, counterQueryArgs);
  const increment = useMutation(api.features.counter.increment);
  const decrement = useMutation(api.features.counter.decrement);
  const reset = useMutation(api.features.counter.reset);

  const optimisticIncrement = increment.withOptimisticUpdate((store) => {
    const current = store.getQuery(api.features.counter.get, counterQueryArgs);
    const nextValue = applyCounterDelta(current ?? defaultCounterValue, 1);
    store.setQuery(api.features.counter.get, counterQueryArgs, nextValue);
  });

  const optimisticDecrement = decrement.withOptimisticUpdate((store) => {
    const current =
      store.getQuery(api.features.counter.get, counterQueryArgs) ??
      defaultCounterValue;
    const nextValue = applyCounterDelta(current, -1);
    store.setQuery(api.features.counter.get, counterQueryArgs, nextValue);
  });

  const optimisticReset = reset.withOptimisticUpdate((store) => {
    store.setQuery(api.features.counter.get, counterQueryArgs, {
      ...defaultCounterValue,
    });
  });

  const isLoading = counter === undefined;
  const hasCounter = counter !== null && counter !== undefined;
  const value = hasCounter ? counter.value : defaultCounterValue.value;

  const handleIncrement = async () => {
    try {
      await optimisticIncrement();
    } catch (error) {
      toast.error({
        title: "Failed to update counter",
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleDecrement = async () => {
    try {
      await optimisticDecrement();
    } catch (error) {
      toast.error({
        title: "Failed to update counter",
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleReset = async () => {
    try {
      await optimisticReset();
    } catch (error) {
      toast.error({
        title: "Failed to reset counter",
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <Card className="mx-auto w-full max-w-3xl border border-border/60 shadow-sm">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-semibold">Your Counter</CardTitle>
        <CardDescription>
          Keep this counter in sync across devices instantly. Updates apply
          optimistically and persist to Convex for your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-6 py-8">
        <div className="text-5xl font-semibold tabular-nums" aria-live="polite">
          {isLoading ? "--" : value}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={handleDecrement}
            disabled={isLoading || value === 0}
          >
            <Minus className="mr-2 h-4 w-4" aria-hidden="true" /> Decrease
          </Button>
          <Button
            size="lg"
            onClick={handleIncrement}
            disabled={isLoading}
            className="min-w-[160px]"
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Increase
          </Button>
        </div>
      </CardContent>
      <CardFooter className="flex justify-center">
        <Button
          variant="ghost"
          onClick={handleReset}
          disabled={isLoading || value === 0}
        >
          <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" /> Reset
          counter
        </Button>
      </CardFooter>
    </Card>
  );
}
