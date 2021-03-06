const fs = require('fs');
const cfg = require('../common/configuracion');
const ip = require('../common/obtener_ip');
const restify = require('restify');
const _ = require('lodash');
const each = require('each');
const Sensor = require('../common/sensor');
const logger = require('../common/logger');
const ldap = require('ldapjs');
const modelos = require('../common/modelos_microservicio_personas');
const respuestas = require(`../common/respuestas`);

const key = fs.readFileSync(`${cfg.directorio}/${cfg.certificado.ruta}/${cfg.certificado.nombre}.key`);
const cert = fs.readFileSync(`${cfg.directorio}/${cfg.certificado.ruta}/${cfg.certificado.nombre}.crt`);
const sensor = new Sensor();

global.ocupado = false;

let capturarHuella = (buffer = 1, numIntentos = 20) => {
  return new Promise((resolver, rechazar) => {
    let intentos = Array(numIntentos).fill(0);
    each((intentos))
    .call((intento, indice, siguiente) => {
      sensor.genImg()
      .then((res) => {
        if(res == '00') {
          logger.verbose('Huella detectada');
          if (buffer==2){
            sensor.upImage().then((img)=>{
              sensor.imagen = img;
              return resolver(sensor.img2Tz(buffer));
            })
          }else
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
        return rechazar(err);
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
  logger.error("Error de cliente ldap")
  logger.error(err);
});

let buscarUsuarios = () => {
  return new Promise((resolver, rechazar) => {
    clienteLdap.bind(cfg.ldap.usuario, cfg.ldap.clave, (err) => {
      if(err) {
        logger.error("Error al ldap bind");
        logger.error(err);
        return rechazar(err);
      }
      else {
        let usuarios = [];

        clienteLdap.search(cfg.ldap.basedn, {
          scope: 'sub',
          filter: `(${cfg.ldap.identificador}=*)`
        }, (err, res) => {
          if(err) {
            logger.error("Error al buscar ldap")
            logger.error(err);
          }
          else {
            res.on('searchEntry', (usuario) => {
              usuarios.push(usuario.object.uid);
            });
            res.on('error', (err) => {
              logger.error("error de res ldap");
              logger.error(err);
              return rechazar(err);
            });
            res.on('end', (estado) => {
              logger.info(`Búsqueda finalizada con estado ${estado}`);
              return resolver(usuarios);
            });
          }
        });
      };
    });
  });
};

let sincronizarNombres = () => {
  return new Promise((resolver, rechazar) => {
    if(!global.ocupado) {
      logger.info('Iniciada sincronización con LDAP');
      global.ocupado = true;
      buscarUsuarios()
      .then((usuariosLdap) => {
        each(usuariosLdap)
        .call((usuarioLdap, indice, siguiente) => {
          modelos.Persona.find({
            where: {
              persona: usuarioLdap
            }
          })
          .then((res) => {
            if(res) {
              siguiente();
            }
            else {
              modelos.Personal.create({
                persona: usuarioLdap,
                habilitado: true
              })
              .then((res) => {
                siguiente();
              })
              .catch((err) => {
                logger.error(err);
                siguiente();
              })
            }
          })
          .catch((err) => {
            logger.error(err);
            siguiente();
          })
        })
        .then((err) => {
          if(err) {
            global.ocupado = false;
            return rechazar(err);
          }
          else {
            modelos.Personal.findAll({
              attributes: ['persona']
            })
            .then((usuarios) => {
              each(usuarios)
              .call((usuario, indice, siguiente) => {
                if(usuariosLdap.indexOf(usuario.persona) == -1) {
                  modelos.Personal.update({
                    habilitado: false
                  },{
                    where: {
                      persona: usuario.persona
                    }
                  })
                  .then((res) => {
                    siguiente();
                  })
                  .catch((err) => {
                    logger.error(err.message);
                    siguiente();
                  });
                }
                else {
                  siguiente();
                };
              })
              .then((err) => {
                if(err) {
                  global.ocupado = false;
                  return rechazar(err);
                }
                else {
                  global.ocupado = false;
                  return resolver('Terminada sincronización con LDAP');
                };
              });
            })
            .catch((err) => {
              global.ocupado = false;
              return rechazar(err);
            });
          };
        });
      })
      .catch((err) => {
        global.ocupado = false;
        return rechazar(err);
      });
    }
    else {
      return rechazar('La sincronización aún está en curso');
    }
  });
};

/*setInterval(() => {
  sincronizarNombres()
  .then((res) => {
    logger.info(res);
  })
  .catch((err) => {
    logger.error(err);
  });
}, cfg.ldap.tiempoSincronizacion);*/

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
app.use(restify.plugins.queryParser({mapParams: true}));
app.use(restify.plugins.bodyParser({mapParams: true, mapFiles: true}));
app.use(restify.plugins.acceptParser(app.acceptable));

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

app.on('uncaughtException', (req, res, route, err) => {
  logger.error(err)
});

app.patch(`/v${cfg.api.version}/huellas`, (req, res) => {
  let huellas = null;  
  modelos.Huella.findAll({
    attributes: ['id', 'plantilla'],
    order: [['id', 'ASC']],
    include : [{
      model: modelos.Personal,
      attributes: [],
      where: {
        habilitado: true,
      }
    }]
  }).then((datos) => {
    if (!datos) return Promise.reject('Error: sin huellas')
    huellas = datos
    logger.debug ("huellas habilitadas " + datos.length);
    return sensor.abrirPuerto(cfg.sensor.puerto) //test en raspberry
  }).then(()=>{
    res.send(respuestas.correcto.completado.estado, {
      error: false,
      mensaje: "Inciando Limpieza y Descarga de Huellas"
    });
    logger.info("Limpiando Sensor...");
    return sensor.empty();
  }).then(() => {
    let sequence = Promise.resolve();
    huellas.forEach(huella => {
      //huella.id, huella.plantilla
      sequence = sequence.then(()=> {
        logger.info("Inciando descarga de huella id:" + huella.id)
        return sensor.downChar();
      }).then(() => {
        logger.debug("enviar plantilla "); // + huella.plantilla);
        let paquetes = sensor.armarDato(huella.plantilla)
        let seq = Promise.resolve()
        paquetes.forEach(paq => {
          seq = seq.then(()=>{
            //return sensor._enviar(paq); _enviar waits response
            return new Promise((resolve, rej)=> {
              sensor.serial.write(paq,'hex', (err) => {
                if (err) return reject('error on paq.write');
                sensor.serial.drain(() => setTimeout(() => resolve(), 100)); //give 100ms more
              });
            });
          })
        })
        return seq
      }).then(() => {
        return sensor.store(huella.id);
      }).catch(err=>{
        logger.debug("store " + huella.id)
        logger.debug (err)
        return Promise.reject("Error al almacenar")
      }).then(() => {
        return sensor.loadChar(huella.id);
      }).then(()=>{
        return sensor.upChar()
      }).catch(err => {
        logger.debug("load&up " + huella.id)
        logger.debug (err);
        return Promise.reject("Error al leer huella " + huella.id);
      }).then((h)=> {
        if (h != huella.plantilla){
          logger.debug ("plantilla: " + huella.plantilla);
          logger.debug ("recibido : " + h);
          return Promise.reject("Huellas no coinciden!");
        }
        logger.info("correcto!")
        return Promise.resolve("Huellas coniciden")
      }).catch(err => {
        logger.warn(err)
        return Promise.resolve(); //continuar?
      })
    });
    return sequence;
  }).then(()=>{
    logger.info ("huellas descargadas!")
    sensor.cerrarPuerto();
  }).catch( e => {
    logger.debug(e);
    res.send(respuestas.error.datosErroneos.estado, {
      error: true,
      mensaje: "Error al enviar datos"
    });
    sensor.cerrarPuerto();
  })

})

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
 *      "error": false,
 *      "mensaje": "Huella de usuario jdoe actualizada"
 *    }
 * @apiError {json} 500 Error interno
 *    HTTP/2 500
 *    {
 *      "error": true,
 *      "mensaje": "Conexión perdida con el sensor"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 500
 *    {
 *      "error": true,
 *      "mensaje": "No se detectó ninguna huella"
 *    }
 */
app.post(`/v${cfg.api.version}/huellas`, (req, res) => {
  modelos.Personal.findById(req.body.id)
  .then((persona) => {
    if(persona) {
      sensor.abrirPuerto(cfg.sensor.puerto) //test en raspberry
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
                huella[promesa] = sensor.imagen;
                siguiente();
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
      	sensor.cerrarPuerto();
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

/**
 * @api {patch} /ldap Sincroniza manualmente los datos de LDAP con los de la base de datos
 * @apiVersion 1.0.0
 * @apiGroup LDAP
 * @apiSuccess {Boolean} error Estado de error
 * @apiSuccess {Object} mensaje Mensaje de respuesta
 * @apiSuccessExample {json} Success
 *    HTTP/2 200 OK
 *    {
 *      "error": false,
 *      "mensaje": "Terminada sincronización con LDAP"
 *    }
 * @apiError {json} 409 Ocupado
 *    HTTP/2 409
 *    {
 *      "error": true,
 *      "mensaje": "La sincronización aún está en curso"
 *    }
 * @apiErrorExample {json} 409 Ocupado
 *    HTTP/2 409
 *    {
 *      "error": true,
 *      "mensaje": "La sincronización aún está en curso"
 *    }
 */

app.patch(`/v${cfg.api.version}/ldap`, (req, res) => {
  sincronizarNombres()
  .then((msg) => {
    res.send(respuestas.correcto.completado.estado, {
      error: false,
      mensaje: msg
    });
  })
  .catch((err) => {
    res.send(respuestas.error.ocupado.estado, {
      error: false,
      mensaje: err
    });
  });
});

app.listen(cfg.api.puerto, () => {
  logger.info(`Servidor iniciado en https://${ip.obtenerIP()}:${cfg.api.puerto}`);
});
