---
title: 'Lume: a sixty-second daily glow coach'
shortTitle: 'Lume: sixty-second glow coach'
client: 'Own product · lumenow.app'
summary: 'One photo in the same light each morning, a glow score across four measures, and a sixty-second ritual. Photos are processed on the phone and never uploaded.'
category: 'development'
platforms: ['iOS', 'iPhone Duo']
stack: ['SwiftUI', 'Camera', 'On-device image analysis', 'StoreKit 2']
year: 2026
featured: false
source: 'personal'
links:
  live: 'https://lumenow.app'
cover: '/showcase/lume-site.jpg'
hidden: true
placeholder: false
published: 2026-09-18
updated: 2026-09-20
---

## An AI experiment

Lume is the second of two apps built to test how much of a product AI can produce when a human directs it. About 95 percent of the strategy, screens, Swift code and launch kit came from Claude and Grok; I set the constraints, tested on device and decided what shipped. Lume is coming soon; the process is on the [AI/Projects page](/apps/).

## The idea

Skincare apps either try to be a dermatologist or a shop. Lume is neither. It's a coach with a camera: one photo, a score for glow, evenness, texture and calm, and a ritual short enough that you'll actually finish it. Rinse, press, seal, SPF. Morning and evening, sixty seconds each.

On the iPhone Duo the face stays on one screen and the ritual on the other, like a book. On a regular iPhone the photo sits above the scores.

## What got built

- The SwiftUI app with a guided same-window, same-hour capture flow, an on-device scoring pass, a fourteen-day trend view and share cards for the days that look different.
- A privacy model that keeps the product honest: the picture is never uploaded, and any coaching copy is generated from scores and tapped answers rather than from stored images.
- A StoreKit 2 subscription with a seven-day free trial and clear "not a medical device" framing throughout the app and the listing.
- The marketing site, App Store listing, social kit and launch plan, including the Duo-specific positioning.

## Status

In development. The landing page collects early-access requests and switches to the App Store button the moment the listing goes live.
