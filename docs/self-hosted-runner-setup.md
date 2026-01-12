# Self-Hosted GitHub Actions Runner Setup

## Why Use a Self-Hosted Runner?

### The Problem

When using GitHub Actions with Claude Code, there are two authentication methods:

| Method | How it works | Cost |
|--------|--------------|------|
| `claude login` | Interactive browser login | Uses your Claude Max subscription ($200/month) |
| `ANTHROPIC_API_KEY` | API key from console.anthropic.com | Pay-per-use API credits |

**GitHub's hosted runners can't use `claude login`** because it requires an interactive browser session. This means you'd pay for API credits on top of your Max subscription.

### The Solution

A **self-hosted runner** runs GitHub Actions workflows on your own machine. Since it runs locally, it can use your `claude login` authentication, meaning:

- No additional API costs
- Uses your existing Claude Max subscription
- Same powerful Claude Code experience

### Trade-offs

| Aspect | GitHub Hosted | Self-Hosted |
|--------|---------------|-------------|
| Cost | API credits (~$0.10-$2/ticket) | Free (uses Max subscription) |
| Availability | 24/7 | Only when your machine is on |
| Setup | None | ~10 minutes |
| Maintenance | None | Occasional updates |
| Security | GitHub managed | You manage |

---

## Common Use Cases for Self-Hosted Runners

### 1. Cost Optimization
Avoid paying for API credits when you already have a Claude subscription.

### 2. Access to Local Resources
- Use local databases or services
- Access private networks
- Use local file systems

### 3. Custom Software Requirements
- Pre-installed tools and SDKs
- Specific OS versions
- Licensed software

### 4. Performance
- Faster builds with better hardware
- No queue wait times
- Persistent caches between runs

### 5. Security & Compliance
- Keep code on-premises
- Meet compliance requirements
- Control over the execution environment

---

## Setup Guide

### Prerequisites

- macOS, Linux, or Windows machine
- GitHub repository with admin access
- Claude Code installed and authenticated (`claude login`)

### Step 1: Verify Claude Code Authentication

Make sure Claude Code is working with your Max subscription:

```bash
# Check if you're logged in
claude --version

# If not logged in, authenticate
claude login
```

### Step 2: Create a Runner in GitHub

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Actions** → **Runners**
3. Click **New self-hosted runner**
4. Select your operating system (macOS, Linux, or Windows)

### Step 3: Download and Configure the Runner

GitHub will show you commands specific to your repo. They look like this:

#### macOS/Linux

```bash
# Create a directory for the runner
mkdir actions-runner && cd actions-runner

# Download the runner (GitHub will show the exact URL)
curl -o actions-runner-osx-x64-2.XXX.X.tar.gz -L https://github.com/actions/runner/releases/download/vX.XXX.X/actions-runner-osx-x64-X.XXX.X.tar.gz

# Extract
tar xzf ./actions-runner-osx-x64-2.XXX.X.tar.gz

# Configure (use the token from GitHub's instructions)
./config.sh --url https://github.com/YOUR_USERNAME/YOUR_REPO --token YOUR_TOKEN
```

When prompted:
- **Runner group**: Press Enter for default
- **Runner name**: Give it a name like `my-macbook` or press Enter for default
- **Labels**: Add `self-hosted,macos` or press Enter for defaults
- **Work folder**: Press Enter for default

### Step 4: Start the Runner

```bash
# Run interactively (for testing)
./run.sh

# Or install as a service (recommended for persistent use)
./svc.sh install
./svc.sh start
```

You should see:
```
√ Connected to GitHub
Listening for Jobs
```

### Step 5: Update the Workflow

Modify your workflow file to use the self-hosted runner:

