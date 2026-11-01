const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const workflow = fs.readFileSync(".github/workflows/publish-pages.yml", "utf8");
const deploy = workflow.split("\n  deploy:\n")[1];

test("Pages deployment requires an explicit manual run from main", () => {
  assert.ok(deploy, "Expected a deploy job in publish-pages.yml");
  assert.match(
    workflow,
    /workflow_dispatch:/,
    "Expected a manual release entry point",
  );
  assert.match(
    deploy,
    /if: github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/,
    "Deploy must require workflow_dispatch on main",
  );
  assert.doesNotMatch(
    deploy,
    /github\.event_name == 'pull_request'/,
    "A pull request must never satisfy the deploy condition",
  );
});
