import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "decimal.js";
import { isLowMarkup, needsApproval, priceLine, totalise } from "./quotePricing.js";
import { approvalOnSave, canTransition, isEditable, statusAfterSave } from "./quoteStatus.js";

/** Compare as fixed strings: a Decimal has no meaningful deepEqual. */
const s = (value: Decimal | null, dp: number) => (value === null ? null : value.toFixed(dp));

describe("priceLine", () => {
  it("derives the price from a typed markup", () => {
    const line = priceLine({ quantity: "12", unitCost: "72", basis: "MARKUP", markupPct: "25", vatRate: "18" });

    assert.equal(s(line.unitPrice, 4), "90.0000");
    assert.equal(s(line.markupPct, 4), "25.0000");
    assert.equal(s(line.lineTotal, 2), "1080.00");
    assert.equal(s(line.lineCost, 2), "864.00");
  });

  it("derives the markup from a typed price", () => {
    const line = priceLine({ quantity: "600", unitCost: "0.42", basis: "PRICE", unitPrice: "0.62", vatRate: "18" });

    // (0.62 − 0.42) / 0.42 × 100 = 47.619047…
    assert.equal(s(line.markupPct, 4), "47.6190");
    assert.equal(s(line.unitPrice, 4), "0.6200");
    assert.equal(s(line.lineTotal, 2), "372.00");
    assert.equal(s(line.lineCost, 2), "252.00");
  });

  it("keeps unit prices to 4 decimals and totals to 2, half-up", () => {
    // 1.005 × 1.1 = 1.1055 exactly; a float would give 1.10549999…
    const unit = priceLine({ quantity: "1", unitCost: "1.005", basis: "MARKUP", markupPct: "10", vatRate: "18" });
    assert.equal(s(unit.unitPrice, 4), "1.1055");
    assert.equal(s(unit.lineTotal, 2), "1.11");

    // 0.125 × 1 rounds half-up to 0.13, not banker's 0.12.
    const half = priceLine({ quantity: "1", unitCost: "0.1", basis: "PRICE", unitPrice: "0.125", vatRate: "18" });
    assert.equal(s(half.lineTotal, 2), "0.13");

    // A fifth decimal on the price is rounded away before it is used.
    const fifth = priceLine({ quantity: "3", unitCost: "1", basis: "PRICE", unitPrice: "2.00005", vatRate: "18" });
    assert.equal(s(fifth.unitPrice, 4), "2.0001");
    assert.equal(s(fifth.lineTotal, 2), "6.00");
  });

  it("does not suffer float drift", () => {
    // 0.1 + 0.2 territory: 3 × 0.1 must be 0.30, and 1.15 × 100 exactly 115.00.
    const a = priceLine({ quantity: "3", unitCost: "0.05", basis: "PRICE", unitPrice: "0.1", vatRate: "18" });
    assert.equal(s(a.lineTotal, 2), "0.30");
    const b = priceLine({ quantity: "100", unitCost: "1", basis: "PRICE", unitPrice: "1.15", vatRate: "18" });
    assert.equal(s(b.lineTotal, 2), "115.00");
  });

  it("reports the markup as n/a when the unit cost is 0", () => {
    const line = priceLine({ quantity: "2", unitCost: "0", basis: "MARKUP", markupPct: "30", unitPrice: "45", vatRate: "18" });

    assert.equal(line.markupPct, null);
    assert.equal(s(line.unitPrice, 4), "45.0000");
    assert.equal(s(line.lineTotal, 2), "90.00");
    assert.equal(s(line.lineCost, 2), "0.00");
  });

  it("allows a negative markup when selling below cost", () => {
    const line = priceLine({ quantity: "1", unitCost: "100", basis: "PRICE", unitPrice: "90", vatRate: "18" });
    assert.equal(s(line.markupPct, 4), "-10.0000");
  });

  it("shows the gross margin on the line total, for display", () => {
    // (1080 − 864) / 1080 × 100 = 20
    const line = priceLine({ quantity: "12", unitCost: "72", basis: "MARKUP", markupPct: "25", vatRate: "18" });
    assert.equal(s(line.marginPct, 2), "20.00");

    const free = priceLine({ quantity: "1", unitCost: "5", basis: "PRICE", unitPrice: "0", vatRate: "18" });
    assert.equal(free.marginPct, null);
  });
});

