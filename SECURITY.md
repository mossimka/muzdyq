# Security policy

Muzdyq handles anonymous photo uploads and publishes them publicly. We take
security and privacy reports seriously, especially anything that could expose a
contributor, bypass moderation or enable abuse of the upload pipeline.

## Supported versions

| Version | Supported |
| --- | --- |
| `main` (pre-1.0) | ✅ |
| tagged releases | ✅ latest minor |
| older releases | ❌ |

The project is pre-1.0. Fixes land on `main` and in the next tagged release.

## Reporting a vulnerability

**Do not open a public issue for a security or privacy problem.**

Use GitHub's **Security → Report a vulnerability** (private advisory) on the
repository. If that is unavailable, contact a maintainer directly through the
channel listed in the repository profile.

Please include:

- affected version or commit;
- reproduction steps or a proof of concept;
- impact (for example: can a contributor's IP or identity be recovered? can
  moderation be bypassed? can arbitrary files be stored or served?);
- any suggested fix;
- whether you want public credit.

You can expect:

- acknowledgement within **7 days**;
- an initial assessment within **14 days**;
- a fix or mitigation plan within **90 days** for confirmed issues, faster for
  critical ones;
- credit in the release notes if you wish.

We do not run a paid bug-bounty programme. We will not pursue legal action
against good-faith research that respects privacy, avoids service disruption and
does not access other people's data.

## In scope

- Authentication bypass of `/api/admin/*`.
- Upload validation bypass: executable content, polyglot files, decompression or
  image-parser denial of service, path traversal, storage-key injection.
- Idempotency flaws that create duplicate or cross-point records.
- Rate-limit bypass that enables spam at scale.
- Exposure of `ip_hash`, `device_hash`, raw IPs, admin tokens or environment
  secrets through API responses, logs or exports.
- EXIF/GPS retention that survives the client **and** server pipelines.
- Face-blur bypass that reliably leaves faces identifiable in published images.
- Stored XSS through tags, viewpoint notes, point metadata or filenames.
- Cache poisoning or service-worker issues that serve attacker content.
- SQL injection, SSRF or arbitrary file read/write.
- Privacy issues: re-identification of a contributor from published metadata.

## Out of scope

- Missing security headers without a demonstrated impact.
- Rate limiting on read/export endpoints (documented limitation).
- Best-effort face blur missing a face in a specific photo — report the photo
  for takedown instead; blur is explicitly not a guarantee.
- Self-XSS, social engineering of maintainers, or physical attacks.
- Vulnerabilities in third-party map tile servers or the demo tile providers.
- Reports generated solely by automated scanners without a plausible impact.
- Denial of service through very large but within-limit exports on an
  unhardened public deployment.

## Security measures in the codebase

- Anonymous uploads; no contributor credentials to steal.
- Server-side MIME **and** magic-byte validation, size caps, Pillow decode and
  re-encode; uploaded bytes are never served as-is.
- EXIF/GPS stripped on device and again on the server.
- YuNet/Haar face blur before publication.
- Perceptual-hash duplicate detection.
- Salted, truncated-by-design IP and device hashes; no raw addresses stored.
- In-process rate limiting per hashed IP/device (minute + hour windows).
- `client_uuid` uniqueness for idempotency; races resolve to the existing row.
- Admin endpoints require `X-Admin-Token`; no admin UI is shipped.
- Security headers from FastAPI and nginx: `nosniff`, `DENY` framing,
  `no-referrer`/strict-origin, restrictive `Permissions-Policy`,
  `Cross-Origin-Opener-Policy`.
- Exports are streamed and never include moderation-only fields.
- CI runs lint, tests and a production build on every push.

## Deployment hardening checklist

- [ ] Set a strong random `ADMIN_TOKEN` and `IP_HASH_SALT` (the defaults log
      warnings and must never be used publicly).
- [ ] Set a strong `POSTGRES_PASSWORD`; do not publish the database port.
- [ ] Terminate TLS; redirect HTTP to HTTPS; enable HSTS.
- [ ] Set `SEED_DEMO=false` once real photos exist.
- [ ] Switch uploads to `pending` and run moderation before publishing.
- [ ] Restrict `CORS_ORIGINS` to the real origin.
- [ ] Put a reverse-proxy rate limit in front of `/api/` and exports.
- [ ] Run containers as non-root (backend image already does) and pin images.
- [ ] Back up the database and media volumes together, encrypted at rest.
- [ ] Centralise logs without photo contents or raw IPs; set a retention period.
- [ ] Monitor dependency advisories (`pip-audit`, `npm audit`) and update.
- [ ] Publish a privacy contact and a takedown response window.

## Known limitations

- The rate limiter is in-process memory; restarting resets counters and multiple
  workers do not share state.
- Face blur is best-effort and can miss faces.
- There is no formal penetration test or external security audit.
- The admin API has no audit log beyond application logs.
- Photo deletion removes database rows and files but cannot retract copies that
  were already exported or cached by third parties.

## Privacy reports

If you are depicted in a photo, or believe a photo exposes personal information,
you do not need to file a security advisory. Use the repository's private contact
channel and include the photo URL or ID. We will hide the photo while reviewing
and delete it if the concern is substantiated.
