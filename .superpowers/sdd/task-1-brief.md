### Task 1: Location pay helpers + unit tests

**Files:**
- Create: `backend/src/admin/payroll/location-pay.util.ts`
- Create: `backend/src/admin/payroll/location-pay.util.spec.ts`
- Consumes: `WorkLocationType` from `work-location.util.ts`

**Interfaces:**
- Produces:
  - `pickSalaryAmountForLocation(expected: WorkLocationType, officeSalary: number | null, wfhSalary: number | null): number | null`
  - `locationPayLabelSuffix(expected: WorkLocationType): string` → `''` | `' · Office'` | `' · WFH'` | `' · Off (unpaid)'`

- [ ] **Step 1: Write failing tests**

```typescript
import { pickSalaryAmountForLocation, locationPayLabelSuffix } from './location-pay.util';

describe('pickSalaryAmountForLocation', () => {
  it('uses office amount for office days', () => {
    expect(pickSalaryAmountForLocation('office', 800, 700)).toBe(800);
  });

  it('uses wfh amount for wfh days', () => {
    expect(pickSalaryAmountForLocation('wfh', 800, 700)).toBe(700);
  });

  it('falls back to office when wfh is null', () => {
    expect(pickSalaryAmountForLocation('wfh', 800, null)).toBe(800);
  });

  it('returns null for off days (unpaid)', () => {
    expect(pickSalaryAmountForLocation('off', 800, 700)).toBe(null);
  });
});

describe('locationPayLabelSuffix', () => {
  it('labels office, wfh, and off', () => {
    expect(locationPayLabelSuffix('office')).toBe(' · Office');
    expect(locationPayLabelSuffix('wfh')).toBe(' · WFH');
    expect(locationPayLabelSuffix('off')).toBe(' · Off (unpaid)');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd backend; npx jest src/admin/payroll/location-pay.util.spec.ts -v`  
Expected: FAIL module not found / cannot find module

- [ ] **Step 3: Implement helpers**

```typescript
import { WorkLocationType } from './work-location.util';

export function pickSalaryAmountForLocation(
  expected: WorkLocationType,
  officeSalary: number | null,
  wfhSalary: number | null,
): number | null {
  if (expected === 'off') {
    return null;
  }
  if (expected === 'wfh') {
    if (wfhSalary != null && wfhSalary > 0) {
      return wfhSalary;
    }
    return officeSalary != null && officeSalary > 0 ? officeSalary : null;
  }
  return officeSalary != null && officeSalary > 0 ? officeSalary : null;
}

export function locationPayLabelSuffix(expected: WorkLocationType): string {
  switch (expected) {
    case 'wfh':
      return ' · WFH';
    case 'off':
      return ' · Off (unpaid)';
    default:
      return ' · Office';
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd backend; npx jest src/admin/payroll/location-pay.util.spec.ts -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/admin/payroll/location-pay.util.ts backend/src/admin/payroll/location-pay.util.spec.ts
git commit -m "Add location pay amount helpers for Office vs WFH rates."
```

---
