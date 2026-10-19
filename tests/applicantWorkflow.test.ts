import { describe, test, expect } from "bun:test";
import { isActivationComplete, bankSchema } from "../src/lib/applicantWorkflow";

describe("Applicant activation requires every approved step", () => {
  test("application must be accepted", () => expect(isActivationComplete(false, true, true, "approved")).toBe(false));
  test("contract must be signed", () => expect(isActivationComplete(true, false, true, "approved")).toBe(false));
  test("bank details must be complete", () => expect(isActivationComplete(true, true, false, "approved")).toBe(false));
  test("identity must be admin approved", () => {
    for (const status of ["not_submitted", "pending", "rejected"]) expect(isActivationComplete(true, true, true, status)).toBe(false);
  });
  test("all four steps activate the account", () => expect(isActivationComplete(true, true, true, "approved")).toBe(true));
  test("bank details validate actual IBAN checksum", () => {
    expect(bankSchema.safeParse({ holder: "Max Muster", iban: "DE89370400440532013000", bic: "COBADEFFXXX" }).success).toBe(true);
    expect(bankSchema.safeParse({ holder: "Max Muster", iban: "DE89370400440532013001", bic: "COBADEFFXXX" }).success).toBe(false);
  });
});