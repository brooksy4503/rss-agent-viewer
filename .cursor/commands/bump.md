# Bump & Publish rss-agent-viewer

Release a new version of the `rss-agent-viewer` package and publish it to npm.

1. Make sure you are logged in to npm (`npm login`) and have publish rights.
2. Ensure the git working tree is clean (commit or stash changes).
3. Choose the version bump type (`patch`, `minor`, or `major`) before running.

```bash
npm install
npm run build
npm version patch
npm publish --access public
```

> Replace `patch` with `minor`, `major`, or an explicit version (e.g. `1.2.3`) as needed.
> After publishing, push the commit and tag: `git push --follow-tags`.