```yaml
# .github/workflows/autobuild-agent.yml

name: AutoBuild Agent

on:
  repository_dispatch:
    types: [autobuild-ticket]

permissions:
  contents: write
  pull-requests: write

jobs:
  implement-ticket:
    # Change this line to use your self-hosted runner
    runs-on: self-hosted
    timeout-minutes: 30

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      # Remove Node.js setup - already installed locally
      # Remove Claude Code install - already installed locally

      - name: Create feature branch
        run: |
          git config user.name "AutoBuild Agent"
          git config user.email "autobuild@users.noreply.github.com"

          # Delete remote branch if it exists (for retries)
          git push origin --delete ${{ github.event.client_payload.branch_name }} 2>/dev/null || true

          git checkout -b ${{ github.event.client_payload.branch_name }}

      - name: Run Claude Code Agent
        # No ANTHROPIC_API_KEY needed - uses claude login
        run: |
          claude -p "${{ github.event.client_payload.prompt }}" \
            --allowedTools "Edit,Write,Read,Glob,Grep,Bash" \
            --output-format json \
            --max-turns 50 \
            > claude_output.json 2>&1 || true

          cat claude_output.json

      - name: Commit changes
        run: |
          git add -A
          if git diff --staged --quiet; then
            echo "No changes to commit"
            echo "HAS_CHANGES=false" >> $GITHUB_ENV
          else
            git commit -m "feat: ${{ github.event.client_payload.ticket_title }}"
            echo "HAS_CHANGES=true" >> $GITHUB_ENV
          fi

      - name: Push branch
        if: env.HAS_CHANGES == 'true'
        run: git push origin ${{ github.event.client_payload.branch_name }}

      - name: Create Pull Request
        if: env.HAS_CHANGES == 'true'
        id: create-pr
        uses: actions/github-script@v7
        with:
          script: |
            const { data: pr } = await github.rest.pulls.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `[AutoBuild] ${{ github.event.client_payload.ticket_title }}`,
              body: `## AutoBuild Agent Implementation\n\n### Ticket\n**${{ github.event.client_payload.ticket_title }}**\n\n${{ github.event.client_payload.ticket_description }}\n\n---\n*This PR was automatically generated by AutoBuild Agent*`,
              head: '${{ github.event.client_payload.branch_name }}',
              base: '${{ github.event.client_payload.base_branch }}'
            });

            console.log(`Created PR #${pr.number}: ${pr.html_url}`);
            core.setOutput('pr_number', pr.number);
            core.setOutput('pr_url', pr.html_url);

      - name: Report results
        if: always()
        run: |
          if [ "${{ env.HAS_CHANGES }}" == "true" ]; then
            STATUS="success"
            PR_URL="${{ steps.create-pr.outputs.pr_url }}"
            PR_NUMBER="${{ steps.create-pr.outputs.pr_number }}"
          else
            STATUS="no_changes"
            PR_URL=""
            PR_NUMBER=""
          fi

          curl -X POST "${{ github.event.client_payload.callback_url }}" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${{ github.event.client_payload.callback_secret }}" \
            -d "{
              \"ticket_id\": \"${{ github.event.client_payload.ticket_id }}\",
              \"status\": \"$STATUS\",
              \"pr_url\": \"$PR_URL\",
              \"pr_number\": \"$PR_NUMBER\",
              \"run_id\": \"${{ github.run_id }}\"
            }" || echo "Callback failed, but continuing..."
```

---

## Managing the Runner

### Check Status

```bash
# If running as a service
./svc.sh status
```

### Stop the Runner

```bash
# If running interactively
Ctrl+C

# If running as a service
./svc.sh stop
```

### Start on Boot (macOS)

The service installation (`./svc.sh install`) automatically configures the runner to start on boot.

### View Logs

```bash
# Service logs
./svc.sh status

# Or check the _diag folder
ls _diag/
```

### Update the Runner

GitHub will notify you when updates are available:

```bash
./svc.sh stop
# Download new version from GitHub
./config.sh --url https://github.com/YOUR_USERNAME/YOUR_REPO --token NEW_TOKEN
./svc.sh start
```

---

## Troubleshooting

### Runner not picking up jobs

1. Check the runner is connected: `./run.sh` should show "Listening for Jobs"
2. Verify the workflow uses `runs-on: self-hosted`
3. Check runner labels match workflow requirements

### Claude Code not working

1. Verify authentication: `claude --version`
2. Re-authenticate if needed: `claude login`
3. Check the runner is running as your user (not root)

### Permission errors

Make sure the runner process has access to:
- The repository directory
- Claude Code configuration (`~/.claude/`)
- Git credentials

### Jobs stuck in queue

- Ensure the runner is online and listening
- Check for label mismatches in the workflow

---

## Security Considerations

1. **Don't use self-hosted runners with public repos** - Anyone can submit a PR that runs code on your machine

2. **Keep runner updated** - Install security updates promptly

3. **Limit repository access** - Only configure runners for repos you trust

4. **Use a dedicated user** - Consider running the runner as a separate user account

5. **Network isolation** - Use firewall rules if needed

---

## Summary

Self-hosted runners let you use your Claude Max subscription for GitHub Actions workflows, eliminating API costs. The trade-off is that your machine needs to be running for workflows to execute.

For AutoBuild, this means:
- Drag a ticket to "In Progress"
- Your laptop runs Claude Code with your Max subscription
- PR is created automatically
- No API credits used
