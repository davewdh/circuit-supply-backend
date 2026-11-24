const catalog = [
    ['Keystone 75 Mechanical Keyboard', 'keyboard', 'accessories', 109, 24,
        'A compact 75% layout with tactile switches, a detachable USB-C cable, and warm white keycaps.'],
    ['Contour Wireless Mouse', 'mouse', 'accessories', 59, 30,
        'An ergonomic wireless mouse with thumb controls, adjustable sensitivity, and a quiet scroll wheel.'],
    ['Horizon 27 QHD Monitor', 'monitor', 'monitor', 319, 12,
        'A 27-inch QHD display with a slim bezel and a low-profile stand for compact desks.'],
    ['Studio Wireless Headphones', 'headphones', 'earphones', 149, 18,
        'Over-ear wireless headphones with cushioned ear cups and a fold-flat design for easy storage.'],
    ['Field 14 Laptop', 'laptop', 'laptop', 899, 8,
        'A 14-inch aluminum laptop with 16 GB of memory and a 512 GB SSD. Stand sold separately.'],
    ['Relay USB-C Hub', 'hub', 'accessories', 45, 28,
        'A travel-friendly USB-C hub with HDMI, two USB-A ports, and USB-C power passthrough.'],
];

export const products = catalog.map(([name, image, category, price, stock, description]) => ({
    name,
    image: `/catalog/${image}.jpg`,
    brand: 'Circuit Supply',
    category,
    price,
    stock,
    description,
    rating: 0,
    numRev: 0,
}));

export const storefrontProductNames = products.map(product => product.name);
