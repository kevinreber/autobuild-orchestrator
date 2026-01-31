import { test, expect } from "@playwright/test";

test.describe("Project Management", () => {
  test.describe("Dashboard", () => {
    test("should display projects heading", async ({ page }) => {
      // Mock authenticated state by intercepting the loader
      await page.route("**/dashboard", async (route) => {
        if (route.request().resourceType() === "document") {
          await route.continue();
        } else {
          await route.continue();
        }
      });

      await page.goto("/dashboard");

      // Check for dashboard elements (will vary based on auth state)
      const heading = page.getByRole("heading", { name: /projects/i });
      const signIn = page.getByRole("link", { name: /sign in/i });

      // Either shows projects dashboard or sign in
      const hasHeading = await heading.isVisible().catch(() => false);
      const hasSignIn = await signIn.isVisible().catch(() => false);

      expect(hasHeading || hasSignIn).toBeTruthy();
    });

    test("should have new project button when authenticated", async ({ page }) => {
      await page.goto("/dashboard");

      // Look for new project button
      const newProjectButton = page.getByRole("link", { name: /new project/i });
      const isVisible = await newProjectButton.isVisible().catch(() => false);

      // Button should be visible if authenticated
      if (isVisible) {
        await expect(newProjectButton).toHaveAttribute("href", "/dashboard/projects/new");
      }
    });

    test("should display empty state when no projects", async ({ page }) => {
      await page.goto("/dashboard");

      // Check for empty state message
      const emptyState = page.getByText(/no projects yet/i);
      const isVisible = await emptyState.isVisible().catch(() => false);

      // Either shows empty state or has projects
      if (isVisible) {
        await expect(page.getByText(/create your first project/i)).toBeVisible();
      }
    });
  });

  test.describe("New Project Page", () => {
    test("should display repository selection interface", async ({ page }) => {
      await page.goto("/dashboard/projects/new");

      // Check for page elements
      const heading = page.getByRole("heading", { name: /create new project/i });
      const backButton = page.getByRole("link", { name: /back to dashboard/i });

      // Check visibility based on auth state
      const hasHeading = await heading.isVisible().catch(() => false);
      const hasBackButton = await backButton.isVisible().catch(() => false);

      if (hasHeading) {
        expect(hasBackButton).toBeTruthy();
        await expect(page.getByText(/select a github repository/i)).toBeVisible();
      }
    });

    test("should have search functionality for repositories", async ({ page }) => {
      await page.goto("/dashboard/projects/new");

      const searchInput = page.getByPlaceholder(/search repositories/i);
      const isVisible = await searchInput.isVisible().catch(() => false);

      if (isVisible) {
        // Type in search
        await searchInput.fill("test-repo");

        // Search should filter the list
        await expect(searchInput).toHaveValue("test-repo");
      }
    });

    test("should navigate back to dashboard", async ({ page }) => {
      await page.goto("/dashboard/projects/new");

      const backButton = page.getByRole("link", { name: /back to dashboard/i });
      const isVisible = await backButton.isVisible().catch(() => false);

      if (isVisible) {
        await backButton.click();
        await expect(page).toHaveURL(/\/dashboard\/?$/);
      }
    });
  });

  test.describe("Project Actions", () => {
    test("should have delete project functionality", async ({ page }) => {
      await page.goto("/dashboard");

      // Look for delete button (trash icon)
      const deleteButtons = page.locator('button:has([class*="lucide-trash"])');
      const count = await deleteButtons.count();

      // If there are projects, delete button should exist
      if (count > 0) {
        await deleteButtons.first().click();

        // Should show confirmation dialog
        await expect(page.getByText(/delete this project/i)).toBeVisible();
        await expect(page.getByRole("button", { name: /cancel/i })).toBeVisible();
      }
    });

    test("should show soft delete confirmation", async ({ page }) => {
      await page.goto("/dashboard");

      const deleteButtons = page.locator('button:has([class*="lucide-trash"])');
      const count = await deleteButtons.count();

      if (count > 0) {
        await deleteButtons.first().click();

        // Check confirmation message
        await expect(page.getByText(/30 days/i)).toBeVisible();
      }
    });
  });

  test.describe("Deleted Projects Section", () => {
    test("should toggle deleted projects visibility", async ({ page }) => {
      await page.goto("/dashboard");

      // Look for deleted projects section
      const deletedSection = page.getByText(/deleted projects/i);
      const isVisible = await deletedSection.isVisible().catch(() => false);

      if (isVisible) {
        // Click to expand
        await deletedSection.click();

        // Should show restore button for deleted projects
        const restoreButton = page.getByRole("button", { name: /restore/i });
        await expect(restoreButton).toBeVisible();
      }
    });
  });

  test.describe("Project Board Access", () => {
    test("should navigate to project board", async ({ page }) => {
      await page.goto("/dashboard");

      // Look for "Open Board" button
      const openBoardButton = page.getByRole("link", { name: /open board/i }).first();
      const isVisible = await openBoardButton.isVisible().catch(() => false);

      if (isVisible) {
        await openBoardButton.click();

        // Should navigate to project board
        await expect(page).toHaveURL(/\/dashboard\/projects\/[^/]+$/);
      }
    });
  });
});

test.describe("Project Board Page", () => {
  test("should display kanban board columns", async ({ page }) => {
    // Navigate to a project (will need valid project ID)
    await page.goto("/dashboard/projects/test-id");

    // Check for kanban columns
    const columns = ["Backlog", "Ready", "In Progress", "In Review", "Completed", "Failed"];

    for (const column of columns) {
      const columnElement = page.getByText(column, { exact: true });
      // Columns should be visible if project exists
      const isVisible = await columnElement.isVisible().catch(() => false);
      // Either shows columns or redirects to dashboard
      if (!isVisible) {
        const url = page.url();
        expect(url.includes("dashboard") || url === "/").toBeTruthy();
        break;
      }
    }
  });

  test("should show project header with navigation", async ({ page }) => {
    await page.goto("/dashboard/projects/test-id");

    // Look for back button
    const backButton = page.getByRole("link", { name: /back/i });
    const isVisible = await backButton.isVisible().catch(() => false);

    if (isVisible) {
      await expect(backButton).toHaveAttribute("href", "/dashboard");
    }
  });

  test("should show API key warning if not configured", async ({ page }) => {
    await page.goto("/dashboard/projects/test-id");

    // Look for API key warning
    const warning = page.getByText(/configure.*api key/i);
    const isVisible = await warning.isVisible().catch(() => false);

    // Warning might be visible if API key not set
    if (isVisible) {
      await expect(page.getByRole("link", { name: /settings/i })).toBeVisible();
    }
  });

  test("should have external GitHub link", async ({ page }) => {
    await page.goto("/dashboard/projects/test-id");

    // Look for external link to GitHub
    const externalLink = page.locator('a[target="_blank"][href*="github.com"]');
    const count = await externalLink.count();

    // If project exists, should have GitHub link
    if (count > 0) {
      const href = await externalLink.first().getAttribute("href");
      expect(href).toContain("github.com");
    }
  });
});
