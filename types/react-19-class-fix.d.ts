// TEMPORARY SHIM — remove once upstream Expo/RN libraries publish React 19
// compatible types. Tracked by follow-up task #38 ("Drop the React 19 type
// shim once Expo libraries publish updated types").
//
// React 19's `@types/react` declares `class Component<P, S>` with no default
// for `S`, while older library code declares `class Foo<P> extends Component<P>`
// (a single type argument). When TypeScript resolves the `extends` clause it
// falls back to the merged `interface Component<P = {}, S = {}, SS = any>`,
// which only includes lifecycle methods — not the class members `props`,
// `state`, `setState`, `forceUpdate`, or `context`. The derived class instance
// is therefore not assignable to `JSX.ElementClass`, producing TS2786:
// "X cannot be used as a JSX component".
//
// Until each library publishes types that pass both type arguments to
// `Component`, we re-declare the broken classes here as interfaces that extend
// `React.Component<Props>` with both type parameters supplied. Declaration
// merging then fills in the missing members on the class instance type.
//
// This is a typings-only shim: it changes no runtime behaviour and does not
// suppress errors the way `@ts-ignore` or `any` would. If a library is later
// upgraded to types that already extend `Component<P, S>`, the merge is a
// no-op and these declarations can be deleted.
//
// ─── Last verified: 2026-04-28 ────────────────────────────────────────────
// Each block below was emptied in turn and `pnpm --filter @workspace/medlib
// run typecheck` was re-run. Every block was still required at the
// following installed versions:
//
//   - react-native-svg@15.12.1   — `Shape<P> extends Component<P>` (and
//     `Defs`, `Stop`, `Fe*` helpers) still single-arg → Svg/G/Circle/Rect/
//     Path/Line/Polygon/Polyline/Ellipse/Text all fail TS2786 without shim.
//   - expo-blur@15.0.8           — `BlurView extends React.Component<BlurViewProps>`.
//   - expo-video@3.0.16          — `VideoView extends PureComponent<VideoViewProps>`
//     (single-arg PureComponent inherits the same hole because it extends
//     `Component<P, S, SS>` from a 2-arg class declaration).
//   - expo-image@3.0.11          — `Image extends React.PureComponent<ImageProps>`
//     (same PureComponent issue as expo-video).
//   - react-native-webview@13.16.1 — `WebView<P = {}> extends Component<WebViewProps & P>`.
//   - expo-router@6.0.23         — `NativeTabsProps extends PropsWithChildren`
//     (no type arg) still drops `children`.
//
// Re-verify by removing each `declare module` block individually and running
// the medlib typecheck. Once a block can be removed cleanly, delete it and
// note here which upstream version fixed it. When every block is gone, delete
// this file and the `types/` reference in `tsconfig.json`.

import type * as React from "react";

declare module "react-native-svg" {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Svg extends React.Component<SvgProps, {}> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Circle extends React.Component<CircleProps, {}> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Rect extends React.Component<RectProps, {}> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Path extends React.Component<PathProps, {}> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Line extends React.Component<LineProps, {}> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Polygon extends React.Component<PolygonProps, {}> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Polyline extends React.Component<PolylineProps, {}> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Ellipse extends React.Component<EllipseProps, {}> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Text extends React.Component<TextProps, {}> {}
  // `G` is generic over an additional prop bag in upstream types.
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface G<P = {}> extends React.Component<GProps & P, {}> {}
}

declare module "expo-blur" {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface BlurView extends React.Component<BlurViewProps, {}> {}
}

declare module "expo-video" {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface VideoView extends React.Component<VideoViewProps, {}> {}
}

declare module "expo-image" {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Image extends React.Component<ImageProps, {}> {}
}

declare module "react-native-webview" {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface WebView<P = {}> extends React.Component<WebViewProps & P, {}> {}
}

// `expo-router`'s `NativeTabsProps` declares `extends PropsWithChildren` with
// no type argument. Under React 19's stricter types, `PropsWithChildren<unknown>`
// expands to `unknown & { children?: ReactNode }`; TypeScript cannot inherit
// properties from `unknown`, so the `children` prop disappears from the
// resolved interface. Re-add it via module augmentation so that
// `<NativeTabs>...</NativeTabs>` type-checks.
declare module "expo-router/build/native-tabs/NativeBottomTabs/types" {
  interface NativeTabsProps {
    children?: React.ReactNode;
  }
}
