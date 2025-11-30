const DEBUG_STORAGE_KEY = "bookprepper:debug";
const envDebugValue = import.meta.env.VITE_DEBUG_MODE as string | undefined;

const hasEnvOverride = typeof envDebugValue !== "undefined";
const envDebugEnabled = envDebugValue === "true";

function readStoredDebugFlag(): "true" | "false" {
  if (typeof window === "undefined") {
    return "false";
  }
  try {
    return (window.localStorage.getItem(DEBUG_STORAGE_KEY) as "true" | "false" | null) ?? "false";
  } catch {
    return "false";
  }
}

function writeStoredDebugFlag(value: "true" | "false") {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(DEBUG_STORAGE_KEY, value);
  } catch {
    // no-op when storage is unavailable
  }
}

export function isDebugEnabled(): boolean {
  if (hasEnvOverride) {
    return envDebugEnabled;
  }
  return readStoredDebugFlag() === "true";
}

export function enableDebug() {
  writeStoredDebugFlag("true");
}

export function disableDebug() {
  writeStoredDebugFlag("false");
}

export function debugLog(message: string, ...details: unknown[]) {
  if (!isDebugEnabled()) {
    return;
  }
  console.debug(message, ...details);
}

if (typeof window !== "undefined") {
  window.bookprepperDebug = {
    enable() {
      enableDebug();
      window.location.reload();
    },
    disable() {
      disableDebug();
      window.location.reload();
    },
    isEnabled: isDebugEnabled
  };
}

declare global {
  interface Window {
    bookprepperDebug?: {
      enable: () => void;
      disable: () => void;
      isEnabled: () => boolean;
    };
  }
}

export {};


