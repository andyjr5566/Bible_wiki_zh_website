$repoPath = 'C:\Obsidian\Bible_wiki_zh_website_quartz'
$source = 'C:\Obsidian\Hermes\scripture'
$target = 'C:\Obsidian\Bible_wiki_zh_website_quartz\content'

function Sync-WithRobocopy {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourcePath,

        [Parameter(Mandatory = $true)]
        [string]$DestinationPath,

        [string]$FileName,

        # Mirror mode: also delete files in the destination that no longer exist
        # in the source (renamed / removed in Obsidian). Without this, robocopy
        # only adds and overwrites, so stale files pile up in the repo and can
        # break the CI build (e.g. old TypeScript files left after a project swap).
        [switch]$Mirror,

        # Extra directory names to skip (matched at any depth, never purged).
        [string[]]$ExcludeDir = @()
    )

    if ($Mirror -and -not $FileName) {
        # Safety: an empty/unreadable source must never wipe the destination.
        $hasFiles = Get-ChildItem -LiteralPath $SourcePath -Recurse -File -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if (-not $hasFiles) {
            throw "Refusing to mirror: source is empty: $SourcePath"
        }
    }

    New-Item -ItemType Directory -Path $DestinationPath -Force | Out-Null

    $robocopyArgs = @($SourcePath, $DestinationPath)

    if ($FileName) {
        $robocopyArgs += $FileName
    }

    if ($FileName) {
        # A file filter must not use /E, otherwise robocopy creates every
        # source subdirectory and copies matching files from all levels.
        $robocopyArgs += @(
            '/XO',
            '/R:2',
            '/W:1',
            '/NFL',
            '/NDL',
            '/NJH',
            '/NJS',
            '/NP'
        )
    }
    else {
        if ($Mirror) {
            # /PURGE deletes extras in the destination. Directories/files named in
            # /XD and /XF are neither copied nor purged, so local build output
            # (node_modules, dist) is left alone on both sides. /XO is omitted so
            # the destination always converges to the source, even if the source
            # file is older.
            $robocopyArgs += @('/E', '/PURGE', '/XD')
            $robocopyArgs += @('.tmp', 'node_modules', 'dist', '__pycache__')
            $robocopyArgs += $ExcludeDir
            $robocopyArgs += @('/XF', '*.pyc')
        }
        else {
            $robocopyArgs += @('/E', '/XD', '.tmp')
            $robocopyArgs += $ExcludeDir
            $robocopyArgs += '/XO'
        }
        $robocopyArgs += @(
            '/R:2',
            '/W:1',
            '/NFL',
            '/NDL',
            '/NJH',
            '/NJS',
            '/NP'
        )
    }

    & robocopy @robocopyArgs | Out-Null
    if ($LASTEXITCODE -ge 8) {
        throw "Failed to sync $SourcePath to $DestinationPath"
    }
}

New-Item -ItemType Directory -Path $target -Force | Out-Null

$items = @('appendix', 'link_folder', 'INSTALL_COMPUTER.md', 'INSTALL_MOBILE.md', 'README.md', 'index.md','專案流程說明.md')
foreach ($item in $items) {
    $itemPath = Join-Path $source $item
    if (Test-Path $itemPath) {
        if ((Get-Item -LiteralPath $itemPath).PSIsContainer) {
            $destination = Join-Path $target $item
            if ($item -eq 'appendix') {
                # Everything under appendix/ except the website apps is additive;
                # the website apps are mirrored separately below.
                Sync-WithRobocopy -SourcePath $itemPath -DestinationPath $destination -ExcludeDir 'website'
                $websiteSrc = Join-Path $itemPath 'website'
                if (Test-Path -LiteralPath $websiteSrc) {
                    Sync-WithRobocopy -SourcePath $websiteSrc -DestinationPath (Join-Path $destination 'website') -Mirror
                }
            }
            else {
                Sync-WithRobocopy -SourcePath $itemPath -DestinationPath $destination
            }
        }
        else {
            Sync-WithRobocopy -SourcePath $source -DestinationPath $target -FileName $item
        }
    }
}

Get-ChildItem -Path $source -Directory | Where-Object { $_.Name -match '^[0-9]' } | ForEach-Object {
    $destination = Join-Path $target $_.Name
    Sync-WithRobocopy -SourcePath $_.FullName -DestinationPath $destination -Mirror
}

Write-Host 'Content sync completed.'


