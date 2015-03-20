

module.exports = function(u, hwInfo, callback) {

  // this config is only for Western Digital My Net N750 routers
  if(hwInfo.model != 'WD My Net N750') {
    return callback(null, null);
  }

  var conf = {
      macAddr: u.macAddr(hwInfo),
      private_wifi_ssid: u.askUser("Enter desired private wifi SSID"),
      private_wifi_key: u.askUser("Enter desired private wifi password")
  };

  callback(null, conf);
};
