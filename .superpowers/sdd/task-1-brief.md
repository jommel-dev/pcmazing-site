### Task 1: Pure helpers (TDD)

**Files:**
- Create: `backend/src/admin/payroll/payroll-ledger.util.ts`
- Create: `backend/src/admin/payroll/payroll-ledger.util.spec.ts`

**Interfaces:**
- Produces:
  - `export type PayslipLedgerLineType = 'commission' | 'late_deduction' | 'loan_deduction' | 'manual_deduction'`
  - `export type PayslipLedgerLine = { lineType: PayslipLedgerLineType; label: string; amount: number; source: 'auto' | 'manual' | 'override'; meta?: Record<string, unknown> }`
  - `computeLateMinutes(timeIn: Date, workDateYmd: string, shiftStartHhmm: string, graceMinutes: number): number`
  - `computeLateDeduction(minutesLate: number, fixed: number, perMinute: number): number`
  - `computeEqualInstallmentAmount(principal: number, installmentCount: number): number`
  - `computeLoanPeriodAmount(args: { balance: number; termStyle: 'equal_installments' | 'fixed_per_cutoff'; installmentCount: number | null; fixedInstallmentAmount: number | null; override: null | { action: 'skip' | 'custom'; customAmount?: number } }): number` // 0 if skip
  - `computePayslipNet(args: { basePay: number; overtimePay: number; lines: PayslipLedgerLine[] }): { grossPay: number; totalDeductions: number; netPay: number; commissionsTotal: number; lateTotal: number; loanTotal: number; manualTotal: number }`

- [ ] **Step 1: Write failing tests**

```typescript
import {
  computeLateMinutes,
  computeLateDeduction,
  computeEqualInstallmentAmount,
  computeLoanPeriodAmount,
  computePayslipNet,
} from './payroll-ledger.util';

describe('payroll-ledger.util', () => {
  it('late minutes after grace', () => {
    // workDate 2026-10-08, shift 09:00, grace 15 → late after 09:15
    const timeIn = new Date('2026-10-08T01:30:00.000Z'); // adjust to project TZ handling — use same convention as attendance
    expect(computeLateMinutes(timeIn, '2026-10-08', '09:00', 15)).toBeGreaterThan(0);
  });
  it('on-time is zero', () => {
    expect(computeLateDeduction(0, 50, 2)).toBe(0);
  });
  it('late deduction fixed + per minute', () => {
    expect(computeLateDeduction(10, 50, 2)).toBe(70);
  });
  it('equal installment rounds money', () => {
    expect(computeEqualInstallmentAmount(6000, 6)).toBe(1000);
  });
  it('skip loan returns 0', () => {
    expect(
      computeLoanPeriodAmount({
        balance: 3000,
        termStyle: 'fixed_per_cutoff',
        installmentCount: null,
        fixedInstallmentAmount: 500,
        override: { action: 'skip' },
      }),
    ).toBe(0);
  });
  it('net floors at 0', () => {
    const r = computePayslipNet({
      basePay: 100,
      overtimePay: 0,
      lines: [
        { lineType: 'manual_deduction', label: 'x', amount: 500, source: 'manual' },
      ],
    });
    expect(r.netPay).toBe(0);
    expect(r.totalDeductions).toBe(500);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```powershell
cd backend; npx jest src/admin/payroll/payroll-ledger.util.spec.ts --no-cache
```

- [ ] **Step 3: Implement util** (use Asia/Manila or existing payroll date helpers if present; document TZ in comments). Cap loan period amount at `balance`. Round money to 2 decimals.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```powershell
git add backend/src/admin/payroll/payroll-ledger.util.ts backend/src/admin/payroll/payroll-ledger.util.spec.ts
git commit -m "feat(payroll): ledger math helpers for loans late and net"
```

---

