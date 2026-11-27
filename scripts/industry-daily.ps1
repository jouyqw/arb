$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
git fetch origin main
if ($LASTEXITCODE -ne 0) { throw 'Fetch failed' }
git rebase origin/main
if ($LASTEXITCODE -ne 0) { throw 'Remote changed; reconcile before publishing' }
node scripts/refill-industry-queue.mjs
if ($LASTEXITCODE -ne 0) { throw 'Draft replenishment failed' }
node scripts/review-industry-queue.mjs
if ($LASTEXITCODE -ne 0) { throw 'Editorial review failed' }
git add -- content/industry-queue
git diff --cached --quiet
if ($LASTEXITCODE -eq 1) {
  git -c user.name=publish-bot -c user.email=bot@auto.local commit -m 'Replenish reviewed industry articles'
  if ($LASTEXITCODE -ne 0) { throw 'Commit failed' }
  git pull --rebase origin main
  if ($LASTEXITCODE -ne 0) { throw 'Concurrent update needs reconciliation' }
  git push origin main
  if ($LASTEXITCODE -ne 0) { throw 'Push failed' }
}
gh workflow run publish-industry.yml
if ($LASTEXITCODE -ne 0) { throw 'Publish dispatch failed' }
