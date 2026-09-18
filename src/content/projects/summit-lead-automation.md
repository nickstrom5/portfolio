---
title: 'Summit lead routing automation'
client: 'Summit Real Estate'
summary: 'Python service that scores inbound leads, routes them to agents by territory and syncs everything back to the CRM.'
category: 'automation'
platforms: ['Web', 'Backend']
stack: ['Python', 'FastAPI', 'PostgreSQL', 'HubSpot API', 'AWS Lambda']
year: 2023
featured: false
source: 'upwork'
links: {}
placeholder: true
---

## The problem

Leads from six sources landed in a shared inbox and were assigned by hand. Fast responders won deals; slow ones lost them.

## What I built

- A FastAPI service that ingests leads via webhooks, deduplicates them and scores them by source, budget and location.
- Territory-based round-robin routing with SMS alerts to the assigned agent.
- Two-way sync with HubSpot so agents keep working in the tool they know.

## Outcome

Median response time went from hours to minutes, and the brokerage stopped losing leads to inbox drift.
