import { z } from "zod";

// GPS accuracy bounds (metres). Server hard-enforces; client keeps sampling
// until a fix lands in this range. Sampling gives up after the window below.
export const LOCATION_ACCURACY_MIN_M = 2;
export const LOCATION_ACCURACY_MAX_M = 25;
export const LOCATION_SAMPLE_WINDOW_MS = 45_000;

const nonEmpty = (label: string, min = 2) =>
  z.string().trim().min(min, `${label} is required`);

const pincode = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Pincode must be 6 digits");

const addressBlock = (prefix: string) =>
  z.object({
    [`${prefix}AddressLine1`]: nonEmpty("Address line 1", 3),
    [`${prefix}AddressLine2`]: z.string().trim().optional().default(""),
    [`${prefix}City`]: nonEmpty("City"),
    [`${prefix}State`]: nonEmpty("State"),
    [`${prefix}Pincode`]: pincode,
  });

export const applicationSchema = z
  .object({
    fullName: nonEmpty("Full name", 3),
    email: z.string().trim().email("Enter a valid email"),
    phone: z
      .string()
      .trim()
      .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
    dateOfBirth: z
      .string()
      .refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date")
      .refine((v) => {
        const dob = new Date(v);
        const today = new Date();
        const age =
          today.getFullYear() -
          dob.getFullYear() -
          (today <
          new Date(today.getFullYear(), dob.getMonth(), dob.getDate())
            ? 1
            : 0);
        return age >= 18 && age <= 65;
      }, "Applicant must be between 18 and 65 years old"),
    gender: z.enum(["male", "female", "other", "prefer_not_to_say"], {
      errorMap: () => ({ message: "Select gender" }),
    }),
    maritalStatus: z.enum(["single", "married", "divorced", "widowed"], {
      errorMap: () => ({ message: "Select marital status" }),
    }),
    nationality: nonEmpty("Nationality"),

    aadharNumber: z
      .string()
      .trim()
      .transform((v) => v.replace(/\s+/g, ""))
      .refine((v) => /^\d{12}$/.test(v), "Aadhar must be exactly 12 digits"),

    currentLatitude: z.number({
      required_error: "Capture your current location",
      invalid_type_error: "Capture your current location",
    }),
    currentLongitude: z.number({
      required_error: "Capture your current location",
      invalid_type_error: "Capture your current location",
    }),
    locationAccuracy: z
      .number({
        required_error: "Capture your current location",
        invalid_type_error: "Capture your current location",
      })
      .min(LOCATION_ACCURACY_MIN_M, `GPS accuracy must be between ${LOCATION_ACCURACY_MIN_M} and ${LOCATION_ACCURACY_MAX_M} metres`)
      .max(LOCATION_ACCURACY_MAX_M, `GPS accuracy must be between ${LOCATION_ACCURACY_MIN_M} and ${LOCATION_ACCURACY_MAX_M} metres`),

    currentAddressLine1: nonEmpty("Current address line 1", 3),
    currentAddressLine2: z.string().trim().optional().default(""),
    currentCity: nonEmpty("Current city"),
    currentState: nonEmpty("Current state"),
    currentPincode: pincode,

    permanentAddressLine1: nonEmpty("Permanent address line 1", 3),
    permanentAddressLine2: z.string().trim().optional().default(""),
    permanentCity: nonEmpty("Permanent city"),
    permanentState: nonEmpty("Permanent state"),
    permanentPincode: pincode,

    education: nonEmpty("Highest qualification"),
    experienceYears: z
      .number({ invalid_type_error: "Enter years of experience" })
      .int("Experience must be a whole number")
      .min(0, "Experience cannot be negative")
      .max(50, "Experience seems too high"),
    coverLetter: z
      .string()
      .trim()
      .max(2000, "Cover letter must be under 2000 characters")
      .optional()
      .default(""),
  })
  .strict();

export type ApplicationInput = z.infer<typeof applicationSchema>;

// File constraints
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export function maskAadhar(a: string): string {
  const digits = a.replace(/\D/g, "");
  if (digits.length !== 12) return a;
  return `XXXX XXXX ${digits.slice(-4)}`;
}
