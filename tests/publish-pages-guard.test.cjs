const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const workflow = fs.readFileSync(".github/workflows/publish-pages.yml", "utf8");
const deploy = workflow.split("\n  deploy:\n")[1];
const calendarPreview = fs.readFileSync(".github/workflows/publish-calendar-preview.yml", "utf8");

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

test("the standard release stays one root build and cannot publish a PR preview", () => {
  assert.match(workflow, /prepare-pages\.mjs single/);
  assert.match(workflow, /NEXT_PUBLIC_BASE_PATH: \/ats-v2-frontend\n/);
  assert.doesNotMatch(workflow, /prepare-pages\\.mjs calendar-preview|preview_ref|production_ref/);
  assert.ok(!fs.existsSync("index.html"), "The legacy HTML frontend must be retired");
});

test("Calendar preview rebuilds the published production revision and isolates test data under /preview", () => {
  assert.match(calendarPreview, /if: github\.ref == 'refs\/heads\/main'/);
  assert.match(calendarPreview, /ats-v2-frontend\/release\.json/);
  assert.match(calendarPreview, /Check out the exact currently published production source/);
  assert.match(calendarPreview, /gizkwboagulytbmbkire\.supabase\.co/);
  assert.match(calendarPreview, /NEXT_PUBLIC_BASE_PATH: \/ats-v2-frontend\/preview/);
  assert.match(calendarPreview, /prepare-pages\.mjs calendar-preview/);
  assert.doesNotMatch(calendarPreview, /pull_request:/);
});
