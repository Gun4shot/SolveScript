# Free SolveScript deployment

Researched 12 October 2026. The recommended setup is one **free Render static
site** for React and one **free Render Docker web service** for Express,
Python/Pillow and Poppler. Keep the existing MongoDB Atlas database and public
Hugging Face paper archive. No paid database or disk is defined in `render.yaml`.

The static frontend does not idle-sleep. The backend still can. There is no
guarantee of uninterrupted service on these free plans, and exceeding quotas can
make the service unavailable. Do not upgrade resources to work around a limit.

## Current deployment status

Both services are live in the confirmed Render workspace, **My Workspace**:

- Frontend: https://solvescript.onrender.com (`srv-db6acjg473hc73doogo0`).
- API: https://solvescript-api.onrender.com (`srv-db6acq7avr4c73ao5rfg`),
  explicitly on the free plan in Singapore.

They were created directly through the Render integration. `render.yaml` is a
configuration reference, not an attached Blueprint; editing it alone does not
update these services. Do not create a duplicate Blueprint to update them.
The dashboard has the API rewrite first and the React fallback second.
Verified: live homepage/robots/sitemap, same-origin API health and catalog,
registration/login with secure cookies, owner-only GridFS upload/retrieval,
on-demand PDF download and 40 crops at 150 DPI in the Linux container.
Temporary production test accounts and files were removed after testing.
Search Console ownership is verified and the homepage is indexed on Google.
UptimeRobot checks the backend every five minutes and reports Up.
The Google OAuth callback is registered and the live login reaches Google's
account chooser. Final account consent/sign-in was not completed by the agent.

The existing database has MCQ and written-paper metadata. Its local Windows PDF
paths are not copied into the container. MCQ files are retrieved on demand from
`Sidant/solvescript-caie-papers`, under `mcq/caie`; written assets already reference
the archive under `caie`. Metadata/folder browsing does not download PDFs.

## Maintain the existing deployment

1. Push tested changes to `Gun4shot/SolveScript` on `main`, then manually deploy
   the affected existing Render service. Automatic deploys are off. Keep the API
   on Free; do not add paid databases, disks, or subscriptions.
2. Keep `MONGODB_URI`, Google credentials and the two distinct generated JWT
   secrets in Render environment settings, never in Git or chat.
3. Keep the existing Atlas database. `/api/health` verifies database readiness;
   `/api/live` verifies the process. No migration or reseed is needed.
4. Maintain these dashboard rewrites in order: `/api/*` to
   `https://solvescript-api.onrender.com/api/*`, then `/*` to `/index.html`.
   The frontend uses `/api` so login cookies remain same-origin. Editing the
   reference YAML does not update these dashboard rules.
5. The frontend build uses `RENDER_EXTERNAL_URL` for canonical tags and
   `sitemap.xml`. For a later custom domain, set `SITE_URL` to its HTTPS origin and
   rebuild. The free `onrender.com` subdomain is enough to publish and be indexed;
   a separately owned `.com` domain is not included.
6. Backend Google credentials and `GOOGLE_CALLBACK_URL` are set. The user added
   `https://solvescript.onrender.com/api/auth/google/callback` to the existing
   Google OAuth web client's authorized redirect URIs on 13 October 2026.
   Verified that live login now reaches Google's account chooser instead of
   `redirect_uri_mismatch`; full user consent/sign-in remains a user smoke test.
   Keep the callback on the frontend's same-origin proxy.
7. Verify the homepage with the backend stopped/asleep, then registration/login,
   folder browsing, starting one MCQ paper, one crop job, a written paper, and
   private upload/retrieval. Restart the backend and retrieve the same upload.
   Check the browser has no CORS, cookie, proxy or mixed-content errors. The
   production Linux container and Poppler crop runtime have been verified.

Automatic deploys are initially off so deployment only occurs after verifying
the configuration. They can be enabled after the first successful smoke test.

## Storage and capacity

- Public PDFs: Hugging Face; downloaded only for the selected MCQ paper. The
  original verified source is a fallback. Temporary downloaded PDFs/crops can be
  regenerated after a restart. Never upload students' private files there.
