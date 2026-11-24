import express from 'express';
import expressAsyncHandler from 'express-async-handler';
import Product from '../models/productsModel.js';
import { storefrontProductNames } from '../products.js';

const productRouter = express.Router();

productRouter.get('/', expressAsyncHandler(async (req, res) => {
    const products = await Product.find({ name: { $in: storefrontProductNames } });
    res.send(products);
}));

productRouter.get('/:id', expressAsyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).send({ message: 'Product not found.' });

    if (!storefrontProductNames.includes(product.name)) product.stock = 0;
    res.send(product);
}));

export default productRouter;
