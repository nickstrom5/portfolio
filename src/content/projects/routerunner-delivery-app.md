---
title: 'RouteRunner: dispatch and proof-of-delivery app'
client: 'Acme Logistics'
summary: 'Cross-platform driver app with offline route sync, signature capture and live ETA sharing, replacing paper manifests for a 120-vehicle fleet.'
category: 'mobile'
platforms: ['iOS', 'Android']
stack: ['React Native', 'TypeScript', 'Node.js', 'Postgres', 'Mapbox']
year: 2025
featured: true
source: 'upwork'
links: {}
placeholder: true
---

## The problem

Acme's drivers were working from printed manifests and calling dispatch for every change. Proof of delivery was a photo texted to a shared phone, and disputes took days to resolve.

## What I built

- A React Native app for iOS and Android with an offline-first queue, so drivers keep working in dead zones and sync when they reconnect.
- Signature and photo capture attached to each stop, uploaded in the background.
- A dispatch dashboard and a Node.js API on Postgres with role-based access for dispatchers, drivers and customers.
- Customer ETA links sent by SMS via Twilio.

## Outcome

Paper manifests were retired within a month of launch. Delivery disputes dropped sharply because every stop now carries a timestamped signature and photo. The client has kept me on a monthly retainer for feature work.
