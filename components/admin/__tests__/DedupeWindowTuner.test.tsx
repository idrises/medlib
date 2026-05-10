import React from "react";
import { Alert, type AlertButton } from "react-native";
import {
  render,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react-native";

import { DedupeWindowTuner } from "../DedupeWindowTuner";

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
const ENDPOINT = "/_internal/bad-id-dedupe";
const AUTH = { mode: "shared-secret" as const, secret: "s3cret" };

const DEFAULT_PAYLOAD = {
  windowMs: 300_000,
  source: "default" as const,
  manualOverride: false,
  effectiveSource: "default" as const,
};

const MANUAL_PAYLOAD = {
  windowMs: 60_000,
  source: "default" as const,
  manualOverride: true,
  effectiveSource: "manual" as const,
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe("DedupeWindowTuner – initial fetch", () => {
  it("renders the active value and source after a successful GET", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(DEFAULT_PAYLOAD),
      }),
    ) as unknown as typeof fetch;

    const { getByText } = render(
      <DedupeWindowTuner
        baseUrl={BASE_URL}
        endpointPath={ENDPOINT}
        auth={AUTH}
        title="Test knob"
        helpText="help"
      />,
    );

    await waitFor(() => {
      expect(getByText("300000 ms")).toBeTruthy();
    });
    expect(getByText("Varsayılan")).toBeTruthy();
  });

  it("shows error text when the GET fails", async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error("boom"))) as unknown as typeof fetch;

    const { getByText } = render(
      <DedupeWindowTuner
        baseUrl={BASE_URL}
        endpointPath={ENDPOINT}
        auth={AUTH}
        title="Test knob"
        helpText="help"
      />,
    );

    await waitFor(() => {
      expect(getByText("Sunucuya bağlanılamadı.")).toBeTruthy();
    });
  });
});

describe("DedupeWindowTuner – apply (PUT)", () => {
  it("PUTs the entered value and updates the active card from the response", async () => {
    const fetchMock = jest.fn((url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(MANUAL_PAYLOAD),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(DEFAULT_PAYLOAD),
      });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getByText, getByPlaceholderText } = render(
      <DedupeWindowTuner
        baseUrl={BASE_URL}
        endpointPath={ENDPOINT}
        auth={AUTH}
        title="Test knob"
        helpText="help"
      />,
    );

    await waitFor(() => {
      expect(getByText("300000 ms")).toBeTruthy();
    });

    const input = getByPlaceholderText("örn. 300000");
    fireEvent.changeText(input, "60000");

    await act(async () => {
      fireEvent.press(getByText("Uygula"));
    });

    await waitFor(() => {
      expect(getByText("60000 ms")).toBeTruthy();
    });
    expect(getByText("Manuel ayar")).toBeTruthy();

    // Verify the PUT was sent against the right URL with the right body.
    const putCall = (fetchMock.mock.calls as unknown[][]).find(
      (c) => (c[1] as RequestInit | undefined)?.method === "PUT",
    );
    expect(putCall).toBeDefined();
    expect(putCall![0]).toBe(`${BASE_URL}${ENDPOINT}`);
    expect(JSON.parse((putCall![1] as RequestInit).body as string)).toEqual({
      windowMs: 60_000,
    });
  });

  it("rejects non-integer/negative input via Alert without firing a PUT", async () => {
    const fetchMock = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(DEFAULT_PAYLOAD),
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    const { getByText, getByPlaceholderText } = render(
      <DedupeWindowTuner
        baseUrl={BASE_URL}
        endpointPath={ENDPOINT}
        auth={AUTH}
        title="Test knob"
        helpText="help"
      />,
    );

    await waitFor(() => {
      expect(getByText("300000 ms")).toBeTruthy();
    });

    const initialCalls = fetchMock.mock.calls.length;
    fireEvent.changeText(getByPlaceholderText("örn. 300000"), "-5");
    await act(async () => {
      fireEvent.press(getByText("Uygula"));
    });

    expect(alertSpy).toHaveBeenCalled();
    expect(fetchMock.mock.calls.length).toBe(initialCalls);
  });
});

describe("DedupeWindowTuner – reset (PUT null)", () => {
  it("sends `null` after the user confirms the reset alert", async () => {
    const fetchMock = jest.fn((_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(DEFAULT_PAYLOAD),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(MANUAL_PAYLOAD),
      });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    // Simulate the user tapping the destructive "Sıfırla" button on
    // the confirmation alert by invoking the second button's onPress.
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_t, _m, buttons) => {
        const reset = (buttons ?? []).find(
          (b: AlertButton) => b.style === "destructive",
        );
        reset?.onPress?.();
      });

    const { getByText } = render(
      <DedupeWindowTuner
        baseUrl={BASE_URL}
        endpointPath={ENDPOINT}
        auth={AUTH}
        title="Test knob"
        helpText="help"
      />,
    );

    await waitFor(() => {
      expect(getByText("Manuel ayar")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByText("Varsayılana dön"));
    });

    expect(alertSpy).toHaveBeenCalled();

    const putCall = (fetchMock.mock.calls as unknown[][]).find(
      (c) => (c[1] as RequestInit | undefined)?.method === "PUT",
    );
    expect(putCall).toBeDefined();
    expect(JSON.parse((putCall![1] as RequestInit).body as string)).toEqual({
      windowMs: null,
    });

    await waitFor(() => {
      expect(getByText("Varsayılan")).toBeTruthy();
    });
  });
});

describe("DedupeWindowTuner – onAfterChange", () => {
  it("fires the callback after a successful PUT", async () => {
    const onAfterChange = jest.fn();
    const fetchMock = jest.fn((_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(MANUAL_PAYLOAD),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(DEFAULT_PAYLOAD),
      });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getByText, getByPlaceholderText } = render(
      <DedupeWindowTuner
        baseUrl={BASE_URL}
        endpointPath={ENDPOINT}
        auth={AUTH}
        title="Test knob"
        helpText="help"
        onAfterChange={onAfterChange}
      />,
    );

    await waitFor(() => {
      expect(getByText("300000 ms")).toBeTruthy();
    });
    fireEvent.changeText(getByPlaceholderText("örn. 300000"), "1000");
    await act(async () => {
      fireEvent.press(getByText("Uygula"));
    });

    await waitFor(() => {
      expect(onAfterChange).toHaveBeenCalledTimes(1);
    });
  });
});
