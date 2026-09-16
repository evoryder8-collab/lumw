# Production migration

Owner authorization: 16 September 2026. Canonical host remains
`https://www.luma-wellness.com`. GitHub Pages serves the website; Infomaniak
will hold the domain registration. Google Workspace mail stays in place.

## Completed

- Archived a fresh Wix crawl of all 25 original German URLs. Exact titles and
  descriptions in `src/data/wix-seo-baseline.json` are checked by `npm run verify`.
  The owner explicitly requested an international-awards homepage H1; this
  exception is documented in the content check without changing the archive.
- Saved the previous Wix HTML, sitemaps and complete DNS zone locally in
  ignored `artifacts/cutover-2026-09-16/` for comparison and rollback.
- Configured GitHub Pages for `www.luma-wellness.com` and set repository variable
  `LUMA_DEPLOYMENT=production`. The production build uses `/` and indexable
  robots. The earlier verified deployment completed successfully in run
  `35043904379`; subsequent design releases use the same pipeline.
- Changed the four apex A records at Wix to `185.199.108.153`,
  `185.199.109.153`, `185.199.110.153`, `185.199.111.153`, and the `www` CNAME
  to `evoryder8-collab.github.io`. Authoritative DNS and two public resolvers
  agree. Google Workspace and other non-web records were preserved.
- GitHub's DNS health check now reports both www and apex valid, served by
  Pages and HTTPS eligible. The HTTP origin serves the correct production
  build. Certificate issuance and HTTPS enforcement are still pending at
  this checkpoint. One remove/re-add of the custom domain, following GitHub's
  documented recovery procedure, restarted issuance after DNS had propagated.
- Verified the Search Console domain property `sc-domain:luma-wellness.com`
  in June's signed-in Google account. Its new verification TXT record is in
  both the current Wix zone and the future Infomaniak zone. The previous DNS
  verification record and existing HTML verification meta tag remain intact.
- The owner entered the transfer code and personally completed the CHF 14.70
  Infomaniak checkout. Registrar transfer is in progress, with registry status
  `pending transfer`. Infomaniak estimates 22 September 2026 at 03:21 Zurich time.
- Prepared and checked the complete future Infomaniak zone on
  `ns11.infomaniak.ch` and `ns12.infomaniak.ch`: GitHub web records, five Google
  MX records, the existing SPF and mail CNAMEs, both Google verification TXT
  records, and legacy `de` and `en` CNAMEs. The unsuitable default SPF and DMARC
  entries were replaced with the preserved existing records.

## Outstanding checks

1. Wait for GitHub's certificate, verify normal HTTPS on www and apex, then
   enable HTTPS enforcement. Check apex-to-www and old GitHub Pages redirects.
2. Run the saved production audit across all 51 canonical pages, media assets,
   robots and all six locale sitemaps. Recheck live sound onboarding and media.
3. Submit `https://www.luma-wellness.com/sitemap.xml` in the verified Search
   Console property. Inspect the homepage and important services and request
   indexing. The domain and paths are unchanged, so no Change of Address applies.
4. Verify registrar completion and the nameserver switch to Infomaniak. Then
   verify mail DNS and configure Infomaniak DNSSEC with its own signing key.

At this checkpoint authoritative nameservers remain `ns14.wixdns.net` and
`ns15.wixdns.net`. The registry DS record was removed as part of transfer
initiation. Do not reuse the old Wix DNSSEC key at Infomaniak.

## Rollback and subscription handling

Retain the Wix website and DNS backup through the post-launch review window.
If rollback is needed, restore the archived Wix apex A records and `www` CNAME.
Never publish staging noindex to the production hostname. The Wix website
subscription has not been cancelled. Keep Google Workspace billing and mail
intact: it is a separate service from the website plan and domain transfer.

The legacy `de` and `en` Wix subdomains are preserved until replacement redirects
are ready. The established canonical site uses www and its existing German paths.

## Provider references

- [GitHub custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [GitHub HTTPS provisioning](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
- [Wix transfer process](https://support.wix.com/en/article/transferring-your-wix-domain-away-from-wix-2477749)
- [Infomaniak transfer process](https://www.infomaniak.com/en/support/faq/447/transfer-your-domain-name-to-infomaniak)

Indexing and search positions remain Google's decisions. Crawl and metadata
checks establish eligibility, not a guarantee of rankings.
