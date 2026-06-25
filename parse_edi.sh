#!/bin/bash

# EDI File Parser Script
# Reads EDI file and parses each line by * delimiter
# Prints segment name and all fields including empty ones

if [ $# -eq 0 ]; then
    echo "Usage: $0 <edi_file> [--xlsx]"
    echo "Example: $0 /Downloads/X291-ambulance.edi"
    echo "         $0 /Downloads/X291-ambulance.edi --xlsx  (also creates XLSX file)"
    exit 1
fi

EDI_FILE="$1"
CREATE_XLSX=false

# Check for --xlsx flag
if [ "$2" = "--xlsx" ] || [ "$3" = "--xlsx" ]; then
    CREATE_XLSX=true
fi

if [ ! -f "$EDI_FILE" ]; then
    echo "Error: File '$EDI_FILE' not found!"
    exit 1
fi

line_number=0

while IFS= read -r line || [ -n "$line" ]; do
    line_number=$((line_number + 1))
    
    # Skip empty lines
    if [ -z "$line" ] || [ -z "${line// /}" ]; then
        continue
    fi
    
    # Remove trailing whitespace and newline
    line=$(echo "$line" | tr -d '\r\n' | sed 's/[[:space:]]*$//')
    
    # Parse line by splitting on * delimiter using awk
    # awk properly handles consecutive delimiters and preserves empty fields
    fields=()
    
    # Use awk to split by * (escaped) and preserve empty fields
    # Note: In awk, * needs to be escaped or we can use a character class
    while IFS= read -r field; do
        # Trim whitespace - if only whitespace, treat as empty
        field_trimmed=$(echo "$field" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        fields+=("$field_trimmed")
    done < <(echo "$line" | awk -F'\\*' '{for(i=1; i<=NF; i++) print $i}')
    
    # Get segment name (first element)
    segment="${fields[0]}"
    
    # Print line number and segment
    echo "=========================================="
    echo "Line $line_number: Segment = $segment"
    echo "------------------------------------------"
    
    # Print all fields with index
    field_count=${#fields[@]}
    for i in "${!fields[@]}"; do
        field_value="${fields[$i]}"
        # Show empty fields as "(empty)"
        if [ -z "$field_value" ]; then
            echo "  Field[$i] = (empty)"
        else
            echo "  Field[$i] = '$field_value'"
        fi
    done
    
    echo "Total fields: $field_count"
    echo ""
    
done < "$EDI_FILE"

echo "=========================================="
echo "Parsing complete!"
