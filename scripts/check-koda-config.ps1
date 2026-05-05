# Koda Configuration Check Script
# Run: .\scripts\check-koda-config.ps1

Write-Host "=== Koda Configuration Check ===" -ForegroundColor Cyan
Write-Host ""

# Check local config
Write-Host "Local Configuration:" -ForegroundColor Yellow
if (Test-Path ".koda\config.yaml") {
    Write-Host "  [OK] .koda/config.yaml exists" -ForegroundColor Green
    
    $content = Get-Content ".koda\config.yaml" -Raw
    if ($content -match 'mcpServers:') {
        Write-Host "  [OK] Contains MCP servers" -ForegroundColor Green
    }
    if ($content -match 'skills:') {
        Write-Host "  [OK] Contains skills settings" -ForegroundColor Green
    }
} else {
    Write-Host "  [FAIL] .koda/config.yaml not found" -ForegroundColor Red
}

Write-Host ""

# Check local skills
Write-Host "Local Skills:" -ForegroundColor Yellow
if (Test-Path ".koda\skills") {
    $skills = Get-ChildItem ".koda\skills" -Filter "*.md"
    if ($skills.Count -gt 0) {
        Write-Host "  [OK] Found skills: $($skills.Count)" -ForegroundColor Green
        foreach ($skill in $skills) {
            Write-Host "    - $($skill.Name)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  [WARN] Folder is empty" -ForegroundColor Yellow
    }
} else {
    Write-Host "  [FAIL] .koda/skills folder not found" -ForegroundColor Red
}

Write-Host ""

# Check global config
Write-Host "Global Configuration:" -ForegroundColor Yellow
$globalConfig = "$env:USERPROFILE\.koda\config.yaml"
if (Test-Path $globalConfig) {
    Write-Host "  [OK] $globalConfig exists" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Global config not found" -ForegroundColor Yellow
    Write-Host "    Create manually or use local only" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Check Complete ===" -ForegroundColor Cyan
