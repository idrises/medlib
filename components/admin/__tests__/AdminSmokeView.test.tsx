import React from "react";
import {
  render,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react-native";
import type { AlertButton } from "react-native";

import { AdminSmokeView } from "../AdminSmokeView";

type AlertSpy = jest.SpyInstance<
  void,
  Parameters<typeof import("react-native").Alert.alert>
>;

function getAlertButtons(spy: AlertSpy, callIndex = 0): AlertButton[] {
  const buttons = spy.mock.calls[callIndex]?.[2];
  if (!buttons) {
    throw new Error(`Alert.alert call #${callIndex} had no buttons argument`);
  }
  return buttons;
}

function findAlertButton(
  spy: AlertSpy,
  style: AlertButton["style"],
  callIndex = 0,
): AlertButton {
  const button = getAlertButtons(spy, callIndex).find((b) => b.style === style);
  if (!button) {
    throw new Error(`No Alert button with style "${style}" found`);
  }
  return button;
}

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
    Feather: ({ name, ...rest }: { name: string }) => (
      <Text {...rest}>{name}</Text>
    ),
  };
});

const BASE_URL = "https://example.com/api";
const AUTH_TOKEN = "test-token";

function makeSmokeRun(overrides: Record<string, unknown> = {}) {
  return {
    lastRunAt: "2025-05-01T10:00:00Z",
    lastReason: "scheduled" as const,
    lastStatus: "ok" as const,
    apiBase: "https://api.example.com",
    setIds: [1, 2, 3],
    failureCount: 0,
    ...overrides,
  };
}

function mockFetchResponses({
  historyRuns = [] as ReturnType<typeof makeSmokeRun>[],
  historyError = false,
  historyHttpError = false,
  dedupeData = null as Record<string, unknown> | null,
} = {}) {
  return jest.fn((url: string) => {
    if (typeof url === "string" && url.includes("smoke-history")) {
      if (historyError) {
        return Promise.reject(new Error("network error"));
      }
      if (historyHttpError) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: "Internal Server Error" }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ runs: historyRuns }),
      });
    }
    if (typeof url === "string" && url.includes("last-smoke")) {
      return Promise.resolve({
        ok: !!dedupeData,
        json: () => Promise.resolve(dedupeData ?? {}),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("AdminSmokeView – empty state", () => {
  it("shows empty message when no runs are returned", async () => {
    global.fetch = mockFetchResponses({ historyRuns: [] }) as unknown as typeof fetch;

    const { getByText } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("Henüz smoke kaydı yok.")).toBeTruthy();
    });
  });
});

describe("AdminSmokeView – fetch error handling", () => {
  it("shows error message on network failure", async () => {
    global.fetch = mockFetchResponses({ historyError: true }) as unknown as typeof fetch;

    const { getByText } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("Sunucuya bağlanılamadı.")).toBeTruthy();
    });
  });

  it("shows HTTP error message on non-ok response", async () => {
    global.fetch = mockFetchResponses({ historyHttpError: true }) as unknown as typeof fetch;

    const { getByText } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("Internal Server Error")).toBeTruthy();
    });
  });
});

describe("SummaryCard – ok/failed/error counts", () => {
  it("displays correct counts for mixed run statuses", async () => {
    const runs = [
      makeSmokeRun({ lastStatus: "ok", lastRunAt: "2025-05-01T10:00:00Z" }),
      makeSmokeRun({ lastStatus: "ok", lastRunAt: "2025-05-01T09:00:00Z" }),
      makeSmokeRun({ lastStatus: "failed", lastRunAt: "2025-05-01T08:00:00Z" }),
      makeSmokeRun({
        lastStatus: "harness-error",
        lastRunAt: "2025-05-01T07:00:00Z",
      }),
      makeSmokeRun({
        lastStatus: "harness-error",
        lastRunAt: "2025-05-01T06:00:00Z",
      }),
      makeSmokeRun({
        lastStatus: "harness-error",
        lastRunAt: "2025-05-01T05:00:00Z",
      }),
    ];

    global.fetch = mockFetchResponses({ historyRuns: runs }) as unknown as typeof fetch;

    const { getAllByText } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getAllByText("2").length).toBeGreaterThanOrEqual(1);
    });
    expect(getAllByText("Başarılı").length).toBeGreaterThanOrEqual(1);

    expect(getAllByText("1").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("Başarısız").length).toBeGreaterThanOrEqual(1);

    expect(getAllByText("3").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("Hata").length).toBeGreaterThanOrEqual(1);
  });

  it("does not render SummaryCard when there are no runs", async () => {
    global.fetch = mockFetchResponses({ historyRuns: [] }) as unknown as typeof fetch;

    const { queryByText } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(queryByText("Henüz smoke kaydı yok.")).toBeTruthy();
    });
    expect(queryByText("Başarılı")).toBeNull();
    expect(queryByText("Hata")).toBeNull();
  });
});

