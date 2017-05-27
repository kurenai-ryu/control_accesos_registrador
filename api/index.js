const fs = require('fs');
const cfg = require('configuracion');
const ip = require('obtener_ip');
const restify = require('restify');
const _ = require('lodash');
const each = require('each');
const Sensor = require('sensor');
const logger = require('logger');
const ldap = require('ldapjs');
const modelos = require('modelos_microservicio_personas');
const respuestas = require(`${cfg.directorio}/respuestas`);

const key = fs.readFileSync(`${cfg.directorio}/${cfg.certificado.ruta}/${cfg.certificado.nombre}.key`);
const cert = fs.readFileSync(`${cfg.directorio}/${cfg.certificado.ruta}/${cfg.certificado.nombre}.crt`);
const sensor = new Sensor();

let capturarHuella = (buffer = 1, numIntentos = 20) => {
  return new Promise((resolver, rechazar) => {
    let intentos = Array(numIntentos).fill(0);
    each((intentos))
    .call((intento, indice, siguiente) => {
      sensor.genImg()
      .then((res) => {
        if(res == '00') {
          logger.verbose('Huella detectada');
          return resolver(sensor.img2Tz(buffer));
        }
        else {
          setTimeout(() => {
            siguiente();
          }, 500);
        }
      })
      .catch((err) => {
        logger.error(err);
        setTimeout(() => {
          siguiente();
        }, 500);
      });
    })
    .then((err) => {
      if(err) {
        return rechazar(err);
      }
      else {
        return rechazar('No se detectó ninguna huella')
      }
    });
  });
};

let clienteLdap = ldap.createClient({
  url: `${Boolean(cfg.ldap.tls) ? 'ldaps' : 'ldap'}://${cfg.ldap.servidor}:${cfg.ldap.puerto}`,
  tlsOptions: {
    rejectUnauthorized: !Boolean(cfg.ldap.tls)
  },
  timeout: 1000 * 15,
  idleTimeout: 1000 * 3600,
  reconnect: true
});

clienteLdap.on('connect', () => {
  logger.verbose(`Conectado al servidor ${Boolean(cfg.ldap.tls) ? 'ldaps' : 'ldap'}://${cfg.ldap.servidor}:${cfg.ldap.puerto}`);
});

clienteLdap.on('error', (err) => {
  logger.error(err);
});

let app = restify.createServer({
  spdy: {
    key: key,
    cert: cert,
    protocols: ['h2', 'spdy/3.1', 'http/1.1'],
    plain: false,
    'x-forwarded-for': true,
    connection: {
      windowSize: 1024 * 1024,
      autoSpdy31: false
    }
  }
});

app.use((req, res, next) => {
  req.originalUrl = req.url;
  next();
});

app.use((req, res, siguiente) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header('Access-Control-Allow-Headers', 'Origin, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Response-Time, X-PINGOTHER, X-CSRF-Token, Authorization, Access-Control-Allow-Origin');
  res.header('Access-Control-Allow-Methods', 'DELETE, PATCH, GET, HEAD, POST, PUT, OPTIONS, TRACE');
  res.header('Access-Control-Expose-Headers', 'X-Api-Version, X-Request-Id, X-Response-Time, Authorization');
  res.header('Access-Control-Max-Age', '1000');
  siguiente();
});

app.on('MethodNotAllowed', (req, res) => {
  if(req.method && req.method.toLowerCase() === 'options') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Response-Time, X-PINGOTHER, X-CSRF-Token, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, PATCH, GET, HEAD, POST, PUT, OPTIONS, TRACE');
    res.setHeader('Access-Control-Expose-Headers', 'X-Api-Version, X-Request-Id, X-Response-Time, Authorization');
    res.setHeader('Access-Control-Max-Age', '1000');
    return res.send(204);
  }
  else {
    logger.error(`Método no existente ${req.method} para ${req.url}`)
    return res.send(new restify.MethodNotAllowedError());
  };
});

app.pre(restify.pre.sanitizePath());
app.use(restify.queryParser());
app.use(restify.bodyParser());

app.pre((req, res, next) => {
  let client = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  logger.info(`[${client}] ${req.method} : ${req.url}`)
  next();
});

