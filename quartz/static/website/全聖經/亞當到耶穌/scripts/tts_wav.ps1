param(
  [Parameter(Mandatory = $true)]
  [string]$InputFile,
  [Parameter(Mandatory = $true)]
  [string]$OutDir,
  [string]$Voice = 'Microsoft Hanhan Desktop'
)
$ErrorActionPreference = 'Stop'
$consoleUtf8 = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $consoleUtf8
[Console]::InputEncoding = $consoleUtf8
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $availableVoices = @($synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name })
  if ($availableVoices -notcontains $Voice) {
    [Console]::Error.WriteLine("Voice not found: $Voice")
    [Console]::Error.WriteLine('Available voices:')
    foreach ($availableVoice in $availableVoices) {
      [Console]::Error.WriteLine("  $availableVoice")
    }
    exit 2
  }
  $synth.SelectVoice($Voice)
  $sentences = [IO.File]::ReadAllLines($InputFile, [Text.Encoding]::UTF8)
  New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
  $listLines = New-Object 'System.Collections.Generic.List[string]'
  for ($i = 0; $i -lt $sentences.Count; $i++) {
    $fileName = 'w{0:D4}.wav' -f $i
    $synth.SetOutputToWaveFile((Join-Path $OutDir $fileName))
    $synth.Speak($sentences[$i])
    $synth.SetOutputToNull()
    $listLines.Add(('{0}{1}{2}' -f $fileName, [char]9, $sentences[$i]))
  }
  $utf8WithoutBom = New-Object Text.UTF8Encoding($false)
  [IO.File]::WriteAllLines((Join-Path $OutDir 'list.txt'), $listLines.ToArray(), $utf8WithoutBom)
}
finally {
  $synth.Dispose()
}
