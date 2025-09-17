import {
  Navigate,
  Outlet,
  RouterProvider,
  createBrowserRouter,
} from "react-router-dom";
import {
  SignInPage,
  SignUpPage,
  VerificationSuccessPage,
} from "@/features/auth";
import { AuthenticatedLayout, LoadingOverlay } from "@/features/app";
import { Counter } from "@/features/counter";
import { SettingsPage } from "@/features/settings";
import { ThemeToggle } from "./components/ThemeToggle";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";

const router = createBrowserRouter([
  {
    path: "/",
    element: <ProtectedLayout />,
    children: [
      {
        element: <AuthenticatedLayout />,
        children: [
          {
            index: true,
            element: <Counter />,
          },
          {
            path: "settings",
            element: <SettingsPage />,
          },
        ],
      },
    ],
  },
  {
    path: "/auth",
    element: <PublicLayout />,
    children: [
      {
        index: true,
        element: <SignInPage />,
      },
      {
        path: "sign-up",
        element: <SignUpPage />,
      },
      {
        path: "verification-success",
        element: <VerificationSuccessPage />,
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);

export default function App() {
  return <RouterProvider router={router} fallbackElement={<LoadingState />} />;
}

function LoadingState() {
  return <LoadingOverlay label="Loading application" />;
}

function ProtectedLayout() {
  return (
    <>
      <AuthLoading>
        <LoadingState />
      </AuthLoading>
      <Authenticated>
        <Outlet />
      </Authenticated>
      <Unauthenticated>
        <Navigate to="/auth" replace />
      </Unauthenticated>
    </>
  );
}

function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-br from-background via-muted/40 to-muted px-4 py-8">
      <div className="mx-auto w-full max-w-5xl pb-6">
        <div className="flex justify-end">
          <ThemeToggle />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center">
        <AuthLoading>
          <LoadingState />
        </AuthLoading>
        <Unauthenticated>
          <Outlet />
        </Unauthenticated>
        <Authenticated>
          <Navigate to="/" replace />
        </Authenticated>
      </div>
    </div>
  );
}
