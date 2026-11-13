# Chùa Mây static site

No dependency installation is required.

```powershell
node site/build.mjs
node site/check.mjs
```

`site-content/*.md` is the source copy. `site/dist/` is the deployable static output. Change `allowAiCrawlers` near the top of `site/build.mjs` to change the named AI-crawler policy in one place, then regenerate.
