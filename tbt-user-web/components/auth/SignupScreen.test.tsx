import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ default: api }));
const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { SignupScreen } from "./SignupScreen";

const PHOTO_URL = "https://cdn.example.net/signup-photos/1-abc.png";

beforeEach(() => {
  api.post.mockReset();
  api.get.mockReset().mockResolvedValue({ data: [] });
  router.replace.mockReset();
});
afterEach(cleanup);

function pngFile(name = "me.png", type = "image/png", bytes = 16) {
  const f = new File([new Uint8Array(bytes)], name, { type });
  // jsdom's File lacks arrayBuffer in some versions.
  if (!(f as any).arrayBuffer) (f as any).arrayBuffer = async () => new ArrayBuffer(bytes);
  return f;
}

/** Picks a photo; the upload endpoint answers with PHOTO_URL. */
async function addPhoto() {
  api.post.mockResolvedValueOnce({ success: true, data: { publicUrl: PHOTO_URL } });
  fireEvent.change(screen.getByTestId("signup-photo-input"), { target: { files: [pngFile()] } });
  await waitFor(() => expect(screen.getByAltText("Your profile photo")).toBeTruthy());
}

function fill(phone: string) {
  fireEvent.change(screen.getByPlaceholderText(/first name/i), { target: { value: "Priya" } });
  fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: phone } });
  fireEvent.change(screen.getByPlaceholderText("your@email.com"), { target: { value: "Priya@Example.com" } });
  fireEvent.change(screen.getByPlaceholderText("Min. 6 characters"), { target: { value: "secret123" } });
  fireEvent.submit(screen.getByLabelText("Phone number").closest("form")!);
}

const signupCalls = () => api.post.mock.calls.filter((c) => c[0] === "/api/user-auth/signup");

describe("SignupScreen", () => {
  it("an incomplete number shows an error and never requests an OTP", async () => {
    render(<SignupScreen />);
    await addPhoto();
    fill("+44 7400");
    expect(await screen.findByText(/incomplete/i)).toBeTruthy();
    expect(signupCalls()).toHaveLength(0);
  });

  it("an autofilled UK number is sent as E.164 to /signup only, and the OTP step shows it", async () => {
    render(<SignupScreen />);
    await addPhoto();
    api.post.mockResolvedValueOnce({ success: true, data: { step: "otp_required", phone: "+447400123456" } });
    fill("+447400123456");
    await waitFor(() => expect(signupCalls()).toHaveLength(1));
    expect(api.post).toHaveBeenCalledWith("/api/user-auth/signup", expect.objectContaining({ phone: "+447400123456", email: "priya@example.com" }));
    expect(await screen.findByText(/OTP sent to \+44 7400 123456/)).toBeTruthy();

    api.post.mockResolvedValueOnce({ success: true, data: { step: "done" } });
    fireEvent.change(screen.getByPlaceholderText(/otp/i), { target: { value: "123456" } });
    fireEvent.submit(screen.getByPlaceholderText(/otp/i).closest("form")!);
    await waitFor(() => expect(api.post).toHaveBeenLastCalledWith("/api/user-auth/verify-otp", { phone: "+447400123456", otp: "123456" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/onboarding"));
  });

  it("the Business Type dropdown offers exactly Product-based, Service-based, Coaching", () => {
    render(<SignupScreen />);
    const select = screen.getByDisplayValue("Business Type (optional)") as HTMLSelectElement;
    const choices = Array.from(select.options).filter(o => !o.disabled).map(o => o.value);
    expect(choices).toEqual(["Product-based", "Service-based", "Coaching"]);
  });

  it.each(["Product-based", "Service-based", "Coaching"])("selecting %s sends it with the signup", async (type) => {
    render(<SignupScreen />);
    await addPhoto();
    api.post.mockResolvedValueOnce({ success: true, data: { step: "otp_required", phone: "+919812345678" } });
    fireEvent.change(screen.getByDisplayValue("Business Type (optional)"), { target: { value: type } });
    fill("+919812345678");
    await waitFor(() => expect(signupCalls()).toHaveLength(1));
    expect(api.post).toHaveBeenCalledWith("/api/user-auth/signup", expect.objectContaining({ productServiceType: type }));
  });
});

describe("SignupScreen — profile photo is mandatory", () => {
  it("without a photo the form is refused and no OTP is requested", async () => {
    render(<SignupScreen />);
    fill("+919812345678");
    expect(await screen.findByText("Profile photo is required")).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("the photo is uploaded on pick and its URL is sent with the signup", async () => {
    render(<SignupScreen />);
    await addPhoto();
    expect(api.post).toHaveBeenCalledWith("/api/user-auth/signup/photo", expect.anything(), expect.objectContaining({ headers: { "Content-Type": "image/png" } }));
    api.post.mockResolvedValueOnce({ success: true, data: { step: "otp_required", phone: "+919812345678" } });
    fill("+919812345678");
    await waitFor(() => expect(signupCalls()).toHaveLength(1));
    expect(signupCalls()[0][1]).toEqual(expect.objectContaining({ profilePhotoUrl: PHOTO_URL }));
    expect(screen.queryByText("Profile photo is required")).toBeNull();
  });

  it("a non-image or too-large file is refused before any upload", async () => {
    render(<SignupScreen />);
    const input = screen.getByTestId("signup-photo-input");
    fireEvent.change(input, { target: { files: [pngFile("doc.pdf", "application/pdf")] } });
    expect(await screen.findByText(/JPG, PNG, WebP or GIF/)).toBeTruthy();
    fireEvent.change(input, { target: { files: [pngFile("big.png", "image/png", 10 * 1024 * 1024 + 1)] } });
    expect(await screen.findByText(/10 MB or smaller/)).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("a failed upload shows the reason and still blocks the signup", async () => {
    render(<SignupScreen />);
    api.post.mockRejectedValueOnce(new Error("Too many photo uploads. Please try again later."));
    fireEvent.change(screen.getByTestId("signup-photo-input"), { target: { files: [pngFile()] } });
    expect(await screen.findByText(/Too many photo uploads/)).toBeTruthy();
    fill("+919812345678");
    expect(await screen.findByText("Profile photo is required")).toBeTruthy();
    expect(signupCalls()).toHaveLength(0);
  });
});
