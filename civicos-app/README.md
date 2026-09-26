# CivicOS

One dashboard for 29 Federal (Government of Canada), Provincial (Ontario) and Municipal (City of Ottawa) services, with:

- **Cross-tier natural-language search**: "lost wallet" or "starting a business" builds a checklist spanning all three levels of government.
- **Dynamic application wizard**: each service has its own 3-step questionnaire (details → verification → review), validation, and a downloadable review packet.
- **Live Ottawa waste lookup**: geocodes an address with OpenStreetMap Nominatim, then queries the City of Ottawa's open-data collection-day layer.
- **Benefit calculators**: CCB, GST/HST credit (Canada Groceries and Essentials Benefit), OSAP, Canadian Dental Care Plan, ODSP and Ontario Works asset screens, using 2026–27 parameters.
- **ElevenLabs voice companion**: "Explain to citizen" plain-language audio briefings with a live waveform. Falls back to the browser voice when no API key is configured.

## Run it

```bash
npm install
cp .env.example .env.local   # then add your ElevenLabs key (optional)
npm run dev
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with the `/api/tts` ElevenLabs proxy |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serves the build, still with the `/api/tts` proxy |
| `npm run lint` | oxlint |

### Environment

Set these in `.env.local` (git-ignored). They're read only by the dev/preview server and are **never bundled into the browser**.

| Variable | Default |
|---|---|
| `ELEVENLABS_API_KEY` | none (browser voice fallback) |
| `ELEVENLABS_VOICE_ID` | `JBFqnCBsd6RMkjVDRZzb` |
| `ELEVENLABS_MODEL_ID` | `eleven_multilingual_v2` |

`.env.example` is committed, so never put real keys in it.

## Structure

```
server/
  elevenLabsProxy.js         Vite middleware: /api/tts -> ElevenLabs (keeps the key server-side)
src/
  App.jsx                    Page composition and top-level state
  components/
    common/                  Header, NotificationBanner, SearchBar, TierTabs, TierBadge, EmptyState
    dashboard/               ServiceCard, ServicesGrid, LifeEventChecklist, CivicAlertsSidebar
    wizard/                  DynamicModalWizard, StepIndicator, FieldRenderer, ReviewSummary,
                             EstimateCard, WasteLookupField, GeotagField
    voice/                   ElevenLabsVoiceAssistant, Waveform, useSpeechPlayer
  data/
    servicesData.js          Service catalog + per-service form schemas
    fieldBuilders.js         Field factories, patterns and validators (SIN Luhn, postal code, VIN…)
    lifeEvents.js            Cross-tier journeys used by search
    alerts.js                Banner and sidebar notices
  services/api/
    ottawaWasteApi.js        Nominatim + City of Ottawa ArcGIS collection-day lookup
    geocoding.js             Nominatim client (Ottawa-bounded, 1 req/s)
    benefitCalculators.js    CCB, CGEB, OSAP, CDCP, ODSP/OW, OAS engines
    elevenLabsClient.js      /api/tts client with per-service audio cache
  lib/                       validation, formatting, search, screeners, reviewPacket
  hooks/useDialogBehavior.js Escape/scroll-lock/focus handling for stacked dialogs
  styles/                    Plain CSS split by concern; index.css is the entry point
```

### Adding a service

Add an entry to `SERVICES` in `src/data/servicesData.js` with a `form.primary` and `form.verification` field list built from `fieldBuilders.js`. The wizard, review step, packet download, search and voice briefing all pick it up automatically. Reference its `id` from `lifeEvents.js` to include it in journeys.

## Data notes

- Benefit parameters are for **July 2026 – June 2027** (2025 tax year) and are cited in `benefitCalculators.js`. Update them each July.
- The OSAP estimator is a simplified model with labelled assumptions; only the 25% grant cap reflects published 2026–27 policy.
- The waste lookup returns the real collection day, zone and A/B schedule. The exact blue/black bin week isn't in the open data layer, so the UI links to the City calendar.
- Property tax payments and submissions are simulated; nothing is sent to any government system.
