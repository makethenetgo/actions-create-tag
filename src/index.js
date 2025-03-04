const core = require("@actions/core");
const github = require("@actions/github");

async function run() {
  try {
    // Get inputs
    const tagName = core.getInput("tag_name", { required: true });
    const commitish = core.getInput("commitish") || github.context.sha;
    const token = core.getInput("GITHUB_TOKEN", { required: true });

    // Validate inputs
    if (!isValidTagName(tagName)) {
      throw new Error(`Invalid tag name: "${tagName}". Ensure it follows the correct format.`);
    }

    // Create authenticated GitHub client
    const octokit = github.getOctokit(token);
    const { owner, repo } = github.context.repo;

    core.info(`Creating tag "${tagName}" for commit "${commitish}" in repository ${owner}/${repo}`);

    // Check if tag already exists
    if (await doesTagExist(octokit, owner, repo, tagName)) {
      throw new Error(`Tag "${tagName}" already exists in the repository.`);
    }

    // Create tag
    const createdTag = await createTag(octokit, owner, repo, tagName, commitish);

    // Debugging: Log the createdTag object
    core.info(`Created tag response: ${JSON.stringify(createdTag)}`);

    // Extract tag name from the ref and set output
    if (createdTag && createdTag.ref) {
      const createdTagName = createdTag.ref.replace("refs/tags/", ""); // Extract tag name
      core.setOutput("created_tag", createdTagName);
      core.info(`Tag "${createdTagName}" created successfully at commit "${commitish}".`);
    } else {
      throw new Error("The tag creation response did not contain a valid 'ref' property.");
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

// Function to validate the tag name format
function isValidTagName(tagName) {
  const tagRegex = /^(v|Test-)?\d+\.\d+\.\d+(-[a-zA-Z0-9_.]+)?$/;
  return tagRegex.test(tagName);
}

// Function to check if a tag already exists
async function doesTagExist(octokit, owner, repo, tagName) {
  try {
    let page = 1;
    while (true) {
      const { data: tags } = await octokit.rest.repos.listTags({
        owner,
        repo,
        per_page: 100,
        page,
      });
      if (tags.some((tag) => tag.name === tagName)) {
        return true;
      }
      if (tags.length < 100) break; // No more pages
      page++;
    }
    return false;
  } catch (error) {
    throw new Error(`Error checking for existing tags: ${error.message}`);
  }
}

// Function to create a new tag
async function createTag(octokit, owner, repo, tagName, commitish) {
  try {
    const response = await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/tags/${tagName}`,
      sha: commitish,
    });
    return response.data; // Return the response data
  } catch (error) {
    throw new Error(`Failed to create tag "${tagName}": ${error.message}`);
  }
}

run();
