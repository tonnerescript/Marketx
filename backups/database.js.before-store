const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'data.json');

const defaults = {
  shops: {},
  products: [],
  giveaways: {}
};

function load() {
  try {
    if (!fs.existsSync(file)) {
      save(defaults);
      return structuredClone(defaults);
    }
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { ...structuredClone(defaults), ...data };
  } catch (error) {
    console.error('Erreur base de données:', error);
    return structuredClone(defaults);
  }
}

function save(data) {
  const temp = file + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(data, null, 2));
  fs.renameSync(temp, file);
}

module.exports = { load, save };
