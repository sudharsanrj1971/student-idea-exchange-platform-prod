module.exports = {
  apps: [{
    name: 'ichange-backend',
    script: 'src/index.js',
    instances: 1,          // Single process — Mediasoup spawns 1 worker per CPU core internally
    exec_mode: 'fork',
    node_args: '--max-old-space-size=8192',
    // Auto-restart if RAM exceeds 10GB (safety net for memory leaks)
    max_memory_restart: '10G',
    // Log paths (ensure /var/log/ichange/ exists)
    error_file: '/var/log/ichange/error.log',
    out_file: '/var/log/ichange/out.log',
    merge_logs: true,
    // Wait 5s before considering the app "online" (let Mediasoup workers init)
    wait_ready: false,
    listen_timeout: 10000,
    kill_timeout: 5000,
    env_production: {
      NODE_ENV: 'production',
      UV_THREADPOOL_SIZE: 128,
    }
  }]
};
