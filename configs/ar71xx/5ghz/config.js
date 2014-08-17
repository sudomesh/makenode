

module.exports = function(u, hwInfo, callback) {

  // this config only for 5GHz non-dual-band nodes
  if(!u.is5GHz(hwInfo) || u.isDualBand(hwInfo)) {
    return callback(null, null);
  }

  var conf = {
      macAddr: u.macAddr(hwInfo)
      
  };

  callback(null, conf);
};
