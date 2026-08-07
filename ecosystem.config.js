module.exports = {
  apps: [
    {
      name: "chama",
      script: "pnpm",
      args: "start",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: 3010,
      },
    },
  ],
};
