

module.exports = function(u, hwInfo, callback) {

  // this config only for 2.4GHz non-dual-band nodes
  if(!u.is2point4GHz(hwInfo) || u.isDualBand(hwInfo)) {
    return callback(null, null);
  }

  var conf = {
      macAddr: u.macAddr(hwInfo),
      private_wifi_ssid: u.askUser("Enter desired private wifi SSID"),
      private_wifi_key: u.askUser("Enter desired private wifi password")
  };

  callback(null, conf);
};
