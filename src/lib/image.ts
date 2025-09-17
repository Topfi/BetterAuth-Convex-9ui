const maxImageBytes = 5 * 1024 * 1024;

export async function encodeImageFile(file: File): Promise<string> {
  if (file.size > maxImageBytes) {
    throw new Error("Images must be 5 MB or smaller.");
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
        return;
      }
      reject(new Error("Image conversion failed."));
    };
    reader.onerror = () => {
      reject(new Error("Image conversion failed."));
    };
    try {
      reader.readAsDataURL(file);
    } catch (error) {
      reject(
        error instanceof Error ? error : new Error("Image conversion failed."),
      );
    }
  });
}
