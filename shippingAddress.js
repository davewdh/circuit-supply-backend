const canadaRegions = new Set('AB BC MB NB NL NS NT NU ON PE QC SK YT'.split(' '));
const usRegions = new Set('AK AL AR AS AZ CA CO CT DC DE FL FM GA GU HI IA ID IL IN KS KY LA MA MD ME MH MI MN MO MP MS MT NC ND NE NH NJ NM NV NY OH OK OR PA PR PW RI SC SD TN TX UT VA VI VT WA WI WV WY AA AE AP'.split(' '));

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
        address.region = address.region.toUpperCase();
        if (!canadaRegions.has(address.region)) errors.region = 'Enter a Canadian province or territory abbreviation, such as ON.';
        const postal = address.postalcode.toUpperCase().replace(/\s/g, '');
        if (!/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/.test(postal)) {
            errors.postalcode = 'Enter a Canadian postal code in the format A1A 1A1.';
        } else {
            address.postalcode = postal.slice(0, 3) + ' ' + postal.slice(3);
        }
    } else if (['us', 'usa', 'unitedstates', 'unitedstatesofamerica'].includes(country)) {
        address.country = 'United States';
        address.region = address.region.toUpperCase();
        if (!usRegions.has(address.region)) errors.region = 'Enter a U.S. state or territory abbreviation, such as NY.';
        if (!/^\d{5}(?:-\d{4})?$/.test(address.postalcode)) errors.postalcode = 'Enter a 5-digit ZIP code or ZIP+4.';
    }

    if (Object.keys(errors).length) {
        throw Object.assign(new Error('Check your shipping address and try again.'), { status: 400, fields: errors });
    }
    return address;
}
