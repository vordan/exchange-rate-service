const logger = require('./logger'); // Import logger
const chalk = require('chalk'); // Import chalk for debug
const dbConnections = require('../config/db-connections'); // Import the multiple DB configurations
const dbConnector = require('./db-connector'); // Import DB connector
require('dotenv').config({ path: './config/.env' }); // Load .env from the config folder

let __debug = process.env.DEBUG === 'true'; // Debug mode based on .env variable

// Create connection pools for all databases once
const dbPools = dbConnections.map(config => ({
	name: config.name,
	pool: dbConnector.createDbPool(config)
}));

// Function to map service fields to database fields
function _map_service_to_db_fields(rate) {
	// Manually map service fields to the correct DB fields

	const _sreden_kurs = _get_valid_rate(rate.sreden, 62);

	const field_mapping = {
		valuta_id:						rate.oznaka,
		vazi_od:							rate.datum.split('T')[0], // Mapping 'datum' to 'vazi_od', removing time part
		kurs_banka_kupoven:			_get_valid_rate(rate.kupoven,		_sreden_kurs),
		kurs_banka_sreden:			_get_valid_rate(rate.sreden,		_sreden_kurs),
		kurs_banka_prodazen:			_get_valid_rate(rate.prodazen,	_sreden_kurs),
		kurs_menuvacnica_kupoven:	_get_valid_rate(rate.kupoven,		_sreden_kurs),
		kurs_menuvacnica_prodazen:	_get_valid_rate(rate.prodazen,	_sreden_kurs),
		kurs_planski:					_get_valid_rate(process.env.PLANSKI_KURS, _sreden_kurs),
		kurs_referenten:				_get_valid_rate(rate.prodazen,	_sreden_kurs),
		kurs_presmetkoven:			_get_valid_rate(rate.prodazen,	_sreden_kurs),
	};

	return field_mapping;
}

// Function to dynamically generate the SQL insert query based on mapped fields
function _generate_insert_query(field_mapping) {
	// Prepare field names and values from the mapping
	const fields = Object.keys(field_mapping).join(', ');
	const placeholders = Object.keys(field_mapping).map(() => '?').join(', ');
	const values = Object.values(field_mapping);

	// Generate SQL query
	const query = `
		INSERT INTO kursna_lista (${fields})
		VALUES (${placeholders})
		ON DUPLICATE KEY UPDATE
			kurs_banka_sreden = VALUES(kurs_banka_sreden),
			kurs_banka_kupoven = VALUES(kurs_banka_kupoven),
			kurs_banka_prodazen = VALUES(kurs_banka_prodazen),
			kurs_menuvacnica_kupoven = VALUES(kurs_menuvacnica_kupoven),
			kurs_menuvacnica_prodazen = VALUES(kurs_menuvacnica_prodazen),
			kurs_planski = VALUES(kurs_planski),
			kurs_referenten = VALUES(kurs_referenten),
			kurs_presmetkoven = VALUES(kurs_presmetkoven)
	`;

	return { query, values };
}

// Helper function to ensure the value is a floating point number, or return a default
function _get_valid_rate(rate, defaultRate = 0.0) {
	// Check if the rate is a valid number and return it as a float
	const parsedRate = parseFloat(rate);
	return isNaN(parsedRate) ? defaultRate : parsedRate; // Return defaultRate if invalid
}

// Function to store rate in all databases
async function storeRateInAllDBs(rate) {
	// Map the service fields to DB fields (as before)
	const field_mapping = _map_service_to_db_fields(rate);

	// Generate dynamic SQL query
	const { query, values } = _generate_insert_query(field_mapping);

	// Iterate over each DB connection pool and execute the query
	for (const db of dbPools) {
		try {
			// Execute the query using the current DB pool
			await db.pool.execute(query, values);

			// Log the success
			logger.info(`Stored exchange rate for ${field_mapping.valuta_id} in ${db.name}`);
			if (__debug) {
				console.log(chalk.green(`Successfully stored rate for ${field_mapping.valuta_id} in ${db.name}`));
			}
		} catch (error) {
			// Log any errors
			logger.error(`Error storing rate in ${db.name}: ${error.message}`);
			if (__debug) {
				console.log(chalk.red(`Error storing rate in ${db.name}: ${error.message}`));
			}
		}
	}
}

module.exports = {
	storeRateInAllDBs // Export the function to store rates in all databases
};
