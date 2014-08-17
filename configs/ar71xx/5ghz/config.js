

module.exports = function(u, hwInfo, callback) {

  // this config only for 5GHz non-dual-band nodes
  if(!hwInfo.is5GHz(hwInfo) || hwInfo.isDualBand(hwInfo)) {
    return callback(null, null);
  }

  var conf = {
      macAddr: u.macAddr(hwInfo)
      
  };

  callback(null, conf);
};
