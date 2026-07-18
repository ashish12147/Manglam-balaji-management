type AppEnvironment = "development" | "staging" | "production";

function normalizeUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

function readEnvironment(value: string | undefined): AppEnvironment {
  if (value === "staging" || value === "production") return value;
  return "development";
}

const apiUrl = normalizeUrl(process.env.EXPO_PUBLIC_API_URL);
const wsUrl = normalizeUrl(process.env.EXPO_PUBLIC_WS_URL);

export const env = Object.freeze({
  apiUrl,
  appEnvironment: readEnvironment(process.env.EXPO_PUBLIC_APP_ENV),
  easProjectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() || null,
  wsUrl
});

export function getConfigurationError(): string | null {
  if (!env.apiUrl) {
    return "EXPO_PUBLIC_API_URL is not configured for this build.";
  }

  if (!/^https?:\/\//i.test(env.apiUrl)) {
    return "EXPO_PUBLIC_API_URL must be an HTTP or HTTPS URL.";
  }

  if (env.appEnvironment !== "development" && !env.apiUrl.startsWith("https://")) {
    return "Staging and production builds require an HTTPS API URL.";
  }

  return null;
}
