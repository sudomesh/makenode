

module.exports = function(u, hwInfo, callback) {

  if(true) {
    console.error("Check for router model not implemented.");
    return callback(null, null);
  }

  var conf = {
      macAddr: u.macAddr(hwInfo),
      private_wifi_ssid: u.askUser("Enter desired private wifi SSID"),
      private_wifi_key: u.askUser("Enter desired private wifi password")
  };

  callback(null, conf);
};
