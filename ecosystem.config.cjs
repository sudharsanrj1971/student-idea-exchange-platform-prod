// PM2 Ecosystem Config — iChange Platform
// Run: pm2 start ecosystem.config.cjs
// Then: pm2 save && pm2 startup

module.exports = {
  apps: [
    {
      name: 'ichange-backend',
      script: './apps/backend/src/index.js',
      cwd: './',

      // ── Cluster Mode (Check #8) ─────────────────────────────
      // CRITICAL: Must run in cluster mode, not fork mode.
      // Fork mode = 1 process, 1 CPU core; event loop blocks at ~200-300 concurrent sockets.
      // Cluster mode = one worker per CPU core; Node.js load-balances connections across workers.
      exec_mode: 'cluster',
      instances: 'max', // Automatically uses all available CPU cores

      // ── Environment ─────────────────────────────────────────
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5010,
      },

      // ── Memory Guard (OOM Prevention) ───────────────────────
      // Auto-restart a worker if it exceeds 1.5 GB, before the OS OOM killer fires.
      // This gives PM2 time for graceful shutdown vs. an abrupt SIGKILL.
      max_memory_restart: '1500M',

      // ── Node.js Flags (1200-user tuning) ────────────────────
      node_args: [
        '--max-old-space-size=8192', // 8 GB V8 heap limit per worker
        '--max-semi-space-size=128', // 128 MB new-gen space (reduces minor GC pauses)
      ],
      env_vars: {
        UV_THREADPOOL_SIZE: '128', // Match OS thread pool to Mediasoup worker count
      },

      // ── Restart Behaviour ────────────────────────────────────
      autorestart: true,
      max_restarts: 10,       // Give up after 10 restarts in the restart_delay window
      min_uptime: '10s',      // Don't count as stable unless up for at least 10s
      restart_delay: 4000,    // Wait 4s between restarts to avoid tight loops

      // ── Logging ─────────────────────────────────────────────
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,

      // ── Zero-Downtime Reload ─────────────────────────────────
      // pm2 reload ichange-backend  ← graceful rolling restart
      kill_timeout: 10000,   // Wait 10s for graceful shutdown before SIGKILL (Check #15)
      listen_timeout: 8000,  // Wait 8s for new cluster workers to start listening
      shutdown_with_message: true, // Send SIGINT, not SIGTERM, so our handler fires
      wait_ready: true,      // Wait for process.send('ready') before considering online
    }
  ]
};