- Accounts, attempts and annotations: existing Atlas database.
- New private uploads: MongoDB GridFS when `UPLOAD_STORAGE=gridfs`; authorization
  is still checked by the existing owner-only paper routes. This avoids losing
  uploads with Render's ephemeral disk. Local development retains disk storage
  unless explicitly configured otherwise. Old local uploads would need migration
  before moving hosts; there were zero such records when this was checked.
- The deployment limits each uploaded PDF to 10 MB in both frontend and backend.
  Atlas Free has 0.5 GB **total**, shared by uploads, annotations, metadata and
  indexes. Watch its storage usage and avoid treating this as unlimited storage.
- Crop jobs share duplicate requests and run one at a time at 150 DPI to reduce
  memory usage on the free instance. This is a small beta deployment; concurrent
  crop requests can queue and larger papers may still hit timeouts.

Run `node server/scripts/checkDeploymentStorage.cjs` to verify GridFS persistence.
It writes one tiny fixture, removes its disk copy, restores it twice, and removes
only that fixture. It reads local server configuration without printing secrets.

## Optional uptime monitoring

Render Free sleeps after 15 minutes without inbound traffic and has 750 instance
hours per workspace per month. An external UptimeRobot Free HTTP monitor can
request `https://solvescript-api.onrender.com/api/health` every five minutes. This monitors
database readiness and may reduce idle sleeps. `/api/live` is a separate cheap
process-liveness endpoint available for deployment health checks.

UptimeRobot monitor `804253716` is configured for the health URL and was
verified **Up**, checked every **5m**, on 13 October 2026. The user created it
after the creation form redirected in the in-app browser. No alert contacts
are attached, so it sends checks but no incident notifications.
External pings are a best-effort workaround, not a documented
always-on guarantee; platform restarts, quotas and monitoring outages still
apply. No fake load, self-pinging loop, or scheduled GitHub Actions is included.
Only one continuously running free API normally fits the shared hours budget.
The workspace also contains another free API, TapTapbird; its usage shares this
quota. That unrelated service has not been modified.
The static site's homepage and robots file remain available independently.

## Google search

The build adds a brand-specific title/description, Open Graph metadata, website
structured data, canonical homepage URL, `robots.txt` and a homepage sitemap.
The homepage renders without waiting for authentication. Private studio routes
set `noindex`; API responses also carry `X-Robots-Tag: noindex` and `no-store`.
Authentication, not robots directives, protects private data.

The URL-prefix property `https://solvescript.onrender.com/` is verified using
the public Google verification meta tag in `index.html`. The sitemap was
submitted and Google accepted the homepage indexing request on 12 October 2026.
On 13 October 2026 the sitemap report shows **Success**, with one discovered
page. The earlier "Couldn't fetch" report resolved after Google's retry.
URL Inspection also confirms **URL is on Google / Page is indexed** on
13 October 2026. This does not promise any particular ranking for brand searches.

Indexing and ranking for “SolveScript” are Google's decisions. Neither a custom
domain nor a sitemap guarantees an immediate search result.

## Options checked and sources

- [Render Free](https://render.com/docs/free): static hosting plus compatible
  Docker API; API sleeps after 15 minutes, ephemeral disk, 750 shared monthly
  instance hours. No payment method means overage limits suspend services or
  builds rather than buying additional capacity.
- [Northflank pricing](https://northflank.com/pricing) offers always-on free
  Sandbox services, but its [billing documentation](https://northflank.com/docs/v1/application/billing/pricing-on-northflank)
  requires a payment method even on that plan.
- [Oracle Free Tier](https://www.oracle.com/cloud/free/faq/) requires card
  verification, and [idle free VMs may be reclaimed](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).
- [Koyeb billing](https://www.koyeb.com/docs/faqs/pricing) requires a card and
  documents an initial plan charge; its free instance also sleeps.
- [Hugging Face Spaces](https://huggingface.co/docs/hub/spaces-overview) is useful
  for apps but free hardware sleeps and outbound ports are restricted to
  80/443/8080. The current app needs a direct Atlas MongoDB connection on 27017.
  HF Datasets remains useful for the public PDF archive, not the database.
- [Atlas Free limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/)
  and [UptimeRobot free monitoring](https://help.uptimerobot.com/en/articles/11604710-who-should-use-uptimerobot-s-free-plan).
- [Google SEO guidance](https://developers.google.com/search/docs/fundamentals/seo-starter-guide).
