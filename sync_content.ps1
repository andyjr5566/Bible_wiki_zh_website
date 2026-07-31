$repoPath = 'C:\Obsidian\Bible_wiki_zh_website_quartz'
$source = 'C:\Obsidian\Hermes\scripture'
$target = 'C:\Obsidian\Bible_wiki_zh_website_quartz\content'

if (Test-Path $target) {
    Remove-Item -Path $target -Recurse -Force
}

New-Item -ItemType Directory -Path $target -Force | Out-Null

$items = @('appendix', 'link_folder', 'INSTALL_COMPUTER.md', 'INSTALL_MOBILE.md', 'README.md', 'index.md')
foreach ($item in $items) {
    $itemPath = Join-Path $source $item
    if (Test-Path $itemPath) {
        Copy-Item -Path $itemPath -Destination $target -Recurse -Force
    }
}

Get-ChildItem -Path $source -Directory | Where-Object { $_.Name -match '^[0-9]' } | ForEach-Object {
    $destination = Join-Path $target $_.Name
    robocopy $_.FullName $destination /E /XD .tmp /NFL /NDL /NJH /NJS /NP | Out-Null

    if ($LASTEXITCODE -ge 8) {
        throw "Failed to copy $($_.FullName) to $destination"
    }
}

Write-Host 'Content sync completed.'

# ── Sync static website assets to quartz/static/website ────────
$websiteSource = Join-Path $source 'appendix\website'
$staticWebsiteTarget = Join-Path $repoPath 'quartz\static\website'

if (Test-Path $websiteSource) {
    if (Test-Path $staticWebsiteTarget) {
        Remove-Item -Path $staticWebsiteTarget -Recurse -Force
    }
    New-Item -ItemType Directory -Path $staticWebsiteTarget -Force | Out-Null
    Copy-Item -Path "$websiteSource\*" -Destination $staticWebsiteTarget -Recurse -Force
    Write-Host 'Static website assets synced to quartz/static/website.'
}

# ── Git commit & push ──────────────────────────────────────────
$repoPath = 'C:\Obsidian\Bible_wiki_zh_website_quartz'
Push-Location $repoPath

try {
    $status = git status --porcelain
    if ($status) {
        git add -A
        $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
        git commit -m "sync: content update $timestamp"
        Write-Host 'Committed changes.'

        git push
        if ($LASTEXITCODE -ne 0) {
            throw "git push failed (exit code $LASTEXITCODE)"
        }
        Write-Host 'Pushed to remote.'
    }
    else {
        Write-Host 'No changes to commit.'
    }
}
finally {
    Pop-Location
}

exit 0
