$repoPath = 'C:\Obsidian\Bible_wiki_zh_website_quartz'
$source = 'C:\Obsidian\Hermes\scripture'
$target = 'C:\Obsidian\Bible_wiki_zh_website_quartz\content'

function Sync-WithRobocopy {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourcePath,

        [Parameter(Mandatory = $true)]
        [string]$DestinationPath,

        [string]$FileName
    )

    New-Item -ItemType Directory -Path $DestinationPath -Force | Out-Null

    $robocopyArgs = @($SourcePath, $DestinationPath)

    if ($FileName) {
        $robocopyArgs += $FileName
    }

    $robocopyArgs += @(
        '/E',
        '/XD', '.tmp',
        '/XO',
        '/R:2',
        '/W:1',
        '/NFL',
        '/NDL',
        '/NJH',
        '/NJS',
        '/NP'
    )

    & robocopy @robocopyArgs | Out-Null
    if ($LASTEXITCODE -ge 8) {
        throw "Failed to sync $SourcePath to $DestinationPath"
    }
}

New-Item -ItemType Directory -Path $target -Force | Out-Null

$items = @('appendix', 'link_folder', 'INSTALL_COMPUTER.md', 'INSTALL_MOBILE.md', 'README.md', 'index.md')
foreach ($item in $items) {
    $itemPath = Join-Path $source $item
    if (Test-Path $itemPath) {
        if ((Get-Item -LiteralPath $itemPath).PSIsContainer) {
            $destination = Join-Path $target $item
            Sync-WithRobocopy -SourcePath $itemPath -DestinationPath $destination
        }
        else {
            Sync-WithRobocopy -SourcePath $source -DestinationPath $target -FileName $item
        }
    }
}

Get-ChildItem -Path $source -Directory | Where-Object { $_.Name -match '^[0-9]' } | ForEach-Object {
    $destination = Join-Path $target $_.Name
    Sync-WithRobocopy -SourcePath $_.FullName -DestinationPath $destination
}

Write-Host 'Content sync completed.'

# ── Sync static website assets to quartz/static/website ────────
$websiteSource = Join-Path $source 'appendix\website'
$staticWebsiteTarget = Join-Path $repoPath 'quartz\static\website'

if (Test-Path $websiteSource) {
    Sync-WithRobocopy -SourcePath $websiteSource -DestinationPath $staticWebsiteTarget
    Write-Host 'Static website assets synced to quartz/static/website.'
}

# ── Auto-transform appendix/website links in content .md files ──
Get-ChildItem -Path $target -Recurse -Filter *.md | ForEach-Object {
    $filePath = $_.FullName
    $fileContent = Get-Content -Path $filePath -Raw -Encoding UTF8
    if ($fileContent -match 'appendix/website/') {
        $relDir = [System.IO.Path]::GetDirectoryName($filePath).Substring($target.Length).TrimStart('\', '/')
        $depth = if ($relDir.Length -gt 0) { ($relDir -split '[\\/]').Count } else { 0 }
        $prefix = if ($depth -gt 0) { (1..$depth | ForEach-Object { '..' }) -join '/' } else { '.' }

        $updated = [regex]::Replace($fileContent, '\[([^\]]+)\]\((?:\./)?(?:.*?/)?appendix/website/([^)]+)\)', {
            param($match)
            $title = $match.Groups[1].Value
            $relPath = $match.Groups[2].Value
            return "<a href=""$prefix/static/website/$relPath"" target=""_blank"">$title</a>"
        })
        if ($updated -ne $fileContent) {
            Set-Content -Path $filePath -Value $updated -Encoding UTF8
        }
    }
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
