---
title: 'Clam: a fold-to-focus app blocker for iPhone'
client: 'Own product · getclam.app'
summary: "One-tap screen-time blocker built on Apple's Screen Time API, with a Live Activity countdown, a branded block screen, streaks and a hard paywall. No account, no backend, nothing leaves the phone."
category: 'mobile'
platforms: ['iOS', 'iPhone Duo']
stack: ['SwiftUI', 'FamilyControls', 'ManagedSettings', 'DeviceActivity', 'ActivityKit', 'StoreKit 2', 'App Intents']
year: 2026
featured: false
source: 'personal'
links:
  live: 'https://getclam.app'
placeholder: false
---

## The idea

Most app blockers make you set up schedules and then let you skip them. Clam has one button. Pick the apps that steal your time once, tap "Clam up", choose 25, 50 or 90 minutes, and close your phone. Open Instagram before the timer ends and you get a block screen instead of a feed. Quitting early takes a ten-second hold and resets your streak.

It's designed around the iPhone Duo, where the countdown sits on the outer display while the phone is folded, but it works identically on every iPhone through the lock screen and Dynamic Island.

## What I built

- The SwiftUI app: a nine-step onboarding that sells the habit before the paywall, a StoreKit 2 subscription flow with a lifetime option, the home screen, active session, result and share card, settings, and a Siri and Action Button intent.
- A Shield Configuration extension for the branded block screen, a Device Activity monitor that clears the shield when a session ends even if the app was killed, and a Live Activity plus Home Screen widget.
- Real blocking through Apple's Screen Time entitlement rather than a Shortcut you can bypass, with everything stored in an App Group and no server anywhere.
- Records and badges for personal bests and streaks, with Game Center planned for leaderboards so social features never require an account.
- The launch kit: App Store listing, entitlement request, screenshots plan, landing page and legal pages on GitHub Pages, and a creator outreach plan.

## Status

Built and in review for the Family Controls entitlement, with the App Store launch timed to the iPhone Duo release. Free for seven days, then a yearly, monthly or lifetime purchase.
