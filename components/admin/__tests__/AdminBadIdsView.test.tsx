import React from "react";
import {
  render,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react-native";

import { AdminBadIdsView } from "../AdminBadIdsView";

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

/**
 * URL-aware fetch mock. AdminBadIdsView mounts two children that fetch
 * concurrently:
 *   - the main `/_internal/bad-ids` counter view, and
 *   - the embedded DedupeWindowTuner against `/_internal/bad-id-dedupe`.
 * The tuner's request is incidental to these tests, so we always answer
 * it with a static "default" payload and route the bad-ids request
 * through the test's configured failure / success branches.
 */
const DEDUPE_OK_PAYLOAD = {
  windowMs: 300_000,
  source: "default" as const,
  manualOverride: false,
  effectiveSource: "default" as const,
};

function mockBadIdsFetch({
  badIdCoercionCount = 0,
  byRoute = {} as Record<string, Record<string, number>>,
  suppressedWarnings = {} as Record<string, Record<string, number>>,
  byRouteCapped = false,
  networkError = false,
  httpError = false,
  httpStatus = 500,
  httpErrorMessage = "Internal Server Error",
} = {}) {
  return jest.fn((url: string) => {
    if (url.includes("/_internal/bad-id-dedupe")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(DEDUPE_OK_PAYLOAD),
      });
    }
    if (networkError) {
      return Promise.reject(new Error("network error"));
    }
    if (httpError) {
      return Promise.resolve({
        ok: false,
        status: httpStatus,
        json: () => Promise.resolve({ error: httpErrorMessage }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ badIdCoercionCount, byRoute, suppressedWarnings, byRouteCapped }),
    });
  });
}

/**
 * Helper to find the call index of a fetch matching a URL substring.
 * The two children fetch concurrently and Promise resolution order is
 * an implementation detail, so tests should never assume a fixed index.
 */
function findCall(
  fetchMock: jest.Mock,
  pathFragment: string,
): unknown[] | undefined {
  return (fetchMock.mock.calls as unknown[][]).find(
    (call) => typeof call[0] === "string" && (call[0] as string).includes(pathFragment),
  );
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("AdminBadIdsView – loading state", () => {
  it("shows an activity indicator while fetching", async () => {
    let resolveBadIds!: (v: unknown) => void;
    global.fetch = jest.fn((url: string) => {
      if (url.includes("/_internal/bad-id-dedupe")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(DEDUPE_OK_PAYLOAD),
        });
      }
      return new Promise((resolve) => {
        resolveBadIds = resolve;
      });
    }) as unknown as typeof fetch;

    const { UNSAFE_root } = render(
      <AdminBadIdsView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    const indicators = UNSAFE_root.findAll(
      (node: any) => node.type === "ActivityIndicator",
    );
    expect(indicators.length).toBeGreaterThanOrEqual(1);

    await act(async () => {
      resolveBadIds({
        ok: true,
        json: () => Promise.resolve({ badIdCoercionCount: 0, byRoute: {} }),
      });
    });
  });
});

describe("AdminBadIdsView – zero-count clean state", () => {
  it("shows 0 count, Temiz badge, and no-conversion message", async () => {
    global.fetch = mockBadIdsFetch({
      badIdCoercionCount: 0,
      byRoute: {},
    }) as unknown as typeof fetch;

    const { getByText, queryByText } = render(
      <AdminBadIdsView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("0")).toBeTruthy();
    });

    expect(getByText("Temiz")).toBeTruthy();
    expect(getByText("Hiçbir ID dönüşümü algılanmadı.")).toBeTruthy();
    expect(queryByText("Dikkat")).toBeNull();
  });
});

describe("AdminBadIdsView – non-zero count with warning", () => {
  it("shows count, Dikkat warning badge, and no Temiz badge", async () => {
    global.fetch = mockBadIdsFetch({
      badIdCoercionCount: 7,
      byRoute: {},
    }) as unknown as typeof fetch;

    const { getByText, queryByText } = render(
      <AdminBadIdsView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("7")).toBeTruthy();
    });

    expect(getByText("Dikkat")).toBeTruthy();
    expect(queryByText("Temiz")).toBeNull();
  });
});

