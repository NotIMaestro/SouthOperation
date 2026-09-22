# Mock package QR workflow

Implemented on `codex/local-development`. These changes are intentionally uncommitted; no push or destructive Git operation was performed.

## Project inspection and design

- Frontend: Next.js 16.3.5 App Router, React 19, TypeScript, server-rendered page shells with client components for browser interactions.
- Backend: an independent Hono service with existing Neon/Drizzle integration. No database is needed for this prototype; existing backend functionality is unchanged.
- Styling: the existing CSS variables, panels, buttons, green palette and responsive layout. Tailwind is installed, but there is no component library. New pages use English labels and a local `dir="ltr"` boundary within the existing Hebrew/RTL app.
- Icons: existing Lucide React.
- State: component-local React state and refs; no new global state library.
- Navigation: the existing server-side `AppShell` now uses a small client `NavigationLink` for active states. A native mobile menu exposes the existing and new routes. The generator is labeled Development / Demo.
- Access: both new routes use the existing authenticated proxy matcher. No new authentication bypass was added.
- Testing: existing Vitest and React Testing Library, with jsdom only for component tests.
- Package manager: pnpm 11.19.0. There was no QR dependency and no configured formatter.

## Libraries and installation

The added runtime dependencies are `qrcode` 1.5.4 (PNG generation) and `qr-scanner` 1.4.2 (camera-frame and uploaded-image decoding). The added development dependency is `@types/qrcode` 1.5.6. Existing Lucide and Zod are reused.

```powershell
pnpm --filter @south-operation/client add qrcode qr-scanner
pnpm --filter @south-operation/client add -D @types/qrcode
```

Both commands completed successfully and updated the workspace lockfile. On another checkout, use `pnpm install --frozen-lockfile`.

