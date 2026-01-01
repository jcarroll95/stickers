import { test, expect } from '@playwright/test';

test('New user can sign up and create their first board', async ({ page }) => {
  const testEmail = `testuser${Date.now()}@example.com`;

  await page.goto('/');
  await page.click('text=Get Started for Free');
  
  // Registration flow
  await page.fill('label:has-text("Name") + input', 'New User');
  await page.fill('label:has-text("Email") + input', testEmail);
  await page.fill('label:has-text("Password") + input', 'Password123!');
  await page.fill('label:has-text("Confirm password") + input', 'Password123!');
  await page.click('button:has-text("Continue")');

  // Should be on verification step
  await expect(page.locator('text=Enter verification code')).toBeVisible({ timeout: 15000 });
  
  // Fill in the test bypass code '123456'
  // RegisterVerify uses 6 separate inputs for the code in a div with class codeGrid
  const codeInputs = page.locator('div[class*="codeGrid"] input');
  for (let i = 0; i < 6; i++) {
    await codeInputs.nth(i).fill(String(i + 1));
  }
  
  // Wait a bit for the state to update
  await page.waitForTimeout(500);
  await page.click('button:has-text("Verify")');

  // Should redirect to board creation or board page
  // Based on RegisterVerify.jsx, if no board, it goes to #/board/create
  await expect(page).toHaveURL(/.*board\/create/, { timeout: 10000 });

  // Create Board
  await page.fill('label:has-text("Board name") + input', 'My GLP-1 Journey');
  // Select a background (the first one)
  await page.click('button[title="Background sb0"]');
  await page.click('button:has-text("Create stickerboard")');

  // Final check - should be on the board page
  await expect(page).toHaveURL(/.*board\/.*/, { timeout: 10000 });
  await expect(page.locator('h1')).toBeVisible();
});
