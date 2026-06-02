const fs = require('fs');

const sqlPath = 'F:/admin/Edsurance-Admin-main/Edsurance-Admin-main/prwdyacbce.sql';
const sqlContent = fs.readFileSync(sqlPath, 'utf8');

const countries = {};
const states = {};
const districts = {};

const extractAllInserts = (tableName, callback) => {
    const regex = new RegExp(`INSERT INTO \`${tableName}\` .*? VALUES\\s*(.*?);`, 'gis');
    let match;
    let count = 0;
    while ((match = regex.exec(sqlContent)) !== null) {
        const valuesStr = match[1];
        const rows = valuesStr.split('),').map(r => r.trim().replace(/^\(|\)$/g, ''));
        rows.forEach(row => {
            const values = row.split(',').map(v => v.trim().replace(/^'|'$/g, ''));
            callback(values);
            count++;
        });
    }
    console.log(`Extracted ${count} rows from ${tableName}`);
};

extractAllInserts('countries', (vals) => {
    countries[vals[0]] = { name: vals[1], states: [] };
});

extractAllInserts('states', (vals) => {
    states[vals[0]] = { name: vals[1], countryId: vals[3], districts: [] };
    if (countries[vals[3]]) countries[vals[3]].states.push(vals[0]);
});

extractAllInserts('districts', (vals) => {
    districts[vals[0]] = { name: vals[1], stateId: vals[3], cities: [] };
    if (states[vals[3]]) states[vals[3]].districts.push(vals[0]);
});

extractAllInserts('cities', (vals) => {
    const cityName = vals[1];
    const districtId = vals[3];
    if (districts[districtId]) {
        districts[districtId].cities.push(cityName);
    } else {
        // console.log(`District ${districtId} not found for city ${cityName}`);
    }
});

const result = {};
Object.values(countries).forEach(country => {
    result[country.name] = {};
    country.states.forEach(stateId => {
        const state = states[stateId];
        result[country.name][state.name] = {};
        state.districts.forEach(districtId => {
            const district = districts[districtId];
            result[country.name][state.name][district.name] = district.cities;
        });
    });
});

fs.writeFileSync('locations_new.json', JSON.stringify(result, null, 2));
console.log('Successfully generated locations_new.json');
