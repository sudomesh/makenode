

module.exports = function(util, hwInfo, callback) {

  if(hwInfo.chipset != 'ar71xx') {
    return null;
  }

  var conf = {
    foo: 'bar'
  };

        
  callback(null, conf);
};
