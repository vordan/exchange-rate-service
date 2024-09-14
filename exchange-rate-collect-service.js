const axios = require('axios');
const dayjs = require('dayjs'); // Date handling library
const logger = require('./utils/logger'); // Logger utility module
const dbInsert = require('./utils/db-insert'); // Database insertion module
const chalk = require('chalk'); // Chalk for debug logging
const schedule = require('node-schedule'); // For scheduling the daily task
const { randomInt } = require('crypto'); // For generating random numbers
require('dotenv').config({ path: './config/.env' }); // Load .env from the config folder

let __currencies = process.env.CURRENCIES.split(',').map(cur => cur.trim()); // Currencies to fetch from .env
let __fetch_time = process.env.FETCH_TIME || '00:00:01'; // Fetch time for regular mode (default to midnight + 1 sec)
let __debug = process.env.DEBUG === 'true'; // Define debug mode based on .env variable
let __debug_interval = process.env.DEBUG_FETCH_INTERVAL || 5000; // Fetch interval for debug mode (default to 5 seconds)

const MAX_RETRIES = 3; // Max number of retries for failed requests
const RETRY_DELAY = 5000; // Initial retry delay in milliseconds (increases with each retry)

// Main function to run the service daily or at frequent intervals in debug mode
function _run_daily() {
	if (__debug) {
		// Debug mode: fetch exchange rates every few seconds (interval set in .env or default 5s)
		setInterval(async function () {
			// Build API URL using the random date
			const _random_date = _get_random_date(); // Generate random date for debug mode

			logger.info('Starting debug mode exchange rate fetch...');
			if (__debug) console.log(chalk.blue(`Debug mode: Fetching data for random date ${_random_date}`));

			// Load the URL template from .env
			const __api_url_template = process.env.EXCHANGE_RATE_URL;

			// Replace placeholders in the URL with the actual dates
			const __api_url = __api_url_template
				 .replace('{START_DATE}', _random_date) // or _current_date for regular mode
				 .replace('{END_DATE}', _random_date); // or _current_date for regular mode
			if (__debug) console.log(chalk.blue(`Debug mode: Fetch URL: ${__api_url}`));

			try {
				// Fetch rates with retry logic
				const data = await _fetch_with_retry(__api_url);
				_process_exchange_rates(data); // Process fetched data
			} catch (error) {
				// Handle failure after retries in debug mode
				logger.error('Failed to fetch exchange rates in debug mode after retries');
				if (__debug) console.log(chalk.red('Failed to fetch exchange rates after retries.'));
			}
		}, __debug_interval); // Fetch every interval set in .env (or default 5 seconds)
	} else {
		// Regular mode: run daily at the configured time
		schedule.scheduleJob(__fetch_time, async function () {
			logger.info('Starting daily exchange rate fetch...');

			try {
				// Get current date and build API URL for today's rates
				const _current_date = dayjs().format('DD.MM.YYYY');

				// Load the URL template from .env
				const __api_url_template = process.env.EXCHANGE_RATE_URL;

				// Replace placeholders in the URL with the actual dates
				const __api_url = __api_url_template
					 .replace('{START_DATE}', _current_date) // or _current_date for regular mode
					 .replace('{END_DATE}', _current_date); // or _current_date for regular mode

				// Fetch rates with retry logic
				const data = await _fetch_with_retry(__api_url);
				_process_exchange_rates(data); // Process fetched data
			} catch (error) {
				// Handle failure after retries in regular mode
				logger.error('Failed to fetch exchange rates in daily mode after retries');
				if (__debug) console.log(chalk.red('Failed to fetch exchange rates after retries.'));
			}
		});
	}
}

// Function to fetch exchange rates with retry logic (retries on failure)
async function _fetch_with_retry(url, retries = MAX_RETRIES) {
	try {
		// Perform axios request with a 5-second timeout
		const response = await axios.get(url, { timeout: 5000 });
		return response.data; // Return fetched data if successful
	} catch (error) {
		// If retries are available, attempt to retry with an exponential backoff delay
		if (retries > 0) {
			logger.warn(`Request failed. Retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
			if (__debug) console.log(chalk.yellow(`Retrying... Attempt ${MAX_RETRIES - retries + 1}`));

			// Exponential backoff delay
			await _timeout(RETRY_DELAY * (MAX_RETRIES - retries + 1));

			// Retry request
			return _fetch_with_retry(url, retries - 1);
		} else {
			// All retries failed, log and throw error
			logger.error(`Error fetching exchange rates after ${MAX_RETRIES} retries: ${error.message}`);
			logger.error(`Stack trace: ${error.stack}`);

			if (__debug) {
				console.log(chalk.red(`Error after retries: ${error.message}`));
				console.log(chalk.red(`Stack trace: ${error.stack}`));
			}
			throw error; // Rethrow error to be caught later
		}
	}
}

// Function to process the fetched exchange rates
function _process_exchange_rates(_rates) {
	// Filter the rates to include only the currencies specified in .env
	let _filtered_rates = _rates.filter(rate => __currencies.includes(rate.oznaka));

	// Log filtered rates (debug)
	if (__debug) console.log(chalk.yellow(`Filtered rates: ${JSON.stringify(_filtered_rates)}`));

	// If no relevant currencies are found, log and exit
	if (_filtered_rates.length === 0) {
		logger.info('No relevant currencies found for storage.');
		if (__debug) console.log(chalk.yellow('No relevant currencies found.'));
		return;
	}

	// Loop through each filtered rate and store it in the DB
	_filtered_rates.forEach(rate => {
		dbInsert.storeRateInAllDBs(rate); // Store rate in all databases
	});
}

// Helper function to generate a random date within the past 3 months
function _get_random_date() {
	const _today = dayjs(); // Get current date
	const _past_3_months = _today.subtract(3, 'month'); // Date 3 months ago
	const _random_days = randomInt(0, 90); // Random number of days between 0 and 90
	return _past_3_months.add(_random_days, 'day').format('DD.MM.YYYY'); // Return formatted random date
}

// Helper function to introduce a delay (used for retry mechanism)
function _timeout(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

// Start the service
_run_daily(); // Execute the main function to begin fetching rates
