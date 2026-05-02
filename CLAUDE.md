# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# OpStap

## Wat is OpStap?

OpStap is een kaartgebaseerde sociale app voor studenten en jonge werkenden (18-35) in Groningen. De kaart IS de app. Je opent de app en ziet Groningen voor je met alle kroegen en clubs. Vandaar uit doe je alles.

**Kernprobleem dat we oplossen:** Je wil vanavond uit maar je vrienden kunnen niet. Je wil niet alleen gaan. OpStap laat je een event aanmaken, anderen goedkeuren en samen de stad in gaan.

**Geografische focus:** Groningen. Bewust klein starten.

---

## Tech Stack

| Onderdeel | Keuze |
|---|---|
| App framework | React Native met Expo |
| Schermnavigatie | Expo Router |
| State management | Zustand |
| Kaart | Mapbox SDK |
| Backend | Supabase |
| Database | PostgreSQL via Supabase + PostGIS |
| Auth | Supabase Auth via SMS |
| Opslag | Supabase Storage |
| Chat | Stream Chat met React Native SDK |
| Push notificaties | Expo Notifications |
| Admin tool | Next.js (aparte repo) |

---

## Commands

```bash
# Ontwikkeling
npx expo start               # Start development server
npx expo start --ios         # Start op iOS simulator
npx expo start --android     # Start op Android emulator

# Linting en formatting
npx eslint .                 # Lint alle bestanden
npx prettier --write .       # Formateer alle bestanden

# Tests
npx jest                     # Alle tests
npx jest --testPathPattern=auth  # Specifieke test suite

# Supabase types genereren na schema wijzigingen
npx supabase gen types typescript --project-id <project-id> > types/supabase.ts

# Supabase lokaal draaien
npx supabase start           # Start lokale Supabase instantie
npx supabase db reset        # Reset lokale database met migrations
```

---

## Projectstructuur

```
opstap/
  app/
    (auth)/               # Registratie en inloggen
      register.tsx
      verify.tsx
    (tabs)/               # Hoofdnavigatie
      kaart.tsx           # Hoofdscherm: kaart met venues
      events.tsx          # Event overzicht
      profiel.tsx         # Eigen profiel
    event/
      [id].tsx            # Event detail
      aanmaken.tsx        # Event aanmaken
    venue/
      [id].tsx            # Venue detail
  components/             # Herbruikbare componenten
  hooks/                  # Custom React hooks
  services/
    supabase.ts           # Supabase client
    stream.ts             # Stream Chat client
  stores/                 # Zustand state stores
  types/
    supabase.ts           # Automatisch gegenereerde Supabase types
    index.ts              # Overige types
  utils/                  # Hulpfuncties
```

---

## Database Schema

### profiles
```sql
profiles
  id              uuid          primary key (refs auth.users)
  name            text          not null
  avatar_url      text
  age             integer
  bio             text
  trust_score     numeric       default 5.0
  created_at      timestamp     default now()
```

### user_interests
```sql
user_interests
  id              uuid          primary key
  user_id         uuid          refs profiles
  interest        text          not null
```

### venues
```sql
venues
  id              uuid          primary key
  name            text          not null
  address         text          not null
  lat             numeric       not null
  lng             numeric       not null
  location        geography     -- PostGIS kolom voor locatie queries
  type            text          (bar, club, pub, cafe)
  opening_hours   jsonb
  description     text
  photo_url       text
  active          boolean       default true
  created_at      timestamp     default now()
```

### user_favorites
```sql
user_favorites
  id              uuid          primary key
  user_id         uuid          refs profiles
  venue_id        uuid          refs venues
  created_at      timestamp     default now()
```

### events
```sql
events
  id              uuid          primary key
  creator_id      uuid          refs profiles
  venue_id        uuid          refs venues (nullable)
  title           text          not null
  description     text
  starts_at       timestamp     not null
  max_attendees   integer
  status          text          (active, cancelled, finished)
  created_at      timestamp     default now()
```

### event_registrations
```sql
event_registrations
  id              uuid          primary key
  event_id        uuid          refs events
  user_id         uuid          refs profiles
  status          text          (pending, approved, rejected)
  created_at      timestamp     default now()
```

### attendance
```sql
attendance
  id              uuid          primary key
  event_id        uuid          refs events
  user_id         uuid          refs profiles
  showed_up       boolean
  reported        boolean       default false
  created_at      timestamp     default now()
```

### night_venues
```sql
night_venues
  id              uuid          primary key
  event_id        uuid          refs events
  venue_id        uuid          refs venues
  order           integer
  created_at      timestamp     default now()
```

### night_photos
```sql
night_photos
  id              uuid          primary key
  event_id        uuid          refs events
  user_id         uuid          refs profiles
  photo_url       text          not null
  created_at      timestamp     default now()
```

---

## Code Kwaliteit

