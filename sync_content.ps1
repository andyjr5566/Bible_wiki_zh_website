# -NoPush: only sync into the local working tree; do not commit or push.
# Use it to review what would be published before pushing for real.
param([switch]$NoPush)

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
        [string[]]$ExcludeDir = @(),

        # Extra file names / paths to skip (wildcards allowed).
        [string[]]$ExcludeFile = @()
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
            $robocopyArgs += $ExcludeFile
        }
        else {
            $robocopyArgs += @('/E', '/XD', '.tmp')
            $robocopyArgs += $ExcludeDir
            $robocopyArgs += '/XO'
            if ($ExcludeFile.Count -gt 0) {
                $robocopyArgs += '/XF'
                $robocopyArgs += $ExcludeFile
            }
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

# robocopy never purges what /XD and /XF exclude, so files that an older version of
# this script already copied must be removed explicitly. Idempotent: safe to re-run.
function Remove-IfExists {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (Test-Path -LiteralPath $Path) {
        Remove-Item -LiteralPath $Path -Recurse -Force
    }
}

# Give a synced .md file a `title:` in its frontmatter so the site shows a Chinese name
# (explorer, breadcrumbs, page title) instead of the file / folder name.
# Idempotent: a file that already has a `title:` is left untouched, so a title written in the
# vault always wins. -CreateIfMissing creates a title-only file (used for folders that have no
# index.md; the folder-page plugin still lists the folder's contents under it).
# The file's last-write time is restored, because robocopy /XO skips a destination that is
# newer than its source and would otherwise stop later vault edits from being copied.
function Set-FrontmatterTitle {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Title,
        [switch]$CreateIfMissing
    )

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)

    if (-not (Test-Path -LiteralPath $Path)) {
        if (-not $CreateIfMissing) { return $false }
        $dir = Split-Path -Parent $Path
        if (-not (Test-Path -LiteralPath $dir)) { return $false }
        [System.IO.File]::WriteAllText($Path, "---`ntitle: $Title`n---`n", $utf8NoBom)
        return $true
    }

    $file = Get-Item -LiteralPath $Path
    $lastWrite = $file.LastWriteTime
    $text = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
    $text = $text.TrimStart([char]0xFEFF)
    $nl = if ($text.Contains("`r`n")) { "`r`n" } else { "`n" }

    $fmPattern = '(?s)\A---[ \t]*\r?\n(.*?)(?:\r?\n)---[ \t]*(?:\r?\n|\z)'
    $fm = [regex]::Match($text, $fmPattern)
    if ($fm.Success) {
        if ($fm.Groups[1].Value -match '(?m)^title[ \t]*:') { return $false }
        $headerEnd = $text.IndexOf("`n") + 1
        $updated = $text.Substring(0, $headerEnd) + "title: $Title$nl" + $text.Substring($headerEnd)
    }
    else {
        $updated = "---${nl}title: $Title${nl}---$nl" + $text
    }

    [System.IO.File]::WriteAllText($Path, $updated, $utf8NoBom)
    $file.LastWriteTime = $lastWrite
    return $true
}

