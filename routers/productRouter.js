import express from 'express';
import { isAuth } from '../utils.js';
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

    product.archived = !storefrontProductNames.includes(product.name);
    if (product.archived) product.stock = 0;
    res.send(product);
}));

productRouter.put('/:id/rating', isAuth, expressAsyncHandler(async (req, res) => {
    const { score } = req.body;
    if (!Number.isInteger(score) || score < 1 || score > 5) {
        return res.status(400).send({ message: 'Choose a whole number from 1 to 5.' });
    }
    if (!/^[a-f0-9]{24}$/i.test(req.params.id)) {
        return res.status(404).send({ message: 'Product not found.' });
    }

    const user = String(req.user._id);
    const product = await Product.findOneAndUpdate(
        { _id: req.params.id, name: { $in: storefrontProductNames } },
        [
            { $set: { customerRatings: { $concatArrays: [
                { $filter: {
                    input: { $ifNull: ['$customerRatings', []] },
                    as: 'entry',
                    cond: { $ne: ['$$entry.user', { $literal: user }] },
                } },
                { $literal: [{ user, score }] },
            ] } } },
            { $set: {
                rating: { $avg: '$customerRatings.score' },
                numRev: { $size: '$customerRatings' },
            } },
        ],
        { new: true, useFindAndModify: false }
    ).lean();

    if (!product) return res.status(404).send({ message: 'Product not found.' });
    res.send({ rating: product.rating, numRev: product.numRev });
}));

export default productRouter;