describe("Sparkline – dot count and color mapping", () => {
  it("renders correct number of dots", async () => {
    const runs = [
      makeSmokeRun({ lastStatus: "ok", lastRunAt: "2025-05-01T12:00:00Z" }),
      makeSmokeRun({ lastStatus: "failed", lastRunAt: "2025-05-01T11:00:00Z" }),
      makeSmokeRun({
        lastStatus: "harness-error",
        lastRunAt: "2025-05-01T10:00:00Z",
      }),
    ];

    global.fetch = mockFetchResponses({ historyRuns: runs }) as unknown as typeof fetch;

    const { getByText, UNSAFE_root } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("Trend (eski → yeni)")).toBeTruthy();
    });

    const allViews = UNSAFE_root.findAll((node: any) => {
      return (
        node.type === "View" &&
        node.props.style &&
        Array.isArray(node.props.style) &&
        node.props.style.some(
          (s: Record<string, unknown>) =>
            s && typeof s === "object" && "backgroundColor" in s,
        ) &&
        node.props.style.some(
          (s: Record<string, unknown>) =>
            s &&
            typeof s === "object" &&
            (s as { width?: number }).width === 14 &&
            (s as { height?: number }).height === 14,
        )
      );
    });

    expect(allViews.length).toBe(3);
  });

  it("maps ok status to green, failed to red, harness-error to amber", async () => {
    const runs = [
      makeSmokeRun({ lastStatus: "ok", lastRunAt: "2025-05-01T12:00:00Z" }),
      makeSmokeRun({ lastStatus: "failed", lastRunAt: "2025-05-01T11:00:00Z" }),
      makeSmokeRun({
        lastStatus: "harness-error",
        lastRunAt: "2025-05-01T10:00:00Z",
      }),
    ];

    global.fetch = mockFetchResponses({ historyRuns: runs }) as unknown as typeof fetch;

    const { getByText, UNSAFE_root } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("Trend (eski → yeni)")).toBeTruthy();
    });

    const dots = UNSAFE_root.findAll((node: any) => {
      return (
        node.type === "View" &&
        node.props.style &&
        Array.isArray(node.props.style) &&
        node.props.style.some(
          (s: Record<string, unknown>) =>
            s &&
            typeof s === "object" &&
            (s as { width?: number }).width === 14 &&
            (s as { height?: number }).height === 14,
        )
      );
    });

    const dotColors = dots.map((dot: any) => {
      const bgStyle = dot.props.style.find(
        (s: Record<string, unknown>) =>
          s && typeof s === "object" && "backgroundColor" in s,
      );
      return bgStyle?.backgroundColor;
    });

    expect(dotColors).toContain("#16A34A");
    expect(dotColors).toContain("#DC2626");
    expect(dotColors).toContain("#D97706");
  });

  it("does not render sparkline when there are no runs", async () => {
    global.fetch = mockFetchResponses({ historyRuns: [] }) as unknown as typeof fetch;

    const { queryByText } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(queryByText("Henüz smoke kaydı yok.")).toBeTruthy();
    });

    expect(queryByText("Trend (eski → yeni)")).toBeNull();
  });
});

