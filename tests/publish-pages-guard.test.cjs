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

test("one root build replaces legacy QA and parallel preview release modes", () => {
  assert.match(workflow, /prepare-pages\.mjs single/);
  assert.match(workflow, /NEXT_PUBLIC_BASE_PATH: \/ats-v2-frontend\n/);
  assert.doesNotMatch(workflow, /production_ref|preview_ref|path-preview|deploy-preview|inline-script-syntax/);
  assert.ok(!fs.existsSync("index.html"), "The legacy HTML frontend must be retired");
});
