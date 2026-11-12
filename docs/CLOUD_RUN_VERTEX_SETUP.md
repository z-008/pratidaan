# Cloud Run deployment through GitHub Actions

The workflow at `.github/workflows/deploy-cloud-run.yml` runs on every push to `main`, including a merged pull request. Pushes that change only Markdown, `docs/` or `.env.example` don't deploy. The workflow:

1. runs the backend tests;
2. type-checks and builds the frontend;
3. builds the container on GitHub's runner and pushes it to Artifact Registry;
4. deploys that exact commit to Cloud Run;
5. checks `/api/health`.

Feature branches don't deploy.

- **Project:** `project-6055aa98-bf59-48b5-a50`
- **Region:** `asia-south1` (Mumbai) for Cloud Run and Artifact Registry
- **Service:** `pratidaan`
- **Live URL:** from the latest GitHub Actions deploy log (`gcloud run services describe pratidaan --region asia-south1 --format='value(status.url)'`)

## What the deploy sets

The workflow deploys with these settings:

- 1 vCPU and 512 MiB;
- 1 minimum and 4 maximum instances, concurrency 20 (so several judges can use Drop at once without long queues);
- a 180 s timeout;
- the runtime service account `tracedrop-run`;
- public access (the app itself requires Google sign-in or a guest session);
- these environment variables:

| Variable | Value |
|---|---|
| `GOOGLE_CLOUD_PROJECT` | the project ID |
| `VERTEX_LOCATION` | `global` |
| `LLM_MODEL` | `gemini-3.1-flash-lite` |
| `LLM_RATE_LIMIT_RPS` / `LLM_RATE_LIMIT_TOKENS_PER_DAY` / `LLM_MAX_CALLS_PER_DAY` | 10 / 500000 / 2000 |
| `GOOGLE_CLIENT_ID` | GitHub Actions variable `GOOGLE_CLIENT_ID` |
| `SESSION_SECRET` | GitHub Actions secret `SESSION_SECRET` |

The container sets `NODE_ENV=production`, which also disables the local sign-in bypass.

## One-time Google Cloud setup (Cloud Shell)

Check the active project first:

```sh
gcloud config get-value project   # must print project-6055aa98-bf59-48b5-a50
```

Then run:

```sh
gcloud services enable run.googleapis.com artifactregistry.googleapis.com aiplatform.googleapis.com firestore.googleapis.com iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com calendar-json.googleapis.com gmail.googleapis.com
gcloud artifacts repositories create tracedrop --repository-format=docker --location=asia-south1 --description="Pratidaan application images"
gcloud firestore databases create --location=asia-south1
gcloud iam service-accounts create tracedrop-run --display-name="Pratidaan runtime"
gcloud iam service-accounts create tracedrop-deploy --display-name="GitHub Actions deployer"
gcloud projects add-iam-policy-binding project-6055aa98-bf59-48b5-a50 --member="serviceAccount:tracedrop-run@project-6055aa98-bf59-48b5-a50.iam.gserviceaccount.com" --role="roles/aiplatform.user"
gcloud projects add-iam-policy-binding project-6055aa98-bf59-48b5-a50 --member="serviceAccount:tracedrop-run@project-6055aa98-bf59-48b5-a50.iam.gserviceaccount.com" --role="roles/datastore.user"
gcloud projects add-iam-policy-binding project-6055aa98-bf59-48b5-a50 --member="serviceAccount:tracedrop-deploy@project-6055aa98-bf59-48b5-a50.iam.gserviceaccount.com" --role="roles/run.admin"
gcloud artifacts repositories add-iam-policy-binding tracedrop --location=asia-south1 --member="serviceAccount:tracedrop-deploy@project-6055aa98-bf59-48b5-a50.iam.gserviceaccount.com" --role="roles/artifactregistry.writer"
gcloud iam service-accounts add-iam-policy-binding tracedrop-run@project-6055aa98-bf59-48b5-a50.iam.gserviceaccount.com --member="serviceAccount:tracedrop-deploy@project-6055aa98-bf59-48b5-a50.iam.gserviceaccount.com" --role="roles/iam.serviceAccountUser"
gcloud iam workload-identity-pools create github-tracedrop --location=global --display-name="Pratidaan GitHub Actions"
gcloud iam workload-identity-pools describe github-tracedrop --location=global --format='value(name)'
```

