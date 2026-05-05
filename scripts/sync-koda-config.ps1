# Koda Configuration Sync Script
# Run: .\scripts\sync-koda-config.ps1

$globalConfigPath = "$env:USERPROFILE\.koda\config.yaml"
$localConfigPath = ".koda\config.yaml"
$globalSkillsPath = "$env:USERPROFILE\.koda\skills"
$localSkillsPath = ".koda\skills"

Write-Host "=== Koda Configuration Sync ===" -ForegroundColor Cyan

# Check global config
if (Test-Path $globalConfigPath) {
    Write-Host "[OK] Global config found: $globalConfigPath" -ForegroundColor Green
    
    # Ask about sync
    $sync = Read-Host "Sync with local config? (Y/N)"
    
    if ($sync -eq 'Y' -or $sync -eq 'y') {
        Copy-Item $globalConfigPath $localConfigPath -Force
        Write-Host "[OK] Local config updated" -ForegroundColor Green
    }
} else {
    Write-Host "[WARN] Global config not found" -ForegroundColor Yellow
}

# Check global skills
if (Test-Path $globalSkillsPath) {
    Write-Host "[OK] Global skills found: $globalSkillsPath" -ForegroundColor Green
    
    $skills = Get-ChildItem $globalSkillsPath -Filter "*.md"
    foreach ($skill in $skills) {
        $localSkillPath = Join-Path $localSkillsPath $skill.Name
        
        if (-not (Test-Path $localSkillPath)) {
            Copy-Item $skill.FullName $localSkillPath
            Write-Host "  + Copied: $($skill.Name)" -ForegroundColor Gray
        } else {
            Write-Host "  [OK] Exists: $($skill.Name)" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "[WARN] Global skills not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Sync Complete ===" -ForegroundColor Cyan
Write-Host "Local config: $localConfigPath" -ForegroundColor White
Write-Host "Local skills: $localSkillsPath" -ForegroundColor White
