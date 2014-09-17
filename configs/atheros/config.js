

module.exports = function(u, hwInfo, callback) {

  if(u.chipsetType(hwInfo) != 'atheros') {
    return callback(null, null);
  }

  var conf = {
      macAddr: u.macAddr(hwInfo),
      private_wifi_ssid: u.askUser("Enter desired private wifi SSID"),
      private_wifi_key: u.askUser("Enter desired private wifi password")
  };

        
  callback(null, conf);
};