describe("Auto-refresh behavior", () => {
  it("starts with 60s interval selected by default", async () => {
    global.fetch = mockFetchResponses({
      historyRuns: [makeSmokeRun()],
    }) as unknown as typeof fetch;

    const { getByText } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("60s")).toBeTruthy();
    });
  });

  it("opens dropdown and switches to Kapalı (off)", async () => {
    global.fetch = mockFetchResponses({
      historyRuns: [makeSmokeRun()],
    }) as unknown as typeof fetch;

    const { getByText, getAllByText } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("60s")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByText("60s"));
    });

    const offOptions = getAllByText("Kapalı");
    await act(async () => {
      fireEvent.press(offOptions[offOptions.length - 1]);
    });

    expect(getByText("Kapalı")).toBeTruthy();
  });

  it("dismisses dropdown when tapping outside (backdrop press)", async () => {
    global.fetch = mockFetchResponses({
      historyRuns: [makeSmokeRun()],
    }) as unknown as typeof fetch;

    const { getByText, getAllByText, getByTestId, queryByTestId } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("60s")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByText("60s"));
    });

    expect(getAllByText("Kapalı").length).toBeGreaterThan(0);
    expect(getByTestId("refresh-picker-backdrop")).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId("refresh-picker-backdrop"));
    });

    expect(queryByTestId("refresh-picker-backdrop")).toBeNull();
    expect(getByText("60s")).toBeTruthy();
  });

  it("switches interval via dropdown selection", async () => {
    global.fetch = mockFetchResponses({
      historyRuns: [makeSmokeRun()],
    }) as unknown as typeof fetch;

    const { getByText, getAllByText } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("60s")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByText("60s"));
    });

    const opts = getAllByText("30s");
    await act(async () => {
      fireEvent.press(opts[opts.length - 1]);
    });

    expect(getByText("30s")).toBeTruthy();
  });

  it("calls fetch periodically when auto-refresh is on", async () => {
    const fetchMock = mockFetchResponses({
      historyRuns: [makeSmokeRun()],
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const callCountAfterMount = fetchMock.mock.calls.length;

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThan(callCountAfterMount);
  });

  it("does not call fetch periodically when auto-refresh is off", async () => {
    const fetchMock = mockFetchResponses({
      historyRuns: [makeSmokeRun()],
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getByText, getAllByText } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("60s")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByText("60s"));
    });

    const offOptions = getAllByText("Kapalı");
    await act(async () => {
      fireEvent.press(offOptions[offOptions.length - 1]);
    });

    const callCountAfterToggle = fetchMock.mock.calls.length;

    await act(async () => {
      jest.advanceTimersByTime(120_000);
    });

    expect(fetchMock.mock.calls.length).toBe(callCountAfterToggle);
  });

  it("cleans up interval on unmount", async () => {
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");

    const fetchMock = mockFetchResponses({
      historyRuns: [makeSmokeRun()],
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { unmount, getByText } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("60s")).toBeTruthy();
    });

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});

