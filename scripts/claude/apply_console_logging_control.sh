#!/bin/bash
# Apply console logging control system to TypeScript files

if [ $# -eq 0 ]; then
    echo "Usage: $0 <file.ts>"
    exit 1
fi

FILE="$1"

if [ ! -f "$FILE" ]; then
    echo "Error: File $FILE does not exist"
    exit 1
fi

# Check if file already has ENABLE_CONSOLE_LOG
if grep -q "ENABLE_CONSOLE_LOG" "$FILE"; then
    echo "File $FILE already has console logging control"
    exit 0
fi

# Check if file has console.log calls
if ! grep -q "console\.log" "$FILE"; then
    echo "File $FILE has no console.log calls to convert"
    exit 0
fi

# Find class definition
CLASS_LINE=$(grep -n "export class\|class.*{" "$FILE" | head -1 | cut -d: -f1)

if [ -z "$CLASS_LINE" ]; then
    echo "Error: No class definition found in $FILE"
    exit 1
fi

echo "Processing $FILE with class at line $CLASS_LINE"

# Create temporary file
TMPFILE=$(mktemp)

# Add ENABLE_CONSOLE_LOG after the header comments
awk '
    /^\/\*\* @format \*\/$/ { print; getline; print; getline; print; print ""; print "const ENABLE_CONSOLE_LOG: boolean = false;"; next }
    { print }
' "$FILE" > "$TMPFILE"

mv "$TMPFILE" "$FILE"

# Add logging methods after class definition
TMPFILE2=$(mktemp)
awk -v class_line="$CLASS_LINE" '
    NR == class_line && /export class.*{$/ {
        print;
        print "  // Console logging control";
        print "  private static logConsoleMessageStatic(...args: any[]): void {";
        print "    if (ENABLE_CONSOLE_LOG) {";
        print "      console.log(...args);";
        print "    }";
        print "  }";
        print "";
        print "  private logConsoleMessage(...args: any[]): void {";
        print "    if (ENABLE_CONSOLE_LOG) {";
        print "      console.log(...args);";
        print "    }";
        print "  }";
        next
    }
    { print }
' "$FILE" > "$TMPFILE2"

mv "$TMPFILE2" "$FILE"

# Replace console.log with this.logConsoleMessage
sed -i 's/console\.log/this.logConsoleMessage/g' "$FILE"

echo "Successfully applied console logging control to $FILE"