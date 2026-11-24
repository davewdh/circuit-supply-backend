import { orderError } from './checkout.js';

const sandbox = 'https://api-m.sandbox.paypal.com';

export const sandboxClientId = () =>
    process.env.PAYPAL_CLIENT_SECRET && process.env.PAYPAL_CLIENT_ID ? process.env.PAYPAL_CLIENT_ID : null;

async function accessToken() {
    const clientId = sandboxClientId();
    if (!clientId) throw orderError(503, 'PayPal Sandbox is unavailable.');
    const auth = Buffer.from(`${clientId}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
    const response = await fetch(sandbox + '/v1/oauth2/token', {
        method: 'POST',
        headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials',
        signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw orderError(502, 'PayPal Sandbox could not be reached.');
    return (await response.json()).access_token;
}

async function paypalOrder(path, { token, requestId, body } = {}) {
    const response = await fetch(sandbox + '/v2/checkout/orders' + path, {
        method: requestId ? 'POST' : 'GET',
        headers: {
            Authorization: 'Bearer ' + (token || await accessToken()),
            'Content-Type': 'application/json',
            ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
        },
        body: requestId ? JSON.stringify(body || {}) : undefined,
        signal: AbortSignal.timeout(12000),
    });
    return { response, data: await response.json() };
}

export async function createSandboxOrder(order) {
    const { response, data } = await paypalOrder('', {
        requestId: `create-${order._id}`,
        body: {
            intent: 'CAPTURE',
            purchase_units: [{
                reference_id: String(order._id),
                amount: { value: order.totalPrice.toFixed(2), currency_code: 'USD' },
            }],
        },
    });
    if (!response.ok || !data.id) throw orderError(502, 'PayPal Sandbox could not create the payment.');
    return data.id;
}

export async function captureSandboxOrder(order) {
    const token = await accessToken();
    const path = '/' + encodeURIComponent(order.paypalOrderId);
    let result = await paypalOrder(path + '/capture', { token, requestId: `capture-${order._id}` });
    if (!result.response.ok) {
        result = await paypalOrder(path, { token });
    }

    const unit = result.data.purchase_units?.[0];
    const capture = unit?.payments?.captures?.[0];
    if (!result.response.ok || result.data.id !== order.paypalOrderId || result.data.status !== 'COMPLETED' ||
        unit?.reference_id !== String(order._id) || capture?.status !== 'COMPLETED' ||
        capture.amount?.currency_code !== 'USD' || capture.amount?.value !== order.totalPrice.toFixed(2)) {
        throw orderError(502, 'PayPal Sandbox has not confirmed this payment.');
    }
    return capture.id;
}
