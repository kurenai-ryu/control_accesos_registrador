const fs = require('fs');
const PNG = require('pngjs').PNG;

fs.readFile('./imagen.txt', 'utf8',function(err,data){
  var png = new PNG({
    width:256,
    height: 288,
    filterType: -1,
  })
  png.data = new Buffer(data.replace(/(.{1})/g,"$10$10$10ff"),'hex');

  png.pack().pipe(fs.createWriteStream('newOut.png'));
});