app.on('after', (req, res, rout, err) => {
  let client = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  logger.info(`[${client}] ${req.method} ${res.statusCode} - ${req.url}`);
  if(err) {
    logger.error(err);
  };
});

app.on('uncaughtException', (req, res, route, error) => {
  logger.error(error)
});

/**
 * @api {post} /huellas Grabar una nueva huella o actualizar una existente
 * @apiVersion 1.0.0
 * @apiGroup Huellas
 * @apiParam {Number} id ID de la persona que se desea grabar sus huellas
  * @apiParamExample {json} Ejemplo
 *    {
 *      "id": 2
 *    }
 * @apiSuccess {Boolean} error Estado de error
 * @apiSuccess {Object} mensaje Mensaje de respuesta
 * @apiSuccessExample {json} Success
 *    HTTP/2 200 OK
 *    {
 *      "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c3VhcmlvIjoicGVwaXRvIiwicm9sZSI6InVzZXIiLCJpYXQiOjE0OTMwNjE4MTEsImV4cCI6MTQ5MzA3NjIxMX0.MDvw1C_Ij6NglnEe45eZfr0Af5fkhqRn4_Uu-6n4NDHxc-1Z-FWoGj_4Yga2FlIylSwQeimmHg4dThYqnFSAA9CZl0vTf_PEw9w3xQbPkSGFMpoMUnamt9W7QLyFs1BFmJJtaMd2YYbUOslQKfVMd7Z9hbOF8AMfYPdCgsYgOb4"
 *    }
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "error":"Usuario o contraseña incorrecta"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "error":"Usuario o contraseña incorrecta"
 *    }
 */

app.post(`/v${cfg.api.version}/huellas`, (req, res) => {
  modelos.Persona.findById(req.body.id)
  .then((persona) => {
    if(persona) {
      sensor.abrirPuerto('/dev/ttyUSB0')
      .then((ser) => {
        return capturarHuella(1);
      })
      .then((dat) => {
        return new Promise((resolver, rechazar) => {
          setTimeout(() => {
            return resolver(capturarHuella(2));
          }, 2500);
        })
      })
      .then((dat) => {
        return sensor.match();
      })
      .then((coincidencia) => {
        return new Promise((resolver, rechazar) => {
          if(parseInt(coincidencia, 16) > 100) {
            return resolver(sensor.regModel());
          }
          else {
            return rechazar('Las huellas no coinciden');
          }
        })
      })
      .then((dat) => {
        huella = [0, 1]
        return new Promise((resolver, rechazar) => {
          each(huella)
          .call((promesa, indice , siguiente) => {
            switch(promesa) {
              case 0:
                sensor.upChar()
                .then((plantilla) => {
                  huella[promesa] = plantilla;
                  siguiente();
                })
                .catch((err) => {
                  return rechazar(err);
                })
                break;
              case 1:
                sensor.upImage()
                .then((imagen) => {
                  huella[promesa] = imagen;
                  siguiente();
                })
                .catch((err) => {
                  return rechazar(err);
                })
                break;
              default:
                return rechazar('Error al acceder al sensor');
            };
          })
          .then((err) => {
            if(err) {
              return rechazar(err);
            }
            else {
              return resolver(huella);
            };
          });
        });
      })
      .then((huella) => {
        logger.error(huella[1].length);

        return modelos.Huella.upsert({
          id: req.body.id,
          plantilla: huella[0],
          imagen: huella[1]
        })
      })
      .then((dat) => {
        sensor.cerrarPuerto();
        res.send(respuestas.correcto.estado, {
          error: false,
          mensaje: `Huella de usuario ${persona.persona} actualizada`
        });
      })
      .catch((err) => {
        logger.error(err);
        res.send(respuestas.error.interno.estado, {
          error: true,
          mensaje: err
        });
      });
    }
    else {
      res.send(respuestas.error.datosErroneos.estado, {
        error: true,
        mensaje: respuestas.error.datosErroneos.mensaje
      });
    }
  })
  .catch((err) => {
    logger.error(err);
    res.send(respuestas.error.interno.estado, {
      error: true,
      mensaje: err.message
    });
  });
});

app.listen(cfg.api.puerto, () => {
  logger.info(`Servidor iniciado en https://${ip.obtenerIP()}:${cfg.api.puerto}`);
});
