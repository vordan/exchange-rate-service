# National Bank of North Macedonia (NBRM) Exchange Rate Fetch Service

This Node.js service fetches exchange rates from the National Bank of North Macedonia and stores them in multiple MySQL databases. 
The service supports both daily scheduled fetching and debugging mode for frequent interval-based fetching. Multiple database connections are supported, and connections are dynamically managed through a configuration file.

The National Bank of North Macedonia (NBRM) provides an exchange rate service accessible through their website. The service can be accessed at [https://www.nbrm.mk/web-servis-novo.nspx](https://www.nbrm.mk/web-servis-novo.nspx), where general information about the web service is available. For technical details and API documentation, you can refer to [https://www.nbrm.mk/KLServiceNOV/](https://www.nbrm.mk/KLServiceNOV/).


## Table of Contents
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
	- [.env File](#env-file)
	- [db-connections.js File](#db-connectionsjs-file)
- [Running the Service](#running-the-service)
- [Logging](#logging)
- [Logs Example](#logs-example)
- [MySQL Table Structure](#mysql-table-structure)
- [Conclusion](#conclusion)
- [Troubleshooting](#troubleshooting)

## Features
- Fetches exchange rates and stores them in multiple MySQL databases with identical table structures.
- Configurable via environment variables and a connection configuration file.
- Supports daily scheduled fetching with `node-schedule`.
- Debug mode for frequent fetches at configurable intervals.
- Logs all actions and errors, with log rotation enabled.

## Prerequisites
- Node.js (v14.x or higher)
- MySQL database(s)

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/vordan/exchange-rate-service.git
   cd exchange-rate-service
   ```

2. **Install the required dependencies**:
   ```bash
   npm install
   ```

3. **Configuration**:
   - You need to configure both environment variables (`.env`) and the database connections (`config/db-connections.js`).

### Configuration

#### `.env` File

The `.env` file should be located in the `config/` directory. You can move or copy it there and configure the following environment variables:

```ini
# Path: config/.env

# Currencies to track (comma-separated list)
CURRENCIES=EUR,USD

# Fetch time for scheduled daily fetch (24-hour format: HH:mm:ss)
FETCH_TIME=00:00:01

# Debug mode (true or false)
DEBUG=false

# Interval for fetching data in debug mode (in milliseconds)
DEBUG_FETCH_INTERVAL=5000

# URL for the National Bank API with placeholders for dates
EXCHANGE_RATE_URL=https://www.nbrm.mk/KLServiceNOV/GetExchangeRates?StartDate={START_DATE}&EndDate={END_DATE}&format=json
```

- **CURRENCIES**: The list of currencies to track (e.g., EUR, USD).
- **FETCH_TIME**: The time of day when the daily scheduled fetch will occur (e.g., midnight + 1 second).
- **DEBUG**: Set to `true` to enable frequent fetches (for debugging purposes).
- **DEBUG_FETCH_INTERVAL**: The interval (in milliseconds) between fetches in debug mode (default is 5000 ms, or 5 seconds).
- **EXCHANGE_RATE_URL**: The URL template for the National Bank's API, with `{START_DATE}` and `{END_DATE}` placeholders.

#### `db-connections.js` File

The `config/db-connections.js` file contains the database connection details for each MySQL server. Each entry in the array corresponds to a separate MySQL database, and the same table structure is used in all databases.

```javascript
// Path: config/db-connections.js
module.exports = [
	{
		name: 'Foodlab', // For identification/logging
		host: 'localhost',
		user: 'root',
		password: 'infop',
		database: 'im_foodlab'
	},
	{
		name: 'Kursna lista',
		host: 'localhost',
		user: 'root',
		password: 'infop',
		database: 'ms_kursna_lista'
	},
	// Add more databases as needed
];
```

- **name**: A descriptive name for the database (used for logging purposes).
- **host**: The hostname or IP address of the MySQL server.
- **user**: The MySQL username for authentication.
- **password**: The MySQL user's password.
- **database**: The name of the MySQL database to which the service will connect.

### Running the Service

You can run the service either in normal or debug mode.

1. **Running the service normally**:
   This will fetch exchange rates daily at the time specified in `FETCH_TIME`.

   ```bash
   node exchange-rate-collect-service.js
   ```

2. **Running with pm2** (recommended):
   For continuous operation, it's recommended to run the service using `pm2`.

   ```bash
   pm2 start exchange-rate-collect-service.js --name exchange-rate-service
   ```

3. **Running in Debug Mode**:
   If debug mode is enabled (`DEBUG=true` in `.env`), the service will fetch exchange rates at the interval specified by `DEBUG_FETCH_INTERVAL` (in milliseconds).

### Logging

- **Location**: All logs are stored in the `logs/` directory.
- **Log Files**:
  - `error.log`: Stores all error logs.
  - `info.log`: Stores general information logs (e.g., successful inserts into the database).

- **Log Rotation**:
  - Logs are rotated monthly and compressed into a `.gz` file after rotation.
  - Old logs are kept for 12 months.

### Logs Example

Example log entry for a successful operation:

```bash
2024-09-14 00:01:00 [INFO]: Stored exchange rate for EUR in Database 1
```

Example log entry for an error:

```bash
2024-09-14 00:01:00 [ERROR]: Error storing rate in Database 1: Too many connections
```

### MySQL Table Structure

The service expects the following table structure in each MySQL database:

```sql
CREATE TABLE `kursna_lista` (
  `sifra` int NOT NULL AUTO_INCREMENT,
  `valuta_id` varchar(3) NOT NULL,
  `vazi_od` date NOT NULL,
  `kurs_banka_kupoven` decimal(17,5) NOT NULL DEFAULT '0.00000',
  `kurs_banka_sreden` decimal(17,5) NOT NULL DEFAULT '0.00000',
  `kurs_banka_prodazen` decimal(17,5) NOT NULL DEFAULT '0.00000',
  `kurs_menuvacnica_kupoven` decimal(17,2) NOT NULL DEFAULT '0.00',
  `kurs_menuvacnica_prodazen` decimal(17,2) NOT NULL DEFAULT '0.00',
  `kurs_planski` decimal(17,5) NOT NULL DEFAULT '0.00000',
  `kurs_referenten` decimal(17,5) NOT NULL DEFAULT '0.00000',
  `kurs_presmetkoven` decimal(17,5) NOT NULL DEFAULT '0.00000',
  `timestamping` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`sifra`),
  KEY `vazi_od` (`valuta_id`,`vazi_od`),
  KEY `valuta_id` (`valuta_id`)
);
```

### Conclusion

This service efficiently fetches exchange rates from the National Bank of North Macedonia and stores them in multiple databases. It provides easy configurability through `.env` and `db-connections.js`, making it suitable for systems where multiple MySQL databases need to be updated in one go. Logging with rotation ensures that the service remains manageable over time.

### Troubleshooting

- If you encounter a "Too many connections" error, consider increasing the `max_connections` setting in your MySQL configuration, or review the connection pooling setup.
- Ensure the `.env` and `db-connections.js` files are correctly configured before starting the service.

For further assistance, check the logs or contact the system administrator.
