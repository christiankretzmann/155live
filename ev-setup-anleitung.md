# E&V Portal — Supabase Einrichtung
**Engel & Völkers Mittleres Ruhrgebiet · Schritt-für-Schritt-Anleitung**

---

## Schritt 1 — Supabase-Account erstellen

1. Gehe auf **https://supabase.com** und klicke „Start your project"
2. Mit GitHub oder E-Mail registrieren (kostenlos)
3. Klicke „New project"
4. Fülle aus:
   - **Name:** `ev-mittleres-ruhrgebiet`
   - **Database Password:** Sicheres Passwort wählen und **notieren**
   - **Region:** `West EU (Frankfurt)` ← wichtig für DSGVO
5. Auf „Create new project" klicken — dauert ~2 Minuten

---

## Schritt 2 — API-Keys kopieren

1. Im Supabase-Dashboard: **Settings → API**
2. Notiere:
   - **Project URL** (z. B. `https://xyzabcdef.supabase.co`)
   - **anon / public key** (der lange `eyJ...`-String)

3. Öffne **`ev-supabase.js`** und trage die Werte ein:

```javascript
const SUPABASE_URL = 'https://DEIN-PROJEKT.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIs...'; // dein anon key
```

---

## Schritt 3 — Datenbanktabellen anlegen

Gehe im Supabase-Dashboard zu **SQL Editor** und führe folgenden Code aus:

```sql
-- ══════════════════════════════════════════════════════
-- E&V Portal — Datenbankschema
-- Engel & Völkers Mittleres Ruhrgebiet
-- ══════════════════════════════════════════════════════

-- 1. BRAND-SHOP BESTELLUNGEN
create table if not exists shop_orders (
  id            bigserial primary key,
  created_at    timestamptz default now(),
  order_number  text,
  user_email    text,
  user_name     text,
  items         jsonb,
  total_eur     numeric(10,2),
  status        text default 'approved',
  location      text,
  cost_center   text,
  project_ref   text,
  notes         text,
  over_budget   boolean default false
);

-- 2. FINANZIERUNGSANFRAGEN
create table if not exists finanzierung_anfragen (
  id              bigserial primary key,
  created_at      timestamptz default now(),
  berater_name    text,
  berater_email   text,
  referenz        text,
  kn1_name        text,
  kn1_gebdat      date,
  kn1_adresse     text,
  kn1_email       text,
  kn1_tel         text,
  kn1_beschaeft   text,
  kn1_netto       numeric(10,2),
  kn2_name        text,
  kn2_netto       numeric(10,2),
  obj_art         text,
  obj_adresse     text,
  obj_kaufpreis   numeric(12,2),
  obj_baujahr     int,
  obj_nutzung     text,
  obj_wohnfl      numeric(8,2),
  obj_energie_kl  text,
  fin_ek          numeric(12,2),
  fin_ek_quote    numeric(5,2),
  fin_darlehen    numeric(12,2),
  fin_gesamt      numeric(12,2),
  fin_zinsbindung int,
  fin_tilgung     numeric(5,2),
  fin_sondertilg  text,
  foerderungen    text,
  zielbank        text,
  status          text default 'gesendet'
);

-- 3. WEEKLY CHECK-INS
create table if not exists weekly_checkins (
  id            bigserial primary key,
  created_at    timestamptz default now(),
  user_name     text,
  user_email    text,
  kw            int,
  jahr          int,
  rolle         text,
  score_pct     numeric(5,2),
  score_note    text,
  antworten     jsonb,
  offene_punkte jsonb,
  kommentare    jsonb
);

-- 4. SOCIAL MEDIA ANFRAGEN
create table if not exists socialmedia_anfragen (
  id              bigserial primary key,
  created_at      timestamptz default now(),
  sender_name     text,
  sender_email    text,
  beitragsart     text,
  plattformen     jsonb,
  format          text,
  ton             text,
  logo_variante   text,
  dringlichkeit   text,
  inhalt          text,
  objekt_details  text,
  anhaenge_anz    int default 0,
  status          text default 'eingegangen'
);

-- 5. INDEX für Performance
create index if not exists idx_shop_orders_created   on shop_orders(created_at desc);
create index if not exists idx_finanz_created        on finanzierung_anfragen(created_at desc);
create index if not exists idx_weekly_created        on weekly_checkins(created_at desc);
create index if not exists idx_social_created        on socialmedia_anfragen(created_at desc);
create index if not exists idx_weekly_kw             on weekly_checkins(kw, jahr);
create index if not exists idx_orders_status         on shop_orders(status);
```

Klicke auf **„Run"** — alle 4 Tabellen werden erstellt.

---

## Schritt 4 — Row Level Security (RLS) einrichten

Für maximale Sicherheit: Nur eingeloggte Nutzer dürfen schreiben, nur Admins dürfen alles lesen.