describe("Dedupe card – visibility and clear flow", () => {
  it("shows dedupe card when dedupe.active is true", async () => {
    global.fetch = mockFetchResponses({
      historyRuns: [makeSmokeRun()],
      dedupeData: {
        dedupe: {
          active: true,
          fingerprint: "abc123",
          alertedAt: "2025-05-01T09:00:00Z",
          alertedReason: "scheduled",
          suppressedLatest: true,
        },
      },
    }) as unknown as typeof fetch;

    const { getByText } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("Dedupe aktif")).toBeTruthy();
    });
    expect(getByText(/abc123/)).toBeTruthy();
    expect(getByText(/Uyarı zamanı:\s*\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/)).toBeTruthy();
    expect(getByText("Son çalışma dedupe tarafından bastırıldı")).toBeTruthy();
    expect(getByText("Dedupe temizle")).toBeTruthy();
  });

  it("omits the alert time row when alertedAt is missing", async () => {
    global.fetch = mockFetchResponses({
      historyRuns: [makeSmokeRun()],
      dedupeData: {
        dedupe: {
          active: true,
          fingerprint: "no-time-fp",
          suppressedLatest: false,
        },
      },
    }) as unknown as typeof fetch;

    const { getByText, queryByText } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("Dedupe aktif")).toBeTruthy();
    });
    expect(getByText(/no-time-fp/)).toBeTruthy();
    expect(queryByText(/Uyarı zamanı:/)).toBeNull();
    expect(queryByText("Son çalışma dedupe tarafından bastırıldı")).toBeNull();
  });

  it("does not call clear-smoke-dedupe when the user cancels the confirm alert", async () => {
    const { Alert } = require("react-native");
    const alertSpy = jest.spyOn(Alert, "alert");

    const fetchMock = jest.fn((url: string) => {
      if (typeof url === "string" && url.includes("smoke-history")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ runs: [makeSmokeRun()] }),
        });
      }
      if (typeof url === "string" && url.includes("last-smoke")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              dedupe: {
                active: true,
                fingerprint: "abc123",
                suppressedLatest: false,
              },
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getByText } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("Dedupe aktif")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByText("Dedupe temizle"));
    });

    expect(alertSpy).toHaveBeenCalled();
    const cancelButton = findAlertButton(alertSpy as AlertSpy, "cancel");
    expect(cancelButton).toBeDefined();

    const clearCallsBefore = fetchMock.mock.calls.filter(
      (c: any[]) =>
        typeof c[0] === "string" && c[0].includes("clear-smoke-dedupe"),
    ).length;
    expect(clearCallsBefore).toBe(0);

    alertSpy.mockRestore();
  });

  it("hides dedupe card when dedupe.active is false", async () => {
    global.fetch = mockFetchResponses({
      historyRuns: [makeSmokeRun()],
      dedupeData: {
        dedupe: {
          active: false,
          fingerprint: null,
          suppressedLatest: false,
        },
      },
    }) as unknown as typeof fetch;

    const { queryByText, getAllByText } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getAllByText("Başarılı").length).toBeGreaterThanOrEqual(1);
    });
    expect(queryByText("Dedupe aktif")).toBeNull();
    expect(queryByText("Dedupe temizle")).toBeNull();
  });

  it("hides dedupe card when no dedupe data is returned", async () => {
    global.fetch = mockFetchResponses({
      historyRuns: [makeSmokeRun()],
      dedupeData: null,
    }) as unknown as typeof fetch;

    const { queryByText, getAllByText } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getAllByText("Başarılı").length).toBeGreaterThanOrEqual(1);
    });
    expect(queryByText("Dedupe aktif")).toBeNull();
  });

  it("pressing clear button triggers Alert and POST to clear-smoke-dedupe", async () => {
    const { Alert } = require("react-native");
    const alertSpy = jest.spyOn(Alert, "alert");

    let fetchCallCount = 0;
    const fetchMock = jest.fn((url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.includes("smoke-history")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ runs: [makeSmokeRun()] }),
        });
      }
      if (typeof url === "string" && url.includes("clear-smoke-dedupe")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ previous: { fingerprint: "abc123" } }),
        });
      }
      if (typeof url === "string" && url.includes("last-smoke")) {
        fetchCallCount++;
        if (fetchCallCount <= 1) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                dedupe: {
                  active: true,
                  fingerprint: "abc123",
                  suppressedLatest: false,
                },
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              dedupe: { active: false, fingerprint: null, suppressedLatest: false },
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getByText, queryByText } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("Dedupe aktif")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByText("Dedupe temizle"));
    });

    expect(alertSpy).toHaveBeenCalledWith(
      "Dedupe temizle",
      "Dedupe durumunu temizlemek istediğinizden emin misiniz?",
      expect.arrayContaining([
        expect.objectContaining({ text: "İptal", style: "cancel" }),
        expect.objectContaining({ text: "Temizle", style: "destructive" }),
      ]),
    );

    const destructiveButton = findAlertButton(
      alertSpy as AlertSpy,
      "destructive",
    );
    await act(async () => {
      await destructiveButton.onPress!();
    });

    const clearCall = fetchMock.mock.calls.find(
      (c: any[]) =>
        typeof c[0] === "string" && c[0].includes("clear-smoke-dedupe"),
    );
    expect(clearCall).toBeDefined();
    expect(clearCall![0]).toBe(`${BASE_URL}/_internal/clear-smoke-dedupe`);
    expect(clearCall![1]).toEqual(
      expect.objectContaining({ method: "POST" }),
    );

    await waitFor(() => {
      expect(queryByText("Dedupe aktif")).toBeNull();
    });

    alertSpy.mockRestore();
  });

  it("shows error alert when clear-smoke-dedupe returns non-ok", async () => {
    const { Alert } = require("react-native");
    const alertSpy = jest.spyOn(Alert, "alert");

    const fetchMock = jest.fn((url: string) => {
      if (typeof url === "string" && url.includes("smoke-history")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ runs: [makeSmokeRun()] }),
        });
      }
      if (typeof url === "string" && url.includes("clear-smoke-dedupe")) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: "Server error" }),
        });
      }
      if (typeof url === "string" && url.includes("last-smoke")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              dedupe: {
                active: true,
                fingerprint: "abc123",
                suppressedLatest: false,
              },
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getByText } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("Dedupe aktif")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByText("Dedupe temizle"));
    });

    const destructiveButton = findAlertButton(alertSpy as AlertSpy, "destructive");
    await act(async () => {
      await destructiveButton.onPress!();
    });

    expect(alertSpy).toHaveBeenCalledWith("Hata", "Server error");

    alertSpy.mockRestore();
  });

  it("shows connection error alert and re-enables the button when fetch throws", async () => {
    const { Alert } = require("react-native");
    const alertSpy = jest.spyOn(Alert, "alert");

    const fetchMock = jest.fn((url: string) => {
      if (typeof url === "string" && url.includes("smoke-history")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ runs: [makeSmokeRun()] }),
        });
      }
      if (typeof url === "string" && url.includes("clear-smoke-dedupe")) {
        return Promise.reject(new Error("network down"));
      }
      if (typeof url === "string" && url.includes("last-smoke")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              dedupe: {
                active: true,
                fingerprint: "abc123",
                suppressedLatest: false,
              },
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getByText } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("Dedupe aktif")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByText("Dedupe temizle"));
    });

    const destructiveButton = findAlertButton(alertSpy as AlertSpy, "destructive");
    await act(async () => {
      await destructiveButton.onPress!();
    });

    expect(alertSpy).toHaveBeenCalledWith("Hata", "Sunucuya bağlanılamadı.");

    let node: any = getByText("Dedupe temizle");
    while (node && node.props?.onPress === undefined && node.props?.accessibilityState === undefined) {
      node = node.parent;
    }
    const disabled =
      node?.props?.disabled ?? node?.props?.accessibilityState?.disabled;
    expect(disabled).toBe(false);

    alertSpy.mockRestore();
  });
});

