const fs = require('fs');
const each = require('each');
const logger = require('logger');
const Sensor = require('sensor');
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

sensor.abrirPuerto('/dev/ttyUSB0')
.then((ser) => {
  return capturarHuella(1);
})
.then((res) => {
  return new Promise((resolver, rechazar) => {
    setTimeout(() => {
      return resolver(capturarHuella(2));
    }, 2500);
  })
})
.then((res) => {
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
.then((res) => {
  return sensor.upImage();
})
.then((res) => {
  fs.writeFile('./imagen.txt', res, {
    flag : 'w'
  }, (err) => {
    if (err) {
      return console.log(err);
    }
    else {
      console.log('Terminado');
    }
  });
})
.catch((err) => {
  logger.error(err);
});
