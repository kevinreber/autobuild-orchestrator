import { existsSync, readFileSync, writeFileSync } from "fs";
import { randomBytes } from "crypto";
import { join } from "path";

const envPath = join(process.cwd(), ".env");
const envExamplePath = join(process.cwd(), ".env.example");

function generateSecret(length: number = 32): string {
  return randomBytes(length).toString("base64").slice(0, length);
}

function setupEnv() {
  // Check if .env already exists
  if (existsSync(envPath)) {
    console.log("✓ .env file already exists");
    return;
  }

  // Check if .env.example exists
  if (!existsSync(envExamplePath)) {
    console.error("✗ .env.example not found");
    process.exit(1);
  }

  console.log("Creating .env from .env.example...\n");

  // Read .env.example
  let envContent = readFileSync(envExamplePath, "utf-8");

  // Generate random secrets for development
  const sessionSecret = generateSecret(32);
  const encryptionKey = generateSecret(32);

  // Replace placeholder values with generated ones
  envContent = envContent
    .replace(
      "SESSION_SECRET=your_session_secret_at_least_32_characters_long",
      `SESSION_SECRET=${sessionSecret}`
    )
    .replace(
      "ENCRYPTION_KEY=your_32_character_encryption_key_here",
      `ENCRYPTION_KEY=${encryptionKey}`
    );

  // Write .env file
  writeFileSync(envPath, envContent);

  console.log("✓ Created .env file with generated secrets\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("NEXT STEPS - Configure these values in .env:\n");
  console.log("1. DATABASE_URL");
  console.log("   → Create a Supabase project at https://supabase.com");
  console.log("   → Get connection string from Project Settings > Database\n");
  console.log("2. GITHUB_CLIENT_ID & GITHUB_CLIENT_SECRET");
  console.log("   → Create OAuth app at https://github.com/settings/developers");
  console.log("   → Callback URL: http://localhost:5173/auth/github/callback\n");
  console.log("3. GITHUB_ACCESS_TOKEN");
  console.log("   → Create at https://github.com/settings/tokens");
  console.log("   → Select 'repo' scope\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

setupEnv();
