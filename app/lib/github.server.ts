import { Octokit } from "@octokit/rest";

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  default_branch: string;
  html_url: string;
}

export async function getUserRepos(accessToken: string): Promise<GitHubRepo[]> {
  const octokit = new Octokit({ auth: accessToken });

  const repos: GitHubRepo[] = [];
  let page = 1;

  while (true) {
    const response = await octokit.repos.listForAuthenticatedUser({
      sort: "updated",
      per_page: 100,
      page,
    });

    repos.push(
      ...response.data.map((repo) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        private: repo.private,
        default_branch: repo.default_branch,
        html_url: repo.html_url,
      }))
    );

    if (response.data.length < 100) break;
    page++;
  }

  return repos;
}

export async function getRepoContents(
  accessToken: string,
  owner: string,
  repo: string,
  path: string = ""
): Promise<{ name: string; path: string; type: "file" | "dir" }[]> {
  const octokit = new Octokit({ auth: accessToken });

  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });

    if (Array.isArray(response.data)) {
      return response.data.map((item) => ({
        name: item.name,
        path: item.path,
        type: item.type as "file" | "dir",
      }));
    }

    return [];
  } catch {
    return [];
  }
}

export async function getFileContent(
  accessToken: string,
  owner: string,
  repo: string,
  path: string
): Promise<string | null> {
  const octokit = new Octokit({ auth: accessToken });

  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });

    if (!Array.isArray(response.data) && response.data.type === "file") {
      const content = Buffer.from(
        response.data.content,
        "base64"
      ).toString("utf-8");
      return content;
    }

    return null;
  } catch {
    return null;
  }
}

export async function createBranch(
  accessToken: string,
  owner: string,
  repo: string,
  branchName: string,
  baseBranch: string
): Promise<void> {
  const octokit = new Octokit({ auth: accessToken });

  // Get the SHA of the base branch
  const { data: ref } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`,
  });

  // Create new branch
  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: ref.object.sha,
  });
}

export async function createOrUpdateFile(
  accessToken: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string
): Promise<void> {
  const octokit = new Octokit({ auth: accessToken });

  let sha: string | undefined;

  // Check if file exists to get SHA
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });

    if (!Array.isArray(data) && data.type === "file") {
      sha = data.sha;
    }
  } catch {
    // File doesn't exist, that's fine
  }

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: Buffer.from(content).toString("base64"),
    branch,
    sha,
  });
}

export async function createPullRequest(
  accessToken: string,
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string
): Promise<{ number: number; html_url: string }> {
  const octokit = new Octokit({ auth: accessToken });

  const { data } = await octokit.pulls.create({
    owner,
    repo,
    title,
    body,
    head,
    base,
  });

  return {
    number: data.number,
    html_url: data.html_url,
  };
}
