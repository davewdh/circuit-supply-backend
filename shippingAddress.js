const regionKey = value => value.normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase().replace(/[^a-z]/g, '');

function regionAliases(entries) {
    const aliases = new Map();
    for (const [code, ...names] of entries) {
        for (const name of [code, ...names]) aliases.set(regionKey(name), code);
    }
    return aliases;
}

const canadaRegions = regionAliases([
    ['AB', 'Alberta'], ['BC', 'British Columbia'], ['MB', 'Manitoba'],
    ['NB', 'New Brunswick'], ['NL', 'Newfoundland and Labrador', 'Newfoundland'],
    ['NS', 'Nova Scotia'], ['NT', 'Northwest Territories'], ['NU', 'Nunavut'],
    ['ON', 'Ontario'], ['PE', 'Prince Edward Island', 'PEI'], ['QC', 'Québec'],
    ['SK', 'Saskatchewan'], ['YT', 'Yukon', 'Yukon Territory'],
]);

const usRegions = regionAliases([
    ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
    ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
    ['DC', 'District of Columbia', 'Washington DC'], ['FL', 'Florida'], ['GA', 'Georgia'],
    ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'],
    ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
    ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'],
    ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'],
    ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'],
    ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'],
    ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'],
    ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
    ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'],
    ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'],
    ['WI', 'Wisconsin'], ['WY', 'Wyoming'], ['AS', 'American Samoa'], ['FM', 'Micronesia', 'Federated States of Micronesia'],
    ['GU', 'Guam'], ['MH', 'Marshall Islands'], ['MP', 'Northern Mariana Islands'],
    ['PR', 'Puerto Rico'], ['PW', 'Palau'], ['VI', 'Virgin Islands', 'US Virgin Islands'],
    ['AA', 'Armed Forces Americas'], ['AE', 'Armed Forces Europe'], ['AP', 'Armed Forces Pacific'],
]);

function normalizeRegion(value, regions) {
    return /^[\p{L}\p{M}\s.,'’\-]+$/u.test(value) ? regions.get(regionKey(value)) : undefined;
}

const fields = {
    fullName: ['Enter the recipient’s full name.', 100],
    address: ['Enter the street address or PO box.', 150],
    addressLine2: ['Enter the apartment or suite in 80 characters or fewer.', 80],
    city: ['Enter the city or town.', 100],
    region: ['Enter the province, territory, or state.', 100],
    postalcode: ['Enter the postal or ZIP code.', 20],
    country: ['Enter the country.', 100],
};

export function validateShippingAddress(input) {
    const address = {};
    const errors = {};

    for (const [field, [message, length]] of Object.entries(fields)) {
        const value = input?.[field];
        const trimmed = typeof value === 'string' ? value.trim() : '';
        const optional = field === 'addressLine2' || field === 'region';
        if ((value !== undefined && typeof value !== 'string') || trimmed.length > length ||
            /[\p{Cc}]/u.test(trimmed) || (!optional && !/[\p{L}\p{N}]/u.test(trimmed))) {
            errors[field] = message;
        }
        address[field] = trimmed;
    }

    for (const field of ['fullName', 'city', 'country']) {
        if (!/\p{L}/u.test(address[field])) errors[field] = fields[field][0];
    }
    if (address.address.length < 4) errors.address = fields.address[0];

    const country = address.country.toLowerCase().replace(/[^a-z]/g, '');
    if (country === 'ca' || country === 'canada') {
        address.country = 'Canada';
        address.region = normalizeRegion(address.region, canadaRegions);
        if (!address.region) errors.region = 'Enter a Canadian province or territory, such as Ontario or ON.';
        const postal = address.postalcode.toUpperCase().replace(/\s/g, '');
        if (!/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/.test(postal)) {
            errors.postalcode = 'Enter a Canadian postal code in the format A1A 1A1.';
        } else {
            address.postalcode = postal.slice(0, 3) + ' ' + postal.slice(3);
        }
    } else if (['us', 'usa', 'unitedstates', 'unitedstatesofamerica'].includes(country)) {
        address.country = 'United States';
        address.region = normalizeRegion(address.region, usRegions);
        if (!address.region) errors.region = 'Enter a U.S. state or territory, such as New York or NY.';
        if (!/^\d{5}(?:-\d{4})?$/.test(address.postalcode)) errors.postalcode = 'Enter a 5-digit ZIP code or ZIP+4.';
    }

    if (Object.keys(errors).length) {
        throw Object.assign(new Error('Check your shipping address and try again.'), { status: 400, fields: errors });
    }
    return address;
}
