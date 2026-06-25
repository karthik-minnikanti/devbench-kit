# EDI to XLSX Converter (PowerShell)
# Reads EDI file, parses each line by * delimiter, and creates an XLSX file
# with segment names as headers and all field values, preserving empty fields.

param(
    [Parameter(Mandatory=$true)]
    [string]$EdiFile,
    
    [Parameter(Mandatory=$false)]
    [string]$OutputFile
)

# Check if ImportExcel module is installed
if (-not (Get-Module -ListAvailable -Name ImportExcel)) {
    Write-Host "ImportExcel module not found. Installing..." -ForegroundColor Yellow
    try {
        Install-Module -Name ImportExcel -Scope CurrentUser -Force -AllowClobber
        Import-Module ImportExcel
    } catch {
        Write-Host "Error: Failed to install ImportExcel module. Please install manually:" -ForegroundColor Red
        Write-Host "  Install-Module -Name ImportExcel -Scope CurrentUser" -ForegroundColor Yellow
        exit 1
    }
} else {
    Import-Module ImportExcel
}

# Check if input file exists
if (-not (Test-Path $EdiFile)) {
    Write-Host "Error: File '$EdiFile' not found!" -ForegroundColor Red
    exit 1
}

# Generate output filename if not provided
if ([string]::IsNullOrEmpty($OutputFile)) {
    if ($EdiFile -match '\.edi$') {
        $OutputFile = $EdiFile -replace '\.edi$', '.xlsx'
    } else {
        $OutputFile = $EdiFile + '.xlsx'
    }
}

Write-Host "Parsing EDI file: $EdiFile" -ForegroundColor Green
Write-Host "Output file: $OutputFile" -ForegroundColor Green

# Parse EDI file and collect data
$allData = @()
$maxFields = 0

Get-Content $EdiFile -Encoding UTF8 | ForEach-Object {
    $line = $_.TrimEnd()
    
    # Skip empty lines
    if ([string]::IsNullOrWhiteSpace($line)) {
        return
    }
    
    # Split by * delimiter
    $fields = $line -split '\*'
    
    # Trim whitespace from each field (whitespace-only fields become empty)
    $fields = $fields | ForEach-Object {
        $trimmed = $_.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed)) {
            return ""
        }
        return $trimmed
    }
    
    # Update max fields count
    if ($fields.Count -gt $maxFields) {
        $maxFields = $fields.Count
    }
    
    $allData += ,$fields
}

if ($allData.Count -eq 0) {
    Write-Host "Error: No data found in EDI file!" -ForegroundColor Red
    exit 1
}

Write-Host "Found $($allData.Count) lines with up to $maxFields fields" -ForegroundColor Cyan

# Prepare data for Excel - transpose structure
# Each line becomes a column, with segment name as header and fields below

# Find the maximum number of fields across all lines to determine row count
$maxRowCount = 0
foreach ($fields in $allData) {
    if ($fields.Count -gt $maxRowCount) {
        $maxRowCount = $fields.Count
    }
}

# Create header row with segment names (first field of each line)
# Column A = first line's segment, Column B = second line's segment, etc.
$headers = @()
foreach ($fields in $allData) {
    if ($fields.Count -gt 0) {
        $headers += $fields[0]  # Segment name
    } else {
        $headers += ""
    }
}

# Build Excel data - transpose: each line becomes a column
# Export-Excel will use property names as headers automatically

# Find maximum row count (number of fields in the longest line, minus 1 for segment name)
$maxRows = 0
foreach ($fields in $allData) {
    $fieldCount = $fields.Count - 1  # Exclude segment name
    if ($fieldCount -gt $maxRows) {
        $maxRows = $fieldCount
    }
}

# Build rows - each row will have one value from each column
# Export-Excel will use property names as headers automatically
# First, get all segment names in order to ensure all rows have the same properties
$segmentNames = @()
foreach ($fields in $allData) {
    $segmentName = if ($fields.Count -gt 0) { $fields[0] } else { "Column$($segmentNames.Count)" }
    $segmentNames += $segmentName
}

$excelData = @()

# Create rows: field values
for ($rowIndex = 0; $rowIndex -lt $maxRows; $rowIndex++) {
    $row = [ordered]@{}
    
    # For each column (maintain order from file)
    $colIndex = 0
    foreach ($fields in $allData) {
        $segmentName = $segmentNames[$colIndex]
        
        # Get the field value at this row index (field index = rowIndex + 1, since field[0] is segment name)
        $fieldIndex = $rowIndex + 1
        if ($fieldIndex -lt $fields.Count) {
            $row[$segmentName] = $fields[$fieldIndex]
        } else {
            $row[$segmentName] = ""
        }
        $colIndex++
    }
    
    $excelData += [PSCustomObject]$row
}

# Create Excel file
try {
    # Export to Excel - treat all columns as text to preserve leading zeros and exact values
    $params = @{
        Path = $OutputFile
        WorksheetName = "EDI Data"
        FreezeTopRow = $true
        BoldTopRow = $true
        TableStyle = "Medium2"
    }
    
    # Only add AutoSize if mono-libgdiplus is available (for Mac compatibility)
    try {
        $null = Get-Command mono -ErrorAction Stop
        $params['AutoSize'] = $true
    } catch {
        Write-Host "Note: AutoSize disabled (mono-libgdiplus not installed). Install with: brew install mono-libgdiplus" -ForegroundColor Yellow
    }
    
    # Export the data - PSCustomObject array should work correctly
    $excelData | Export-Excel @params
    
    Write-Host "`nSuccessfully created XLSX file: $OutputFile" -ForegroundColor Green
    Write-Host "Total columns (segments): $($allData.Count)" -ForegroundColor Cyan
    Write-Host "Total rows (max fields per segment): $($maxRowCount - 1)" -ForegroundColor Cyan
} catch {
    Write-Host "Error creating XLSX file: $_" -ForegroundColor Red
    exit 1
}