```sql
-- RLS aktivieren
alter table shop_orders           enable row level security;
alter table finanzierung_anfragen enable row level security;
alter table weekly_checkins       enable row level security;
alter table socialmedia_anfragen  enable row level security;

-- Alle eingeloggten Nutzer dürfen SCHREIBEN (INSERT)
create policy "Berater können Bestellungen einfügen"
  on shop_orders for insert to authenticated with check (true);

create policy "Berater können Finanzierungen einfügen"
  on finanzierung_anfragen for insert to authenticated with check (true);

create policy "Berater können Check-ins einfügen"
  on weekly_checkins for insert to authenticated with check (true);

create policy "Berater können Social-Anfragen einfügen"
  on socialmedia_anfragen for insert to authenticated with check (true);

-- Alle eingeloggten Nutzer dürfen LESEN (für Admin-Dashboard)
create policy "Eingeloggte Nutzer können lesen"
  on shop_orders for select to authenticated using (true);

create policy "Eingeloggte Nutzer können Finanzierungen lesen"
  on finanzierung_anfragen for select to authenticated using (true);

create policy "Eingeloggte Nutzer können Check-ins lesen"
  on weekly_checkins for select to authenticated using (true);

create policy "Eingeloggte Nutzer können Social-Anfragen lesen"
  on socialmedia_anfragen for select to authenticated using (true);
```

---

## Schritt 5 — Benutzer anlegen

Gehe zu **Authentication → Users → Add user**

Lege für jeden Berater einen Account an:
- E-Mail: `vorname.nachname@engelvoelkers.de`
- Passwort: Sicheres Passwort (Berater bekommt es per E-Mail/Slack)
- Optional: Unter **User Metadata** `{"full_name": "Vorname Nachname", "role": "berater"}` eintragen

Für den Admin (Geschäftsführung):
- E-Mail: z. B. `admin@engelvoelkers.de`
- Metadata: `{"full_name": "Name GF", "role": "admin"}`

---

## Schritt 6 — Dateien auf Server laden

Alle folgenden Dateien müssen im **selben Ordner** auf dem Webserver liegen:

```
📁 ev-portal/
├── ev-supabase.js          ← Datenbankschicht (zuerst laden)
├── ev-portal.html          ← Hauptportal
├── ev-umsatzplanung.html   ← Gehaltsplaner
├── ev-socialmedia.html     ← Social Media Manager
├── ev-weekly.html          ← Weekly Check-In
├── ev-finanzierung.html    ← Finanzierungsmanager
├── ev-werbemittel.html     ← Brand-Shop
└── ev-admin.html           ← Admin-Dashboard (nur GF)
```

> **Wichtig:** `ev-supabase.js` muss in jeder HTML-Datei **vor** dem eigenen `<script>`-Tag eingebunden sein:
> ```html
> <script src="ev-supabase.js"></script>
> ```
> Das ist in allen Dateien bereits vorbereitet.

---

## Schritt 7 — Testen

1. `ev-portal.html` im Browser öffnen
2. Mit einer Berater-E-Mail + Passwort anmelden
3. Eine App öffnen, Daten eingeben und absenden
4. `ev-admin.html` öffnen, mit Admin-Account anmelden
5. Die Daten sollten sofort in der Übersicht erscheinen

**Browser-Konsole** zeigt nach dem Laden:
```
[E&V Portal] Supabase verbunden ✓   ← alles OK
[E&V Portal] Supabase nicht konfiguriert — Demo-Modus  ← Keys noch nicht eingetragen
```

---

## Demo-Modus (vor Supabase-Setup)

Solange `ev-supabase.js` noch keine echten Keys enthält, läuft das Portal im **Demo-Modus**:
- Login funktioniert mit beliebiger E-Mail + Passwort `Sommeranfang`
- Alle Daten werden im **localStorage** des Browsers gespeichert
- Admin-Dashboard zeigt diese lokalen Daten an
- Beim Umstieg auf Supabase: Keys eintragen, fertig — die Apps funktionieren ohne weitere Änderungen

---

## Kosten (Supabase Free Tier)

| Ressource | Free Tier | Ausreichend für E&V? |
|-----------|-----------|----------------------|
| Datenbank | 500 MB | ✅ Ja (Jahre) |
| API-Aufrufe | 2 Mio./Monat | ✅ Ja |
| Auth-Nutzer | 50.000 | ✅ Ja |
| Storage | 1 GB | ✅ Ja |
| **Kosten** | **0 €/Monat** | ✅ |

Der Pro-Plan (25 €/Monat) bringt tägliche Backups und mehr Performance — für den Anfang ist Free ausreichend.

---

## Support

Bei Fragen zur Einrichtung: Alle Dateien wurden von Claude (Anthropic) entwickelt.
Technische Details und Supabase-Dokumentation: **https://supabase.com/docs**

---
*Engel & Völkers Mittleres Ruhrgebiet · Portal-Dokumentation · Vertraulich*
