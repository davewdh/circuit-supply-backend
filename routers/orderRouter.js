import express from 'express';
import expressAsyncHandler from 'express-async-handler';
import Order from '../models/orderModel.js';
import User from '../models/userModel.js';
import { usesLegacyAdminPassword } from '../users.js';
import { isAuth } from '../utils.js';
import { assertQuoteMatches, isOrderId, orderError, quoteOrder } from '../checkout.js';
import { validateShippingAddress } from '../shippingAddress.js';
import { captureSandboxOrder, createSandboxOrder } from '../paypal.js';

const orderRouter = express.Router();

async function findOrder(id, user) {
    if (!isOrderId(id)) throw orderError(404, 'Order not found.');
    const filter = user.canManageOrders ? { _id: id } : { _id: id, user: user._id };
    const order = await Order.findOne(filter);
    if (!order) throw orderError(404, 'Order not found.');
    return order;
}

orderRouter.use(isAuth);
orderRouter.use(expressAsyncHandler(async (req, res, next) => {
    if (req.user.isAdmin) {
        const user = await User.findById(req.user._id).select('isAdmin email password updatedAt');
        req.user.canManageOrders = Boolean(user?.isAdmin && !usesLegacyAdminPassword(user) &&
            req.user.iat >= Math.floor(user.updatedAt.getTime() / 1000));
    }
    next();
}));

function requireOrderAdmin(req, res, next) {
    if (!req.user.canManageOrders) return res.status(401).send({ message: 'An authorized admin account is required.' });
    next();
}

orderRouter.get('/mine', expressAsyncHandler(async (req, res) => {
    res.send(await Order.find({ user: req.user._id }).sort({ createdAt: -1 }));
}));

orderRouter.get('/admin', requireOrderAdmin, expressAsyncHandler(async (req, res) => {
    res.send(await Order.find().sort({ createdAt: -1 }).limit(100)
        .select('createdAt totalPrice isPaid paidAt shippedAt isDelivered deliveredAt'));
}));

orderRouter.post('/shipping-address', expressAsyncHandler(async (req, res) => {
    res.send({ address: validateShippingAddress(req.body.shippingAddress) });
}));

orderRouter.post('/quote', expressAsyncHandler(async (req, res) => {
    res.send(await quoteOrder(req.body.orderItems));
}));

orderRouter.post('/', expressAsyncHandler(async (req, res) => {
    if (req.body.paymentMethod !== 'PayPal') throw orderError(400, 'Choose PayPal Sandbox for this demo order.');
    const { checkoutId } = req.body;
    if (typeof checkoutId !== 'string' || !/^[a-f0-9-]{36}$/i.test(checkoutId)) {
        throw orderError(400, 'Refresh checkout and try again.');
    }
    const lookup = { checkoutId, user: req.user._id };
    const existing = await Order.findOne(lookup);
    if (existing) return res.send({ order: existing });

    const shippingAddress = validateShippingAddress(req.body.shippingAddress);
    const quote = await quoteOrder(req.body.orderItems);
    assertQuoteMatches(req.body.orderItems, quote);
    try {
        const order = await Order.create({ ...quote, ...lookup, shippingAddress, paymentMethod: 'PayPal' });
        res.status(201).send({ order });
    } catch (error) {
        if (error.code !== 11000) throw error;
        const existingOrder = await Order.findOne(lookup);
        if (!existingOrder) throw error;
        res.send({ order: existingOrder });
    }
}));

orderRouter.get('/:id', expressAsyncHandler(async (req, res) => {
    res.send(await findOrder(req.params.id, req.user));
}));

orderRouter.post('/:id/paypal', expressAsyncHandler(async (req, res) => {
    const order = await findOrder(req.params.id, { _id: req.user._id });
    if (order.isPaid) throw orderError(409, 'This order is already paid.');
    if (!order.paypalOrderId) {
        const paypalOrderId = await createSandboxOrder(order);
        await Order.updateOne({ _id: order._id, paypalOrderId: { $exists: false } }, { $set: { paypalOrderId } });
        const updated = await Order.findById(order._id);
        return res.send({ id: updated.paypalOrderId });
    }
    res.send({ id: order.paypalOrderId });
}));

orderRouter.put('/:id/pay', expressAsyncHandler(async (req, res) => {
    const order = await findOrder(req.params.id, { _id: req.user._id });
    if (order.isPaid) return res.send({ order });
    if (!order.paypalOrderId || req.body.orderID !== order.paypalOrderId) {
        throw orderError(409, 'Start the PayPal Sandbox payment again.');
    }

    const captureId = await captureSandboxOrder(order);
    const updated = await Order.findOneAndUpdate({ _id: order._id, isPaid: false }, {
        $set: { isPaid: true, paidAt: new Date(), paymentResult: { id: captureId, status: 'COMPLETED' } },
    }, { new: true, useFindAndModify: false });
    res.send({ order: updated || await Order.findById(order._id) });
}));

orderRouter.patch('/:id/fulfillment', requireOrderAdmin, expressAsyncHandler(async (req, res) => {
    if (!isOrderId(req.params.id)) throw orderError(404, 'Order not found.');
    const { status } = req.body;
    if (status !== 'shipped' && status !== 'delivered') throw orderError(400, 'Choose shipped or delivered.');
    const filter = { _id: req.params.id, isPaid: true, isDelivered: { $ne: true } };
    filter.shippedAt = status === 'shipped' ? null : { $ne: null };
    const updates = status === 'shipped' ? { shippedAt: new Date() } : { isDelivered: true, deliveredAt: new Date() };
    const updated = await Order.findOneAndUpdate(filter, { $set: updates }, { new: true, useFindAndModify: false });
    if (!updated) {
        const order = await findOrder(req.params.id, req.user);
        if ((status === 'shipped' && order.shippedAt) || (status === 'delivered' && order.isDelivered)) {
            return res.send(order);
        }
        throw orderError(409, 'An order must be paid before shipping and shipped before delivery.');
    }
    res.send(updated);
}));

orderRouter.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status || (error.name === 'ValidationError' ? 400 : 500);
    if (status === 500) console.error(error);
    res.status(status).send({
        message: status === 500 ? 'The order could not be processed. Try again.' : error.message,
        ...(error.fields ? { fields: error.fields } : {}),
    });
});

export default orderRouter;
