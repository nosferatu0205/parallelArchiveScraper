// start-scheduler.js
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Create log streams
const outStream = fs.createWriteStream(path.join(logsDir, 'scheduler-out.log'), { flags: 'a' });
const errStream = fs.createWriteStream(path.join(logsDir, 'scheduler-err.log'), { flags: 'a' });

// Log startup
const startupMessage = `\n[${new Date().toISOString()}] Starting scheduler process\n`;
outStream.write(startupMessage);

// Spawn scheduler process
const scheduler = spawn('node', ['scheduler.js'], {
  detached: true,
  stdio: ['ignore', 'pipe', 'pipe']
});

// Pipe outputs to log files
scheduler.stdout.pipe(outStream);
scheduler.stderr.pipe(errStream);

// Unref the child process so the parent can exit
scheduler.unref();

console.log(`Scheduler started in background with PID: ${scheduler.pid}`);
console.log(`Log files:`);
console.log(`- ${path.join(logsDir, 'scheduler-out.log')}`);
console.log(`- ${path.join(logsDir, 'scheduler-err.log')}`);