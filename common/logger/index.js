const _ = require('lodash');
const fs = require('fs');
const path = require("path");
const moment = require('moment');
const cfg = require('../configuracion');
const winston = require('winston');
const morgan = require('morgan');
const { createLogger, format } = winston;

const nombreTrunc = _.pad(_.truncate(cfg.appNombre,{
  length : 10,
  omission: '..',
}),10);

const formatoFecha = () => moment().locale('es').format('YYYY-MM-DD HH:mm:ss');

const formatoFechaNombre = () => `${cfg.simpleLog ?
      nombreTrunc :
      colors.blue.inverse.underline(nombreTrunc)
      } ${formatoFecha()}`;

//{ error: 0, warn: 1, info: 2, verbose: 3, debug: 4, silly: 5 }
const transports = [
  new winston.transports.Console({
    name: 'pm2-console-log',
    level: cfg.depuracion?'debug':'info',
    json: false,
    colorize: !cfg.simpleLog,
    json: false,
    timestamp: formatoFechaNombre,
    stderrLevels: ['error','warn'],
  }),
];
if (cfg.depuracion)
  transports.push(new (winston.transports.File)({
    name : 'filename-log',
    filename : path.join(__dirname,`../../logs/${cfg.appNombre}.log`),
    maxsize : 10485760, //10MB
    maxFiles : 10,
    level: 'debug', //ommit
    zippedArchive: true,
    timestamp: formatoFecha,
    tailable: true,
    json: false, //#$"#%$""#$
  }));

const logger = createLogger({
  level: cfg.depuracion?'debug':'info',
  format: format.combine(
    format.colorize(),
    format.timestamp({format:'YY-MM-DD HH:mm:ss'}),
    format.printf(info => `${info.timestamp}:${info.level}: ${info.message}`)
  ),
  transports,
  exitOnError: false,
});

logger.stream = {
  write: (mensaje) => {
    logger.verbose(mensaje.slice(0, mensaje.length - 1));
  },
};
logger.verbose(`---------Iniciando registro para ${cfg.appNombre}--------`);

logger.morgan = (type, level) => morgan(type, { stream: { write: message => logger.log(level, message) }});
module.exports = logger;
