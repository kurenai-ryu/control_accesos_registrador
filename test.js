const each = require('each');
const fs = require('fs');
const PNGImage = require('pngjs-image');

function hexToBytes(hex) {
  for (var bytes = [], c = 0; c < hex.length; c += 2)
  bytes.push(parseInt(hex.substr(c, 2), 16));
  return bytes;
}

fs.readFile('./imagen.txt', 'utf8', (err, data) => {
  let datos = data.replace(/(.{1})/g,"$10");
  let imagen = PNGImage.createImage(256, 288);

  i = 0;
  for(let y = 0; y < 288; y++) {
    for(let x = 0; x < 256; x++) {
      imagen.setAt(x, y, {
        red: parseInt(datos.substring(i, i+2), 16),
        green: parseInt(datos.substring(i, i+2), 16),
        blue: parseInt(datos.substring(i, i+2), 16),
        alpha: 100
      });
      i = i+2;
    }
  }

  imagen.writeImage('./imagen.png', function (err) {
    if (err) throw err;
    console.log('Written to the file');
  });
});



// var fs = require('fs'),
//     PNG = require('pngjs').PNG;
//
// fs.readFile('./imagen.txt', 'utf8', function (err, data) {
//   new PNG({
//     width: 256,
//     height: 288,
//     filterType:4
//   })
//   .parse(new Buffer(data.replace(/(.{1})/g,"$10"), 'hex'), (error, data) => {
//     if(error) {
//       console.error(error);
//     }
//     else {
//
//     }
//   }).pack().pipe(fs.createWriteStream('newOut.png'));
// });




// const fs = require('fs');
// const bmp = require("bmp-js");
// const each = require('each');
// const logger = require('logger');
//
// fs.readFile('./imagen.txt', 'utf8', function (err, data) {
//   if (err) {
//     console.error(err);
//   }
//   else {
//     fs.writeFile('./imagen.png', bmp.encode({
//       data: new Buffer(data.replace(/(.{1})/g,"$10"), 'hex'),
//       rgb: true,
//       width: 256,
//       height: 288
//     }), {
//       flag : 'w'
//     }, function (err) {
//       if (err) {
//         return console.log(err);
//       }
//       else {
//         console.log('terminado');
//       }
//     });
//   };
// });
