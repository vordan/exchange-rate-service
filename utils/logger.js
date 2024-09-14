const winston = require('winston');
const path = require('path');
require('winston-daily-rotate-file'); // Importing the rotate file transport

// Create Winston logger instance
const logger = winston.createLogger({
	level: 'info',
	format: winston.format.combine(
		winston.format.timestamp({
			format: 'YYYY-MM-DD HH:mm:ss' // Adding timestamp with seconds precision
		}),
		winston.format.printf(({ timestamp, level, message }) => {
			return `${timestamp} [${level.toUpperCase()}]: ${message}`; // Log message format
		})
	),
	transports: [
		// Rotating transport for logs
		new winston.transports.DailyRotateFile({
			filename: path.join(__dirname, '../logs', 'application-%DATE%.log'), // Log file name pattern
			datePattern: 'YYYY-MM', // Rotate logs monthly
			zippedArchive: true, // Compress old logs
			maxFiles: '12m' // Keep logs for 12 months
		}),
		new winston.transports.File({
			filename: path.join(__dirname, '../logs', 'error.log'),
			level: 'error'
		}),
		new winston.transports.File({
			filename: path.join(__dirname, '../logs', 'info.log')
		})
	]
});

module.exports = logger;
