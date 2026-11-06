$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$bundledPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
Write-Host '제주 한 권: http://localhost:8000 (종료: Ctrl+C)'
if (Test-Path -LiteralPath $bundledPython) {
    & $bundledPython -m http.server 8000 --bind 127.0.0.1
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    python -m http.server 8000 --bind 127.0.0.1
} else {
    Write-Error 'Python을 찾을 수 없습니다. Python 3 설치 후 다시 실행해 주세요.'
}
