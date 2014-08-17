

module.exports = function(u, hwInfo, callback) {

  if(u.chipsetType(hwInfo) != 'atheros') {
    return callback(null, null);
  }

  var conf = {

  };

        
  callback(null, conf);
};
