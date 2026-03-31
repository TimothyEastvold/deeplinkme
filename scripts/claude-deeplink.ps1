param([string]$Uri)

# Parse the claude-cli:// deep link URL and launch Claude Code in WezTerm
# Registry handler passes the full URI as the first argument
#
# URL formats:
#   Windows:  claude-cli://open?q=prompt&cwd=C%3A%5Cpath
#   WSL:      claude-cli://open?q=prompt&distro=bala-dev&path=/home/dev/repos/bala

$logFile = "$env:USERPROFILE\scripts\claude-deeplink.log"
$defaultCwd = "C:\Users\TimothyEastvold\Notes"
$weztermExe = "C:\Program Files\WezTerm\wezterm-gui.exe"

try {
    "$(Get-Date) - URI: $Uri" | Out-File $logFile -Append

    # Parse URL parameters
    $cwd = ""
    $distro = ""
    $linuxPath = ""
    $prompt = ""

    if ($Uri -match '\?(.+)$') {
        $queryString = $Matches[1]
        $params = @{}
        foreach ($pair in $queryString -split '&') {
            $kv = $pair -split '=', 2
            if ($kv.Length -eq 2) {
                $params[$kv[0]] = [System.Uri]::UnescapeDataString($kv[1])
            }
        }

        if ($params.ContainsKey('cwd') -and $params['cwd']) {
            $cwd = $params['cwd']
        }
        if ($params.ContainsKey('distro') -and $params['distro']) {
            $distro = $params['distro']
        }
        if ($params.ContainsKey('path') -and $params['path']) {
            $linuxPath = $params['path']
        }
        if ($params.ContainsKey('q') -and $params['q']) {
            $prompt = $params['q']
        }
        $contentBase64 = ""
        if ($params.ContainsKey('content') -and $params['content']) {
            $contentBase64 = $params['content']
        }
    }

    "$(Get-Date) - cwd: $cwd, distro: $distro, path: $linuxPath, prompt: $prompt" | Out-File $logFile -Append

    if ($distro) {
        # WSL mode: launch wsl shell inside WezTerm, cd to path, run claude

        # If content was passed, write it to /tmp/cc-context.md in the distro
        if ($contentBase64) {
            $decodedBytes = [System.Convert]::FromBase64String($contentBase64)
            $decodedText = [System.Text.Encoding]::UTF8.GetString($decodedBytes)
            # Write via wsl stdin to avoid shell escaping issues with arbitrary content
            $decodedText | wsl.exe -d $distro -- bash -c "cat > /tmp/cc-context.md"
            "$(Get-Date) - Wrote context file to /tmp/cc-context.md in $distro" | Out-File $logFile -Append
        }

        $escapedPrompt = $prompt -replace "'", "'\''"
        $claudeCmd = "claude --dangerously-skip-permissions"
        if ($prompt) {
            $claudeCmd += " '$escapedPrompt'"
        }

        $bashCmd = "cd '$linuxPath' && $claudeCmd"

        $weztermArgs = @(
            "start",
            "--always-new-process",
            "--", "wsl.exe", "-d", $distro, "--", "bash", "-lc", $bashCmd
        )
    } else {
        # Windows mode: launch claude directly with --cwd
        if (-not $cwd) { $cwd = $defaultCwd }
        $claudeExe = "C:\Users\TimothyEastvold\AppData\Local\Microsoft\WinGet\Packages\Anthropic.ClaudeCode_Microsoft.Winget.Source_8wekyb3d8bbwe\claude.exe"

        $weztermArgs = @(
            "start",
            "--always-new-process",
            "--cwd", $cwd,
            "--", $claudeExe,
            "--dangerously-skip-permissions"
        )
        if ($prompt) {
            $weztermArgs += $prompt
        }
    }

    "$(Get-Date) - Launching: $weztermExe $($weztermArgs -join ' ')" | Out-File $logFile -Append

    & $weztermExe @weztermArgs 2>&1 | Out-File $logFile -Append

    "$(Get-Date) - Exit code: $LASTEXITCODE" | Out-File $logFile -Append
} catch {
    "$(Get-Date) - ERROR: $_" | Out-File $logFile -Append
}
