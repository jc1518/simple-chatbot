# GitHub Actions Workflows

This directory contains GitHub Actions workflows for continuous integration and testing of the Simple Chatbot project.

## Available Workflows

### 1. CDK Tests (`cdk-tests.yml`)

This workflow runs when changes are pushed to the `cdk` directory:

- Runs on: Push to `main` branch affecting `cdk/**` files
- Jobs:
  - Install Node.js dependencies
  - Run CDK tests using Jest

### 2. Frontend CI (`frontend.yml`)

This workflow runs when changes are pushed to the `frontend` directory:

- Runs on: Push to `main` branch affecting `frontend/**` files
- Jobs:
  - Install Node.js dependencies
  - Run ESLint for code quality
  - Build the frontend application

### 3. Main CI (`main.yml`)

This is a comprehensive workflow that runs both CDK tests and frontend build:

- Runs on: Any push to `main` branch
- Jobs:
  - CDK Tests: Install dependencies and run tests
  - Frontend Build: Install dependencies, lint, and build

## Workflow Structure

Each workflow follows a similar pattern:

1. Checkout the repository
2. Set up Node.js environment
3. Cache dependencies for faster builds
4. Install dependencies
5. Run tests, linting, or build processes

## Adding New Workflows

To add a new workflow:

1. Create a new YAML file in the `.github/workflows` directory
2. Define the trigger events (push, pull request, etc.)
3. Configure the jobs and steps needed
4. Commit and push the changes to GitHub

## Testing Locally

You can test GitHub Actions workflows locally using [act](https://github.com/nektos/act), a tool for running GitHub Actions locally:

```bash
# Install act
brew install act

# Run the main workflow
act -j cdk-tests
```