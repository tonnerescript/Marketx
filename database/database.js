const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'data.json');

const defaults = {
  shops: {},
  products: [],
  giveaways: {},

  storeSettings: {},
  ticketRoles: {},
  tickets: {},
  orders: {},
  forms: {},
  promotions: {},
  reviews: {},
  orderHistory: {},
  counters: {},
  categories: {},
  coupons: {},
  loyalty: {},
  vendors: {}
};

function load() {
  try {
    if (!fs.existsSync(file)) {
      save(structuredClone(defaults));
      return structuredClone(defaults);
    }

    const data = JSON.parse(fs.readFileSync(file, 'utf8'));

    const merged = {
      ...structuredClone(defaults),
      ...data
    };

    for (const [key, value] of Object.entries(defaults)) {
      if (merged[key] === undefined || merged[key] === null) {
        merged[key] = structuredClone(value);
      }
    }

    return merged;
  } catch (error) {
    console.error('Erreur base de données:', error);
    throw error;
  }
}

function save(data) {
  const temp = file + '.tmp';

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(temp, JSON.stringify(data, null, 2));
  fs.renameSync(temp, file);
}

module.exports = { load, save };
