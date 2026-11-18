import { describe, expect, it } from "vitest";
import { profileStepErrors, skillsStepErrors, fieldLabel } from "./profileValidation";

const TODAY = new Date("2026-11-18T12:00:00Z");
const FULL = {
  profilePhotoUrl: "https://cdn/x.webp", firstName: "Asha", lastName: "Kumar", dob: "1990-01-01", gender: "female",
  state: "Tamil Nadu", city: "Chennai", pincode: "600001", businessName: "Asha Foods", productServiceType: "Product-based",
  businessStartedFrom: "2020-01-01", teamSize: "5", websiteUrl: "https://ashafoods.in", domainHostingDetails: "GoDaddy",
  businessAddress: "1 Main Road", annualTurnover: "0-10L", revenueGoalAfterTbt: "50L", goalAfter90Days: "Grow",
  preferredSessionMode: "online", instagramLink: "@asha", instagramStats: "1k", facebookStats: "500",
  marketingChannels: ["Social Media"], marketingChannelName: "Asha IG", hasMarketingTeam: false, hasVideoEditing: false,
  gstNumber: "33ABCDE1234F1Z5", challenge1: "a", challenge2: "b", challenge3: "c",
};
const NONE = { noGst: false, noWebsite: false };
const errs = (p: object, ex = NONE) => profileStepErrors(p, ex, TODAY);

describe("profileStepErrors", () => {
  it("a complete profile is valid", () => expect(errs(FULL)).toEqual({}));

  it("every field is required by default", () => {
    const keys = Object.keys(errs({}));
    for (const k of ["profilePhotoUrl", "firstName", "lastName", "dob", "gender", "state", "city", "pincode", "businessName",
      "productServiceType", "businessStartedFrom", "teamSize", "websiteUrl", "domainHostingDetails", "businessAddress",
      "annualTurnover", "revenueGoalAfterTbt", "goalAfter90Days", "preferredSessionMode", "instagramLink", "instagramStats",
      "facebookStats", "marketingChannels", "hasMarketingTeam", "hasVideoEditing", "gstNumber", "challenge1", "challenge2", "challenge3"])
      expect(keys).toContain(k);
  });

  it("whitespace-only counts as empty", () => expect(errs({ ...FULL, lastName: "   " })).toHaveProperty("lastName"));

  it("No GST exempts the GST number, and only it", () => {
    expect(Object.keys(errs({ ...FULL, gstNumber: "" }))).toEqual(["gstNumber"]);
    expect(errs({ ...FULL, gstNumber: "" }, { ...NONE, noGst: true })).toEqual({});
  });

  it("GST format: 15-char GSTIN, case and spaces ignored", () => {
    expect(errs({ ...FULL, gstNumber: "33abcde1234f1z5" })).toEqual({});
    expect(errs({ ...FULL, gstNumber: "33 ABCDE 1234 F1Z5" })).toEqual({});
    for (const bad of ["12345", "33ABCDE1234F1Y5", "AAABCDE1234F1Z5", "33ABCDE1234F1Z55"])
      expect(errs({ ...FULL, gstNumber: bad })).toHaveProperty("gstNumber");
  });

  it("No website exempts website URL and domain & hosting", () => {
    const p = { ...FULL, websiteUrl: "", domainHostingDetails: "" };
    expect(Object.keys(errs(p)).sort()).toEqual(["domainHostingDetails", "websiteUrl"]);
    expect(errs(p, { ...NONE, noWebsite: true })).toEqual({});
  });

  it("website must look like a URL", () => {
    expect(errs({ ...FULL, websiteUrl: "ashafoods.in" })).toEqual({});
    expect(errs({ ...FULL, websiteUrl: "not a site" })).toHaveProperty("websiteUrl");
  });

  it("pincode is 6 digits not starting with 0", () => {
    for (const bad of ["60001", "6000011", "012345", "60000A"]) expect(errs({ ...FULL, pincode: bad })).toHaveProperty("pincode");
  });

  it("date of birth: not in the future, at least 16, at most 100", () => {
    expect(errs({ ...FULL, dob: "2027-01-01" }).dob).toMatch(/future/);
    expect(errs({ ...FULL, dob: "2015-01-01" }).dob).toMatch(/at least 16/);
    expect(errs({ ...FULL, dob: "1900-01-01" })).toHaveProperty("dob");
    expect(errs({ ...FULL, dob: "2010-11-18" })).toEqual({}); // turns 16 today
  });

  it("business start date can't be in the future; old free-text values are kept", () => {
    expect(errs({ ...FULL, businessStartedFrom: "2027-05-01" })).toHaveProperty("businessStartedFrom");
    expect(errs({ ...FULL, businessStartedFrom: "2019" })).toEqual({});
  });

  it("marketing channels: at least one; None alone needs no channel name", () => {
    expect(errs({ ...FULL, marketingChannels: [] })).toHaveProperty("marketingChannels");
    expect(errs({ ...FULL, marketingChannels: ["None"], marketingChannelName: "" })).toEqual({});
    expect(errs({ ...FULL, marketingChannels: ["SEO"], marketingChannelName: "" })).toHaveProperty("marketingChannelName");
  });

  it("team / video details are required only when answered In-house / Yes", () => {
    expect(errs({ ...FULL, hasMarketingTeam: true })).toHaveProperty("marketingTeamDetails");
    expect(errs({ ...FULL, hasVideoEditing: true })).toHaveProperty("videoEditingDetails");
    expect(errs({ ...FULL, hasMarketingTeam: true, marketingTeamDetails: "2 people", hasVideoEditing: true, videoEditingDetails: "CapCut" })).toEqual({});
  });
});

describe("skillsStepErrors", () => {
  it("website question is required; weekly orders only when Yes (0 allowed)", () => {
    expect(skillsStepErrors({})).toHaveProperty("hasWebsite");
    expect(skillsStepErrors({ hasWebsite: false })).toEqual({});
    expect(skillsStepErrors({ hasWebsite: true })).toHaveProperty("weeklyWebsiteOrders");
    expect(skillsStepErrors({ hasWebsite: true, weeklyWebsiteOrders: 0 })).toEqual({});
    expect(skillsStepErrors({ hasWebsite: true, weeklyWebsiteOrders: -1 })).toHaveProperty("weeklyWebsiteOrders");
  });
});

it("fieldLabel gives readable names for the Submit message", () => {
  expect(fieldLabel("gstNumber")).toBe("GST number");
  expect(fieldLabel("profilePhotoUrl")).toBe("Profile photo");
});
