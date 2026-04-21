# Screenshot specs

You'll need to take real screenshots from your devices (or the simulator). Required sizes for each store:

## App Store (one set is enough — Apple scales for smaller devices)

Take **6.9-inch iPhone screenshots** (iPhone 16 Pro Max simulator works):
- Resolution: **1320 × 2868** portrait
- Required: 3-10 screenshots
- Format: PNG or JPEG, sRGB

Bonus: a 13-inch iPad Pro set if you want iPad Discoverability:
- Resolution: **2064 × 2752** portrait
- Required: at least 3

## Play Store

Phone screenshots:
- Resolution: between **1080 × 1920** and **1440 × 2960** portrait
- Required: 2-8 screenshots
- Format: PNG or JPEG, max 8 MB each

Plus a **feature graphic**:
- Resolution: **1024 × 500** PNG/JPEG, no transparency
- Used at the top of the Play listing

Plus the **app icon** at **512 × 512** PNG (already produced by `npm run native:assets` → re-export from `public/icon-512.svg` if needed).

## Suggested shots (for both stores)

1. **Sign-in screen** — first impression, brand
2. **Recording screen mid-ride** — live stats + map line, the core experience
3. **Ride summary** — completed ride: stats grid + speed graph + map
4. **Share card** — the 1080×1620 export image, mocked into a phone
5. **History list** — multiple rides
6. **Profile** — bike management + totals
7. **Privacy/permissions screen** — optional, shows you take privacy seriously

## How to capture cleanly

- Sign into a demo Google account (the same one you'll give the App Store reviewer)
- Pre-seed 2-3 demo rides via the dev seed (`window.__seedDemoRide?.()` in the browser console — see `src/features/storage/demoRide.ts`)
- iOS simulator: **File → Save Screen** (⌘S)
- Android emulator: camera icon in the toolbar
- Strip the status bar with [`xcrun simctl status_bar`](https://developer.apple.com/library/archive/documentation/IDEs/Conceptual/iOSSimulator_TechRef/Articles/CommandLineUtilities.html) for clean clock/battery if you want
