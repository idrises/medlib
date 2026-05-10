export type AuthConfig =
  | { mode: "jwt"; token: string }
  | { mode: "shared-secret"; secret: string };

interface AuthProps {
  token?: string;
  auth?: AuthConfig;
}

export function resolveAuth(props: AuthProps): AuthConfig {
  if (props.auth) return props.auth;
  if (props.token) return { mode: "jwt", token: props.token };
  return { mode: "jwt", token: "" };
}

export function buildAuthHeaders(auth: AuthConfig): Record<string, string> {
  if (auth.mode === "shared-secret") {
    return { "x-smoke-status-token": auth.secret };
  }
  return { Authorization: `Bearer ${auth.token}` };
}
