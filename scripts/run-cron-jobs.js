#!/usr/bin/env node

/**
 * Local Cron Job Simulator
 * 
 * This script simulates the cron jobs for local testing.
 * In production, Vercel will run these automatically via vercel.json
 * 
 * Usage:
 *   node scripts/run-cron-jobs.js            # Run both jobs
 *   node scripts/run-cron-jobs.js cleanup    # Run cleanup only
 *   node scripts/run-cron-jobs.js abandoned  # Run abandoned emails only
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || 'dev-secret-for-testing';

const jobs = {
  cleanup: {
    name: 'Cleanup Expired Reservations',
    path: '/api/cron/cleanup-reservations',
    schedule: 'Every 15 minutes',
  },
  abandoned: {
    name: 'Send Abandoned Cart Emails',
    path: '/api/reservations/abandoned/notify',
    schedule: 'Daily at 10:00 AM',
  },
  reminders: {
    name: 'Send Upcoming Event Reminders (email & SMS)',
    path: '/api/cron/reminders',
    schedule: 'Daily at 9:00 AM',
  },
};

async function runJob(jobKey) {
  const job = jobs[jobKey];
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔄 Running: ${job.name}`);
  console.log(`   Path: ${job.path}`);
  console.log(`   Schedule: ${job.schedule}`);
  console.log(`${'='.repeat(60)}\n`);

  const url = `${BASE_URL}${job.path}`;
  const isHttps = url.startsWith('https');
  const client = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    };

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        
        try {
          const result = JSON.parse(data);
          console.log('\n📊 Result:');
          console.log(JSON.stringify(result, null, 2));
          
          if (result.success) {
            console.log('\n✅ Job completed successfully!');
          } else {
            console.log('\n⚠️  Job completed with errors');
          }
        } catch (e) {
          console.log('\n📄 Response:');
          console.log(data);
        }
        
        resolve();
      });
    });

    req.on('error', (error) => {
      console.error('\n❌ Error running job:', error.message);
      reject(error);
    });

    req.end();
  });
}

async function main() {
  const arg = process.argv[2];
  
  console.log('\n🚀 Local Cron Job Simulator');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Using secret: ${CRON_SECRET.substring(0, 10)}...`);

  if (arg && jobs[arg]) {
    // Run specific job
    await runJob(arg);
  } else if (arg) {
    // Invalid argument
    console.log(`\n❌ Unknown job: ${arg}`);
    console.log('\nAvailable jobs:');
    Object.entries(jobs).forEach(([key, job]) => {
      console.log(`  - ${key.padEnd(10)} : ${job.name}`);
    });
    process.exit(1);
  } else {
    // Run all jobs
    for (const jobKey of Object.keys(jobs)) {
      await runJob(jobKey);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between jobs
    }
  }

  console.log('\n✨ Done!\n');
}

main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});

