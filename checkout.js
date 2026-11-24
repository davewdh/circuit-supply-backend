import Product from './models/productsModel.js';
import { storefrontProductNames } from './products.js';

export function orderError(status, message) {
    return Object.assign(new Error(message), { status });
}

export const isOrderId = id => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);
const cents = amount => Math.round(Number(amount) * 100);

export async function quoteOrder(input) {
    if (!Array.isArray(input) || !input.length) throw orderError(400, 'Your cart is empty.');

    const ids = new Set();
    for (const item of input) {
        if (!item || !isOrderId(item.product) || !Number.isSafeInteger(item.qty) || item.qty < 1) {
            throw orderError(400, 'Every item needs a valid product and quantity.');
        }
        const id = item.product.toLowerCase();
        if (ids.has(id)) throw orderError(400, 'Remove duplicate products from your cart.');
        ids.add(id);
    }

    const products = await Product.find({
        _id: { $in: [...ids] },
        name: { $in: storefrontProductNames },
    }).lean();
    const byId = new Map(products.map(product => [String(product._id), product]));
    const orderItems = input.map(item => {
        const product = byId.get(item.product.toLowerCase());
        if (!product || product.stock < item.qty) {
            const message = product
                ? `${product.name} has only ${product.stock} in stock. Update your cart to continue.`
                : 'A product in your cart is no longer available. Remove it to continue.';
            throw orderError(409, message);
        }
        return { product: product._id, name: product.name, image: product.image, price: product.price, qty: item.qty };
    });

    const subtotal = orderItems.reduce((total, item) => total + cents(item.price) * item.qty, 0);
    const shipping = subtotal > 10000 ? 0 : 1000;
    const tax = Math.round(subtotal * 0.15);
    return {
        orderItems,
        itemsPrice: subtotal / 100,
        shippingPrice: shipping / 100,
        taxPrice: tax / 100,
        totalPrice: (subtotal + shipping + tax) / 100,
    };
}

export function assertQuoteMatches(input, quote) {
    const changed = quote.orderItems.find((item, index) =>
        !Number.isFinite(input[index].price) || cents(input[index].price) !== cents(item.price)
    );
    if (changed) throw orderError(409, `The price of ${changed.name} changed. Refresh the order summary to continue.`);
}
