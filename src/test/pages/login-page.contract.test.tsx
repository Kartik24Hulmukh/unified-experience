import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/pages/LoginPage";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    login: vi.fn(),
    googleSignIn: vi.fn(),
    isAuthenticated: false,
    isLoading: false,
    user: null,
  }),
}));

vi.mock("@/hooks/useGoogleIdentity", () => ({
  useGoogleIdentity: () => ({
    promptSignIn: vi.fn(),
    isLoading: false,
    hasRealGIS: true,
  }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => true,
}));

vi.mock("@/components/SplitText", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("LoginPage contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes stable selectors and accessibility attributes for auth automation", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    const email = screen.getByTestId("email-input");
    const password = screen.getByTestId("password-input");
    const submit = screen.getByTestId("login-submit");

    expect(email).toHaveAttribute("id", "email");
    expect(email).toHaveAttribute("name", "email");
    expect(email).toHaveAttribute("autocomplete", "email");

    expect(password).toHaveAttribute("id", "password");
    expect(password).toHaveAttribute("name", "password");
    expect(password).toHaveAttribute("autocomplete", "current-password");

    expect(submit).toHaveAttribute("type", "submit");
  });
});
