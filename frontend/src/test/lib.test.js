import { describe, expect, it } from "vitest";
import { parseCsv, prospectsFromCsv } from "../lib/csv.js";
import { clock, localToIsoWithOffset, suggestOutcome } from "../lib/call.js";

describe("csv", () => {
  it("handles quotes, commas and CRLF", () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([["a", "b"], ["x, y", 'say "hi"']]);
  });

  it("maps flexible headers and drops incomplete rows", () => {
    const people = prospectsFromCsv("﻿Name,Designation,Company,Mobile\nRamesh,MD,Sri Balaji,+91 1\n,,Nobody Inc,\n");
    expect(people).toEqual([
      { prospect_name: "Ramesh", prospect_role: "MD", company_name: "Sri Balaji",
        company_kind: "mid-size private company", phone: "+91 1" },
    ]);
  });

  it("explains a missing header", () => {
    expect(() => prospectsFromCsv("foo,bar\n1,2")).toThrow(/name.*company/);
  });
});

describe("call helpers", () => {
  it("formats the call clock", () => {
    expect(clock(new Date(Date.now() - 125_000).toISOString())).toBe("02:05");
    expect(clock(null)).toBe("00:00");
  });

  it("adds the browser offset to a datetime-local value", () => {
    const iso = localToIsoWithOffset("2030-01-15T15:00");
    expect(iso).toMatch(/^2030-01-15T15:00:00[+-]\d{2}:\d{2}$/);
    expect(new Date(iso).getTime()).toBe(new Date("2030-01-15T15:00").getTime());
    expect(localToIsoWithOffset("")).toBeNull();
  });

  it("suggests an outcome from the taps", () => {
    expect(suggestOutcome([{ stage_number: 7, what_happened: "named_time" }])).toBe("next_step_agreed");
    expect(suggestOutcome([{ stage_number: 1, what_happened: "wrong_person" }])).toBe("wrong_person");
    expect(suggestOutcome([])).toBe("not_logged");
  });
});
