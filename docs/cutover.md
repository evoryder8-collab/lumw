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
  robots. The international-awards and media release completed successfully
  in run `35049072004`, deploying commit `4f5d179`. The build, browser journeys,
  accessibility checks and median-of-three mobile performance budgets passed.
- Changed the four apex A records at Wix to `185.199.108.153`,
  `185.199.109.153`, `185.199.110.153`, `185.199.111.153`, and the `www` CNAME
  to `evoryder8-collab.github.io`. Authoritative DNS and two public resolvers
  agree. Google Workspace and other non-web records were preserved.
- GitHub's DNS health check reports both www and apex valid and served by
  Pages. The certificate became available at 04:44 Zurich time, and HTTPS
  enforcement is enabled. Normal certificate-verified requests succeed.
  Two remove/re-add attempts following GitHub's recovery procedure were needed;
  the second followed consistently valid DNS results and completed issuance.
- Audited all 51 canonical production URLs, 66 linked assets, robots and six
  locale sitemaps over HTTPS. The apex, HTTP www and old GitHub Pages links
  return permanent redirects to the correct HTTPS www destinations.
- Checked the live German language and sound flow at a 390px viewport. Yes
  starts the intro playing unmuted at full volume, and playback advances without
  a media error. The new 2026 awards video also plays on the live domain.
- Verified the Search Console domain property `sc-domain:luma-wellness.com`
  in June's signed-in Google account. Its new verification TXT record is in
  both the current Wix zone and the future Infomaniak zone. The previous DNS
  verification record and existing HTML verification meta tag remain intact.
- Resubmitted `https://www.luma-wellness.com/sitemap.xml`. Search Console shows
  Success and a 16 September read date. Requested indexing for the treatments
  and prices page; Google confirmed its addition to the priority crawl queue.
  The homepage already appears in Google's index. Its manual recrawl request
  and live inspection returned temporary Google errors asking for a later retry.
  These were not crawl-rejection reports. The submitted sitemap remains active.
- The owner entered the transfer code and personally completed the CHF 14.70
  Infomaniak checkout. Registrar transfer is in progress, with registry status
  `pending transfer`. Infomaniak estimates 22 September 2026 at 03:21 Zurich time.
- Prepared and checked the complete future Infomaniak zone on
  `ns11.infomaniak.ch` and `ns12.infomaniak.ch`: GitHub web records, five Google
  MX records, the existing SPF and mail CNAMEs, both Google verification TXT
  records, and legacy `de` and `en` CNAMEs. The unsuitable default SPF and DMARC
  entries were replaced with the preserved existing records.
  Direct queries to the future nameserver also return the four GitHub A records,
  www CNAME, Google MX records, SPF and both Google verification records.

## Outstanding checks

1. Retry the optional homepage live inspection and indexing request after
   Google's temporary service error clears. The domain and paths are unchanged,
   so no Change of Address applies. Sitemap discovery is already enabled.
2. Verify registrar completion and the nameserver switch to Infomaniak. Then
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
