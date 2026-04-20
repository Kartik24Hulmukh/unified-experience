import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SignupPage from "@/pages/SignupPage";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    signup: vi.fn(),
    googleSignIn: vi.fn(),
    isAuthenticated: false,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useGoogleIdentity", () => ({
  useGoogleIdentity: () => ({
    promptSignIn: vi.fn(),
    isLoading: false,
    hasRealGIS: false,
  }),
}));

vi.mock("@/components/AuthPortal", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/SplitText", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("SignupPage contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes stable selectors and accessibility attributes for signup automation", () => {
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    const fullName = screen.getByTestId("signup-full-name-input");
    const email = screen.getByTestId("signup-email-input");
    const password = screen.getByTestId("signup-password-input");
    const submit = screen.getByTestId("signup-submit");

    expect(fullName).toHaveAttribute("id", "fullName");
    expect(fullName).toHaveAttribute("name", "fullName");
    expect(fullName).toHaveAttribute("autocomplete", "name");

    expect(email).toHaveAttribute("id", "email");
    expect(email).toHaveAttribute("name", "email");
    expect(email).toHaveAttribute("autocomplete", "email");

    expect(password).toHaveAttribute("id", "password");
    expect(password).toHaveAttribute("name", "password");
    expect(password).toHaveAttribute("autocomplete", "new-password");

    expect(submit).toHaveAttribute("type", "submit");
  });
});
