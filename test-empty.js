const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Create a 50MB dummy file
const dummyFile = path.join(os.tmpdir(), 'dummy.bin');
execSync(`dd if=/dev/zero of=${dummyFile} bs=1M count=50`);
// Move to trash
execSync(`mv ${dummyFile} ~/.Trash/`);

// Check size before
const sizeBefore = execSync(`osascript -e 'tell application "Finder" to return size of trash'`).toString().trim();
console.log('Before:', sizeBefore);

// Empty trash
console.log('Emptying...');
execSync(`osascript -e 'tell application "Finder" to empty trash'`);

// Check size IMMEDIATELY after
const sizeAfter = execSync(`osascript -e 'tell application "Finder" to return size of trash'`).toString().trim();
console.log('After:', sizeAfter);
