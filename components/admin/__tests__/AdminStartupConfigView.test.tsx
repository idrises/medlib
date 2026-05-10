import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

import { AdminStartupConfigView } from "../AdminStartupConfigView";

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    primary: "#0057B8",
    background: "#F4F7FB",
    foreground: "#0f1923",
    card: "#FFFFFF",
    cardForeground: "#0f1923",
    border: "#D9E2EF",
    muted: "#EEF1F5",
    mutedForeground: "#6B7A8D",
    radius: 12,
  }),
}));

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Feather: ({ name, ...rest }: { name: string }) => <Text {...rest}>{name}</Text>,
  };
});

const BASE_URL = "https://example.com/api";
const AUTH_TOKEN = "test-token";

const SAMPLE_CONFIG = {
  server: {
    port: { value: 8080, source: "env" },
    nodeEnv: { value: "production", source: "env" },
    logLevel: { value: "info", source: "default" },
  },
  database: {
    server: { value: "db.example.com", source: "env" },
    database: { value: "medlib", source: "env" },
    user: { value: "app", source: "env" },
    password: { set: true, length: 16, source: "env" },
  },
  auth: {
    sessionSecret: { set: true, length: 32, source: "env" },
    adminUserIds: { count: 2, source: "env" },
    superAdminUserIds: { count: 0, source: "default" },
    smokeStatusToken: { set: false, length: 0, source: "default" },
  },
  warnDedupe: {
    badIdWindowMs: { value: 60000, source: "default" },
    precisionWindowMs: { value: 300000, source: "default" },
  },
  smokeScheduler: {
    enabled: { value: true, source: "env" },
    runOnStartup: { value: true, source: "default" },
    startupDelayMs: { value: 60000, source: "default" },
    cron: { value: "30 9 * * *", source: "default" },
    cronTz: { value: "Europe/Istanbul", source: "default" },
    historySize: { value: 14, source: "default" },
    historyFilePath: { value: "(db default)", source: "default" },
    triggerCooldownS: { value: 60, source: "default" },
  },
  smokeWatchdog: {
    enabled: { value: true, source: "default" },
    cron: { value: "0 */4 * * *", source: "default" },
    staleHours: { value: 26, source: "default" },
    stalenessStatePath: { value: "(db default)", source: "default" },
  },
  smokeProbe: {
    apiBase: { value: "https://medical-library-hub.replit.app/api", source: "default" },
    timeoutMs: { value: 15000, source: "default" },
    videoSetCount: { value: 3, source: "default" },
    entriesPerSet: { value: 1, source: "default" },
    requireVideo200: { value: false, source: "default" },
    videoSetIds: { count: 0, source: "default" },
  },
  smokeAlerter: {
    slackWebhook: { set: false, length: 0, source: "default" },
    expoTokens: { count: 0, source: "default" },
    alertStatePath: { value: "(db default)", source: "default" },
    alertDedupeHours: { value: 6, source: "default" },
  },
  ai: {
    openaiApiKey: { set: true, length: 40, source: "env" },
  },
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe("AdminStartupConfigView", () => {
  it("renders all sections, env-supplied values, and source badges", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(SAMPLE_CONFIG),
      }),
    ) as unknown as typeof fetch;

    const { getByText, getAllByText } = render(
      <AdminStartupConfigView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("Sunucu")).toBeTruthy();
    });
    expect(getByText("Veritabanı")).toBeTruthy();
    expect(getByText("Kimlik doğrulama")).toBeTruthy();
    expect(getByText("Yapay zeka")).toBeTruthy();
    expect(getByText("8080")).toBeTruthy();
    expect(getByText("production")).toBeTruthy();
    expect(getByText("db.example.com")).toBeTruthy();
    expect(getAllByText("Ortam değişkeni").length).toBeGreaterThan(0);
    expect(getAllByText("Varsayılan").length).toBeGreaterThan(0);
  });

  it("renders secrets only as set/length, never raw values", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(SAMPLE_CONFIG),
      }),
    ) as unknown as typeof fetch;

    const { getByText, getAllByText } = render(
      <AdminStartupConfigView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText(/set \(16 karakter\)/)).toBeTruthy();
    });
    expect(getByText(/set \(32 karakter\)/)).toBeTruthy();
    expect(getByText(/set \(40 karakter\)/)).toBeTruthy();
    // Both smokeStatusToken and slackWebhook are unset in the sample.
    expect(getAllByText("unset").length).toBeGreaterThanOrEqual(1);
    // Sanity: the "(gizli)" caption renders for every secret.
    expect(getAllByText("(gizli)").length).toBeGreaterThanOrEqual(1);
  });

  it("renders csv counts with the kayıt label", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(SAMPLE_CONFIG),
      }),
    ) as unknown as typeof fetch;

    const { getByText } = render(
      <AdminStartupConfigView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("2 kayıt")).toBeTruthy();
    });
  });

  it("hits the startup-config endpoint with Bearer auth", async () => {
    const fetchMock = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(SAMPLE_CONFIG) }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<AdminStartupConfigView baseUrl={BASE_URL} token={AUTH_TOKEN} />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const call = fetchMock.mock.calls[0] as any[];
    expect(call[0]).toBe("https://example.com/api/_internal/startup-config");
    expect(call[1]?.headers).toEqual({ Authorization: "Bearer test-token" });
  });

  it("uses shared-secret header when auth mode is shared-secret", async () => {
    const fetchMock = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(SAMPLE_CONFIG) }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <AdminStartupConfigView
        baseUrl={BASE_URL}
        auth={{ mode: "shared-secret", secret: "s3cret" }}
      />,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const call = fetchMock.mock.calls[0] as any[];
    expect(call[1]?.headers).toEqual({ "x-smoke-status-token": "s3cret" });
  });

  it("shows an error message on network failure", async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error("network error"))) as unknown as typeof fetch;

    const { getByText } = render(
      <AdminStartupConfigView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("Sunucuya bağlanılamadı.")).toBeTruthy();
    });
  });

  it("shows the HTTP error message returned by the server", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Unauthorized" }),
      }),
    ) as unknown as typeof fetch;

    const { getByText } = render(
      <AdminStartupConfigView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("Unauthorized")).toBeTruthy();
    });
  });

  it("re-fetches when the manual refresh icon is pressed", async () => {
    const fetchMock = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(SAMPLE_CONFIG) }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getByText } = render(
      <AdminStartupConfigView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("Sunucu")).toBeTruthy();
    });

    const before = fetchMock.mock.calls.length;
    await act(async () => {
      fireEvent.press(getByText("refresh-cw"));
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(before);
    });
  });
});
