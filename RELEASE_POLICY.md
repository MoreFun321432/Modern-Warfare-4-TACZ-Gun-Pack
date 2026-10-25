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

## Release page bug list

- Every published hotfix Release must include a `Bug 修复` section.
- List each independent bug actually included in that build and its
  player-visible result. When useful, add one short line describing the root
  cause or the affected gun/system.
- Do not list unverified fixes, future work, or fixes that are not present in the
  attached zip.
- Use [`RELEASE_NOTES_TEMPLATE.md`](./RELEASE_NOTES_TEMPLATE.md) as the required
  release description template.
- After uploading the replacement or new archive, read the Release page back and
  confirm that its bug list and attached file version match.

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

## Website updates

- Website-only Releases use a `website-*` tag and are listed on the separate
  `website-updates.html` page.
- Website Releases must not appear in the gun-pack update cards or gun-pack
  changelog.
- Website Releases have no download action. Their only external action is a link
  to the GitHub Release notes.

