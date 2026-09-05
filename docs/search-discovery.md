# Google Search discovery

The public product is **Skechu**, also named **Skechu-PPT**. Keep both names in honest, readable descriptions; do not add hidden keyword lists or fabricated ratings.

## Public pages

- Editor: https://evan6007.github.io/skechu-ppt/
- Feature guide: https://evan6007.github.io/skechu-ppt/about.html
- Sitemap: https://evan6007.github.io/skechu-ppt/sitemap.xml

The editor stays the default entry. The guide is static HTML linked from the editor's project/export menu and the README. It explains actual features and the Windows requirement for native PowerPoint copying. Each page has its own canonical URL, without testing/storage/version query parameters. OAuth and local bridge helper pages use `noindex` and are excluded from the sitemap.

Application JSON-LD identifies the software and its alternate name. It does not claim ratings or promise a rich result. Google site-name markup is not supported at a subdirectory such as `/skechu-ppt/`; do not claim a `WebSite` block here will set the host's search-result site name.

## Owner setup in Search Console

1. Use the owner's Google account at https://search.google.com/search-console/.
2. Add the exact **URL-prefix** property `https://evan6007.github.io/skechu-ppt/`. Do not try to verify the entire `github.io` domain.
3. Choose the HTML tag or HTML verification file method. Copy only the actual token supplied by Google, publish it, confirm the live response, then click Verify. Keep existing owners' verification tokens. Never commit account credentials.
4. Submit the sitemap URL above in the Sitemaps report.
5. Inspect the exact editor URL. Read the reported crawl/indexing reason, run a live test, then request indexing when allowed. The guide can be submitted separately.
6. Keep the verification tag/file after verification. Check the URL Inspection and indexing reports for actual progress. A successful live test or indexing request is not proof the page is indexed.

Adding metadata alone does not perform steps 1–5. These require the owner's account and consent; do not record them as complete without Search Console confirmation.

### Verified setup: 2026-09-06 (Asia/Taipei)

With the owner's explicit approval, the exact URL-prefix property above was verified through Google's supplied HTML meta tag. The public tag is retained in `app/index.html` and guarded by `tests/check_seo.mjs`. No Analytics, ads, DNS changes or additional owners were added.

- **Homepage:** the existing index report said the URL was unknown to Google, with no previous crawl. The live test passed. Search Console then confirmed the indexing request and placement in its priority crawl queue.
- **Feature guide:** Search Console also confirmed the indexing request and priority crawl queue placement for `/about.html`.
- **Sitemap:** submitted successfully, but the Sitemaps report still said `Couldn't fetch` with 0 discovered pages. The exact submitted URL was verified; Google's live URL test at 01:35 reported crawl allowed, page fetch successful, and indexing allowed. The public response was HTTP 200 with `application/xml` and both expected URLs. Resubmitted once after that test; successful parsing by the sitemap processor is **not yet confirmed**.
- **Manual actions / security issues:** both reports showed no detected issues.

The two page requests are accepted, not proof of completed indexing or ranking. On the next check, read the existing sitemap and URL Inspection reports; do not repeatedly resubmit or fabricate a completion status. Google may retry failed sitemap fetches for a few days: [Sitemaps report documentation](https://support.google.com/webmasters/answer/7451001).

## Validation and scope

Run `node tests/check_seo.mjs` and normal application checks before publishing. Verify the live editor, guide and sitemap return HTTP 200 and that no `X-Robots-Tag: noindex` blocks the public pages. A missing host-level robots.txt returning 404 is not a crawl ban. A file at `/skechu-ppt/robots.txt` would not control crawling for the host, so this project deliberately does not add an ineffective one or mutate the unrelated account-root site.

On 2026-09-06, a live Google search for `skechu` displayed a correction to `sketchup`; the exact-term first page contained other namesakes, not this app. This is an observed result, not proof of the entire index status. Search Console is the authoritative next diagnostic step.

Google may take days to weeks to crawl changes and does not guarantee inclusion or ranking. Do not repeatedly request indexing, use the restricted Indexing API for this editor, buy links, or promise a first-page position.

Official references: [Search Essentials](https://developers.google.com/search/docs/essentials), [JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [request recrawling](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl), [ownership verification](https://support.google.com/webmasters/answer/9008080), [site names](https://developers.google.com/search/docs/appearance/site-names).
