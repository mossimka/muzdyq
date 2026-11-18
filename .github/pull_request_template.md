## Summary

<!-- What changed and why, in two or three sentences. -->

## Type of change

- [ ] Bug fix
- [ ] Feature
- [ ] Documentation
- [ ] Localisation (en / ru / kk)
- [ ] Accessibility or performance
- [ ] Tests or CI
- [ ] Refactor (no behaviour change)
- [ ] New monitoring point / seed data

## How was it tested?

<!-- Commands run, browsers/devices checked, screenshots if useful. -->

```text
backend:  ruff check app tests ; pytest -q
frontend: npm run lint ; npx tsc -b ; npm test ; npm run build ; npm run e2e
```

## Checklist

- [ ] Focused change with a clear description.
- [ ] Tests added or updated for new behaviour.
- [ ] All user-facing strings exist in **en, ru and kk**.
- [ ] Works at 360 px, with keyboard, and in dark mode.
- [ ] No accounts, gamification, location tracking, analytics or third-party cookies.
- [ ] No EXIF/GPS leakage; no identifiable people without consent.
- [ ] Safety guidance remains visible on every contribution path.
- [ ] Documentation and `.env.example` updated where needed.
- [ ] No secrets, tokens or personal data committed.

## Privacy and safety impact

<!-- Does this collect, publish or retain new data? Change a permission? Add a
     prompt that could pressure someone to take a risk? If none, say "none". -->

## Related issues

<!-- Closes #123 -->
