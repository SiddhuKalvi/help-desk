import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BackLink } from "./BackLink";

describe("BackLink", () => {
  test("renders a link to the given destination with the given label", () => {
    render(
      <MemoryRouter>
        <BackLink to="/tickets">Back to tickets</BackLink>
      </MemoryRouter>,
    );

    const link = screen.getByRole("button", { name: /back to tickets/i });
    expect(link).toHaveAttribute("href", "/tickets");
  });
});