# ── Compile config/collapse-rules.txt to quartz/static/collapse-rules.json ──
$rulesTxtPath = Join-Path $repoPath 'config\collapse-rules.txt'
$staticDir = Join-Path $repoPath 'quartz\static'
New-Item -ItemType Directory -Path $staticDir -Force | Out-Null
$rulesJsonTarget = Join-Path $staticDir 'collapse-rules.json'

if (Test-Path $rulesTxtPath) {
    $ruleLines = Get-Content -LiteralPath $rulesTxtPath -Encoding UTF8
    $sections = @()
    foreach ($line in $ruleLines) {
        $trimmed = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith('#')) {
            continue
        }
        $hasSub = $trimmed -match '->\s*subheadings'
        $title = ($trimmed -replace '->\s*subheadings', '').Trim()
        if ($title.Length -gt 0) {
            $sections += [PSCustomObject]@{
                title = $title
                subheadings = $hasSub
            }
        }
    }
    $rulesJson = [PSCustomObject]@{
        sections = $sections
    } | ConvertTo-Json -Depth 4
    Set-Content -LiteralPath $rulesJsonTarget -Value $rulesJson -Encoding UTF8
    Write-Host 'Generated quartz/static/collapse-rules.json from config/collapse-rules.txt.'
}

# ── Sync static website assets to quartz/static/website ────────
$websiteSource = Join-Path $source 'appendix\website'
$staticWebsiteTarget = Join-Path $repoPath 'quartz\static\website'

if (Test-Path $websiteSource) {
    Sync-WithRobocopy -SourcePath $websiteSource -DestinationPath $staticWebsiteTarget -Mirror
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

# ── Inject website guide navigation into content/index.md ────────
# The vault's index.md has no guide section; it is owned by this script.
# index.md is copied with /XO, so an older injected section can survive a sync:
# always replace an existing section with the current text instead of skipping.
$contentIndexPath = Join-Path $target 'index.md'
if (Test-Path $contentIndexPath) {
    $indexContent = Get-Content -Path $contentIndexPath -Raw -Encoding UTF8
    $guideSection = @"
## 🧭 功能教學與新手指南

> 第一次來？點頁面最上方的「開始互動導覽」，或在任何一頁按 ``?`` 打開說明中心。

- [[教學/快速入門|🚀 快速入門（核心功能、延伸探索與常見問題）]]
- [[教學/如何查一個主題|🔍 如何查一個主題（搜尋、分類資料夾、按書卷累積、反向連結）]]
- [[教學/如何跨書卷找相關條目|🔗 如何跨書卷找相關條目（互文與關係圖譜）]]
- [[教學/熱鍵與功能速查|⌨️ 熱鍵與功能速查（快捷鍵及畫面元件對照）]]
- [[教學/註釋來源怎麼讀|📚 註釋來源怎麼讀（CT / GT / KC / BH / STEP 深度對照）]]

---
"@
    $guideSection = ($guideSection -replace "`r?`n", "`r`n") + "`r`n"
    $evaluator = [System.Text.RegularExpressions.MatchEvaluator] { param($m) $guideSection }
    $sectionPattern = '(?ms)^## 🧭 功能教學與新手指南\r?\n.*?^---[ \t]*\r?\n'

    if ($indexContent -match $sectionPattern) {
        $updated = [regex]::Replace($indexContent, $sectionPattern, $evaluator)
    }
    elseif ($indexContent -match '(?m)^## ✍️ 作者的話') {
        $updated = [regex]::Replace($indexContent, '(?m)^## ✍️ 作者的話', [System.Text.RegularExpressions.MatchEvaluator] { param($m) $guideSection + "`r`n## ✍️ 作者的話" })
    }
    else {
        $updated = $indexContent + "`r`n" + $guideSection
    }

    if ($updated -ne $indexContent) {
        Set-Content -Path $contentIndexPath -Value $updated -Encoding UTF8 -NoNewline
        Write-Host 'Website guide navigation updated in content/index.md.'
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

        Write-Host 'Pulling latest remote changes...'
        git pull --rebase origin main
        if ($LASTEXITCODE -ne 0) {
            throw "git pull --rebase failed (exit code $LASTEXITCODE)"
        }

        git push origin main
        if ($LASTEXITCODE -ne 0) {
            throw "git push failed (exit code $LASTEXITCODE)"
        }
        Write-Host 'Pushed to remote.'
    }
    else {
        git pull origin main
        Write-Host 'No changes to commit. Repository is up to date.'
    }
}
finally {
    Pop-Location
}

exit 0

