module.exports = {
  apps: [{
    name: 'ichange-backend',
    script: '/opt/ichange/apps/backend/src/index.js',
    env: {
      NODE_ENV: 'production',
      PORT: '5010',
      MONGODB_URI: 'mongodb+srv://sudharsanrj1971_db_user:Sudharsan%401336@cluster0.khudzha.mongodb.net/ichange?appName=Cluster0',
      REDIS_URL: 'rediss://:gQAAAAAAAWNRAAIgcDFiMDljZjVhZWJkNGM0OWZmOTc5OWY0YmMzNjlkNjUzNA@enormous-aphid-90961.upstash.io:6379',
      JWT_SECRET: '2f59b4b7275bf689a03dc9ab1676febdbe175afa23ed7ad8384eb84938ebf35ca022bf91e77f3ca70405260ae4c7c10c1beec853fd312fb9675b2d097ad8fc0e',
      JWT_REFRESH_SECRET: '21869f4fef437e14742a576bdd390605297387e47ae63f9666fb9dad863022d7d7e9efaeca3b839b4403f2aa87011715ba3101f9ff3a67d72d01dc1f55f64d88',
      JWT_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
      ADMIN_EMAIL: 'sudharsanrj1971@gmail.com',
      ADMIN_PASSWORD: 'Admin@ichange123',
      FRONTEND_URL: 'https://ichange.me',
      GOOGLE_CLIENT_ID: '323801519369-53avmrpuqvmmq73q3emq5phd5886un80.apps.googleusercontent.com',
      MEDIASOUP_ANNOUNCED_IP: '172.188.48.153',
      MEDIASOUP_LISTEN_IP: '0.0.0.0',
      MEDIASOUP_MIN_PORT: '10000',
      MEDIASOUP_MAX_PORT: '59999'
    }
  }]
}
