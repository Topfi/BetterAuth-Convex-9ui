import { useEffect, useRef, useState } from "react";
import { LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AUTH_SIGN_IN_PATH } from "@shared/routes";

const REDIRECT_DELAY_SECONDS = 5;

export default function VerificationSuccess() {
  const navigate = useNavigate();
  const [secondsRemaining, setSecondsRemaining] = useState(
    REDIRECT_DELAY_SECONDS,
  );
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    setSecondsRemaining(REDIRECT_DELAY_SECONDS);
    intervalRef.current = window.setInterval(() => {
      setSecondsRemaining((current) => {
        if (current <= 1) {
          if (intervalRef.current !== null) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          navigate(AUTH_SIGN_IN_PATH, { replace: true });
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [navigate]);

  const handleNavigateNow = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setSecondsRemaining(0);
    navigate(AUTH_SIGN_IN_PATH, { replace: true });
  };

  return (
    <Card className="mx-auto w-full max-w-[420px] space-y-0 border border-border/60 bg-card text-center shadow-2xl">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-semibold">Email verified</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Redirecting you to the sign in page in {secondsRemaining} second
          {secondsRemaining === 1 ? "" : "s"}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          You can continue to the sign in page now or wait for the automatic
          redirect.
        </p>
        <Button size="lg" className="w-full" onClick={handleNavigateNow}>
          <LogIn className="mr-2 h-4 w-4" /> Go to sign in
        </Button>
      </CardContent>
    </Card>
  );
}
