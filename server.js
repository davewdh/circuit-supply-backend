import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

import userRouter from './routers/userRouter.js';
import productRouter from './routers/productRouter.js';
import orderRouter from './routers/orderRouter.js';
import Product from './models/productsModel.js';
import Order from './models/orderModel.js';
import { products } from './products.js';
import { sandboxClientId } from './paypal.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const connection_url = process.env.MONGODB_URI;

app.use(express.json());
app.use(cors());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.use('/api/users', userRouter);
app.use('/api/products', productRouter);
app.use('/api/orders', orderRouter);

// Keep-alive ping endpoint
app.get('/ping', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();

    const timestamp = new Date().toISOString();
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.status(200).send('pong at ' + timestamp);
  } catch (error) {
    console.error('MongoDB ping error:', error);
    res.status(500).send('MongoDB ping failed');
  }
});

app.get('/api/config/paypal', (req, res) => {
  res.send({ clientId: sandboxClientId() });
});

app.get('/', (req, res) => res.status(200).send('Circuit Supply API'));

async function start() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required.');
  await mongoose.connect(connection_url, {
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // Add missing catalog entries without changing existing stock or order references.
  for (const product of products) {
    await Product.updateOne(
      { name: product.name },
      { $setOnInsert: product },
      { upsert: true }
    );
  }

  await Order.init();

  app.listen(port, () => console.log(`Listening on port ${port}`));
}

start().catch(error => {
  console.error('API startup failed:', error.message);
  process.exit(1);
});
