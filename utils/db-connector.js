const mysql = require('mysql2/promise'); // Import mysql2 for promise-based MySQL handling
const dbConnections = require('../config/db-connections'); // Import the DB connections configuration file

// Function to create a new connection pool for a specific database
function createDbPool(config) {
	return mysql.createPool({
		host: config.host,
		user: config.user,
		password: config.password,
		database: config.database
	});
}

module.exports = {
	createDbPool, // Export the pool creation function
	dbConnections // Export the dbConnections array if needed elsewhere
};
