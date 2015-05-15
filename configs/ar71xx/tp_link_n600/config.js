

module.exports = function(u, hwInfo, callback) {

  // this config is only for TP-LINK TL-WDR3500
  if(hwInfo.model != 'TP-LINK TL-WDR3500') {
    return callback(null, null);
  }

  var conf = {
      macAddr: u.macAddr(hwInfo),
      private_wifi_ssid: u.askUser("Enter desired private wifi SSID"),
      private_wifi_key: u.askUser("Enter desired private wifi password")
  };

  callback(null, conf);
};
