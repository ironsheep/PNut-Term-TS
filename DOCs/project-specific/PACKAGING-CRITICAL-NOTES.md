# CRITICAL PACKAGING NOTES - DO NOT REPEAT THESE MISTAKES

## Application Type - CLI FIRST, THEN GUI
- **THIS IS A CLI APP THAT OPTIONALLY CREATES ELECTRON WINDOWS**
- Starts as command-line tool (can run without Electron in pure CLI mode)
- When Electron is available, creates BrowserWindow instances
- Pattern: CLI parsing → Electron app.whenReady() → Create MainWindow
- HTML content generated dynamically using data URLs (no index.html file)
- Main entry: `dist/pnut-term-ts.min.js` - a CLI tool that detects Electron

## Critical Launch Requirements

### 1. Electron Must Be Invoked Correctly
```bash
# CORRECT: Electron needs the app directory path
"$ELECTRON_EXEC" "$APP_DIR" [arguments]

# WRONG: Just running the JS file
node dist/pnut-term-ts.min.js
```

### 2. Package Structure MUST Be:
```
PNut-Term-TS.app/
  Contents/
    MacOS/
      Electron  # The Electron binary (downloaded by SETUP.command)
    Resources/
      app/
        package.json  # Must have "main": "dist/pnut-term-ts.min.js"
        dist/
          pnut-term-ts.min.js  # The actual app code
        node_modules/  # All dependencies
```

### 3. Common Packaging Failures

#### Issue: "App doesn't start"
**Causes:**
1. Missing Electron binary (check if SETUP.command was run)
2. Wrong launch command (not passing app directory to Electron)
3. Missing package.json or wrong "main" field
4. Code expects Electron APIs but running as Node.js

#### Issue: "Window doesn't appear"
**Causes:**
1. BrowserWindow creation failing silently
2. HTML content generation failing
3. Electron not in app mode (needs app directory, not just JS file)

## Testing Before Release

### Quick Validation Checklist:
```bash
# 1. Check package.json exists and has correct main
cat PNut-Term-TS.app/Contents/Resources/app/package.json

# 2. Check main JS file exists
ls -la PNut-Term-TS.app/Contents/Resources/app/dist/pnut-term-ts.min.js

# 3. Check Electron binary exists (after SETUP)
ls -la PNut-Term-TS.app/Contents/MacOS/Electron

# 4. Test launch command structure
"$ELECTRON_EXEC" "$APP_DIR" --version  # Should show Electron version
```

## The Correct Launch Sequence

1. SETUP.command downloads Electron binary to MacOS/Electron
2. TEST.command or LAUNCH.command runs: `Electron app_directory [args]`
3. Electron loads package.json from app_directory
4. Electron runs the "main" script (dist/pnut-term-ts.min.js)
5. Main script creates MainWindow instance
6. MainWindow creates BrowserWindow with dynamic HTML

## Common Mistakes We Keep Making

1. **Forgetting this is Electron, not pure Node.js**
   - Can't run with `node` command
   - Must use Electron binary

2. **Wrong launch arguments**
   - Electron needs app directory path, not JS file path
   - Arguments go AFTER app directory

3. **Testing in container**
   - Container can't run Electron GUI
   - Must test on actual macOS

4. **Assuming it's a web app**
   - No index.html file
   - HTML is generated in code
   - Not served by a web server

## Debugging Non-Starting Apps

```bash
# 1. Run with console output visible
"$ELECTRON_EXEC" "$APP_DIR" --verbose 2>&1 | tee debug.log

# 2. Check for missing dependencies
cd PNut-Term-TS.app/Contents/Resources/app
npm ls  # Should show all dependencies installed

# 3. Test if it's an Electron vs Node issue
node dist/pnut-term-ts.min.js --version  # Will fail if needs Electron
```

## NEVER FORGET

**This app REQUIRES Electron to run!** It's not a standalone Node.js app. The MainWindow class uses BrowserWindow which only exists in Electron context. Without Electron, the app cannot create windows.