import { test as base, expect, type Page } from "@playwright/test";

/**
 * Test data generators and utilities
 */
export const testData = {
  generateTicket: (overrides?: Partial<{ title: string; description: string }>) => ({
    title: `Test Ticket ${Date.now()}`,
    description: `Test ticket description created at ${new Date().toISOString()}`,
    ...overrides,
  }),

  generateProject: (overrides?: Partial<{ name: string }>) => ({
    name: `test-project-${Date.now()}`,
    ...overrides,
  }),
};

/**
 * Page object helpers for common interactions
 */
export class KanbanHelper {
  constructor(private page: Page) {}

  async createTicket(title: string, description: string) {
    // Click create ticket button
    await this.page.getByRole("button", { name: /create ticket|add ticket|new ticket/i }).click();

    // Fill in the form
    await this.page.getByLabel(/title/i).fill(title);
    await this.page.getByLabel(/description/i).fill(description);

    // Submit
    await this.page.getByRole("button", { name: /create|add|save/i }).click();

    // Wait for the ticket to appear
    await expect(this.page.getByText(title)).toBeVisible();
  }

  async getTicketCard(title: string) {
    return this.page.locator(`[data-testid="ticket-card"]`).filter({ hasText: title });
  }

  async getColumn(columnName: string) {
    return this.page.locator(`[data-testid="kanban-column-${columnName.toLowerCase().replace(/\s+/g, "_")}"]`);
  }

  async moveTicket(ticketTitle: string, targetColumn: string) {
    const ticket = await this.getTicketCard(ticketTitle);
    const column = await this.getColumn(targetColumn);

    // Perform drag and drop
    await ticket.dragTo(column);
  }

  async getTicketCount(columnName: string) {
    const column = await this.getColumn(columnName);
    const tickets = column.locator(`[data-testid="ticket-card"]`);
    return tickets.count();
  }
}

/**
 * Authentication helpers
 */
export class AuthHelper {
  constructor(private page: Page) {}

  async mockGitHubAuth() {
    // This will be used to mock GitHub OAuth in tests
    // In a real implementation, you'd intercept the OAuth flow
    await this.page.route("**/auth/github/callback*", async (route) => {
      // Mock successful OAuth callback
      await route.fulfill({
        status: 302,
        headers: {
          Location: "/dashboard",
        },
      });
    });
  }

  async isLoggedIn() {
    // Check if user is logged in by looking for dashboard elements
    try {
      await this.page.waitForURL("**/dashboard**", { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async logout() {
    await this.page.goto("/auth/logout");
  }
}

/**
 * API helpers for setting up test data via API routes
 */
export class ApiHelper {
  constructor(private page: Page) {}

  async mockApiResponse(urlPattern: string, response: object, status = 200) {
    await this.page.route(urlPattern, async (route) => {
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(response),
      });
    });
  }

  async interceptAgentTrigger() {
    const requests: { ticketId: string; body: object }[] = [];

    await this.page.route("**/api/tickets/*/start-agent", async (route) => {
      const url = route.request().url();
      const ticketIdMatch = url.match(/\/tickets\/([^/]+)\/start-agent/);
      const ticketId = ticketIdMatch?.[1] || "";

      requests.push({
        ticketId,
        body: await route.request().postDataJSON().catch(() => ({})),
      });

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "Agent triggered" }),
      });
    });

    return requests;
  }
}

/**
 * Extended test fixture with helpers
 */
export const test = base.extend<{
  kanban: KanbanHelper;
  auth: AuthHelper;
  api: ApiHelper;
}>({
  kanban: async ({ page }, use) => {
    await use(new KanbanHelper(page));
  },
  auth: async ({ page }, use) => {
    await use(new AuthHelper(page));
  },
  api: async ({ page }, use) => {
    await use(new ApiHelper(page));
  },
});

export { expect };
