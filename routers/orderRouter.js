import express from 'express';
import expressAsyncHandler from 'express-async-handler'
import Order from '../models/orderModel.js';
import Product from '../models/productsModel.js';
import { storefrontProductNames } from '../products.js';
import { isAuth } from '../utils.js';

const orderRouter = express.Router();

orderRouter.get('/mine', isAuth, expressAsyncHandler(async(req,res)=>{
    const orders = await Order.find({user: req.user._id});
    res.send(orders);
}))

orderRouter.post('/', isAuth ,expressAsyncHandler(async(req,res) => {
        if(req.body.orderItems.length === 0){
            res.status(400).send({
                message: 'Cart is empty'
            });
        }
        else{
            const productIds = [...new Set(req.body.orderItems.map(item => String(item.product)))];
            const availableCount = await Product.countDocuments({
                _id: { $in: productIds },
                name: { $in: storefrontProductNames },
                stock: { $gt: 0 },
            });
            if (availableCount !== productIds.length) {
                return res.status(400).send({ message: 'Some products are no longer available. Update your cart and try again.' });
            }

            const order = new Order({
                orderItems: req.body.orderItems,
                shippingAddress: req.body.shippingAddress,
                paymentMethod: req.body.paymentMethod,
                itemsPrice: req.body.itemsPrice,
                shippingPrice: req.body.shippingPrice,
                taxPrice: req.body.taxPrice,
                totalPrice: req.body.totalPrice,
                user: req.user._id
            });
            const createdOrder = await order.save();
            res.status(201)
            .send({message: "New order created.", order: createdOrder});
        }
    })
);

orderRouter.get('/:id', isAuth, expressAsyncHandler(async(req,res) => {
    const order = await Order.findById(req.params.id);
    if(order){
        res.send(order);
    }
    else{
        res.status(404).send({message: "Order not found."});
    }
}))

orderRouter.put('/:id/pay', isAuth, expressAsyncHandler(async(req,res)=>{
    const order = await Order.findById(req.params.id);
    if(order){
        order.isPaid = true;
        order.paidAt = Date.now();
        order.paymentResult = {
            id: req.body.id,
            status: req.body.status,
            update_time: req.body.update_time,
            email_address: req.body.email_address,
        };

        const updateOrder = await order.save();
        res.send({
            message: "Order paid.",
            order: updateOrder
        })
    }
    else{
        res.status(404).send({message: "Order not found."});
    }
}))

export default orderRouter;
