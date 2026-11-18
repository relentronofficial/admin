// Onboarding wizard ("sign-up form") validation. Every field is required unless
// an exemption applies:
//   - "No GST"      → GST Number is not needed.
//   - "No website"  → Website URL and Domain & Hosting Details are not needed.
//   - Marketing channel "None" only → Marketing Channel Name is not needed.
//   - Team / video-editing details are asked only when the member answered "In-house" / "Yes".
// Pure functions (no React), so the step checks and the final Submit gate use
// the same rules and can be unit-tested.

export type Profile = Record<string, any>;
export interface Exemptions {
  noGst: boolean;
  noWebsite: boolean;
}

export const FIELD_LABELS: Record<string, string> = {
  profilePhotoUrl: "Profile photo",
  firstName: "First name",
  lastName: "Last name",
  dob: "Date of birth",
  gender: "Gender",
  state: "State",
  city: "City",
  pincode: "Pincode",
  businessName: "Brand name",
  productServiceType: "Business type",
  businessStartedFrom: "Business started from",
  teamSize: "Team size",
  websiteUrl: "Website URL",
  businessAddress: "Business address",
  annualTurnover: "Revenue until now",
  revenueGoalAfterTbt: "Revenue goal after TBT",
  goalAfter90Days: "Learning goals",
  preferredSessionMode: "Preferred session mode",
  instagramLink: "Instagram link",
  instagramStats: "Instagram posts & followers",
  facebookStats: "Facebook posts & followers",
  marketingChannels: "Existing marketing channels",
  marketingChannelName: "Marketing channel name",
  domainHostingDetails: "Domain & hosting details",
  hasMarketingTeam: "Social media handling",
  marketingTeamDetails: "Social media team details",
  hasVideoEditing: "Video editing capability",
  videoEditingDetails: "Video editing details",
  gstNumber: "GST number",
  challenge1: "Key challenge 1",
  challenge2: "Key challenge 2",
  challenge3: "Key challenge 3",
  hasWebsite: "Do you have a website?",
  weeklyWebsiteOrders: "Weekly orders from your website",
};

export const fieldLabel = (key: string) => FIELD_LABELS[key] ?? key;

const PINCODE_RE = /^[1-9]\d{5}$/;
// 15-character GSTIN: 2-digit state code, PAN (5 letters, 4 digits, 1 letter), entity number, "Z", checksum.
const GST_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const URL_RE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;
const MIN_AGE = 16;

const text = (p: Profile, k: string) => (p[k] ?? "").toString().trim();

export const normalizeGst = (v: unknown) => (v ?? "").toString().replace(/\s+/g, "").toUpperCase();

function ageOn(dob: Date, today: Date) {
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

/** Errors for the "Profile" step, keyed by field. Empty object = valid. */
export function profileStepErrors(p: Profile, ex: Exemptions, today = new Date()): Record<string, string> {
  const e: Record<string, string> = {};
  const req = (k: string, msg: string) => { if (!text(p, k)) e[k] = msg; };

  if (!text(p, "profilePhotoUrl")) e.profilePhotoUrl = "Profile photo is required.";
  req("firstName", "First name is required");
  req("lastName", "Last name is required");

  const dob = text(p, "dob");
  if (!dob) e.dob = "Date of birth is required";
  else {
    const d = new Date(dob.slice(0, 10));
    if (Number.isNaN(d.getTime())) e.dob = "Enter a valid date of birth";
    else if (d > today) e.dob = "Date of birth can't be in the future";
    else if (ageOn(d, today) < MIN_AGE) e.dob = `You must be at least ${MIN_AGE} years old`;
    else if (ageOn(d, today) > 100) e.dob = "Enter a valid date of birth";
  }
  req("gender", "Please select your gender");

  req("state", "State is required");
  req("city", "City is required");
  const pin = text(p, "pincode");
  if (!pin) e.pincode = "Pincode is required";
  else if (!PINCODE_RE.test(pin)) e.pincode = "Enter a valid 6-digit pincode";

  req("businessName", "Brand name is required");
  req("productServiceType", "Please select a business type");
  const started = text(p, "businessStartedFrom");
  if (!started) e.businessStartedFrom = "This field is required";
  else if (ISO_DATE_RE.test(started) && new Date(started.slice(0, 10)) > today) e.businessStartedFrom = "This date can't be in the future";
  req("teamSize", "Team size is required");

  if (!ex.noWebsite) {
    const url = text(p, "websiteUrl");
    if (!url) e.websiteUrl = "Website URL is required (or tick “No website”)";
    else if (!URL_RE.test(url)) e.websiteUrl = "Enter a valid website, e.g. https://yourbrand.com";
    req("domainHostingDetails", "Domain & hosting details are required (or tick “No website”)");
  }
  req("businessAddress", "Business address is required");

  req("annualTurnover", "Please select your revenue range");
  req("revenueGoalAfterTbt", "Revenue goal is required");
  req("goalAfter90Days", "Learning goal is required");
  if (p.preferredSessionMode == null || p.preferredSessionMode === "") e.preferredSessionMode = "Please select a session mode";

  req("instagramLink", "Instagram link is required");
  req("instagramStats", "Instagram stats are required");
  req("facebookStats", "Facebook stats are required");

  const channels: string[] = Array.isArray(p.marketingChannels) ? p.marketingChannels : [];
  if (!channels.length) e.marketingChannels = "Select at least one channel (or “None”)";
  const onlyNone = channels.length > 0 && channels.every((c) => c === "None");
  if (channels.length && !onlyNone) req("marketingChannelName", "Marketing channel name is required");

  if (p.hasMarketingTeam == null) e.hasMarketingTeam = "Please select an option";
  else if (p.hasMarketingTeam === true) req("marketingTeamDetails", "Please describe your social media team or agency");
  if (p.hasVideoEditing == null) e.hasVideoEditing = "Please select an option";
  else if (p.hasVideoEditing === true) req("videoEditingDetails", "Please describe your video editing setup");

  if (!ex.noGst) {
    const gst = normalizeGst(p.gstNumber);
    if (!gst) e.gstNumber = "GST number is required (or tick “No GST”)";
    else if (!GST_RE.test(gst)) e.gstNumber = "Enter a valid 15-character GST number, e.g. 22AAAAA0000A1Z5";
  }

  req("challenge1", "Please enter your primary business obstacle");
  req("challenge2", "Please enter your secondary concern");
  req("challenge3", "Please enter other support you need");
  return e;
}

/** Errors for the "Skills" step (the sliders always have a value). */
export function skillsStepErrors(p: Profile): Record<string, string> {
  const e: Record<string, string> = {};
  if (p.hasWebsite == null) e.hasWebsite = "Please select Yes or No";
  else if (p.hasWebsite === true) {
    const n = p.weeklyWebsiteOrders;
    if (n === undefined || n === null || n === "") e.weeklyWebsiteOrders = "Weekly orders are required (enter 0 if none)";
    else if (!Number.isFinite(Number(n)) || Number(n) < 0) e.weeklyWebsiteOrders = "Enter 0 or more";
  }
  return e;
}
