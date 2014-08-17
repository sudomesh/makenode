

module.exports = function(u, hwInfo, callback) {

  // this config only for 2.4GHz non-dual-band nodes
  if(!u.is2point4GHz(hwInfo) || u.isDualBand(hwInfo)) {
    return callback(null, null);
  }

  var conf = {
      macAddr: u.macAddr(hwInfo)
      
  };

  callback(null, conf);
};
