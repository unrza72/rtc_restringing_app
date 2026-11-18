import type { ReactNode } from 'react'

import { LEGAL } from '#/lib/legal'
import { formatDate } from '#/lib/labels'
import { getLocale } from '#/paraglide/runtime'
import { m } from '#/paraglide/messages'

/**
 * The imprint and the privacy notice. German is the binding text; the English
 * one is a courtesy translation and says so. Both are written out in full
 * here rather than as message keys: legal prose is read as a whole, and
 * splitting it into dozens of keys would only make it harder to review.
 */

function LegalPage({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <article className="mx-auto grid max-w-2xl min-w-0 gap-4 text-sm leading-relaxed wrap-break-word hyphens-auto [&_a]:underline [&_a]:underline-offset-4 [&_dd]:mb-2 [&_dt]:font-semibold [&_dt]:text-foreground [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc">
      <h1 className="text-3xl text-foreground">{title}</h1>
      {getLocale() === 'en' && (
        <p className="text-muted-foreground italic">
          This is a translation for convenience; the German version applies.
        </p>
      )}
      {children}
    </article>
  )
}

/** A detail the club hasn't supplied yet — loud on purpose. */
function Missing({ what }: { what: string }) {
  return (
    <mark className="rounded bg-destructive/15 px-1 text-destructive">
      [{m.legal_missing({ what })}]
    </mark>
  )
}

function Value({ value, what }: { value: string | null; what: string }) {
  return value ? <>{value}</> : <Missing what={what} />
}

function Address() {
  const en = getLocale() === 'en'
  return (
    <>
      {LEGAL.clubName}
      <br />
      <Value value={LEGAL.street} what={en ? 'street' : 'Straße'} />
      <br />
      {LEGAL.postalCode} {LEGAL.town},{' '}
      {en ? LEGAL.country.en : LEGAL.country.de}
    </>
  )
}

function Email() {
  return LEGAL.email ? (
    <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
  ) : (
    <Missing what="E-Mail" />
  )
}

export function Imprint() {
  return getLocale() === 'en' ? <ImprintEn /> : <ImprintDe />
}

function ImprintDe() {
  return (
    <LegalPage title={m.legal_imprint_title()}>
      <p>Informationen gemäß § 5 ECG und Offenlegung gemäß § 25 MedienG.</p>
      <dl>
        <dt>Medieninhaber und Betreiber</dt>
        <dd>
          <Address />
        </dd>
        <dt>ZVR-Zahl</dt>
        <dd>
          <Value value={LEGAL.zvr} what="ZVR-Zahl" />
        </dd>
        <dt>Vereinsbehörde</dt>
        <dd>{LEGAL.registrationAuthority}</dd>
        <dt>Vertreten durch</dt>
        <dd>
          <Value value={LEGAL.representedBy} what="Obfrau / Obmann" />
        </dd>
        <dt>Kontakt</dt>
        <dd>
          <Email />
          {LEGAL.phone && (
            <>
              <br />
              Tel. {LEGAL.phone}
            </>
          )}
        </dd>
        {/*
        <dt>Vereinszweck</dt>
        <dd>
          <Value value={LEGAL.purpose.de} what="Vereinszweck laut Statuten" />
        </dd>
        <dt>Grundlegende Richtung</dt>
        <dd>
          Online-Dienste für die Mitglieder des Vereins: Bespannservice für
          Tennisschläger und Trainingsplanung.
        </dd>
        */}
      </dl>
    </LegalPage>
  )
}

function ImprintEn() {
  return (
    <LegalPage title={m.legal_imprint_title()}>
      <p>
        Information under § 5 of the Austrian E-Commerce Act (ECG) and
        disclosure under § 25 of the Austrian Media Act (MedienG).
      </p>
      <dl>
        <dt>Owner and operator</dt>
        <dd>
          <Address />
        </dd>
        <dt>Association register number (ZVR)</dt>
        <dd>
          <Value value={LEGAL.zvr} what="ZVR number" />
        </dd>
        <dt>Registration authority</dt>
        <dd>{LEGAL.registrationAuthority}</dd>
        <dt>Represented by</dt>
        <dd>
          <Value value={LEGAL.representedBy} what="chair" />
        </dd>
        <dt>Contact</dt>
        <dd>
          <Email />
          {LEGAL.phone && (
            <>
              <br />
              Phone {LEGAL.phone}
            </>
          )}
        </dd>
        <dt>Purpose of the association</dt>
        <dd>
          <Value value={LEGAL.purpose.en} what="purpose from the statutes" />
        </dd>
        <dt>Editorial line</dt>
        <dd>
          Online services for the club's members: racket restringing and
          training planning.
        </dd>
      </dl>
    </LegalPage>
  )
}

