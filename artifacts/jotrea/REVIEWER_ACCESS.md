# Reviewer access setup

This is the Android reviewer-access handoff for Jotrea. Do not add a real
reviewer code to Git, an issue, a screenshot, a log, or the Android bundle.

## Fixed production contract

- Production validation endpoint: `https://www.jotrea.com/api/validate-reviewer-code`
- Server-only Vercel variable: `REVIEWER_CODE`
- Never use `VITE_REVIEWER_CODE`. A `VITE_` value can be embedded in the web
  bundle and is not a secret.
- The Android UI is visible at **Settings → Reviewer Access**. The reviewer
  must complete onboarding first, enter the code, and choose **Activate reviewer
  access**.

The backend agent owns both supported API entrypoints. Do not change the
endpoint path, add a client-side fallback, or place the value in frontend
source. The app should not be described as live until the new backend code and
Production environment value have been redeployed and a production request has
been tested successfully.

## Generate one code on the Mac

Generate one 32-byte hex value on the release Mac, then keep it in the
clipboard only long enough to paste it into the secure destinations:

```bash
openssl rand -hex 32 | tr -d '\n' | pbcopy
```

Alternatively, from the repository root:

```bash
node scripts/generate-reviewer-code.mjs
```

The focused script uses `randomBytes(32)` and `pbcopy` on macOS, writes no file,
and never prints the code. Generate it **once** and paste the same clipboard
value into Vercel and the Play Console reviewer instructions; do not run the
generator twice or create different values for those destinations.

## Vercel Production setup and redeploy

1. In the Vercel dashboard, open **Projects**, select **jotrea-jotrea**, and
   open the project's **Settings → General** page. Confirm the repository
   **Root Directory** shown there; it may be the repository root or
   `artifacts/jotrea`. Do not guess a deployment URL or change the root while
   setting up reviewer access.
2. In that same project, open **Settings → Environment Variables**, select the
   **Production** environment, and add or update the variable named exactly
   `REVIEWER_CODE`. Paste the generated value into its value field. Do not add
   `VITE_REVIEWER_CODE`, and do not paste the value into source control.
3. Redeploy the new backend code and the Production variable from the
   dashboard's **Deployments** page. A variable change takes effect only in a
   new deployment. Confirm the deployment uses the Root Directory from step 1.
4. Before sharing reviewer instructions or saying the endpoint is live, test
   `https://www.jotrea.com/api/validate-reviewer-code` against the deployed
   backend using its documented request shape. Verify that a valid code is
   accepted and a missing or incorrect code is rejected. Do not include the
   real value in a command copied into a ticket or chat.

## Durable brute-force protection

The function's burst limiter is supplemental; it is not globally durable.
Publish this one Vercel Firewall rate-limit rule for the project:

- **Path**: `Equals` `/api/validate-reviewer-code`
- **AND Method**: `Equals` `POST`
- **Rate limit**: **Fixed window**, **10 requests**, **60 seconds**, per IP
- **Action**: **Default 429** (not Log and not Challenge)

In the Vercel dashboard, open the project, then **Firewall → Rules**, configure
the rule, and choose **Publish** for the firewall changes. Hobby supports one
rate rule, so do not add a second competing rate rule. Keep the path and POST
method conditions together; the rule must not throttle unrelated API routes.

## Google Play reviewer instructions

The complete paragraph below is under 500 characters, including a generated
64-character code. Paste it into the Play Console reviewer-access field only
after the production redeploy and endpoint test.
Keep `[REVIEWER_CODE]` as a placeholder in this repository and replace it only
in the secure Play Console submission.

> No login or purchase is required. Complete onboarding, then open Settings > Reviewer Access. Enter [REVIEWER_CODE] and tap Activate reviewer access. Internet is needed for activation. This unlocks all Android Plus features, including Medication Cabinet, Visit Notes, provider summaries and exports. Access remains active on this installation.

Use Android release 1.1, version code 4 or later (`com.sparky.jotrea`). Wait for
the in-app success confirmation before reviewing Plus areas. Uninstalling the
app or clearing its data removes the local grant.

## Rotation and removal

To stop new activations, open the Vercel dashboard's project **Settings →
Environment Variables** page, select **Production**, rotate or remove
`REVIEWER_CODE`, and redeploy. This stops new validations only after the new
deployment is serving. Existing activated grants are permanent: they survive
offline use and RevenueCat refresh. Rotating or removing the server value does
not revoke them. Uninstalling the app or clearing its data removes a local
grant.