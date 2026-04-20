module.exports = {
  apps: [
    {
      name: 'aistudio',
      script: 'npx',
      args: 'wrangler pages dev dist --d1=aistudio-production --local --ip 0.0.0.0 --port 3000 --no-live-reload',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
