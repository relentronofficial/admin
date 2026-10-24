import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ default: api }));
const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { SignupScreen } from "./SignupScreen";

beforeEach(() => {
  api.post.mockReset();
  api.get.mockReset().mockResolvedValue({ data: [] });
  router.replace.mockReset();
});
afterEach(cleanup);

function fill(phone: string) {
  fireEvent.change(screen.getByPlaceholderText(/first name/i), { target: { value: "Priya" } });
  fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: phone } });
  fireEvent.change(screen.getByPlaceholderText("your@email.com"), { target: { value: "Priya@Example.com" } });
  fireEvent.change(screen.getByPlaceholderText("Min. 6 characters"), { target: { value: "secret123" } });
  fireEvent.submit(screen.getByLabelText("Phone number").closest("form")!);
}

describe("SignupScreen", () => {
  it("an incomplete number shows an error and never requests an OTP", async () => {
    render(<SignupScreen />);
    fill("+44 7400");
    expect(await screen.findByText(/incomplete/i)).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("an autofilled UK number is sent as E.164 to /signup only, and the OTP step shows it", async () => {
    api.post.mockResolvedValueOnce({ success: true, data: { step: "otp_required", phone: "+447400123456" } });
    render(<SignupScreen />);
    fill("+447400123456");
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post).toHaveBeenCalledWith("/api/user-auth/signup", expect.objectContaining({ phone: "+447400123456", email: "priya@example.com" }));
    expect(await screen.findByText(/OTP sent to \+44 7400 123456/)).toBeTruthy();

    api.post.mockResolvedValueOnce({ success: true, data: { step: "done" } });
    fireEvent.change(screen.getByPlaceholderText(/otp/i), { target: { value: "123456" } });
    fireEvent.submit(screen.getByPlaceholderText(/otp/i).closest("form")!);
    await waitFor(() => expect(api.post).toHaveBeenLastCalledWith("/api/user-auth/verify-otp", { phone: "+447400123456", otp: "123456" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/onboarding"));
  });
});
