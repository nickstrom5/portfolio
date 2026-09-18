---
title: 'Lume: a sixty-second daily glow coach'
client: 'Own product · lumenow.app'
summary: 'Take one photo in the same light each morning, get a glow score across four measures, and do a sixty-second morning and evening ritual. Photos are processed on the phone and never uploaded.'
category: 'mobile'
platforms: ['iOS', 'iPhone Duo']
stack: ['SwiftUI', 'Camera', 'On-device image analysis', 'StoreKit 2']
year: 2026
featured: false
source: 'personal'
links:
  live: 'https://lumenow.app'
placeholder: false
---

## The idea

Skincare apps either try to be a dermatologist or a shop. Lume is neither. It's a coach with a camera: one photo, a score for glow, evenness, texture and calm, and a ritual short enough that you'll actually finish it. Rinse, press, seal, SPF. Morning and evening, sixty seconds each.

On the iPhone Duo the face stays on one screen and the ritual on the other, like a book. On a regular iPhone the photo sits above the scores.

## What I built

- The SwiftUI app with a guided same-window, same-hour capture flow, an on-device scoring pass, a fourteen-day trend view and share cards for the days that look different.
- A privacy model that keeps the product honest: the picture is never uploaded, and any coaching copy is generated from scores and tapped answers rather than from stored images.
- A StoreKit 2 subscription with a seven-day free trial and clear "not a medical device" framing throughout the app and the listing.
- The marketing site, App Store listing, social kit and launch plan, including the Duo-specific positioning.

## Status

Pre-launch. The landing page collects early-access requests and switches to the App Store button the moment the listing goes live.
