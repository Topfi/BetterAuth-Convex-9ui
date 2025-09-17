import { toastManager } from "@/hooks/use-toast";

type ToastSeverity = "success" | "error" | "info" | "warning";

type ToastOptions = {
  title: string;
  description?: string;
  timeout?: number;
  priority?: "low" | "high";
};

function pushToast(type: ToastSeverity, options: ToastOptions) {
  toastManager.add({
    ...options,
    type,
  });
}

export const toast = {
  success: (options: ToastOptions) => pushToast("success", options),
  error: (options: ToastOptions) => pushToast("error", options),
  info: (options: ToastOptions) => pushToast("info", options),
  warning: (options: ToastOptions) => pushToast("warning", options),
};