### TypeScript
- Volledig TypeScript, geen .js bestanden
- Strict mode aan in tsconfig.json
- Nooit `any` gebruiken
- Types altijd genereren via Supabase CLI na schema wijzigingen:
```bash
npx supabase gen types typescript --project-id jouw-project-id > types/supabase.ts
```

### Linting en formatting
- ESLint met Expo config als basis
- Prettier voor automatische opmaak
- Husky pre-commit hook zodat rommelige code er nooit in komt

### Git
- Nooit direct op `main` of `develop` committen
- Branch structuur:
  - `main` — altijd werkende, stabiele code. Alleen merges vanuit `develop`.
  - `develop` — integratiebranch voor lopende ontwikkeling
  - `feature/naam` — nieuwe functionaliteit, altijd vanuit `develop`
  - `fix/naam` — bugfixes, altijd vanuit `develop`
- Workflow:
  1. Branch altijd vanuit `develop`: `git checkout -b feature/naam`
  2. Werk op de feature branch en commit daar
  3. Als klaar en getest: merge terug naar `develop`
  4. Alleen stabiele, geteste versies gaan van `develop` naar `main`
- Conventional Commits:
  - `feat: event aanmaken scherm toegevoegd`
  - `fix: groepschat melding werkte niet op Android`
  - `chore: Supabase types bijgewerkt`

### Testen
- Jest voor unit tests
- React Native Testing Library voor component tests
- Alleen kritieke bedrijfslogica testen:
  - Authenticatie flow
  - Event aanmaken en goedkeuren
  - Trust score berekening
  - Locatie queries
- Elke bugfix krijgt een test zodat die bug nooit terugkomt

---

## Kernfuncties MVP

### Registratie en profiel
- Registratie via telefoonnummer (Supabase Auth SMS)
- Profiel: naam, foto, leeftijd, interesses, favoriete venues
- Trust score op basis van opkomst bij events

### De kaart
- Mapbox kaart van Groningen als hoofdscherm
- Alle venues als pins op de kaart
- Uitroepteken op pin als er vanavond een actief event is
- Venue detailpagina: naam, adres, openingstijden, type

### Events
- Event aanmaken vanuit een venue op de kaart
- Openbaar zichtbaar voor alle gebruikers
- Maker keurt aanmeldingen goed of af op basis van profiel
- Max aantal deelnemers instelbaar

### Groepschat
- Automatische groepschat via Stream Chat na goedkeuring
- Alle goedgekeurde deelnemers in dezelfde chat

### Avond terugblik
- Groep stemt achteraf welke venues bezocht zijn
- Pushmelding volgende ochtend met overzicht
- Foto's delen via Supabase Storage
- Persoonlijke avondgeschiedenis per gebruiker

### Veiligheid
- Telefoonnummer verificatie bij registratie
- Opkomst check na event
- Rapportage functie voor no-shows en misbruik
- Trust score daalt bij no-shows

---

## Niet in de MVP

- Premium abonnement
- ID verificatie
- Zakelijke accounts voor horecazaken
- Aanbevelingsalgoritme
- Publiek delen van avondgeschiedenis
- Drukte indicator op de kaart

---

## Belangrijke afspraken

- Alle locatiedata opslaan in eigen database, niet elke keer via Mapbox API ophalen
- Foto's comprimeren in de app voor upload om opslagkosten laag te houden
- EU hosting via Supabase voor GDPR compliance
- Supabase Realtime gebruiken voor live event updates op de kaart
- Stream Chat voor groepschat, niet zelf bouwen

---

## Architectuurpatronen

- **Navigatie**: Expo Router met file-based routing. `(auth)/` en `(tabs)/` zijn route groups (beïnvloeden URL-structuur niet). Dynamic routes als `event/[id].tsx` en `venue/[id].tsx`.
- **State**: Zustand stores in `stores/`. Server state (Supabase queries) niet in Zustand opslaan — gebruik React state of hooks met directe Supabase calls.
- **Services**: `services/supabase.ts` exporteert één geconfigureerde client; `services/stream.ts` doet hetzelfde voor Stream Chat. Gebruik deze singletons overal, maak geen nieuwe clients aan.
- **Types**: `types/supabase.ts` is gegenereerd door de CLI en nooit handmatig aanpassen. Eigen types staan in `types/index.ts`.
- **Locatiedata**: Venues hebben zowel `lat`/`lng` (voor app gebruik) als een PostGIS `location` kolom (voor proximity queries). Bij nieuwe venue inserts altijd beide vullen.
- **Trust score**: Staat op het `profiles` record en wordt aangepast via attendance records na een event. Niet direct aanpassen vanuit de client — dit loopt via Supabase database functies.
- **Stream Chat kanalen**: Worden aangemaakt wanneer een event_registration wordt goedgekeurd. Kanaal ID = `event-{event_id}`.

---

## Omgevingsvariabelen

Zet deze in `.env.local` en nooit committen naar Git:

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_MAPBOX_TOKEN=
EXPO_PUBLIC_STREAM_API_KEY=
```