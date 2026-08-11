# Changelog

## [1.3.0.0] - 2026-08-10

### Added
- Personal accent color picker — choose from 4 presets (Sage Forest, Midnight Navy, Burgundy, Slate Blue) in Settings. Your pick syncs through your account, so it follows you across devices and reinstalls instead of living only on one phone.
- Swipeable date navigation on the Today screen — swipe left/right (or tap the arrows) to browse up to 30 days back and 7 days forward, and mark past readings complete retroactively.

### Fixed
- Fixed a security gap where the app's reading-progress lookup didn't verify the request was actually coming from the person it claimed to be from.
- Fixed a crash that could happen if onboarding was submitted twice in a row (e.g. a slow network prompting a retry tap).
- Android push notification failures now surface instead of failing silently — you'll know if a device couldn't register for reminders.
- Your reading streak now only counts days you completed the reading on that same day — catching up on old readings still records them, but no longer inflates your streak.
- Retroactively completing an old reading is no longer blocked by an incorrect date-window rule.
- Fixed a rare case where an unusual saved color-preference value could silently break the app's theme colors.
- Fixed a rare crash on the Progress screen for accounts with certain timezone data — it now shows a clear "couldn't load" message instead.
- The "Upcoming" date label now matches your chosen accent color instead of a fixed color.

### Changed
- Consolidated theme constants into a single source of truth (`src/constants/theme.ts`).

---

*Versions prior to 1.3.0.0 were tracked only via `app.json`, not this file.*