The runtime needs Vertex AI User for Gemini, and Cloud Datastore User for Firestore, which holds accounts, sign-ins, preferences and bookings. If Firestore already exists in another location, skip the `databases create` line. The Firestore location is not promised to users: the privacy page names only the app server's region.

Copy the pool name from the last command. Its form is `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-tracedrop`. Put it in place of `POOL_NAME` below:

```sh
gcloud iam workload-identity-pools providers create-oidc github --location=global --workload-identity-pool=github-tracedrop --display-name="GitHub OIDC" --issuer-uri="https://token.actions.githubusercontent.com" --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" --attribute-condition="assertion.repository=='uppilisrinivasan/tracedrop' && assertion.ref=='refs/heads/main'"
gcloud iam service-accounts add-iam-policy-binding tracedrop-deploy@project-6055aa98-bf59-48b5-a50.iam.gserviceaccount.com --member="principalSet://iam.googleapis.com/POOL_NAME/attribute.repository/uppilisrinivasan/tracedrop" --role="roles/iam.workloadIdentityUser"
gcloud iam workload-identity-pools providers describe github --location=global --workload-identity-pool=github-tracedrop --format='value(name)'
```

The provider accepts only `uppilisrinivasan/tracedrop` on `main`. No service-account key is downloaded or stored in GitHub.

## Google sign-in, Calendar and Gmail

In **Google Auth Platform** for the project:

1. Create an OAuth **Web client**. Under **Authorized JavaScript origins**, add the exact Cloud Run URL for service `pratidaan` (e.g. `https://pratidaan-XXXX-el.a.run.app`, **no trailing slash**) and `http://localhost:5173` for local testing. If origins drift after redeploy, judges may see **Error 400: origin_mismatch** until you add the new URL. Guest sign-in works without OAuth.
2. Add these scopes to the app:
   - `https://www.googleapis.com/auth/calendar.events.freebusy`
   - `https://www.googleapis.com/auth/calendar.events.owned`
   - `https://www.googleapis.com/auth/gmail.send`

   Calendar and Gmail scopes are sensitive: until Google verifies the app, only listed test users can complete that consent. Sign-in itself and guest mode work for anyone.
3. Set the consent screen's privacy policy and terms links to `<Cloud Run URL>/privacy` and `<Cloud Run URL>/terms`. Both pages are public.

## GitHub settings

In the repository, open **Settings → Secrets and variables → Actions**.

**Variables:**
- `GCP_WIF_PROVIDER`: the full provider name, ending in `/providers/github`
- `GCP_DEPLOY_SERVICE_ACCOUNT`: `tracedrop-deploy@project-6055aa98-bf59-48b5-a50.iam.gserviceaccount.com`
- `GOOGLE_CLIENT_ID`: the OAuth web client ID

**Secrets:**
- `SESSION_SECRET`: a long random string. It signs session cookies and check-in codes, and the server refuses to sign sessions in production without it.

## Checking a deployment

1. Open the repository's **Actions** tab and watch **Deploy Pratidaan to Cloud Run**. It prints the URL after the health check passes (currently `https://pratidaan-25mgkruoeq-el.a.run.app`).
2. Send judges [docs/05-submission/judge-instructions.html](../05-submission/judge-instructions.html) with your submission email (sample questions, guardrails, architecture).
3. Open the URL in a private window. Sign in with Google, or click **Continue as guest**.
4. Pick Arjun in **Viewing as**, then exercise:
   - Drop's chat ("How is my BP doing?");
   - **Add an outside lab report** with the sample report;
   - **+1 day** on the demo bar, which brings the Results Card.
5. Open `/#ai`. The AI console should say "Verified · gemini-3.1-flash-lite" and list the calls. `ai.live` in `/api/health` is true only after a successful model call.

## Costs and limits

- **Instances:** production keeps one warm instance and scales up to four under load (concurrency 20 per instance).
- **AI limits:** per process: 500,000 tokens/day, 2,000 calls/day, 10 req/s (reset on restart). They are brakes, not a project-wide spending cap.
- **Firebase:** not used. Only **Cloud Firestore** for signed-in account data.
- **Budget alerts:** set a Google Cloud budget with alerts. Alerts don't stop usage.
- **Who can spend:** anyone who signs in, or continues as a guest, can trigger model calls within those limits.
- **Images:** Artifact Registry keeps every image; set a cleanup policy.
