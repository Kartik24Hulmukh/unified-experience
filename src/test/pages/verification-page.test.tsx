import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import VerificationPage from "@/pages/VerificationPage";

const mockNavigate = vi.fn();
const mockVerifyOtp = vi.fn();
const mockToast = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    verifyOtp: mockVerifyOtp,
    isAuthenticated: false,
    isLoading: false,
    isHydrated: true,
  }),
}));

vi.mock("@/components/AuthPortal", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/SplitText", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/input-otp", () => ({
  InputOTP: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <input
      aria-label="Verification code"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
  InputOTPGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  InputOTPSlot: () => null,
}));

vi.mock("@/components/ui/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: "/verify" }),
  };
});

describe("VerificationPage", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockVerifyOtp.mockReset();
    mockToast.mockReset();
    mockVerifyOtp.mockResolvedValue(undefined);
    sessionStorage.clear();
    sessionStorage.setItem(
      "berozgar_pending",
      JSON.stringify({ email: "student@mctrgit.ac.in", fullName: "Student User" }),
    );
  });

  it("auto-submits the full OTP using the latest typed value", async () => {
    render(
      <MemoryRouter>
        <VerificationPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "123456" },
    });

    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalledWith("123456");
    });
  });
});