describe("totalise", () => {
  const lines = [
    priceLine({ quantity: "12", unitCost: "72", basis: "MARKUP", markupPct: "25", vatRate: "18" }), // 1080.00 / 864.00
    priceLine({ quantity: "1", unitCost: "920", basis: "MARKUP", markupPct: "25", vatRate: "8" }), //  1150.00 / 920.00
    priceLine({ quantity: "600", unitCost: "0.42", basis: "PRICE", unitPrice: "0.62", vatRate: "18.00" }), // 372.00 / 252.00
  ];

  it("sums line totals and line costs", () => {
    const totals = totalise(lines);
    assert.equal(s(totals.subtotal, 2), "2602.00");
    assert.equal(s(totals.totalCost, 2), "2036.00");
  });

  it("groups VAT by rate, one band per rate, highest first", () => {
    const totals = totalise(lines);

    // 18 and 18.00 are one band: (1080 + 372) × 18% = 261.36; 1150 × 8% = 92.00
    assert.deepEqual(
      totals.vatBreakdown.map((band) => [s(band.rate, 2), s(band.base, 2), s(band.vat, 2)]),
      [
        ["18.00", "1452.00", "261.36"],
        ["8.00", "1150.00", "92.00"],
      ],
    );
    assert.equal(s(totals.vatTotal, 2), "353.36");
    assert.equal(s(totals.grandTotal, 2), "2955.36");
  });

  it("rounds VAT once per rate, not per line", () => {
    // Three lines of 0.03 at 18%: per line 0.0054 → 0.01 each = 0.03;
    // per rate 0.09 × 18% = 0.0162 → 0.02. The rule is per rate.
    const tiny = [1, 2, 3].map(() =>
      priceLine({ quantity: "1", unitCost: "0.01", basis: "PRICE", unitPrice: "0.03", vatRate: "18" }),
    );
    assert.equal(s(totalise(tiny).vatTotal, 2), "0.02");
  });

  it("computes the overall markup on cost", () => {
    // (2602 − 2036) / 2036 × 100 = 27.7996…
    assert.equal(s(totalise(lines).overallMarkupPct, 4), "27.7996");
  });

  it("has no overall markup when nothing costs anything, or there are no lines", () => {
    const free = [priceLine({ quantity: "1", unitCost: "0", basis: "PRICE", unitPrice: "50", vatRate: "18" })];
    assert.equal(totalise(free).overallMarkupPct, null);

    const empty = totalise([]);
    assert.equal(s(empty.subtotal, 2), "0.00");
    assert.equal(s(empty.grandTotal, 2), "0.00");
    assert.equal(empty.overallMarkupPct, null);
    assert.deepEqual(empty.vatBreakdown, []);
  });

  it("has a 0% band for zero-rated lines", () => {
    const zero = [priceLine({ quantity: "1", unitCost: "10", basis: "PRICE", unitPrice: "20", vatRate: "0" })];
    const totals = totalise(zero);
    assert.equal(s(totals.vatTotal, 2), "0.00");
    assert.equal(s(totals.grandTotal, 2), "20.00");
  });
});

describe("approval threshold", () => {
  it("needs approval strictly below the threshold", () => {
    assert.equal(needsApproval(new Decimal("9.9999"), "10"), true);
    assert.equal(needsApproval(new Decimal("10"), "10"), false);
    assert.equal(needsApproval(new Decimal("10.0001"), "10"), false);
    assert.equal(needsApproval(new Decimal("-5"), "10"), true);
  });

  it("reads the threshold it is given, not a fixed 10", () => {
    assert.equal(needsApproval(new Decimal("12"), "15"), true);
    assert.equal(needsApproval(new Decimal("12"), "5"), false);
  });

  it("needs no approval when there is no cost to compare with", () => {
    assert.equal(needsApproval(null, "10"), false);
  });

  it("decides from the totals of real lines", () => {
    // Cost 100, price 109 → 9% overall: below 10.
    const low = totalise([priceLine({ quantity: "1", unitCost: "100", basis: "PRICE", unitPrice: "109", vatRate: "18" })]);
    assert.equal(needsApproval(low.overallMarkupPct, "10"), true);

    // One thin line carried by a healthy one: 100→105 and 100→125 = 15% overall.
    const mixed = totalise([
      priceLine({ quantity: "1", unitCost: "100", basis: "PRICE", unitPrice: "105", vatRate: "18" }),
      priceLine({ quantity: "1", unitCost: "100", basis: "PRICE", unitPrice: "125", vatRate: "18" }),
    ]);
    assert.equal(needsApproval(mixed.overallMarkupPct, "10"), false);
  });

  it("flags a single low line without it being a blocker", () => {
    assert.equal(isLowMarkup(new Decimal("5"), "10"), true);
    assert.equal(isLowMarkup(new Decimal("10"), "10"), false);
    assert.equal(isLowMarkup(null, "10"), false);
  });
});

describe("approval on save", () => {
  it("needs nothing at or above the threshold, whoever saves", () => {
    assert.equal(approvalOnSave(false, false), "NOT_REQUIRED");
    assert.equal(approvalOnSave(false, true), "NOT_REQUIRED");
  });

  it("holds a low-markup save by someone who may not approve", () => {
    assert.equal(approvalOnSave(true, false), "PENDING");
  });

  it("records an approver's own low-markup save as approved by them", () => {
    assert.equal(approvalOnSave(true, true), "APPROVED");
  });
});

describe("status transitions", () => {
  it("lands only a held save in PENDING_APPROVAL", () => {
    assert.equal(statusAfterSave("PENDING"), "PENDING_APPROVAL");
    assert.equal(statusAfterSave("NOT_REQUIRED"), "DRAFT");
    // An approver's own low-markup save is a draft like any other.
    assert.equal(statusAfterSave("APPROVED"), "DRAFT");
  });

  it("allows the approval path and refuses shortcuts", () => {
    assert.equal(canTransition("DRAFT", "PENDING_APPROVAL"), true);
    assert.equal(canTransition("PENDING_APPROVAL", "READY_TO_SEND"), true);
    assert.equal(canTransition("PENDING_APPROVAL", "DRAFT"), true);
    // An edit after approval goes back through the check.
    assert.equal(canTransition("READY_TO_SEND", "PENDING_APPROVAL"), true);
    assert.equal(canTransition("READY_TO_SEND", "DRAFT"), true);
    // A pending quote cannot be sent, and a draft cannot be accepted.
    assert.equal(canTransition("PENDING_APPROVAL", "SENT"), false);
    assert.equal(canTransition("DRAFT", "ACCEPTED"), false);
    assert.equal(canTransition("DRAFT", "DRAFT"), true);
  });

  it("treats closed quotes as final and not editable", () => {
    for (const closed of ["ACCEPTED", "DECLINED", "EXPIRED", "CANCELLED"] as const) {
      assert.equal(canTransition(closed, "DRAFT"), false);
      assert.equal(isEditable(closed), false);
    }
    assert.equal(isEditable("SENT"), false);
    assert.equal(isEditable("READY_TO_SEND"), true);
  });
});
