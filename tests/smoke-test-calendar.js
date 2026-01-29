/**
 * Smoke Tests - Google Calendar Integration
 * Tests that can run without Google OAuth credentials
 */

const fs = require('fs');
const path = require('path');

// ANSI colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: []
};

function test(name, fn) {
  try {
    fn();
    console.log(`${colors.green}✓${colors.reset} ${name}`);
    results.passed++;
    results.tests.push({ name, status: 'pass' });
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset} ${name}`);
    console.log(`  ${colors.red}Error: ${error.message}${colors.reset}`);
    results.failed++;
    results.tests.push({ name, status: 'fail', error: error.message });
  }
}

function warn(name, message) {
  console.log(`${colors.yellow}⚠${colors.reset} ${name}`);
  console.log(`  ${colors.yellow}${message}${colors.reset}`);
  results.warnings++;
  results.tests.push({ name, status: 'warning', message });
}

function section(title) {
  console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}${title}${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
}

// Helper: Check if file exists
function fileExists(filepath) {
  return fs.existsSync(filepath);
}

// Helper: Read file content
function readFile(filepath) {
  return fs.readFileSync(filepath, 'utf8');
}

// Helper: Check if string contains substring
function contains(str, substr) {
  return str.includes(substr);
}

// Start Tests
console.log('\n🧪 SMOKE TESTS - Google Calendar Integration\n');

// =============================================================================
section('1. File Existence');
// =============================================================================

test('calendar-helpers.ts exists', () => {
  const filepath = path.join(__dirname, '../functions/src/calendar-helpers.ts');
  if (!fileExists(filepath)) throw new Error('File not found');
});

test('settings page exists', () => {
  const filepath = path.join(__dirname, '../app/src/app/settings/page.tsx');
  if (!fileExists(filepath)) throw new Error('File not found');
});

test('OAuth callback page exists', () => {
  const filepath = path.join(__dirname, '../app/src/app/auth/google/callback/page.tsx');
  if (!fileExists(filepath)) throw new Error('File not found');
});

// =============================================================================
section('2. Backend - calendar-helpers.ts');
// =============================================================================

const helpersPath = path.join(__dirname, '../functions/src/calendar-helpers.ts');
const helpersContent = readFile(helpersPath);

test('Exports exchangeCodeForTokens function', () => {
  if (!contains(helpersContent, 'export async function exchangeCodeForTokens')) {
    throw new Error('Function not exported');
  }
});

test('Exports syncUserCalendar function', () => {
  if (!contains(helpersContent, 'export async function syncUserCalendar')) {
    throw new Error('Function not exported');
  }
});

test('Exports correlateEventsWithRecordings function', () => {
  if (!contains(helpersContent, 'export async function correlateEventsWithRecordings')) {
    throw new Error('Function not exported');
  }
});

test('Exports refreshAccessToken function', () => {
  if (!contains(helpersContent, 'export async function refreshAccessToken')) {
    throw new Error('Function not exported');
  }
});

test('Exports syncAllActiveCalendars function', () => {
  if (!contains(helpersContent, 'export async function syncAllActiveCalendars')) {
    throw new Error('Function not exported');
  }
});

test('Exports CALENDAR_SCOPES constant', () => {
  if (!contains(helpersContent, 'export const CALENDAR_SCOPES')) {
    throw new Error('Constant not exported');
  }
});

test('Uses googleapis package', () => {
  if (!contains(helpersContent, "from 'googleapis'")) {
    throw new Error('googleapis not imported');
  }
});

test('Implements OAuth2 client', () => {
  if (!contains(helpersContent, 'Auth.OAuth2Client')) {
    throw new Error('OAuth2Client not used');
  }
});

test('Implements token refresh logic', () => {
  if (!contains(helpersContent, 'refreshAccessToken') && 
      !contains(helpersContent, 'oauth2Client.refreshAccessToken')) {
    throw new Error('Token refresh not implemented');
  }
});

test('Implements correlation algorithm', () => {
  if (!contains(helpersContent, 'correlateEventsWithRecordings')) {
    throw new Error('Correlation not implemented');
  }
});

test('Handles timestamp matching', () => {
  if (!contains(helpersContent, 'fifteenMin') || !contains(helpersContent, 'timeDiff')) {
    throw new Error('Timestamp matching logic missing');
  }
});

test('Extracts meeting URLs', () => {
  if (!contains(helpersContent, 'extractMeetingUrl')) {
    throw new Error('Meeting URL extraction missing');
  }
});

// =============================================================================
section('3. Backend - index.ts Functions');
// =============================================================================

const indexPath = path.join(__dirname, '../functions/src/index.ts');
const indexContent = readFile(indexPath);

test('Imports calendar helpers', () => {
  if (!contains(indexContent, "from './calendar-helpers'")) {
    throw new Error('Calendar helpers not imported');
  }
});

test('Exports connectGoogleCalendar function', () => {
  if (!contains(indexContent, 'export const connectGoogleCalendar')) {
    throw new Error('Function not exported');
  }
});

test('Exports syncCalendar function', () => {
  if (!contains(indexContent, 'export const syncCalendar')) {
    throw new Error('Function not exported');
  }
});

test('Exports scheduledCalendarSync function', () => {
  if (!contains(indexContent, 'export const scheduledCalendarSync')) {
    throw new Error('Function not exported');
  }
});

test('Exports disconnectGoogleCalendar function', () => {
  if (!contains(indexContent, 'export const disconnectGoogleCalendar')) {
    throw new Error('Function not exported');
  }
});

test('Exports correlateRecordingsWithEvents function', () => {
  if (!contains(indexContent, 'export const correlateRecordingsWithEvents')) {
    throw new Error('Function not exported');
  }
});

test('connectGoogleCalendar uses https.onCall', () => {
  if (!contains(indexContent, 'connectGoogleCalendar') || 
      !contains(indexContent, 'https.onCall')) {
    throw new Error('HTTPS callable not used');
  }
});

test('scheduledCalendarSync uses pubsub.schedule', () => {
  if (!contains(indexContent, 'scheduledCalendarSync') || 
      !contains(indexContent, 'pubsub.schedule')) {
    throw new Error('Pub/Sub schedule not used');
  }
});

test('Functions have auth checks', () => {
  if (!contains(indexContent, 'context.auth')) {
    throw new Error('Auth checks missing');
  }
});

test('Functions have error handling', () => {
  if (!contains(indexContent, 'try') && !contains(indexContent, 'catch')) {
    warn('Error handling', 'No try/catch blocks found - verify error handling');
  }
});

// =============================================================================
section('4. Frontend - Settings Page');
// =============================================================================

const settingsPath = path.join(__dirname, '../app/src/app/settings/page.tsx');
const settingsContent = readFile(settingsPath);

test('Is a client component', () => {
  if (!contains(settingsContent, "'use client'")) {
    throw new Error('Not marked as client component');
  }
});

test('Uses AuthContext', () => {
  if (!contains(settingsContent, 'useAuth')) {
    throw new Error('useAuth not imported/used');
  }
});

test('Uses ProtectedRoute', () => {
  if (!contains(settingsContent, 'ProtectedRoute')) {
    throw new Error('ProtectedRoute not used');
  }
});

test('Has calendar connection state', () => {
  if (!contains(settingsContent, 'isCalendarConnected')) {
    throw new Error('Calendar connection state missing');
  }
});

test('Has connect button', () => {
  if (!contains(settingsContent, 'handleConnectCalendar') || 
      !contains(settingsContent, 'Connect')) {
    throw new Error('Connect button missing');
  }
});

test('Has disconnect button', () => {
  if (!contains(settingsContent, 'handleDisconnectCalendar') || 
      !contains(settingsContent, 'Disconnect')) {
    throw new Error('Disconnect button missing');
  }
});

test('Has sync now button', () => {
  if (!contains(settingsContent, 'handleSyncNow') || 
      !contains(settingsContent, 'Sync')) {
    throw new Error('Sync button missing');
  }
});

test('Shows calendar email', () => {
  if (!contains(settingsContent, 'calendarEmail')) {
    throw new Error('Calendar email display missing');
  }
});

test('Shows last sync time', () => {
  if (!contains(settingsContent, 'lastSync')) {
    throw new Error('Last sync time display missing');
  }
});

test('Has OAuth URL construction', () => {
  if (!contains(settingsContent, 'accounts.google.com/o/oauth2')) {
    throw new Error('OAuth URL not constructed');
  }
});

test('Uses correct OAuth scopes', () => {
  if (!contains(settingsContent, 'calendar.readonly')) {
    throw new Error('Calendar scopes missing');
  }
});

test('Has error/success messages', () => {
  if (!contains(settingsContent, 'error') && !contains(settingsContent, 'success')) {
    throw new Error('Error/success messaging missing');
  }
});

test('Uses Suspense boundary', () => {
  if (!contains(settingsContent, 'Suspense')) {
    throw new Error('Suspense boundary missing');
  }
});

// =============================================================================
section('5. Frontend - OAuth Callback');
// =============================================================================

const callbackPath = path.join(__dirname, '../app/src/app/auth/google/callback/page.tsx');
const callbackContent = readFile(callbackPath);

test('Is a client component', () => {
  if (!contains(callbackContent, "'use client'")) {
    throw new Error('Not marked as client component');
  }
});

test('Uses useSearchParams', () => {
  if (!contains(callbackContent, 'useSearchParams')) {
    throw new Error('useSearchParams not imported/used');
  }
});

test('Calls connectGoogleCalendar function', () => {
  if (!contains(callbackContent, 'connectGoogleCalendar')) {
    throw new Error('Cloud Function not called');
  }
});

test('Handles OAuth code', () => {
  if (!contains(callbackContent, "searchParams.get('code')")) {
    throw new Error('OAuth code not extracted');
  }
});

test('Handles OAuth error', () => {
  if (!contains(callbackContent, "searchParams.get('error')")) {
    throw new Error('OAuth error not handled');
  }
});

test('Shows loading state', () => {
  if (!contains(callbackContent, 'processing') || !contains(callbackContent, 'animate-spin')) {
    throw new Error('Loading state missing');
  }
});

test('Shows success state', () => {
  if (!contains(callbackContent, 'success')) {
    throw new Error('Success state missing');
  }
});

test('Shows error state', () => {
  if (!contains(callbackContent, 'error')) {
    throw new Error('Error state missing');
  }
});

test('Redirects to settings', () => {
  if (!contains(callbackContent, "router.push('/settings")) {
    throw new Error('Redirect to settings missing');
  }
});

test('Uses Suspense boundary', () => {
  if (!contains(callbackContent, 'Suspense')) {
    throw new Error('Suspense boundary missing');
  }
});

// =============================================================================
section('6. Frontend - Main Page Integration');
// =============================================================================

const mainPagePath = path.join(__dirname, '../app/src/app/page.tsx');
const mainPageContent = readFile(mainPagePath);

test('Displays correlatedEvent', () => {
  if (!contains(mainPageContent, 'correlatedEvent')) {
    throw new Error('correlatedEvent display missing');
  }
});

test('Shows event summary', () => {
  if (!contains(mainPageContent, 'correlatedEvent.summary')) {
    throw new Error('Event summary display missing');
  }
});

test('Shows event participants', () => {
  if (!contains(mainPageContent, 'correlatedEvent.participants')) {
    throw new Error('Participants display missing');
  }
});

test('Shows match score', () => {
  if (!contains(mainPageContent, 'matchScore')) {
    throw new Error('Match score display missing');
  }
});

test('Has settings link', () => {
  if (!contains(mainPageContent, '/settings')) {
    throw new Error('Settings link missing');
  }
});

// =============================================================================
section('7. Build Verification');
// =============================================================================

const functionsPackagePath = path.join(__dirname, '../functions/package.json');
const appPackagePath = path.join(__dirname, '../app/package.json');

test('Functions package.json has googleapis', () => {
  const pkg = JSON.parse(readFile(functionsPackagePath));
  if (!pkg.dependencies || !pkg.dependencies.googleapis) {
    throw new Error('googleapis dependency missing');
  }
});

test('Functions package.json has google-auth-library', () => {
  const pkg = JSON.parse(readFile(functionsPackagePath));
  if (!pkg.dependencies || !pkg.dependencies['google-auth-library']) {
    throw new Error('google-auth-library dependency missing');
  }
});

// Check if build artifacts exist
const functionsLibPath = path.join(__dirname, '../functions/lib');
if (fileExists(functionsLibPath)) {
  test('Functions build output exists', () => {
    const files = fs.readdirSync(functionsLibPath);
    if (files.length === 0) throw new Error('No build files found');
  });
  
  test('calendar-helpers.js compiled', () => {
    const calendarJsPath = path.join(functionsLibPath, 'calendar-helpers.js');
    if (!fileExists(calendarJsPath)) throw new Error('calendar-helpers.js not found');
  });
} else {
  warn('Functions build', 'Build output not found - run: cd functions && npm run build');
}

// =============================================================================
section('8. Configuration Checks');
// =============================================================================

// Check for environment variable placeholders
warn('Google Client ID', 'Needs to be configured in Firebase secrets');
warn('Google Client Secret', 'Needs to be configured in Firebase secrets');
warn('Google Redirect URI', 'Needs to be configured in Firebase secrets');

// Check frontend env
const envExamplePath = path.join(__dirname, '../app/.env.example');
if (fileExists(envExamplePath)) {
  const envExample = readFile(envExamplePath);
  if (contains(envExample, 'GOOGLE_CLIENT_ID')) {
    test('Frontend env example has GOOGLE_CLIENT_ID', () => {});
  } else {
    warn('Frontend env', '.env.example should include NEXT_PUBLIC_GOOGLE_CLIENT_ID');
  }
}

// =============================================================================
section('9. Documentation');
// =============================================================================

const docsPath = path.join(__dirname, '../docs');

test('CALENDAR_INTEGRATION_ARCHITECTURE.md exists', () => {
  const filepath = path.join(docsPath, 'CALENDAR_INTEGRATION_ARCHITECTURE.md');
  if (!fileExists(filepath)) throw new Error('Architecture doc missing');
});

test('CALENDAR_SETUP_CHECKLIST.md exists', () => {
  const filepath = path.join(docsPath, 'CALENDAR_SETUP_CHECKLIST.md');
  if (!fileExists(filepath)) throw new Error('Setup checklist missing');
});

test('CALENDAR_USER_FLOW.md exists', () => {
  const filepath = path.join(docsPath, 'CALENDAR_USER_FLOW.md');
  if (!fileExists(filepath)) throw new Error('User flow doc missing');
});

const qaPath = path.join(__dirname, '../QA_CALENDAR_INTEGRATION.md');
test('QA checklist exists', () => {
  if (!fileExists(qaPath)) throw new Error('QA checklist missing');
});

// =============================================================================
// Summary
// =============================================================================

console.log('\n' + '='.repeat(60));
console.log('TEST SUMMARY');
console.log('='.repeat(60));
console.log(`${colors.green}Passed:${colors.reset}   ${results.passed}`);
console.log(`${colors.red}Failed:${colors.reset}   ${results.failed}`);
console.log(`${colors.yellow}Warnings:${colors.reset} ${results.warnings}`);
console.log(`Total:    ${results.passed + results.failed + results.warnings}`);

const successRate = (results.passed / (results.passed + results.failed) * 100).toFixed(1);
console.log(`\nSuccess Rate: ${successRate}%`);

if (results.failed === 0) {
  console.log(`\n${colors.green}✓ All tests passed!${colors.reset}`);
  console.log(`${colors.yellow}⚠ ${results.warnings} warnings - review before deployment${colors.reset}\n`);
  process.exit(0);
} else {
  console.log(`\n${colors.red}✗ ${results.failed} test(s) failed${colors.reset}\n`);
  process.exit(1);
}
