# Production migration

Owner authorization: 16 September 2026. Canonical host remains
`https://www.luma-wellness.com`. GitHub Pages serves the website; Infomaniak
will hold the domain registration. Google Workspace mail stays in place.

## Prepared and verified

- Fresh Wix crawl: all 25 original German URLs returned 200. Exact titles and
  descriptions are recorded in `src/data/wix-seo-baseline.json` and checked by
  `npm run verify`. The original substantive-copy checks remain enabled.
- Full Wix DNS UI snapshot and public DNS baseline are saved locally in
  ignored `artifacts/cutover-2026-09-16/`. That directory also contains the
  old Wix HTML and sitemaps for rollback comparison.
- The current Wix Google verification meta tag is retained. Preserve the
  existing Google DNS verification record through the registrar transfer.
- Root production build passes `PUBLIC_BASE=/ PUBLIC_INDEXABLE=true npm run
  verify`. Browser checks pass all 51 URLs, responsive layouts, accessibility,
  gallery hints and audible playback with a user gesture.
- GitHub repository variable `LUMA_DEPLOYMENT` selects matching indexing and
  paths. Unset means noindex at `/lumw`; `production` means indexable at `/`.
- Wix emailed the EPP transfer code to the registered contact. The owner
  entered it and completed the CHF 14.70 Infomaniak checkout in the browser.
  The order is registered; registrar completion still needs verification.
- GitHub Pages custom domain is now `www.luma-wellness.com`, and
  `LUMA_DEPLOYMENT=production` is set for the next verified deployment.
  Public DNS has not yet been changed at this checkpoint.

## Cutover sequence

1. Configure GitHub Pages custom domain `www.luma-wellness.com`.
2. Set `LUMA_DEPLOYMENT=production` and run the deployment workflow. Confirm
   build, browser, accessibility and mobile performance checks pass.
3. Set the apex A records to `185.199.108.153`, `185.199.109.153`,
   `185.199.110.153`, `185.199.111.153`. Set `www` CNAME to
   `evoryder8-collab.github.io`. Preserve mail and verification records.
4. Verify public DNS, valid HTTPS, apex to www redirect, all original URLs,
   canonical tags, indexable robots and all six sitemap files.
5. Submit `https://www.luma-wellness.com/sitemap.xml` in the existing Search
   Console property and request inspection of the homepage and top services.
   The domain and paths stay the same, so no Change of Address is needed.
6. Complete the Infomaniak transfer and migrate the complete DNS zone. The
   Wix DNSSEC DS record must not remain after moving to a different signing
   key. Verify DNSSEC and mail resolution after the nameserver change.

At preparation time the nameservers are `ns14.wixdns.net` and
`ns15.wixdns.net`. Google Workspace has five MX records, an SPF TXT record,
and existing Wix mail authentication CNAMEs. The zone also contains `de` and
`en` Wix subdomains; preserve them until their replacement redirects are ready.

## Rollback and subscription handling

Retain the old Wix website and the DNS backup through the post-launch review
window. If rollback is needed, restore the archived Wix apex A records and
`www` CNAME first. Never publish staging noindex to the production hostname.
Keep Google Workspace billing and mail intact. Domain transfer is separate
from the Wix site plan and from the email subscription.

## Provider references

- [GitHub custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [Wix transfer process](https://support.wix.com/en/article/transferring-your-wix-domain-away-from-wix-2477749)
- [Wix external hosting](https://support.wix.com/en/article/connecting-a-wix-domain-to-an-external-site)
- [Infomaniak transfer process](https://www.infomaniak.com/en/support/faq/447/transfer-your-domain-name-to-infomaniak)

Indexing and search positions remain Google's decisions. Passing crawl and
metadata checks makes the site eligible; it does not guarantee rankings.
