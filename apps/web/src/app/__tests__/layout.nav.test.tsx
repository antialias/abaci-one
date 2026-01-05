import { render, screen } from "@testing-library/react";
import RootLayout from "../layout";

// Mock ClientProviders
vi.mock("../../components/ClientProviders", () => ({
  ClientProviders: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="client-providers">{children}</div>
  ),
}));

describe("RootLayout", () => {
  it("renders children with ClientProviders", () => {
    const pageContent = <div>Page content</div>;

    render(<RootLayout>{pageContent}</RootLayout>);

    expect(screen.getByTestId("client-providers")).toBeInTheDocument();
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });

  it("renders html and body tags", () => {
    const pageContent = <div>Test content</div>;

    const { container } = render(<RootLayout>{pageContent}</RootLayout>);

    const html = container.querySelector("html");
    const body = container.querySelector("body");

    expect(html).toBeInTheDocument();
    expect(html).toHaveAttribute("lang", "en");
    expect(body).toBeInTheDocument();
  });
});
