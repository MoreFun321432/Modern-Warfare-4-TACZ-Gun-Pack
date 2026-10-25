# GitHub release policy

This policy applies to every update pushed to
`MoreFun321432/Modern-Warfare-4-TACZ-Gun-Pack`.

## Bug-fix hotfixes

- Bug fixes are accumulated and verified locally first.
- A hotfix is published only after at least **three independent bug fixes** have
  been completed and verified.
- Multiple symptoms caused by one root cause count as one bug, not several.
- When the threshold is reached, increment only the final version component
  (for example `1.8.0-Release` to `1.8.1-Release`), rebuild the main pack, push
  the update, and create the GitHub Release.
- A change batch below the threshold stays local and is not uploaded to GitHub.
- The repository owner may explicitly authorize an earlier or different release.

## New guns

- Adding a new gun does not grant permission to push or publish it.
- By default, new-gun work remains local and must not update the GitHub
  repository, GitHub Pages, or Releases.
- Uploading and publishing a new gun requires an explicit instruction in the
  current request, even after integration and in-game verification are complete.

## Scope

- Only the main `Modern Warfare 4` pack participates in GitHub releases.
- The frozen Lite pack is excluded.
- There is no automatic GitHub Release workflow. Pushing code and publishing a
  version are deliberate, separately verified operations.

