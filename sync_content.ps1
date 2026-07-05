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
    Copy-Item -Path $_.FullName -Destination (Join-Path $target $_.Name) -Recurse -Force
}

Write-Host 'Content sync completed.'
