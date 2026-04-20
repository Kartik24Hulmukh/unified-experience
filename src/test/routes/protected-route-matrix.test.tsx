import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import ProtectedRoute from "@/components/ProtectedRoute";

const authState = {
  isAuthenticated: false,
  isLoading: false,
  isHydrated: true,
  user: null as null | { role: string },
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

function renderRoute(initialPath: string, element: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>login-screen</div>} />
        <Route path="/home" element={<div>home-screen</div>} />
        <Route path="/admin/dashboard" element={element} />
        <Route path="/resale" element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute matrix", () => {
  it("redirects unauthenticated users to login with protected routes", () => {
    authState.isAuthenticated = false;
    authState.isHydrated = true;
    authState.user = null;

    renderRoute(
      "/admin/dashboard",
      <ProtectedRoute allowedRoles={["admin"]}>
        <div>admin-screen</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText("login-screen")).toBeInTheDocument();
  });

  it("redirects authenticated wrong-role users to home", () => {
    authState.isAuthenticated = true;
    authState.isHydrated = true;
    authState.user = { role: "student_verified" };

    renderRoute(
      "/admin/dashboard",
      <ProtectedRoute allowedRoles={["admin"]}>
        <div>admin-screen</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText("home-screen")).toBeInTheDocument();
  });

  it("allows authenticated admin users to access admin route", () => {
    authState.isAuthenticated = true;
    authState.isHydrated = true;
    authState.user = { role: "admin" };

    renderRoute(
      "/admin/dashboard",
      <ProtectedRoute allowedRoles={["admin"]}>
        <div>admin-screen</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText("admin-screen")).toBeInTheDocument();
  });

  it("allows any authenticated user on generic protected route without allowedRoles", () => {
    authState.isAuthenticated = true;
    authState.isHydrated = true;
    authState.user = { role: "student_verified" };

    renderRoute(
      "/resale",
      <ProtectedRoute>
        <div>resale-screen</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText("resale-screen")).toBeInTheDocument();
  });
});
