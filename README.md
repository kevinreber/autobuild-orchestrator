# AutoBuild Orchestrator

An AI-powered development platform that lets you manage GitHub projects through a Kanban board. When you move a ticket to "In Progress", Claude automatically implements the changes and creates a pull request.

## Features

- GitHub OAuth authentication
- Project management linked to GitHub repositories
- Kanban board with drag-and-drop
- AI-powered ticket implementation using Claude
- Automatic pull request creation

## Tech Stack

- **Framework**: React Router v7 (Remix)
- **Database**: PostgreSQL (Supabase)
- **UI**: shadcn/ui + Tailwind CSS
- **AI**: Claude API with tool use
- **Auth**: GitHub OAuth
- **Hosting**: Vercel

## Prerequisites

- Node.js 20.19.0+ or 22.12.0+
- Supabase account (free tier works)
- GitHub account
- Anthropic API key

---

## Environment Setup

We use three environments:

| Environment | Purpose | Database |
|-------------|---------|----------|
| Local | Development | Supabase (dev project) |
| Staging | Testing before production | Supabase (staging project) |
| Production | Live app | Supabase (production project) |

---

## 1. Supabase Setup

### Create Projects

1. Go to [supabase.com](https://supabase.com) and sign in
2. Create **two projects**:
   - `autobuild-staging` - for staging environment
   - `autobuild-production` - for production (create when ready)

### Get Connection Strings

For each project:
1. Go to **Project Settings** > **Database**
2. Copy the **Connection string** > **URI** format
3. Replace `[YOUR-PASSWORD]` with your database password

Example:
```
postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

### Run Migrations

For each Supabase project, run the migration:

**Option A: Supabase SQL Editor**
1. Go to **SQL Editor** in Supabase dashboard
2. Paste contents of `db/migrations/001_initial_schema.sql`
3. Click **Run**

**Option B: Command line**
```bash
# Set the DATABASE_URL for the target environment
export DATABASE_URL="postgresql://..."
npx tsx scripts/migrate.ts
```

---

## 2. GitHub OAuth Apps

Create **separate OAuth apps** for each environment:

### Local Development
1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - **Application name**: AutoBuild Orchestrator (Local)
   - **Homepage URL**: `http://localhost:5173`
   - **Authorization callback URL**: `http://localhost:5173/auth/github/callback`
4. Save the **Client ID** and **Client Secret**

### Staging
Same steps with:
- **Application name**: AutoBuild Orchestrator (Staging)
- **Homepage URL**: `https://autobuild-staging.vercel.app` (or your staging URL)
- **Authorization callback URL**: `https://autobuild-staging.vercel.app/auth/github/callback`

### Production
Same steps with:
- **Application name**: AutoBuild Orchestrator
- **Homepage URL**: `https://your-domain.com`
- **Authorization callback URL**: `https://your-domain.com/auth/github/callback`

---

## 3. GitHub Personal Access Token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Select scopes: `repo` (Full control of private repositories)
4. Generate and copy the token

> **Note**: For production, consider creating a dedicated GitHub account or using GitHub App installation tokens for better security.

---

## 4. Local Development

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your values
# - DATABASE_URL (Supabase staging or dev)
# - GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET (local OAuth app)
# - GITHUB_ACCESS_TOKEN
# - SESSION_SECRET (generate with: openssl rand -base64 32)
# - ENCRYPTION_KEY (generate with: openssl rand -base64 32)
# - APP_URL=http://localhost:5173

# Run migrations (if not done via Supabase UI)
npx tsx scripts/migrate.ts

# Start dev server
npm run dev
```

Visit http://localhost:5173

---

## 5. Vercel Deployment

### Staging Deployment

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import the project
3. Configure environment variables in Vercel:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `staging` |
| `DATABASE_URL` | Supabase staging connection string |
| `GITHUB_CLIENT_ID` | Staging OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | Staging OAuth app client secret |
| `GITHUB_ACCESS_TOKEN` | Your GitHub PAT |
| `SESSION_SECRET` | Generate unique value |
| `ENCRYPTION_KEY` | Generate unique value |
| `APP_URL` | Your Vercel staging URL |

4. Deploy!

### Production Deployment

Create a separate Vercel project (or use Vercel's preview/production environments) with production environment variables.

---

## Usage

1. **Sign in** with your GitHub account
2. **Create a project** by entering a GitHub repository (owner/name)
3. **Configure your Anthropic API key** in Settings
4. **Create tickets** in the Backlog or Ready columns
5. **Drag a ticket to "In Progress"** to trigger Claude
6. Claude implements changes and creates a PR
7. Review the PR on GitHub and merge

---

## Ticket Statuses

| Status | Description |
|--------|-------------|
| Backlog | Not yet prioritized |
| Ready | Ready to be worked on |
| In Progress | Claude is implementing (one at a time) |
| In Review | PR created, awaiting review |
| Completed | PR merged |
| Failed | Implementation failed |

---

## Project Structure

```
├── app/
│   ├── routes/              # Page routes
│   ├── components/          # React components
│   │   └── ui/             # shadcn/ui components
│   ├── lib/                # Server utilities
│   │   ├── agent.server.ts     # Claude AI agent
│   │   ├── auth.server.ts      # Authentication
│   │   ├── db.server.ts        # Database
│   │   ├── github.server.ts    # GitHub API
│   │   └── encryption.server.ts
│   └── types/              # TypeScript types
├── db/
│   └── migrations/         # SQL migrations
├── scripts/
│   └── migrate.ts          # Migration runner
└── public/                 # Static assets
```

---

## Important Notes

- **One ticket at a time**: Only one ticket can be "In Progress" per project
- **API costs**: Users pay for Claude API usage via their own API key
- **Vercel timeouts**: Functions have timeout limits (60s Pro, 300s Enterprise)
- **Security**: Never commit `.env` files - use `.env.example` as template

---

## Troubleshooting

### "Database connection failed"
- Check your `DATABASE_URL` format
- Ensure Supabase project is active
- Try the connection pooler URL (port 6543)

### "GitHub OAuth error"
- Verify callback URL matches exactly (including trailing slash)
- Check client ID/secret are correct for the environment

### "Agent failed"
- Ensure `GITHUB_ACCESS_TOKEN` has `repo` scope
- Check Anthropic API key is valid in Settings
- View error message on the ticket card

---

## License

MIT
