# CV correction QA prepared 13 October 2026

The production Google OAuth page returned 502 Bad Gateway / Connection refused,
including one reload. No signed-in CV mutation was attempted and no CV fixture
has been created in production. This PR prepares the narrow QA surface only.

The form requires draft ID `a81a1a1e-287a-4ce7-9961-8b486e350c36`, kind `cv`,
source URL `https://example.invalid/ats-cv-correction-e2e-20261013.pdf`, a TEST ONLY
original filename and pending/ready states. The old closed JD fixture remains
in the allowlist for historical QA, now requiring its exact synthetic source too.
Both fixtures have hidden approval controls and the decision handler refuses
them; they are synthetic correction tests without PDF sources.

Correction submits the viewed old name/title and current draft kind/ID. A 409
clears the selected draft and hides the form until the user reloads and opens
the draft again, preventing a stale retry. Six Node tests execute the actual
inline helper/request/submit/decision code with a mocked client and DOM. These
tests are not a browser or valid-JWT E2E claim.

## Resume when Google OAuth works

1. Verify the approved Admin session in the published ATS frontend first.
2. Only then create one guarded TEST ONLY CV intake
   `c538c2cd-8ac5-4f23-8efa-ab2953b473ae` and the exact draft above, with initial
   full_name NULL, a unique `example.invalid` email, ready_for_review,
   the source URL above and no real PDF. Do not recreate or reset an existing
   fixture; inspect its audits first. Do not invoke AI or broad Drive intake.
3. Open that CV in two tabs before editing. In the first tab submit a TEST ONLY
   name, then resubmit unchanged to verify no-op. The second tab must fail with
   HTTP 409 for its old NULL expected value and require reload before retry.
4. Independently query draft and correction audit. Require one row with old
   NULL, winning name, Admin actor, and zero Candidate/Job created for this
   fixture. Confirm the failed/no-op requests added no audit.
5. Close only this fixture with a guarded rejection and a TEST ONLY QA reason,
   keeping its audit. Confirm it leaves the pending queue.

TA-only signed-in mutation and Edge rejection after revoke remain separate
live checks. No temporary production access grant is included in this PR.
