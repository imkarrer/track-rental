# Development Data Seeding Helper Script (PowerShell)
# 
# This script helps you seed your local development environment with test data.
# It provides various options for different scenarios.

param(
    [Parameter(Position=0)]
    [string]$Command = "seed"
)

$ErrorActionPreference = "Stop"

# Colors
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }
function Write-Info { Write-Host $args -ForegroundColor Cyan }

# Function to display help
function Show-Help {
    Write-Success "Development Data Seeding Helper"
    Write-Host ""
    Write-Host "Usage: .\seed.ps1 [command]"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  seed          Seed development data (default)"
    Write-Host "  reset         Reset database and seed fresh data"
    Write-Host "  init          Initialize MinIO bucket"
    Write-Host "  full          Full setup: init MinIO + reset DB + seed data"
    Write-Host "  status        Check database and MinIO status"
    Write-Host "  clean         Clean all data (database + MinIO)"
    Write-Host "  help          Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\seed.ps1              # Seed data (skip existing)"
    Write-Host "  .\seed.ps1 reset        # Reset DB and seed fresh data"
    Write-Host "  .\seed.ps1 full         # Full clean setup"
    Write-Host ""
}

# Function to check if services are running
function Test-Services {
    Write-Info "🔍 Checking services..."
    
    $allOk = $true
    
    # Check PostgreSQL
    try {
        $pg = Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue
        if ($pg.TcpTestSucceeded) {
            Write-Success "   ✅ PostgreSQL is running"
        } else {
            Write-Error "   ❌ PostgreSQL is not running"
            $allOk = $false
        }
    } catch {
        Write-Error "   ❌ PostgreSQL is not running"
        $allOk = $false
    }
    
    # Check MinIO
    try {
        $minio = Test-NetConnection -ComputerName localhost -Port 9000 -WarningAction SilentlyContinue
        if ($minio.TcpTestSucceeded) {
            Write-Success "   ✅ MinIO is running"
        } else {
            Write-Error "   ❌ MinIO is not running"
            $allOk = $false
        }
    } catch {
        Write-Error "   ❌ MinIO is not running"
        $allOk = $false
    }
    
    Write-Host ""
    
    if (-not $allOk) {
        Write-Warning "⚠️  Some services are not running"
        Write-Warning "   Run: .\dev-start.ps1 or .\dev-start.sh"
        Write-Host ""
        return $false
    }
    
    return $true
}

# Function to initialize MinIO
function Initialize-MinIO {
    Write-Success "🗄️  Initializing MinIO bucket..."
    npm run storage:init
    Write-Host ""
}

# Function to seed data
function Invoke-SeedData {
    Write-Success "🌱 Seeding development data..."
    npm run seed:dev
    Write-Host ""
}

# Function to reset database
function Reset-Database {
    Write-Warning "⚠️  This will DELETE ALL DATA in the database!"
    $confirm = Read-Host "Are you sure? (yes/no)"
    
    if ($confirm -ne "yes") {
        Write-Info "Cancelled."
        exit 0
    }
    
    Write-Host ""
    Write-Warning "🔄 Resetting database..."
    npx prisma db push --force-reset --skip-generate
    Write-Success "   ✅ Database reset complete"
    Write-Host ""
}

# Function to clean all data
function Remove-AllData {
    Write-Error "⚠️  WARNING: This will DELETE ALL DATA!"
    Write-Error "   - Database will be wiped"
    Write-Error "   - MinIO volumes will be removed"
    Write-Host ""
    $confirm = Read-Host "Are you sure? Type 'DELETE' to confirm"
    
    if ($confirm -ne "DELETE") {
        Write-Info "Cancelled."
        exit 0
    }
    
    Write-Host ""
    Write-Warning "🧹 Cleaning all data..."
    
    # Stop services
    Write-Warning "   Stopping services..."
    docker-compose down -v
    
    Write-Success "   ✅ All data cleaned"
    Write-Host ""
    Write-Info "💡 Restart services with: .\dev-start.ps1 or .\dev-start.sh"
    Write-Host ""
}

