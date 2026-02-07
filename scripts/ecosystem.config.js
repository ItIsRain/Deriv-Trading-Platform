module.exports = {
  apps: [
    {
      name: 'deriv-token-generator',
      script: './run.sh',
      cwd: '/var/www/Deriv-Trading-Platform/scripts',
      interpreter: '/bin/bash',
      args: '',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