describe("Run smoke now – cooldown countdown", () => {
  function findPressableAncestor(node: any): any {
    let current = node;
    while (current && current.props?.onPress === undefined) {
      current = current.parent;
    }
    return current;
  }

  function isDisabled(node: any): boolean {
    const pressable = findPressableAncestor(node);
    return Boolean(
      pressable?.props?.disabled ??
        pressable?.props?.accessibilityState?.disabled,
    );
  }

  it("triggers POST /run-smoke and refreshes history on success", async () => {
    let postCount = 0;
    const fetchMock = jest.fn((url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.includes("run-smoke") && init?.method === "POST") {
        postCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Map(),
          json: () =>
            Promise.resolve({
              lastRunAt: "2025-05-01T11:00:00Z",
              lastStatus: "ok",
              failureCount: 0,
            }),
        });
      }
      if (typeof url === "string" && url.includes("smoke-history")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ runs: [makeSmokeRun()] }),
        });
      }
      if (typeof url === "string" && url.includes("last-smoke")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getByTestId, getByText, queryByTestId } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("Şimdi çalıştır")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("run-smoke-now"));
    });

    await waitFor(() => {
      expect(getByTestId("run-smoke-result")).toBeTruthy();
    });

    expect(postCount).toBe(1);
    expect(getByText("Şimdi çalıştır")).toBeTruthy();
    expect(getByText(/Smoke çalıştırıldı: Başarılı/)).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(7000);
    });
    expect(queryByTestId("run-smoke-result")).toBeNull();
  });

  it("shows a failure-styled confirmation when the run reports failed probes", async () => {
    const fetchMock = jest.fn((url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.includes("run-smoke") && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Map(),
          json: () =>
            Promise.resolve({
              lastRunAt: "2025-05-01T11:05:00Z",
              lastStatus: "failed",
              failureCount: 2,
            }),
        });
      }
      if (typeof url === "string" && url.includes("smoke-history")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ runs: [makeSmokeRun()] }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getByTestId, getByText } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("Şimdi çalıştır")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("run-smoke-now"));
    });

    await waitFor(() => {
      expect(getByTestId("run-smoke-result")).toBeTruthy();
    });
    expect(getByText(/Smoke çalıştırıldı: Başarısız \(2 probe\)/)).toBeTruthy();
  });

  it("shows a harness-error confirmation including the error message", async () => {
    const fetchMock = jest.fn((url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.includes("run-smoke") && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Map(),
          json: () =>
            Promise.resolve({
              lastRunAt: "2025-05-01T11:10:00Z",
              lastStatus: "harness-error",
              failureCount: 0,
              harnessError: "boom",
            }),
        });
      }
      if (typeof url === "string" && url.includes("smoke-history")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ runs: [makeSmokeRun()] }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getByTestId, getByText } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("Şimdi çalıştır")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("run-smoke-now"));
    });

    await waitFor(() => {
      expect(getByTestId("run-smoke-result")).toBeTruthy();
    });
    expect(getByText(/Smoke çalıştırıldı: Çalıştırılamadı — boom/)).toBeTruthy();
  });

  it("shows a neutral 'unknown' confirmation when the response omits lastStatus", async () => {
    const fetchMock = jest.fn((url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.includes("run-smoke") && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Map(),
          json: () => Promise.resolve({ lastRunAt: "2025-05-01T11:15:00Z" }),
        });
      }
      if (typeof url === "string" && url.includes("smoke-history")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ runs: [makeSmokeRun()] }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getByTestId, getByText } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("Şimdi çalıştır")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("run-smoke-now"));
    });

    await waitFor(() => {
      expect(getByTestId("run-smoke-result")).toBeTruthy();
    });
    expect(getByText(/Smoke çalıştırıldı: durum bilinmiyor/)).toBeTruthy();
  });

  it("shows countdown and disables button on 429 cooldown response", async () => {
    const fetchMock = jest.fn((url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.includes("run-smoke") && init?.method === "POST") {
        return Promise.resolve({
          ok: false,
          status: 429,
          headers: new Map([["Retry-After", "47"]]),
          json: () =>
            Promise.resolve({
              error: "Cooldown window has not elapsed since the last smoke run. Try again later.",
              reason: "cooldown",
              retryAfterSeconds: 47,
            }),
        });
      }
      if (typeof url === "string" && url.includes("smoke-history")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ runs: [makeSmokeRun()] }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getByTestId, getByText, queryByText } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("Şimdi çalıştır")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("run-smoke-now"));
    });

    await waitFor(() => {
      expect(queryByText(/Bekleme: \d+s/)).toBeTruthy();
    });

    expect(isDisabled(getByTestId("run-smoke-now"))).toBe(true);
    expect(getByText(/Bekleme penceresi devam ediyor\./)).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(getByText(/Bekleme: 4[0-9]s/)).toBeTruthy();
  });

  it("uses 'in-flight' copy when reason is in-flight", async () => {
    const fetchMock = jest.fn((url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.includes("run-smoke") && init?.method === "POST") {
        return Promise.resolve({
          ok: false,
          status: 429,
          headers: new Map([["Retry-After", "5"]]),
          json: () =>
            Promise.resolve({
              error: "A smoke run is already in progress. Try again later.",
              reason: "in-flight",
              retryAfterSeconds: 5,
            }),
        });
      }
      if (typeof url === "string" && url.includes("smoke-history")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ runs: [makeSmokeRun()] }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getByTestId, getByText } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("Şimdi çalıştır")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("run-smoke-now"));
    });

    await waitFor(() => {
      expect(getByText(/Çalışma sürüyor — \d+s/)).toBeTruthy();
    });
    expect(getByText(/Başka bir smoke çalışması zaten sürüyor\./)).toBeTruthy();
  });

  it("re-enables the button after the cooldown elapses", async () => {
    const fetchMock = jest.fn((url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.includes("run-smoke") && init?.method === "POST") {
        return Promise.resolve({
          ok: false,
          status: 429,
          headers: new Map([["Retry-After", "3"]]),
          json: () =>
            Promise.resolve({
              error: "Cooldown",
              reason: "cooldown",
              retryAfterSeconds: 3,
            }),
        });
      }
      if (typeof url === "string" && url.includes("smoke-history")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ runs: [makeSmokeRun()] }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getByTestId, getByText, queryByText } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("Şimdi çalıştır")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("run-smoke-now"));
    });

    await waitFor(() => {
      expect(queryByText(/Bekleme: \d+s/)).toBeTruthy();
    });
    expect(isDisabled(getByTestId("run-smoke-now"))).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(4000);
    });

    expect(queryByText(/Bekleme: \d+s/)).toBeNull();
    expect(getByText("Şimdi çalıştır")).toBeTruthy();
    expect(isDisabled(getByTestId("run-smoke-now"))).toBe(false);
  });
});

describe("Manual refresh button", () => {
  it("triggers a new fetch when refresh icon is pressed", async () => {
    const fetchMock = mockFetchResponses({
      historyRuns: [makeSmokeRun()],
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getByText } = render(
      <AdminSmokeView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const callCountBefore = fetchMock.mock.calls.length;

    await act(async () => {
      fireEvent.press(getByText("refresh-cw"));
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callCountBefore);
    });
  });
});