# Function to show status
function Show-Status {
    Test-Services
    
    Write-Info "🗄️  Checking database..."
    try {
        # Try to get counts from database
        $userCount = docker exec track-rental-postgres-1 psql -U postgres -d rc_track_rental -t -c "SELECT COUNT(*) FROM users;" 2>$null
        $trackCount = docker exec track-rental-postgres-1 psql -U postgres -d rc_track_rental -t -c "SELECT COUNT(*) FROM tracks;" 2>$null
        $carCount = docker exec track-rental-postgres-1 psql -U postgres -d rc_track_rental -t -c "SELECT COUNT(*) FROM cars;" 2>$null
        
        Write-Success "   ✅ Database connection OK"
        Write-Info "   📊 Current data:"
        Write-Host "      Users:  $($userCount.Trim())"
        Write-Host "      Tracks: $($trackCount.Trim())"
        Write-Host "      Cars:   $($carCount.Trim())"
    } catch {
        Write-Warning "   ⚠️  Could not query database"
    }
    Write-Host ""
}

# Main script
try {
    switch ($Command.ToLower()) {
        "seed" {
            Write-Success "═══════════════════════════════════════════"
            Write-Success "🌱 Development Data Seeding"
            Write-Success "═══════════════════════════════════════════"
            Write-Host ""
            
            if (-not (Test-Services)) {
                exit 1
            }
            
            Invoke-SeedData
            
            Write-Success "═══════════════════════════════════════════"
            Write-Success "✅ Seeding Complete!"
            Write-Success "═══════════════════════════════════════════"
            Write-Host ""
            Write-Info "🔗 Quick Links:"
            Write-Host "   App:           http://localhost:3000"
            Write-Host "   Prisma Studio: http://localhost:5555 (or run: npm run db:studio)"
            Write-Host "   MinIO Console: http://localhost:9001"
            Write-Host ""
        }
        
        "reset" {
            Write-Success "═══════════════════════════════════════════"
            Write-Success "🔄 Reset Database & Seed Fresh Data"
            Write-Success "═══════════════════════════════════════════"
            Write-Host ""
            
            if (-not (Test-Services)) {
                exit 1
            }
            
            Reset-Database
            Invoke-SeedData
            
            Write-Success "═══════════════════════════════════════════"
            Write-Success "✅ Reset & Seeding Complete!"
            Write-Success "═══════════════════════════════════════════"
            Write-Host ""
        }
        
        "init" {
            Write-Success "═══════════════════════════════════════════"
            Write-Success "🗄️  Initialize MinIO"
            Write-Success "═══════════════════════════════════════════"
            Write-Host ""
            
            if (-not (Test-Services)) {
                exit 1
            }
            
            Initialize-MinIO
            
            Write-Success "✅ MinIO initialized!"
            Write-Host ""
        }
        
        "full" {
            Write-Success "═══════════════════════════════════════════"
            Write-Success "🚀 Full Setup (MinIO + DB + Seed)"
            Write-Success "═══════════════════════════════════════════"
            Write-Host ""
            
            if (-not (Test-Services)) {
                exit 1
            }
            
            Initialize-MinIO
            Reset-Database
            Invoke-SeedData
            
            Write-Success "═══════════════════════════════════════════"
            Write-Success "✅ Full Setup Complete!"
            Write-Success "═══════════════════════════════════════════"
            Write-Host ""
            Write-Info "🔗 Quick Links:"
            Write-Host "   App:           http://localhost:3000"
            Write-Host "   Prisma Studio: http://localhost:5555"
            Write-Host "   MinIO Console: http://localhost:9001"
            Write-Host ""
            Write-Info "🔐 Test Credentials:"
            Write-Host "   Admin:  admin@example.com / admin123"
            Write-Host "   User:   john.doe@example.com / password123"
            Write-Host ""
        }
        
        "status" {
            Show-Status
        }
        
        "clean" {
            Remove-AllData
        }
        
        { $_ -in "help", "--help", "-h" } {
            Show-Help
        }
        
        default {
            Write-Error "❌ Unknown command: $Command"
            Write-Host ""
            Show-Help
            exit 1
        }
    }
} catch {
    Write-Error "❌ Error: $_"
    exit 1
}
