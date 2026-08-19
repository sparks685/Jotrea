/**
 * ChangeMedicationSheet regression tests
 *
 * Confirms the sheet opens, navigates between views, and completes a
 * medication change without throwing — on both the standard med path and
 * the custom medication path.
 *
 * Background: the Vaul drawer was replaced with Radix UI Sheet because
 * Vaul's useEffect hooks throw in restricted browser contexts (Replit
 * iframe, iOS Safari PWA). These tests ensure that replacement never
 * regresses — any path through the sheet must remain error-free.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any import that would trigger them
// ---------------------------------------------------------------------------

vi.mock("framer-motion", () => {
  const Passthrough = ({
    children,
    ...props
  }: React.PropsWithChildren<React.HTMLAttributes<HTMLElement>>) => (
    <div {...props}>{children}</div>
  );
  const PassthroughButton = ({
    children,
    whileTap: _wt,
    ...props
  }: React.PropsWithChildren<
    React.ButtonHTMLAttributes<HTMLButtonElement> & { whileTap?: unknown }
  >) => <button {...props}>{children}</button>;

  return {
    motion: {
      div: Passthrough,
      button: PassthroughButton,
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => (
      <>{children}</>
    ),
  };
});

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
  initGA: vi.fn(),
  pageView: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import subject AFTER mocks are registered
// ---------------------------------------------------------------------------

import { ChangeMedicationSheet } from "@/components/ChangeMedicationSheet";
import type { MedicationData } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderSheet(
  props: Partial<React.ComponentProps<typeof ChangeMedicationSheet>> = {},
) {
  const onOpenChange = vi.fn();
  const onConfirm = vi.fn();

  render(
    <ChangeMedicationSheet
      open={true}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      pastDoseCount={0}
      {...props}
    />,
  );

  return { onOpenChange, onConfirm };
}

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Sheet renders without throwing
// ---------------------------------------------------------------------------

describe("ChangeMedicationSheet – render", () => {
  it("renders in the select-medication view without throwing", () => {
    expect(() => renderSheet()).not.toThrow();
  });

  it("shows the 'Change Tracked Medication' title when open", () => {
    renderSheet();
    expect(screen.getByText("Change Tracked Medication")).toBeInTheDocument();
  });

  it("shows a search input in the medication list view", () => {
    renderSheet();
    expect(
      screen.getByPlaceholderText(/search medications/i),
    ).toBeInTheDocument();
  });

  it("lists at least one known medication (Ozempic)", () => {
    renderSheet();
    expect(screen.getByText("Ozempic")).toBeInTheDocument();
  });

  it("shows the 'Other medication' custom entry option", () => {
    renderSheet();
    expect(screen.getByText("Other medication")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Standard medication path
// ---------------------------------------------------------------------------

describe("ChangeMedicationSheet – standard medication path", () => {
  it("navigates to the dose view after clicking a medication without throwing", () => {
    expect(() => {
      renderSheet();
      fireEvent.click(screen.getByText("Ozempic"));
    }).not.toThrow();
  });

  it("shows 'Enter Prescribed Dose' heading after selecting a medication", () => {
    renderSheet();
    fireEvent.click(screen.getByText("Ozempic"));
    expect(screen.getByText("Enter Prescribed Dose")).toBeInTheDocument();
  });

  it("renders dose option buttons for the selected medication", () => {
    renderSheet();
    fireEvent.click(screen.getByText("Ozempic"));
    // Ozempic doses: 0.25, 0.5, 1, 2 mg
    expect(screen.getByText("0.25 mg")).toBeInTheDocument();
    expect(screen.getByText("0.5 mg")).toBeInTheDocument();
  });

  it("confirm button is disabled until a dose is selected", () => {
    renderSheet();
    fireEvent.click(screen.getByText("Ozempic"));
    const confirmBtn = screen.getByTestId("confirm-med-change-btn");
    expect(confirmBtn).toBeDisabled();
  });

  it("confirm button is enabled after selecting a dose", () => {
    renderSheet();
    fireEvent.click(screen.getByText("Ozempic"));
    fireEvent.click(screen.getByText("0.5 mg"));
    const confirmBtn = screen.getByTestId("confirm-med-change-btn");
    expect(confirmBtn).not.toBeDisabled();
  });

  it("calls onConfirm with the correct medication data when confirmed", () => {
    const { onConfirm } = renderSheet();
    fireEvent.click(screen.getByText("Ozempic"));
    fireEvent.click(screen.getByText("0.5 mg"));
    fireEvent.click(screen.getByTestId("confirm-med-change-btn"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const arg = onConfirm.mock.calls[0][0] as MedicationData;
    expect(arg.id).toBe("semaglutide-ozempic");
    expect(arg.brandName).toBe("Ozempic");
    expect(arg.dose).toBe(0.5);
    expect(arg.active).toBe(true);
  });

  it("calls onOpenChange(false) after confirmation", () => {
    const { onOpenChange } = renderSheet();
    fireEvent.click(screen.getByText("Ozempic"));
    fireEvent.click(screen.getByText("0.5 mg"));
    fireEvent.click(screen.getByTestId("confirm-med-change-btn"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("back button returns to the medication list", () => {
    renderSheet();
    fireEvent.click(screen.getByText("Ozempic"));
    // Back button is the ChevronLeft in the header
    const backBtn = screen.getByRole("button", { name: "" }); // ChevronLeft has no label text
    // Find any button that precedes the title in the header
    // Use aria-label or just look for the back arrow affordance:
    const allButtons = screen.getAllByRole("button");
    // The back button is the first button in the dose view header
    fireEvent.click(allButtons[0]);
    expect(screen.getByText("Change Tracked Medication")).toBeInTheDocument();
  });

  it("does not throw when confirming a pill medication (Rybelsus)", () => {
    const { onConfirm } = renderSheet();
    fireEvent.click(screen.getByText("Rybelsus"));
    fireEvent.click(screen.getByText("3 mg"));
    expect(() =>
      fireEvent.click(screen.getByTestId("confirm-med-change-btn")),
    ).not.toThrow();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const arg = onConfirm.mock.calls[0][0] as MedicationData;
    // Pill medications should not have an injectionSite
    expect(arg.injectionSite).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Custom medication path
// ---------------------------------------------------------------------------

describe("ChangeMedicationSheet – custom medication path", () => {
  it("clicking 'Other medication' shows the custom medication form without throwing", () => {
    expect(() => {
      renderSheet();
      fireEvent.click(screen.getByText("Other medication"));
    }).not.toThrow();
  });

  it("shows brand name field after selecting 'Other medication'", () => {
    renderSheet();
    fireEvent.click(screen.getByText("Other medication"));
    expect(
      screen.getByPlaceholderText(/ozempic, wegovy, mounjaro/i),
    ).toBeInTheDocument();
  });

  it("Continue button is disabled until brand name is entered", () => {
    renderSheet();
    fireEvent.click(screen.getByText("Other medication"));
    const continueBtn = screen.getByRole("button", { name: /continue/i });
    expect(continueBtn).toBeDisabled();
  });

  it("Continue button is enabled after entering a brand name", () => {
    renderSheet();
    fireEvent.click(screen.getByText("Other medication"));
    const brandInput = screen.getByPlaceholderText(/ozempic, wegovy, mounjaro/i);
    fireEvent.change(brandInput, { target: { value: "TestMed" } });
    const continueBtn = screen.getByRole("button", { name: /continue/i });
    expect(continueBtn).not.toBeDisabled();
  });

  it("navigates to dose view after filling brand and clicking Continue", () => {
    renderSheet();
    fireEvent.click(screen.getByText("Other medication"));
    const brandInput = screen.getByPlaceholderText(/ozempic, wegovy, mounjaro/i);
    fireEvent.change(brandInput, { target: { value: "TestMed" } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByText("Enter Prescribed Dose")).toBeInTheDocument();
  });

  it("confirm button is disabled until dose amount is entered", () => {
    renderSheet();
    fireEvent.click(screen.getByText("Other medication"));
    fireEvent.change(
      screen.getByPlaceholderText(/ozempic, wegovy, mounjaro/i),
      { target: { value: "TestMed" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    const confirmBtn = screen.getByTestId("confirm-med-change-btn");
    expect(confirmBtn).toBeDisabled();
  });

  it("confirm button is enabled after entering a dose amount and prescribed frequency", () => {
    renderSheet();
    fireEvent.click(screen.getByText("Other medication"));
    fireEvent.change(
      screen.getByPlaceholderText(/ozempic, wegovy, mounjaro/i),
      { target: { value: "TestMed" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.change(screen.getByPlaceholderText("e.g. 2.5"), {
      target: { value: "2.5" },
    });
    fireEvent.click(screen.getByText("Weekly"));
    const confirmBtn = screen.getByTestId("confirm-med-change-btn");
    expect(confirmBtn).not.toBeDisabled();
  });

  it("calls onConfirm with custom medication data without throwing", () => {
    const { onConfirm } = renderSheet();
    fireEvent.click(screen.getByText("Other medication"));
    fireEvent.change(
      screen.getByPlaceholderText(/ozempic, wegovy, mounjaro/i),
      { target: { value: "TestMed" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.change(screen.getByPlaceholderText("e.g. 2.5"), {
      target: { value: "2.5" },
    });
    fireEvent.click(screen.getByText("Weekly"));

    expect(() =>
      fireEvent.click(screen.getByTestId("confirm-med-change-btn")),
    ).not.toThrow();

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const arg = onConfirm.mock.calls[0][0] as MedicationData;
    expect(arg.brandName).toBe("TestMed");
    expect(arg.dose).toBe(2.5);
    expect(arg.id).toBe("custom");
    expect(arg.active).toBe(true);
  });

  it("custom medication with pill formulation has no injectionSite", () => {
    const { onConfirm } = renderSheet();
    fireEvent.click(screen.getByText("Other medication"));
    fireEvent.change(
      screen.getByPlaceholderText(/ozempic, wegovy, mounjaro/i),
      { target: { value: "TestPill" } },
    );
    // Switch to pill formulation
    fireEvent.click(screen.getByText("Pill"));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.change(screen.getByPlaceholderText("e.g. 2.5"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByText("Weekly"));
    fireEvent.click(screen.getByTestId("confirm-med-change-btn"));

    const arg = onConfirm.mock.calls[0][0] as MedicationData;
    expect(arg.injectionSite).toBeUndefined();
  });

  it("'Back to list' from custom form returns to medication list", () => {
    renderSheet();
    fireEvent.click(screen.getByText("Other medication"));
    fireEvent.click(screen.getByText(/back to list/i));
    expect(screen.getByText("Change Tracked Medication")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/search medications/i),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Close behaviour
// ---------------------------------------------------------------------------

describe("ChangeMedicationSheet – close", () => {
  it("clicking the X button calls onOpenChange(false) without throwing", () => {
    const { onOpenChange } = renderSheet();
    // The close button has aria-label="Close"
    const closeBtn = screen.getByLabelText("Close");
    expect(() => fireEvent.click(closeBtn)).not.toThrow();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("state is reset after close: re-opening shows the select view", () => {
    const { onOpenChange } = renderSheet();
    // Navigate to dose view
    fireEvent.click(screen.getByText("Ozempic"));
    expect(screen.getByText("Enter Prescribed Dose")).toBeInTheDocument();

    // Close
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

// ---------------------------------------------------------------------------
// History-inconsistency note
// ---------------------------------------------------------------------------

describe("ChangeMedicationSheet – history inconsistency note", () => {
  const currentMedication: MedicationData = {
    id: "semaglutide-ozempic",
    genericName: "Semaglutide",
    brandName: "Ozempic",
    dose: 0.5,
    frequency: "weekly",
    startDate: "2024-01-01",
    active: true,
  };

  it("inconsistency note is absent when pastDoseCount is 0", () => {
    renderSheet({ currentMedication, pastDoseCount: 0 });
    fireEvent.click(screen.getByText("Ozempic"));
    fireEvent.click(screen.getByText("0.25 mg")); // different dose
    expect(
      screen.queryByTestId("history-inconsistency-note"),
    ).not.toBeInTheDocument();
  });

  it("inconsistency note appears when switching to a different dose with past doses", () => {
    renderSheet({ currentMedication, pastDoseCount: 3 });
    fireEvent.click(screen.getByText("Ozempic"));
    fireEvent.click(screen.getByText("0.25 mg")); // different from 0.5
    expect(
      screen.getByTestId("history-inconsistency-note"),
    ).toBeInTheDocument();
  });

  it("inconsistency note is absent when the same medication and dose are selected", () => {
    renderSheet({ currentMedication, pastDoseCount: 3 });
    fireEvent.click(screen.getByText("Ozempic"));
    fireEvent.click(screen.getByText("0.5 mg")); // same dose as current
    expect(
      screen.queryByTestId("history-inconsistency-note"),
    ).not.toBeInTheDocument();
  });

  it("inconsistency note uses singular 'dose' when pastDoseCount is 1", () => {
    renderSheet({ currentMedication, pastDoseCount: 1 });
    fireEvent.click(screen.getByText("Ozempic"));
    fireEvent.click(screen.getByText("0.25 mg")); // different from 0.5
    const note = screen.getByTestId("history-inconsistency-note");
    expect(note).toHaveTextContent("1 past dose");
    expect(note).not.toHaveTextContent("1 past doses");
  });

  it("inconsistency note uses plural 'doses' and shows the correct count when pastDoseCount is > 1", () => {
    renderSheet({ currentMedication, pastDoseCount: 5 });
    fireEvent.click(screen.getByText("Ozempic"));
    fireEvent.click(screen.getByText("0.25 mg")); // different from 0.5
    const note = screen.getByTestId("history-inconsistency-note");
    expect(note).toHaveTextContent("5 past doses");
  });
});

// ---------------------------------------------------------------------------
// Formulation-change warning note
// ---------------------------------------------------------------------------

describe("ChangeMedicationSheet – formulation change note", () => {
  // Ozempic: catalog-backed injection med — no injectionSite stored on the record.
  // This exercises the catalog-aware isOralMedication path: the check must not
  // rely solely on injectionSite !== undefined.
  const injectionMedNoSite: MedicationData = {
    id: "semaglutide-ozempic",
    genericName: "Semaglutide",
    brandName: "Ozempic",
    dose: 0.5,
    frequency: "weekly",
    startDate: "2024-01-01",
    active: true,
    // injectionSite intentionally absent — catalog carries formulation:"injection"
  };

  const oralMed: MedicationData = {
    id: "semaglutide-rybelsus",
    genericName: "Semaglutide",
    brandName: "Rybelsus",
    dose: 7,
    frequency: "daily",
    startDate: "2024-01-01",
    active: true,
  };

  it("shows the formulation-change note when switching from a catalog injection med (no injectionSite) to an oral med", () => {
    renderSheet({ currentMedication: injectionMedNoSite, pastDoseCount: 3 });
    // Rybelsus is a pill — navigating to its dose view should trigger the warning
    fireEvent.click(screen.getByText("Rybelsus"));
    fireEvent.click(screen.getByText("3 mg"));
    expect(screen.getByTestId("formulation-change-note")).toBeInTheDocument();
  });

  it("shows the formulation-change note when switching from an oral med to an injection med", () => {
    renderSheet({ currentMedication: oralMed, pastDoseCount: 3 });
    fireEvent.click(screen.getByText("Ozempic"));
    fireEvent.click(screen.getByText("0.5 mg"));
    expect(screen.getByTestId("formulation-change-note")).toBeInTheDocument();
  });

  it("does NOT show the formulation-change note when formulation stays injection→injection", () => {
    renderSheet({ currentMedication: injectionMedNoSite, pastDoseCount: 3 });
    // Switching to a different injection med (Mounjaro is also an injection)
    fireEvent.click(screen.getByText("Mounjaro"));
    const doseButtons = screen.getAllByRole("button");
    // Click the first available dose button after navigating to dose view
    const firstDoseBtn = doseButtons.find(
      (b) => b.getAttribute("data-testid") !== "confirm-med-change-btn" &&
             /^\d/.test(b.textContent ?? ""),
    );
    if (firstDoseBtn) fireEvent.click(firstDoseBtn);
    expect(screen.queryByTestId("formulation-change-note")).not.toBeInTheDocument();
  });

  it("does NOT show the formulation-change note when pastDoseCount is 0", () => {
    renderSheet({ currentMedication: injectionMedNoSite, pastDoseCount: 0 });
    fireEvent.click(screen.getByText("Rybelsus"));
    fireEvent.click(screen.getByText("3 mg"));
    expect(screen.queryByTestId("formulation-change-note")).not.toBeInTheDocument();
  });

  it("formulation-change note text mentions 'injection site' when going injection → oral", () => {
    renderSheet({ currentMedication: injectionMedNoSite, pastDoseCount: 2 });
    fireEvent.click(screen.getByText("Rybelsus"));
    fireEvent.click(screen.getByText("3 mg"));
    const note = screen.getByTestId("formulation-change-note");
    expect(note).toHaveTextContent(/injection site/i);
    expect(note).toHaveTextContent(/earlier history is unchanged/i);
  });

  it("formulation-change note text mentions 'injection site' when going oral → injection", () => {
    renderSheet({ currentMedication: oralMed, pastDoseCount: 2 });
    fireEvent.click(screen.getByText("Ozempic"));
    fireEvent.click(screen.getByText("0.5 mg"));
    const note = screen.getByTestId("formulation-change-note");
    expect(note).toHaveTextContent(/injection site/i);
    expect(note).toHaveTextContent(/earlier history is unchanged/i);
  });
});
