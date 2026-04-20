import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();

vi.mock("~/server/auth", () => ({
  auth: authMock,
}));

vi.mock(
  "~/app/opportunity-intelligence/opportunity-intelligence-client",
  () => ({
    OpportunityIntelligenceClient: () =>
      React.createElement(
        "div",
        { "data-testid": "opportunity-intelligence-client" },
        "opportunity-intelligence",
      ),
  }),
);

vi.mock(
  "~/app/opportunity-intelligence/opportunity-intelligence-login-redirect-notice",
  () => ({
    OpportunityIntelligenceLoginRedirectNotice: (props: {
      redirectTo: string;
    }) =>
      React.createElement(
        "div",
        {
          "data-testid": "opportunity-intelligence-login-redirect",
          "data-redirect-to": props.redirectTo,
        },
        "login notice",
      ),
  }),
);

describe("OpportunityIntelligencePage", () => {
  beforeEach(() => {
    authMock.mockReset();
  });

  it("renders the login redirect notice when the user is not authenticated", async () => {
    authMock.mockResolvedValue(null);

    const { default: OpportunityIntelligencePage } = await import(
      "~/app/opportunity-intelligence/page"
    );
    const markup = renderToStaticMarkup(await OpportunityIntelligencePage());

    expect(markup).toContain("opportunity-intelligence-login-redirect");
    expect(markup).toContain("/opportunity-intelligence");
    expect(markup).not.toContain("opportunity-intelligence-client");
  });

  it("renders the opportunity intelligence client when the user is authenticated", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user-1",
      },
    });

    const { default: OpportunityIntelligencePage } = await import(
      "~/app/opportunity-intelligence/page"
    );
    const markup = renderToStaticMarkup(await OpportunityIntelligencePage());

    expect(markup).toContain("opportunity-intelligence-client");
    expect(markup).not.toContain("opportunity-intelligence-login-redirect");
  });
});