# Chinese display names for the vault's English-named top-level items (decision U-7).
# Nothing is hidden: the items stay in the explorer, only their names change.
function Add-WebsiteTitles {
    param([Parameter(Mandatory = $true)][string]$ContentRoot)

    $titled = @(
        @{ Path = 'INSTALL_COMPUTER.md'; Title = 'Obsidian 電腦版安裝說明'; Create = $false },
        @{ Path = 'INSTALL_MOBILE.md';   Title = 'Obsidian 手機版安裝說明'; Create = $false },
        @{ Path = 'README.md';           Title = '本站簡介';       Create = $false },
        @{ Path = 'appendix\index.md';   Title = '附錄';           Create = $false },
        @{ Path = 'link_folder\index.md'; Title = '知識節點';      Create = $true }
    )
    foreach ($entry in $titled) {
        $filePath = Join-Path $ContentRoot $entry.Path
        $changed = Set-FrontmatterTitle -Path $filePath -Title $entry.Title -CreateIfMissing:$entry.Create
        if ($changed) { Write-Host "Added title '$($entry.Title)' to $($entry.Path)." }
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
                # Publish only what readers see: pages, map notes and images, plus the
                # Quartz opening page. Kept out of the website repo on purpose:
                #   genealogy/        YAML data + generator scripts (pages are generated into appendix/*.md)
                #   video/            demo video (README links it through GitHub raw)
                #   fhl_maps/texts/   raw map texts, not referenced by any page
                #   fhl_maps build files (build.py and *.json indexes)
                #   website/          interactive apps: handled below, never under content/
                $fhl = Join-Path $itemPath 'fhl_maps'
                $skipDirs = @(
                    (Join-Path $itemPath 'website'),
                    (Join-Path $itemPath 'genealogy'),
                    (Join-Path $itemPath 'video'),
                    (Join-Path $fhl 'texts')
                )
                $skipFiles = @('build.py', 'metadata.json', 'image_optimization.json', 'scripture_map_index.json') |
                    ForEach-Object { Join-Path $fhl $_ }
                Sync-WithRobocopy -SourcePath $itemPath -DestinationPath $destination -Mirror -ExcludeDir $skipDirs -ExcludeFile $skipFiles

                foreach ($skip in ($skipDirs + $skipFiles)) {
                    Remove-IfExists -Path (Join-Path $destination $skip.Substring($itemPath.Length).TrimStart('\', '/'))
                }

                # content/appendix/website keeps only the index page and the opening page
                # that quartz/build.ts copies out. The apps themselves live in
                # quartz/static/website (synced below); under content/ Quartz would turn
                # every .md into a page and publish every source file as an asset.
                $websiteSrc = Join-Path $itemPath 'website'
                $websiteDst = Join-Path $destination 'website'
                $indexSrc = Join-Path $websiteSrc 'index.md'
                $openingSrc = Join-Path $websiteSrc '.opening'
                if (-not (Test-Path -LiteralPath $indexSrc) -or -not (Test-Path -LiteralPath $openingSrc)) {
                    throw "appendix/website must contain index.md and .opening: $websiteSrc"
                }
                New-Item -ItemType Directory -Path $websiteDst -Force | Out-Null
                Copy-Item -LiteralPath $indexSrc -Destination $websiteDst -Force
                Sync-WithRobocopy -SourcePath $openingSrc -DestinationPath (Join-Path $websiteDst '.opening') -Mirror
                Get-ChildItem -LiteralPath $websiteDst -Force |
                    Where-Object { $_.Name -notin @('index.md', '.opening') } |
                    Remove-Item -Recurse -Force

                Get-ChildItem -LiteralPath $destination -Recurse -Directory -Force -Filter '__pycache__' -ErrorAction SilentlyContinue |
                    Remove-Item -Recurse -Force
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
    # quartz/static/website is the CI build workspace for the interactive apps
    # (npm ci + vite build, then only each app's dist/ is copied into public/).
    # It needs the Vite project, never the working material around it:
    #   tools/ lab/ review/ .vite/   dev scripts, scene lab, screenshots, cache
    #   GOAL*/HANDOFF/SPEC/README/位置考證 .md   notes for whoever builds the app
    #   .opening/ (served from content/) and the top-level index.md (served from content/)
    $devDirNames = @('tools', 'lab', 'review', '.vite')
    $devFilePatterns = @('GOAL*.md', 'HANDOFF.md', 'SPEC.md', 'README.md', '位置考證.md')
    $skipDirs = @((Join-Path $websiteSource '.opening'))
    $skipFiles = @((Join-Path $websiteSource 'index.md'))
    $appDirs = Get-ChildItem -LiteralPath $websiteSource -Directory |
        Where-Object { $_.Name -notin @('.opening', '__pycache__') } |
        ForEach-Object { Get-ChildItem -LiteralPath $_.FullName -Directory }
    foreach ($app in $appDirs) {
        foreach ($name in $devDirNames) { $skipDirs += (Join-Path $app.FullName $name) }
        foreach ($pattern in $devFilePatterns) {
            # robocopy rejects wildcards inside a path, so expand to the real file names.
            Get-ChildItem -LiteralPath $app.FullName -File -Force |
                Where-Object { $_.Name -like $pattern } |
                ForEach-Object { $skipFiles += $_.FullName }
        }
    }
    Sync-WithRobocopy -SourcePath $websiteSource -DestinationPath $staticWebsiteTarget -Mirror -ExcludeDir $skipDirs -ExcludeFile $skipFiles

    Remove-IfExists -Path (Join-Path $staticWebsiteTarget '.opening')
    Remove-IfExists -Path (Join-Path $staticWebsiteTarget 'index.md')
    Remove-IfExists -Path (Join-Path $staticWebsiteTarget '__pycache__')
    $staleApps = Get-ChildItem -LiteralPath $staticWebsiteTarget -Directory |
        Where-Object { $_.Name -notin @('.opening', '__pycache__') } |
        ForEach-Object { Get-ChildItem -LiteralPath $_.FullName -Directory }
    foreach ($app in $staleApps) {
        foreach ($name in $devDirNames) { Remove-IfExists -Path (Join-Path $app.FullName $name) }
        foreach ($pattern in $devFilePatterns) {
            Get-ChildItem -LiteralPath $app.FullName -File -Force |
                Where-Object { $_.Name -like $pattern } |
                Remove-Item -Force
        }
    }
    Write-Host 'Static website assets synced to quartz/static/website.'
}

# ── Auto-transform appendix/website links in content .md files ──
Get-ChildItem -Path $target -Recurse -Filter *.md | ForEach-Object {
    $filePath = $_.FullName
    $fileContent = Get-Content -Path $filePath -Raw -Encoding UTF8
    if ($fileContent -match 'appendix/website/') {
        $relDir = [System.IO.Path]::GetDirectoryName($filePath).Substring($target.Length).TrimStart('\', '/')
        $depth = if ($relDir.Length -gt 0) { ($relDir -split '[\\/]').Count } else { 0 }
        # Quartz 發佈時會自己依頁面深度重算相對路徑，只認開頭的一個 "../"；
        # 依層數累加 ".." 會在深度 2 以上（例如 appendix/website/index.md）多跳出站台根目錄而 404。
        $prefix = if ($depth -gt 0) { '..' } else { '.' }

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

# ── Chinese titles for README / INSTALL_* / appendix / link_folder ────────
Add-WebsiteTitles -ContentRoot $target

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
- [[教學/個人筆記使用說明|📝 個人筆記（寫研經筆記、用 Google 帳號跨裝置同步）]]

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

if ($NoPush) {
    Write-Host '-NoPush: local sync finished; nothing was committed or pushed.'
    exit 0
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