export function PrivacyNotice() {
  return getLocale() === 'en' ? <PrivacyEn /> : <PrivacyDe />
}

function AccessLogsDe() {
  if (LEGAL.accessLogDays == null) {
    return <Missing what="Aufbewahrung der Server-Zugriffsprotokolle" />
  }
  if (LEGAL.accessLogDays === 0) {
    return <>Zugriffe auf die Seite werden nicht protokolliert.</>
  }
  return (
    <>
      Der Webserver protokolliert Zugriffe (IP-Adresse, Zeitpunkt, aufgerufene
      Adresse, Browserkennung), um Fehler zu finden und Angriffe abzuwehren.
      Diese Protokolle werden nach {LEGAL.accessLogDays} Tagen gelöscht.
    </>
  )
}

function AccessLogsEn() {
  if (LEGAL.accessLogDays == null) {
    return <Missing what="how long server access logs are kept" />
  }
  if (LEGAL.accessLogDays === 0) {
    return <>Visits to the site are not logged.</>
  }
  return (
    <>
      The web server logs requests (IP address, time, address requested, browser
      identifier) to find faults and fend off attacks. These logs are deleted
      after {LEGAL.accessLogDays} days.
    </>
  )
}

function PrivacyDe() {
  return (
    <LegalPage title={m.legal_privacy_title()}>
      <p className="text-muted-foreground">
        Stand: {formatDate(LEGAL.privacyUpdated)}
      </p>

      <h2>Verantwortlicher</h2>
      <p>
        <Address />
        <br />
        <Email />
      </p>
      <p>
        Für alle Fragen zum Datenschutz und zur Ausübung deiner Rechte erreichst
        du uns unter dieser Adresse.
      </p>

      <h2>Worum es geht</h2>
      <p>
        Diese App ist ein interner Dienst des Vereins für seine Mitglieder:
        Bespannaufträge für Tennisschläger, deren Abrechnung und die Planung von
        Trainingsgruppen. Ein Konto gibt es nur mit einer Einladung, und der
        Vorstand muss es freischalten. Werbung, Analyse- oder Tracking-Dienste
        setzen wir nicht ein.
      </p>

      <h2>Welche Daten wir verarbeiten</h2>
      <ul>
        <li>
          <strong>Konto:</strong> Name, E-Mail-Adresse, Passwort (nur als nicht
          umkehrbarer Hash gespeichert), Rollen im Verein, Status der
          Freischaltung, bevorzugte Sprache und die Einladung, mit der das Konto
          erstellt wurde.
        </li>
        <li>
          <strong>Schläger und Bespannaufträge:</strong> deine Schläger mit
          Angaben wie Marke, Modell, Besaitung und Notizen; deine Aufträge mit
          Saite, Härte, Notizen und Verlauf (wer hat wann angenommen, bespannt,
          abgeholt oder storniert); Preise, ob bezahlt wurde und die
          Auszahlungen an die Bespanner:innen.
        </li>
        <li>
          <strong>Trainingsplanung:</strong> Namen von Trainer:innen und
          Trainingskindern bzw. Spieler:innen, Ballstufe, Spielstärke, Notizen
          und wöchentliche Verfügbarkeit. Diese Angaben tragen Trainer:innen
          ein; die betroffenen Personen brauchen dafür kein Konto.
        </li>
        <li>
          <strong>Verwaltungsprotokoll:</strong> Freischaltungen, Ablehnungen,
          Rollenänderungen und Löschungen von Konten, jeweils mit Name und
          E-Mail-Adresse der betroffenen Person, der handelnden Person und dem
          Zeitpunkt.
        </li>
        <li>
          <strong>Technische Daten:</strong> Bei der Anmeldung speichern wir
          eine Sitzung mit IP-Adresse und Browserkennung. Fehlgeschlagene und
          erfolgreiche Anmeldeversuche werden je IP-Adresse kurzzeitig im
          Arbeitsspeicher gezählt, um das Erraten von Passwörtern zu bremsen.{' '}
          <AccessLogsDe />
        </li>
      </ul>

      <h2>Zwecke und Rechtsgrundlagen</h2>
      <ul>
        <li>
          Bespannservice, Abrechnung und Trainingsplanung als Leistungen des
          Vereins für seine Mitglieder: Art. 6 Abs. 1 lit. b DSGVO
          (Mitgliedschaft bzw. Auftrag).
        </li>
        <li>
          Sicherheit der App (Sitzungen, Schutz vor Passwortraten,
          Verwaltungsprotokoll) und die Planung von Trainingsgruppen für
          Personen ohne eigenes Konto: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes
          Interesse an einem sicheren Betrieb und an organisiertem Training).
        </li>
        <li>
          Aufbewahrung von Abrechnungsdaten, soweit das Gesetz es verlangt: Art.
          6 Abs. 1 lit. c DSGVO.
        </li>
      </ul>

      <h2>Wer die Daten sieht</h2>
      <p>
        Nur Vereinsmitglieder mit Konto, und jeweils nur, was ihre Rolle
        braucht: Bespanner:innen sehen die Aufträge, die Kassa sieht die
        Abrechnung, Trainer:innen die Trainingsplanung, der Vorstand die
        Mitgliederverwaltung. Wir geben keine Daten an Dritte weiter und
        verkaufen sie nicht.
      </p>
      <p>
        Die App läuft auf einem Server bei{' '}
        <Value value={LEGAL.hosting} what="Hosting-Anbieter" />, der die Daten
        als Auftragsverarbeiter in unserem Auftrag speichert. Schriften und alle
        anderen Bestandteile der Seite liefert dieser Server selbst aus; beim
        Besuch werden keine Daten an andere Anbieter übertragen.
      </p>
      <p>
        Der QR-Code für die Überweisung enthält nur die Bankverbindung des
        Vereins, den Betrag und einen Verwendungszweck. Die Überweisung selbst
        machst du in deiner eigenen Banking-App; die App bekommt davon nichts
        mit.
      </p>

      <h2>Cookies und lokaler Speicher</h2>
      <p>
        Wir setzen ein einziges Cookie: das Sitzungs-Cookie, das dich angemeldet
        hält. Es ist technisch notwendig und braucht deshalb keine Einwilligung
        (§ 165 Abs. 3 TKG 2021). Die Trainingsplanung merkt sich im lokalen
        Speicher deines Browsers, welchen Zeitraum der Wochenplan zeigt; das
        bleibt auf deinem Gerät.
      </p>

      <h2>Wie lange wir Daten speichern</h2>
      <ul>
        <li>Sitzungen laufen sieben Tage nach der letzten Nutzung ab.</li>
        <li>
          Konto, Schläger und Aufträge, solange du Mitglied bist oder die App
          nutzt. Danach löschen wir dein Konto auf Anfrage. Aufträge und
          Zahlungen, die in die Abrechnung des Vereins eingeflossen sind,
          bewahren wir so lange auf, wie es gesetzliche Aufbewahrungspflichten
          verlangen (in der Regel sieben Jahre, § 132 BAO).
        </li>
        <li>
          Trainingsdaten, solange sie für die Planung gebraucht werden.
          Trainer:innen können Personen entfernen; wer noch in einem
          gespeicherten Plan vorkommt, wird bis zum Löschen dieses Plans nur
          archiviert.
        </li>
        <li>
          Einträge im Verwaltungsprotokoll bleiben erhalten, damit
          nachvollziehbar ist, wer welche Entscheidung getroffen hat.
        </li>
      </ul>

      <h2>Deine Rechte</h2>
      <p>
        Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung
        der Verarbeitung, Datenübertragbarkeit und Widerspruch (Art. 15 bis 21
        DSGVO). Schreib uns dafür an <Email />.
      </p>
      <p>
        Wenn du meinst, dass wir deine Daten nicht rechtmäßig verarbeiten,
        kannst du dich bei der Österreichischen Datenschutzbehörde beschweren:
        Barichgasse 40–42, 1030 Wien,{' '}
        <a href="https://www.dsb.gv.at" rel="noreferrer">
          www.dsb.gv.at
        </a>
        .
      </p>
    </LegalPage>
  )
}