describe("AdminBadIdsView – route breakdown rendering", () => {
  it("renders route cards with field names and counts", async () => {
    global.fetch = mockBadIdsFetch({
      badIdCoercionCount: 5,
      byRoute: {
        "/api/users/:id": { userId: 3, participantId: 2 },
      },
    }) as unknown as typeof fetch;

    const { getByText, getAllByText } = render(
      <AdminBadIdsView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("Rota bazında dağılım")).toBeTruthy();
    });

    expect(getByText("/api/users/:id")).toBeTruthy();
    expect(getByText("userId")).toBeTruthy();
    expect(getByText("3")).toBeTruthy();
    expect(getByText("participantId")).toBeTruthy();
    expect(getByText("2")).toBeTruthy();
    const fives = getAllByText("5");
    expect(fives.length).toBeGreaterThanOrEqual(2);
  });

  it("renders multiple route cards", async () => {
    global.fetch = mockBadIdsFetch({
      badIdCoercionCount: 4,
      byRoute: {
        "/api/sets/:id": { setId: 1 },
        "/api/cards/:id": { cardId: 3 },
      },
    }) as unknown as typeof fetch;

    const { getByText } = render(
      <AdminBadIdsView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("/api/sets/:id")).toBeTruthy();
    });

    expect(getByText("/api/cards/:id")).toBeTruthy();
    expect(getByText("setId")).toBeTruthy();
    expect(getByText("cardId")).toBeTruthy();
  });

  it("shows suppressed-warn badge only for fields with suppressed count > 0", async () => {
    global.fetch = mockBadIdsFetch({
      badIdCoercionCount: 5,
      byRoute: {
        "/api/users/:id": { userId: 3, participantId: 2 },
      },
      suppressedWarnings: {
        "/api/users/:id": { userId: 10 },
      },
    }) as unknown as typeof fetch;

    const { getByText, getAllByText } = render(
      <AdminBadIdsView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("userId")).toBeTruthy();
    });

    expect(getByText("10")).toBeTruthy();

    expect(getAllByText("volume-x").length).toBeGreaterThanOrEqual(1);
    expect(getByText("10 bastırılan uyarı")).toBeTruthy();
  });

  it("does not show suppressed-warn badge when suppressedWarnings is empty", async () => {
    global.fetch = mockBadIdsFetch({
      badIdCoercionCount: 3,
      byRoute: {
        "/api/items/:id": { itemId: 3 },
      },
      suppressedWarnings: {},
    }) as unknown as typeof fetch;

    const { getByText, queryByText } = render(
      <AdminBadIdsView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("itemId")).toBeTruthy();
    });

    expect(queryByText("volume-x")).toBeNull();
  });
});

describe("AdminBadIdsView – byRouteCapped banner", () => {
  it("shows the saturation warning banner when byRouteCapped is true", async () => {
    global.fetch = mockBadIdsFetch({
      badIdCoercionCount: 5,
      byRoute: { "/api/users/:id": { userId: 5 } },
      byRouteCapped: true,
    }) as unknown as typeof fetch;

    const { getByText } = render(
      <AdminBadIdsView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(
        getByText("Rota dağılımı 200 rota ile sınırlandı; liste eksik olabilir."),
      ).toBeTruthy();
    });
  });

  it("does not show the saturation warning banner when byRouteCapped is false", async () => {
    global.fetch = mockBadIdsFetch({
      badIdCoercionCount: 5,
      byRoute: { "/api/users/:id": { userId: 5 } },
      byRouteCapped: false,
    }) as unknown as typeof fetch;

    const { getByText, queryByText } = render(
      <AdminBadIdsView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("/api/users/:id")).toBeTruthy();
    });

    expect(
      queryByText("Rota dağılımı 200 rota ile sınırlandı; liste eksik olabilir."),
    ).toBeNull();
  });

  it("does not show the saturation warning banner when byRouteCapped is missing", async () => {
    global.fetch = jest.fn((url: string) => {
      if (url.includes("/_internal/bad-id-dedupe")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(DEDUPE_OK_PAYLOAD),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            badIdCoercionCount: 0,
            byRoute: {},
            suppressedWarnings: {},
          }),
      });
    }) as unknown as typeof fetch;

    const { getByText, queryByText } = render(
      <AdminBadIdsView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("0")).toBeTruthy();
    });

    expect(
      queryByText("Rota dağılımı 200 rota ile sınırlandı; liste eksik olabilir."),
    ).toBeNull();
  });
});

describe("AdminBadIdsView – error states", () => {
  it("shows error message on network failure", async () => {
    global.fetch = mockBadIdsFetch({
      networkError: true,
    }) as unknown as typeof fetch;

    const { getByText } = render(
      <AdminBadIdsView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("Sunucuya bağlanılamadı.")).toBeTruthy();
    });

    expect(getByText("—")).toBeTruthy();
    expect(getByText("Bilinmiyor")).toBeTruthy();
  });

  it("shows HTTP error message from server response", async () => {
    global.fetch = mockBadIdsFetch({
      httpError: true,
      httpStatus: 403,
      httpErrorMessage: "Forbidden",
    }) as unknown as typeof fetch;

    const { getByText } = render(
      <AdminBadIdsView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("Forbidden")).toBeTruthy();
    });

    expect(getByText("—")).toBeTruthy();
  });

  it("falls back to HTTP status code when error field is not a string", async () => {
    global.fetch = jest.fn((url: string) => {
      if (url.includes("/_internal/bad-id-dedupe")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(DEDUPE_OK_PAYLOAD),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 502,
        json: () => Promise.resolve({ error: 123 }),
      });
    }) as unknown as typeof fetch;

    const { getByText } = render(
      <AdminBadIdsView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("HTTP 502")).toBeTruthy();
    });
  });
});

