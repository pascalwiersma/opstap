# OpStap - CLAUDE.md

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
- Nooit direct op `main` committen
- Branch structuur:
  - `main` — altijd werkende code
  - `develop` — lopende ontwikkeling
  - `feature/naam` — nieuwe functionaliteit
  - `fix/naam` — bugfixes
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

## Omgevingsvariabelen

Zet deze in `.env.local` en nooit committen naar Git:

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_MAPBOX_TOKEN=
EXPO_PUBLIC_STREAM_API_KEY=
```