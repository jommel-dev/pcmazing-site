# Task 3 Report: Time-clock frontend picker

## Status
**DONE**

## Summary
Time-clock UI now requires an Office/WFH pick before Time In. `workLocationType` is sent in FormData; GPS/label only when the pick is WFH. Schedule `office`/`wfh` pre-selects the pick; Off/missing leaves null with a soft Off warning.

## Changes
### `frontend/src/app/core/services/time-clock-api.service.ts`
- `timeIn` takes required `workLocationType: 'office' | 'wfh'` and appends it to FormData.

### `frontend/src/app/website/pages/time-clock/time-clock-page.component.ts`
- `pickedLocation` signal; set from `expectedLocation` on lookup (`office`/`wfh` → preselect, else `null`).
- GPS requested when pick is WFH (lookup + WFH button).
- `punch('in')` blocks if pick is null; passes pick to API; GPS payload only for WFH.

### `frontend/src/app/website/pages/time-clock/time-clock-page.component.html`
- “Working from” Office/WFH buttons when `canTimeIn`.
- Soft Off warning when schedule is Off.
- GPS/label block gated on `pickedLocation() === 'wfh'`.
- Time In disabled when `!pickedLocation()` or `!selfieBlob()`.

## Verification
- `cd frontend; npx ng build --configuration=development` → **exit 0**

## Commit
- `e6cca68` — `Add Office/WFH picker on time clock before time in.`

## Concerns / follow-ups
- No automated UI/e2e test for the picker flow.
- Manual check recommended: Off day forces a choice; WFH pick triggers GPS; Office pick omits location fields.
