module.exports = {
  apps: [{
    name: 'oa-system',
    script: '/Users/yuce/.npm-global/bin/tsx',
    args: 'src/index.ts',
    cwd: __dirname,
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOST: '0.0.0.0'
    },
    watch: false,
    max_memory_restart: '1G',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    merge_logs: true,
  }]
}