Library documentation: [qrcode](https://github.com/soldair/node-qrcode), [qr-scanner](https://github.com/nimiq/qr-scanner).

## Data and replacement boundary

The static JSON is `client/src/lib/packages/mock-packages.json`. It contains ten explicitly fictional packages, numbered `100001` through `100010`, covering all six statuses.

Components call `client/src/lib/packages/service.ts`. They never import or search the JSON. The service implements the asynchronous `PackageService` contract in `types.ts`:

- `findPackageByQrToken(token)`
- `findPackageByPackageNumber(number)`
- `getAllPackages()`
- `generatePackage(draft)`
- `resetGeneratedPackages()`

Replace the service adapter with HTTP calls when a real package API is available; the scanning page and result card can remain unchanged. Lookups and writes currently have a 350 ms delay.

Generated records use `localStorage`, under `south-operation.demo-packages.v1`, and are searched before the static JSON. Storage is scoped to the browser profile and exact origin: `localhost` and `127.0.0.1`, different ports, HTTP and HTTPS have separate stores. Records are not shared between phones or computers. Reloading the same origin preserves them; clearing site data or resetting the demo removes them.

Generation uses `crypto.randomUUID()` and `crypto.getRandomValues()`. All three identifiers are checked against both sources, with up to 40 regeneration attempts. Browser Web Locks serialize changes across tabs where supported; the synchronous fallback guarantees uniqueness within the current application session. Stored data is schema-validated on read, including uniqueness; corrupted/blocked/full storage produces a visible error rather than silently losing records. Only the demo storage key is removed by reset. The source JSON is never modified from the browser.

QR payloads contain only the token. Accepted format:

```text
^PKG:[A-Z0-9]{8,32}$
```

Example static token: `PKG:A7F3K9M2`. New tokens use 16 uppercase hexadecimal characters after `PKG:`. Package numbers are six digits, with a nonzero first digit. Inputs are trimmed and validated before lookup; decoded URLs are never followed.

## Run in VS Code

Open this project and use **Terminal → Run Task → Run South Operation**, or open a new VS Code terminal and run:

```powershell
pnpm dev
```

The existing workspace-local VS Code settings put Node and pnpm on the terminal PATH. For an external PowerShell session that does not have them on PATH:

```powershell
$env:Path = 'C:\Program Files\nodejs;C:\projects\SouthOperation\.vscode\tools\node_modules\.bin;' + $env:Path
pnpm dev
```

The app is at `http://localhost:3000`; backend health is `http://127.0.0.1:3001/health`. Sign in using the branch's existing local-development button. Do not launch a second server while the current one is running.

## Test generation and same-device QR upload

1. Open `http://localhost:3000/demo/qr-generator`, or choose **Development / Demo → QR Code Generator** in the navigation. On mobile, open **Menu**.
2. Keep the fictional defaults or enter other fictional values, choose a status, and list contents one per line.
3. Click **Generate Mock Package**. The page shows the complete record, internal ID, package number, raw token, and QR image.
4. Use **Copy Token**, **Copy Number**, **Download PNG**, or **Print Label**. Print CSS displays just the label. Clipboard/download/print feedback appears inline; browser cancellation or silently blocked printing/downloading cannot be reliably detected, so the message describes the operation as requested.
5. Refresh the page. Select the generated record from **Choose a package to render its QR**; its data and label remain available.
6. Go to **Scan Package** (`http://localhost:3000/scan-package`). Click **Upload QR Image** and select the downloaded PNG. PNG, JPEG and WebP are accepted up to 10 MB.
7. Confirm that the package details match the generated record.
8. Click **Enter Another Number**, enter the same package number, and press Enter or click **Search**. Both paths display the same result card.
9. In the generator, **Reset Locally Generated Packages → Confirm Reset** removes generated records only. The original ten samples remain selectable and searchable. This reset is permanent for demo records in that browser.

For a quick manual test, enter `100001` (in transit) or `100006` (issue reported). Use `999999` to check not-found handling, and `abc` to check validation. The generator can render labels for every static sample as well as generated records.

## Test camera scanning

On this computer, open `http://localhost:3000/scan-package`. Click **Open Camera** and allow this site's camera permission. The app requests video only, prefers the rear-facing camera, and displays a live preview. Point it at a printed label or a QR displayed on a second screen. A valid-format QR stops the camera before performing a lookup. Unknown valid tokens produce a not-found message; invalid QR formats keep scanning and show guidance.

Use **Close Camera** to stop, or **Open Camera** to retry. Hiding the tab, navigating away, unmounting, and successful scanning stop every media track. Even a permission grant that arrives after closing the scanner is cleaned up. Decoder workers and timers are released too. The page handles denied permission, missing/unavailable cameras, unsupported/insecure browsers, and decoder failures with manual entry and upload alternatives.

`Permissions-Policy` was changed from `camera=()` to `camera=(self)` so the application's own origin may request camera access. Microphone and location remain disabled. Browser permission is still required.

On a phone, `http://localhost:3000` refers to the phone, not this computer. Opening this computer's LAN IP over plain HTTP does not normally enable camera access. Use a trusted HTTPS development deployment or a separately configured HTTPS development endpoint, and open that HTTPS URL on the phone. A self-signed/untrusted certificate is not an equivalent substitute. No tunnel or deployment was created by this work.

Generated packages are browser-local. To test with a second device, either use a static sample label (present in every browser), or create the generated package on the scanning phone, download its PNG, and display that image on another screen / print it. Scanning a package generated only in a different browser correctly returns not found.

## Verification results

- `pnpm lint`: passed, zero warnings.
- `pnpm typecheck`: passed for server and client. The command now uses the root TypeScript compiler because the previous filtered invocation did not expose `tsc` from the client workspace's TypeScript 7 package.
- `pnpm test`: 43 tests passed across seven test files, including the existing server tests.
- `pnpm build`: passed; both new pages appear in the production route output.
- Formatter: no formatter dependency, configuration or script exists; no formatter was added. Existing source/CSS conventions were followed, and `git diff --check` is used for whitespace validation.
- Service tests cover valid and invalid lookups, unknown identifiers, 25 generated records, collisions across both sources, persistence in a fresh service instance, reset, corrupt storage, and failed writes.
- Camera tests cover track cleanup, late permission completion, cleanup after navigation, valid-code de-duplication, continued scanning of invalid values, playback failure, error messages, component unmount and page hiding.
- UI tests cover manual form submission, validation, image-decoded lookups, unknown tokens, shared result cards, disabled/loading controls, storage-style errors and keyboard focus restoration.
- Real-browser verification: generated a package, rendered its actual PNG, uploaded that PNG through the scanner, and retrieved the same record by manual number with Enter. Verified persistence after refresh, clipboard feedback, PNG download feedback, and demo reset retaining all ten static samples.
- Mobile checks: both pages at a 390 × 844 viewport, no horizontal overflow, navigation opens and closes after selecting a route. Existing dashboard/sample navigation remains available. No browser warning/error entries were reported in the inspected test tab.
- Physical rear-camera behavior and an actual printer were not tested. QR image decoding was tested in the real browser; camera lifetime/error behavior was tested with controlled media and decoder doubles.

## Files changed

Paths below are relative to the repository root.

| File | Purpose |
| --- | --- |
| `client/src/app/(secure)/scan-package/page.tsx` | Scanner page and generator link |
| `client/src/app/(secure)/demo/qr-generator/page.tsx` | Demo generator page |
| `client/src/components/packages/scan-package.tsx` | Camera/manual/upload flows and lookup state |
| `client/src/components/packages/camera-preview.tsx` | Video preview and page lifecycle cleanup |
| `client/src/components/packages/qr-generator.tsx` | Creation, label rendering, download, print, clipboard, reset |
| `client/src/components/packages/package-card.tsx` | Shared full package result card |
| `client/src/lib/packages/types.ts` | Schemas, contract, statuses and error messages |
| `client/src/lib/packages/mock-packages.json` | Ten fictional records |
| `client/src/lib/packages/mock-service.ts` | Async mock storage, lookup, generation and reset |
| `client/src/lib/packages/service.ts` | Replaceable service adapter |
| `client/src/lib/packages/qr.ts` | PNG generation and QR image/frame decoding |
| `client/src/lib/packages/camera.ts` | Media, decoder and timer ownership |
| `client/src/lib/packages/mock-service.test.ts` | Data/service tests |
| `client/src/lib/packages/camera.test.ts` | Camera lifetime tests |
| `client/src/components/packages/camera-preview.test.tsx` | Component lifecycle tests |
| `client/src/components/packages/scan-package.test.tsx` | Lookup UI tests |
| `client/src/components/navigation-link.tsx` | Active state and mobile-menu closing |
| `client/src/components/app-shell.tsx` | Sidebar entries and mobile navigation |
| `client/src/app/globals.css` | Responsive layouts, badges, scanner and print styles |
| `client/src/proxy.ts` | Protect the new routes using existing auth |
| `client/next.config.ts` | Same-origin camera permission policy |
| `client/package.json`, `pnpm-lock.yaml` | QR dependencies and lockfile |
| `package.json` | Repair the existing type-check command |
| `vitest.config.ts` | Point the `@` alias to the actual client source directory |
| `client/src/auth.ts` | Remove an unused callback argument flagged by existing lint rules |
| `docs/mock-package-qr.md` | This setup, architecture and verification guide |
