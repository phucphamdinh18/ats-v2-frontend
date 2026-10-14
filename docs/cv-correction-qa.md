# CV correction QA status 14 October 2026

The Admin CV correction check below completed on 14 October after Google login
became available. The historical 13 October preparation did not create a fixture
or run a signed-in mutation. A separate TA check is now prepared, not executed.

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

## Admin check completed 14 October

Verified the approved Admin session in the published ATS before seeding. The
pre-check found no CV fixture, one historical JD correction, no pending CV/JD,
and no TA role. Seeded exactly the intake/draft IDs below with NULL full_name,
`qa-cv-correction-20261013@example.invalid`, and no PDF or AI request.

Both browser tabs loaded the initial NULL name. Tab A saved
`[TEST ONLY] QA Correction 20261013`; both list and detail updated. Submitting
the same value again returned no-op. Tab B submitted a different TEST ONLY name
with its old viewed value and displayed the draft-changed message; its edit
form disappeared until reload. This is a real Admin UI/JWT stale-write check,
not a claim that two requests were simultaneous or that a network status was
captured. The frontend's automated test separately verifies HTTP 409 handling.

An independent SQL SELECT confirmed exactly one correction, NULL old value,
the winning name and approved Admin actor, zero decision logs at that point,
and no Candidate for the unique test email. A guarded SQL call then rejected
only this fixture and retained its audit (closure was not a UI decision test).
Final independent checks: rejected, one correction, one rejection audit,
no Candidate/Job for the fixture, pending CV/JD 0/0, TA roles 0.

## Historical Admin checklist

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

## Next TA-only check prepared but not executed

New draft `30d9c99f-9f76-4e3b-be16-0a9632646df1`, intake
`787e953f-ddf4-4246-854d-cb988044bb1b`, source
`https://example.invalid/ats-ta-cv-correction-e2e-20261014.pdf` and a TEST ONLY
filename are the only new allowed correction fixture. It has no real PDF.
The prior closed fixtures must not be reopened or reset. Allowlisting a form
does not grant any backend access. Approval stays blocked for all QA fixtures.

1. Obtain action-time confirmation before a temporary TA production grant.
   Resolve the existing approved test Auth account, require no Admin or other
   roles, create only the temporary active profile and TA_RECRUITER role when
   absent, and record the exact rows created for conditional cleanup.
2. Seed the new synthetic fixture only after inspecting its absence and audits.
   Use NULL full_name and a unique example.invalid email. No Drive/AI intake.
3. In the TA Google session, confirm TA-only, save a TEST ONLY name through the
   published UI, repeat unchanged, and independently verify a single TA audit.
4. Revoke the temporary role/profile created in step 1 in a guaranteed cleanup
   path. Keep the same TA Google session; try the edit left open before revoke.
   Require an Edge permission rejection, zero new audit and unchanged value.
   Refresh the page and require the no-access state. Never log or extract JWTs.
5. From the Admin session, conditionally reject only this new fixture, keeping
   all audits. Confirm no TA role/profile added by this test remains and no
   Candidate/Job was created. This step requires no grant on a real Job.

No role grant, profile creation, new fixture seed, or TA live mutation is part
of this frontend preparation. The remaining live check still gates completion.
