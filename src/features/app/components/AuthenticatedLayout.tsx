import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { ArrowLeft, LogOut, Settings } from "lucide-react";

import { api } from "@convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { deriveUserDisplayName, deriveUserInitial } from "@shared/user";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "./LoadingOverlay";

type CurrentUser = NonNullable<
  (typeof api.features.auth.getCurrentUser)["_returnType"]
>;

export type AuthenticatedOutletContext = {
  user: CurrentUser;
  displayName: string;
  avatarInitial: string;
};

export function AuthenticatedLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useQuery(api.features.auth.getCurrentUser);

  if (!user) {
    return <LoadingOverlay label="Loading your space" />;
  }

  const displayName = deriveUserDisplayName(user);
  const avatarInitial = deriveUserInitial(user);
  const context: AuthenticatedOutletContext = {
    user,
    displayName,
    avatarInitial,
  };

  const isOnSettings = location.pathname.startsWith("/settings");

  return (
    <div className="min-h-dvh bg-gradient-to-b from-background via-background/60 to-muted/30 px-4 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="flex flex-col gap-6 rounded-xl border border-border/60 bg-card p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar size="lg">
              {user.image ? (
                <AvatarImage src={user.image} alt={displayName} />
              ) : null}
              <AvatarFallback className="text-lg font-semibold">
                {avatarInitial}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h1 className="text-lg font-semibold">{displayName}</h1>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ThemeToggle />
            {isOnSettings ? (
              <Button
                variant="outline"
                className="min-w-[140px]"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to app
              </Button>
            ) : (
              <Button
                variant="ghost"
                className="min-w-[140px]"
                onClick={() => navigate("/settings")}
              >
                <Settings className="mr-2 h-4 w-4" /> Settings
              </Button>
            )}
            <Button variant="ghost" onClick={() => authClient.signOut()}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </header>

        <main>
          <Outlet context={context} />
        </main>
      </div>
    </div>
  );
}
