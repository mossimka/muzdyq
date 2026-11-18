# Ethics, safety and privacy

Muzdyq asks people to walk into high mountains with a phone. That creates real
physical risk, and it creates privacy risk for the people in their photographs.
This document states the rules the software is built around, what is enforced in
code, and what still depends on humans.

> **Citizen photos are observations, not measurements.** A photo series can show
> that a glacier terminus looks different, but it cannot establish mass balance,
> ice thickness or retreat rate. Scientific conclusions require calibrated
> instruments, surveyed control points and expert analysis.

---

## 1. Safety first

The app must never make a dangerous place feel like a photo opportunity.

**Product rules**

- Every contribution screen shows the point's safety note before the camera.
- Safety text is per point and trilingual; the seeded text is deliberately
  conservative and is a placeholder for local expert review.
- There are no points inside closed zones, on glacier termini, on moraine crests
  or on steep snow. Viewpoints are intended to be reachable on marked trails.
- There is no “get closer”, “unlock”, distance challenge or location task.
- The app works offline so nobody is tempted to rely on connectivity for
  navigation; it is **not** a navigation or rescue tool.

**Contributor rules shown in the UI**

1. Do not leave the marked trail for a photo.
2. Do not enter closed areas, construction sites, avalanche paths, glacier
   termini, crevasse zones, moraines or steep snow.
3. Do not cross water bodies or stand on ice.
4. Turn back in bad weather, low visibility, thunder or darkness.
5. Tell someone your route and carry water, warm layers and a charged phone.
6. In an emergency call **112**. Muzdyq cannot summon help.

**What we do not do**

- No GPS tracking, no background location, no “nearby points” notifications.
- No heatmaps of contributor movement.
- No streak, badge, leaderboard, points or ranking of any kind.
- No push notification that pressures someone to visit a site.

---

## 2. Privacy by design

### No accounts

There is no sign-up, login, email, phone number or social identity. The API has
no contributor table. Uploads carry a random client UUID for idempotency and an
optional opaque device token; both are hashed with a server-side salt before
storage, and neither is published.

### No location or EXIF

- The browser pipeline decodes the image, draws it to a canvas and re-encodes it
  as JPEG. EXIF, GPS, device model, serial numbers and timestamps embedded by the
  camera are discarded in this step.
- The server decodes the received file again, resizes, re-encodes and strips all
  metadata. The client is never trusted.
- Point coordinates come from the fixed catalogue, not from the contributor's
  device. A photo is associated with a known viewpoint, not with where the person
  actually stood.
- `taken_at` is supplied by the client (camera time) and **rounded down to the
  hour** before storage and publication. This reduces movement-pattern leakage.

### Faces

- On device, the browser `FaceDetector` API is used when available to pixelate
  detected faces before the image ever leaves the phone.
- On the server, OpenCV YuNet (with Haar cascade fallback) detects faces and
  blurs them again. The count is recorded in `tags.automation.faces_blurred`.
- This is **best-effort**. Detection can miss profiles, occluded faces, children,
  people in the distance, or reflections. Moderators must still reject images
  where a person is identifiable and has not consented.

### Analytics and cookies

- No Google Analytics, no Plausible, no Sentry, no advertising pixels, no social
  embeds, no third-party fonts.
- No cookies are set by the application. Preferences (language, theme, green
  mode) live in `localStorage`.
- The only outbound third-party requests are map tiles (OpenStreetMap /
  OpenTopoMap), which necessarily reveal the user's IP to the tile server. Green
  mode reduces tile fetches; offline regions avoid them after download.
- Server access logs are operational logs, not analytics. They are not joined to
  photos or published.

### What is stored

| Data | Where | Purpose | Retention |
| --- | --- | --- | --- |
| Photo + thumbnail (EXIF-free) | Media volume | Published observation | Until hidden/deleted |
| Point slug, viewpoint, hourly time, tags | Database | Public metadata | Same as photo |
| `client_uuid` (random, client-generated) | Database | Idempotency | Same as photo |
| `ip_hash`, `device_hash` (salted) | Database | Rate limiting, abuse correlation | Same as photo; purge on request |
| Admin token | Environment | Moderation | Rotate on schedule |
| Preferences | Browser `localStorage` | UI settings | Until cleared |

