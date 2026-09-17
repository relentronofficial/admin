"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ALLOWED_MIME,
  LOCATION_ACCURACY_MAX_M,
  LOCATION_ACCURACY_MIN_M,
  LOCATION_SAMPLE_WINDOW_MS,
  MAX_FILE_SIZE,
  applicationSchema,
  type ApplicationInput,
} from "@/lib/validation";

type FormValues = ApplicationInput;

const genderOptions = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const maritalOptions = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "divorced", label: "Divorced" },
  { value: "widowed", label: "Widowed" },
];

const educationOptions = [
  "10th",
  "12th",
  "Diploma",
  "Graduate",
  "Post Graduate",
  "Other",
];

type Coords = { lat: number; lng: number; accuracy: number };

type LocationState =
  | { status: "idle" }
  | { status: "sampling"; best: Coords | null }
  | { status: "ready"; coords: Coords }
  | { status: "error"; message: string };

export default function ApplicationForm() {
  const [submitState, setSubmitState] = useState<
    | { status: "idle" }
    | { status: "submitting" }
    | { status: "success"; id: string }
    | { status: "error"; message: string }
  >({ status: "idle" });

  const [sameAsCurrent, setSameAsCurrent] = useState(false);
  const [location, setLocation] = useState<LocationState>({ status: "idle" });
  const watchIdRef = useRef<number | null>(null);
  const sampleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [aadharFile, setAadharFile] = useState<File | null>(null);
  const [aadharError, setAadharError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(applicationSchema),
    mode: "onBlur",
    defaultValues: {
      nationality: "Indian",
      experienceYears: 0,
      coverLetter: "",
    },
  });

  const currentValues = watch([
    "currentAddressLine1",
    "currentAddressLine2",
    "currentCity",
    "currentState",
    "currentPincode",
  ]);

  // Mirror current -> permanent when checkbox is on
  useEffect(() => {
    if (!sameAsCurrent) return;
    setValue("permanentAddressLine1", currentValues[0] || "", { shouldValidate: true });
    setValue("permanentAddressLine2", currentValues[1] || "", { shouldValidate: false });
    setValue("permanentCity", currentValues[2] || "", { shouldValidate: true });
    setValue("permanentState", currentValues[3] || "", { shouldValidate: true });
    setValue("permanentPincode", currentValues[4] || "", { shouldValidate: true });
  }, [sameAsCurrent, currentValues, setValue]);

  // Push location values into the form when captured
  useEffect(() => {
    if (location.status !== "ready") return;
    setValue("currentLatitude", location.coords.lat);
    setValue("currentLongitude", location.coords.lng);
    setValue("locationAccuracy", location.coords.accuracy);
  }, [location, setValue]);

  const stopSampling = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (sampleTimerRef.current) {
      clearTimeout(sampleTimerRef.current);
      sampleTimerRef.current = null;
    }
  };

  useEffect(() => () => stopSampling(), []);

  const captureLocation = () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setLocation({
        status: "error",
        message: "Geolocation is not supported by this browser.",
      });
      return;
    }

    stopSampling();
    setLocation({ status: "sampling", best: null });

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const sample: Coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        // Auto-accept as soon as a fix lands in the target range.
        if (
          sample.accuracy >= LOCATION_ACCURACY_MIN_M &&
          sample.accuracy <= LOCATION_ACCURACY_MAX_M
        ) {
          stopSampling();
          setLocation({ status: "ready", coords: sample });
          return;
        }
        setLocation((prev) => {
          if (prev.status !== "sampling") return prev;
          const nextBest =
            prev.best && prev.best.accuracy <= sample.accuracy
              ? prev.best
              : sample;
          return { status: "sampling", best: nextBest };
        });
      },
      (err) => {
        stopSampling();
        setLocation({
          status: "error",
          message:
            err.code === err.PERMISSION_DENIED
              ? "Location permission denied. Please allow location access."
              : err.message || "Unable to fetch location.",
        });
      },
      { enableHighAccuracy: true, timeout: LOCATION_SAMPLE_WINDOW_MS, maximumAge: 0 },
    );

    // If the window closes without an in-range fix, report the best we saw.
    sampleTimerRef.current = setTimeout(() => {
      stopSampling();
      setLocation((prev) => {
        if (prev.status !== "sampling") return prev;
        const best = prev.best;
        if (best && best.accuracy >= LOCATION_ACCURACY_MIN_M && best.accuracy <= LOCATION_ACCURACY_MAX_M) {
          return { status: "ready", coords: best };
        }
        const detail = best
          ? ` Best was ±${Math.round(best.accuracy)} m.`
          : "";
        return {
          status: "error",
          message: `Couldn't get a location fix within ${LOCATION_ACCURACY_MAX_M} m.${detail} Move outdoors under open sky and try again.`,
        };
      });
    }, LOCATION_SAMPLE_WINDOW_MS);
  };

  const onAadharChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAadharError(null);
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setAadharFile(null);
      return;
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      setAadharError("File must be JPG, PNG, WebP, or PDF.");
      setAadharFile(null);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setAadharError("File must be under 5 MB.");
      setAadharFile(null);
      return;
    }
    setAadharFile(file);
  };

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    setSubmitState({ status: "submitting" });
    if (!aadharFile) {
      setAadharError("Please upload your Aadhar card.");
      setSubmitState({ status: "idle" });
      return;
    }
    if (location.status !== "ready") {
      setSubmitState({
        status: "error",
        message: "Please capture your current location before submitting.",
      });
      return;
    }

    const fd = new FormData();
    for (const [k, v] of Object.entries(values)) {
      if (v === undefined || v === null) continue;
      fd.append(k, String(v));
    }
    fd.set("currentLatitude", String(location.coords.lat));
    fd.set("currentLongitude", String(location.coords.lng));
    fd.set("locationAccuracy", String(location.coords.accuracy));
    fd.append("aadharFile", aadharFile);

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { id: string };
        error?: string;
        fieldErrors?: Record<string, string>;
      };

      if (!res.ok || !json.success) {
        if (json.fieldErrors) {
          for (const [key, msg] of Object.entries(json.fieldErrors)) {
            setError(key as keyof FormValues, { message: msg });
          }
        }
        setSubmitState({
          status: "error",
          message: json.error || "Submission failed. Please try again.",
        });
        return;
      }

      setSubmitState({ status: "success", id: json.data?.id ?? "" });
      reset();
      setAadharFile(null);
      setSameAsCurrent(false);
      setLocation({ status: "idle" });
    } catch {
      setSubmitState({
        status: "error",
        message: "Network error. Please try again.",
      });
    }
  };

  const locationSummary = useMemo(() => {
    if (location.status !== "ready") return null;
    const { lat, lng, accuracy } = location.coords;
    return `${lat.toFixed(6)}, ${lng.toFixed(6)} (±${Math.round(accuracy)} m)`;
  }, [location]);

  if (submitState.status === "success") {
    return (
      <div className="card p-8 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 grid place-items-center text-emerald-600 text-2xl">
          ✓
        </div>
        <h2 className="mt-4 text-xl font-semibold text-slate-900">
          Application submitted!
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Thank you for applying. Your reference ID is{" "}
          <span className="font-mono text-slate-900">{submitState.id}</span>.
          Our team will review and contact you shortly.
        </p>
        <button
          type="button"
          className="btn-ghost mt-6"
          onClick={() => setSubmitState({ status: "idle" })}
        >
          Submit another application
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6"
      noValidate
    >
      {/* Demographics */}
      <section className="card p-6">
        <div className="mb-4">
          <h2 className="section-title">Personal details</h2>
          <p className="section-subtitle">Tell us about yourself.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">
              Full name <span className="text-red-600">*</span>
            </label>
            <input className="input" {...register("fullName")} autoComplete="name" />
            {errors.fullName && <p className="field-error">{errors.fullName.message}</p>}
          </div>

          <div>
            <label className="label">
              Email <span className="text-red-600">*</span>
            </label>
            <input
              type="email"
              className="input"
              {...register("email")}
              autoComplete="email"
            />
            {errors.email && <p className="field-error">{errors.email.message}</p>}
          </div>

          <div>
            <label className="label">
              Phone (10-digit) <span className="text-red-600">*</span>
            </label>
            <input
              inputMode="numeric"
              maxLength={10}
              className="input"
              placeholder="9876543210"
              {...register("phone")}
              autoComplete="tel"
            />
            {errors.phone && <p className="field-error">{errors.phone.message}</p>}
          </div>

          <div>
            <label className="label">
              Date of birth <span className="text-red-600">*</span>
            </label>
            <input type="date" className="input" {...register("dateOfBirth")} />
            {errors.dateOfBirth && (
              <p className="field-error">{errors.dateOfBirth.message}</p>
            )}
          </div>

          <div>
            <label className="label">
              Gender <span className="text-red-600">*</span>
            </label>
            <select className="select" defaultValue="" {...register("gender")}>
              <option value="" disabled>
                Select gender
              </option>
              {genderOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {errors.gender && <p className="field-error">{errors.gender.message}</p>}
          </div>

          <div>
            <label className="label">
              Marital status <span className="text-red-600">*</span>
            </label>
            <select
              className="select"
              defaultValue=""
              {...register("maritalStatus")}
            >
              <option value="" disabled>
                Select status
              </option>
              {maritalOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {errors.maritalStatus && (
              <p className="field-error">{errors.maritalStatus.message}</p>
            )}
          </div>

          <div>
            <label className="label">
              Nationality <span className="text-red-600">*</span>
            </label>
            <input className="input" {...register("nationality")} />
            {errors.nationality && (
              <p className="field-error">{errors.nationality.message}</p>
            )}
          </div>
        </div>
      </section>

      {/* Aadhar */}
      <section className="card p-6">
        <div className="mb-4">
          <h2 className="section-title">Identity — Aadhar</h2>
          <p className="section-subtitle">
            Aadhar number and a clear scan or photo of the card.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">
              Aadhar number <span className="text-red-600">*</span>
            </label>
            <input
              inputMode="numeric"
              maxLength={14}
              className="input font-mono tracking-wider"
              placeholder="1234 5678 9012"
              {...register("aadharNumber")}
            />
            {errors.aadharNumber && (
              <p className="field-error">{errors.aadharNumber.message}</p>
            )}
          </div>
          <div>
            <label className="label">
              Aadhar card file <span className="text-red-600">*</span>
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={onAadharChange}
              className="input file:mr-3 file:rounded file:border-0 file:bg-brand-600 file:px-3 file:py-1 file:text-white file:font-medium hover:file:bg-brand-700"
            />
            <p className="mt-1 text-xs text-slate-500">
              JPG, PNG, WebP, or PDF — up to 5 MB.
            </p>
            {aadharFile && (
              <p className="mt-1 text-xs text-emerald-700">
                Selected: {aadharFile.name} (
                {(aadharFile.size / 1024).toFixed(0)} KB)
              </p>
            )}
            {aadharError && <p className="field-error">{aadharError}</p>}
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="card p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="section-title">
              Current location <span className="text-red-600">*</span>
            </h2>
          </div>
          <button
            type="button"
            className="btn-ghost whitespace-nowrap"
            onClick={captureLocation}
            disabled={location.status === "sampling"}
          >
            {location.status === "sampling"
              ? "Capturing…"
              : location.status === "ready"
                ? "Recapture"
                : "Capture location"}
          </button>
        </div>

        {location.status === "sampling" && (
          <p className="text-sm text-slate-700">
            Getting the best possible GPS fix…
            {location.best && (
              <span className="ml-2 text-xs text-slate-500 font-mono">
                (best so far ±{Math.round(location.best.accuracy)} m)
              </span>
            )}
          </p>
        )}

        {location.status === "ready" && (
          <p className="text-sm text-emerald-700">
            ✓ Location captured:{" "}
            <span className="font-mono">{locationSummary}</span>
          </p>
        )}

        {location.status === "error" && (
          <p className="text-sm text-red-600">{location.message}</p>
        )}
      </section>

      {/* Current address */}
      <section className="card p-6">
        <div className="mb-4">
          <h2 className="section-title">Current address</h2>
          <p className="section-subtitle">
            Where you currently live. Enter manually.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">
              Address line 1 <span className="text-red-600">*</span>
            </label>
            <input className="input" {...register("currentAddressLine1")} />
            {errors.currentAddressLine1 && (
              <p className="field-error">{errors.currentAddressLine1.message}</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="label">Address line 2</label>
            <input className="input" {...register("currentAddressLine2")} />
          </div>
          <div>
            <label className="label">
              City <span className="text-red-600">*</span>
            </label>
            <input className="input" {...register("currentCity")} />
            {errors.currentCity && (
              <p className="field-error">{errors.currentCity.message}</p>
            )}
          </div>
          <div>
            <label className="label">
              State <span className="text-red-600">*</span>
            </label>
            <input className="input" {...register("currentState")} />
            {errors.currentState && (
              <p className="field-error">{errors.currentState.message}</p>
            )}
          </div>
          <div>
            <label className="label">
              Pincode <span className="text-red-600">*</span>
            </label>
            <input
              inputMode="numeric"
              maxLength={6}
              className="input"
              {...register("currentPincode")}
            />
            {errors.currentPincode && (
              <p className="field-error">{errors.currentPincode.message}</p>
            )}
          </div>
        </div>
      </section>

      {/* Permanent address */}
      <section className="card p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="section-title">Permanent address</h2>
            <p className="section-subtitle">
              Your permanent registered address.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              checked={sameAsCurrent}
              onChange={(e) => setSameAsCurrent(e.target.checked)}
            />
            Same as current
          </label>
        </div>
        <div
          className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
            sameAsCurrent ? "opacity-60" : ""
          }`}
        >
          <div className="sm:col-span-2">
            <label className="label">
              Address line 1 <span className="text-red-600">*</span>
            </label>
            <input
              className="input"
              disabled={sameAsCurrent}
              {...register("permanentAddressLine1")}
            />
            {errors.permanentAddressLine1 && (
              <p className="field-error">
                {errors.permanentAddressLine1.message}
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="label">Address line 2</label>
            <input
              className="input"
              disabled={sameAsCurrent}
              {...register("permanentAddressLine2")}
            />
          </div>
          <div>
            <label className="label">
              City <span className="text-red-600">*</span>
            </label>
            <input
              className="input"
              disabled={sameAsCurrent}
              {...register("permanentCity")}
            />
            {errors.permanentCity && (
              <p className="field-error">{errors.permanentCity.message}</p>
            )}
          </div>
          <div>
            <label className="label">
              State <span className="text-red-600">*</span>
            </label>
            <input
              className="input"
              disabled={sameAsCurrent}
              {...register("permanentState")}
            />
            {errors.permanentState && (
              <p className="field-error">{errors.permanentState.message}</p>
            )}
          </div>
          <div>
            <label className="label">
              Pincode <span className="text-red-600">*</span>
            </label>
            <input
              inputMode="numeric"
              maxLength={6}
              className="input"
              disabled={sameAsCurrent}
              {...register("permanentPincode")}
            />
            {errors.permanentPincode && (
              <p className="field-error">{errors.permanentPincode.message}</p>
            )}
          </div>
        </div>
      </section>

      {/* Job-related */}
      <section className="card p-6">
        <div className="mb-4">
          <h2 className="section-title">Qualifications</h2>
          <p className="section-subtitle">Education, experience, and a short note.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">
              Highest qualification <span className="text-red-600">*</span>
            </label>
            <select
              className="select"
              defaultValue=""
              {...register("education")}
            >
              <option value="" disabled>
                Select
              </option>
              {educationOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            {errors.education && (
              <p className="field-error">{errors.education.message}</p>
            )}
          </div>
          <div>
            <label className="label">
              Experience (years) <span className="text-red-600">*</span>
            </label>
            <input
              type="number"
              min={0}
              max={50}
              step={1}
              className="input"
              {...register("experienceYears", { valueAsNumber: true })}
            />
            {errors.experienceYears && (
              <p className="field-error">{errors.experienceYears.message}</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="label">Why do you want this role? (optional)</label>
            <textarea
              rows={4}
              className="textarea"
              maxLength={2000}
              placeholder="A brief note about yourself and why you're a good fit…"
              {...register("coverLetter")}
            />
            {errors.coverLetter && (
              <p className="field-error">{errors.coverLetter.message}</p>
            )}
          </div>
        </div>
      </section>

      {submitState.status === "error" && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {submitState.message}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={isSubmitting || submitState.status === "submitting"}
          className="btn-primary"
        >
          {isSubmitting || submitState.status === "submitting"
            ? "Submitting…"
            : "Submit application"}
        </button>
      </div>
    </form>
  );
}
