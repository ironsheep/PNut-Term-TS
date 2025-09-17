#!/usr/bin/env node

/**
 * REAL test to verify where debug logger actually creates files
 * This will instantiate actual classes to see what happens
 */

const fs = require('fs');
const path = require('path');

// Simulate the real Context class behavior
function createTestContext(startupDir) {
  return {
    currentFolder: startupDir,
    preferences: {
      logging: {
        logDirectory: './logs/',
        autoSaveDebug: true,
        newLogOnDtrReset: true,
        maxLogSize: 'unlimited'
      },
      recordings: {
        recordingsDirectory: './recordings/'
      }
    },
    getLogDirectory() {
      return path.join(this.currentFolder, this.preferences.logging.logDirectory);
    },
    getRecordingsDirectory() {
      return path.join(this.currentFolder, this.preferences.recordings.recordingsDirectory);
    },
    updatePreferences(newPrefs) {
      this.preferences = { ...this.preferences, ...newPrefs };
    }
  };
}

// Simulate debug logger file creation
function simulateDebugLoggerFileCreation(context) {
  console.log('=== Simulating Debug Logger File Creation ===');
  console.log('Context currentFolder:', context.currentFolder);
  console.log('Context getLogDirectory():', context.getLogDirectory());

  // This is what the debug logger SHOULD do
  const expectedLogDir = context.getLogDirectory();
  console.log('Expected log directory:', expectedLogDir);

  // Check if it exists
  if (fs.existsSync(expectedLogDir)) {
    console.log('✅ Log directory exists');
  } else {
    console.log('❌ Log directory does NOT exist');
  }

  // Try to create it
  try {
    fs.mkdirSync(expectedLogDir, { recursive: true });
    console.log('✅ Successfully created log directory');
  } catch (error) {
    console.log('❌ Failed to create log directory:', error.message);
  }

  // Try to create a test log file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const testLogFile = path.join(expectedLogDir, `debug_${timestamp}.log`);

  try {
    fs.writeFileSync(testLogFile, `=== Test Log Created at ${new Date().toISOString()} ===\n`);
    fs.writeFileSync(testLogFile, `Context currentFolder: ${context.currentFolder}\n`, { flag: 'a' });
    fs.writeFileSync(testLogFile, `Expected log directory: ${expectedLogDir}\n`, { flag: 'a' });
    fs.writeFileSync(testLogFile, `Actual log file: ${testLogFile}\n`, { flag: 'a' });

    console.log('✅ Successfully created test log file:', testLogFile);

    // Verify file exists and has content
    if (fs.existsSync(testLogFile)) {
      const content = fs.readFileSync(testLogFile, 'utf8');
      console.log('📄 File content:');
      console.log(content);
    }

    return testLogFile;
  } catch (error) {
    console.log('❌ Failed to create test log file:', error.message);
    return null;
  }
}

// Test current working directory behavior
function testCurrentWorkingDirectory() {
  console.log('\n=== Testing Current Working Directory Behavior ===');
  console.log('process.cwd():', process.cwd());
  console.log('__dirname:', __dirname);

  // Test 1: Using process.cwd() as startup directory
  console.log('\n--- Test 1: Using process.cwd() as startup directory ---');
  const context1 = createTestContext(process.cwd());
  const logFile1 = simulateDebugLoggerFileCreation(context1);

  // Test 2: Using a different directory as startup directory
  console.log('\n--- Test 2: Using different startup directory ---');
  const testDir = path.join(process.cwd(), 'test-startup-dir');
  const context2 = createTestContext(testDir);
  const logFile2 = simulateDebugLoggerFileCreation(context2);

  // Test 3: Custom log directory preference
  console.log('\n--- Test 3: Custom log directory preference ---');
  const context3 = createTestContext(process.cwd());
  context3.updatePreferences({
    logging: {
      logDirectory: './custom-logs/',
      autoSaveDebug: true,
      newLogOnDtrReset: true,
      maxLogSize: 'unlimited'
    }
  });
  const logFile3 = simulateDebugLoggerFileCreation(context3);

  return { logFile1, logFile2, logFile3 };
}

// Test screenshot directory behavior
function testScreenshotDirectory() {
  console.log('\n=== Testing Screenshot Directory Behavior ===');

  // This is what should happen for screenshots
  const screenshotDir = process.cwd(); // Screenshots should go in current working directory
  const screenshotFile = path.join(screenshotDir, `screenshot_${Date.now()}.png`);

  console.log('Expected screenshot directory:', screenshotDir);
  console.log('Expected screenshot file:', screenshotFile);

  // Test if we can write to this directory
  try {
    fs.writeFileSync(screenshotFile, 'fake screenshot data');
    console.log('✅ Successfully created test screenshot file');

    // Clean up
    fs.unlinkSync(screenshotFile);
    console.log('✅ Cleaned up test screenshot file');

    return screenshotDir;
  } catch (error) {
    console.log('❌ Failed to create screenshot file:', error.message);
    return null;
  }
}

// Main test function
function runRealDirectoryTest() {
  console.log('🔍 REAL DIRECTORY TEST - Checking Actual File Creation');
  console.log('==================================================\n');

  const logResults = testCurrentWorkingDirectory();
  const screenshotResult = testScreenshotDirectory();

  console.log('\n=== SUMMARY ===');
  console.log('📁 Process CWD:', process.cwd());
  console.log('📁 Script location:', __dirname);

  if (logResults.logFile1) {
    console.log('✅ Log file 1 created at:', logResults.logFile1);
  }
  if (logResults.logFile2) {
    console.log('✅ Log file 2 created at:', logResults.logFile2);
  }
  if (logResults.logFile3) {
    console.log('✅ Log file 3 created at:', logResults.logFile3);
  }

  if (screenshotResult) {
    console.log('✅ Screenshot directory accessible:', screenshotResult);
  }

  console.log('\n🔍 Next steps: Check if these match your expected locations!');

  // Clean up test files
  setTimeout(() => {
    [logResults.logFile1, logResults.logFile2, logResults.logFile3].forEach(file => {
      if (file && fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
          console.log('🧹 Cleaned up:', file);
        } catch (e) {
          console.log('⚠️ Could not clean up:', file);
        }
      }
    });

    // Clean up directories if empty
    ['logs', 'test-startup-dir/logs', 'custom-logs'].forEach(dir => {
      const fullPath = path.join(process.cwd(), dir);
      try {
        if (fs.existsSync(fullPath)) {
          fs.rmdirSync(fullPath);
          console.log('🧹 Cleaned up directory:', fullPath);
        }
      } catch (e) {
        // Directory not empty or other issue - that's fine
      }
    });

    try {
      const testDir = path.join(process.cwd(), 'test-startup-dir');
      if (fs.existsSync(testDir)) {
        fs.rmdirSync(testDir);
        console.log('🧹 Cleaned up test directory:', testDir);
      }
    } catch (e) {
      // That's fine
    }
  }, 1000);
}

runRealDirectoryTest();