function PrivacyEn() {
  return (
    <LegalPage title={m.legal_privacy_title()}>
      <p className="text-muted-foreground">
        Last updated: {formatDate(LEGAL.privacyUpdated)}
      </p>

      <h2>Controller</h2>
      <p>
        <Address />
        <br />
        <Email />
      </p>
      <p>
        Write to this address with any question about data protection or to
        exercise your rights.
      </p>

      <h2>What this is about</h2>
      <p>
        This app is the club's internal service for its members: restringing
        requests for tennis rackets, their billing, and planning training
        groups. Accounts are by invitation only and must be approved by the
        board. We use no advertising, analytics or tracking services.
      </p>

      <h2>What data we process</h2>
      <ul>
        <li>
          <strong>Account:</strong> name, email address, password (stored only
          as a one-way hash), club roles, approval status, preferred language,
          and the invitation the account was created with.
        </li>
        <li>
          <strong>Rackets and restringing jobs:</strong> your rackets with
          details such as brand, model, string pattern and notes; your jobs with
          string, tension, notes and history (who accepted, strung, collected or
          cancelled them, and when); prices, whether they were paid, and the
          payouts to stringers.
        </li>
        <li>
          <strong>Training planning:</strong> names of coaches and players
          (including children), ball level, playing strength, notes and weekly
          availability. Coaches enter these; the people concerned don't need an
          account.
        </li>
        <li>
          <strong>Administration log:</strong> approvals, rejections, role
          changes and deletions of accounts, each with the name and email
          address of the person concerned, who made the change, and when.
        </li>
        <li>
          <strong>Technical data:</strong> signing in stores a session with your
          IP address and browser identifier. Sign-in attempts are counted per IP
          address, briefly and in memory only, to slow down password guessing.{' '}
          <AccessLogsEn />
        </li>
      </ul>

      <h2>Purposes and legal bases</h2>
      <ul>
        <li>
          Restringing, billing and training planning as services the club
          provides to its members: Art. 6(1)(b) GDPR (membership or order).
        </li>
        <li>
          Keeping the app secure (sessions, protection against password
          guessing, administration log) and planning training groups for people
          without an account: Art. 6(1)(f) GDPR (legitimate interest in secure
          operation and organised training).
        </li>
        <li>
          Keeping billing records where the law requires it: Art. 6(1)(c) GDPR.
        </li>
      </ul>

      <h2>Who sees the data</h2>
      <p>
        Only club members with an account, and each only what their role needs:
        stringers see the jobs, the treasurer sees billing, coaches see training
        planning, the board sees member administration. We don't pass data on to
        third parties and never sell it.
      </p>
      <p>
        The app runs on a server provided by{' '}
        <Value value={LEGAL.hosting} what="hosting provider" />, which stores
        the data on our behalf as a processor. That server delivers fonts and
        every other part of the site itself; visiting it sends no data to other
        providers.
      </p>
      <p>
        The payment QR code contains only the club's bank details, the amount
        and a reference. You make the transfer in your own banking app; this app
        learns nothing about it.
      </p>

      <h2>Cookies and local storage</h2>
      <p>
        We set a single cookie: the session cookie that keeps you signed in. It
        is strictly necessary and therefore needs no consent (§ 165(3) TKG
        2021). The training planner remembers in your browser's local storage
        which hours its weekly grid shows; that stays on your device.
      </p>

      <h2>How long we keep data</h2>
      <ul>
        <li>Sessions expire seven days after they were last used.</li>
        <li>
          Your account, rackets and jobs for as long as you are a member or use
          the app. After that, we delete your account on request. Jobs and
          payments that went into the club's accounts are kept for as long as
          statutory retention rules require (usually seven years, § 132 BAO).
        </li>
        <li>
          Training data for as long as it is needed for planning. Coaches can
          remove people; anyone still named in a saved plan is only archived
          until that plan is deleted.
        </li>
        <li>
          Administration log entries are kept, so that it stays clear who made
          which decision.
        </li>
      </ul>

      <h2>Your rights</h2>
      <p>
        You have the right of access, rectification, erasure, restriction of
        processing, data portability and objection (Art. 15 to 21 GDPR). Write
        to us at <Email />.
      </p>
      <p>
        If you believe we process your data unlawfully, you can complain to the
        Austrian Data Protection Authority (Datenschutzbehörde): Barichgasse
        40–42, 1030 Vienna,{' '}
        <a href="https://www.dsb.gv.at" rel="noreferrer">
          www.dsb.gv.at
        </a>
        .
      </p>
    </LegalPage>
  )
}
