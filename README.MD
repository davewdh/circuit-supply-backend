## Technologies

  <p align="left">
    <img src="https://raw.githubusercontent.com/devicons/devicon/d00d0969292a6569d45b06d3f350f463a0107b0d/icons/javascript/javascript-original.svg" alt="javascript" width="35" height="35"/>
    <img src="https://raw.githubusercontent.com/devicons/devicon/d00d0969292a6569d45b06d3f350f463a0107b0d/icons/nodejs/nodejs-original.svg" alt="nodejs" width="35" height="35">
    <img src="https://raw.githubusercontent.com/devicons/devicon/c5378d6c2510ffa0b3e4475af95618a8048d6cf1/icons/mongodb/mongodb-original-wordmark.svg" alt="mongo-db" width="35" height="35">
  </p>
<hr>

## Circuit Supply API

- 📦 [Repository](https://github.com/davewdh/circuit-supply-backend)
- 🖥 [Storefront](https://circuit-supply-frontend.onrender.com)
- [Live API](https://circuit-supply-backend.onrender.com)

### PayPal Sandbox checkout

Set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` on the API service using a PayPal Sandbox app. The API creates and captures USD orders using PayPal's sandbox endpoint. Use a sandbox buyer account to run the payment flow. The server also requires `JWT_SECRET` and `MONGODB_URI`.

Admins can open **Manage orders** from the storefront account menu. Fulfillment can move from paid to shipped and then delivered. Checkout validates current stock at quote and placement time.
