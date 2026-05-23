import app from './app';
import pool from './config/db';

const PORT = process.env.PORT ?? 5000;

const startServer = async (): Promise<void> => {
  try {
    await pool.query('SELECT 1');
    console.log('Database connected successfully');
  } catch (err) {
    console.error('Failed to connect to database:', err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

startServer();

