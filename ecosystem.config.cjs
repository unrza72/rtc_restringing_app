// pm2 process for the production server — see DEPLOYMENT.md.
// Settings (DATABASE_URL, BETTER_AUTH_*, PORT, …) come from .env next to this file.
module.exports = {
  apps: [
    {
      name: 'rtc-restringing',
      cwd: __dirname,
      script: '.output/server/index.mjs',
      node_args: '--env-file=.env',
      env: { NODE_ENV: 'production' },
    },
  ],
}
