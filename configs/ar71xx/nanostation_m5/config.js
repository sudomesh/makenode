

module.exports = function(u, hwInfo, callback) {

  if(true) {
    console.error("Check for router model not implemented.");
    return callback(null, null);
  }

  var conf = {
      macAddr: u.macAddr(hwInfo)
      
  };

  callback(null, conf);
};