describe("AdminBadIdsView – auth header", () => {
  it("sends Bearer token in Authorization header", async () => {
    const fetchMock = mockBadIdsFetch();
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<AdminBadIdsView baseUrl={BASE_URL} token={AUTH_TOKEN} />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const call = findCall(fetchMock, "/_internal/bad-ids");
    expect(call).toBeDefined();
    expect((call![1] as RequestInit)?.headers).toEqual({
      Authorization: "Bearer test-token",
    });
  });

  it("sends shared-secret header when auth mode is shared-secret", async () => {
    const fetchMock = mockBadIdsFetch();
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <AdminBadIdsView
        baseUrl={BASE_URL}
        auth={{ mode: "shared-secret", secret: "s3cret" }}
      />,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const call = findCall(fetchMock, "/_internal/bad-ids");
    expect(call).toBeDefined();
    expect((call![1] as RequestInit)?.headers).toEqual({
      "x-smoke-status-token": "s3cret",
    });
  });
});

describe("AdminBadIdsView – manual refresh", () => {
  it("triggers a new fetch when refresh icon is pressed", async () => {
    const fetchMock = mockBadIdsFetch({ badIdCoercionCount: 0 });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getAllByText, getByText } = render(
      <AdminBadIdsView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("0")).toBeTruthy();
    });

    const callsBefore = fetchMock.mock.calls.filter(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("/_internal/bad-ids"),
    ).length;

    // The view now renders two `refresh-cw` icons (counter view +
    // tuner card); the first one belongs to the counter view's
    // header. Press it explicitly so we don't accidentally exercise
    // the tuner's refresh.
    await act(async () => {
      fireEvent.press(getAllByText("refresh-cw")[0]);
    });

    await waitFor(() => {
      const callsAfter = fetchMock.mock.calls.filter(
        (c) => typeof c[0] === "string" && (c[0] as string).includes("/_internal/bad-ids"),
      ).length;
      expect(callsAfter).toBeGreaterThan(callsBefore);
    });
  });
});

describe("AdminBadIdsView – pull-to-refresh", () => {
  it("triggers a new fetch when ScrollView RefreshControl onRefresh fires", async () => {
    const fetchMock = mockBadIdsFetch({ badIdCoercionCount: 0 });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getByText, UNSAFE_root } = render(
      <AdminBadIdsView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("0")).toBeTruthy();
    });

    const callCountBefore = fetchMock.mock.calls.length;

    const scrollView = UNSAFE_root.findAll(
      (node: any) => node.type === "RCTScrollView" || node.type === "ScrollView",
    )[0];
    expect(scrollView).toBeTruthy();
    const refreshControl = scrollView.props.refreshControl;
    expect(refreshControl).toBeTruthy();
    expect(typeof refreshControl.props.onRefresh).toBe("function");

    await act(async () => {
      refreshControl.props.onRefresh();
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callCountBefore);
    });
  });
});

describe("AdminBadIdsView – data recovery after error", () => {
  it("clears the error and renders data after a successful refetch following a failure", async () => {
    let badIdsCalls = 0;
    const fetchMock = jest.fn((url: string) => {
      if (url.includes("/_internal/bad-id-dedupe")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(DEDUPE_OK_PAYLOAD),
        });
      }
      badIdsCalls += 1;
      if (badIdsCalls === 1) {
        return Promise.reject(new Error("network error"));
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            badIdCoercionCount: 11,
            byRoute: { "/api/users/:id": { userId: 5, participantId: 2 } },
            suppressedWarnings: {},
            byRouteCapped: false,
          }),
      });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getAllByText, getByText, queryByText } = render(
      <AdminBadIdsView baseUrl={BASE_URL} token={AUTH_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByText("Sunucuya bağlanılamadı.")).toBeTruthy();
    });
    expect(getByText("—")).toBeTruthy();
    expect(getByText("Bilinmiyor")).toBeTruthy();

    // Counter view header is the first refresh icon; pressing it
    // re-runs `fetchBadIds` only.
    await act(async () => {
      fireEvent.press(getAllByText("refresh-cw")[0]);
    });

    await waitFor(() => {
      expect(getByText("11")).toBeTruthy();
    });

    expect(queryByText("Sunucuya bağlanılamadı.")).toBeNull();
    expect(queryByText("—")).toBeNull();
    expect(queryByText("Bilinmiyor")).toBeNull();
    expect(getByText("/api/users/:id")).toBeTruthy();
    expect(getByText("Dikkat")).toBeTruthy();
  });
});

describe("AdminBadIdsView – fetch URL", () => {
  it("calls the correct bad-ids endpoint", async () => {
    const fetchMock = mockBadIdsFetch();
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<AdminBadIdsView baseUrl={BASE_URL} token={AUTH_TOKEN} />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    // Both children fetch concurrently; assert the bad-ids URL is
    // among the calls rather than relying on a fixed call index.
    const call = findCall(fetchMock, "/_internal/bad-ids");
    expect(call).toBeDefined();
    expect(call![0]).toBe("https://example.com/api/_internal/bad-ids");
  });

  it("also fetches the embedded bad-id-dedupe tuner endpoint on mount", async () => {
    const fetchMock = mockBadIdsFetch();
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<AdminBadIdsView baseUrl={BASE_URL} token={AUTH_TOKEN} />);

    await waitFor(() => {
      expect(findCall(fetchMock, "/_internal/bad-id-dedupe")).toBeDefined();
    });
  });
});