There is no separate analytics store and no backup of rejected images beyond the
normal volume snapshot.

---

## 3. Consent and content

By uploading, a contributor confirms:

- they took the photo or hold the rights to share it;
- they consent to publication under **CC BY 4.0**;
- they have consent from any identifiable person in the frame, or have blurred
  or avoided them;
- the photo does not show illegal activity, personal documents, vehicles with
  readable plates, children's faces, or culturally sensitive sites in a
  disrespectful way.

Rules:

- **People first.** A landscape photo is not worth someone's privacy. Reject
  images with identifiable people who have not consented.
- **No minors as subjects.** Do not photograph children at trailheads or stands.
- **No precise private locations.** Do not photograph homes, camps, vehicles,
  herder settlements or infrastructure in a way that enables targeting.
- **Cultural respect.** Do not stage photos at sacred sites, petroglyphs or
  memorials; do not damage vegetation or leave markers.
- **No drones.** Drone use is restricted in protected areas and disturbs wildlife.
  Muzdyq is a ground-based, phone-only project.
- **Wildlife.** Do not approach or bait animals for a photo.

---

## 4. Moderation

This reference build publishes immediately and provides token-protected
moderation endpoints. A real deployment should run with a moderation queue.

Recommended policy:

1. New uploads start as `pending` (change the default in `photos.py`).
2. A named steward reviews for safety, privacy, relevance and duplicates.
3. Rejections record a short reason (`rejection_reason`), visible to moderators.
4. Contributors can request removal without an account by quoting the photo URL
   or ID to the published contact address.
5. Takedown requests for identifiable people are honoured promptly, without
   requiring proof of identity beyond a credible request.
6. Moderators do not edit photos; they publish, hide or delete.

No moderation decision is gamified, scored or used to rank contributors.

---

## 5. Scientific integrity

- The UI states the disclaimer on the home page, in every point panel, on the
  data page and in exports.
- Demo photos are synthetic and labelled **“DEMO PHOTO — NOT A REAL OBSERVATION”**;
  the `is_demo` flag is exported.
- Seed coordinates and viewpoints are **approximate and unverified**. They must
  be confirmed by glaciologists and a field visit before public launch.
- Photos are not presented as calibrated measurements. No automated retreat rate,
  volume or mass-balance figure is derived from them.
- Exports include the licence, attribution and disclaimer so downstream users
  cannot easily strip context.
- Corrections are welcome: open an issue with a source and, where possible, a
  field-verified coordinate.

---

## 6. Accessibility and inclusion

- WCAG 2.1 AA is the target: semantic headings, focus-visible outlines, skip
  link, labelled controls, keyboard-operable dialogs and sliders, contrast-checked
  palette in light and dark themes.
- Layouts are tested at 360 px width; touch targets are at least 40 px.
- Kazakh, Russian and English are first-class; the switcher is always visible and
  the choice persists.
- Reduced-motion preferences disable the timelapse autoplay and UI transitions.
- The app works on low-end Android phones and on slow connections; images are
  resized before upload and heavy map layers are opt-in.
- No feature requires an account, an app-store install, a payment or a modern
  flagship device.

---

## 7. Governance and honest limitations

Muzdyq is a reference implementation, not a deployed public service. Before it
becomes one, the following must be real, not aspirational:

- a named owner/steward and a public contact address;
- a moderation rota and a published response time;
- field verification of every point and viewpoint with local glaciologists;
- a formal data-protection review under applicable Kazakh law and, if relevant,
  GDPR for EU visitors;
- a security review and dependency-update process;
- a retention and deletion schedule that is actually executed;
- consultation with protected-area authorities, local communities and rescue
  services.

Known gaps in this build:

- face blur is best-effort and may miss faces;
- the moderation UI is API-only;
- rate limiting is in-process and resets on restart;
- there is no contributor-facing deletion flow, only a contact address;
- there is no formal accessibility audit or penetration test.

We would rather state these gaps than claim a safety or privacy guarantee the
code cannot keep.

---

## 8. Reporting a concern

For privacy, safety or content concerns, contact the project maintainers through
the repository issue tracker (see [`SECURITY.md`](../SECURITY.md) for sensitive
reports). Include the photo URL or ID and the nature of the concern. Do not
include personal data in public issues.
